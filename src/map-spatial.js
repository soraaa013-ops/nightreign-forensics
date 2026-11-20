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
  if (point.spawn)
    return records.every((r) => r.spawn === point.spawn) ? "spawn" : null;
  const first = records[0].slots.find((s) => s.key === point.key);
  if (!first) return null;
  const value = first.value || "empty";
  if (
    point.tower &&
    (first.floors?.length !== 3 || first.floors.some((v) => !v))
  )
    return null;
  for (let i = 1; i < records.length; i++) {
    const slot = records[i].slots.find((s) => s.key === point.key);
    if (!slot || (slot.value || "empty") !== value) return null;
    if (
      point.tower &&
      (slot.floors?.length !== 3 ||
        slot.floors.some((v, j) => !v || v !== first.floors[j]))
    )
      return null;
  }
  return value;
}

// Merge overlapping screen hit areas, not geographic locations. Every point stays in a group.
export function clusterPoints(points, scale, spacing = 48) {
  const groups = points.map((point) => ({
    x: point.x,
    y: point.y,
    points: [point],
  }));
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < groups.length; i++)
      for (let j = i + 1; j < groups.length; j++) {
        const a = groups[i],
          b = groups[j];
        if (
          Math.abs(a.x - b.x) * scale < spacing &&
          Math.abs(a.y - b.y) * scale < spacing
        ) {
          const members = [...a.points, ...b.points];
          groups[i] = {
            x: members.reduce((sum, p) => sum + p.x, 0) / members.length,
            y: members.reduce((sum, p) => sum + p.y, 0) / members.length,
            points: members,
          };
          groups.splice(j, 1);
          changed = true;
          break outer;
        }
      }
  }
  return groups;
}
export function pointInLayer(point, layer) {
  if (layer === "all") return true;
  if (layer === "spawn") return Boolean(point.spawn);
  if (point.spawn) return false;
  if (layer === "base")
    return ["Major Base", "Minor Base", "Castle"].includes(point.category);
  if (layer === "gaol") return point.category === "Evergaol";
  return ["Field Boss", "Arena Boss", "Rotted Woods"].includes(point.category);
}
