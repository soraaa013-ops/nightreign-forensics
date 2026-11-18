import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateMapState } from "../src/map-state.js";
import { matchesSearch } from "../src/search.js";
const data = JSON.parse(
  await readFile(new URL("../data/map-data.json", import.meta.url)),
);
const base = { nightlord: "", mapType: "", spawn: "", observations: [] };
test("map shares validate stable source identifiers and do not share references", () => {
  const slot = data.records[0].slots[0];
  const state = {
    ...base,
    observations: [
      { key: slot.key, category: slot.category, value: slot.value },
    ],
  };
  const result = validateMapState(JSON.parse(JSON.stringify(state)), data);
  assert.deepEqual(result, state);
  result.observations.pop();
  assert.equal(state.observations.length, 1);
});
test("invalid map shares are rejected before affecting filters", () => {
  for (const value of [
    null,
    [],
    {},
    { ...base, nightlord: "not-a-lord" },
    { ...base, observations: [{}] },
    {
      ...base,
      observations: [{ key: "unknown", category: "", value: "empty" }],
    },
    {
      ...base,
      observations: Array(101).fill({ key: "", category: "", value: "Trolls" }),
    },
  ])
    assert.equal(validateMapState(value, data), null);
});
test("punctuation-separated search terms work like space-separated terms", () => {
  assert.ok(matchesSearch("【追踪者】发动绝招时，燃起火焰", "追踪者，大招"));
  assert.ok(matchesSearch("大教堂 · 魔像守卫", "魔像、教堂"));
  assert.ok(!matchesSearch("大教堂 · 魔像守卫", "魔像、骑士"));
});
