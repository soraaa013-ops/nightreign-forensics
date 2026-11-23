import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  queryMerchants,
  stock,
  stockOptions,
  validMerchantState,
} from "../src/merchant-query.js";
import { merchantEmphasis, pointIcon } from "../src/map-icons.js";
import { matchesSearch } from "../src/search.js";
const data = JSON.parse(fs.readFileSync("data/merchants.json"));
test("all merchant combinations and references are complete within declared variable-stock scope", () => {
  assert.equal(data.patterns.length, 21);
  assert.equal(new Set(data.patterns.map((p) => p.id)).size, 21);
  for (const p of data.patterns) {
    assert.equal(p.normal.length, 11);
    assert.equal(p.large.length, 18);
    assert.equal(p.legendary.length, 4);
    for (const shop of ["normal", "large", "legendary"])
      for (const item of stock(data, p, shop)) {
        assert.ok(item.name);
        if (item.kind !== "consumable") assert.ok(item.skill);
        assert.ok(item.price > 0);
        assert.ok(
          Array.isArray(item.effects.normal) &&
            Array.isArray(item.effects.deep),
        );
        assert.doesNotMatch(
          [
            item.name,
            item.skill,
            ...item.effects.normal,
            ...item.effects.deep,
          ].join(""),
          /[\u3040-\u30ff]|\b(?:HP|FP)\b/,
        );
      }
  }
});
test("every observed item, skill and effect retains its source pattern in both modes", () => {
  for (const mode of ["normal", "deep"])
    for (const pattern of data.patterns)
      for (const shop of ["normal", "large", "legendary"])
        for (const item of stock(data, pattern, shop)) {
          const o = { shop, name: item.name, skill: item.skill };
          for (const effect of [undefined, ...item.effects[mode]])
            assert.ok(
              queryMerchants(data, [{ ...o, effect }], mode).some(
                (p) => p.id === pattern.id,
              ),
            );
        }
});
test("multiple evidence conditions are ANDed within the same item and shop", () => {
  for (const p of data.patterns) {
    const items = stock(data, p, "normal");
    const obs = items.map((i) => ({
      shop: "normal",
      name: i.name,
      skill: i.skill,
    }));
    assert.ok(queryMerchants(data, obs).some((x) => x.id === p.id));
  }
  assert.equal(
    queryMerchants(data, [{ shop: "normal", name: "不存在的商品" }]).length,
    0,
  );
  const p = data.patterns[0],
    a = stock(data, p, "normal")[4],
    b = stock(data, p, "normal")[5];
  assert.ok(
    !queryMerchants(data, [
      { shop: "normal", name: a.name, skill: b.skill },
    ]).some((x) => x.id === p.id),
  );
});
test("options count candidate patterns only once and legendary correspondence is present", () => {
  assert.equal(data.patterns.find((p) => p.id === 3).legendary.length, 4);
  for (const o of stockOptions(data, data.patterns, "normal"))
    assert.equal(
      o.patterns.size,
      queryMerchants(data, [{ shop: "normal", name: o.name }]).length,
    );
  assert.equal(queryMerchants(data, []).length, 21);
});
test("shared state validates untrusted input and merchant names support initials", () => {
  assert.deepEqual(
    validMerchantState(data, {
      mode: "bad",
      observations: [null, {}, { shop: "__proto__", name: "x" }],
    }),
    { mode: "normal", observations: [] },
  );
  assert.ok(matchesSearch("志留亚的树矛", "zlydsm"));
  assert.ok(matchesSearch("夜与火之剑", "yyhzj"));
});
test("merchant emphasis distinguishes big shop, legendary shop and scale-bearing merchant", () => {
  assert.equal(merchantEmphasis("township"), "large");
  assert.equal(merchantEmphasis("star-merchant"), "legendary");
  assert.equal(merchantEmphasis("scale-bearing-merchant"), "");
  assert.equal(merchantEmphasis("unknown"), "");
  const point = { key: "m", category: "Minor Base" };
  assert.equal(
    pointIcon(
      point,
      [{ id: 1, slots: [{ key: "m", value: "商人" }] }],
      { observations: [] },
      { 1: { m: "star-merchant" } },
    ),
    "star-merchant",
  );
  assert.equal(
    pointIcon(
      point,
      [
        { id: 1, slots: [{ key: "m", value: "商人" }] },
        { id: 2, slots: [{ key: "m", value: "教堂" }] },
      ],
      { observations: [] },
      { 1: { m: "star-merchant" }, 2: { m: "church" } },
    ),
    "unknown",
  );
});

test("all source prices, stock slots and passive/curse counts survive import in both modes", () => {
  const raw = JSON.parse(
    fs.readFileSync("data/sources/merchants/catalog.json"),
  );
  for (const source of raw.patterns) {
    const pattern = data.patterns.find((p) => p.id === source.id);
    for (const [shop, field] of [
      ["normal", "normal"],
      ["large", "township"],
    ]) {
      const inventory = stock(data, pattern, shop);
      assert.equal(
        inventory.filter((i) => i.kind === "consumable").length,
        source[field].tears.length + source[field].aromatics.length,
      );
      const weapons = inventory.filter((i) => i.kind === "weapon");
      assert.equal(weapons.length, source[field].items.length);
      source[field].items.forEach((i, index) => {
        for (const [mode, variant] of [
          ["normal", "casual"],
          ["deep", "deepOfNight"],
        ]) {
          assert.equal(weapons[index].prices[mode], i.variants[variant].price);
          assert.equal(
            weapons[index].rarities[mode],
            i.variants[variant].rarity,
          );
          assert.equal(
            weapons[index].effects[mode].length,
            i.variants[variant].passives.length +
              (i.variants[variant].curse ? 1 : 0),
          );
        }
      });
    }
    assert.equal(
      pattern.legendary.length,
      raw.legendarySets.find((s) => s.id === source.legendarySetId).items
        .length,
    );
  }
});
