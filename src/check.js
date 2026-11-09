function result(status, code, title, summary, context = {}) {
  return { status, code, title, summary, ...context };
}

function permutations(values) {
  if (values.length <= 1) return [values];
  return values.flatMap((value, index) => permutations(values.filter((_, other) => other !== index)).map((rest) => [value, ...rest]));
}

function canonicalOrder(effectIds, effects) {
  return [...effectIds].sort((left, right) => {
    const a = effects[left], b = effects[right];
    return (a.overrideBaseEffectId - b.overrideBaseEffectId) || (a.id - b.id);
  });
}

export function calculateExactRelicProbability(effectIds, template, gameData) {
  if (effectIds.length !== template.effectPools.length) return 0;
  let totalProbability = 0;
  for (const candidate of permutations(effectIds.map(Number))) {
    const usedIds = new Set(), usedFamilies = new Set();
    let branchProbability = 1;
    for (let slot = 0; slot < candidate.length; slot += 1) {
      const entries = gameData.pools[template.effectPools[slot]] || [];
      const eligible = entries.filter(({ effectId }) => {
        const effect = gameData.effects[effectId];
        return effect && !usedIds.has(effectId) && (!effect.familyId || !usedFamilies.has(effect.familyId));
      });
      const denominator = eligible.reduce((sum, entry) => sum + entry.weight, 0);
      const selected = eligible.find(({ effectId }) => effectId === candidate[slot]);
      if (!selected || !denominator) { branchProbability = 0; break; }
      branchProbability *= selected.weight / denominator;
      usedIds.add(selected.effectId);
      const familyId = gameData.effects[selected.effectId].familyId;
      if (familyId) usedFamilies.add(familyId);
    }
    totalProbability += branchProbability;
  }
  return totalProbability;
}

export function inspectRelic({ templateId, effectIds }, gameData) {
  const ruleset = gameData?.metadata?.label || "unknown";
  const template = gameData?.templates?.find((candidate) => candidate.id === Number(templateId));
  if (!template) return result("unknown", "TEMPLATE_NOT_FOUND", "未找到遗物模板", "当前规则包中没有这个遗物模板。", { templateId, effectIds, ruleset });
  if (!Array.isArray(effectIds) || effectIds.length !== template.slotCount || effectIds.some((id) => !Number.isInteger(Number(id)))) {
    return result("incomplete", "EFFECT_COUNT_MISMATCH", "检材不完整", `该模板需要 ${template.slotCount} 条正面词条。`, { templateId: template.id, effectIds, ruleset });
  }

  const normalizedIds = effectIds.map(Number);
  const effects = gameData.effects;
  const missing = normalizedIds.filter((id) => !effects[id]);
  if (missing.length) return result("unknown", "EFFECT_NOT_FOUND", "发现未收录词条", `规则包中找不到效果 ID：${missing.join("、")}。`, { templateId: template.id, effectIds: normalizedIds, ruleset });
  if (new Set(normalizedIds).size !== normalizedIds.length) {
    return result("invalid", "DUPLICATE_EFFECT", "重复取样，无效", "同一个效果不能在一件遗物上重复出现。", { templateId: template.id, effectIds: normalizedIds, ruleset });
  }

  const families = new Map();
  for (const id of normalizedIds) {
    const familyId = effects[id].familyId;
    if (!familyId) continue;
    if (families.has(familyId)) {
      const first = effects[families.get(familyId)].name;
      return result("invalid", "DUPLICATE_EFFECT_FAMILY", "同族词条冲突", `“${first}”与“${effects[id].name}”属于同一互斥组 #${familyId}，不能共存。`, { templateId: template.id, effectIds: normalizedIds, ruleset });
    }
    families.set(familyId, id);
  }

  const poolSets = template.effectPools.map((poolId) => new Set((gameData.pools[poolId] || []).map(({ effectId }) => effectId)));
  const hiddenOrder = permutations(normalizedIds).find((candidate) => candidate.every((id, index) => poolSets[index]?.has(id)));
  if (!hiddenOrder) {
    return result("invalid", "EFFECT_NOT_IN_TEMPLATE_POOL", "该模板抽不出来", "这些词条无法同时匹配该遗物模板的三个隐藏抽取槽位。", { templateId: template.id, effectIds: normalizedIds, ruleset });
  }

  const orderedEffectIds = canonicalOrder(normalizedIds, effects);
  const probability = calculateExactRelicProbability(normalizedIds, template, gameData);
  const context = { templateId: template.id, effectIds: normalizedIds, hiddenEffectIds: hiddenOrder, orderedEffectIds, probability, ruleset };
  if (orderedEffectIds.some((id, index) => id !== normalizedIds[index])) {
    return result("reorder", "DISPLAY_ORDER_MISMATCH", "组合合法，显示顺序需调整", "词条能由该模板正常生成；游戏中的标准显示顺序如下。", context);
  }
  return result("valid", "VERIFIED", "鉴定通过，准予放行", "词条池、隐藏槽位与互斥组检查均通过。", context);
}

export function listTemplateEffects(template, gameData) {
  const ids = new Set(template.effectPools.flatMap((poolId) => (gameData.pools[poolId] || []).map(({ effectId }) => effectId)));
  return [...ids].map((id) => gameData.effects[id]).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, "zh"));
}
