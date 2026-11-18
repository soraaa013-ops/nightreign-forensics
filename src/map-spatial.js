// Coordinates are normalized to the full surface map, independent of zoom.
export function nearestPoints(points, x, y, scale, radius = 28) {
  return points
    .map((point) => ({
      point,
      distance: Math.hypot(point.x - x, point.y - y) * scale,
    }))
    .filter((item) => item.distance <= radius)
    .sort((a, b) => a.distance - b.distance)
    .map((item) => item.point);
}
export function pointObservations(state, point, observation) {
  return {
    ...state,
    observations: [
      ...state.observations.filter((item) => item.key !== point.key),
      ...(observation ? [observation] : []),
    ],
  };
}
export function pointConsensus(records, point) {
  if (!records.length) return null;
  const values = records.map((record) =>
    point.spawn
      ? record.spawn === point.spawn
        ? "spawn"
        : null
      : record.slots.find((slot) => slot.key === point.key)?.value || null,
  );
  return values[0] && values.every((value) => value === values[0])
    ? values[0]
    : null;
}
