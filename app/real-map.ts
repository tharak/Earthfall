import * as THREE from "three";
import type { MapPoint as Point, RealMapData } from "./map-content";
import gameScale from "./game-scale.json";

export type MapPolygonObstacle = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  points: Point[];
};

// One Three.js world unit is one physical meter.
export const MAP_METERS_TO_WORLD = 1 / gameScale.metersPerWorldUnit;

function pushTriangle(target: number[], a: [number, number, number], b: [number, number, number], c: [number, number, number]) {
  target.push(...a, ...b, ...c);
}

function createRoads(mapData: RealMapData) {
  const positions: number[] = [];
  for (const road of mapData.roads) {
    for (let index = 1; index < road.path.length; index += 1) {
      const [rawX0, rawZ0] = road.path[index - 1];
      const [rawX1, rawZ1] = road.path[index];
      const x0 = rawX0 * MAP_METERS_TO_WORLD;
      const z0 = rawZ0 * MAP_METERS_TO_WORLD;
      const x1 = rawX1 * MAP_METERS_TO_WORLD;
      const z1 = rawZ1 * MAP_METERS_TO_WORLD;
      const dx = x1 - x0;
      const dz = z1 - z0;
      const length = Math.hypot(dx, dz);
      if (length < 0.01) continue;
      const halfWidth = Math.max(0.12, road.width * MAP_METERS_TO_WORLD * 0.5);
      const px = (-dz / length) * halfWidth;
      const pz = (dx / length) * halfWidth;
      const a: [number, number, number] = [x0 + px, 0.025, z0 + pz];
      const b: [number, number, number] = [x0 - px, 0.025, z0 - pz];
      const c: [number, number, number] = [x1 - px, 0.025, z1 - pz];
      const d: [number, number, number] = [x1 + px, 0.025, z1 + pz];
      // Wind road faces counter-clockwise when viewed from above so the
      // default front-side material is visible to the gameplay camera.
      pushTriangle(positions, a, c, b);
      pushTriangle(positions, a, d, c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: 0x4f5759, roughness: 0.97, metalness: 0.02 }),
  );
  mesh.receiveShadow = true;
  return mesh;
}

function createBuildings(mapData: RealMapData) {
  const positions: number[] = [];
  const colors: number[] = [];
  const obstacles: MapPolygonObstacle[] = [];
  const baseColor = new THREE.Color();

  const addVertexColor = (color: THREE.Color, vertexCount: number) => {
    for (let index = 0; index < vertexCount; index += 1) colors.push(color.r, color.g, color.b);
  };

  for (const building of mapData.buildings) {
    const points = building.footprint.map(([x, z]) => [x * MAP_METERS_TO_WORLD, z * MAP_METERS_TO_WORLD] as Point);
    if (points.length < 3) continue;
    const landmark = building.name === mapData.metadata.centerLandmark;
    // OSM heights remain proportional, but are vertically compressed for the
    // tactical camera. Footprints and horizontal distances stay meter-accurate.
    const height = Math.min(
      landmark ? 34 : 12,
      Math.max(2.8, building.height * MAP_METERS_TO_WORLD * 0.35),
    );
    const contour = points.map(([x, z]) => new THREE.Vector2(x, z));
    const triangles = THREE.ShapeUtils.triangulateShape(contour, []);
    baseColor.setHex(landmark ? 0xc5ad83 : building.id % 3 === 0 ? 0x879598 : building.id % 3 === 1 ? 0x718185 : 0x9ba5a3);

    for (const triangle of triangles) {
      const a = points[triangle[0]];
      const b = points[triangle[1]];
      const c = points[triangle[2]];
      pushTriangle(positions, [a[0], height, a[1]], [b[0], height, b[1]], [c[0], height, c[1]]);
      addVertexColor(baseColor, 3);
    }

    for (let index = 0; index < points.length; index += 1) {
      const a = points[index];
      const b = points[(index + 1) % points.length];
      pushTriangle(positions, [a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], height, b[1]]);
      pushTriangle(positions, [a[0], 0, a[1]], [b[0], height, b[1]], [a[0], height, a[1]]);
      const sideColor = baseColor.clone().multiplyScalar(0.8);
      addVertexColor(sideColor, 6);
    }

    const xs = points.map(([x]) => x);
    const zs = points.map(([, z]) => z);
    const obstacle = {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minZ: Math.min(...zs),
      maxZ: Math.max(...zs),
      points,
    };
    if (obstacle.maxX > -220 && obstacle.minX < 220 && obstacle.maxZ > -220 && obstacle.minZ < 220) obstacles.push(obstacle);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.1 }),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return { mesh, obstacles };
}

