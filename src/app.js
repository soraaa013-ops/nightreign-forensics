import { inspectRelic, listTemplateEffects } from "./check.js";
import { loadJson, localizeRelics } from "./locale.js";
import { createEffectSearch } from "./effect-search.js";

const form = document.querySelector("#relic-form");
const templateSelect = document.querySelector("#template");
const inputs = [...form.querySelectorAll('input[name="effect"]')];
const report = document.querySelector("#report");
const stamp = document.querySelector("#report-stamp");
const title = document.querySelector("#report-title");
const summary = document.querySelector("#report-summary");
const order = document.querySelector("#report-order");
const rulesetVersion = document.querySelector("#ruleset-version");
const copyButton = document.querySelector("#copy-report");
const feedback = document.querySelector("#action-status");
const retry = document.querySelector("#retry");
let gameData,
  availableEffects = [];
const effectValue = (effect) => `${effect.name} · #${effect.id}`;
const currentTemplate = () =>
  gameData?.templates.find(
    (template) => template.id === Number(templateSelect.value),
  );
const searches = inputs.map((input, index) =>
  createEffectSearch(input, index, () => availableEffects, markDirty),
);
const formError = document.querySelector("#form-error");
const previews = inputs.map((input, index) => {
  const preview = document.createElement("small");
  preview.id = `effect-preview-${index}`;
  preview.className = "input-help";
  preview.hidden = true;
  input.parentElement.append(preview);
  return preview;
});
function syncPreviews() {
  inputs.forEach((input, index) => {
    const id = input.value.match(/#(\d+)$/)?.[1];
    const effect = gameData?.effects[id];
    previews[index].textContent = effect?.name || "";
    previews[index].hidden = !effect;
  });
}
const codeLabels = {
  VERIFIED: "核验通过",
  DUPLICATE_EFFECT: "词条重复",
  DUPLICATE_EFFECT_FAMILY: "互斥冲突",
  EFFECT_NOT_IN_TEMPLATE_POOL: "词条池不匹配",
  DISPLAY_ORDER_MISMATCH: "需要调序",
  EFFECT_NOT_FOUND: "词条未收录",
  EFFECT_COUNT_MISMATCH: "词条未填全",
  TEMPLATE_NOT_FOUND: "模板未收录",
  RULESET_LOAD_FAILED: "规则加载失败",
};
function setLoading(loading) {
  form.setAttribute("aria-busy", String(loading));
  form.querySelectorAll("button, input, select").forEach((element) => {
    element.disabled = loading;
  });
  copyButton.disabled = true;
}
function populateEffects() {
  availableEffects = listTemplateEffects(currentTemplate(), gameData);
  searches.forEach((search) => search.close());
  inputs.forEach((input) => input.setCustomValidity(""));
}
function waiting(
  message = "选择三条词条后签发报告，也可以先随机装填一组示例。",
) {
  report.className = "report";
  stamp.textContent = "待检";
  title.textContent = "等待检材";
  summary.textContent = message;
  order.hidden = true;
  document.querySelector("#report-probability").hidden = true;
  document.querySelector("#report-code").textContent = "等待检材";
  copyButton.disabled = true;
}
function markDirty() {
  syncPreviews();
  formError.textContent = "";
  waiting("输入已更新，请重新签发检测报告。");
  feedback.replaceChildren();
  history.replaceState(null, "", location.pathname);
}
function render(result) {
  report.className = `report ${result.status}`;
  stamp.textContent = {
    valid: "合法",
    invalid: "驳回",
    reorder: "调序",
    unknown: "待核",
    incomplete: "缺件",
  }[result.status];
  title.textContent = result.title;
  summary.textContent = result.summary;
  const probability = document.querySelector("#report-probability");
  probability.hidden = !(result.probability > 0);
  if (!probability.hidden)
    probability.textContent = `该模板单次精确出货概率约 ${(result.probability * 100).toPrecision(4)}%（约 ${Math.round(1 / result.probability).toLocaleString("zh-CN")} 次中出现 1 次）`;
  order.replaceChildren();
  for (const id of result.orderedEffectIds || []) {
    const li = document.createElement("li");
    li.textContent = effectValue(gameData.effects[id]);
    order.append(li);
  }
  order.hidden = !order.children.length;
  document.querySelector("#report-code").textContent =
    codeLabels[result.code] || "等待核验";
  copyButton.disabled = !["valid", "reorder", "invalid"].includes(
    result.status,
  );
}
function inspect() {
  return inspectRelic(
    {
      templateId: currentTemplate()?.id,
      effectIds: inputs.map((input) =>
        Number(input.value.match(/#(\d+)$/)?.[1]),
      ),
    },
    gameData,
  );
}
function submitReport() {
  syncPreviews();
  formError.textContent = "";
  searches.forEach((search) => search.close());
  const result = inspect();
  render(result);
  if (!copyButton.disabled) {
    const params = new URLSearchParams({
      template: String(result.templateId),
      effects: result.effectIds.join(","),
    });
    history.replaceState(null, "", `${location.pathname}?${params}`);
  }
}
async function init() {
  setLoading(true);
  retry.hidden = true;
  try {
    const [raw, dictionary] = await Promise.all([
      loadJson("data/game-data.json"),
      loadJson("data/zh-CN.json"),
    ]);
    gameData = localizeRelics(raw, dictionary);
    rulesetVersion.textContent = gameData.metadata.label;
    document.querySelector("#data-stats").textContent =
      `${gameData.stats.effects} 条效果 · 本地检测`;
    const latestGrand = gameData.templates.filter(
      (template) =>
        template.generation === "1.0.3-dlc" && template.slotCount === 3,
    );
    const representatives = latestGrand.filter(
      (template, index, all) =>
        all.findIndex((candidate) => candidate.color === template.color) ===
        index,
    );
    templateSelect.replaceChildren(
      ...representatives.map(
        (template) =>
          new Option(`${template.colorName} · ${template.name}`, template.id),
      ),
    );
    populateEffects();
    setLoading(false);
    const params = new URLSearchParams(location.search);
    if (params.has("template") || params.has("effects")) {
      const sharedTemplate = Number(params.get("template"));
      const ids = (params.get("effects") || "").split(",");
      if (
        representatives.some((template) => template.id === sharedTemplate) &&
        ids.length === 3 &&
        ids.every((id) => /^\d+$/.test(id) && gameData.effects[id])
      ) {
        templateSelect.value = String(sharedTemplate);
        populateEffects();
        ids.forEach((id, index) => {
          inputs[index].value = effectValue(gameData.effects[id]);
        });
        submitReport();
      } else
        feedback.textContent =
          "报告链接不完整或不受当前规则支持，请重新选择模板与词条。";
    }
  } catch {
    document.querySelector("#data-stats").textContent = "数据未就绪";
    rulesetVersion.textContent = "加载失败";
    form.setAttribute("aria-busy", "false");
    render({
      status: "unknown",
      code: "RULESET_LOAD_FAILED",
      title: "规则档案未能载入",
      summary: "请检查网络连接后点击“重新加载规则”。",
    });
    retry.hidden = false;
  }
}
templateSelect.addEventListener("change", () => {
  populateEffects();
  markDirty();
});
inputs.forEach((input) => input.addEventListener("input", markDirty));
form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!gameData) return;
  for (const input of inputs) {
    const exact = availableEffects.filter(
      (effect) => effect.name === input.value.trim(),
    );
    if (exact.length === 1) input.value = effectValue(exact[0]);
    if (!/^.+ · #\d+$/.test(input.value)) {
      input.setCustomValidity("请从搜索候选中选择完整词条。");
      formError.textContent = "请从搜索候选中选择完整词条，再签发报告。";
      input.reportValidity();
      return;
    }
  }
  submitReport();
});
form.addEventListener("reset", () =>
  setTimeout(() => {
    if (!gameData) return;
    populateEffects();
    syncPreviews();
    formError.textContent = "";
    waiting();
    feedback.replaceChildren();
    history.replaceState(null, "", location.pathname);
    inputs[0].focus();
  }, 0),
);
document.querySelector("#randomize").addEventListener("click", () => {
  if (!gameData) return;
  const chosen = [],
    usedFamilies = new Set();
  for (const poolId of currentTemplate().effectPools) {
    const candidates = gameData.pools[poolId]
      .map(({ effectId }) => gameData.effects[effectId])
      .filter(
        (effect) =>
          effect &&
          !chosen.includes(effect.id) &&
          (!effect.familyId || !usedFamilies.has(effect.familyId)),
      );
    const effect = candidates[Math.floor(Math.random() * candidates.length)];
    if (!effect) {
      feedback.textContent = "此模板暂时无法生成示例，请手动选择词条。";
      return;
    }
    chosen.push(effect.id);
    if (effect.familyId) usedFamilies.add(effect.familyId);
  }
  chosen.sort(
    (a, b) =>
      gameData.effects[a].overrideBaseEffectId -
        gameData.effects[b].overrideBaseEffectId || a - b,
  );
  chosen.forEach((id, index) => {
    inputs[index].value = effectValue(gameData.effects[id]);
    inputs[index].setCustomValidity("");
  });
  feedback.textContent =
    "已填入一组合法示例。随机装填用于演示，不模拟游戏抽取权重。";
  submitReport();
});
copyButton.addEventListener("click", async () => {
  const url = location.href;
  try {
    await navigator.clipboard.writeText(url);
    feedback.textContent = "报告链接已复制，可以发送给队友。";
  } catch {
    feedback.textContent = "浏览器未允许自动复制，请手动复制下方链接。";
    const field = document.createElement("input");
    field.readOnly = true;
    field.value = url;
    field.className = "share-link";
    field.setAttribute("aria-label", "报告链接");
    feedback.append(field);
    field.focus();
    field.select();
  }
});
retry.addEventListener("click", init);
init();
