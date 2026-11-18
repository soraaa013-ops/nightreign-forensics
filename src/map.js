import { filterMapRecords, recommendObservation } from "./map-filter.js";
import { loadJson } from "./locale.js";
const form = document.querySelector("#map-form");
const nightlord = document.querySelector("#nightlord");
const mapType = document.querySelector("#map-type");
const spawn = document.querySelector("#spawn");
const observationFields = [...document.querySelectorAll(".observation")];
const candidateCount = document.querySelector("#candidate-count");
const nextClue = document.querySelector("#next-clue");
const candidateSummary = document.querySelector("#candidate-summary");
const resultPanel = document.querySelector("#map-result");
const clueButton = document.querySelector("#use-clue");
const retry = document.querySelector("#retry");
let mapData, dictionary, recommendation;
const zh = (value) => (value ? (dictionary.map[value] ?? value) : "未记录");
function addOptions(select, values, placeholder = "未知 / 全部") {
  select.replaceChildren(
    new Option(placeholder, ""),
    ...values.map((value) => new Option(zh(value), value)),
  );
}
function observations() {
  return observationFields
    .map((field) => ({
      key: field.querySelector(".slot-key").value,
      value: field.querySelector(".slot-value").value,
    }))
    .filter(({ key, value }) => key && value);
}
function refreshValueOptions(field) {
  const key = field.querySelector(".slot-key").value,
    select = field.querySelector(".slot-value");
  // Use the full catalogue so changing a base filter never silently discards evidence.
  const values = [
    ...new Set(
      mapData.records.flatMap((record) =>
        record.slots
          .filter((slot) => slot.key === key)
          .map((slot) => slot.value || "empty"),
      ),
    ),
  ];
  values.sort((a, b) => zh(a).localeCompare(zh(b), "zh-CN"));
  select.replaceChildren(
    new Option(key ? "选择观察结果" : "先选择位置", ""),
    ...values.map(
      (value) => new Option(value === "empty" ? "此处为空" : zh(value), value),
    ),
  );
  select.disabled = !key;
}
function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function renderRecord(record) {
  resultPanel.hidden = false;
  const heading = node("p", "已识别地图布局", "kicker");
  const head = node("div", "", "record-head");
  for (const [label, value] of [
    ["档案编号", `#${record.id}`],
    ["夜王 / 地形", `${zh(record.nightlord)} · ${zh(record.mapType)}`],
    ["出生点", zh(record.spawn)],
  ]) {
    const item = node("div");
    item.append(node("span", label), node("strong", value));
    head.append(item);
  }
  const events = node("div", "", "record-events");
  for (const [label, value] of [
    ["特殊事件", zh(record.specialEvent)],
    ["第一夜", `${zh(record.night1Boss)} · ${zh(record.night1Circle)}`],
    ["第二夜", `${zh(record.night2Boss)} · ${zh(record.night2Circle)}`],
    ...(record.extraNightBoss
      ? [["额外夜晚首领", zh(record.extraNightBoss)]]
      : []),
  ]) {
    const item = node("p");
    item.append(node("b", label), document.createTextNode(value));
    events.append(item);
  }
  const points = node("div", "", "poi-list");
  for (const slot of record.slots.filter((slot) => slot.value)) {
    const item = node("article");
    item.append(
      node("small", `${zh(slot.category)} · ${zh(slot.location)}`),
      node("span", zh(slot.value)),
    );
    points.append(item);
  }
  resultPanel.replaceChildren(heading, head, events, points);
}
function update() {
  const selected = observations();
  const candidates = filterMapRecords(mapData.records, {
    nightlord: nightlord.value,
    mapType: mapType.value,
    spawn: spawn.value,
    observations: selected,
  });
  candidateCount.textContent = candidates.length;
  recommendation = recommendObservation(
    candidates,
    selected.map(({ key }) => key),
  );
  clueButton.hidden =
    !recommendation ||
    !observationFields.some((field) => !field.querySelector(".slot-key").value);
  if (!candidates.length) {
    nextClue.textContent = "没有匹配档案";
    candidateSummary.textContent =
      "所选条件与当前旧档案不匹配。请将不确定的条件改为“未知”，撤销观察，或清空全部条件。";
    resultPanel.hidden = true;
  } else if (candidates.length === 1) {
    nextClue.textContent = `已锁定地图布局 #${candidates[0].id}`;
    candidateSummary.textContent =
      "当前观察唯一命中一份档案。随机事件不一定由地图布局决定；以下为旧档案中的记录。";
    renderRecord(candidates[0]);
  } else {
    nextClue.textContent = recommendation
      ? zh(recommendation.key)
      : "继续补充高置信度观察";
    candidateSummary.textContent = recommendation
      ? `建议观察这里：剩余档案有 ${recommendation.values.length} 种不同结果。候选编号：${candidates
          .slice(0, 12)
          .map((record) => `#${record.id}`)
          .join("、")}${candidates.length > 12 ? "…" : ""}`
      : `仍有 ${candidates.length} 份候选。`;
    resultPanel.hidden = true;
  }
}
form.addEventListener("submit", (event) => event.preventDefault());
form.addEventListener("change", (event) => {
  if (!mapData) return;
  if (event.target.classList.contains("slot-key"))
    refreshValueOptions(event.target.closest(".observation"));
  update();
});
form.addEventListener("reset", () =>
  setTimeout(() => {
    if (!mapData) return;
    observationFields.forEach(refreshValueOptions);
    update();
  }, 0),
);
clueButton.addEventListener("click", () => {
  const field = observationFields.find(
    (field) => !field.querySelector(".slot-key").value,
  );
  if (!field || !recommendation) return;
  field.querySelector(".slot-key").value = recommendation.key;
  refreshValueOptions(field);
  update();
  field.querySelector(".slot-value").focus();
});
async function init() {
  form.querySelectorAll("select, button").forEach((element) => {
    element.disabled = true;
  });
  form.setAttribute("aria-busy", "true");
  retry.hidden = true;
  try {
    [mapData, dictionary] = await Promise.all([
      loadJson("data/map-data.json"),
      loadJson("data/zh-CN.json"),
    ]);
    document.querySelector("#map-version").textContent =
      `基础游戏 · ${mapData.records.length} 份地图布局，未覆盖扩展内容完整数据。`;
    addOptions(nightlord, mapData.facets.nightlords);
    addOptions(mapType, mapData.facets.mapTypes);
    addOptions(spawn, mapData.facets.spawns);
    const keys = [
      ...new Set(
        mapData.records.flatMap((record) =>
          record.slots.map((slot) => slot.key),
        ),
      ),
    ].sort((a, b) => zh(a).localeCompare(zh(b), "zh-CN"));
    form.querySelectorAll("select, button").forEach((element) => {
      element.disabled = false;
    });
    observationFields.forEach((field) => {
      addOptions(field.querySelector(".slot-key"), keys, "尚未标记");
      refreshValueOptions(field);
    });
    update();
  } catch {
    nextClue.textContent = "地图档案加载失败";
    candidateSummary.textContent = "请检查网络连接后点击“重新加载地图”。";
    document.querySelector("#map-version").textContent = "地图数据未就绪";
    retry.hidden = false;
  } finally {
    form.setAttribute("aria-busy", "false");
  }
}
retry.addEventListener("click", init);
init();
