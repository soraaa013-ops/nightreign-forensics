import { inspectRelic, listTemplateEffects } from "./check.js";
import { readDraft, writeDraft } from "./draft.js";
import { loadJson, localizeRelics } from "./locale.js";
import { searchEffects, effectCategories } from "./search.js";
const $ = (selector) => document.querySelector(selector);
const form = $("#relic-form"),
  templateSelect = $("#template"),
  picker = $("#effect-picker");
const report = $("#report"),
  feedback = $("#action-status"),
  copyButton = $("#copy-report");
let gameData,
  selected = [null, null, null],
  available = new Set(),
  activeSlot = 0,
  lastResult,
  resultLimit = 40,
  lastSnapshot = null;
const undoStack = [];
const query = $("#effect-query"),
  category = $("#effect-category"),
  character = $("#effect-character");
function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function button(text, action, className = "secondary") {
  const b = node("button", text, className);
  b.type = "button";
  b.addEventListener("click", action);
  return b;
}
const currentTemplate = () =>
  gameData?.templates.find((item) => item.id === Number(templateSelect.value));
function refreshPool() {
  available = new Set(
    listTemplateEffects(currentTemplate(), gameData).map((item) => item.id),
  );
}
function openPicker(index) {
  activeSlot = index;
  renderSlots();
  renderResults();
  query.focus();
}
function snapshot() {
  return { template: templateSelect.value, selected: [...selected] };
}
function restore(snapshot) {
  templateSelect.value = snapshot.template;
  selected = [...snapshot.selected];
  activeSlot = selected.findIndex((id) => !id);
  refreshPool();
}
function renderSlots() {
  $("#selected-effects").replaceChildren(
    ...selected.map((id, index) => {
      const card = node(
        "div",
        "",
        `effect-slot ${id ? "is-selected" : ""} ${index === activeSlot ? "is-active" : ""}`,
      );
      card.dataset.slotIndex = String(index);
      card.append(node("span", `第 ${index + 1} 条`, "slot-number"));
      const choose = button(
        id ? gameData.effects[id].name : "＋ 选择词条",
        () => openPicker(index),
        "choose-effect",
      );
      choose.setAttribute(
        "aria-label",
        `${id ? "替换" : "选择"}第${index + 1}条词条${id ? "：" + gameData.effects[id].name : ""}`,
      );
      choose.disabled = !gameData;
      card.append(choose);
      if (id) {
        const actions = node("div", "", "slot-actions");
        if (index > 0)
          actions.append(
            button(
              "上移",
              () => {
                [selected[index - 1], selected[index]] = [
                  selected[index],
                  selected[index - 1],
                ];
                changed();
              },
              "text-button",
            ),
          );
        if (index < 2)
          actions.append(
            button(
              "下移",
              () => {
                [selected[index + 1], selected[index]] = [
                  selected[index],
                  selected[index + 1],
                ];
                changed();
              },
              "text-button",
            ),
          );
        actions.append(
          button(
            "移除",
            () => {
              selected[index] = null;
              activeSlot = index;
              changed();
            },
            "text-button",
          ),
        );
        card.append(actions);
      }
      return card;
    }),
  );
  $("#slot-tabs").replaceChildren(
    ...selected.map((id, index) => {
      const tab = button(
        `第 ${index + 1} 条${id ? " · 已选" : ""}`,
        () => openPicker(index),
        "slot-tab",
      );
      tab.setAttribute("aria-pressed", String(activeSlot === index));
      tab.disabled = !gameData;
      return tab;
    }),
  );
  $("#relic-result-link").textContent =
    `已选 ${selected.filter(Boolean).length} / 3 条 · ${selected.every(Boolean) ? "查看检测结果" : "查看已选"}`;
  form.querySelector("button[type=submit]").disabled = !selected.every(Boolean);
}
function renderResults() {
  if (!gameData) return;
  const effects = searchEffects(
    Object.values(gameData.effects).filter(
      (effect) => $("#include-unsupported").checked || available.has(effect.id),
    ),
    {
      query: query.value,
      category: category.value,
      character: character.value,
    },
  );
  effects.sort(
    (a, b) =>
      Number(available.has(b.id)) - Number(available.has(a.id)) ||
      a.name.localeCompare(b.name, "zh-CN") ||
      a.id - b.id,
  );
  $("#effect-count").textContent =
    `共 ${effects.length} 条匹配，已显示 ${Math.min(resultLimit, effects.length)} 条`;
  const duplicates = new Map();
  for (const effect of effects)
    duplicates.set(effect.name, (duplicates.get(effect.name) || 0) + 1);
  $("#effect-results").replaceChildren(
    ...effects.slice(0, resultLimit).map((effect) => {
      const b = button(
        "",
        () => {
          if (activeSlot < 0) return;
          const filledSlot = activeSlot;
          selected[activeSlot] = effect.id;
          activeSlot = selected.findIndex((id) => !id);
          changed();
          $("#selection-feedback").textContent =
            `第 ${filledSlot + 1} 条已添加。${activeSlot < 0 ? "已选齐，检测结果已更新。" : `继续选择第 ${activeSlot + 1} 条；筛选条件已保留。`}`;
          query.focus({ preventScroll: true });
        },
        "effect-option",
      );
      b.dataset.effectId = String(effect.id);
      b.disabled = activeSlot < 0;
      b.setAttribute("aria-pressed", String(selected.includes(effect.id)));
      b.append(node("span", effect.name));
      const notes = [];
      if (!available.has(effect.id)) notes.push("当前模板无法抽取");
      if (selected.some((id, i) => i !== activeSlot && id === effect.id))
        notes.push("已选过，重复会判为无效");
      else if (
        effect.familyId &&
        selected.some(
          (id, i) =>
            i !== activeSlot &&
            gameData.effects[id]?.familyId === effect.familyId,
        )
      )
        notes.push("与已选词条互斥");
      if (duplicates.get(effect.name) > 1)
        notes.push(`同名词条 · 编号 ${effect.id}`);
      if (notes.length)
        b.append(node("small", notes.join(" · "), "input-help"));
      return b;
    }),
  );
  $("#more-effects").hidden = effects.length <= resultLimit;
  if (!effects.length)
    $("#effect-results").append(
      node(
        "p",
        "没有找到匹配词条。试试更短的关键词，或点击“清除筛选”查看全部。",
        "empty-state",
      ),
    );
}
function waiting() {
  lastResult = null;
  report.className = "report";
  $("#report-stamp").textContent = "待检";
  $("#report-title").textContent =
    `已选 ${selected.filter(Boolean).length} / 3 条`;
  $("#report-summary").textContent = "点击空位添加词条，选齐三条后自动检测。";
  $("#report-order").hidden = true;
  $("#report-probability").hidden = true;
  $("#report-code").textContent = "等待选择";
  copyButton.disabled = true;
  $("#apply-order").hidden = true;
}
function render(result) {
  lastResult = result;
  report.className = `report ${result.status}`;
  $("#report-stamp").textContent = {
    valid: "合法",
    invalid: "无效",
    reorder: "调序",
    unknown: "待核",
    incomplete: "未选齐",
  }[result.status];
  $("#report-title").textContent = result.title;
  $("#report-summary").textContent = result.summary;
  const p = $("#report-probability");
  p.hidden = !(result.probability > 0);
  if (!p.hidden)
    p.textContent = `精确出货概率约 ${(result.probability * 100).toPrecision(4)}%（约 ${Math.round(1 / result.probability).toLocaleString("zh-CN")} 次中出现 1 次）`;
  $("#report-order").replaceChildren(
    ...(result.orderedEffectIds || []).map((id) =>
      node("li", gameData.effects[id].name),
    ),
  );
  $("#report-order").hidden = !result.orderedEffectIds?.length;
  $("#report-code").textContent = {
    valid: "核验通过",
    invalid: "未通过核验",
    reorder: "可一键调整顺序",
    unknown: "需要核对",
    incomplete: "尚未选齐",
  }[result.status];
  $("#apply-order").hidden = result.status !== "reorder";
  copyButton.disabled = !["valid", "reorder", "invalid"].includes(
    result.status,
  );
}
function changed(recordHistory = true) {
  const previousFocusSlot =
    document.activeElement?.closest(".effect-slot")?.dataset.slotIndex;
  const current = snapshot();
  if (
    recordHistory &&
    lastSnapshot &&
    JSON.stringify(lastSnapshot) !== JSON.stringify(current)
  )
    undoStack.push(lastSnapshot);
  if (undoStack.length > 20) undoStack.shift();
  lastSnapshot = current;
  writeDraft("nightreign-relic", current);
  $("#undo-relic").disabled = !undoStack.length;
  renderSlots();
  renderResults();
  if (previousFocusSlot !== undefined)
    $("#selected-effects")
      .children[Number(previousFocusSlot)]?.querySelector(".choose-effect")
      ?.focus({ preventScroll: true });
  $("#selection-feedback").textContent =
    activeSlot < 0
      ? "已选齐三条。要替换，请先点击上方对应位置。"
      : `下一次选择填入第 ${activeSlot + 1} 条。`;

  feedback.replaceChildren();
  if (selected.every(Boolean)) {
    const result = inspectRelic(
      { templateId: currentTemplate().id, effectIds: selected },
      gameData,
    );
    render(result);
    history.replaceState(
      null,
      "",
      `${location.pathname}?${new URLSearchParams({ template: templateSelect.value, effects: selected.join(",") })}`,
    );
  } else {
    waiting();
    history.replaceState(null, "", location.pathname);
  }
}
$("#report-order").after(
  button(
    "按游戏顺序排列",
    () => {
      selected = [...lastResult.orderedEffectIds];
      changed();
    },
    "secondary",
  ),
);
$("#report-order").nextElementSibling.id = "apply-order";
$("#apply-order").hidden = true;
for (const control of [query, category, character, $("#include-unsupported")])
  control.addEventListener(control === query ? "input" : "change", () => {
    resultLimit = 40;
    renderResults();
  });
