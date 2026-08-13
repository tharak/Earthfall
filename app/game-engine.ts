import * as THREE from "three";
import { pointInMapObstacle, type MapPolygonObstacle } from "./real-map";
import { MISSION_MAPS, type MissionMapId, type RealMapData } from "./map-content";
import {
  AUTHORED_LAYOUT_SCALE,
  ENEMY_RESPAWN_DELAY_MS,
  EXTRACTION_POSITIONS,
  MISSION_RADIUS_METERS,
  MISSION_SECONDS,
  REQUIRED_KILLS,
  WEAPONS,
} from "./game-config";
import { RuleBasedEnemyController } from "./enemy-controller";
import { createEnemy, createExtractionPoint, createPlayer } from "./entity-factories";
import { createMissionEnvironment } from "./mission-environment";
import { GameInput } from "./game-input";
import { OrbitCameraController } from "./orbit-camera";
import type {
  BoxObstacle,
  EnemyController,
  EnemyEntity,
  EnemyKind,
  ExtractionEntity,
  MissionHud,
  MissionResult,
  PickupEntity,
  SkinId,
  TimedObject,
  TouchInput,
  WeaponId,
} from "./game-types";

export class GameEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(52, 1, 0.1, 600);
  private readonly clock = new THREE.Clock();
  private readonly player: THREE.Group;
  private readonly playerBody: THREE.Mesh;
  private readonly playerAccent: THREE.Mesh;
  private readonly cameraController: OrbitCameraController;
  private readonly input: GameInput;
  private readonly raycaster = new THREE.Raycaster();
  private readonly aimPoint = new THREE.Vector3(0, 0, -8);
  private readonly enemies: EnemyEntity[] = [];
  private readonly pickups: PickupEntity[] = [];
  private readonly timedObjects: TimedObject[] = [];
  private readonly obstacles: BoxObstacle[] = [];
  private readonly mapObstacles: MapPolygonObstacle[] = [];
  private readonly touch: TouchInput;
  private readonly mapData: RealMapData;
  private readonly weaponId: WeaponId;
  private readonly weapon: (typeof WEAPONS)[WeaponId];
  private readonly onHud: (hud: MissionHud) => void;
  private readonly onEnd: (result: MissionResult) => void;
  private readonly extractions: ExtractionEntity[] = [];
  private readonly enemyController: EnemyController = new RuleBasedEnemyController();
  private readonly respawnTimers: number[] = [];

  private animationFrame = 0;
  private ended = false;
  private health = 100;
  private ammo = 12;
  private kills = 0;
  private salvage = 0;
  private timeLeft = MISSION_SECONDS;
  private shotCooldown = 0;
  private reloadRemaining = 0;
  private extractionProgress = 0;
  private hudCooldown = 0;
  private message = "Destroy the occupation machines";
  private messageTime = 3.5;
  private cameraShake = 0;
  private enemyId = 0;

  constructor(
    canvas: HTMLCanvasElement,
    mapId: MissionMapId,
    weaponId: WeaponId,
    skinId: SkinId,
    touch: TouchInput,
    onHud: (hud: MissionHud) => void,
    onEnd: (result: MissionResult) => void,
  ) {
    this.canvas = canvas;
    this.mapData = MISSION_MAPS[mapId];
    this.weaponId = weaponId;
    this.weapon = WEAPONS[weaponId];
    this.ammo = this.weapon.magazine;
    this.touch = touch;
    this.onHud = onHud;
    this.onEnd = onEnd;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    this.scene.background = new THREE.Color(0xaed6e5);
    this.scene.fog = new THREE.FogExp2(0xc1dce3, 0.008);
    this.cameraController = new OrbitCameraController(this.camera, this.canvas);
    this.input = new GameInput(this.canvas, this.cameraController, () => this.startReload());
    window.addEventListener("resize", this.resize);

    const player = createPlayer(skinId);
    this.player = player.group;
    this.playerBody = player.body;
    this.playerAccent = player.accent;
    this.player.position.set(0, 0, 10 * AUTHORED_LAYOUT_SCALE);
    this.scene.add(this.player);

    EXTRACTION_POSITIONS.forEach(([x, z]) => {
      const extraction = createExtractionPoint();
      extraction.group.position.set(x, 0, z);
      this.extractions.push(extraction);
      this.scene.add(extraction.group);
    });

    this.buildEnvironment();
    this.spawnEnemies();
    this.resize();
    this.emitHud();
    this.animate();
  }

  destroy() {
    cancelAnimationFrame(this.animationFrame);
    this.respawnTimers.forEach((timer) => window.clearTimeout(timer));
    window.removeEventListener("resize", this.resize);
    this.input.destroy();
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((item) => item.dispose());
      else material?.dispose();
    });
    this.renderer.dispose();
  }

  private buildEnvironment() {
    const environment = createMissionEnvironment(this.scene, this.mapData);
    this.mapObstacles.push(...environment.mapObstacles);
    this.obstacles.push(...environment.obstacles);
    this.player.position.copy(this.findOpenPosition(this.player.position.x, this.player.position.z));
    this.extractions.forEach((extraction) => {
      extraction.group.position.copy(this.findOpenPosition(extraction.group.position.x, extraction.group.position.z));
    });
  }
  private spawnEnemies() {
    const spawnPoints: Array<[number, number, EnemyKind]> = [
      [-13, -11, "hunter"],
      [-6, -15, "sentry"],
      [3, -17, "hunter"],
      [13, -12, "hunter"],
      [15, -3, "sentry"],
      [14, 10, "hunter"],
      [4, 14, "hunter"],
      [-7, 15, "sentry"],
      [-15, 8, "hunter"],
      [-16, -2, "hunter"],
    ];
    spawnPoints.forEach(([x, z, kind], index) => {
      const position = this.findOpenPosition(x * AUTHORED_LAYOUT_SCALE, z * AUTHORED_LAYOUT_SCALE);
      this.addEnemy(position.x, position.z, kind, index * 0.61);
    });
  }

  private addEnemy(x: number, z: number, kind: EnemyKind, phase: number) {
    const enemy = createEnemy(++this.enemyId, x, z, kind, phase);
    this.scene.add(enemy.group);
    this.enemies.push(enemy);
  }

  private spawnReplacementEnemy(kind: EnemyKind) {
    const seedAngle = this.enemyId * 2.399963;
    for (const radius of [42, 52, 62]) {
      for (let offset = 0; offset < 16; offset += 1) {
        const angle = seedAngle + (offset / 16) * Math.PI * 2;
        const x = this.player.position.x + Math.cos(angle) * radius;
        const z = this.player.position.z + Math.sin(angle) * radius;
        if (Math.abs(x) > MISSION_RADIUS_METERS || Math.abs(z) > MISSION_RADIUS_METERS || this.isBlocked(x, z)) continue;
        if (this.enemies.some((enemy) => Math.hypot(enemy.group.position.x - x, enemy.group.position.z - z) < 6)) continue;
        this.addEnemy(x, z, kind, seedAngle);
        this.message = "Replacement signal detected";
        this.messageTime = 1.2;
        return;
      }
    }
    const fallback = this.findOpenPosition(
      THREE.MathUtils.clamp(this.player.position.x + 40, -MISSION_RADIUS_METERS, MISSION_RADIUS_METERS),
      THREE.MathUtils.clamp(this.player.position.z + 40, -MISSION_RADIUS_METERS, MISSION_RADIUS_METERS),
    );
    this.addEnemy(fallback.x, fallback.z, kind, seedAngle);
  }

  private resize = () => {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  };

  private animate = () => {
    if (this.ended) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.animationFrame = requestAnimationFrame(this.animate);
  };

  private update(dt: number) {
    this.timeLeft -= dt;
    this.shotCooldown = Math.max(0, this.shotCooldown - dt);
    const wasReloading = this.reloadRemaining > 0;
    this.reloadRemaining = Math.max(0, this.reloadRemaining - dt);
    this.messageTime = Math.max(0, this.messageTime - dt);
    this.cameraShake = Math.max(0, this.cameraShake - dt * 3.8);

    if (wasReloading && this.reloadRemaining === 0) {
      this.ammo = this.weapon.magazine;
      this.message = "Magazine ready";
      this.messageTime = 0.8;
    }

    if (this.touch.reload) this.startReload();
    this.updateAim();
    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updatePickups(dt);
    this.updateEffects(dt);
    this.updateExtraction(dt);
    this.updateCamera(dt);

    if ((this.input.isFiring() || this.touch.fire) && this.shotCooldown <= 0) {
      this.shoot();
    }

    this.hudCooldown -= dt;
    if (this.hudCooldown <= 0) {
      this.emitHud();
      this.hudCooldown = 0.08;
    }

    if (this.health <= 0) this.finish(false, "eliminated");
    else if (this.timeLeft <= 0) this.finish(false, "timeout");
  }

  private updateAim() {
    if (this.touch.fire) {
      const target = this.findNearestEnemy();
      if (target) this.aimPoint.copy(target.group.position);
      return;
    }
    this.raycaster.setFromCamera(this.input.pointer, this.camera);
    const ray = this.raycaster.ray;
    const distance = -ray.origin.y / ray.direction.y;
    if (distance > 0) this.aimPoint.copy(ray.origin).addScaledVector(ray.direction, distance);
  }

  private updatePlayer(dt: number) {
    const move = new THREE.Vector3();
    if (this.input.isPressed("KeyW") || this.input.isPressed("ArrowUp") || this.touch.up) move.z -= 1;
    if (this.input.isPressed("KeyS") || this.input.isPressed("ArrowDown") || this.touch.down) move.z += 1;
    if (this.input.isPressed("KeyA") || this.input.isPressed("ArrowLeft") || this.touch.left) move.x -= 1;
    if (this.input.isPressed("KeyD") || this.input.isPressed("ArrowRight") || this.touch.right) move.x += 1;
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(5.3 * dt);
      const previous = this.player.position.clone();
      this.player.position.add(move);
      this.player.position.x = THREE.MathUtils.clamp(this.player.position.x, -MISSION_RADIUS_METERS, MISSION_RADIUS_METERS);
      this.player.position.z = THREE.MathUtils.clamp(this.player.position.z, -MISSION_RADIUS_METERS, MISSION_RADIUS_METERS);
      if (this.isBlocked(this.player.position.x, this.player.position.z)) this.player.position.copy(previous);
    }
    const dx = this.aimPoint.x - this.player.position.x;
    const dz = this.aimPoint.z - this.player.position.z;
    if (Math.abs(dx) + Math.abs(dz) > 0.01) this.player.rotation.y = Math.atan2(-dx, -dz);
  }

  private updateEnemies(dt: number) {
    const playerPosition = this.player.position;
    this.enemies.forEach((enemy) => {
      enemy.cooldown -= dt;
      enemy.flash = Math.max(0, enemy.flash - dt);
      const bodyMaterial = enemy.body.material as THREE.MeshStandardMaterial;
      bodyMaterial.emissive.setHex(enemy.flash > 0 ? 0xffffff : 0x000000);
      bodyMaterial.emissiveIntensity = enemy.flash > 0 ? 1.5 : 0;

      const offset = playerPosition.clone().sub(enemy.group.position);
      const distance = offset.length();
      enemy.group.rotation.y = Math.atan2(-offset.x, -offset.z);

      const intent = this.enemyController.decide({
        kind: enemy.kind,
        toPlayerX: offset.x,
        toPlayerZ: offset.z,
        distance,
        attackRange: enemy.attackRange,
        lineOfSight: !this.lineBlocked(enemy.group.position, playerPosition),
        phase: enemy.patrolAngle,
        elapsedMs: performance.now(),
      });

      if (!intent.attack) {
        const direction = new THREE.Vector3(intent.moveX, 0, intent.moveZ);
        this.moveEnemyWithAvoidance(enemy, direction, enemy.speed * dt);
      } else if (enemy.cooldown <= 0) {
        this.enemyShoot(enemy);
        enemy.cooldown = enemy.attackDelay;
      }

      enemy.sensor.scale.setScalar(1 + Math.sin(performance.now() * 0.006 + enemy.id) * 0.16);
    });
  }

  private moveEnemyWithAvoidance(enemy: EnemyEntity, desiredDirection: THREE.Vector3, distance: number) {
    const steeringAngles = [0, Math.PI / 6, -Math.PI / 6, Math.PI / 3, -Math.PI / 3, Math.PI / 2, -Math.PI / 2];
    for (const angle of steeringAngles) {
      const direction = desiredDirection.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      const nextX = enemy.group.position.x + direction.x * distance;
      const nextZ = enemy.group.position.z + direction.z * distance;
      if (this.isBlocked(nextX, nextZ)) continue;
      enemy.group.position.x = nextX;
      enemy.group.position.z = nextZ;
      return;
    }
  }

  private updatePickups(dt: number) {
    for (let index = this.pickups.length - 1; index >= 0; index -= 1) {
      const pickup = this.pickups[index];
      pickup.phase += dt * 2.5;
      pickup.mesh.rotation.y += dt * 1.8;
      pickup.mesh.position.y = pickup.baseY + Math.sin(pickup.phase) * 0.2;
      const distance = pickup.mesh.position.distanceTo(this.player.position);
      if (distance < 1.65) {
        this.salvage += pickup.value;
        this.message = `+${pickup.value} unsecured salvage`;
        this.messageTime = 1.1;
        this.scene.remove(pickup.mesh);
        pickup.mesh.geometry.dispose();
        (pickup.mesh.material as THREE.Material).dispose();
        this.pickups.splice(index, 1);
      }
    }
  }

  private updateEffects(dt: number) {
    for (let index = this.timedObjects.length - 1; index >= 0; index -= 1) {
      const effect = this.timedObjects[index];
      effect.life -= dt;
      if (effect.velocity) effect.object.position.addScaledVector(effect.velocity, dt);
      const opacity = Math.max(0, effect.life / effect.maxLife);
      const object = effect.object as THREE.Mesh;
      if (object.material && !Array.isArray(object.material)) {
        const material = object.material as THREE.Material & { opacity: number };
        material.transparent = true;
        material.opacity = opacity;
      }
      if (effect.life <= 0) {
        this.scene.remove(effect.object);
        effect.object.traverse((child) => {
          const mesh = child as THREE.Mesh;
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose());
          else mesh.material?.dispose();
        });
        this.timedObjects.splice(index, 1);
      }
    }
  }

  private updateExtraction(dt: number) {
    let nearestDistance = Number.POSITIVE_INFINITY;
    this.extractions.forEach((extraction) => {
      extraction.ring.rotation.z += dt * 0.4;
      const beamMaterial = extraction.beam.material as THREE.MeshBasicMaterial;
      beamMaterial.opacity = 0.055 + Math.sin(performance.now() * 0.003) * 0.018;
      nearestDistance = Math.min(nearestDistance, this.player.position.distanceTo(extraction.group.position));
    });

    const holding = this.input.isPressed("KeyE") || this.touch.extract;
    if (nearestDistance < 2.35 && holding) {
      this.extractionProgress = Math.min(1, this.extractionProgress + dt / 2.1);
      this.message = "Transfer lock acquired";
      this.messageTime = 0.2;
      if (this.extractionProgress >= 1) this.finish(true, "extracted");
    } else {
      this.extractionProgress = Math.max(0, this.extractionProgress - dt * 0.75);
      if (nearestDistance < 2.35 && this.messageTime <= 0) {
        this.message = "Hold E to extract";
        this.messageTime = 0.25;
      }
    }
  }

  private updateCamera(dt: number) {
    this.cameraController.update(dt, this.player.position, this.cameraShake);
  }

  private shoot() {
    if (this.reloadRemaining > 0) return;
    if (this.ammo <= 0) {
      this.startReload();
      return;
    }
    this.ammo -= 1;
    this.shotCooldown = this.weapon.shotDelay;
    this.playerAccent.scale.z = 1.55;
    window.setTimeout(() => {
      if (!this.ended) this.playerAccent.scale.z = 1;
    }, 55);

    const origin = this.player.position.clone().add(new THREE.Vector3(0, 1.15, 0));
    const direction = this.aimPoint.clone().sub(this.player.position).setY(0).normalize();
    const maxDistance = 24;
    let target: EnemyEntity | null = null;
    let targetDistance = maxDistance;
    this.enemies.forEach((enemy) => {
      const toEnemy = enemy.group.position.clone().sub(this.player.position).setY(0);
      const projection = toEnemy.dot(direction);
      if (projection <= 0 || projection >= targetDistance) return;
      const perpendicular = toEnemy.clone().addScaledVector(direction, -projection).length();
      if (perpendicular < (enemy.kind === "sentry" ? 0.95 : 0.72) && !this.lineBlocked(this.player.position, enemy.group.position)) {
        target = enemy;
        targetDistance = projection;
      }
    });

    const end = origin.clone().addScaledVector(direction, target ? targetDistance : maxDistance);
    end.y = target ? 1.05 : 0.55;
    this.createTracer(origin, end, this.weapon.color, 0.12);
    this.cameraShake = this.weaponId === "arc" ? 0.22 : 0.12;

    if (target) this.damageEnemy(target, this.weapon.damage);
    if (this.ammo === 0) {
      this.message = "Magazine empty — press R";
      this.messageTime = 1.5;
    }
  }

  private damageEnemy(enemy: EnemyEntity, damage: number) {
    enemy.health -= damage;
    enemy.flash = 0.08;
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 6),
      new THREE.MeshBasicMaterial({ color: this.weapon.color, transparent: true }),
    );
    hit.position.copy(enemy.group.position).add(new THREE.Vector3(0, 1.1, 0));
    this.scene.add(hit);
    this.timedObjects.push({ object: hit, life: 0.18, maxLife: 0.18 });
    if (enemy.health <= 0) this.destroyEnemy(enemy);
  }

  private destroyEnemy(enemy: EnemyEntity) {
    const index = this.enemies.indexOf(enemy);
    if (index < 0) return;
    this.enemies.splice(index, 1);
    this.scene.remove(enemy.group);
    this.kills += 1;
    this.createBurst(enemy.group.position, enemy.kind === "hunter" ? 0xff465d : 0xffb23e);
    this.spawnPickup(enemy.group.position, enemy.kind === "hunter" ? 35 : 55);
    if (this.kills === REQUIRED_KILLS) {
      this.message = "Objective complete — extract when ready";
      this.messageTime = 3;
    } else if (this.kills > REQUIRED_KILLS) {
      this.message = "Machine destroyed — reinforcements inbound";
      this.messageTime = 1.1;
    } else {
      this.message = `${REQUIRED_KILLS - this.kills} machines remain`;
      this.messageTime = 1.1;
    }
    const timer = window.setTimeout(() => {
      const timerIndex = this.respawnTimers.indexOf(timer);
      if (timerIndex >= 0) this.respawnTimers.splice(timerIndex, 1);
      if (!this.ended) this.spawnReplacementEnemy(enemy.kind);
    }, ENEMY_RESPAWN_DELAY_MS);
    this.respawnTimers.push(timer);
  }

  private spawnPickup(position: THREE.Vector3, value: number) {
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.34, 1),
      new THREE.MeshStandardMaterial({
        color: 0x63ffb2,
        emissive: 0x20a76c,
        emissiveIntensity: 1.6,
        roughness: 0.2,
        metalness: 0.5,
      }),
    );
    mesh.position.copy(position);
    mesh.position.y = 0.62;
    this.scene.add(mesh);
    this.pickups.push({ mesh, value, baseY: 0.62, phase: Math.random() * Math.PI * 2 });
  }

  private createBurst(position: THREE.Vector3, color: number) {
    for (let index = 0; index < 8; index += 1) {
      const fragment = new THREE.Mesh(
        new THREE.BoxGeometry(0.18 + Math.random() * 0.22, 0.18 + Math.random() * 0.22, 0.18 + Math.random() * 0.22),
        new THREE.MeshBasicMaterial({ color, transparent: true }),
      );
      fragment.position.copy(position).add(new THREE.Vector3(0, 0.8, 0));
      this.scene.add(fragment);
      this.timedObjects.push({
        object: fragment,
        life: 0.7,
        maxLife: 0.7,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 5, Math.random() * 3, (Math.random() - 0.5) * 5),
      });
    }
  }

  private createTracer(start: THREE.Vector3, end: THREE.Vector3, color: number, life: number) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1 });
    const line = new THREE.Line(geometry, material);
    this.scene.add(line);
    this.timedObjects.push({ object: line, life, maxLife: life });
  }

  private enemyShoot(enemy: EnemyEntity) {
    const start = enemy.group.position.clone().add(new THREE.Vector3(0, 1.25, 0));
    const end = this.player.position.clone().add(new THREE.Vector3(0, 0.9, 0));
    this.createTracer(start, end, enemy.kind === "hunter" ? 0xff465d : 0xffb23e, 0.16);
    this.health = Math.max(0, this.health - enemy.attackDamage);
    this.message = enemy.kind === "hunter" ? "Hunter fire detected" : "Sentry impact";
    this.messageTime = 0.7;
    this.cameraShake = 0.32;
  }

  private startReload() {
    if (this.reloadRemaining > 0 || this.ammo === this.weapon.magazine) return;
    this.reloadRemaining = this.weapon.reloadTime;
    this.message = "Reloading";
    this.messageTime = this.weapon.reloadTime;
  }

  private findNearestEnemy() {
    let nearest: EnemyEntity | null = null;
    let distance = Number.POSITIVE_INFINITY;
    this.enemies.forEach((enemy) => {
      const nextDistance = enemy.group.position.distanceTo(this.player.position);
      if (nextDistance < distance) {
        nearest = enemy;
        distance = nextDistance;
      }
    });
    return nearest;
  }

  private isBlocked(x: number, z: number) {
    return this.obstacles.some((obstacle) => x > obstacle.minX && x < obstacle.maxX && z > obstacle.minZ && z < obstacle.maxZ)
      || this.mapObstacles.some((obstacle) => pointInMapObstacle(x, z, obstacle));
  }

  private findOpenPosition(x: number, z: number) {
    if (!this.isBlocked(x, z)) return new THREE.Vector3(x, 0, z);
    for (let radius = 2; radius <= 40; radius += 2) {
      const samples = 32;
      for (let sample = 0; sample < samples; sample += 1) {
        const angle = (sample / samples) * Math.PI * 2;
        const candidateX = x + Math.cos(angle) * radius;
        const candidateZ = z + Math.sin(angle) * radius;
        if (Math.abs(candidateX) <= MISSION_RADIUS_METERS && Math.abs(candidateZ) <= MISSION_RADIUS_METERS && !this.isBlocked(candidateX, candidateZ)) {
          return new THREE.Vector3(candidateX, 0, candidateZ);
        }
      }
    }
    return new THREE.Vector3(0, 0, 10 * AUTHORED_LAYOUT_SCALE);
  }

  private lineBlocked(start: THREE.Vector3, end: THREE.Vector3) {
    const steps = Math.ceil(start.distanceTo(end) / 3);
    for (let step = 1; step < steps; step += 1) {
      const ratio = step / steps;
      const x = THREE.MathUtils.lerp(start.x, end.x, ratio);
      const z = THREE.MathUtils.lerp(start.z, end.z, ratio);
      if (this.isBlocked(x, z)) return true;
    }
    return false;
  }

  private emitHud() {
    this.onHud({
      health: Math.ceil(this.health),
      ammo: this.ammo,
      magazine: this.weapon.magazine,
      kills: this.kills,
      requiredKills: REQUIRED_KILLS,
      salvage: this.salvage,
      timeLeft: Math.max(0, Math.ceil(this.timeLeft)),
      extractionUnlocked: true,
      extractionProgress: this.extractionProgress,
      reloading: this.reloadRemaining > 0,
      message: this.messageTime > 0 ? this.message : "",
      tacticalMap: {
        player: { x: this.player.position.x, z: this.player.position.z, heading: this.player.rotation.y },
        enemies: this.enemies.map((enemy) => ({
          id: enemy.id,
          x: enemy.group.position.x,
          z: enemy.group.position.z,
          kind: enemy.kind,
        })),
        pickups: this.pickups.map((pickup) => ({ x: pickup.mesh.position.x, z: pickup.mesh.position.z })),
        extractions: this.extractions.map((extraction) => ({
          x: extraction.group.position.x,
          z: extraction.group.position.z,
        })),
      },
    });
  }

  private finish(success: boolean, reason: MissionResult["reason"]) {
    if (this.ended) return;
    this.ended = true;
    this.emitHud();
    this.renderer.render(this.scene, this.camera);
    window.setTimeout(() => this.onEnd({ success, kills: this.kills, salvage: this.salvage, reason }), 420);
  }
}
