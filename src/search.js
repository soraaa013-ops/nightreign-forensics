import { initials } from "./search-initials.js?v=merchant-1";

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
const aliasPatterns = aliases.map((group) => [
  new RegExp([...group].sort((a, b) => b.length - a.length).join("|"), "g"),
  group[0],
]);
export function normalizeSearch(value) {
  let text = String(value).normalize("NFKC").toLowerCase();
  for (const [pattern, replacement] of aliasPatterns) {
    text = text.replace(pattern, replacement);
  }
  return text.replace(/[\s\p{P}]/gu, "");
}
// Keep derived search keys across keystrokes; cap retained entries.
const searchCache = new Map();
function searchKeys(text) {
  if (searchCache.has(text)) return searchCache.get(text);
  const normalized = normalizeSearch(text);
  let expanded = String(text).normalize("NFKC").toLowerCase();
  for (const group of aliases) {
    if (normalized.includes(group[0])) expanded += " " + group.join(" ");
  }
  const keys = {
    normalized,
    letters: [...expanded.replace(/[\s\p{P}]/gu, "")].map(
      (c) => initials[c] || c,
    ),
  };
  if (searchCache.size >= 2048) searchCache.clear();
  searchCache.set(text, keys);
  return keys;
}
function matchesInitials(letters, token) {
  if (!/^[a-z]{2,}$/i.test(token)) return false;
  for (let start = 0; start <= letters.length - token.length; start++) {
    if ([...token].every((c, i) => letters[start + i].includes(c))) return true;
  }
  return false;
}
function matchesChineseFragment(target, token) {
  if (!/^[\p{Script=Han}]{3,}$/u.test(token)) return false;
  let position = 0;
  for (const char of token) {
    const found = target.indexOf(char, position);
    if (found < 0) return false;
    position = found + char.length;
  }
  return true;
}
export function matchesSearch(text, query) {
  if (!String(query).trim()) return true;
  const keys = searchKeys(text);
  return String(query)
    .replace(
      /(追踪者|追迹者|守护者|铁之眼|女爵|无赖|复仇者|隐士|执行者|学者|送葬者|大招|绝招|技艺|战技)/g,
      " $1 ",
    )
    .replaceAll("回血", "恢复 血量")
    .replaceAll("回蓝", "恢复 专注值")
    .normalize("NFKC")
    .trim()
    .split(/[\s，,、；;]+/u)
    .filter(Boolean)
    .every((token) => {
      const normalized = normalizeSearch(token);
      return (
        keys.normalized.includes(normalized) ||
        matchesInitials(keys.letters, token.toLowerCase()) ||
        matchesChineseFragment(keys.normalized, normalized)
      );
    });
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
