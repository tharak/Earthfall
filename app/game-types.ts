import type * as THREE from "three";

export type WeaponId = "arc" | "pulse";
export type SkinId = "carbon" | "salvage" | "signal";
export type EnemyKind = "hunter" | "sentry";

export type TacticalMapState = {
  player: { x: number; z: number; heading: number };
  enemies: Array<{ id: number; x: number; z: number; kind: EnemyKind }>;
  pickups: Array<{ x: number; z: number }>;
  extraction: { x: number; z: number; unlocked: boolean };
};

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

export interface EnemyController {
  decide(observation: EnemyObservation): EnemyIntent;
}

export type EnemyEntity = {
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

export type PickupEntity = {
  mesh: THREE.Mesh;
  value: number;
  baseY: number;
  phase: number;
};

export type TimedObject = {
  object: THREE.Object3D;
  life: number;
  maxLife: number;
  velocity?: THREE.Vector3;
};

export type BoxObstacle = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};
