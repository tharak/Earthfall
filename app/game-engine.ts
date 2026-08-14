import * as THREE from "three";
import { pointInMapObstacle } from "./real-map";
import { MISSION_MAPS } from "./map-content";
import {
  AUTHORED_LAYOUT_SCALE,
  ENEMIES,
  ENEMY_RESPAWN_DELAY_MS,
  ENEMY_STEERING_ANGLES,
  EXTRACTION_ACTIVE_BEAM_OPACITY,
  EXTRACTION_ACTIVE_BEAM_PULSE_OPACITY,
  EXTRACTION_ACTIVE_PULSE_SCALE,
  EXTRACTION_ACTIVE_PULSE_RATE,
  EXTRACTION_ACTIVE_RING_SPEED,
  EXTRACTION_BEAM_PROGRESS_OPACITY,
  EXTRACTION_POSITIONS,
  EXTRACTION_DURATION_SECONDS,
  EXTRACTION_IDLE_BEAM_OPACITY,
  EXTRACTION_IDLE_BEAM_PULSE_OPACITY,
  EXTRACTION_IDLE_PULSE_RATE,
  EXTRACTION_IDLE_RING_SPEED,
  EXTRACTION_PROGRESS_DECAY_PER_SECOND,
  EXTRACTION_PROGRESS_SCALE,
  EXTRACTION_RADIUS_METERS,
  HUD_UPDATE_INTERVAL_SECONDS,
  INITIAL_ENEMY_SPAWNS,
  INITIAL_ENEMY_PHASE_STEP,
  LINE_OF_SIGHT_SAMPLE_SPACING_METERS,
  MACHINE_PARTS,
  MAX_FRAME_DELTA_SECONDS,
  MISSION_RADIUS_METERS,
  MISSION_SECONDS,
  OPEN_POSITION_SEARCH_LIMIT_METERS,
  OPEN_POSITION_SEARCH_SAMPLES,
  OPEN_POSITION_SEARCH_START_METERS,
  OPEN_POSITION_SEARCH_STEP_METERS,
  PICKUP_COLLECT_RADIUS_METERS,
  PLAYER_START_POSITION,
  REPLACEMENT_ANGLE_STEP_RADIANS,
  REPLACEMENT_FALLBACK_OFFSET_METERS,
  REPLACEMENT_MIN_ENEMY_DISTANCE_METERS,
  REPLACEMENT_SPAWN_RADII,
  REPLACEMENT_SPAWN_SAMPLES,
  REQUIRED_KILLS,
  WEAPON_RANGE_METERS,
  WEAPONS,
  getMachineStats,
} from "./game-config";
import { RuleBasedEnemyController } from "./enemy-controller";
import {
  createBurstFragments,
  createCombatHit,
  createEnemy,
  createExtractionPoint,
  createPartPickup,
  createPlayer,
  createSalvagePickup,
  createTracer,
  createWorldLabel,
} from "./entity-factories";
import { createMissionEnvironment } from "./mission-environment";
import { GameInput } from "./game-input";
import { OrbitCameraController } from "./orbit-camera";
import type {
  BoxObstacle,
  EnemyController,
  EnemyEntity,
  EnemyKind,
  ExtractionEntity,
  MissionEndListener,
  MissionHudListener,
  MissionMapId,
  MissionResult,
  MachineLoadout,
  MachineStats,
  MapPolygonObstacle,
  PickupEntity,
  PartId,
  RealMapData,
  SkinId,
  TimedObject,
  TouchInput,
  WeaponId,
} from "./game-types";

function disposeMaterial(material: THREE.Material): void {
  const texture = (material as THREE.Material & { map?: THREE.Texture | null }).map;
  texture?.dispose();
  material.dispose();
}

