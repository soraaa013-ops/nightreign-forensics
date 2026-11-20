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
