import test from "node:test";
import assert from "node:assert/strict";
import { pointTitle } from "../src/map-presentation.js";
const p = { key: "site", category: "Major Base", location: "圣人桥西侧" };
const state = { observations: [] },
  zh = (v) => v;
const records = (...values) =>
  values.map((value) => ({ slots: [{ key: "site", value }] }));
test("only resolved enemies receive a headline, without building or location text", () => {
  assert.equal(pointTitle(p, records("遗迹 - 卢恩熊"), state, zh), "卢恩熊");
  assert.equal(
    pointTitle(p, records("遗迹 - 卢恩熊", "遗迹 - 魔像"), state, zh),
    "",
  );
  assert.equal(
    pointTitle(
      p,
      [],
      { observations: [{ key: "site", value: "Ruins", match: "type" }] },
      zh,
    ),
    "",
  );
  assert.equal(pointTitle(p, records("遗迹 - 睡眠"), state, zh), "");
  assert.equal(
    pointTitle(p, records("Map Event - West Mistwood"), state, zh),
    "",
  );
  assert.equal(
    pointTitle(
      { ...p, category: "Minor Base" },
      records("教堂 - 老鼠"),
      state,
      zh,
    ),
    "",
  );
  assert.equal(pointTitle({ ...p, spawn: "圣人桥" }, [], state, zh), "");
  assert.equal(pointTitle(p, records(null), state, zh), "");
  assert.equal(pointTitle({ ...p, tower: true }, [], state, zh), "");
  const towers = [
    { slots: [{ key: "site", floors: ["甲", "乙", "丙"] }] },
    { slots: [{ key: "site", floors: ["甲", "丁", "戊"] }] },
  ];
  assert.equal(pointTitle({ ...p, tower: true }, towers, state, zh), "1层：甲");
});
