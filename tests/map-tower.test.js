import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { towerFloors } from "../src/map-tower.js";
import { pointConsensus } from "../src/map-spatial.js";
import { queryMaps } from "../src/map-query.js";
const read = (n) =>
  JSON.parse(readFileSync(new URL(`../data/${n}.json`, import.meta.url)));
const data = read("map-dlc"),
  geometry = read("map-dlc-geometry"),
  zh = read("zh-CN").map;
test("all 80 Great Hollow layouts preserve three ordered floors at each of two single tower points", () => {
  const points = geometry.points.filter((p) => p.tower);
  assert.equal(points.length, 2);
  for (const record of data.records.filter(
    (r) => r.mapType === "Great Hollow",
  )) {
    const slots = record.slots.filter((s) => s.floors);
    assert.equal(slots.length, 2);
    for (const slot of slots) {
      assert.equal(slot.floors.length, 3);
      assert.ok(points.some((p) => p.key === slot.key));
      for (const value of slot.floors) assert.ok(zh[value]);
      assert.equal(slot.value, slot.floors[2]);
      assert.ok(
        queryMaps(data.records, {
          observations: [{ key: slot.key, value: slot.value }],
        }).includes(record),
      );
    }
  }
  const sample = data.records.find((r) => r.id === 1005);
  assert.deepEqual(
    sample.slots
      .find((s) => s.location === "西北神授塔")
      .floors.map((v) => zh[v]),
    ["接肢葛瑞克", "龙装大树守卫和王城骑兵", "大树守卫和王城骑兵"],
  );
  assert.deepEqual(
    sample.slots
      .find((s) => s.location === "东南神授塔")
      .floors.map((v) => zh[v]),
    ["英雄石像鬼", "贪食魔龙", "神皮双人组"],
  );
});
test("a shared third-floor boss must not imply agreement on the other two floors", () => {
  const records = [
    { slots: [{ key: "tower", value: "C", floors: ["A", "B", "C"] }] },
    { slots: [{ key: "tower", value: "C", floors: ["D", "B", "C"] }] },
  ];
  assert.deepEqual(
    towerFloors(records, "tower").map((f) => f.certain),
    [false, true, true],
  );
  assert.deepEqual(towerFloors(records, "tower")[0].values, ["A", "D"]);
  assert.equal(pointConsensus(records, { key: "tower", tower: true }), null);
  assert.equal(
    pointConsensus([records[0]], { key: "tower", tower: true }),
    "C",
  );
  assert.ok(
    towerFloors([], "tower").every((f) => !f.certain && f.values.length === 0),
  );
});