$("#reset-effect-filters").addEventListener("click", () => {
  query.value = "";
  category.value = "";
  character.value = "";
  $("#include-unsupported").checked = false;
  renderResults();
  query.focus();
});
$("#more-effects").addEventListener("click", () => {
  resultLimit += 40;
  renderResults();
});
$("#undo-relic").addEventListener("click", () => {
  const previous = undoStack.pop();
  if (previous) {
    restore(previous);
    changed(false);
  }
});
form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (selected.every(Boolean)) changed();
});
form.addEventListener("reset", () =>
  setTimeout(() => {
    selected = [null, null, null];
    activeSlot = 0;
    refreshPool();
    changed();
  }, 0),
);
templateSelect.addEventListener("change", () => {
  refreshPool();
  changed();
});
$("#randomize").addEventListener("click", () => {
  const chosen = [],
    families = new Set();
  for (const pool of currentTemplate().effectPools) {
    const candidates = gameData.pools[pool]
      .map((entry) => gameData.effects[entry.effectId])
      .filter(
        (effect) =>
          effect &&
          !chosen.includes(effect.id) &&
          (!effect.familyId || !families.has(effect.familyId)),
      );
    const effect = candidates[Math.floor(Math.random() * candidates.length)];
    if (!effect) return;
    chosen.push(effect.id);
    if (effect.familyId) families.add(effect.familyId);
  }
  activeSlot = -1;
  selected = chosen.sort(
    (a, b) =>
      gameData.effects[a].overrideBaseEffectId -
        gameData.effects[b].overrideBaseEffectId || a - b,
  );
  changed();
  feedback.textContent = "已填入合法示例。示例不模拟游戏抽取权重。";
});
copyButton.addEventListener("click", async () => {
  const url = location.href;
  try {
    await navigator.clipboard.writeText(url);
    feedback.textContent = "报告链接已复制。";
  } catch {
    feedback.textContent = "浏览器未允许自动复制，请复制下方链接。";
    const field = node("input");
    field.readOnly = true;
    field.value = url;
    field.setAttribute("aria-label", "报告链接");
    feedback.append(field);
    field.focus();
    field.select();
  }
});
async function init() {
  form.setAttribute("aria-busy", "true");
  templateSelect.disabled = true;
  picker
    .querySelectorAll("input,select,button")
    .forEach((el) => (el.disabled = true));
  form
    .querySelectorAll("button,select")
    .forEach((element) => (element.disabled = true));
  $("#retry").hidden = true;
  try {
    const [raw, dictionary] = await Promise.all([
      loadJson("data/game-data.json"),
      loadJson("data/zh-CN.json"),
    ]);
    gameData = localizeRelics(raw, dictionary);
    const templates = gameData.templates
      .filter((item) => item.generation === "1.0.3-dlc" && item.slotCount === 3)
      .filter(
        (item, i, all) =>
          all.findIndex((other) => other.color === item.color) === i,
      );
    templateSelect.replaceChildren(
      ...templates.map(
        (item) => new Option(`${item.colorName} · ${item.name}`, item.id),
      ),
    );
    category.replaceChildren(
      new Option("全部类型", ""),
      ...[
        ...new Set(Object.values(gameData.effects).flatMap(effectCategories)),
      ].map((value) => new Option(value, value)),
    );
    character.replaceChildren(
      new Option("全部角色", ""),
      ...[
        ...new Set(
          Object.values(gameData.effects)
            .map((effect) => effect.name.match(/【(.+?)】/)?.[1])
            .filter(Boolean),
        ),
      ].map((value) => new Option(value, value)),
    );
    $("#ruleset-version").textContent = gameData.metadata.label;
    $("#data-stats").textContent =
      `${gameData.stats.effects} 条效果 · 简体中文`;
    form
      .querySelectorAll("button,select")
      .forEach((element) => (element.disabled = false));
    templateSelect.disabled = false;
    picker
      .querySelectorAll("input,select,button")
      .forEach((el) => (el.disabled = false));
    refreshPool();
    const params = new URLSearchParams(location.search);
    const ids = (params.get("effects") || "").split(",");
    if (params.has("template") || params.has("effects")) {
      if (
        templates.some((item) => item.id === Number(params.get("template"))) &&
        ids.length === 3 &&
        ids.every((id) => /^\d+$/.test(id) && gameData.effects[id])
      ) {
        templateSelect.value = params.get("template");
        refreshPool();
        selected = ids.map(Number);
        activeSlot = -1;
        changed(false);
      } else {
        waiting();
        renderSlots();
        feedback.textContent = "报告链接不完整或不受当前规则支持，请重新选择。";
      }
    } else {
      const draft = readDraft("nightreign-relic");
      if (
        draft &&
        templates.some((t) => String(t.id) === draft.template) &&
        Array.isArray(draft.selected) &&
        draft.selected.length === 3 &&
        draft.selected.every((id) => id === null || gameData.effects[id])
      )
        restore(draft);
      changed(false);
    }
    renderResults();
    lastSnapshot = snapshot();
  } catch {
    gameData = null;
    $("#data-stats").textContent = "数据未就绪";
    $("#ruleset-version").textContent = "加载失败";
    render({
      status: "unknown",
      title: "规则档案未能载入",
      summary: "请检查网络连接后点击“重新加载规则”。",
    });
    $("#retry").hidden = false;
  } finally {
    form.setAttribute("aria-busy", "false");
  }
}
$("#retry").addEventListener("click", init);
renderSlots();
init();
