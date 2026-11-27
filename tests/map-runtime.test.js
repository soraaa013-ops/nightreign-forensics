import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { decodeMapRuntime } from "../src/map-runtime.js";
import {
  countObservationValues,
  matchesObservation,
} from "../src/map-query.js";
const read = (n) => JSON.parse(fs.readFileSync(`data/${n}.json`));
const original = [...read("map-data").records, ...read("map-dlc").records];
const decoded = decodeMapRuntime(read("map-runtime"));
test("compact runtime restores every original layout, slot, tower floor and icon fact", () => {
  assert.deepEqual(decoded.records, original);
  assert.deepEqual(decoded.iconRecords, read("map-icons").records);
  assert.equal(decoded.records.length, 520);
  assert.ok(fs.statSync("data/map-runtime.json").size < 700000);
});
test("both daily final centers use the matching base or expansion layout ID", () => {
  for (const { id } of original) {
    const pair = decoded.circleCenters[id];
    assert.equal(pair.length, 2);
    for (const point of pair) {
      assert.equal(point.length, 2);
      assert.ok(point.every((v) => Number.isFinite(v) && v >= 0 && v <= 1));
    }
  }
  // Parameter pattern 0 is catalogue layout 1. DLC keeps pattern ID 1005.
  assert.deepEqual(decoded.circleCenters[1], [[0.214844, 0.402995], [0.803385, 0.238281]]);
  assert.deepEqual(decoded.circleCenters[1005], [[0.61959, 0.560521], [0.583333, 0.32487]]);
});
test("invasion sites follow the catalogued event and preserve unknown locations", () => {
  for (const [id, indices] of Object.entries(decoded.eventSites)) {
    assert.ok(original.some(record => record.id === Number(id) && record.specialEvent));
    assert.equal(new Set(indices).size, indices.length);
    for (const index of indices) {
      const point = decoded.eventPoints[index];
      assert.equal(point.length, 2);
      assert.ok(point.every(v => Number.isFinite(v) && v >= 0 && v <= 1));
    }
  }
  assert.equal(decoded.eventSites[1000].length, 10); // Caligo
  assert.equal(decoded.eventSites[122].length, 8); // Gnoster
  assert.equal(decoded.eventSites[1006], undefined); // Great Hollow, no attachment
  assert.equal(decoded.eventSites[1005], undefined); // No event
});
test("single-pass counts preserve the same matching semantics and do not double-count repeats", () => {
  for (const scope of [
    {},
    { category: "Major Base" },
    { key: "Major Base - South Lake" },
    { category: "Field Boss" },
  ]) {
    const counts = countObservationValues(decoded.records, scope);
    for (const [value, count] of counts)
      assert.equal(
        count,
        original.filter((r) => matchesObservation(r, { ...scope, value }))
          .length,
      );
  }
});
test("optimized icons and native-resolution maps stay within payload budgets", () => {
  const icons = JSON.parse(
    fs.readFileSync("assets/map-icons/ui/provenance.json"),
  );
  assert.equal(icons.length, 24);
  assert.ok(icons.reduce((n, i) => n + i.bytes, 0) < 200000);
  const maps = JSON.parse(fs.readFileSync("assets/maps/hd/provenance.json"));
  assert.equal(maps.length, 7);
  for (const map of maps) {
    assert.deepEqual(map.size, [1536, 1536]);
    assert.equal(map.sources.length, 36);
    assert.ok(fs.existsSync(map.path));
  }
});
