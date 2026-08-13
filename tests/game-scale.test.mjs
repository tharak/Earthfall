import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const scale = JSON.parse(await readFile(new URL("../app/game-scale.json", import.meta.url), "utf8"));

test("player and real maps share a meter-accurate world scale", () => {
  assert.equal(scale.metersPerWorldUnit, 1);
  assert.equal(scale.playerHeightMeters, 1.8);
  assert.ok(Math.abs(scale.playerRadiusMeters * 2 + 0.84 - scale.playerHeightMeters) < 1e-9);
  assert.equal(scale.authoredLayoutScale, 10);
});
