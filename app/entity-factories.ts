import * as THREE from "three";
import { PLAYER_HEIGHT_METERS, PLAYER_RADIUS_METERS, SKINS } from "./game-config";
import type { EnemyEntity, EnemyKind, SkinId } from "./game-types";

export function createPlayer(skinId: SkinId) {
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

export function createExtractionPoint() {
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
  group.visible = false;
  return { group, ring, beam };
}

export function createEnemy(id: number, x: number, z: number, kind: EnemyKind, phase: number): EnemyEntity {
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
    health: kind === "hunter" ? 80 : 110,
    speed: kind === "hunter" ? 2.1 : 1.25,
    attackRange: kind === "hunter" ? 7.2 : 10.5,
    attackDamage: kind === "hunter" ? 7 : 11,
    attackDelay: kind === "hunter" ? 1.05 : 1.65,
    cooldown: 0.7 + phase * 0.15,
    flash: 0,
    patrolAngle: phase,
  };
}
