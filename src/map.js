import { recommendObservation } from "./map-filter.js";
import { queryMaps, matchesObservation, facetCounts } from "./map-query.js";
import { matchesSearch } from "./search.js";
import { loadJson } from "./locale.js";
const $ = (selector) => document.querySelector(selector);
const form = $("#map-form"),
  nightlord = $("#nightlord"),
  mapType = $("#map-type"),
  spawn = $("#spawn");
const candidateCount = $("#candidate-count"),
  nextClue = $("#next-clue"),
  candidateSummary = $("#candidate-summary"),
  resultPanel = $("#map-result"),
  clueButton = $("#use-clue"),
  retry = $("#retry");
const clueSearch = $("#clue-search"),
  clueCategory = $("#clue-category"),
  clueLocation = $("#clue-location");
let mapData,
  dictionary,
  recommendation,
  selected = [],
  candidates = [],
  clueLimit = 6,
  candidateLimit = 6,
  previewId = null;
const zh = (value) => (value ? (dictionary.map[value] ?? value) : "未记录");
const state = () => ({
  nightlord: nightlord.value,
  mapType: mapType.value,
  spawn: spawn.value,
  observations: selected,
});
function button(text, action, className = "secondary") {
  const b = node("button", text, className);
  b.type = "button";
  b.addEventListener("click", action);
  return b;
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
function refreshLocations() {
  const current = clueLocation.value;
  const slots = mapData.records
    .flatMap((record) => record.slots)
    .filter(
      (slot) => !clueCategory.value || slot.category === clueCategory.value,
    );
  const keys = [...new Set(slots.map((slot) => slot.key))].sort((a, b) =>
    zh(a).localeCompare(zh(b), "zh-CN"),
  );
  clueLocation.replaceChildren(
    new Option("不知道位置", ""),
    ...keys.map((key) => new Option(zh(key), key)),
  );
  if (keys.includes(current)) clueLocation.value = current;
}
function renderClues() {
  const category = clueCategory.value,
    key = clueLocation.value;
  const all = new Set(
    mapData.records.flatMap((record) =>
      record.slots
        .filter(
          (slot) =>
            (!category || slot.category === category) &&
            (!key || slot.key === key),
        )
        .map((slot) => slot.value || "empty"),
    ),
  );
  // An empty location is only meaningful after choosing an exact position.
  if (!key) all.delete("empty");
  const options = [...all]
    .filter((value) =>
      matchesSearch(
        value === "empty" ? "此处为空" : zh(value),
        clueSearch.value,
      ),
    )
    .map((value) => ({
      value,
      count: candidates.filter((record) =>
        matchesObservation(record, { key, category, value }),
      ).length,
    }));
  options.sort(
    (a, b) =>
      b.count - a.count || zh(a.value).localeCompare(zh(b.value), "zh-CN"),
  );
  $("#clue-count").textContent =
    `${options.length} 种观察结果 · 数字表示添加后剩余地图数`;
  $("#clue-results").replaceChildren(
    ...options.slice(0, clueLimit).map(({ value, count }) => {
      const exists = selected.some(
        (item) =>
          item.key === key &&
          item.category === category &&
          item.value === value,
      );
      const b = button(
        "",
        () => {
          selected.push({ key, category, value });
          clueSearch.value = "";
          clueCategory.value = "";
          clueLocation.value = "";
          refreshLocations();
          clueLimit = 6;
          update();
        },
        "clue-option",
      );
      b.append(
        node("span", value === "empty" ? "此处为空" : zh(value)),
        node("small", exists ? "已添加" : `${count} 份地图`),
      );
      b.disabled = exists || count === 0;
      b.title = count === 0 ? "与当前条件不匹配，请先移除不确定的条件" : "";
      return b;
    }),
  );
  if (!options.length)
    $("#clue-results").append(
      node(
        "p",
        "没有找到。请换个关键词，或将地点类型、具体位置设为不限。",
        "empty-state",
      ),
    );
  $("#more-clues").hidden = options.length <= clueLimit;
}
function renderChips() {
  const chips = [];
  for (const [select, label] of [
    [nightlord, "夜王"],
    [mapType, "地形"],
    [spawn, "出生点"],
  ])
    if (select.value)
      chips.push(
        button(
          `${label}：${zh(select.value)} ×`,
          () => {
            select.value = "";
            update();
          },
          "filter-chip",
        ),
      );
  selected.forEach((item, index) => {
    const name = `${item.key ? zh(item.key) : item.category ? zh(item.category) + " · 位置不限" : "位置不限"}：${item.value === "empty" ? "此处为空" : zh(item.value)}`;
    chips.push(
      button(
        `${name} ×`,
        () => {
          selected.splice(index, 1);
          update();
        },
        "filter-chip",
      ),
    );
  });
  $("#filter-chips").replaceChildren(...chips);
  $("#filter-empty").hidden = chips.length > 0;
}
function refreshFacets() {
  for (const [select, key, values] of [
    [nightlord, "nightlord", mapData.facets.nightlords],
    [mapType, "mapType", mapData.facets.mapTypes],
    [spawn, "spawn", mapData.facets.spawns],
  ]) {
    const current = select.value,
      counts = facetCounts(mapData.records, state(), key, values);
    select.replaceChildren(
      new Option("不限 / 不知道", ""),
      ...values.map((value) => {
        const option = new Option(
          `${zh(value)}（${counts.get(value)}）`,
          value,
        );
        option.disabled = !counts.get(value) && value !== current;
        return option;
      }),
    );
    select.value = current;
  }
}
function renderCandidates() {
  const container = $("#candidate-list");
  container.replaceChildren();
  if (candidates.length > 1) {
    container.append(node("h3", `候选地图（${candidates.length}）`));
    const grid = node("div", "", "candidate-grid");
    for (const record of candidates.slice(0, candidateLimit)) {
      const b = button(
        "",
        () => {
          previewId = record.id;
          renderRecord(record);
          resultPanel.prepend(
            button("关闭预览", () => {
              previewId = null;
              resultPanel.hidden = true;
            }),
          );
          resultPanel.scrollIntoView({ behavior: "auto", block: "start" });
        },
        "candidate-card",
      );
      b.append(
        node("strong", `#${record.id} · ${zh(record.nightlord)}`),
        node("span", `${zh(record.mapType)} · ${zh(record.spawn)}`),
        node("small", `第一夜：${zh(record.night1Boss)}`),
      );
      grid.append(b);
    }
    container.append(grid);
    if (candidates.length > candidateLimit)
      container.append(
        button("显示更多候选地图", () => {
          candidateLimit += 6;
          renderCandidates();
        }),
      );
  }
}
function update() {
  candidates = queryMaps(mapData.records, state());
  candidateCount.textContent = candidates.length;
  refreshFacets();
  renderChips();
  renderClues();
  renderCandidates();
  recommendation = recommendObservation(
    candidates,
    selected.filter((item) => item.key).map((item) => item.key),
  );
  clueButton.hidden = !recommendation;
  if (!candidates.length) {
    nextClue.textContent = "没有匹配地图";
    candidateSummary.textContent =
      "点击“已选条件”中的 × 撤销不确定的条件。线索可能冲突，也可能不在这份旧档案中。";
    resultPanel.hidden = true;
  } else if (candidates.length === 1) {
    nextClue.textContent = `已锁定地图布局 #${candidates[0].id}`;
    candidateSummary.textContent =
      "以下展示该档案全部地点。随机事件以实际游戏为准。";
    renderRecord(candidates[0]);
  } else {
    nextClue.textContent = recommendation
      ? zh(recommendation.key)
      : "继续添加你看到的线索";
    candidateSummary.textContent = recommendation
      ? `这处位置还有 ${recommendation.values.length} 种结果，观察后更容易分辨地图。也可以直接查看下方候选。`
      : `仍有 ${candidates.length} 份候选。`;
    if (previewId && candidates.some((record) => record.id === previewId)) {
      renderRecord(candidates.find((record) => record.id === previewId));
      resultPanel.prepend(
        button("关闭预览", () => {
          previewId = null;
          resultPanel.hidden = true;
        }),
      );
    } else {
      previewId = null;
      resultPanel.hidden = true;
    }
  }
}
form.addEventListener("submit", (event) => event.preventDefault());
for (const select of [nightlord, mapType, spawn])
  select.addEventListener("change", () => {
    candidateLimit = 6;
    update();
  });
clueSearch.addEventListener("input", () => {
  clueLimit = 6;
  renderClues();
});
clueCategory.addEventListener("change", () => {
  clueLocation.value = "";
  refreshLocations();
  clueLimit = 6;
  renderClues();
});
clueLocation.addEventListener("change", () => {
  clueLimit = 6;
  renderClues();
});
$("#more-clues").addEventListener("click", () => {
  clueLimit += 12;
  renderClues();
});
form.addEventListener("reset", () =>
  setTimeout(() => {
    if (!mapData) return;
    selected = [];
    previewId = null;
    clueLimit = 6;
    candidateLimit = 6;
    refreshLocations();
    update();
  }, 0),
);
clueButton.addEventListener("click", () => {
  if (!recommendation) return;
  $("#location-details").open = true;
  const slot = mapData.records
    .flatMap((record) => record.slots)
    .find((slot) => slot.key === recommendation.key);
  clueCategory.value = slot.category;
  refreshLocations();
  clueLocation.value = slot.key;
  clueSearch.value = "";
  clueLimit = 6;
  renderClues();
  clueSearch.focus();
});
async function init() {
  form
    .querySelectorAll("select,button,input")
    .forEach((element) => (element.disabled = true));
  form.setAttribute("aria-busy", "true");
  retry.hidden = true;
  try {
    [mapData, dictionary] = await Promise.all([
      loadJson("data/map-data.json"),
      loadJson("data/zh-CN.json"),
    ]);
    $("#base-filters").open = matchMedia("(min-width: 761px)").matches;
    $("#location-details").open = matchMedia("(min-width: 761px)").matches;
    $("#map-version").textContent =
      `基础游戏 · ${mapData.records.length} 份地图布局，未覆盖全部扩展内容。`;
    const categories = [
      ...new Set(
        mapData.records.flatMap((record) =>
          record.slots.map((slot) => slot.category),
        ),
      ),
    ];
    clueCategory.replaceChildren(
      new Option("全部类型", ""),
      ...categories.map((value) => new Option(zh(value), value)),
    );
    refreshLocations();
    form
      .querySelectorAll("select,button,input")
      .forEach((element) => (element.disabled = false));
    update();
  } catch {
    nextClue.textContent = "地图档案加载失败";
    candidateSummary.textContent = "请检查网络连接后点击“重新加载地图”。";
    $("#map-version").textContent = "地图数据未就绪";
    retry.hidden = false;
  } finally {
    form.setAttribute("aria-busy", "false");
  }
}
retry.addEventListener("click", init);
init();
