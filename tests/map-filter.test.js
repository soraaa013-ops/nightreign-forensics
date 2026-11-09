import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { filterMapRecords, recommendObservation } from "../src/map-filter.js";

const data = JSON.parse(await readFile(new URL("../data/map-data.json", import.meta.url)));

test("map catalogue contains the 320 base-game records", () => assert.equal(data.records.length, 320));

test("base facets narrow candidate records", () => {
  const sample = data.records[0];
  const candidates = filterMapRecords(data.records, { nightlord: sample.nightlord, mapType: sample.mapType, spawn: sample.spawn });
  assert.ok(candidates.length >= 1);
  assert.ok(candidates.every((record) => record.nightlord === sample.nightlord && record.mapType === sample.mapType && record.spawn === sample.spawn));
});

test("an exact slot observation retains its source record", () => {
  const sample = data.records[0], slot = sample.slots.find((candidate) => candidate.value);
  const candidates = filterMapRecords(data.records, { nightlord: sample.nightlord, observations: [{ key: slot.key, value: slot.value }] });
  assert.ok(candidates.some((record) => record.id === sample.id));
});

test("recommendation chooses a discriminating unobserved slot", () => {
  const candidates = filterMapRecords(data.records, { nightlord: data.records[0].nightlord });
  const recommendation = recommendObservation(candidates);
  assert.ok(recommendation.score > 0);
  assert.ok(recommendation.values.length > 1);
});
