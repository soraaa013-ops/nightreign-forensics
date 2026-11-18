// One geographic tower, three floor facts. Candidate summaries follow active evidence.
export function towerFloors(records, key) {
  const slots = records.map((r) => r.slots.find((s) => s.key === key));
  return [0, 1, 2].map((index) => {
    const values = [
      ...new Set(slots.map((s) => s?.floors?.[index]).filter(Boolean)),
    ];
    return {
      floor: index + 1,
      values,
      certain:
        slots.length > 0 &&
        values.length === 1 &&
        slots.every((s) => s?.floors?.[index] === values[0]),
    };
  });
}
