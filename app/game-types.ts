import type * as THREE from "three";

export type WeaponId = "arc" | "pulse";
export type SkinId = "carbon" | "salvage" | "signal";
export type EnemyKind = "hunter" | "sentry";
export type MissionMapId = "sao-paulo" | "tokyo";
export type MissionStatus = "PLAYABLE" | "SCANNING";
export type WorldPoint = { x: number; z: number };
export type MapPoint = [number, number];

export type MissionDefinition = {
  id: string;
  mapId: MissionMapId | null;
  city: string;
  country: string;
  zone: string;
  coordinates: string;
  threat: string;
  status: MissionStatus;
  reward: string;
  enemies: string;
  enemyTypes: EnemyKind[];
  latitude: number;
  longitude: number;
};

export type GlobeLocation = Pick<
  MissionDefinition,
  "id" | "city" | "latitude" | "longitude" | "status"
>;

export type MapBuilding = {
  id: number;
  name?: string;
  kind: string;
  height: number;
  footprint: MapPoint[];
};

export type MapRoad = {
  id: number;
  name?: string;
  kind: string;
  width: number;
  path: MapPoint[];
};

export type MapLandmark = {
  id: number;
  name: string;
  kind: "cathedral" | "crossing";
  footprint: MapPoint[];
};

export type RealMapData = {
  metadata: {
    id: string;
    title: string;
    center: { lat: number; lon: number };
    centerLandmark: string;
    landmarkKind: "cathedral" | "crossing";
    sizeMeters: number;
    source: string;
    sourceUrl: string;
    license: string;
    generatedAt: string;
  };
  buildings: MapBuilding[];
  roads: MapRoad[];
  landmarks: MapLandmark[];
};

export type TacticalMapPlayer = WorldPoint & { heading: number };
export type TacticalMapEnemy = WorldPoint & { id: number; kind: EnemyKind };

export type TacticalMapState = {
  player: TacticalMapPlayer;
  enemies: TacticalMapEnemy[];
  pickups: WorldPoint[];
  extractions: WorldPoint[];
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
  aimX: number;
  aimZ: number;
  aimWithStick: boolean;
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

export type ExtractionEntity = {
  group: THREE.Group;
  ring: THREE.Mesh;
  beam: THREE.Mesh;
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

export type MapPolygonObstacle = BoxObstacle & {
  points: MapPoint[];
};

export type PlayerEntity = {
  group: THREE.Group;
  body: THREE.Mesh;
  accent: THREE.Mesh;
};

export type MissionEnvironment = {
  mapObstacles: MapPolygonObstacle[];
  obstacles: BoxObstacle[];
};

export type RealMapScene = {
  group: THREE.Group;
  obstacles: MapPolygonObstacle[];
};

export type MissionHudListener = (hud: MissionHud) => void;
export type MissionEndListener = (result: MissionResult) => void;
