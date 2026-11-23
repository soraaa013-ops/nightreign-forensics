import { matchesSearch } from "./search.js?v=merchant-1";
import {
  SHOPS,
  stockOptions,
  queryMerchants,
  validMerchantState,
} from "./merchant-query.js?v=merchant-1";
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
const compare = new Intl.Collator("zh-CN").compare;
let data,
  state = { mode: "normal", observations: [] },
  history = [],
  candidates = [],
  viewShop = "normal",
  preview = "",
  suggestionLimit = 10,
  stockLimit = 20;
function save() {
  const url = new URL(location.href);
  url.searchParams.set("q", JSON.stringify(state));
  window.history.replaceState(null, "", url);
  try {
    localStorage.setItem("merchant-state-v1", JSON.stringify(state));
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
  $("merchant-feedback").textContent = `已添加 ${observation.name}`;
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
  const options = stockOptions(data, chosen, viewShop).sort(
    (a, b) => b.patterns.size - a.patterns.size || compare(a.name, b.name),
  );
  const unknown = chosen.filter((p) => p[viewShop] === null).length;
  $("inventory-status").textContent = !candidates.length
    ? "没有匹配组合"
    : (preview !== "" && candidates.length > 1
        ? `预览组合 #${preview} · 尚有 ${candidates.length} 组候选`
        : candidates.length === 1
          ? `已确定组合 #${candidates[0].id}`
          : `${candidates.length} 组候选`) +
      (viewShop === "legendary"
        ? ` · 大空洞${unknown ? " · " + unknown + " 组货物未记录" : ""}`
        : "") +
      " · 可变货物";
  $("merchant-stock").replaceChildren(
    ...options.slice(0, stockLimit).map((option) => {
      const row = el("details", undefined, "merchant-stock-row");
      const variants = [...option.items.values()];
      row.dataset.rarity = variants[0].rarities[state.mode];
      const summary = el("summary");
      summary.append(el("span", option.name, "merchant-stock-name"));
      const prices = [
        ...new Set(variants.map((i) => i.prices[state.mode])),
      ].sort((a, b) => a - b);
      summary.append(
        el(
          "span",
          prices.map((p) => p.toLocaleString("zh-CN")).join("／") + " 卢恩",
          "merchant-price",
        ),
      );
      row.append(summary);
      if (chosen.length > 1)
        row.append(
          el(
            "p",
            option.patterns.size === chosen.length
              ? "所有候选均有"
              : `${option.patterns.size} / ${chosen.length} 组候选有售`,
            "merchant-feedback",
          ),
        );
      // Collapse duplicate mode-specific variants in the display, keeping data intact.
      const seen = new Set();
      for (const item of variants) {
        const key = JSON.stringify([
          item.skill,
          item.effects[state.mode],
          item.affinities,
          item.prices[state.mode],
        ]);
        if (seen.has(key)) continue;
        seen.add(key);
        const part = el("div", undefined, "merchant-variant");
        if (item.skill) part.append(el("p", `战技／法术：${item.skill}`));
        if (item.affinities.length)
          part.append(el("p", `属性：${item.affinities.join("／")}`));
        const effects = item.effects[state.mode];
        if (effects.length) {
          const list = el("ul");
          for (const effect of effects) list.append(el("li", effect));
          part.append(list);
        } else if (item.kind !== "consumable") {
          part.append(el("p", "来源未记录附加效果", "merchant-feedback"));
        }
        part.append(
          button("确认看到这件商品", () =>
            add({ shop: viewShop, name: item.name, skill: item.skill }),
          ),
        );
        for (const effect of effects)
          part.append(
            button(
              "确认效果：" + effect,
              () =>
                add({
                  shop: viewShop,
                  name: item.name,
                  skill: item.skill,
                  effect,
                }),
              "effect-confirm",
            ),
          );
        row.append(part);
      }
      return row;
    }),
  );
  if (!options.length)
    $("merchant-stock").append(
      el(
        "p",
        unknown ? "该组合的传奇商店货物尚未记录" : "暂无货物",
        "merchant-empty",
      ),
    );
  $("stock-more").hidden = options.length <= stockLimit;
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
    try {
      initial = JSON.parse(
        new URL(location.href).searchParams.get("q") ||
          localStorage.getItem("merchant-state-v1") ||
          "null",
      );
    } catch {}
    state = validMerchantState(data, initial);
    const shop = new URL(location.href).searchParams.get("shop");
    if (Object.hasOwn(SHOPS, shop)) {
      viewShop = shop;
      $("observation-shop").value = shop;
      for (const tab of document.querySelectorAll("[data-shop]"))
        tab.setAttribute("aria-pressed", String(tab.dataset.shop === shop));
    }
    $("merchant-workspace").hidden = false;
    render();
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
load();
