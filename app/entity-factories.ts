import * as THREE from "three";
import {
  ENEMIES,
  ENEMY_INITIAL_COOLDOWN_SECONDS,
  ENEMY_PHASE_COOLDOWN_SECONDS,
  MACHINE_PARTS,
  PLAYER_HEIGHT_METERS,
  SKINS,
  WORLD_LABEL_HEIGHT_METERS,
  WORLD_LABEL_LIFETIME_SECONDS,
  WORLD_LABEL_RISE_SPEED,
} from "./game-config";
import type {
  EnemyEntity,
  EnemyKind,
  ExtractionEntity,
  MachineLoadout,
  PickupEntity,
  PartId,
  PlayerEntity,
  SkinId,
  TimedObject,
} from "./game-types";

type PlayerMaterials = {
  armor: THREE.MeshStandardMaterial;
  frame: THREE.MeshStandardMaterial;
  issued: THREE.MeshStandardMaterial;
  hunter: THREE.MeshStandardMaterial;
  sentry: THREE.MeshStandardMaterial;
};

function createPlayerMaterials(skinId: SkinId): PlayerMaterials {
  const skin = SKINS[skinId];
  return {
    armor: new THREE.MeshStandardMaterial({ color: skin.body, roughness: 0.4, metalness: 0.68 }),
    frame: new THREE.MeshStandardMaterial({ color: 0x10191d, roughness: 0.5, metalness: 0.75 }),
    issued: new THREE.MeshStandardMaterial({ color: skin.accent, emissive: skin.accent, emissiveIntensity: 1.15 }),
    hunter: new THREE.MeshStandardMaterial({ color: 0xff465d, emissive: 0x7b101f, emissiveIntensity: 1.25 }),
    sentry: new THREE.MeshStandardMaterial({ color: 0xffb23e, emissive: 0x70400c, emissiveIntensity: 1.2 }),
  };
}

function addPlayerMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: readonly [number, number, number],
  rotation: readonly [number, number, number] = [0, 0, 0],
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function getPartMaterial(partId: PartId, materials: PlayerMaterials): THREE.MeshStandardMaterial {
  return materials[MACHINE_PARTS[partId].source];
}

function createPlayerLegs(group: THREE.Group, partId: MachineLoadout["legs"], materials: PlayerMaterials): void {
  const accent = getPartMaterial(partId, materials);
  const isHunter = partId === "hunter-legs";
  for (const side of [-1, 1]) {
    const x = side * 0.2;
    addPlayerMesh(group, new THREE.BoxGeometry(0.22, 0.42, 0.24), materials.armor, [x, 0.66, 0], [0, 0, isHunter ? side * -0.12 : 0]);
    addPlayerMesh(group, new THREE.BoxGeometry(0.17, 0.34, 0.19), materials.frame, [x + (isHunter ? side * 0.035 : 0), 0.3, isHunter ? 0.06 : 0]);
    addPlayerMesh(group, new THREE.BoxGeometry(0.25, 0.12, isHunter ? 0.36 : 0.3), materials.armor, [x, 0.08, -0.055]);
    addPlayerMesh(group, new THREE.BoxGeometry(0.07, 0.22, 0.035), accent, [x, 0.43, -0.13]);
  }
}

function createPlayerCore(
  group: THREE.Group,
  partId: MachineLoadout["core"],
  materials: PlayerMaterials,
): THREE.Mesh {
  const isSentry = partId === "sentry-core";
  const body = addPlayerMesh(
    group,
    new THREE.BoxGeometry(isSentry ? 0.7 : 0.58, 0.48, isSentry ? 0.42 : 0.34),
    materials.armor,
    [0, 1.08, 0],
  );
  addPlayerMesh(group, new THREE.BoxGeometry(isSentry ? 0.32 : 0.24, 0.22, 0.05), getPartMaterial(partId, materials), [0, 1.1, -0.2]);
  addPlayerMesh(group, new THREE.BoxGeometry(0.34, 0.12, 0.28), materials.frame, [0, 0.81, 0]);
  if (isSentry) {
    addPlayerMesh(group, new THREE.BoxGeometry(0.18, 0.38, 0.46), materials.armor, [-0.38, 1.08, 0.015], [0, 0, -0.12]);
    addPlayerMesh(group, new THREE.BoxGeometry(0.18, 0.38, 0.46), materials.armor, [0.38, 1.08, 0.015], [0, 0, 0.12]);
  }
  return body;
}

