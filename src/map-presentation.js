import { pointConsensus } from "./map-spatial.js?v=towers-1";
// Headlines describe what is at a point. Geographic descriptions belong in details.
export function pointTitle(point, records, state, zh) {
  if (point.tower) return "神授塔 · 三层强敌";
  if (point.spawn) return "出生点";
  const known = pointConsensus(records, point);
  const marked = state.observations.find((o) => o.key === point.key)?.value;
  const value = known || marked;
  if (value) return value === "empty" ? "此处为空" : zh(value);
  const types = records.map(
    (r) => r.slots.find((s) => s.key === point.key)?.value?.split(" - ")[0],
  );
  if (types.length && types[0] && types.every((t) => t === types[0]))
    return zh(types[0]);
  return zh(point.category);
}
