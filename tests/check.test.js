import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { calculateExactRelicProbability, inspectRelic, listTemplateEffects } from "../src/check.js";

const gameData = JSON.parse(await readFile(new URL("../data/game-data.json", import.meta.url)));
const template = gameData.templates.find((candidate) => candidate.id === 202);
const poolSets = template.effectPools.map((poolId) => new Set(gameData.pools[poolId].map(({ effectId }) => effectId)));

function findLegalDistinctFamilyEffects() {
  const chosen = [];
  for (const poolId of template.effectPools) {
    const effect = gameData.pools[poolId].map(({ effectId }) => gameData.effects[effectId]).find((candidate) => candidate && !chosen.some((prior) => prior.id === candidate.id || (prior.familyId && prior.familyId === candidate.familyId)));
    chosen.push(effect);
  }
  return chosen;
}

test("generated dataset has current three-slot templates and searchable effects", () => {
  assert.equal(template.slotCount, 3);
  assert.ok(listTemplateEffects(template, gameData).length > 100);
});

test("accepts a combination assignable to all hidden pools", () => {
  const chosen = findLegalDistinctFamilyEffects().map(({ id }) => id);
  const ordered = [...chosen].sort((a, b) => (gameData.effects[a].overrideBaseEffectId - gameData.effects[b].overrideBaseEffectId) || a - b);
  const inspection = inspectRelic({ templateId: template.id, effectIds: ordered }, gameData);
  assert.equal(inspection.status, "valid");
  assert.deepEqual(new Set(inspection.hiddenEffectIds), new Set(chosen));
});

test("rejects two effects from the same compatibility family", () => {
  const all = listTemplateEffects(template, gameData);
  const first = all.find((effect) => effect.familyId && all.some((other) => other.id !== effect.id && other.familyId === effect.familyId));
  const second = all.find((effect) => effect.id !== first.id && effect.familyId === first.familyId);
  const filler = all.find((effect) => effect.id !== first.id && effect.id !== second.id && effect.familyId !== first.familyId);
  const inspection = inspectRelic({ templateId: template.id, effectIds: [first.id, second.id, filler.id] }, gameData);
  assert.equal(inspection.code, "DUPLICATE_EFFECT_FAMILY");
});

test("rejects a known effect that cannot fit any slot in the selected template", () => {
  const unavailable = Object.values(gameData.effects).find((effect) => poolSets.every((pool) => !pool.has(effect.id)));
  const legal = findLegalDistinctFamilyEffects().slice(0, 2).map(({ id }) => id);
  const inspection = inspectRelic({ templateId: template.id, effectIds: [...legal, unavailable.id] }, gameData);
  assert.equal(inspection.code, "EFFECT_NOT_IN_TEMPLATE_POOL");
});

test("returns canonical display order when input is reversed", () => {
  const chosen = findLegalDistinctFamilyEffects().map(({ id }) => id);
  const ordered = [...chosen].sort((a, b) => (gameData.effects[a].overrideBaseEffectId - gameData.effects[b].overrideBaseEffectId) || a - b);
  const inspection = inspectRelic({ templateId: template.id, effectIds: [...ordered].reverse() }, gameData);
  assert.equal(inspection.status, "reorder");
  assert.deepEqual(inspection.orderedEffectIds, ordered);
});

test("calculates a bounded exact-roll probability across hidden slot permutations", () => {
  const chosen = findLegalDistinctFamilyEffects().map(({ id }) => id);
  const probability = calculateExactRelicProbability(chosen, template, gameData);
  assert.ok(probability > 0);
  assert.ok(probability < 1);
});
