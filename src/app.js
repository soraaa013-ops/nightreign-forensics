import { inspectRelic, listTemplateEffects } from "./check.js";

const form = document.querySelector("#relic-form");
const templateSelect = document.querySelector("#template");
const inputs = [...form.querySelectorAll('input[name="effect"]')];
const datalist = document.querySelector("#effects");
const report = document.querySelector("#report");
const stamp = document.querySelector("#report-stamp");
const title = document.querySelector("#report-title");
const summary = document.querySelector("#report-summary");
const order = document.querySelector("#report-order");
const rulesetVersion = document.querySelector("#ruleset-version");
let gameData;

const effectValue = (effect) => `${effect.name} · #${effect.id}`;
const parseEffectId = (value) => Number(value.match(/#(\d+)$/)?.[1]);
const currentTemplate = () => gameData.templates.find((template) => template.id === Number(templateSelect.value));

function populateEffects() {
  const template = currentTemplate();
  if (!template) return;
  datalist.replaceChildren(...listTemplateEffects(template, gameData).map((effect) => {
    const option = document.createElement("option");
    option.value = effectValue(effect);
    option.label = effect.nameEn ? `${effect.nameEn} · family ${effect.familyId ?? "—"}` : `ID ${effect.id}`;
    return option;
  }));
  inputs.forEach((input, index) => { input.disabled = index >= template.slotCount; if (input.disabled) input.value = ""; });
}

function render(result) {
  report.className = `report ${result.status}`;
  stamp.textContent = ({ valid: "合法", invalid: "驳回", reorder: "调序", unknown: "待核", incomplete: "缺件" })[result.status];
  title.textContent = result.title;
  summary.textContent = result.summary;
  const probability = document.querySelector("#report-probability");
  if (result.probability > 0) {
    const odds = Math.round(1 / result.probability).toLocaleString("zh-CN");
    probability.textContent = `该模板单次精确出货概率约 ${(result.probability * 100).toPrecision(4)}%（约 1 / ${odds}）`;
    probability.hidden = false;
  } else probability.hidden = true;
  order.replaceChildren();
  if (result.orderedEffectIds?.length) {
    result.orderedEffectIds.forEach((id, index) => {
      const li = document.createElement("li");
      li.textContent = `${String(index + 1).padStart(2, "0")}  ${gameData.effects[id].name}  #${id}`;
      order.append(li);
    });
    order.hidden = false;
  } else order.hidden = true;
  document.querySelector("#report-code").textContent = result.code;
}

function inspect() {
  const template = currentTemplate();
  return inspectRelic({ templateId: template?.id, effectIds: inputs.slice(0, template?.slotCount || 3).map((input) => parseEffectId(input.value)) }, gameData);
}

function updateUrl(result) {
  if (!["valid", "reorder", "invalid"].includes(result.status)) return;
  const params = new URLSearchParams({ template: String(result.templateId), effects: result.effectIds.join(",") });
  history.replaceState(null, "", `${location.pathname}?${params}`);
}

async function init() {
  const response = await fetch("data/game-data.json");
  if (!response.ok) throw new Error(`Ruleset HTTP ${response.status}`);
  gameData = await response.json();
  rulesetVersion.textContent = gameData.metadata.label;
  document.querySelector("#data-stats").textContent = `${gameData.stats.effects} 条效果 · ${gameData.stats.templates} 个模板`;
  const latestGrand = gameData.templates.filter((template) => template.generation === "1.0.3-dlc" && template.slotCount === 3);
  const representatives = latestGrand.filter((template, index, all) => all.findIndex((candidate) => candidate.color === template.color) === index);
  templateSelect.replaceChildren(...representatives.map((template) => {
    const option = document.createElement("option");
    option.value = template.id;
    option.textContent = `${template.colorName} · ${template.name} · ID ${template.id}`;
    return option;
  }));
  templateSelect.addEventListener("change", populateEffects);
  populateEffects();

  const params = new URLSearchParams(location.search);
  const sharedTemplate = Number(params.get("template"));
  const sharedEffects = (params.get("effects") || "").split(",").map(Number).filter(Number.isFinite);
  if (representatives.some((template) => template.id === sharedTemplate) && sharedEffects.length === 3) {
    templateSelect.value = String(sharedTemplate); populateEffects();
    sharedEffects.forEach((id, index) => { if (gameData.effects[id]) inputs[index].value = effectValue(gameData.effects[id]); });
    render(inspect());
  }
}

form.addEventListener("submit", (event) => { event.preventDefault(); const inspection = inspect(); render(inspection); updateUrl(inspection); });
form.addEventListener("reset", () => setTimeout(() => {
  report.className = "report"; stamp.textContent = "待检"; title.textContent = "等待检材";
  summary.textContent = "填入三个词条后，我们再来判断它有没有“出生证明”。"; order.hidden = true;
  document.querySelector("#report-probability").hidden = true;
  document.querySelector("#report-code").textContent = "WAITING_FOR_EVIDENCE"; history.replaceState(null, "", location.pathname);
}, 0));
document.querySelector("#randomize").addEventListener("click", () => {
  const template = currentTemplate(), chosen = [], usedFamilies = new Set();
  template.effectPools.forEach((poolId) => {
    const candidates = gameData.pools[poolId].map(({ effectId }) => gameData.effects[effectId]).filter((effect) => effect && !chosen.includes(effect.id) && (!effect.familyId || !usedFamilies.has(effect.familyId)));
    const effect = candidates[Math.floor(Math.random() * candidates.length)]; chosen.push(effect.id); if (effect.familyId) usedFamilies.add(effect.familyId);
  });
  const ordered = [...chosen].sort((a, b) => (gameData.effects[a].overrideBaseEffectId - gameData.effects[b].overrideBaseEffectId) || a - b);
  ordered.forEach((id, index) => { inputs[index].value = effectValue(gameData.effects[id]); });
  const inspection = inspect(); render(inspection); updateUrl(inspection);
});
document.querySelector("#copy-report").addEventListener("click", async () => {
  await navigator.clipboard.writeText(location.href); document.querySelector("#copy-report").textContent = "链接已复制";
  setTimeout(() => { document.querySelector("#copy-report").textContent = "复制报告链接"; }, 1500);
});

init().catch((error) => { rulesetVersion.textContent = "加载失败"; render({ status: "unknown", code: "RULESET_LOAD_FAILED", title: "规则档案未能载入", summary: error.message }); });
