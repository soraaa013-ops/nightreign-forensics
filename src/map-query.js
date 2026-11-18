export function matchesObservation(
  record,
  { key = "", category = "", value, match = "exact" },
) {
  return record.slots.some(
    (slot) =>
      (!key || slot.key === key) &&
      (!category || slot.category === category) &&
      (match === "type"
        ? slot.value?.split(" - ")[0] === value
        : (slot.value || "empty") === value),
  );
}
export function queryMaps(
  records,
  { nightlord = "", mapType = "", spawn = "", observations = [] } = {},
) {
  return records.filter(
    (record) =>
      (!nightlord || record.nightlord === nightlord) &&
      (!mapType || record.mapType === mapType) &&
      (!spawn || record.spawn === spawn) &&
      observations.every((observation) =>
        matchesObservation(record, observation),
      ),
  );
}
export function facetCounts(records, query, key, values) {
  const rest = queryMaps(records, { ...query, [key]: "" });
  return new Map(
    values.map((value) => [
      value,
      rest.filter((record) => record[key] === value).length,
    ]),
  );
}
