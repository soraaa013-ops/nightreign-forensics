import { createAtlas } from "./map-atlas.js";
import { recommendObservation } from "./map-filter.js";
import { queryMaps, matchesObservation, facetCounts } from "./map-query.js";
import { matchesSearch } from "./search.js";
import { readDraft, writeDraft } from "./draft.js";
import { validateMapState } from "./map-state.js";
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
let atlas;
let mapData,
  dictionary,
  recommendation,
  selected = [],
  candidates = [],
  clueLimit = 6,
  candidateLimit = 6,
  previewId = null,
  previousState = null;
const undoStack = [];
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
  const heading = node(
    "p",
    candidates.length === 1 ? "已锁定地图布局" : "候选地图预览",
    "kicker",
  );
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
  const points = node("div", "", "record-locations");
  const groups = new Map();
  for (const slot of record.slots.filter((slot) => slot.value)) {
    if (!groups.has(slot.category)) groups.set(slot.category, []);
    groups.get(slot.category).push(slot);
  }
  for (const [category, slots] of groups) {
    const group = node("details", "", "location-group");
    group.open = groups.keys().next().value === category;
    group.append(node("summary", `${zh(category)} · ${slots.length} 处`));
    const list = node("div", "", "poi-list");
    for (const slot of slots) {
      const item = node("article");
      item.append(
        node("small", zh(slot.location)),
        node("span", zh(slot.value)),
      );
      list.append(item);
    }
    group.append(list);
    points.append(group);
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
  const usefulness = (option) =>
    option.count > 0 && option.count < candidates.length
      ? 0
      : option.count > 0
        ? 1
        : 2;
  options.sort(
    (a, b) =>
      usefulness(a) - usefulness(b) ||
      Math.abs(a.count - candidates.length / 2) -
        Math.abs(b.count - candidates.length / 2) ||
      zh(a.value).localeCompare(zh(b.value), "zh-CN"),
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
          clueLocation.value = "";
          refreshLocations();
          clueLimit = 6;
          update();
          $("#map-feedback").textContent =
            `已添加“${value === "empty" ? "此处为空" : zh(value)}”，剩余 ${candidates.length} 张地图。`;
          clueSearch.focus({ preventScroll: true });
        },
        "clue-option",
      );
      b.append(
        node("span", value === "empty" ? "此处为空" : zh(value)),
        node(
          "small",
          exists
            ? "已添加"
            : count === candidates.length
              ? `不缩小范围 · ${count} 张`
              : count === 0
                ? "与当前条件冲突"
                : `缩小至 ${count} 张`,
          count > 0 && count < candidates.length ? "useful" : "",
        ),
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
function update(recordHistory = true) {
  const current = state();
  if (
    recordHistory &&
    previousState &&
    JSON.stringify(previousState) !== JSON.stringify(current)
  )
    undoStack.push(previousState);
  if (undoStack.length > 30) undoStack.shift();
  previousState = structuredClone(current);
  writeDraft("nightreign-map", current);
  $("#undo-map").disabled = !undoStack.length;
  const hasConditions =
    current.nightlord ||
    current.mapType ||
    current.spawn ||
    current.observations.length;
  history.replaceState(
    null,
    "",
    location.pathname +
      (hasConditions
        ? "?" + new URLSearchParams({ q: JSON.stringify(current) })
        : ""),
  );
  candidates = queryMaps(mapData.records, state());
  candidateCount.textContent = candidates.length;
  $("#map-result-link").textContent =
    `剩余 ${candidates.length} 张地图 · 查看结果`;
  $("#map-feedback").textContent = hasConditions
    ? `已应用 ${selected.length + [nightlord, mapType, spawn].filter((select) => select.value).length} 个条件，剩余 ${candidates.length} 张地图。`
    : "点击地图位置，标记你看到的内容。";
  refreshFacets();
  renderChips();
  renderClues();
  renderCandidates();
  atlas?.refresh();
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
  if (atlas?.focusPoint(recommendation.key)) return;
  $("#text-search").open = true;
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
function restoreState(saved) {
  nightlord.value = saved.nightlord;
  mapType.value = saved.mapType;
  spawn.value = saved.spawn;
  selected = structuredClone(saved.observations);
  previewId = null;
}
$("#undo-map").addEventListener("click", () => {
  const previous = undoStack.pop();
  if (previous) {
    restoreState(previous);
    update(false);
  }
});
$("#share-map").addEventListener("click", async () => {
  const url = location.href;
  try {
    await navigator.clipboard.writeText(url);
    $("#map-feedback").textContent =
      "筛选链接已复制，队友打开即可看到相同条件。";
  } catch {
    const field = node("input");
    field.readOnly = true;
    field.value = url;
    field.setAttribute("aria-label", "地图筛选链接");
    $("#map-feedback").textContent = "请手动复制筛选链接。";
    $("#map-feedback").append(field);
    field.focus();
    field.select();
  }
});
for (const term of ["教堂", "魔像", "失乡骑士", "封印监牢"]) {
  $("#quick-clues").append(
    button(
      term,
      () => {
        if (term === "封印监牢") {
          clueCategory.value = "Evergaol";
          clueLocation.value = "";
          clueSearch.value = "";
          $("#location-details").open = true;
          refreshLocations();
        } else clueSearch.value = term;
        clueLimit = 6;
        renderClues();
        clueSearch.focus();
      },
      "quick-search",
    ),
  );
}
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
    $("#base-filters").open = false;
    $("#location-details").open = false;
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
    const params = new URLSearchParams(location.search);
    let saved = null,
      invalidLink = false;
    if (params.has("q")) {
      try {
        saved = validateMapState(JSON.parse(params.get("q")), mapData);
        invalidLink = !saved;
      } catch {
        invalidLink = true;
      }
    } else saved = validateMapState(readDraft("nightreign-map"), mapData);
    refreshFacets();
    if (saved) restoreState(saved);
    update(false);
    for (const select of [nightlord, mapType]) {
      select.setAttribute("form", "map-form");
      $("#atlas-facets").append(select.closest("label"));
      select.disabled = false;
    }
    const loadAtlas = async () => {
      try {
        atlas = await createAtlas({
          data: mapData,
          zh,
          getState: state,
          change(next) {
            restoreState(next);
            update();
          },
        });
      } catch {
        $("#atlas-loading").hidden = false;
        $("#atlas-loading").replaceChildren(
          node("span", "交互地图加载失败，文字筛选仍可使用。"),
          button("重试交互地图", loadAtlas),
        );
        $("#text-search").open = true;
      }
    };
    await loadAtlas();
    if (invalidLink)
      $("#map-feedback").textContent =
        "筛选链接无效，已展示全部地图。请重新添加条件。";
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
