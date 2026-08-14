import * as THREE from "three";
import { pointInMapObstacle } from "./real-map";
import type { BoxObstacle, MapPolygonObstacle, RealMapData } from "./game-types";
import { EXTRACTION_POSITIONS } from "./game-config";

type StreetPropKind = "car" | "barrier" | "crates" | "rubble" | "lamp";
type Placement = { x: number; z: number; angle: number; kind: StreetPropKind; variant: number };

const DRIVABLE_ROAD_KINDS = new Set([
  "living_street", "motorway", "motorway_link", "pedestrian", "primary", "primary_link",
  "residential", "secondary", "secondary_link", "service", "tertiary", "tertiary_link",
  "trunk", "trunk_link", "unclassified",
]);

const MAX_PROPS = 280;

function deterministicHash(value: number) {
  const x = Math.sin(value * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function generatePlacements(mapData: RealMapData, mapObstacles: MapPolygonObstacle[], missionRadius: number) {
  const placements: Placement[] = [];
  const occupied: Array<[number, number]> = [];
  const isClear = (x: number, z: number) => {
    if (Math.hypot(x, z) < 16 || Math.hypot(x, z - 100) < 8) return false;
    if (EXTRACTION_POSITIONS.some(([exitX, exitZ]) => Math.hypot(x - exitX, z - exitZ) < 8)) return false;
    if (Math.abs(x) > missionRadius - 4 || Math.abs(z) > missionRadius - 4) return false;
    if (mapObstacles.some((obstacle) => pointInMapObstacle(x, z, obstacle))) return false;
    return !occupied.some(([otherX, otherZ]) => Math.hypot(x - otherX, z - otherZ) < 5.5);
  };

  for (const road of mapData.roads) {
    if (placements.length >= MAX_PROPS) break;
    if (!DRIVABLE_ROAD_KINDS.has(road.kind) || road.width < 4) continue;
    for (let index = 1; index < road.path.length && placements.length < MAX_PROPS; index += 1) {
      const [x0, z0] = road.path[index - 1];
      const [x1, z1] = road.path[index];
      const dx = x1 - x0;
      const dz = z1 - z0;
      const length = Math.hypot(dx, dz);
      if (length < 5) continue;
      const samples = Math.max(1, Math.floor(length / 15));
      for (let sample = 0; sample < samples && placements.length < MAX_PROPS; sample += 1) {
        const seed = road.id * 0.013 + index * 17.17 + sample * 91.7;
        if (deterministicHash(seed) > 0.78) continue;
        const along = (sample + 0.25 + deterministicHash(seed + 1) * 0.5) / samples;
        const laneOffset = (deterministicHash(seed + 2) - 0.5) * Math.max(0, road.width - 2.5) * 0.65;
        const x = x0 + dx * along - (dz / length) * laneOffset;
        const z = z0 + dz * along + (dx / length) * laneOffset;
        if (!isClear(x, z)) continue;
        const roll = deterministicHash(seed + 3);
        const kind: StreetPropKind = roll < 0.34 ? "car" : roll < 0.56 ? "barrier" : roll < 0.76 ? "crates" : roll < 0.9 ? "rubble" : "lamp";
        placements.push({ x, z, angle: Math.atan2(dx, dz), kind, variant: deterministicHash(seed + 4) });
        occupied.push([x, z]);
      }
    }
  }
  return placements;
}

export function createStreetObstacles(
  scene: THREE.Scene,
  mapData: RealMapData,
  mapObstacles: MapPolygonObstacle[],
  missionRadius: number,
) {
  const placements = generatePlacements(mapData, mapObstacles, missionRadius);
  const obstacles: BoxObstacle[] = [];
  const addInstances = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    items: Placement[],
    transform: (item: Placement, matrix: THREE.Matrix4, index: number, mesh: THREE.InstancedMesh) => void,
  ) => {
    if (items.length === 0) return;
    const mesh = new THREE.InstancedMesh(geometry, material, items.length);
    const matrix = new THREE.Matrix4();
    items.forEach((item, index) => transform(item, matrix, index, mesh));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  };
  const matrixFor = (matrix: THREE.Matrix4, item: Placement, y: number, width: number, height: number, depth: number, angle = item.angle) => {
    matrix.compose(
      new THREE.Vector3(item.x, y, item.z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle),
      new THREE.Vector3(width, height, depth),
    );
  };
  const addCollision = (item: Placement, width: number, depth: number, angle = item.angle) => {
    const halfX = Math.abs(Math.cos(angle)) * width * 0.5 + Math.abs(Math.sin(angle)) * depth * 0.5 + 0.45;
    const halfZ = Math.abs(Math.sin(angle)) * width * 0.5 + Math.abs(Math.cos(angle)) * depth * 0.5 + 0.45;
    obstacles.push({ minX: item.x - halfX, maxX: item.x + halfX, minZ: item.z - halfZ, maxZ: item.z + halfZ });
  };

  const cars = placements.filter((item) => item.kind === "car");
  addInstances(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.48, metalness: 0.42 }), cars, (item, matrix, index, mesh) => {
    matrixFor(matrix, item, 0.48, 1.85, 0.75, 4.15);
    mesh.setMatrixAt(index, matrix);
    mesh.setColorAt(index, new THREE.Color(item.variant < 0.25 ? 0x9b3939 : item.variant < 0.5 ? 0x304f61 : item.variant < 0.75 ? 0xc0b7a2 : 0x303638));
    addCollision(item, 1.85, 4.15);
  });
  addInstances(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x26363c, roughness: 0.28, metalness: 0.25 }), cars, (item, matrix, index, mesh) => {
    matrixFor(matrix, item, 1.02, 1.48, 0.42, 2.05);
    mesh.setMatrixAt(index, matrix);
  });

  const barriers = placements.filter((item) => item.kind === "barrier");
  addInstances(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xb78d59, roughness: 0.82 }), barriers, (item, matrix, index, mesh) => {
    const angle = item.angle + Math.PI / 2;
    matrixFor(matrix, item, 0.62, 3.4, 1.15, 0.48, angle);
    mesh.setMatrixAt(index, matrix);
    addCollision(item, 3.4, 0.48, angle);
  });

  const crates = placements.filter((item) => item.kind === "crates");
  addInstances(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x58615a, roughness: 0.9, metalness: 0.08 }), crates, (item, matrix, index, mesh) => {
    matrixFor(matrix, item, 0.65, 1.65, 1.3 + item.variant * 0.7, 1.45, item.angle + item.variant);
    mesh.setMatrixAt(index, matrix);
    addCollision(item, 1.65, 1.45, item.angle + item.variant);
  });

  const rubble = placements.filter((item) => item.kind === "rubble");
  addInstances(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x646a66, roughness: 1 }), rubble, (item, matrix, index, mesh) => {
    matrixFor(matrix, item, 0.38, 1.1 + item.variant, 0.45 + item.variant * 0.35, 0.8 + item.variant);
    mesh.setMatrixAt(index, matrix);
    addCollision(item, 1.3, 1.1);
  });

  const lamps = placements.filter((item) => item.kind === "lamp");
  addInstances(new THREE.CylinderGeometry(1, 1, 1, 6), new THREE.MeshStandardMaterial({ color: 0x313b3f, roughness: 0.55, metalness: 0.65 }), lamps, (item, matrix, index, mesh) => {
    matrixFor(matrix, item, 2.4, 0.11, 4.8, 0.11);
    mesh.setMatrixAt(index, matrix);
  });
  addInstances(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe3a3 }), lamps, (item, matrix, index, mesh) => {
    matrixFor(matrix, item, 4.72, 0.28, 0.2, 0.28);
    mesh.setMatrixAt(index, matrix);
  });
  return obstacles;
}
