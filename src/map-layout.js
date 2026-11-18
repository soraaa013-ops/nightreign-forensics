// Screen-space layout keeps every geographic point separate. Only labels may be omitted.
export function overlaps(a, b, gap = 3) {
  return (
    a.x < b.x + b.width + gap &&
    a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap &&
    a.y + a.height + gap > b.y
  );
}
export function detailLevel(scale, mode = "auto") {
  if (mode === "none") return 0;
  if (mode === "names") return 1;
  if (mode === "details") return 2;
  return scale >= 1500 ? 2 : scale >= 800 ? 1 : 0;
}
export function layoutMarkers(items, width, height, diameter, obstacles = []) {
  const occupied = [...obstacles],
    result = [];
  const inside = (box) =>
    box.x >= 4 &&
    box.y >= 4 &&
    box.x + box.width <= width - 4 &&
    box.y + box.height <= height - 4;
  for (const item of items) {
    if (item.x < 0 || item.y < 0 || item.x > width || item.y > height) continue;
    let placed;
    const step = 4;
    // Closest available position on expanding rings; original coordinates never change.
    for (
      let ring = 0;
      !placed && ring * step < Math.hypot(width, height) + step;
      ring++
    ) {
      const count = ring
        ? Math.max(8, Math.ceil((2 * Math.PI * ring * step) / 8))
        : 1;
      for (let i = 0; i < count; i++) {
        const angle = (i * Math.PI * 2) / count;
        const box = {
          x: item.x + Math.cos(angle) * ring * step - diameter / 2,
          y: item.y + Math.sin(angle) * ring * step - diameter / 2,
          width: diameter,
          height: diameter,
        };
        if (inside(box) && !occupied.some((other) => overlaps(box, other))) {
          placed = box;
          break;
        }
      }
    }
    if (!placed)
      throw new Error("Map marker layout exceeds available screen space");
    occupied.push(placed);
    result.push({
      ...item,
      box: placed,
      screenX: placed.x + diameter / 2,
      screenY: placed.y + diameter / 2,
    });
  }
  return result;
}
export function layoutLabels(markers, width, height, sizes, obstacles = []) {
  const occupied = [...obstacles, ...markers.map((m) => m.box)],
    result = [];
  for (const marker of markers) {
    const size = sizes.get(marker.id);
    if (!size) continue;
    const { width: w, height: h } = size,
      b = marker.box;
    const anchors = [
      { x: b.x + b.width + 7, y: marker.screenY - h / 2 },
      { x: b.x - w - 7, y: marker.screenY - h / 2 },
      { x: marker.screenX - w / 2, y: b.y - h - 7 },
      { x: marker.screenX - w / 2, y: b.y + b.height + 7 },
    ];
    const box = anchors
      .map((p) => ({ ...p, width: w, height: h }))
      .find(
        (box) =>
          box.x >= 4 &&
          box.y >= 4 &&
          box.x + w <= width - 4 &&
          box.y + h <= height - 4 &&
          !occupied.some((other) => overlaps(box, other)),
      );
    if (box) {
      occupied.push(box);
      result.push({ id: marker.id, ...box });
    }
  }
  return result;
}
export function focusZoom(point, points, baseSize, zoom, targetSpacing = 60) {
  const distances = points
    .filter((p) => p.id !== point.id)
    .map((p) => Math.hypot(p.x - point.x, p.y - point.y))
    .filter((d) => d > 0.0001);
  const nearest = Math.min(...distances);
  return Math.min(
    12,
    Math.max(
      zoom * 1.8,
      1000 / baseSize,
      Number.isFinite(nearest)
        ? targetSpacing / (nearest * baseSize)
        : zoom * 1.8,
    ),
  );
}
