const TYPES = {
  Camp: "encampment",
  小营地: "smallcamp",
  "Small Camp": "smallcamp",
  Ruins: "ruins",
  Fort: "fort",
  "Great Church": "temple",
  Church: "church",
  教堂: "church",
  普通教堂: "church",
  "Sorcerer's Rise": "sorcerers-rise",
  "Difficult Sorcerer's Rise": "rare-sorcerers-rise",
  Township: "township",
  "Map Event": "mark",
  主城: "castle",
  城寨: "city1",
  大教堂: "temple",
  遗迹: "ruins",
  洞窟: "cave",
  村落: "village",
  魔法师塔: "sorcerers-rise",
  鳞片商人: "scale-bearing-merchant",
};
export function typeIcon(value) {
  return TYPES[value?.split(" - ")[0]] || null;
}
export function pointIcon(point, records, state, facts) {
  if (point.spawn) return "spawn";
  if (point.tower) return "tower";
  if (point.category === "Castle") return "castle";
  if (point.category === "Evergaol") return "evergaol";
  const marked = state.observations.find((o) => o.key === point.key);
  // A building observation is enough to identify its icon; its boss may still vary.
  if (marked && typeIcon(marked.value)) return typeIcon(marked.value);
  let common;
  for (const record of records) {
    const slot = record.slots.find((s) => s.key === point.key);
    if (!slot?.value) return "unknown";
    const icon =
      facts[String(record.id)]?.[point.key] ||
      typeIcon(slot.value) ||
      "unknown";
    if (icon === "unknown" || (common && common !== icon)) return "unknown";
    common = icon;
  }
  return common || "unknown";
}
export function iconPath(icon) {
  return icon && icon !== "unknown" ? `assets/map-icons/ui/${icon}.webp` : null;
}

// Accessible names are not rendered as map text or hover tooltips.
export function iconLabel(icon) {
  return (
    {
      spawn: "出生点",
      encampment: "营地",
      smallcamp: "小营地",
      ruins: "遗迹",
      fort: "要塞",
      temple: "大教堂",
      church: "教堂",
      castle: "城堡",
      cave: "洞窟",
      township: "城镇",
      village: "村落",
      city1: "城寨",
      city2: "城寨",
      tower: "神授塔",
      evergaol: "封印监牢",
      boss: "白名首领",
      "danger-boss": "红名首领",
      "sorcerers-rise": "魔法师塔",
      "rare-sorcerers-rise": "魔法师塔",
      cart: "车队",
      cabin: "小屋",
      mark: "特殊事件",
      "scale-bearing-merchant": "鳞片商人",
      "star-merchant": "商人",
    }[icon] || "记录点位"
  );
}
