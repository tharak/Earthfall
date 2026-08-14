import pracaDaSeJson from "./data/praca-da-se-map.json";
import shibuyaCrossingJson from "./data/shibuya-crossing-map.json";
import type { MissionMapId, RealMapData } from "./game-types";

export const MISSION_MAPS: Record<MissionMapId, RealMapData> = {
  "sao-paulo": pracaDaSeJson as RealMapData,
  tokyo: shibuyaCrossingJson as RealMapData,
};
