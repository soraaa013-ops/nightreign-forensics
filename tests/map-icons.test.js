import { createHash } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { pointIcon, typeIcon, iconPath } from "../src/map-icons.js";
const facts = JSON.parse(fs.readFileSync("data/map-icons.json")).records;
const p = { key: "site", category: "Major Base" },
  state = { observations: [] };
const records = [
  { id: 1, slots: [{ key: "site", value: "Ruins - A" }] },
  { id: 2, slots: [{ key: "site", value: "Ruins - B" }] },
];
test("building icon resolves before its boss, with no guessed candidate type", () => {
  assert.equal(pointIcon(p, records, state, {}), "ruins");
  assert.equal(
    pointIcon(
      p,
      [records[0], { id: 2, slots: [{ key: "site", value: "Camp - A" }] }],
      state,
      {},
    ),
    "unknown",
  );
  assert.equal(
    pointIcon(
      p,
      [],
      { observations: [{ key: "site", value: "Camp", match: "type" }] },
      {},
    ),
    "encampment",
  );
  assert.equal(typeIcon("Difficult Sorcerer's Rise"), "rare-sorcerers-rise");
});
test("boss red/white is record-specific; uncertain difficulty stays neutral", () => {
  const p = { key: "site", category: "Field Boss" };
  assert.equal(
    pointIcon(p, records, state, {
      1: { site: "boss" },
      2: { site: "danger-boss" },
    }),
    "unknown",
  );
  assert.equal(
    pointIcon(p, [records[0]], state, { 1: { site: "danger-boss" } }),
    "danger-boss",
  );
  assert.equal(
    pointIcon(p, [records[0]], state, { 1: { site: "boss" } }),
    "boss",
  );
  assert.equal(pointIcon({ ...p, tower: true }, records, state, {}), "tower");
});
test("all imported icon facts and original assets exist, with both boss variants", () => {
  assert.equal(Object.keys(facts).length, 520);
  const icons = new Set(Object.values(facts).flatMap((r) => Object.values(r)));
  for (const icon of icons)
    if (icon !== "unknown") assert.ok(fs.existsSync(iconPath(icon)), icon);
  assert.ok(icons.has("boss") && icons.has("danger-boss"));
  const manifest = JSON.parse(
    fs.readFileSync("assets/map-icons/provenance.json"),
  );
  for (const m of manifest)
    assert.equal(
      createHash("sha256")
        .update(fs.readFileSync(`assets/map-icons/${m.file}`))
        .digest("hex"),
      m.sha256,
    );
  assert.ok(manifest.every((m) => fs.existsSync(`assets/map-icons/${m.file}`)));
});
