import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { localizeRelics } from "../src/locale.js";
import { inspectRelic } from "../src/check.js";
const read = async (file) =>
  JSON.parse(await readFile(new URL(`../data/${file}.json`, import.meta.url)));
const [relics, maps, dictionary] = await Promise.all(
  ["game-data", "map-data", "zh-CN"].map(read),
);
test("every displayed map field, slot key and facet has a Chinese translation", () => {
  const terms = new Set(Object.values(maps.facets).flat());
  for (const record of maps.records) {
    for (const value of Object.values(record))
      if (typeof value === "string") terms.add(value);
    for (const slot of record.slots)
      for (const value of Object.values(slot)) if (value) terms.add(value);
  }
  for (const term of terms) {
    assert.ok(dictionary.map[term], `Missing map translation: ${term}`);
    assert.doesNotMatch(dictionary.map[term], /[a-z]/i, term);
  }
});
test("all 896 effects and 1305 templates have Chinese names", () => {
  for (const item of [...Object.values(relics.effects), ...relics.templates]) {
    assert.ok(dictionary.relic[item.name], item.name);
    assert.doesNotMatch(dictionary.relic[item.name], /[a-z]/i, item.name);
  }
});
test("localization leaves original snapshots, rule inputs and inspection results intact", () => {
  const original = JSON.stringify(relics);
  const localized = localizeRelics(relics, dictionary);
  assert.equal(JSON.stringify(relics), original);
  assert.equal(localized.pools, relics.pools);
  for (const template of relics.templates) {
    const translated = localized.templates.find(
      (item) => item.id === template.id,
    );
    assert.deepEqual({ ...translated, name: template.name }, template);
  }
  for (const [id, effect] of Object.entries(relics.effects))
    assert.deepEqual({ ...localized.effects[id], name: effect.name }, effect);
  const query = { templateId: 202, effectIds: [100, 100, 100] };
  const before = inspectRelic(query, relics),
    after = inspectRelic(query, localized);
  assert.equal(before.status, after.status);
  assert.equal(before.code, after.code);
});
