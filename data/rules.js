export const ruleset = {
  version: "DEMO-2026.11",
  status: "demo",
  effects: [
    { id: "hp-up", name: "最大生命值提升", pool: "survival", order: 10 },
    { id: "stamina-up", name: "最大精力提升", pool: "survival", order: 11 },
    { id: "physical-up", name: "物理攻击力提升", pool: "offense", order: 20 },
    { id: "magic-up", name: "魔力属性攻击力提升＋4", pool: "magic-boost", order: 21 },
    { id: "magic-enhance", name: "强化魔法＋2", pool: "magic-boost", order: 22 },
    { id: "fire-up", name: "火属性攻击力提升", pool: "element", order: 30 },
    { id: "frost-up", name: "冻伤状态异常累积量提升", pool: "ailment", order: 40 },
    { id: "skill-cd", name: "技能冷却时间缩短", pool: "utility", order: 50 },
    { id: "item-find", name: "道具发现力提升", pool: "utility", order: 60 }
  ],
  incompatiblePools: ["magic-boost"],
  notes: {
    "magic-boost": "两条词条来自同一互斥属性池，不能在同一遗物上共存。"
  }
};
