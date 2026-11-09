import test from "node:test";
import assert from "node:assert/strict";
import { ruleset } from "../data/rules.js";
import { inspectRelic } from "../src/check.js";

test("rejects effects from an incompatible pool", () => {
  const result = inspectRelic(["魔力属性攻击力提升＋4", "强化魔法＋2", "技能冷却时间缩短"], ruleset);
  assert.equal(result.status, "invalid");
});

test("returns the canonical order", () => {
  const result = inspectRelic(["技能冷却时间缩短", "最大生命值提升", "火属性攻击力提升"], ruleset);
  assert.equal(result.status, "reorder");
  assert.deepEqual(result.order, ["最大生命值提升", "火属性攻击力提升", "技能冷却时间缩短"]);
});

test("accepts a legal combination in canonical order", () => {
  const result = inspectRelic(["最大生命值提升", "物理攻击力提升", "技能冷却时间缩短"], ruleset);
  assert.equal(result.status, "valid");
});
