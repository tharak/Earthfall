import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const maps = [
  {
    file: "praca-da-se-map.json",
    landmark: "Catedral da Sé",
    kind: "cathedral",
    minimumBuildings: 1500,
    minimumRoads: 500,
  },
  {
    file: "shibuya-crossing-map.json",
    landmark: "Shibuya Scramble Crossing",
    kind: "crossing",
    minimumBuildings: 1500,
    minimumRoads: 1000,
  },
];

for (const expected of maps) {
  test(`${expected.landmark} extract is a centered 1,024 meter real-world map`, async () => {
    const map = JSON.parse(await readFile(new URL(`../app/data/${expected.file}`, import.meta.url), "utf8"));
    assert.equal(map.metadata.sizeMeters, 1024);
    assert.equal(map.metadata.centerLandmark, expected.landmark);
    assert.equal(map.metadata.landmarkKind, expected.kind);
    assert.equal(map.metadata.license, "ODbL 1.0");
    assert.ok(map.buildings.length > expected.minimumBuildings);
    assert.ok(map.roads.length > expected.minimumRoads);

    const landmark = map.landmarks.find((item) => item.name === map.metadata.centerLandmark);
    assert.ok(landmark, "center landmark footprint must be present");
    assert.equal(landmark.kind, expected.kind);
    assert.ok(landmark.footprint.some(([x, z]) => Math.hypot(x, z) < 70));

    if (expected.kind === "cathedral") {
      const cathedral = map.buildings.find((building) => building.name === map.metadata.centerLandmark);
      assert.ok(cathedral);
      assert.ok(cathedral.height >= 80);
    }

    for (const building of map.buildings) {
      for (const [x, z] of building.footprint) {
        assert.ok(Math.abs(x) <= 552 && Math.abs(z) <= 552);
      }
    }
  });
}
