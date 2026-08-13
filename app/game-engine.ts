import * as THREE from "three";
import { createRealMap, pointInMapObstacle, type MapPolygonObstacle } from "./real-map";
import { MISSION_MAPS, type MissionMapId, type RealMapData } from "./map-content";
import gameScale from "./game-scale.json";

export type WeaponId = "arc" | "pulse";
export type SkinId = "carbon" | "salvage" | "signal";

export type MissionHud = {
  health: number;
  ammo: number;
  magazine: number;
  kills: number;
  requiredKills: number;
  salvage: number;
  timeLeft: number;
  extractionUnlocked: boolean;
  extractionProgress: number;
  reloading: boolean;
  message: string;
  tacticalMap: TacticalMapState;
};

export type TacticalMapState = {
  player: { x: number; z: number; heading: number };
  enemies: Array<{ id: number; x: number; z: number; kind: EnemyKind }>;
  pickups: Array<{ x: number; z: number }>;
  extraction: { x: number; z: number; unlocked: boolean };
};

export type MissionResult = {
  success: boolean;
  kills: number;
  salvage: number;
  reason: "extracted" | "eliminated" | "timeout";
};

export type TouchInput = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  fire: boolean;
  reload: boolean;
  extract: boolean;
};

export type EnemyKind = "hunter" | "sentry";

export type EnemyObservation = {
  kind: EnemyKind;
  toPlayerX: number;
  toPlayerZ: number;
  distance: number;
  attackRange: number;
  lineOfSight: boolean;
  phase: number;
  elapsedMs: number;
};

export type EnemyIntent = {
  moveX: number;
  moveZ: number;
  attack: boolean;
};

export const PLAYER_HEIGHT_METERS = gameScale.playerHeightMeters;
const PLAYER_RADIUS_METERS = gameScale.playerRadiusMeters;

export interface EnemyController {
  decide(observation: EnemyObservation): EnemyIntent;
}

export class RuleBasedEnemyController implements EnemyController {
  decide(observation: EnemyObservation): EnemyIntent {
    const shouldAttack = observation.lineOfSight && observation.distance <= observation.attackRange;
    if (shouldAttack) return { moveX: 0, moveZ: 0, attack: true };

    const inverseDistance = observation.distance > 0 ? 1 / observation.distance : 0;
    let moveX = observation.toPlayerX * inverseDistance;
    let moveZ = observation.toPlayerZ * inverseDistance;
    if (observation.kind === "sentry") {
      const strafe = Math.sin(observation.elapsedMs * 0.0008 + observation.phase) * 0.45;
      const originalX = moveX;
      moveX = moveX * Math.cos(strafe) - moveZ * Math.sin(strafe);
      moveZ = originalX * Math.sin(strafe) + moveZ * Math.cos(strafe);
    }
    return { moveX, moveZ, attack: false };
  }
}

type EnemyEntity = {
  id: number;
  kind: EnemyKind;
  group: THREE.Group;
  body: THREE.Mesh;
  sensor: THREE.Mesh;
  health: number;
  speed: number;
  attackRange: number;
  attackDamage: number;
  attackDelay: number;
  cooldown: number;
  flash: number;
  patrolAngle: number;
};

type PickupEntity = {
  mesh: THREE.Mesh;
  value: number;
  baseY: number;
  phase: number;
};

type TimedObject = {
  object: THREE.Object3D;
  life: number;
  maxLife: number;
  velocity?: THREE.Vector3;
};

type BoxObstacle = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

const WEAPONS = {
  arc: { magazine: 12, damage: 42, shotDelay: 0.3, reloadTime: 1.25, color: 0x63e8ff },
  pulse: { magazine: 24, damage: 24, shotDelay: 0.13, reloadTime: 1.55, color: 0xb8ff6a },
} as const;

const SKINS = {
  carbon: { body: 0x18262b, accent: 0x5ce7ff },
  salvage: { body: 0xdce4df, accent: 0xff9d3d },
  signal: { body: 0x8d1e2c, accent: 0xffc4c9 },
} as const;

const REQUIRED_KILLS = 8;
const MISSION_SECONDS = 180;
const AUTHORED_LAYOUT_SCALE = gameScale.authoredLayoutScale;
const MISSION_RADIUS_METERS = 185;

