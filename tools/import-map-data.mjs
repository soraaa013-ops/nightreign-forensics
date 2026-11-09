#!/usr/bin/env node
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import process from "node:process";

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => index % 2 === 0 ? [...pairs, [value.replace(/^--/, ""), all[index + 1]]] : pairs, []));
if (!args.source || !args.output) throw new Error("Usage: node tools/import-map-data.mjs --source <pattern_layouts> --output <file> [--commit <sha>]");
const source = resolve(args.source), output = resolve(args.output);
const files = (await readdir(source)).filter((file) => /^layout_\d+\.json$/.test(file)).sort();

const records = [];
for (const file of files) {
  const raw = JSON.parse(await readFile(join(source, file), "utf8"));
  const slots = Object.entries(raw).filter(([, value]) => value && typeof value === "object" && "location" in value).map(([key, value]) => ({ key, category: key.split(" - ")[0], location: value.location, value: value.value === "empty" ? null : value.value }));
  records.push({
    id: Number(raw["Layout Number"]), nightlord: raw.Nightlord, mapType: raw["Shifting Earth"], spawn: raw["Spawn Point"],
    specialEvent: raw["Special Event"] === "empty" ? null : raw["Special Event"],
    night1Boss: raw["Night 1 Boss"], night2Boss: raw["Night 2 Boss"], extraNightBoss: raw["Extra Night Boss"] === "empty" ? null : raw["Extra Night Boss"],
    night1Circle: raw["Night 1 Circle"], night2Circle: raw["Night 2 Circle"], slots
  });
}
const unique = (key) => [...new Set(records.map((record) => record[key]).filter(Boolean))].sort();
const result = {
  metadata: { schemaVersion: 1, status: "community-catalogue", label: "Base-game 320-pattern catalogue", source: "NikVince/nightreign-map-router", sourceUrl: "https://github.com/NikVince/nightreign-map-router", sourceCommit: args.commit || null, knownLimit: "Base-game catalogue; not the current 520-record DLC dataset." },
  facets: { nightlords: unique("nightlord"), mapTypes: unique("mapType"), spawns: unique("spawn") },
  records
};
await mkdir(resolve(output, ".."), { recursive: true });
await writeFile(output, `${JSON.stringify(result)}\n`);
console.log(`Generated ${records.length} map records.`);
