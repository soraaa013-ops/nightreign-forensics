#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import process from "node:process";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) args[argv[index].replace(/^--/, "")] = argv[index + 1];
  if (!args.source || !args.output) throw new Error("Usage: node tools/import-game-data.mjs --source <dir> --output <file> [--commit <sha>]");
  return args;
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const headers = rows.shift().map((header) => header.trim());
  return rows.filter((values) => values.some(Boolean)).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function decodeXml(value) {
  return value.replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&apos;", "'");
}

function parseFmg(text) {
  const entries = new Map();
  for (const match of text.matchAll(/<text id="(-?\d+)">([\s\S]*?)<\/text>/g)) {
    const name = decodeXml(match[2].trim());
    if (name && name !== "%null%") entries.set(Number(match[1]), name);
  }
  return entries;
}

function number(value, fallback = -1) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function checksum(content) {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

async function load(source, relativePath) {
  const content = await readFile(join(source, relativePath), "utf8");
  return { content: content.replace(/^\uFEFF/, ""), checksum: checksum(content), path: relativePath };
}

const args = parseArgs(process.argv.slice(2));
const source = resolve(args.source);
const output = resolve(args.output);
const inputFiles = [
  "EquipParamAntique.csv", "AttachEffectTableParam.csv", "AttachEffectParam.csv",
  "tcht/AntiqueName.fmg.xml", "tcht/AntiqueName_dlc01.fmg.xml",
  "tcht/AttachEffectName.fmg.xml", "tcht/AttachEffectName_dlc01.fmg.xml",
  "en/AntiqueName.fmg.xml", "en/AntiqueName_dlc01.fmg.xml",
  "en/AttachEffectName.fmg.xml", "en/AttachEffectName_dlc01.fmg.xml"
];
const loaded = Object.fromEntries((await Promise.all(inputFiles.map(async (path) => [path, await load(source, path)]))));

const equipRows = parseCsv(loaded["EquipParamAntique.csv"].content);
const tableRows = parseCsv(loaded["AttachEffectTableParam.csv"].content);
const effectRows = parseCsv(loaded["AttachEffectParam.csv"].content);
const relicNamesZh = new Map([...parseFmg(loaded["tcht/AntiqueName.fmg.xml"].content), ...parseFmg(loaded["tcht/AntiqueName_dlc01.fmg.xml"].content)]);
const relicNamesEn = new Map([...parseFmg(loaded["en/AntiqueName.fmg.xml"].content), ...parseFmg(loaded["en/AntiqueName_dlc01.fmg.xml"].content)]);
const effectNamesZh = new Map([...parseFmg(loaded["tcht/AttachEffectName.fmg.xml"].content), ...parseFmg(loaded["tcht/AttachEffectName_dlc01.fmg.xml"].content)]);
const effectNamesEn = new Map([...parseFmg(loaded["en/AttachEffectName.fmg.xml"].content), ...parseFmg(loaded["en/AttachEffectName_dlc01.fmg.xml"].content)]);

const pools = {};
for (const row of tableRows) {
  const poolId = number(row.ID);
  const effectId = number(row.attachEffectId);
  const weight = number(row.chanceWeight, -65536) + 65536;
  if (poolId < 0 || effectId <= 0 || weight <= 0) continue;
  (pools[poolId] ||= []).push({ effectId, weight });
}

const usedEffectIds = new Set(Object.values(pools).flatMap((entries) => entries.map(({ effectId }) => effectId)));
const effects = {};
for (const row of effectRows) {
  const id = number(row.ID);
  if (!usedEffectIds.has(id)) continue;
  const textId = number(row.attachTextId);
  const compatibilityId = number(row.compatibilityId);
  const exclusivityId = number(row.exclusivityId);
  effects[id] = {
    id,
    name: effectNamesZh.get(textId) || effectNamesEn.get(textId) || `未知效果 #${id}`,
    nameEn: effectNamesEn.get(textId) || null,
    textId,
    familyId: compatibilityId > 0 ? compatibilityId : (exclusivityId > 0 ? exclusivityId : null),
    compatibilityId: compatibilityId > 0 ? compatibilityId : null,
    exclusivityId: exclusivityId > 0 ? exclusivityId : null,
    overrideBaseEffectId: number(row.overrideBaseEffectId, id),
    isDebuff: number(row.isDebuff, 0) === 1
  };
}

let droppedPoolEntries = 0;
for (const [poolId, entries] of Object.entries(pools)) {
  const resolved = entries.filter(({ effectId }) => effects[effectId]);
  droppedPoolEntries += entries.length - resolved.length;
  if (resolved.length) pools[poolId] = resolved;
  else delete pools[poolId];
}

const colorNames = { 0: "红色", 1: "蓝色", 2: "黄色", 3: "绿色" };
const templates = equipRows.map((row) => {
  const id = number(row.ID);
  const effectPools = [1, 2, 3].map((slot) => number(row[`attachEffectTableId_${slot}`])).filter((poolId) => poolId > 0);
  const cursePools = [1, 2, 3].map((slot) => number(row[`attachEffectTableId_curse${slot}`])).filter((poolId) => poolId > 0);
  return {
    id,
    name: relicNamesZh.get(id) || relicNamesEn.get(id) || `遗物 #${id}`,
    nameEn: relicNamesEn.get(id) || null,
    color: number(row.relicColor),
    colorName: colorNames[number(row.relicColor)] || `颜色 ${row.relicColor}`,
    isDeep: number(row.isDeepRelic, 0) === 1,
    isSalable: number(row.isSalable, 0) === 1,
    effectPools,
    cursePools,
    slotCount: effectPools.length,
    generation: id >= 200 && id <= 235 ? "1.0.3-dlc" : (id >= 100 && id <= 135 ? "pre-1.0.2" : "other")
  };
}).filter((template) => template.effectPools.length > 0 && template.effectPools.every((poolId) => pools[poolId]));

const result = {
  metadata: {
    schemaVersion: 1,
    label: "Public snapshot (1.0.3 + DLC)",
    status: "community-extracted",
    source: "ip1259/Elden-Ring-Nightreign-Legal-Relic-Generator",
    sourceUrl: "https://github.com/ip1259/Elden-Ring-Nightreign-Legal-Relic-Generator",
    sourceCommit: args.commit || null,
    language: "zh-Hant + en fallback",
    inputChecksums: Object.fromEntries(Object.values(loaded).map((file) => [file.path, file.checksum]))
  },
  stats: {
    templates: templates.length,
    effects: Object.keys(effects).length,
    pools: Object.keys(pools).length,
    poolEntries: Object.values(pools).reduce((sum, entries) => sum + entries.length, 0),
    droppedUnresolvedPoolEntries: droppedPoolEntries
  },
  templates,
  effects,
  pools
};

await mkdir(resolve(output, ".."), { recursive: true });
await writeFile(output, `${JSON.stringify(result)}\n`);
console.log(`Generated ${basename(output)}: ${templates.length} templates, ${Object.keys(effects).length} effects, ${Object.keys(pools).length} pools.`);
