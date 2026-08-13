import * as THREE from "three";
import { AUTHORED_LAYOUT_SCALE, MISSION_RADIUS_METERS } from "./game-config";
import type { BoxObstacle } from "./game-types";
import type { RealMapData } from "./map-content";
import { createRealMap } from "./real-map";
import { createStreetObstacles } from "./street-obstacles";

export function createMissionEnvironment(scene: THREE.Scene, mapData: RealMapData) {
  scene.add(
    new THREE.HemisphereLight(0xf1fbff, 0x667064, 2.4),
    new THREE.AmbientLight(0xb9d0d6, 1.15),
  );

  const key = new THREE.DirectionalLight(0xfff0d2, 3.2);
  key.position.set(-80, 180, 120);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -220;
  key.shadow.camera.right = 220;
  key.shadow.camera.top = 220;
  key.shadow.camera.bottom = -220;
  key.shadow.camera.far = 500;
  scene.add(key);

  const redGlow = new THREE.PointLight(0xff3b4e, 20, 28, 2);
  redGlow.position.set(10 * AUTHORED_LAYOUT_SCALE, 7, -16 * AUTHORED_LAYOUT_SCALE);
  scene.add(redGlow);

  const realMap = createRealMap(mapData);
  scene.add(realMap.group);
  const obstacles = createStreetObstacles(scene, mapData, realMap.obstacles, MISSION_RADIUS_METERS);
  obstacles.push(...createAuthoredCover(scene));
  scene.add(createAlienRelay());
  return { mapObstacles: realMap.obstacles, obstacles };
}

function createAuthoredCover(scene: THREE.Scene) {
  const obstacles: BoxObstacle[] = [];
  const coverData = [
    [-7, -5, 4, 1.5],
    [7, 5, 4, 1.5],
    [-10, 8, 2, 3.5],
    [10, -8, 2, 3.5],
    [4, -13, 4, 1.5],
    [-4, 13, 4, 1.5],
  ];
  coverData.forEach(([x, z, width, depth], index) => {
    const cover = new THREE.Mesh(
      new THREE.BoxGeometry(width, 1.4, depth),
      new THREE.MeshStandardMaterial({ color: index % 2 ? 0x364347 : 0x2d383c, roughness: 0.74 }),
    );
    const worldX = x * AUTHORED_LAYOUT_SCALE;
    const worldZ = z * AUTHORED_LAYOUT_SCALE;
    cover.position.set(worldX, 0.7, worldZ);
    cover.castShadow = true;
    cover.receiveShadow = true;
    scene.add(cover);
    obstacles.push({
      minX: worldX - width / 2 - 0.5,
      maxX: worldX + width / 2 + 0.5,
      minZ: worldZ - depth / 2 - 0.5,
      maxZ: worldZ + depth / 2 + 0.5,
    });
  });
  return obstacles;
}

function createAlienRelay() {
  const relay = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(2.5, 10, 6),
    new THREE.MeshStandardMaterial({ color: 0x101519, metalness: 0.8, roughness: 0.25 }),
  );
  core.scale.set(2.1, 0.45, 1);
  relay.add(core);
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(3.7, 0.12, 8, 40),
    new THREE.MeshBasicMaterial({ color: 0xff4059, transparent: true, opacity: 0.7 }),
  );
  halo.rotation.x = Math.PI / 2.4;
  relay.add(halo);
  relay.position.set(10 * AUTHORED_LAYOUT_SCALE, 13, -18 * AUTHORED_LAYOUT_SCALE);
  relay.rotation.y = -0.35;
  return relay;
}
