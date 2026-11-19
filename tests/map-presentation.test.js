import test from "node:test";
import assert from "node:assert/strict";
import { pointTitle } from "../src/map-presentation.js";
const p = { key: "site", category: "据点", location: "圣人桥西侧" },
  state = { observations: [] },
  zh = (v) => v;
test("point headline prioritizes content and never falls back to geographic description", () => {
  assert.equal(
    pointTitle(
      p,
      [{ slots: [{ key: "site", value: "营地 - 骑士" }] }],
      state,
      zh,
    ),
    "营地 - 骑士",
  );
  assert.equal(
    pointTitle(
      p,
      [
        { slots: [{ key: "site", value: "营地 - 骑士" }] },
        { slots: [{ key: "site", value: "营地 - 士兵" }] },
      ],
      state,
      zh,
    ),
    "营地",
  );
  assert.equal(
    pointTitle(
      p,
      [
        { slots: [{ key: "site", value: "营地 - 骑士" }] },
        { slots: [{ key: "site", value: "遗迹 - 魔像" }] },
      ],
      state,
      zh,
    ),
    "据点",
  );
  assert.equal(
    pointTitle({ ...p, tower: true }, [], state, zh),
    "神授塔 · 三层强敌",
  );
  assert.equal(
    pointTitle({ ...p, spawn: "圣人桥西侧" }, [], state, zh),
    "出生点",
  );
});