function createCrossingMarkings(mapData: RealMapData) {
  const group = new THREE.Group();
  const landmark = mapData.landmarks[0];
  if (landmark) {
    const shape = new THREE.Shape(landmark.footprint.map(([x, z]) => new THREE.Vector2(x * MAP_METERS_TO_WORLD, z * MAP_METERS_TO_WORLD)));
    const field = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshBasicMaterial({ color: 0xd9e2df, transparent: true, opacity: 0.32, side: THREE.DoubleSide }),
    );
    field.rotation.x = Math.PI / 2;
    field.position.y = 0.055;
    group.add(field);
  }
  const stripeMaterial = new THREE.MeshBasicMaterial({ color: 0xf4f1dc, transparent: true, opacity: 0.78 });
  for (const angle of [0, Math.PI / 2, Math.PI * 0.24, -Math.PI * 0.24]) {
    const stripeGroup = new THREE.Group();
    for (let stripe = -5; stripe <= 5; stripe += 1) {
      const marking = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 18), stripeMaterial);
      marking.rotation.x = -Math.PI / 2;
      marking.position.set(stripe * 1.55, 0.075, 0);
      stripeGroup.add(marking);
    }
    stripeGroup.rotation.y = angle;
    group.add(stripeGroup);
  }
  return group;
}

function createLandmarkBeacon(mapData: RealMapData) {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(5.8, 6.05, 64),
    new THREE.MeshBasicMaterial({ color: 0x5ce7ff, transparent: true, opacity: 0.38, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  group.add(ring);
  if (mapData.metadata.landmarkKind === "cathedral") {
    const spireMaterial = new THREE.MeshStandardMaterial({ color: 0xd0b98d, emissive: 0x17363b, emissiveIntensity: 0.12, roughness: 0.72 });
    const northSpire = new THREE.Mesh(new THREE.ConeGeometry(2.2, 16, 8), spireMaterial);
    const southSpire = northSpire.clone();
    northSpire.position.set(-19, 42, 7);
    southSpire.position.set(19, 42, 7);
    group.add(northSpire, southSpire);
  } else {
    group.add(createCrossingMarkings(mapData));
  }
  return group;
}

export function createRealMap(mapData: RealMapData) {
  const group = new THREE.Group();
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(mapData.metadata.sizeMeters * MAP_METERS_TO_WORLD, mapData.metadata.sizeMeters * MAP_METERS_TO_WORLD),
    new THREE.MeshStandardMaterial({ color: 0x77877d, roughness: 0.94, metalness: 0.04 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground, createRoads(mapData));
  const buildings = createBuildings(mapData);
  group.add(buildings.mesh, createLandmarkBeacon(mapData));
  return { group, obstacles: buildings.obstacles };
}

export function pointInMapObstacle(x: number, z: number, obstacle: MapPolygonObstacle) {
  if (x < obstacle.minX || x > obstacle.maxX || z < obstacle.minZ || z > obstacle.maxZ) return false;
  let inside = false;
  for (let index = 0, previous = obstacle.points.length - 1; index < obstacle.points.length; previous = index, index += 1) {
    const [xi, zi] = obstacle.points[index];
    const [xj, zj] = obstacle.points[previous];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
