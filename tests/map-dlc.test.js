import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { queryMaps } from "../src/map-query.js";
import { validateMapState } from "../src/map-state.js";
const read = (name) =>
  JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url)));
const base = read("map-data"),
  dlc = read("map-dlc"),
  geometry = read("map-dlc-geometry"),
  zh = read("zh-CN").map;
const records = [...base.records, ...dlc.records];
const data = {
  records,
  facets: Object.fromEntries(
    [
      ["nightlords", "nightlord"],
      ["mapTypes", "mapType"],
      ["spawns", "spawn"],
    ].map(([a, b]) => [a, [...new Set(records.map((r) => r[b]))]]),
  ),
};
test("DLC catalogue adds 200 unique layouts, 80 Great Hollow and both new Nightlords", () => {
  assert.equal(records.length, 520);
  assert.equal(new Set(records.map((r) => r.id)).size, 520);
  assert.equal(queryMaps(records, { mapType: "Great Hollow" }).length, 80);
  for (const nightlord of ["Harmonia", "Straghess"])
    assert.equal(queryMaps(records, { nightlord }).length, 60);
  assert.equal(queryMaps(records, { nightlord: "Gladius" }).length, 50);
});
test("every DLC layout survives its own observations and can be shared/restored", () => {
  for (const r of dlc.records) {
    const observations = r.slots
      .filter((s) => s.value)
      .map(({ key, category, value }) => ({ key, category, value }));
    const q = {
      nightlord: r.nightlord,
      mapType: r.mapType,
      spawn: r.spawn,
      observations,
    };
    assert.ok(validateMapState(q, data), String(r.id));
    assert.ok(queryMaps(records, q).some((x) => x.id === r.id));
    assert.equal(new Set(r.slots.map((s) => s.key)).size, r.slots.length);
    assert.ok(observations.length >= 20, String(r.id));
  }
});
test("DLC fields have Chinese labels and real geometry; both map levels have all tiles", () => {
  const points = [...read("map-geometry").points, ...geometry.points];
  for (const r of dlc.records) {
    for (const v of Object.values(r))
      if (typeof v === "string") assert.ok(zh[v], v);
    for (const s of r.slots) {
      for (const v of Object.values(s))
        if (v) {
          assert.ok(zh[v], v);
          assert.doesNotMatch(zh[v], /[a-z]/i);
        }
      assert.ok(
        points.some((p) => p.key === s.key && p.terrains.includes(r.mapType)),
        s.key,
      );
    }
  }
  for (const p of geometry.points) {
    assert.ok(p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1);
  }
  for (const folder of ["great_hollow", "great_hollow_under"])
    for (let x = 0; x < 6; x++)
      for (let y = 0; y < 6; y++)
        assert.ok(
          existsSync(
            new URL(`../assets/maps/${folder}/${x}-${y}.webp`, import.meta.url),
          ),
        );
});