function createPlayerHead(group: THREE.Group, partId: MachineLoadout["head"], materials: PlayerMaterials): void {
  const accent = getPartMaterial(partId, materials);
  if (partId === "sentry-array") {
    addPlayerMesh(group, new THREE.BoxGeometry(0.42, 0.25, 0.31), materials.armor, [0, 1.57, 0]);
    for (const x of [-0.13, 0, 0.13]) {
      addPlayerMesh(group, new THREE.SphereGeometry(0.045, 8, 5), accent, [x, 1.58, -0.175]);
    }
    addPlayerMesh(group, new THREE.BoxGeometry(0.035, 0.28, 0.035), accent, [0.15, 1.79, 0]);
    return;
  }

  const isHunter = partId === "hunter-optic";
  addPlayerMesh(group, new THREE.BoxGeometry(isHunter ? 0.36 : 0.32, 0.27, 0.3), materials.armor, [0, 1.58, 0], [isHunter ? -0.12 : 0, 0, 0]);
  addPlayerMesh(group, new THREE.BoxGeometry(isHunter ? 0.3 : 0.22, 0.06, 0.035), accent, [0, 1.61, -0.17]);
  if (isHunter) {
    addPlayerMesh(group, new THREE.ConeGeometry(0.08, 0.28, 4), materials.armor, [-0.21, 1.63, 0], [0, 0, 0.22]);
    addPlayerMesh(group, new THREE.ConeGeometry(0.08, 0.28, 4), materials.armor, [0.21, 1.63, 0], [0, 0, -0.22]);
  }
}

function createPlayerArms(
  group: THREE.Group,
  partId: MachineLoadout["arms"],
  materials: PlayerMaterials,
): THREE.Mesh {
  const accentMaterial = getPartMaterial(partId, materials);
  const isHeavy = partId === "sentry-arms";
  const isHunter = partId === "hunter-arms";
  for (const side of [-1, 1]) {
    const shoulderX = side * (isHeavy ? 0.47 : 0.41);
    addPlayerMesh(
      group,
      isHunter ? new THREE.ConeGeometry(0.18, 0.38, 4) : new THREE.BoxGeometry(isHeavy ? 0.3 : 0.24, 0.25, 0.32),
      materials.armor,
      [shoulderX, 1.28, 0],
      isHunter ? [0, 0, side * -0.28] : [0, 0, side * (isHeavy ? 0.08 : 0.14)],
    );
    addPlayerMesh(group, new THREE.BoxGeometry(isHeavy ? 0.22 : 0.16, 0.38, 0.18), materials.frame, [side * 0.43, 1.0, -0.015]);
    if (partId === "pulse-arms" || isHunter) {
      addPlayerMesh(group, new THREE.CylinderGeometry(0.045, 0.055, isHunter ? 0.48 : 0.36, 8), accentMaterial, [side * 0.43, 1.03, -0.29], [Math.PI / 2, 0, 0]);
    }
  }

  if (isHeavy) {
    addPlayerMesh(group, new THREE.BoxGeometry(0.25, 0.2, 0.58), materials.armor, [0.45, 1.25, -0.24]);
  }
  const muzzle = addPlayerMesh(
    group,
    new THREE.BoxGeometry(isHeavy ? 0.13 : 0.1, isHeavy ? 0.13 : 0.09, isHeavy ? 0.5 : 0.34),
    accentMaterial,
    [isHeavy ? 0.45 : 0, isHeavy ? 1.25 : 1.08, isHeavy ? -0.68 : -0.38],
  );
  return muzzle;
}

export function createPlayer(loadout: MachineLoadout, skinId: SkinId): PlayerEntity {
  const group = new THREE.Group();
  const materials = createPlayerMaterials(skinId);
  createPlayerLegs(group, loadout.legs, materials);
  const body = createPlayerCore(group, loadout.core, materials);
  createPlayerHead(group, loadout.head, materials);
  const accent = createPlayerArms(group, loadout.arms, materials);
  group.scale.setScalar(PLAYER_HEIGHT_METERS / 1.8);
  return { group, body, accent };
}

