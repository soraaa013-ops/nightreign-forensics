#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import process from "node:process";

const file = process.argv[2] || "data/game-data.json";
const data = JSON.parse(await readFile(file, "utf8"));
const errors = [];
const warnings = [];
const effectIds = new Set(Object.keys(data.effects).map(Number));
const poolIds = new Set(Object.keys(data.pools).map(Number));
const templateIds = new Set();

for (const template of data.templates) {
  if (templateIds.has(template.id)) errors.push(`Duplicate template ${template.id}`);
  templateIds.add(template.id);
  for (const poolId of [...template.effectPools, ...template.cursePools]) if (!poolIds.has(poolId)) errors.push(`Template ${template.id} references missing pool ${poolId}`);
}
for (const [poolId, entries] of Object.entries(data.pools)) {
  const seen = new Set();
  for (const entry of entries) {
    if (!effectIds.has(entry.effectId)) errors.push(`Pool ${poolId} references missing effect ${entry.effectId}`);
    if (entry.weight <= 0) errors.push(`Pool ${poolId} has non-positive weight for ${entry.effectId}`);
    const key = `${entry.effectId}:${entry.weight}`;
    if (seen.has(key)) warnings.push(`Pool ${poolId} repeats effect/weight ${key}`);
    seen.add(key);
  }
}
for (const effect of Object.values(data.effects)) if (effect.name.startsWith("未知效果")) warnings.push(`Missing localized name for effect ${effect.id}`);

console.log(JSON.stringify({ valid: errors.length === 0, stats: data.stats, errors, warningCount: warnings.length, warnings: warnings.slice(0, 25) }, null, 2));
if (errors.length) process.exitCode = 1;