export class GameEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(52, 1, 0.1, 600);
  private readonly clock = new THREE.Clock();
  private readonly player: THREE.Group;
  private readonly playerBody: THREE.Mesh;
  private readonly playerAccent: THREE.Mesh;
  private readonly raycaster = new THREE.Raycaster();
  private readonly aimPoint = new THREE.Vector3();
  private readonly cameraController: OrbitCameraController;
  private readonly input: GameInput;
  private readonly enemies: EnemyEntity[] = [];
  private readonly pickups: PickupEntity[] = [];
  private readonly timedObjects: TimedObject[] = [];
  private readonly obstacles: BoxObstacle[] = [];
  private readonly mapObstacles: MapPolygonObstacle[] = [];
  private readonly touch: TouchInput;
  private readonly mapData: RealMapData;
  private readonly weaponId: WeaponId;
  private readonly weapon: (typeof WEAPONS)[WeaponId];
  private readonly stats: MachineStats;
  private readonly onHud: MissionHudListener;
  private readonly onEnd: MissionEndListener;
  private readonly extractions: ExtractionEntity[] = [];
  private readonly enemyController: EnemyController = new RuleBasedEnemyController();
  private readonly respawnTimers: number[] = [];

  private animationFrame = 0;
  private ended = false;
  private health = 0;
  private ammo = 0;
  private kills = 0;
  private salvage = 0;
  private readonly recoveredParts: PartId[] = [];
  private timeLeft = MISSION_SECONDS;
  private shotCooldown = 0;
  private reloadRemaining = 0;
  private extractionProgress = 0;
  private hudCooldown = 0;
  private cameraShake = 0;
  private enemyId = 0;
  private readonly partDropCounts: Record<EnemyKind, number> = { hunter: 0, sentry: 0 };

  constructor(
    canvas: HTMLCanvasElement,
    mapId: MissionMapId,
    loadout: MachineLoadout,
    skinId: SkinId,
    touch: TouchInput,
    onHud: MissionHudListener,
    onEnd: MissionEndListener,
  ) {
    this.canvas = canvas;
    this.mapData = MISSION_MAPS[mapId];
    const arms = MACHINE_PARTS[loadout.arms];
    this.weaponId = arms.weaponId ?? "arc";
    this.weapon = WEAPONS[this.weaponId];
    this.stats = getMachineStats(loadout);
    this.health = this.stats.maxHealth;
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
    this.input = new GameInput(this.canvas, this.cameraController, this.touch, () => this.startReload());
    window.addEventListener("resize", this.resize);

    const player = createPlayer(loadout, skinId);
    this.player = player.group;
    this.playerBody = player.body;
    this.playerAccent = player.accent;
    this.player.position.set(PLAYER_START_POSITION[0], 0, PLAYER_START_POSITION[1]);
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

  destroy(): void {
    cancelAnimationFrame(this.animationFrame);
    this.respawnTimers.forEach((timer) => window.clearTimeout(timer));
    window.removeEventListener("resize", this.resize);
    this.input.destroy();
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach(disposeMaterial);
      else if (material) disposeMaterial(material);
    });
    this.renderer.dispose();
  }

  private buildEnvironment(): void {
    const environment = createMissionEnvironment(this.scene, this.mapData);
    this.mapObstacles.push(...environment.mapObstacles);
    this.obstacles.push(...environment.obstacles);
    this.player.position.copy(this.findOpenPosition(this.player.position.x, this.player.position.z));
    this.extractions.forEach((extraction) => {
      extraction.group.position.copy(this.findOpenPosition(extraction.group.position.x, extraction.group.position.z));
    });
  }
  private spawnEnemies(): void {
    INITIAL_ENEMY_SPAWNS.forEach(([x, z, kind], index) => {
      const position = this.findOpenPosition(x * AUTHORED_LAYOUT_SCALE, z * AUTHORED_LAYOUT_SCALE);
      this.addEnemy(position.x, position.z, kind, index * INITIAL_ENEMY_PHASE_STEP);
    });
  }

  private addEnemy(x: number, z: number, kind: EnemyKind, phase: number): void {
    const enemy = createEnemy(++this.enemyId, x, z, kind, phase);
    this.scene.add(enemy.group);
    this.enemies.push(enemy);
  }

  private spawnReplacementEnemy(kind: EnemyKind): void {
    const seedAngle = this.enemyId * REPLACEMENT_ANGLE_STEP_RADIANS;
    for (const radius of REPLACEMENT_SPAWN_RADII) {
      for (let offset = 0; offset < REPLACEMENT_SPAWN_SAMPLES; offset += 1) {
        const angle = seedAngle + (offset / REPLACEMENT_SPAWN_SAMPLES) * Math.PI * 2;
        const x = this.player.position.x + Math.cos(angle) * radius;
        const z = this.player.position.z + Math.sin(angle) * radius;
        if (Math.abs(x) > MISSION_RADIUS_METERS || Math.abs(z) > MISSION_RADIUS_METERS || this.isBlocked(x, z)) continue;
        if (this.enemies.some((enemy) => Math.hypot(enemy.group.position.x - x, enemy.group.position.z - z) < REPLACEMENT_MIN_ENEMY_DISTANCE_METERS)) continue;
        this.addEnemy(x, z, kind, seedAngle);
        return;
      }
    }
    const fallback = this.findOpenPosition(
      THREE.MathUtils.clamp(this.player.position.x + REPLACEMENT_FALLBACK_OFFSET_METERS, -MISSION_RADIUS_METERS, MISSION_RADIUS_METERS),
      THREE.MathUtils.clamp(this.player.position.z + REPLACEMENT_FALLBACK_OFFSET_METERS, -MISSION_RADIUS_METERS, MISSION_RADIUS_METERS),
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
    const dt = Math.min(this.clock.getDelta(), MAX_FRAME_DELTA_SECONDS);
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.animationFrame = requestAnimationFrame(this.animate);
  };

  private update(dt: number): void {
    const wasReloading = this.updateTimers(dt);
    this.completeReloadIfReady(wasReloading);

    if (this.touch.reload) this.startReload();
    this.updateAim();
    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updatePickups(dt);
    this.updateEffects(dt);
    this.updateExtraction(dt);
    this.updateCamera(dt);
    this.processFiring();
    this.updateHud(dt);
    this.evaluateMissionEnd();
  }

  private updateTimers(dt: number): boolean {
    this.timeLeft -= dt;
    this.shotCooldown = Math.max(0, this.shotCooldown - dt);
    const wasReloading = this.reloadRemaining > 0;
    this.reloadRemaining = Math.max(0, this.reloadRemaining - dt);
    this.cameraShake = Math.max(0, this.cameraShake - dt * 3.8);
    return wasReloading;
  }

  private completeReloadIfReady(wasReloading: boolean): void {
    if (wasReloading && this.reloadRemaining === 0) {
      this.ammo = this.weapon.magazine;
    }
  }

  private processFiring(): void {
    if ((this.input.isFiring() || this.touch.fire) && this.shotCooldown <= 0) {
      this.shoot();
    }
  }

  private updateHud(dt: number): void {
    this.hudCooldown -= dt;
    if (this.hudCooldown <= 0) {
      this.emitHud();
      this.hudCooldown = HUD_UPDATE_INTERVAL_SECONDS;
    }
  }

  private evaluateMissionEnd(): void {
    if (this.health <= 0) this.finish(false, "eliminated");
    else if (this.timeLeft <= 0) this.finish(false, "timeout");
  }

  private updateAim(): void {
    if (this.touch.aimWithStick) {
      if (this.touch.aimX !== 0 || this.touch.aimZ !== 0) {
        const aimDirection = this.cameraController.alignDirectionToView(
          new THREE.Vector3(this.touch.aimX, 0, this.touch.aimZ),
        );
        this.player.rotation.y = Math.atan2(-aimDirection.x, -aimDirection.z);
      }
      return;
    }

    this.raycaster.setFromCamera(this.input.pointer, this.camera);
    const ray = this.raycaster.ray;
    const distance = -ray.origin.y / ray.direction.y;
    if (distance > 0) this.aimPoint.copy(ray.origin).addScaledVector(ray.direction, distance);
    const dx = this.aimPoint.x - this.player.position.x;
    const dz = this.aimPoint.z - this.player.position.z;
    if (Math.abs(dx) + Math.abs(dz) > 0.01) this.player.rotation.y = Math.atan2(-dx, -dz);
  }

  private updatePlayer(dt: number): void {
    const move = new THREE.Vector3();
    if (this.input.isPressed("KeyW") || this.input.isPressed("ArrowUp") || this.touch.up) move.z -= 1;
    if (this.input.isPressed("KeyS") || this.input.isPressed("ArrowDown") || this.touch.down) move.z += 1;
    if (this.input.isPressed("KeyA") || this.input.isPressed("ArrowLeft") || this.touch.left) move.x -= 1;
    if (this.input.isPressed("KeyD") || this.input.isPressed("ArrowRight") || this.touch.right) move.x += 1;
    if (move.lengthSq() > 0) {
      move.normalize();
      this.cameraController.alignDirectionToView(move);
      const previous = this.player.position.clone();
      this.player.position.addScaledVector(move, this.stats.moveSpeed * dt);
      this.player.position.x = THREE.MathUtils.clamp(this.player.position.x, -MISSION_RADIUS_METERS, MISSION_RADIUS_METERS);
      this.player.position.z = THREE.MathUtils.clamp(this.player.position.z, -MISSION_RADIUS_METERS, MISSION_RADIUS_METERS);
      if (this.isBlocked(this.player.position.x, this.player.position.z)) this.player.position.copy(previous);
    }
  }

  private updateEnemies(dt: number): void {
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

  private moveEnemyWithAvoidance(enemy: EnemyEntity, desiredDirection: THREE.Vector3, distance: number): void {
    for (const angle of ENEMY_STEERING_ANGLES) {
      const direction = desiredDirection.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      const nextX = enemy.group.position.x + direction.x * distance;
      const nextZ = enemy.group.position.z + direction.z * distance;
      if (this.isBlocked(nextX, nextZ)) continue;
      enemy.group.position.x = nextX;
      enemy.group.position.z = nextZ;
      return;
    }
  }

  private updatePickups(dt: number): void {
    for (let index = this.pickups.length - 1; index >= 0; index -= 1) {
      const pickup = this.pickups[index];
      pickup.phase += dt * 2.5;
      pickup.mesh.rotation.y += dt * 1.8;
      pickup.mesh.position.y = pickup.baseY + Math.sin(pickup.phase) * 0.2;
      const distance = pickup.mesh.position.distanceTo(this.player.position);
      if (distance < PICKUP_COLLECT_RADIUS_METERS) {
        if (pickup.payload.kind === "salvage") {
          this.salvage += pickup.payload.value;
          this.showWorldLabel(pickup.mesh.position, `+${pickup.payload.value} SALVAGE`, 0x62ffb6);
        } else {
          this.recoveredParts.push(pickup.payload.partId);
          const part = MACHINE_PARTS[pickup.payload.partId];
          const color = part.source === "hunter" ? ENEMIES.hunter.effectColor : ENEMIES.sentry.effectColor;
          this.showWorldLabel(pickup.mesh.position, `+${part.name}`, color);
        }
        this.scene.remove(pickup.mesh);
        pickup.mesh.geometry.dispose();
        (pickup.mesh.material as THREE.Material).dispose();
        this.pickups.splice(index, 1);
      }
    }
  }

  private updateEffects(dt: number): void {
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
          if (Array.isArray(mesh.material)) mesh.material.forEach(disposeMaterial);
          else if (mesh.material) disposeMaterial(mesh.material);
        });
        this.timedObjects.splice(index, 1);
      }
    }
  }

  private updateExtraction(dt: number): void {
    let nearestDistance = Number.POSITIVE_INFINITY;
    const holding = this.input.isPressed("KeyE") || this.touch.extract;
    this.extractions.forEach((extraction) => {
      const distance = this.player.position.distanceTo(extraction.group.position);
      const active = holding && distance < EXTRACTION_RADIUS_METERS;
      const pulse = active ? Math.sin(performance.now() * EXTRACTION_ACTIVE_PULSE_RATE) : 0;
      const progressScale = active ? this.extractionProgress * EXTRACTION_PROGRESS_SCALE : 0;
      extraction.ring.rotation.z += dt * (active ? EXTRACTION_ACTIVE_RING_SPEED : EXTRACTION_IDLE_RING_SPEED);
      extraction.ring.scale.setScalar(1 + progressScale + pulse * (active ? EXTRACTION_ACTIVE_PULSE_SCALE : 0));
      const beamMaterial = extraction.beam.material as THREE.MeshBasicMaterial;
      beamMaterial.opacity = active
        ? EXTRACTION_ACTIVE_BEAM_OPACITY + this.extractionProgress * EXTRACTION_BEAM_PROGRESS_OPACITY + pulse * EXTRACTION_ACTIVE_BEAM_PULSE_OPACITY
        : EXTRACTION_IDLE_BEAM_OPACITY + Math.sin(performance.now() * EXTRACTION_IDLE_PULSE_RATE) * EXTRACTION_IDLE_BEAM_PULSE_OPACITY;
      extraction.beam.scale.set(1 + progressScale, 1, 1 + progressScale);
      nearestDistance = Math.min(nearestDistance, distance);
    });

    if (nearestDistance < EXTRACTION_RADIUS_METERS && holding) {
      this.extractionProgress = Math.min(1, this.extractionProgress + dt / EXTRACTION_DURATION_SECONDS);
      if (this.extractionProgress >= 1) this.finish(true, "extracted");
    } else {
      this.extractionProgress = Math.max(0, this.extractionProgress - dt * EXTRACTION_PROGRESS_DECAY_PER_SECOND);
    }
  }

  private updateCamera(dt: number): void {
    this.cameraController.update(dt, this.player.position, this.cameraShake);
  }

  private shoot(): void {
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
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(this.player.quaternion).setY(0).normalize();
    const maxDistance = WEAPON_RANGE_METERS * this.stats.rangeMultiplier;
    let target: EnemyEntity | null = null;
    let targetDistance = maxDistance;
    this.enemies.forEach((enemy) => {
      const toEnemy = enemy.group.position.clone().sub(this.player.position).setY(0);
      const projection = toEnemy.dot(direction);
      if (projection <= 0 || projection >= targetDistance) return;
      const perpendicular = toEnemy.clone().addScaledVector(direction, -projection).length();
      if (perpendicular < ENEMIES[enemy.kind].hitRadius && !this.lineBlocked(this.player.position, enemy.group.position)) {
        target = enemy;
        targetDistance = projection;
      }
    });

    const end = origin.clone().addScaledVector(direction, target ? targetDistance : maxDistance);
    end.y = target ? 1.05 : 0.55;
    this.createTracer(origin, end, this.weapon.color, 0.12);
    this.cameraShake = this.weaponId === "arc" ? 0.22 : 0.12;

    if (target) this.damageEnemy(target, this.weapon.damage * this.stats.damageMultiplier);
  }

  private damageEnemy(enemy: EnemyEntity, damage: number): void {
    enemy.health -= damage;
    enemy.flash = 0.08;
    const hit = createCombatHit(this.weapon.color);
    hit.position.copy(enemy.group.position).add(new THREE.Vector3(0, 1.1, 0));
    this.scene.add(hit);
    this.timedObjects.push({ object: hit, life: 0.18, maxLife: 0.18 });
    if (enemy.health <= 0) this.destroyEnemy(enemy);
  }

  private destroyEnemy(enemy: EnemyEntity): void {
    const index = this.enemies.indexOf(enemy);
    if (index < 0) return;
    this.enemies.splice(index, 1);
    this.scene.remove(enemy.group);
    this.kills += 1;
    const enemyConfig = ENEMIES[enemy.kind];
    this.createBurst(enemy.group.position, enemyConfig.effectColor);
    const dropIndex = this.partDropCounts[enemy.kind] % enemyConfig.partDrops.length;
    this.partDropCounts[enemy.kind] += 1;
    const partId = enemyConfig.partDrops[dropIndex];
    this.spawnPartPickup(enemy.group.position, partId);
    this.spawnSalvagePickup(enemy.group.position, enemyConfig.salvageValue);
    const timer = window.setTimeout(() => {
      const timerIndex = this.respawnTimers.indexOf(timer);
      if (timerIndex >= 0) this.respawnTimers.splice(timerIndex, 1);
      if (!this.ended) this.spawnReplacementEnemy(enemy.kind);
    }, ENEMY_RESPAWN_DELAY_MS);
    this.respawnTimers.push(timer);
  }

  private spawnSalvagePickup(position: THREE.Vector3, value: number): void {
    const pickup = createSalvagePickup(position, value);
    this.scene.add(pickup.mesh);
    this.pickups.push(pickup);
  }

  private spawnPartPickup(position: THREE.Vector3, partId: PartId): void {
    const pickup = createPartPickup(position, partId);
    this.scene.add(pickup.mesh);
    this.pickups.push(pickup);
  }

  private createBurst(position: THREE.Vector3, color: number): void {
    const fragments = createBurstFragments(position, color);
    fragments.forEach((fragment) => this.scene.add(fragment.object));
    this.timedObjects.push(...fragments);
  }

  private createTracer(start: THREE.Vector3, end: THREE.Vector3, color: number, life: number): void {
    const tracer = createTracer(start, end, color, life);
    this.scene.add(tracer.object);
    this.timedObjects.push(tracer);
  }

  private showWorldLabel(position: THREE.Vector3, text: string, color: number): void {
    const label = createWorldLabel(position, text, color);
    this.scene.add(label.object);
    this.timedObjects.push(label);
  }

  private enemyShoot(enemy: EnemyEntity): void {
    const start = enemy.group.position.clone().add(new THREE.Vector3(0, 1.25, 0));
    const end = this.player.position.clone().add(new THREE.Vector3(0, 0.9, 0));
    this.createTracer(start, end, enemy.kind === "hunter" ? 0xff465d : 0xffb23e, 0.16);
    this.health = Math.max(0, this.health - enemy.attackDamage);
    this.cameraShake = 0.32;
  }

  private startReload(): void {
    if (this.reloadRemaining > 0 || this.ammo === this.weapon.magazine) return;
    this.reloadRemaining = this.weapon.reloadTime * this.stats.reloadMultiplier;
  }

  private isBlocked(x: number, z: number): boolean {
    return this.obstacles.some((obstacle) => x > obstacle.minX && x < obstacle.maxX && z > obstacle.minZ && z < obstacle.maxZ)
      || this.mapObstacles.some((obstacle) => pointInMapObstacle(x, z, obstacle));
  }

  private findOpenPosition(x: number, z: number): THREE.Vector3 {
    if (!this.isBlocked(x, z)) return new THREE.Vector3(x, 0, z);
    for (let radius = OPEN_POSITION_SEARCH_START_METERS; radius <= OPEN_POSITION_SEARCH_LIMIT_METERS; radius += OPEN_POSITION_SEARCH_STEP_METERS) {
      for (let sample = 0; sample < OPEN_POSITION_SEARCH_SAMPLES; sample += 1) {
        const angle = (sample / OPEN_POSITION_SEARCH_SAMPLES) * Math.PI * 2;
        const candidateX = x + Math.cos(angle) * radius;
        const candidateZ = z + Math.sin(angle) * radius;
        if (Math.abs(candidateX) <= MISSION_RADIUS_METERS && Math.abs(candidateZ) <= MISSION_RADIUS_METERS && !this.isBlocked(candidateX, candidateZ)) {
          return new THREE.Vector3(candidateX, 0, candidateZ);
        }
      }
    }
    return new THREE.Vector3(0, 0, 10 * AUTHORED_LAYOUT_SCALE);
  }

  private lineBlocked(start: THREE.Vector3, end: THREE.Vector3): boolean {
    const steps = Math.ceil(start.distanceTo(end) / LINE_OF_SIGHT_SAMPLE_SPACING_METERS);
    for (let step = 1; step < steps; step += 1) {
      const ratio = step / steps;
      const x = THREE.MathUtils.lerp(start.x, end.x, ratio);
      const z = THREE.MathUtils.lerp(start.z, end.z, ratio);
      if (this.isBlocked(x, z)) return true;
    }
    return false;
  }

  private emitHud(): void {
    this.onHud({
      health: Math.ceil(this.health),
      maxHealth: this.stats.maxHealth,
      ammo: this.ammo,
      magazine: this.weapon.magazine,
      kills: this.kills,
      requiredKills: REQUIRED_KILLS,
      salvage: this.salvage,
      parts: [...this.recoveredParts],
      timeLeft: Math.max(0, Math.ceil(this.timeLeft)),
      extractionUnlocked: true,
      extractionProgress: this.extractionProgress,
      reloading: this.reloadRemaining > 0,
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

  private finish(success: boolean, reason: MissionResult["reason"]): void {
    if (this.ended) return;
    this.ended = true;
    this.emitHud();
    this.renderer.render(this.scene, this.camera);
    window.setTimeout(() => this.onEnd({ success, kills: this.kills, salvage: this.salvage, parts: [...this.recoveredParts], reason }), 420);
  }
}