export function createExtractionPoint(): ExtractionEntity {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.15, 2.45, 64),
    new THREE.MeshBasicMaterial({ color: 0x62ffb6, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.055;
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.9, 1.9, 7, 32, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x62ffb6, transparent: true, opacity: 0.075, side: THREE.DoubleSide }),
  );
  beam.position.y = 3.5;
  group.add(ring, beam);
  return { group, ring, beam };
}

export function createEnemy(id: number, x: number, z: number, kind: EnemyKind, phase: number): EnemyEntity {
  const config = ENEMIES[kind];
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
    new THREE.MeshStandardMaterial({ color: sensorColor, emissive: sensorColor, emissiveIntensity: 2.4 }),
  );
  sensor.position.set(0, 1.32, -0.54);
  group.add(sensor);
  group.position.set(x, 0, z);

  return {
    id,
    kind,
    group,
    body,
    sensor,
    health: config.health,
    speed: config.speed,
    attackRange: config.attackRange,
    attackDamage: config.attackDamage,
    attackDelay: config.attackDelay,
    cooldown: ENEMY_INITIAL_COOLDOWN_SECONDS + phase * ENEMY_PHASE_COOLDOWN_SECONDS,
    flash: 0,
    patrolAngle: phase,
  };
}

export function createCombatHit(color: number): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 8, 6),
    new THREE.MeshBasicMaterial({ color, transparent: true }),
  );
}

export function createSalvagePickup(position: THREE.Vector3, value: number): PickupEntity {
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
  return { mesh, payload: { kind: "salvage", value }, baseY: 0.62, phase: Math.random() * Math.PI * 2 };
}

export function createPartPickup(position: THREE.Vector3, partId: PartId): PickupEntity {
  const source = MACHINE_PARTS[partId].source;
  const color = source === "hunter" ? 0xff465d : 0xffb23e;
  const mesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.42, 0),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1.35,
      roughness: 0.28,
      metalness: 0.72,
    }),
  );
  mesh.position.copy(position);
  mesh.position.x += 0.72;
  mesh.position.y = 0.72;
  return { mesh, payload: { kind: "part", partId }, baseY: 0.72, phase: Math.random() * Math.PI * 2 };
}

export function createWorldLabel(position: THREE.Vector3, text: string, color: number): TimedObject {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (context) {
    context.font = "700 38px monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineWidth = 9;
    context.strokeStyle = "rgba(2, 10, 12, 0.9)";
    context.strokeText(text, canvas.width / 2, canvas.height / 2);
    context.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
    context.fillText(text, canvas.width / 2, canvas.height / 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.position.copy(position);
  sprite.position.y = WORLD_LABEL_HEIGHT_METERS;
  sprite.scale.set(6.4, 1.2, 1);
  sprite.renderOrder = 20;
  return {
    object: sprite,
    life: WORLD_LABEL_LIFETIME_SECONDS,
    maxLife: WORLD_LABEL_LIFETIME_SECONDS,
    velocity: new THREE.Vector3(0, WORLD_LABEL_RISE_SPEED, 0),
  };
}

export function createBurstFragments(position: THREE.Vector3, color: number): TimedObject[] {
  const fragments: TimedObject[] = [];
  for (let index = 0; index < 8; index += 1) {
    const fragment = new THREE.Mesh(
      new THREE.BoxGeometry(0.18 + Math.random() * 0.22, 0.18 + Math.random() * 0.22, 0.18 + Math.random() * 0.22),
      new THREE.MeshBasicMaterial({ color, transparent: true }),
    );
    fragment.position.copy(position).add(new THREE.Vector3(0, 0.8, 0));
    fragments.push({
      object: fragment,
      life: 0.7,
      maxLife: 0.7,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 5, Math.random() * 3, (Math.random() - 0.5) * 5),
    });
  }
  return fragments;
}

export function createTracer(start: THREE.Vector3, end: THREE.Vector3, color: number, life: number): TimedObject {
  const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1 });
  return { object: new THREE.Line(geometry, material), life, maxLife: life };
}
