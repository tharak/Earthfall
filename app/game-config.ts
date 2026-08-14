import gameScale from "./game-scale.json";
import type { EnemyKind, SkinId, WeaponId } from "./game-types";

type WeaponConfig = {
  magazine: number;
  damage: number;
  shotDelay: number;
  reloadTime: number;
  color: number;
};

type SkinConfig = {
  body: number;
  accent: number;
};

type EnemyConfig = {
  health: number;
  speed: number;
  attackRange: number;
  attackDamage: number;
  attackDelay: number;
  hitRadius: number;
  salvageValue: number;
  effectColor: number;
};

export const WEAPONS = {
  arc: { magazine: 12, damage: 42, shotDelay: 0.3, reloadTime: 1.25, color: 0x63e8ff },
  pulse: { magazine: 24, damage: 24, shotDelay: 0.13, reloadTime: 1.55, color: 0xb8ff6a },
} as const satisfies Record<WeaponId, WeaponConfig>;

export const SKINS = {
  carbon: { body: 0x18262b, accent: 0x5ce7ff },
  salvage: { body: 0xdce4df, accent: 0xff9d3d },
  signal: { body: 0x8d1e2c, accent: 0xffc4c9 },
} as const satisfies Record<SkinId, SkinConfig>;

export const ENEMIES = {
  hunter: {
    health: 80,
    speed: 2.1,
    attackRange: 7.2,
    attackDamage: 7,
    attackDelay: 1.05,
    hitRadius: 0.72,
    salvageValue: 35,
    effectColor: 0xff465d,
  },
  sentry: {
    health: 110,
    speed: 1.25,
    attackRange: 10.5,
    attackDamage: 11,
    attackDelay: 1.65,
    hitRadius: 0.95,
    salvageValue: 55,
    effectColor: 0xffb23e,
  },
} as const satisfies Record<EnemyKind, EnemyConfig>;

export const PLAYER_HEIGHT_METERS = gameScale.playerHeightMeters;
export const PLAYER_RADIUS_METERS = gameScale.playerRadiusMeters;
export const AUTHORED_LAYOUT_SCALE = gameScale.authoredLayoutScale;
export const MISSION_RADIUS_METERS = 185;
export const REQUIRED_KILLS = 8;
export const MISSION_SECONDS = 180;
export const ENEMY_RESPAWN_DELAY_MS = 650;
export const MAX_FRAME_DELTA_SECONDS = 0.05;
export const HUD_UPDATE_INTERVAL_SECONDS = 0.08;
export const PLAYER_MAX_HEALTH = 100;
export const PLAYER_MOVE_SPEED = 5.3;
export const PLAYER_START_POSITION = [0, 10 * AUTHORED_LAYOUT_SCALE] as const;
export const TOUCH_STICK_RADIUS_PX = 42;
export const TOUCH_STICK_THRESHOLD_PX = 11;
export const WEAPON_RANGE_METERS = 24;
export const PICKUP_COLLECT_RADIUS_METERS = 1.65;
export const EXTRACTION_RADIUS_METERS = 2.35;
export const EXTRACTION_DURATION_SECONDS = 2.1;
export const EXTRACTION_PROGRESS_DECAY_PER_SECOND = 0.75;
export const LINE_OF_SIGHT_SAMPLE_SPACING_METERS = 3;
export const ENEMY_INITIAL_COOLDOWN_SECONDS = 0.7;
export const ENEMY_PHASE_COOLDOWN_SECONDS = 0.15;
export const REPLACEMENT_SPAWN_RADII = [42, 52, 62] as const;
export const REPLACEMENT_SPAWN_SAMPLES = 16;
export const REPLACEMENT_MIN_ENEMY_DISTANCE_METERS = 6;
export const REPLACEMENT_FALLBACK_OFFSET_METERS = 40;
export const REPLACEMENT_ANGLE_STEP_RADIANS = 2.399963;
export const INITIAL_ENEMY_SPAWNS: ReadonlyArray<readonly [number, number, EnemyKind]> = [
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
export const EXTRACTION_POSITIONS = [
  [-145, 120],
  [145, 120],
  [-145, -120],
  [145, -120],
] as const;
