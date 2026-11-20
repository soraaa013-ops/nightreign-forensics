import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
const requests = [],
  failures = new Set();
let decodeGate = Promise.resolve();
globalThis.Image = class {
  set src(value) {
    this.url = value;
    requests.push(value);
    queueMicrotask(() =>
      failures.has(value) ? this.onerror() : this.onload(),
    );
  }
  decode() {
    return decodeGate;
  }
};
const { prepareMap, previewMap } = await import("../src/map-tiles.js");
test("pending work is deduplicated and only becomes ready after image decoding", async () => {
  let release;
  decodeGate = new Promise((resolve) => (release = resolve));
  const first = prepareMap("pending");
  assert.equal(prepareMap("pending"), first);
  await Promise.resolve();
  assert.equal(first.ready, false);
  assert.equal(requests.length, 1);
  release();
  await first.promise;
  assert.equal(first.ready, true);
  assert.equal(first.images.length, 1);
  decodeGate = Promise.resolve();
});
test("two recent decoded maps are retained and repeated visits do not request tiles again", async () => {
  const a = prepareMap("a");
  await a.promise;
  const b = prepareMap("b");
  await b.promise;
  const count = requests.length;
  assert.equal(prepareMap("a"), a);
  assert.equal(requests.length, count);
  await prepareMap("c").promise;
  assert.equal(prepareMap("a"), a);
  assert.notEqual(prepareMap("b"), b);
});
test("a failed map or overview can be requested again instead of caching rejection", async () => {
  failures.add("assets/maps/hd/failure.webp");
  const broken = prepareMap("failure");
  await assert.rejects(broken.promise);
  failures.clear();
  const retry = prepareMap("failure");
  assert.notEqual(retry, broken);
  await retry.promise;
  assert.equal(retry.ready, true);
  failures.add("assets/maps/previews/failure.webp");
  await assert.rejects(previewMap("failure").promise);
  failures.clear();
  assert.ok(await previewMap("failure").promise);
});
test("previews keep seven complete maps within a 300 KiB total budget, with verified provenance", () => {
  const manifest = JSON.parse(
    fs.readFileSync("assets/maps/previews/provenance.json"),
  );
  assert.equal(manifest.length, 7);
  assert.ok(manifest.reduce((sum, m) => sum + m.bytes, 0) < 300 * 1024);
  for (const m of manifest) {
    assert.equal(m.sources.length, 36);
    assert.equal(
      createHash("sha256").update(fs.readFileSync(m.path)).digest("hex"),
      m.sha256,
    );
  }
});
