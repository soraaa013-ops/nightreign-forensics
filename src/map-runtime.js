// Expand the transport representation once; filtering sees the original records.
export function decodeMapRuntime(bundle) {
  if (bundle.schema !== 1) throw new Error("地图数据版本不受支持");
  const iconRecords = {};
  const records = bundle.records.map(({ slots, icons, ...record }) => {
    iconRecords[record.id] = Object.fromEntries(
      icons.map((code) => [
        bundle.keys[Math.floor(code / 256)],
        bundle.icons[code % 256],
      ]),
    );
    return { ...record, slots: slots.map((index) => bundle.slots[index]) };
  });
  return {
    metadata: bundle.metadata,
    records,
    iconRecords,
    facets: Object.fromEntries(
      [
        ["nightlords", "nightlord"],
        ["mapTypes", "mapType"],
        ["spawns", "spawn"],
      ].map(([plural, key]) => [
        plural,
        [...new Set(records.map((r) => r[key]))],
      ]),
    ),
  };
}
