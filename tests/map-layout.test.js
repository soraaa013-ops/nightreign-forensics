import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  detailLevel,
  layoutMarkers,
  layoutLabels,
  overlaps,
  focusZoom,
} from "../src/map-layout.js";
const read = (n) =>
  JSON.parse(readFileSync(new URL(`../data/${n}.json`, import.meta.url)));
const points = [
  ...read("map-geometry").points,
  ...read("map-dlc-geometry").points,
];
test("all independent on-screen points survive collision layout at every screen/terrain/scale", () => {
  for (const terrain of [
    "Default",
    "Mountaintop",
    "Crater",
    "Rotted Woods",
    "Noklateo",
    "Great Hollow",
  ])
    for (const [w, h] of [
      [320, 468],
      [390, 744],
      [768, 744],
      [1440, 800],
    ])
      for (const zoom of [1, 2, 5, 12]) {
        const scale = Math.min(w, h) * zoom,
          diameter = detailLevel(scale) ? (w < 760 ? 44 : 32) : 28;
        const input = points
          .filter((p) => p.terrains.includes(terrain))
          .map((p) => ({
            id: p.id,
            x: (w - scale) / 2 + p.x * scale,
            y: (h - scale) / 2 + p.y * scale,
          }));
        const obstacles = [
          { x: w - 60, y: 14, width: 44, height: 132 },
          { x: 12, y: 14, width: 110, height: 44 },
        ];
        const result = layoutMarkers(input, w, h, diameter, obstacles);
        assert.equal(
          result.length,
          input.filter((p) => p.x >= 0 && p.y >= 0 && p.x <= w && p.y <= h)
            .length,
        );
        for (let i = 0; i < result.length; i++)
          for (const other of [
            ...result.slice(i + 1).map((p) => p.box),
            ...obstacles,
          ])
            assert.ok(!overlaps(result[i].box, other, 0));
        const labels = layoutLabels(
          result,
          w,
          h,
          new Map(result.map((p) => [p.id, { width: 140, height: 68 }])),
          obstacles,
        );
        for (let i = 0; i < labels.length; i++)
          for (const other of [
            ...labels.slice(i + 1),
            ...result.map((p) => p.box),
            ...obstacles,
          ])
            assert.ok(!overlaps(labels[i], other, 0));
      }
});
test("identical coordinates remain separate and deterministic", () => {
  const input = Array.from({ length: 12 }, (_, i) => ({
    id: String(i),
    x: 180,
    y: 220,
  }));
  const output = layoutMarkers(input, 390, 744, 44);
  assert.equal(output.length, 12);
  assert.deepEqual(layoutMarkers(input, 390, 744, 44), output);
  assert.ok(output.some((p) => p.x !== p.screenX || p.y !== p.screenY));
});
test("disclosure follows usable map scale and explicit display preference", () => {
  assert.deepEqual(
    [390, 850, 1600].map((s) => detailLevel(s)),
    [0, 1, 2],
  );
  assert.equal(detailLevel(320, "details"), 2);
  assert.equal(detailLevel(2000, "none"), 0);
  assert.equal(detailLevel(2000, "names"), 1);
  const a = { id: "a", x: 0.5, y: 0.5 },
    b = { id: "b", x: 0.51, y: 0.51 };
  assert.ok(focusZoom(a, [a, b], 390, 1) > 1);
  assert.ok(focusZoom(a, [a, b], 390, 10) <= 12);
});
