import { matchesSearch } from "./search.js?v=merchant-1";
import {
  SHOPS,
  stockOptions,
  queryMerchants,
  validMerchantState,
} from "./merchant-query.js?v=stock-2";
const $ = (id) => document.getElementById(id);
const el = (tag, text, cls) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (cls) n.className = cls;
  return n;
};
const button = (text, handler, cls) => {
  const n = el("button", text, cls);
  n.type = "button";
  n.onclick = handler;
  return n;
};
const embedded = document.body.classList.contains("map-page");
const stateParam = embedded ? "merchant" : "q";
let requestedShop = new URL(location.href).searchParams.get("shop");
const compare = new Intl.Collator("zh-CN").compare;
let data,
  state = { mode: "deep", observations: [] },
  history = [],
  candidates = [],
  viewShop = "normal",
  preview = "",
  suggestionLimit = 10,
  stockLimit = 20;
function save() {
  const url = new URL(location.href);
  url.searchParams.set(stateParam, JSON.stringify(state));
  if (embedded) url.searchParams.set("panel", "merchant");
  url.searchParams.set("shop", viewShop);
  window.history.replaceState(null, "", url);
  try {
    localStorage.setItem("merchant-state-v2", JSON.stringify(state));
  } catch {}
}
function change(next) {
  history.push(structuredClone(state));
  state = next;
  preview = "";
  suggestionLimit = 10;
  stockLimit = 20;
  save();
  render();
}
function add(observation) {
  if (
    state.observations.some(
      (o) => JSON.stringify(o) === JSON.stringify(observation),
    )
  )
    return;
  const others = state.observations.filter(
    (o) => !(o.shop === observation.shop && o.name === observation.name),
  );
  change({ ...state, observations: [...others, observation] });
  $("merchant-search").value = "";
  suggestions();
  $("merchant-feedback").textContent =
    candidates.length === 1 ? "" : `已添加 ${observation.name}`;
}
function candidatesFor(shop) {
  return stockOptions(data, candidates, shop);
}
function suggestions() {
  $("merchant-suggestions").hidden = candidates.length === 1;
  if (candidates.length === 1) {
    $("suggestions-more").hidden = true;
    return;
  }
  const shop = $("observation-shop").value,
    q = $("merchant-search").value.trim();
  const selected = new Set(
    state.observations.filter((o) => o.shop === shop).map((o) => o.name),
  );
  const options = candidatesFor(shop)
    .filter(
      (o) =>
        !selected.has(o.name) &&
        [...o.items.values()].some((i) =>
          matchesSearch(
            `${i.name} ${i.skill} ${i.effects[state.mode].join(" ")}`,
            q,
          ),
        ),
    )
    .sort(
      (a, b) => a.patterns.size - b.patterns.size || compare(a.name, b.name),
    );
  $("merchant-suggestions").replaceChildren(
    ...options.slice(0, suggestionLimit).map((option) => {
      const b = button(
        "",
        () => add({ shop, name: option.name }),
        "merchant-suggestion",
      );
      b.append(
        el("strong", option.name),
        el("small", `${option.patterns.size} 组`),
      );
      return b;
    }),
  );
  if (!options.length)
    $("merchant-suggestions").append(
      el(
        "p",
        candidates.length ? "没有匹配商品" : "信息有冲突，请撤销或移除一条信息",
        "merchant-empty",
      ),
    );
  $("suggestions-more").hidden = options.length <= suggestionLimit;
}
function observations() {
  $("merchant-observations").replaceChildren(
    ...state.observations.map((o, index) => {
      const label = [SHOPS[o.shop], o.name, o.skill, o.effect]
        .filter(Boolean)
        .join(" · ");
      const b = button(
        label + " ×",
        () =>
          change({
            ...state,
            observations: state.observations.filter((_, i) => i !== index),
          }),
        "merchant-chip",
      );
      b.setAttribute("aria-label", "移除 " + label);
      return b;
    }),
  );
}
function inventory() {
  const chosen =
    preview !== ""
      ? candidates.filter((p) => String(p.id) === preview)
      : candidates;
  const allShops = chosen.length === 1;
  $("merchant-panel")?.classList.toggle("merchant-overview", allShops);
  document.querySelector(".merchant-shop-tabs").hidden = allShops;
  $("pattern-preview").closest("label").hidden = candidates.length === 1;
  $("inventory-status").textContent = !candidates.length
    ? "没有匹配组合"
    : preview !== "" && candidates.length > 1
      ? `预览组合 #${preview} · 尚有 ${candidates.length} 组候选`
      : candidates.length === 1
        ? `已确定组合 #${candidates[0].id}`
        : `${candidates.length} 组候选`;
  const groups = [];
  let hasMore = false;
  for (const shop of allShops ? Object.keys(SHOPS) : [viewShop]) {
    const options = stockOptions(data, chosen, shop).sort(
      (a, b) =>
        Number([...a.items.values()][0].kind === "consumable") -
          Number([...b.items.values()][0].kind === "consumable") ||
        b.patterns.size - a.patterns.size ||
        compare(a.name, b.name),
    );
    const section = el("section", undefined, "merchant-stock-group");
    section.dataset.stockShop = shop;
    section.append(
      el("h3", SHOPS[shop] + (shop === "legendary" ? " · 大空洞" : "")),
    );
    if (!allShops && options.length > stockLimit) hasMore = true;
    for (const option of allShops ? options : options.slice(0, stockLimit)) {
      const seen = new Set();
      for (const item of option.items.values()) {
        const key = JSON.stringify([
          item.skill,
          item.effects[state.mode],
          item.affinities,
          item.prices[state.mode],
        ]);
        if (seen.has(key)) continue;
        seen.add(key);
        const row = el("article", undefined, "merchant-stock-row");
        row.dataset.item = item.id;
        row.dataset.rarity = item.rarities[state.mode];
        const head = el("div", undefined, "merchant-stock-head");
        head.append(
          el("strong", item.name, "merchant-stock-name"),
          el(
            "span",
            item.prices[state.mode].toLocaleString("zh-CN") + " 卢恩",
            "merchant-price",
          ),
        );
        row.append(head);
        const effects = el("ul", undefined, "merchant-effects");
        for (const effect of item.effects[state.mode])
          effects.append(el("li", effect));
        if (!effects.childElementCount && item.kind !== "consumable")
          effects.append(el("li", "来源未记录附加效果"));
        row.append(effects);
        if (chosen.length > 1)
          row.append(
            el(
              "small",
              `${option.patterns.size} / ${chosen.length} 组候选有售`,
              "merchant-availability",
            ),
          );
        if (allShops && item.skill)
          row.append(
            el(
              "p",
              [item.skill, ...item.affinities].join(" · "),
              "merchant-equipment-meta",
            ),
          );
        if (!allShops) {
          const details = el("details", undefined, "merchant-item-extra");
          details.append(el("summary", allShops ? "战技／属性" : "记录商品"));
          const part = el("div", undefined, "merchant-variant");
          if (item.skill) part.append(el("p", item.skill));
          if (item.affinities.length)
            part.append(el("p", item.affinities.join("／")));
          if (!allShops) {
            part.append(
              button("确认看到这件商品", () =>
                add({ shop, name: item.name, skill: item.skill }),
              ),
            );
            for (const effect of item.effects[state.mode])
              part.append(
                button(
                  "确认效果：" + effect,
                  () =>
                    add({ shop, name: item.name, skill: item.skill, effect }),
                  "effect-confirm",
                ),
              );
          }
          details.append(part);
          row.append(details);
        }
        section.append(row);
      }
    }
    if (!options.length)
      section.append(
        el(
          "p",
          chosen.some((p) => p[shop] === null)
            ? "该组合货物尚未记录"
            : "暂无货物",
          "merchant-empty",
        ),
      );
    groups.push(section);
  }
  $("merchant-stock").classList.toggle("merchant-stock-overview", allShops);
  $("merchant-stock").replaceChildren(...groups);
  $("stock-more").hidden = !hasMore;
}
function render() {
  candidates = queryMerchants(data, state.observations, state.mode);
  $("merchant-count").textContent =
    candidates.length === 1
      ? `已确定 #${candidates[0].id}`
      : `${candidates.length} 组候选`;
  $("merchant-mode").value = state.mode;
  $("merchant-undo").disabled = !history.length;
  $("merchant-clear").disabled = !state.observations.length;
  $("pattern-preview").replaceChildren(
    new Option("全部候选", ""),
    ...candidates.map((p) => new Option("组合 #" + p.id, String(p.id))),
  );
  if (!candidates.some((p) => String(p.id) === preview)) preview = "";
  $("pattern-preview").value = preview;
  const resolved = candidates.length === 1;
  $("merchant-evidence-body").hidden = resolved;
  $("edit-merchant-evidence").hidden = !resolved;
  $("edit-merchant-evidence").setAttribute("aria-expanded", String(!resolved));
  $("evidence-title").textContent = resolved ? "商店装备" : "已看到什么？";
  observations();
  suggestions();
  inventory();
}
async function load() {
  $("merchant-error").hidden = true;
  try {
    const response = await fetch("data/merchants.json?v=merchant-1");
    if (!response.ok) throw Error("load");
    data = await response.json();
    let initial;
    let migratedEffects = false;
    try {
      const shared = new URL(location.href).searchParams.get(stateParam);
      const saved = shared ? null : localStorage.getItem("merchant-state-v2");
      if (shared || saved) initial = JSON.parse(shared || saved);
      else {
        const legacy = JSON.parse(
          localStorage.getItem("merchant-state-v1") || "null",
        );
        if (legacy) {
          const observations = Array.isArray(legacy.observations)
            ? legacy.observations
            : [];
          migratedEffects =
            legacy.mode !== "deep" && observations.some((o) => o?.effect);
          initial = {
            ...legacy,
            mode: "deep",
            observations:
              legacy.mode === "deep"
                ? observations
                : observations.map(({ effect, ...rest }) => rest),
          };
        }
      }
    } catch {}
    state = validMerchantState(data, initial);
    const shop = requestedShop;
    if (Object.hasOwn(SHOPS, shop)) {
      viewShop = shop;
      $("observation-shop").value = shop;
      for (const tab of document.querySelectorAll("[data-shop]"))
        tab.setAttribute("aria-pressed", String(tab.dataset.shop === shop));
    }
    $("merchant-workspace").hidden = false;
    render();
    if (migratedEffects)
      $("merchant-feedback").textContent = "已切换深夜，请重新确认附加效果";
  } catch {
    $("merchant-error").hidden = false;
    $("merchant-count").textContent = "加载失败";
  }
}
$("merchant-search").oninput = () => {
  suggestionLimit = 10;
  suggestions();
};
$("observation-shop").onchange = () => {
  suggestionLimit = 10;
  suggestions();
};
$("merchant-mode").onchange = () => {
  const hadEffects = state.observations.some((o) => o.effect);
  change({
    mode: $("merchant-mode").value,
    observations: state.observations.map(({ effect, ...rest }) => rest),
  });
  $("merchant-feedback").textContent = hadEffects
    ? "已切换出击模式，请重新确认附加效果"
    : "";
};
$("merchant-undo").onclick = () => {
  if (history.length) {
    state = history.pop();
    preview = "";
    save();
    render();
  }
};
$("merchant-clear").onclick = () => change({ ...state, observations: [] });
$("merchant-share").onclick = async () => {
  save();
  try {
    await navigator.clipboard.writeText(location.href);
    $("merchant-feedback").textContent = "链接已复制";
  } catch {
    $("merchant-feedback").replaceChildren(el("span", "复制链接："));
    const input = el("input");
    input.value = location.href;
    input.readOnly = true;
    input.setAttribute("aria-label", "分享链接");
    $("merchant-feedback").append(input);
    input.select();
  }
};
$("pattern-preview").onchange = () => {
  preview = $("pattern-preview").value;
  stockLimit = 20;
  inventory();
};
for (const tab of document.querySelectorAll("[data-shop]"))
  tab.onclick = () => {
    viewShop = tab.dataset.shop;
    stockLimit = 20;
    for (const other of document.querySelectorAll("[data-shop]"))
      other.setAttribute("aria-pressed", String(other === tab));
    inventory();
  };
$("suggestions-more").onclick = () => {
  suggestionLimit += 20;
  suggestions();
};
$("stock-more").onclick = () => {
  stockLimit += 20;
  inventory();
};
$("merchant-retry").onclick = load;
$("merchant-show-skills").onchange = () =>
  $("merchant-stock").classList.toggle(
    "show-extra",
    $("merchant-show-skills").checked,
  );
$("edit-merchant-evidence").onclick = () => {
  const hidden = !$("merchant-evidence-body").hidden;
  $("merchant-evidence-body").hidden = hidden;
  $("edit-merchant-evidence").setAttribute("aria-expanded", String(!hidden));
};
export function selectShop(shop) {
  if (!Object.hasOwn(SHOPS, shop)) return;
  requestedShop = shop;
  if (!data) return;
  viewShop = shop;
  $("observation-shop").value = shop;
  for (const tab of document.querySelectorAll("[data-shop]"))
    tab.setAttribute("aria-pressed", String(tab.dataset.shop === shop));
  suggestionLimit = 10;
  stockLimit = 20;
  suggestions();
  inventory();
}
export const ready = load();
