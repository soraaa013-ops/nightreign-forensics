#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import process from "node:process";

const [beforeFile, afterFile] = process.argv.slice(2);
if (!beforeFile || !afterFile) throw new Error("Usage: node tools/version-diff.mjs <before.json> <after.json>");
const before = JSON.parse(await readFile(beforeFile, "utf8"));
const after = JSON.parse(await readFile(afterFile, "utf8"));

function index(items) { return new Map(items.map((item) => [String(item.id), item])); }
function compare(beforeItems, afterItems) {
  const left = index(beforeItems), right = index(afterItems);
  return {
    added: [...right.keys()].filter((id) => !left.has(id)).map(Number),
    removed: [...left.keys()].filter((id) => !right.has(id)).map(Number),
    changed: [...right.keys()].filter((id) => left.has(id) && JSON.stringify(left.get(id)) !== JSON.stringify(right.get(id))).map(Number)
  };
}

const report = {
  before: before.metadata,
  after: after.metadata,
  templates: compare(before.templates, after.templates),
  effects: compare(Object.values(before.effects), Object.values(after.effects)),
  changedPools: [...new Set([...Object.keys(before.pools), ...Object.keys(after.pools)])].filter((id) => JSON.stringify(before.pools[id]) !== JSON.stringify(after.pools[id])).map(Number)
};
console.log(JSON.stringify(report, null, 2));
