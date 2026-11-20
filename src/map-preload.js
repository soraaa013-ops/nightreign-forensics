import { MAP_LAYOUTS, previewMap } from "./map-tiles.js?v=perf-1";
import { readDraft } from "./draft.js";
let state;
try {
  const params = new URLSearchParams(location.search);
  state = params.has("q")
    ? JSON.parse(params.get("q"))
    : readDraft("nightreign-map");
} catch {
  /* A malformed share falls back to the default overview. */
}
if (
  !state ||
  !["nightlord", "mapType", "spawn"].every(
    (key) => typeof state[key] === "string",
  ) ||
  !Array.isArray(state.observations)
)
  state = null;
const layout = Object.hasOwn(MAP_LAYOUTS, state?.mapType)
  ? MAP_LAYOUTS[state.mapType]
  : MAP_LAYOUTS.Default;
const waiting = setTimeout(() => {
  const tiles = document.getElementById("atlas-tiles");
  if (tiles && !tiles.dataset.map && !tiles.dataset.managed)
    document.getElementById("atlas-loading").hidden = false;
}, 250);
const preview = previewMap(layout, "high");
preview.promise
  .then((image) => {
    const tiles = document.getElementById("atlas-tiles"),
      viewport = document.getElementById("atlas-viewport");
    // Once the interactive viewer owns the surface, it also owns race protection.
    if (!tiles || tiles.dataset.managed) return;
    image.className = "atlas-preview";
    const size = Math.min(viewport.clientWidth, viewport.clientHeight);
    tiles.style.width = tiles.style.height = `${size}px`;
    tiles.style.transform = `translate(${(viewport.clientWidth - size) / 2}px,${(viewport.clientHeight - size) / 2}px)`;
    tiles.replaceChildren(image);
    tiles.dataset.map = layout;
    tiles.dataset.quality = "preview";
    clearTimeout(waiting);
    const status = document.getElementById("atlas-loading");
    if (status.textContent === "正在载入地图…") status.hidden = true;
  })
  .catch(() => {});