export class GameEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(52, 1, 0.1, 600);
  private readonly clock = new THREE.Clock();
  private readonly player = new THREE.Group();
  private readonly playerBody: THREE.Mesh;
  private readonly playerAccent: THREE.Mesh;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2(0.2, 0);
  private readonly aimPoint = new THREE.Vector3(0, 0, -8);
  private readonly enemies: EnemyEntity[] = [];
  private readonly pickups: PickupEntity[] = [];
  private readonly timedObjects: TimedObject[] = [];
  private readonly obstacles: BoxObstacle[] = [];
  private readonly mapObstacles: MapPolygonObstacle[] = [];
  private readonly keys = new Set<string>();
  private readonly touch: TouchInput;
  private readonly mapData: RealMapData;
  private readonly weaponId: WeaponId;
  private readonly weapon: (typeof WEAPONS)[WeaponId];
  private readonly onHud: (hud: MissionHud) => void;
  private readonly onEnd: (result: MissionResult) => void;
  private readonly extraction = new THREE.Group();
  private readonly enemyController: EnemyController = new RuleBasedEnemyController();
  private readonly extractionRing: THREE.Mesh;
  private readonly extractionBeam: THREE.Mesh;

  private animationFrame = 0;
  private ended = false;
  private pointerDown = false;
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
    this.camera.position.set(0, 23, 125);
    this.camera.lookAt(0, 0, 98);

    const skin = SKINS[skinId];
    this.playerBody = new THREE.Mesh(
      new THREE.CapsuleGeometry(
        PLAYER_RADIUS_METERS,
        PLAYER_HEIGHT_METERS - PLAYER_RADIUS_METERS * 2,
        5,
        10,
      ),
      new THREE.MeshStandardMaterial({ color: skin.body, roughness: 0.52, metalness: 0.28 }),
    );
    this.playerBody.position.y = 0.9;
    this.playerBody.castShadow = true;
    this.player.add(this.playerBody);

    this.playerAccent = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.18, 0.62),
      new THREE.MeshStandardMaterial({
        color: skin.accent,
        emissive: skin.accent,
        emissiveIntensity: 1.6,
      }),
    );
    this.playerAccent.position.set(0, 1.15, -0.5);
    this.player.add(this.playerAccent);
    this.player.position.set(0, 0, 10 * AUTHORED_LAYOUT_SCALE);
    this.scene.add(this.player);

    this.extractionRing = new THREE.Mesh(
      new THREE.RingGeometry(2.15, 2.45, 64),
      new THREE.MeshBasicMaterial({ color: 0x62ffb6, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    );
    this.extractionRing.rotation.x = -Math.PI / 2;
    this.extractionRing.position.y = 0.055;
    this.extractionBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.9, 1.9, 7, 32, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x62ffb6, transparent: true, opacity: 0.075, side: THREE.DoubleSide }),
    );
    this.extractionBeam.position.y = 3.5;
    this.extraction.add(this.extractionRing, this.extractionBeam);
    this.extraction.position.set(-12 * AUTHORED_LAYOUT_SCALE, 0, 9 * AUTHORED_LAYOUT_SCALE);
    this.extraction.visible = false;
    this.scene.add(this.extraction);

    this.buildEnvironment();
    this.spawnEnemies();
    this.bindEvents();
    this.resize();
    this.emitHud();
    this.animate();
  }

  destroy() {
    cancelAnimationFrame(this.animationFrame);
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("contextmenu", this.onContextMenu);
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
    const hemi = new THREE.HemisphereLight(0xf1fbff, 0x667064, 2.4);
    this.scene.add(hemi);

    const urbanFill = new THREE.AmbientLight(0xb9d0d6, 1.15);
    this.scene.add(urbanFill);

    const key = new THREE.DirectionalLight(0xfff0d2, 3.2);
    key.position.set(-80, 180, 120);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -220;
    key.shadow.camera.right = 220;
    key.shadow.camera.top = 220;
    key.shadow.camera.bottom = -220;
    key.shadow.camera.far = 500;
    this.scene.add(key);

    const redGlow = new THREE.PointLight(0xff3b4e, 20, 28, 2);
    redGlow.position.set(10 * AUTHORED_LAYOUT_SCALE, 7, -16 * AUTHORED_LAYOUT_SCALE);
    this.scene.add(redGlow);

    const realMap = createRealMap(this.mapData);
    this.scene.add(realMap.group);
    this.mapObstacles.push(...realMap.obstacles);
    this.player.position.copy(this.findOpenPosition(this.player.position.x, this.player.position.z));
    this.extraction.position.copy(this.findOpenPosition(this.extraction.position.x, this.extraction.position.z));

    const coverData = [
      [-7, -5, 4, 1.5],
      [7, 5, 4, 1.5],
      [-10, 8, 2, 3.5],
      [10, -8, 2, 3.5],
      [4, -13, 4, 1.5],
      [-4, 13, 4, 1.5],
    ];
    coverData.forEach(([x, z, width, depth], index) => {
      const cover = new THREE.Mesh(
        new THREE.BoxGeometry(width, 1.4, depth),
        new THREE.MeshStandardMaterial({ color: index % 2 ? 0x364347 : 0x2d383c, roughness: 0.74 }),
      );
      const worldX = x * AUTHORED_LAYOUT_SCALE;
      const worldZ = z * AUTHORED_LAYOUT_SCALE;
      cover.position.set(worldX, 0.7, worldZ);
      cover.castShadow = true;
      cover.receiveShadow = true;
      this.scene.add(cover);
      this.obstacles.push({
        minX: worldX - width / 2 - 0.5,
        maxX: worldX + width / 2 + 0.5,
        minZ: worldZ - depth / 2 - 0.5,
        maxZ: worldZ + depth / 2 + 0.5,
      });
    });

    const relay = new THREE.Group();
    const relayCore = new THREE.Mesh(
      new THREE.SphereGeometry(2.5, 10, 6),
      new THREE.MeshStandardMaterial({ color: 0x101519, metalness: 0.8, roughness: 0.25 }),
    );
    relayCore.scale.set(2.1, 0.45, 1);
    relay.add(relayCore);
    const relayHalo = new THREE.Mesh(
      new THREE.TorusGeometry(3.7, 0.12, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0xff4059, transparent: true, opacity: 0.7 }),
    );
    relayHalo.rotation.x = Math.PI / 2.4;
    relay.add(relayHalo);
    relay.position.set(10 * AUTHORED_LAYOUT_SCALE, 13, -18 * AUTHORED_LAYOUT_SCALE);
    relay.rotation.y = -0.35;
    this.scene.add(relay);
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
      this.createEnemy(position.x, position.z, kind, index * 0.61);
    });
  }

  private createEnemy(x: number, z: number, kind: EnemyKind, phase: number) {
    const group = new THREE.Group();
    const bodyColor = kind === "hunter" ? 0x252b30 : 0x3b3026;
    const sensorColor = kind === "hunter" ? 0xff3f55 : 0xffb53f;
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(kind === "hunter" ? 0.52 : 0.68, kind === "hunter" ? 0.85 : 0.62, 4, 8),
      new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.38, metalness: 0.65 }),
    );
    body.position.y = 1.05;
    body.castShadow = true;
    group.add(body);

    const shoulder = new THREE.Mesh(
      new THREE.BoxGeometry(kind === "hunter" ? 1.4 : 1.7, 0.28, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x4b5559, metalness: 0.72, roughness: 0.32 }),
    );
    shoulder.position.y = 1.38;
    shoulder.castShadow = true;
    group.add(shoulder);

    const sensor = new THREE.Mesh(
      new THREE.SphereGeometry(kind === "hunter" ? 0.14 : 0.2, 10, 6),
      new THREE.MeshStandardMaterial({
        color: sensorColor,
        emissive: sensorColor,
        emissiveIntensity: 2.4,
      }),
    );
    sensor.position.set(0, 1.32, -0.54);
    group.add(sensor);
    group.position.set(x, 0, z);
    this.scene.add(group);

    this.enemies.push({
      id: ++this.enemyId,
      kind,
      group,
      body,
      sensor,
      health: kind === "hunter" ? 80 : 110,
      speed: kind === "hunter" ? 2.1 : 1.25,
      attackRange: kind === "hunter" ? 7.2 : 10.5,
      attackDamage: kind === "hunter" ? 7 : 11,
      attackDelay: kind === "hunter" ? 1.05 : 1.65,
      cooldown: 0.7 + phase * 0.15,
      flash: 0,
      patrolAngle: phase,
    });
  }

  private bindEvents() {
    window.addEventListener("resize", this.resize);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("contextmenu", this.onContextMenu);
  }

  private resize = () => {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  };

  private onKeyDown = (event: KeyboardEvent) => {
    this.keys.add(event.code);
    if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
      event.preventDefault();
    }
    if (event.code === "KeyR") this.startReload();
  };

  private onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
  };

  private onPointerMove = (event: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  };

  private onPointerDown = (event: PointerEvent) => {
    if (event.button === 0) this.pointerDown = true;
  };

  private onPointerUp = () => {
    this.pointerDown = false;
  };

  private onContextMenu = (event: MouseEvent) => event.preventDefault();

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

    if ((this.pointerDown || this.keys.has("Space") || this.touch.fire) && this.shotCooldown <= 0) {
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
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const ray = this.raycaster.ray;
    const distance = -ray.origin.y / ray.direction.y;
    if (distance > 0) this.aimPoint.copy(ray.origin).addScaledVector(ray.direction, distance);
  }

  private updatePlayer(dt: number) {
    const move = new THREE.Vector3();
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp") || this.touch.up) move.z -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown") || this.touch.down) move.z += 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft") || this.touch.left) move.x -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight") || this.touch.right) move.x += 1;
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
        const previous = enemy.group.position.clone();
        enemy.group.position.addScaledVector(direction, enemy.speed * dt);
        if (this.isBlocked(enemy.group.position.x, enemy.group.position.z)) enemy.group.position.copy(previous);
      } else if (enemy.cooldown <= 0) {
        this.enemyShoot(enemy);
        enemy.cooldown = enemy.attackDelay;
      }

      enemy.sensor.scale.setScalar(1 + Math.sin(performance.now() * 0.006 + enemy.id) * 0.16);
    });
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
    const unlocked = this.kills >= REQUIRED_KILLS;
    this.extraction.visible = unlocked;
    if (!unlocked) return;

    this.extractionRing.rotation.z += dt * 0.4;
    const beamMaterial = this.extractionBeam.material as THREE.MeshBasicMaterial;
    beamMaterial.opacity = 0.055 + Math.sin(performance.now() * 0.003) * 0.018;

    const distance = this.player.position.distanceTo(this.extraction.position);
    const holding = this.keys.has("KeyE") || this.touch.extract;
    if (distance < 2.35 && holding) {
      this.extractionProgress = Math.min(1, this.extractionProgress + dt / 2.1);
      this.message = "Transfer lock acquired";
      this.messageTime = 0.2;
      if (this.extractionProgress >= 1) this.finish(true, "extracted");
    } else {
      this.extractionProgress = Math.max(0, this.extractionProgress - dt * 0.75);
      if (distance < 2.35 && this.messageTime <= 0) {
        this.message = "Hold E to extract";
        this.messageTime = 0.25;
      }
    }
  }

  private updateCamera(dt: number) {
    const target = new THREE.Vector3(this.player.position.x, 23, this.player.position.z + 25);
    this.camera.position.lerp(target, 1 - Math.exp(-dt * 7));
    if (this.cameraShake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.cameraShake;
      this.camera.position.y += (Math.random() - 0.5) * this.cameraShake * 0.5;
    }
    this.camera.lookAt(this.player.position.x, 0, this.player.position.z - 1.8);
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
      this.message = "Objective complete — extraction online";
      this.messageTime = 3;
    } else {
      this.message = `${REQUIRED_KILLS - this.kills} machines remain`;
      this.messageTime = 1.1;
    }
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
      extractionUnlocked: this.kills >= REQUIRED_KILLS,
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
        extraction: {
          x: this.extraction.position.x,
          z: this.extraction.position.z,
          unlocked: this.kills >= REQUIRED_KILLS,
        },
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
