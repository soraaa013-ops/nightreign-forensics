export const SHOPS = {
  normal: "普通商店",
  large: "大商店",
  legendary: "传奇商店",
};
export function stock(data, pattern, shop) {
  return (pattern[shop] || []).map((id) => data.items[id]);
}
export function matchesObservation(item, observation, mode) {
  return (
    item.name === observation.name &&
    (!observation.skill || item.skill === observation.skill) &&
    (!observation.effect || item.effects[mode].includes(observation.effect))
  );
}
export function queryMerchants(data, observations, mode = "deep") {
  return data.patterns.filter((pattern) =>
    observations.every((observation) =>
      stock(data, pattern, observation.shop).some((item) =>
        matchesObservation(item, observation, mode),
      ),
    ),
  );
}
export function validMerchantState(data, input) {
  const mode = input?.mode === "normal" ? "normal" : "deep";
  const observations = (
    Array.isArray(input?.observations) ? input.observations : []
  )
    .slice(0, 30)
    .filter(
      (o) =>
        o &&
        Object.hasOwn(SHOPS, o.shop) &&
        typeof o.name === "string" &&
        Object.values(data.items).some((i) => matchesObservation(i, o, mode)),
    )
    .map((o) => ({
      shop: o.shop,
      name: o.name,
      ...(o.skill ? { skill: o.skill } : {}),
      ...(o.effect ? { effect: o.effect } : {}),
    }));
  return { mode, observations };
}
export function stockOptions(data, patterns, shop) {
  const options = new Map();
  for (const pattern of patterns) {
    for (const item of stock(data, pattern, shop)) {
      if (!options.has(item.name))
        options.set(item.name, {
          name: item.name,
          patterns: new Set(),
          items: new Map(),
        });
      const option = options.get(item.name);
      option.patterns.add(pattern.id);
      option.items.set(item.id, item);
    }
  }
  return [...options.values()];
}
