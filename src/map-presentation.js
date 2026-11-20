import { pointConsensus } from "./map-spatial.js?v=towers-1";
import { towerFloors } from "./map-tower.js?v=towers-1";

// Only resolved enemies earn map labels. Building types are not enemy identities.
export function pointTitle(point, records, state, zh) {
  if (point.spawn) return "";
  if (point.tower)
    return towerFloors(records, point.key)
      .filter((floor) => floor.certain)
      .map((floor) => `${floor.floor}层：${zh(floor.values[0])}`)
      .join("；");
  const known = pointConsensus(records, point);
  const marked = state.observations.find(
    (o) => o.key === point.key && o.match !== "type",
  )?.value;
  const value = known || marked;
  if (!value || value === "empty" || point.category === "Minor Base") return "";
  if (value.startsWith("Map Event - ")) return "";
  const parts = value.split(" - ");
  if (point.category === "Major Base" && parts.length < 2) return "";
  const enemy = parts.at(-1);
  if (["冻伤", "圣", "睡眠", "雷", "出血", "毒", "魔法"].includes(enemy))
    return "";
  return zh(value).split(" · ").at(-1).split(" - ").at(-1);
}
