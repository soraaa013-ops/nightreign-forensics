const panel = document.getElementById("merchant-panel");
const body = document.getElementById("merchant-panel-body");
const trigger = document.getElementById("open-merchant");
let loaded,
  api,
  returnFocus = trigger,
  selectedShop;
function panelState(open) {
  const url = new URL(location.href);
  if (open) url.searchParams.set("panel", "merchant");
  else url.searchParams.delete("panel");
  history.replaceState(null, "", url);
  trigger.setAttribute("aria-expanded", String(open));
}
async function populate() {
  try {
    const response = await fetch("merchant.html?v=integrated-1");
    if (!response.ok) throw Error("template");
    const documentFragment = new DOMParser().parseFromString(
      await response.text(),
      "text/html",
    );
    const main = documentFragment.querySelector(".merchant-main");
    if (!main) throw Error("template");
    const section = document.createElement("section");
    section.className = main.className;
    section.append(...main.childNodes);
    section.querySelector("h1")?.remove();
    body.replaceChildren(section);
    api = await import("./merchant.js?v=integrated-1");
    await api.ready;
    if (selectedShop) api.selectShop(selectedShop);
  } catch {
    loaded = null;
    const message = document.createElement("p");
    message.textContent = "商品面板加载失败。";
    const retry = document.createElement("button");
    retry.textContent = "重试";
    retry.onclick = () => {
      loaded = populate();
    };
    body.replaceChildren(message, retry);
  }
}
function open(shop, source) {
  if (source) returnFocus = source;
  if (shop) selectedShop = shop;
  // Close other map drawers while preserving their controls and current state.
  for (const id of ["map-settings", "map-results-dialog"])
    document.getElementById(id)?.close();
  if (!panel.open) panel.show();
  panelState(true);
  if (!loaded) loaded = populate();
  else if (api && shop) api.selectShop(shop);
  document.getElementById("close-merchant").focus({ preventScroll: true });
}
function close() {
  panel.close();
  panelState(false);
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  else trigger.focus({ preventScroll: true });
}
trigger.onclick = (event) => {
  event.preventDefault();
  panel.open ? close() : open(null, trigger);
};
document.getElementById("close-merchant").onclick = close;
panel.addEventListener("cancel", (event) => {
  event.preventDefault();
  close();
});
panel.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    close();
  }
});
document.addEventListener("click", (event) => {
  const link = event.target.closest(".merchant-map-link");
  if (!link) return;
  event.preventDefault();
  open(new URL(link.href).searchParams.get("shop"), link);
});
if (new URL(location.href).searchParams.get("panel") === "merchant")
  open(new URL(location.href).searchParams.get("shop"));
