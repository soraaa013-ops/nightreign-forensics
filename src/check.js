export function inspectRelic(selectedNames, ruleset) {
  if (selectedNames.length !== 3 || selectedNames.some((name) => !name.trim())) {
    return { status: "incomplete", title: "检材不完整", summary: "需要提交三个词条才能签发报告。" };
  }

  const effects = selectedNames.map((name) => ruleset.effects.find((effect) => effect.name === name.trim()));
  if (effects.some((effect) => !effect)) {
    return { status: "unknown", title: "发现未收录词条", summary: "至少一个词条不在当前规则集中，请从候选列表中选择。" };
  }
  if (new Set(effects.map((effect) => effect.id)).size !== effects.length) {
    return { status: "invalid", title: "重复取样，无效", summary: "同一词条不能重复出现，请重新提交检材。" };
  }

  const poolCounts = effects.reduce((counts, effect) => {
    counts[effect.pool] = (counts[effect.pool] || 0) + 1;
    return counts;
  }, {});
  const conflict = ruleset.incompatiblePools.find((pool) => poolCounts[pool] > 1);
  if (conflict) {
    return { status: "invalid", title: "出生证明不予签发", summary: ruleset.notes[conflict] || "词条组合触发互斥规则。" };
  }

  const ordered = [...effects].sort((a, b) => a.order - b.order);
  const orderChanged = ordered.some((effect, index) => effect.id !== effects[index].id);
  if (orderChanged) {
    return { status: "reorder", title: "组合合法，顺序可疑", summary: "三条词条可以共存，但合法排列应调整为：", order: ordered.map((effect) => effect.name) };
  }
  return { status: "valid", title: "鉴定通过，准予放行", summary: "当前规则集中未发现互斥或顺序问题。", order: ordered.map((effect) => effect.name) };
}
