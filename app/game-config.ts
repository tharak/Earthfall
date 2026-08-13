import gameScale from "./game-scale.json";
import type { SkinId, WeaponId } from "./game-types";

export const WEAPONS = {
  arc: { magazine: 12, damage: 42, shotDelay: 0.3, reloadTime: 1.25, color: 0x63e8ff },
  pulse: { magazine: 24, damage: 24, shotDelay: 0.13, reloadTime: 1.55, color: 0xb8ff6a },
} as const satisfies Record<WeaponId, object>;

export const SKINS = {
  carbon: { body: 0x18262b, accent: 0x5ce7ff },
  salvage: { body: 0xdce4df, accent: 0xff9d3d },
  signal: { body: 0x8d1e2c, accent: 0xffc4c9 },
} as const satisfies Record<SkinId, object>;

export const PLAYER_HEIGHT_METERS = gameScale.playerHeightMeters;
export const PLAYER_RADIUS_METERS = gameScale.playerRadiusMeters;
export const AUTHORED_LAYOUT_SCALE = gameScale.authoredLayoutScale;
export const MISSION_RADIUS_METERS = 185;
export const REQUIRED_KILLS = 8;
export const MISSION_SECONDS = 180;
