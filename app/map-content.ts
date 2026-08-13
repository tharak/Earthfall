import pracaDaSeJson from "./data/praca-da-se-map.json";
import shibuyaCrossingJson from "./data/shibuya-crossing-map.json";

export type MapPoint = [number, number];
export type MapBuilding = { id: number; name?: string; kind: string; height: number; footprint: MapPoint[] };
export type MapRoad = { id: number; name?: string; kind: string; width: number; path: MapPoint[] };
export type MapLandmark = { id: number; name: string; kind: "cathedral" | "crossing"; footprint: MapPoint[] };

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

export type MissionMapId = "sao-paulo" | "tokyo";

export const MISSION_MAPS: Record<MissionMapId, RealMapData> = {
  "sao-paulo": pracaDaSeJson as RealMapData,
  tokyo: shibuyaCrossingJson as RealMapData,
};
