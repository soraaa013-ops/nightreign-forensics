import { filterMapRecords, recommendObservation } from "./map-filter.js";

const nightlord = document.querySelector("#nightlord");
const mapType = document.querySelector("#map-type");
const spawn = document.querySelector("#spawn");
const observationFields = [...document.querySelectorAll(".observation")];
const candidateCount = document.querySelector("#candidate-count");
const nextClue = document.querySelector("#next-clue");
const candidateSummary = document.querySelector("#candidate-summary");
const resultPanel = document.querySelector("#map-result");
let mapData;

function addOptions(select, values) {
  select.append(...values.map((value) => { const option = document.createElement("option"); option.value = value; option.textContent = value; return option; }));
}

function observations() {
  return observationFields.map((field) => ({ key: field.querySelector(".slot-key").value, value: field.querySelector(".slot-value").value })).filter(({ key, value }) => key && value);
}

function baseCandidates() {
  return filterMapRecords(mapData.records, { nightlord: nightlord.value, mapType: mapType.value, spawn: spawn.value });
}

function refreshSlotOptions(candidates) {
  const keys = [...new Map(candidates.flatMap((record) => record.slots).map((slot) => [slot.key, `${slot.category} · ${slot.location}`])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  observationFields.forEach((field) => {
    const keySelect = field.querySelector(".slot-key"), current = keySelect.value;
    keySelect.replaceChildren(new Option("尚未标记", ""), ...keys.map(([key, label]) => new Option(label, key)));
    if (keys.some(([key]) => key === current)) keySelect.value = current;
    refreshValueOptions(field, candidates);
  });
}

function refreshValueOptions(field, candidates) {
  const key = field.querySelector(".slot-key").value, valueSelect = field.querySelector(".slot-value"), current = valueSelect.value;
  const values = [...new Set(candidates.map((record) => record.slots.find((slot) => slot.key === key)?.value || "empty"))].sort();
  valueSelect.replaceChildren(new Option(key ? "选择观察结果" : "先选择位置", ""), ...values.map((value) => new Option(value === "empty" ? "此处为空" : value, value)));
  valueSelect.disabled = !key;
  if (values.includes(current)) valueSelect.value = current;
}

function renderRecord(record) {
  resultPanel.hidden = false;
  const notable = record.slots.filter((slot) => slot.value).slice(0, 24);
  resultPanel.innerHTML = `<p class="kicker">IDENTIFIED PATTERN</p><div class="record-head"><div><span>档案编号</span><strong>#${record.id}</strong></div><div><span>夜王 / 地形</span><strong>${record.nightlord} · ${record.mapType}</strong></div><div><span>出生点</span><strong>${record.spawn}</strong></div></div><div class="record-events"><p><b>特殊事件</b>${record.specialEvent || "未记录"}</p><p><b>第一夜</b>${record.night1Boss} · ${record.night1Circle}</p><p><b>第二夜</b>${record.night2Boss} · ${record.night2Circle}</p></div><div class="poi-list">${notable.map((slot) => `<article><small>${slot.category} · ${slot.location}</small><span>${slot.value}</span></article>`).join("")}</div>`;
}

function update() {
  const base = baseCandidates();
  refreshSlotOptions(base);
  const selected = observations();
  const candidates = filterMapRecords(base, { observations: selected });
  candidateCount.textContent = candidates.length;
  const recommendation = recommendObservation(candidates, selected.map(({ key }) => key));
  if (!candidates.length) {
    nextClue.textContent = "没有匹配档案";
    candidateSummary.textContent = "至少一条观察与档案冲突。请撤销最近一次选择，或检查是否选错相邻位置。";
    resultPanel.hidden = true;
  } else if (candidates.length === 1) {
    nextClue.textContent = `已锁定 Pattern #${candidates[0].id}`;
    candidateSummary.textContent = "当前观察唯一命中一份档案。注意：随机事件不一定由 Pattern 决定。";
    renderRecord(candidates[0]);
  } else {
    nextClue.textContent = recommendation ? recommendation.key.replace(" - ", " · ") : "继续补充高置信度观察";
    candidateSummary.textContent = recommendation ? `这里在剩余档案中有 ${recommendation.values.length} 种不同结果，区分度最高。候选：${candidates.slice(0, 12).map((record) => `#${record.id}`).join("、")}${candidates.length > 12 ? "…" : ""}` : `仍有 ${candidates.length} 份候选。`;
    resultPanel.hidden = true;
  }
}

async function init() {
  const response = await fetch("data/map-data.json");
  mapData = await response.json();
  document.querySelector("#map-version").textContent = `${mapData.metadata.label} · ${mapData.records.length} 份记录`;
  addOptions(nightlord, mapData.facets.nightlords); addOptions(mapType, mapData.facets.mapTypes); addOptions(spawn, mapData.facets.spawns);
  document.querySelector("#map-form").addEventListener("change", (event) => {
    if (event.target.classList.contains("slot-key")) refreshValueOptions(event.target.closest(".observation"), baseCandidates());
    update();
  });
  update();
}

init().catch((error) => { nextClue.textContent = "地图档案加载失败"; candidateSummary.textContent = error.message; });
