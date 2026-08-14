import * as THREE from "three";
import {
  ENEMIES,
  ENEMY_INITIAL_COOLDOWN_SECONDS,
  ENEMY_PHASE_COOLDOWN_SECONDS,
  MACHINE_PARTS,
  PLAYER_HEIGHT_METERS,
  PLAYER_RADIUS_METERS,
  SKINS,
  WORLD_LABEL_HEIGHT_METERS,
  WORLD_LABEL_LIFETIME_SECONDS,
  WORLD_LABEL_RISE_SPEED,
} from "./game-config";
import type {
  EnemyEntity,
  EnemyKind,
  ExtractionEntity,
  PickupEntity,
  PartId,
  PlayerEntity,
  SkinId,
  TimedObject,
} from "./game-types";

export function createPlayer(skinId: SkinId): PlayerEntity {
  const group = new THREE.Group();
  const skin = SKINS[skinId];
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(
      PLAYER_RADIUS_METERS,
      PLAYER_HEIGHT_METERS - PLAYER_RADIUS_METERS * 2,
      5,
      10,
    ),
    new THREE.MeshStandardMaterial({ color: skin.body, roughness: 0.52, metalness: 0.28 }),
  );
  body.position.y = PLAYER_HEIGHT_METERS / 2;
  body.castShadow = true;
  group.add(body);

  const accent = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.18, 0.62),
    new THREE.MeshStandardMaterial({ color: skin.accent, emissive: skin.accent, emissiveIntensity: 1.6 }),
  );
  accent.position.set(0, 1.15, -0.5);
  group.add(accent);
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
