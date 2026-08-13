#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const PROFILES = {
  "praca-da-se": {
    center: { lat: -23.5512688, lon: -46.6343705 },
    id: "praca-da-se-1024",
    title: "Praça da Sé — Catedral da Sé",
    centerLandmark: "Catedral da Sé",
    landmarkKind: "cathedral",
    landmarkOsmId: 8093737,
    output: "app/data/praca-da-se-map.json",
  },
  "shibuya-crossing": {
    center: { lat: 35.6594951, lon: 139.7004982 },
    id: "shibuya-crossing-1024",
    title: "Shibuya — Scramble Crossing",
    centerLandmark: "Shibuya Scramble Crossing",
    landmarkKind: "crossing",
    landmarkOsmId: 1335178864,
    output: "app/data/shibuya-crossing-map.json",
  },
};

const profileName = process.argv[2] ?? "praca-da-se";
const profile = PROFILES[profileName];
if (!profile) throw new Error(`Unknown map profile: ${profileName}`);
const CENTER = profile.center;
const SIZE_METERS = 1024;
const HALF_SIZE = SIZE_METERS / 2;
const METERS_PER_LATITUDE_DEGREE = 111_320;
const METERS_PER_LONGITUDE_DEGREE =
  METERS_PER_LATITUDE_DEGREE * Math.cos((CENTER.lat * Math.PI) / 180);

const input = resolve(process.argv[3] ?? `/tmp/earthfall-${profileName}-overpass.json`);
const output = resolve(process.argv[4] ?? profile.output);

const source = JSON.parse(await readFile(input, "utf8"));

function project(point) {
  return [
    (point.lon - CENTER.lon) * METERS_PER_LONGITUDE_DEGREE,
    (CENTER.lat - point.lat) * METERS_PER_LATITUDE_DEGREE,
  ];
}

function roundPoint([x, z]) {
  return [Math.round(x * 10) / 10, Math.round(z * 10) / 10];
}

function squaredDistanceToSegment(point, start, end) {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  if (dx === 0 && dz === 0) return (point[0] - start[0]) ** 2 + (point[1] - start[1]) ** 2;
  const t = Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) / (dx * dx + dz * dz)));
  const x = start[0] + t * dx;
  const z = start[1] + t * dz;
  return (point[0] - x) ** 2 + (point[1] - z) ** 2;
}

function simplify(points, tolerance = 1.25) {
  if (points.length <= 2) return points;
  let furthestIndex = 0;
  let furthestDistance = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = squaredDistanceToSegment(points[index], points[0], points.at(-1));
    if (distance > furthestDistance) {
      furthestDistance = distance;
      furthestIndex = index;
    }
  }
  if (furthestDistance <= tolerance * tolerance) return [points[0], points.at(-1)];
  return [
    ...simplify(points.slice(0, furthestIndex + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(furthestIndex), tolerance),
  ];
}

function geometryFor(element, closed) {
  const projected = (element.geometry ?? []).map(project);
  if (closed && projected.length > 1) projected.pop();
  const simplified = simplify(projected, closed ? 0.8 : 1.4);
  return simplified
    .filter(([x, z]) => Math.abs(x) <= HALF_SIZE + 40 && Math.abs(z) <= HALF_SIZE + 40)
    .map(roundPoint);
}

function numericTag(tags, key) {
  const value = Number.parseFloat(tags?.[key]);
  return Number.isFinite(value) ? value : undefined;
}

function buildingHeight(element) {
  if (element.tags?.building === "cathedral") return 92;
  const explicit = numericTag(element.tags, "height");
  if (explicit) return Math.min(90, Math.max(3, explicit));
  const levels = numericTag(element.tags, "building:levels");
  if (levels) return Math.min(90, Math.max(3, levels * 3.2));
  return 9 + ((element.id * 17) % 8) * 3.1;
}

const roadWidths = {
  motorway: 18,
  trunk: 16,
  primary: 14,
  secondary: 12,
  tertiary: 10,
  residential: 8,
  living_street: 7,
  service: 5,
  pedestrian: 6,
  footway: 2.4,
  steps: 3,
  path: 2,
};

const buildings = source.elements
  .filter((element) => element.type === "way" && element.tags?.building)
  .map((element) => ({
    id: element.id,
    name: element.tags.name,
    kind: element.tags.building,
    height: Math.round(buildingHeight(element) * 10) / 10,
    footprint: geometryFor(element, true),
  }))
  .filter((building) => building.footprint.length >= 3);

const roads = source.elements
  .filter((element) => element.type === "way" && element.tags?.highway)
  .map((element) => ({
    id: element.id,
    name: element.tags.name,
    kind: element.tags.highway,
    width: roadWidths[element.tags.highway] ?? 4,
    path: geometryFor(element, false),
  }))
  .filter((road) => road.path.length >= 2);

const landmarks = source.elements
  .filter((element) => element.type === "way" && element.id === profile.landmarkOsmId)
  .map((element) => ({
    id: element.id,
    name: profile.centerLandmark,
    kind: profile.landmarkKind,
    footprint: geometryFor(element, true),
  }))
  .filter((landmark) => landmark.footprint.length >= 3);

const dataset = {
  metadata: {
    id: profile.id,
    title: profile.title,
    center: CENTER,
    centerLandmark: profile.centerLandmark,
    landmarkKind: profile.landmarkKind,
    sizeMeters: SIZE_METERS,
    source: "OpenStreetMap contributors",
    sourceUrl: "https://www.openstreetmap.org/copyright",
    license: "ODbL 1.0",
    generatedAt: new Date().toISOString().slice(0, 10),
  },
  buildings,
  roads,
  landmarks,
};

await writeFile(output, `${JSON.stringify(dataset)}\n`);
console.log(`Generated ${output}: ${buildings.length} buildings, ${roads.length} roads, ${landmarks.length} landmark areas.`);
