import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { searchEffects, matchesSearch } from "../src/search.js";
import { localizeRelics } from "../src/locale.js";
import { queryMaps, facetCounts } from "../src/map-query.js";
const read = async (name) =>
  JSON.parse(await readFile(new URL(`../data/${name}.json`, import.meta.url)));
const [raw, locale, maps] = await Promise.all(
  ["game-data", "zh-CN", "map-data"].map(read),
);
const effects = Object.values(localizeRelics(raw, locale).effects);
test("common health, mana and ultimate aliases match localized text", () => {
  assert.ok(matchesSearch("连续攻击时，恢复血量", "回血"));
  assert.ok(matchesSearch("恢复专注值", "回蓝"));
  assert.ok(matchesSearch("【追踪者】发动绝招时燃起火焰", "追踪者 大招"));
  assert.ok(searchEffects(effects, { query: "回血" }).length > 0);
  assert.ok(searchEffects(effects, { query: "回蓝" }).length > 0);
});
test("multiple terms use AND and category and character combine", () => {
  const results = searchEffects(effects, {
    query: "绝招",
    category: "角色专属",
    character: "追踪者",
  });
  assert.ok(results.length > 0);
  assert.ok(
    results.every(
      (effect) =>
        effect.name.includes("【追踪者】") && effect.name.includes("绝招"),
    ),
  );
  assert.equal(searchEffects(effects, { query: "绝招 不存在的词" }).length, 0);
  assert.equal(searchEffects(effects, {}).length, 896);
});
test("all localized names reject fullwidth Latin abbreviations and traditional ultimate wording", () => {
  for (const group of Object.values(locale))
    for (const text of Object.values(group))
      assert.doesNotMatch(text.normalize("NFKC"), /[A-Za-z]|绝活/);
});
test("unknown location observations retain all and only maps with the observed content", () => {
  const sample = maps.records[0].slots[0];
  const result = queryMaps(maps.records, {
    observations: [{ value: sample.value }],
  });
  assert.ok(result.length > 0);
  assert.ok(
    result.every((record) =>
      record.slots.some((slot) => slot.value === sample.value),
    ),
  );
  const scoped = queryMaps(maps.records, {
    observations: [{ value: sample.value, category: sample.category }],
  });
  assert.ok(
    scoped.every((record) =>
      record.slots.some(
        (slot) =>
          slot.value === sample.value && slot.category === sample.category,
      ),
    ),
  );
});
test("any number of exact observations retain their original record", () => {
  for (const record of maps.records) {
    const observations = record.slots
      .slice(0, 4)
      .map((slot) => ({ key: slot.key, value: slot.value || "empty" }));
    assert.ok(
      queryMaps(maps.records, {
        nightlord: record.nightlord,
        observations,
      }).some((candidate) => candidate.id === record.id),
    );
  }
});
test("facet counts omit their own filter while respecting other observations", () => {
  const counts = facetCounts(
    maps.records,
    { nightlord: "Gladius", mapType: "Default" },
    "nightlord",
    maps.facets.nightlords,
  );
  for (const lord of maps.facets.nightlords)
    assert.equal(
      counts.get(lord),
      maps.records.filter(
        (record) => record.nightlord === lord && record.mapType === "Default",
      ).length,
    );
});

test("role and effect category are independent, so role healing is not hidden", () => {
  const results = searchEffects(effects, {
    character: "守护者",
    category: "恢复与续航",
    query: "回血",
  });
  assert.ok(results.length > 0);
  assert.ok(
    results.every(
      (effect) =>
        effect.name.includes("【守护者】") &&
        effect.name.includes("恢复") &&
        effect.name.includes("血量"),
    ),
  );
});
