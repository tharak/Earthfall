import gameScale from "./game-scale.json";
import type { EnemyKind, MachineLoadout, MachineStats, PartId, PartInventory, PartSlot, SkinId, WeaponId } from "./game-types";

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
  partDrops: readonly PartId[];
};

export type MachinePartConfig = {
  name: string;
  slot: PartSlot;
  source: "issued" | EnemyKind;
  description: string;
  stat: string;
  weaponId?: WeaponId;
  healthBonus?: number;
  moveSpeedMultiplier?: number;
  damageMultiplier?: number;
  reloadMultiplier?: number;
  rangeMultiplier?: number;
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

export const MACHINE_PARTS = {
  "scout-optic": { name: "SCOUT OPTIC", slot: "head", source: "issued", description: "Reliable short-range targeting package.", stat: "STANDARD TARGETING" },
  "hunter-optic": { name: "HUNTER VISOR", slot: "head", source: "hunter", description: "Aggressive tracking logic recovered from Hunters.", stat: "+8% DAMAGE", damageMultiplier: 1.08 },
  "sentry-array": { name: "SENTRY ARRAY", slot: "head", source: "sentry", description: "Long-baseline sensors built to hold firing lanes.", stat: "+20% RANGE", rangeMultiplier: 1.2 },
  "arc-arms": { name: "AR-7 ARC ARMS", slot: "arms", source: "issued", description: "Measured shots with heavy machine disruption.", stat: "42 DMG · 12 MAG", weaponId: "arc" },
  "pulse-arms": { name: "PC-3 PULSE ARMS", slot: "arms", source: "issued", description: "Fast cadence for close pressure.", stat: "24 DMG · 24 MAG", weaponId: "pulse" },
  "hunter-arms": { name: "HUNTER REPEATERS", slot: "arms", source: "hunter", description: "A tuned pulse assembly stripped from a Hunter.", stat: "+10% DAMAGE · PULSE", weaponId: "pulse", damageMultiplier: 1.1 },
  "sentry-arms": { name: "SENTRY CANNON", slot: "arms", source: "sentry", description: "A heavy arc projector with a slower service cycle.", stat: "+18% DAMAGE · ARC", weaponId: "arc", damageMultiplier: 1.18, reloadMultiplier: 1.12 },
  "carbon-core": { name: "CARBON CORE", slot: "core", source: "issued", description: "Balanced issued armor and power routing.", stat: "100 INTEGRITY" },
  "sentry-core": { name: "SENTRY BULWARK", slot: "core", source: "sentry", description: "Dense armor recovered from a lane-holding unit.", stat: "+25 INTEGRITY", healthBonus: 25 },
  "runner-legs": { name: "RUNNER LEGS", slot: "legs", source: "issued", description: "Stable urban traversal actuators.", stat: "STANDARD SPEED" },
  "hunter-legs": { name: "HUNTER STRIDERS", slot: "legs", source: "hunter", description: "High-output pursuit actuators.", stat: "+15% MOVE SPEED", moveSpeedMultiplier: 1.15 },
} as const satisfies Record<PartId, MachinePartConfig>;

export const DEFAULT_LOADOUT: MachineLoadout = {
  head: "scout-optic",
  arms: "arc-arms",
  core: "carbon-core",
  legs: "runner-legs",
};

export const DEFAULT_PART_INVENTORY: PartInventory = {
  "scout-optic": 1,
  "arc-arms": 1,
  "pulse-arms": 1,
  "carbon-core": 1,
  "runner-legs": 1,
};

export function getMachineStats(loadout: MachineLoadout): MachineStats {
  return Object.values(loadout).reduce<MachineStats>((stats, partId) => {
    const part = MACHINE_PARTS[partId];
    stats.maxHealth += part.healthBonus ?? 0;
    stats.moveSpeed *= part.moveSpeedMultiplier ?? 1;
    stats.damageMultiplier *= part.damageMultiplier ?? 1;
    stats.reloadMultiplier *= part.reloadMultiplier ?? 1;
    stats.rangeMultiplier *= part.rangeMultiplier ?? 1;
    return stats;
  }, {
    maxHealth: PLAYER_MAX_HEALTH,
    moveSpeed: PLAYER_MOVE_SPEED,
    damageMultiplier: 1,
    reloadMultiplier: 1,
    rangeMultiplier: 1,
  });
}

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
    partDrops: ["hunter-optic", "hunter-arms", "hunter-legs"],
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
    partDrops: ["sentry-array", "sentry-arms", "sentry-core"],
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
export const EXTRACTION_IDLE_RING_SPEED = 0.4;
export const EXTRACTION_ACTIVE_RING_SPEED = 3.2;
export const EXTRACTION_IDLE_BEAM_OPACITY = 0.055;
export const EXTRACTION_ACTIVE_BEAM_OPACITY = 0.14;
export const EXTRACTION_BEAM_PROGRESS_OPACITY = 0.22;
export const EXTRACTION_IDLE_BEAM_PULSE_OPACITY = 0.018;
export const EXTRACTION_ACTIVE_BEAM_PULSE_OPACITY = 0.025;
export const EXTRACTION_IDLE_PULSE_RATE = 0.003;
export const EXTRACTION_ACTIVE_PULSE_RATE = 0.012;
export const EXTRACTION_ACTIVE_PULSE_SCALE = 0.07;
export const EXTRACTION_PROGRESS_SCALE = 0.12;
export const WORLD_LABEL_LIFETIME_SECONDS = 1.15;
export const WORLD_LABEL_RISE_SPEED = 0.9;
export const WORLD_LABEL_HEIGHT_METERS = 1.5;
export const LINE_OF_SIGHT_SAMPLE_SPACING_METERS = 3;
export const ENEMY_INITIAL_COOLDOWN_SECONDS = 0.7;
export const ENEMY_PHASE_COOLDOWN_SECONDS = 0.15;
export const ENEMY_STEERING_ANGLES = [0, Math.PI / 6, -Math.PI / 6, Math.PI / 3, -Math.PI / 3, Math.PI / 2, -Math.PI / 2] as const;
export const SENTRY_STRAFE_TIME_FACTOR = 0.0008;
export const SENTRY_STRAFE_STRENGTH = 0.45;
export const INITIAL_ENEMY_PHASE_STEP = 0.61;
export const REPLACEMENT_SPAWN_RADII = [42, 52, 62] as const;
export const REPLACEMENT_SPAWN_SAMPLES = 16;
export const REPLACEMENT_MIN_ENEMY_DISTANCE_METERS = 6;
export const REPLACEMENT_FALLBACK_OFFSET_METERS = 40;
export const REPLACEMENT_ANGLE_STEP_RADIANS = 2.399963;
export const OPEN_POSITION_SEARCH_START_METERS = 2;
export const OPEN_POSITION_SEARCH_LIMIT_METERS = 40;
export const OPEN_POSITION_SEARCH_STEP_METERS = 2;
export const OPEN_POSITION_SEARCH_SAMPLES = 32;
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
