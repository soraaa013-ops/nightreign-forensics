import { matchesObservation } from "./map-query.js?v=perf-1";
// URL and session drafts use the original stable keys; display labels stay localized.
export function validateMapState(value, data) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const fields = {
    nightlord: data.facets.nightlords,
    mapType: data.facets.mapTypes,
    spawn: data.facets.spawns,
  };
  for (const [key, values] of Object.entries(fields))
    if (
      typeof value[key] !== "string" ||
      (value[key] && !values.includes(value[key]))
    )
      return null;
  if (!Array.isArray(value.observations) || value.observations.length > 100)
    return null;
  for (const item of value.observations) {
    if (
      !item ||
      typeof item.key !== "string" ||
      typeof item.category !== "string" ||
      typeof item.value !== "string"
    )
      return null;
    if (item.match !== undefined && !["exact", "type"].includes(item.match))
      return null;
    if (item.match === "type" && (!item.key || item.value === "empty"))
      return null;
    if (!data.records.some((record) => matchesObservation(record, item)))
      return null;
  }
  return {
    nightlord: value.nightlord,
    mapType: value.mapType,
    spawn: value.spawn,
    observations: value.observations.map(({ key, category, value, match }) => ({
      key,
      category,
      value,
      ...(match ? { match } : {}),
    })),
  };
}
