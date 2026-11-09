export function filterMapRecords(records, query = {}) {
  const observations = query.observations || [];
  return records.filter((record) => {
    if (query.nightlord && record.nightlord !== query.nightlord) return false;
    if (query.mapType && record.mapType !== query.mapType) return false;
    if (query.spawn && record.spawn !== query.spawn) return false;
    return observations.every(({ key, value }) => record.slots.some((slot) => slot.key === key && (slot.value || "empty") === value));
  });
}

export function recommendObservation(records, excludedKeys = []) {
  if (records.length < 2) return null;
  const excluded = new Set(excludedKeys);
  const options = new Map();
  records.forEach((record) => record.slots.forEach((slot) => {
    if (excluded.has(slot.key)) return;
    const values = options.get(slot.key) || new Map();
    const value = slot.value || "empty";
    values.set(value, (values.get(value) || 0) + 1);
    options.set(slot.key, values);
  }));
  let best = null;
  for (const [key, values] of options) {
    if (values.size < 2) continue;
    const score = 1 - [...values.values()].reduce((sum, count) => sum + (count / records.length) ** 2, 0);
    if (!best || score > best.score) best = { key, score, values: [...values.keys()].sort() };
  }
  return best;
}
