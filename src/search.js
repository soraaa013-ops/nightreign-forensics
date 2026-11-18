const aliases = [
  ["血量", "生命值", "hp"],
  ["专注值", "蓝量", "fp"],
  ["绝招", "绝活", "大招"],
  ["技艺", "技能"],
  ["减伤率", "减伤"],
  ["出血", "流血"],
  ["冻伤", "冰冻"],
  ["卢恩", "魂"],
  ["追踪者", "追迹者", "追蹤者"],
  ["铁之眼", "弓手", "铁眼"],
  ["无赖", "铁罐"],
];
export function normalizeSearch(value) {
  let text = String(value).normalize("NFKC").toLowerCase();
  for (const group of aliases) {
    const pattern = new RegExp(
      [...group].sort((a, b) => b.length - a.length).join("|"),
      "g",
    );
    text = text.replace(pattern, group[0]);
  }
  return text.replace(/[\s\p{P}]/gu, "");
}
export function matchesSearch(text, query) {
  const target = normalizeSearch(text);
  return query
    .replaceAll("回血", "恢复 血量")
    .replaceAll("回蓝", "恢复 专注值")
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .every((token) => target.includes(normalizeSearch(token)));
}
export function effectCategories(effect) {
  const name = effect.name,
    categories = [];
  if (name.includes("【")) categories.push("角色专属");
  if (/出击/.test(name)) categories.push("出击配置");
  if (/恢复|血量|专注值/.test(name)) categories.push("恢复与续航");
  if (/攻击|伤害|强化|魔法|祷告/.test(name)) categories.push("攻击与强化");
  if (/抵抗|减伤|防御/.test(name)) categories.push("防御与抗性");
  if (
    !categories.length ||
    /力气|灵巧|信仰|感应|集中力|生命力|智力|精力|卢恩/.test(name)
  )
    categories.push("能力与其他");
  return categories;
}
export function searchEffects(
  effects,
  { query = "", category = "", character = "" } = {},
) {
  return effects.filter(
    (effect) =>
      (!category || effectCategories(effect).includes(category)) &&
      (!character || effect.name.includes(`【${character}】`)) &&
      matchesSearch(`${effect.name} ${effect.id}`, query),
  );
}
