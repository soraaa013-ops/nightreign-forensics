import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  nearestPoints,
  pointObservations,
  pointConsensus,
} from "../src/map-spatial.js";
import { queryMaps } from "../src/map-query.js";
import { validateMapState } from "../src/map-state.js";
const data = JSON.parse(
  await readFile(new URL("../data/map-data.json", import.meta.url)),
);
const geo = JSON.parse(
  await readFile(new URL("../data/map-geometry.json", import.meta.url)),
);
const base = { nightlord: "", mapType: "", spawn: "", observations: [] };
test("all catalogue slots and spawns have distinct, bounded coordinate mappings", () => {
  const slots = new Set(data.records.flatMap((r) => r.slots.map((s) => s.key)));
  assert.equal(geo.points.length, slots.size + data.facets.spawns.length);
  assert.equal(new Set(geo.points.map((p) => p.id)).size, geo.points.length);
  for (const p of geo.points) {
    assert.ok(p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1);
    assert.ok(
      p.spawn ? data.facets.spawns.includes(p.spawn) : slots.has(p.key),
    );
  }
  const major = geo.points.find((p) => p.key === "Major Base - Minor Erdtree"),
    minor = geo.points.find((p) => p.key === "Minor Base - Minor Erdtree"),
    spawn = geo.points.find((p) => p.spawn === "Minor Erdtree");
  assert.notEqual(major.poiId, minor.poiId);
  assert.notEqual(spawn.poiId, minor.poiId);
});
test("snap uses screen distance, returns nearby alternatives, and leaves blank space unselected", () => {
  const points = [
    { id: "a", x: 0.5, y: 0.5 },
    { id: "b", x: 0.52, y: 0.5 },
  ];
  assert.deepEqual(
    nearestPoints(points, 0.501, 0.5, 600).map((p) => p.id),
    ["a", "b"],
  );
  assert.equal(nearestPoints(points, 0.55, 0.5, 2000).length, 0);
  assert.equal(nearestPoints(points, 0, 0, 600).length, 0);
});
test("coarse building evidence matches all subtypes; exact evidence refines it without losing other clues", () => {
  const point = geo.points.find((p) => p.key === "Major Base - South Lake");
  const coarse = {
    key: point.key,
    category: point.category,
    value: "Ruins",
    match: "type",
  };
  const q = pointObservations(
    { ...base, spawn: data.records[0].spawn },
    point,
    coarse,
  );
  const results = queryMaps(data.records, q);
  assert.ok(results.length > 0);
  assert.ok(
    results.every((r) =>
      r.slots.find((s) => s.key === point.key).value.startsWith("Ruins - "),
    ),
  );
  assert.deepEqual(validateMapState(q, data), q);
  const exact = {
    key: point.key,
    category: point.category,
    value: results[0].slots.find((s) => s.key === point.key).value,
  };
  const refined = pointObservations(q, point, exact);
  assert.equal(refined.observations.length, 1);
  assert.equal(refined.spawn, q.spawn);
  assert.ok(queryMaps(data.records, refined).length <= results.length);
  assert.equal(pointObservations(refined, point, null).observations.length, 0);
  assert.equal(
    validateMapState(
      { ...q, observations: [{ ...coarse, match: "wildcard" }] },
      data,
    ),
    null,
  );
});
test("unknown is not empty; consensus requires agreement from every remaining record", () => {
  const p = { key: "x" };
  const rs = [
    { slots: [{ key: "x", value: "A" }] },
    { slots: [{ key: "x", value: null }] },
  ];
  assert.equal(queryMaps(rs, base).length, 2);
  assert.equal(
    queryMaps(rs, { observations: [{ key: "x", value: "empty" }] }).length,
    1,
  );
  assert.equal(pointConsensus(rs, p), null);
  assert.equal(pointConsensus([rs[0]], p), "A");
  assert.equal(pointConsensus([], p), null);
});
test("all five terrain tile sets match the imported source checksums", async () => {
  assert.equal(geo.metadata.assets.length, 180);
  for (const asset of geo.metadata.assets) {
    const bytes = await readFile(new URL("../" + asset.path, import.meta.url));
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      asset.sha256,
    );
  }
});

test("screen clusters preserve every point and never overlap across mobile sizes, zooms and layers", async () => {
  const { clusterPoints, pointInLayer } = await import("../src/map-spatial.js");
  for (const terrain of Object.keys(geo.layouts))
    for (const width of [292, 362, 740, 680])
      for (const zoom of [1, 1.4, 2.5, 5])
        for (const layer of ["base", "spawn", "boss", "gaol", "all"]) {
          const points = geo.points.filter(
            (p) => p.terrains.includes(terrain) && pointInLayer(p, layer),
          );
          const groups = clusterPoints(points, width * zoom);
          assert.deepEqual(
            groups.flatMap((g) => g.points.map((p) => p.id)).sort(),
            points.map((p) => p.id).sort(),
          );
          for (let i = 0; i < groups.length; i++)
            for (let j = i + 1; j < groups.length; j++) {
              assert.ok(
                Math.abs(groups[i].x - groups[j].x) * width * zoom >= 48 ||
                  Math.abs(groups[i].y - groups[j].y) * width * zoom >= 48,
              );
            }
        }
});
test("layers distinguish spawns, bases, enemies and evergaols without losing special terrain points", async () => {
  const { pointInLayer } = await import("../src/map-spatial.js");
  for (const p of geo.points)
    assert.equal(
      ["base", "spawn", "boss", "gaol"].filter((layer) =>
        pointInLayer(p, layer),
      ).length,
      1,
    );
});
