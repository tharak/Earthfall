import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const map = JSON.parse(await readFile(new URL("../app/data/praca-da-se-map.json", import.meta.url), "utf8"));

test("Praça da Sé extract is a centered 1,024 meter real-world map", () => {
  assert.equal(map.metadata.sizeMeters, 1024);
  assert.equal(map.metadata.centerLandmark, "Catedral da Sé");
  assert.equal(map.metadata.license, "ODbL 1.0");
  assert.ok(map.buildings.length > 1500);
  assert.ok(map.roads.length > 500);

  const cathedral = map.buildings.find((building) => building.name === map.metadata.centerLandmark);
  assert.ok(cathedral, "center landmark footprint must be present");
  assert.equal(cathedral.kind, "cathedral");
  assert.ok(cathedral.height >= 80);
  assert.ok(cathedral.footprint.some(([x, z]) => Math.hypot(x, z) < 70));

  for (const building of map.buildings) {
    for (const [x, z] of building.footprint) {
      assert.ok(Math.abs(x) <= 552 && Math.abs(z) <= 552);
    }
  }
});
