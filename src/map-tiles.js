// Small previews cover fast navigation; only two visited maps retain decoded tiles.
export const MAP_LAYOUTS = {
  Default: "default",
  Crater: "the_crater_shifted",
  Mountaintop: "the_mountaintop_shifted",
  Noklateo: "noklateo_shifted",
  "Rotted Woods": "the_rotten_woods_shifted",
  "Great Hollow": "great_hollow",
};
const previews = new Map(),
  maps = new Map();
function imageResource(src, priority = "auto") {
  const image = new Image();
  image.alt = "";
  image.draggable = false;
  image.decoding = "async";
  image.fetchPriority = priority;
  const resource = { image, ready: false };
  resource.promise = new Promise((resolve, reject) => {
    image.onload = async () => {
      try {
        await image.decode();
        resource.ready = true;
        resolve(image);
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new Error(`Map image unavailable: ${src}`));
    image.src = src;
  });
  return resource;
}
export function previewMap(layout, priority = "low") {
  if (!previews.has(layout)) {
    const entry = imageResource(
      `assets/maps/previews/${layout}.webp`,
      priority,
    );
    entry.promise.catch(() => {
      if (previews.get(layout) === entry) previews.delete(layout);
    });
    previews.set(layout, entry);
  }
  const entry = previews.get(layout);
  if (priority === "high") entry.image.fetchPriority = "high";
  return entry;
}
export function prepareMap(layout) {
  if (maps.has(layout)) {
    const entry = maps.get(layout);
    maps.delete(layout);
    maps.set(layout, entry);
    return entry;
  }
  const resource = imageResource(`assets/maps/hd/${layout}.webp`, "low");
  resource.image.className = "atlas-overview";
  const entry = { ready: false, images: [resource.image] };
  entry.promise = resource.promise
    .then(() => {
      entry.ready = true;
      // Pending entries and the active request remain intact, older decoded maps are released.
      for (const [key, value] of maps) {
        if (maps.size <= 2) break;
        if (key !== layout && value.ready) maps.delete(key);
      }
      return entry.images;
    })
    .catch((error) => {
      if (maps.get(layout) === entry) maps.delete(layout);
      throw error;
    });
  // Speculative work may finish before a viewer subscribes.
  entry.promise.catch(() => {});
  maps.set(layout, entry);
  return entry;
}
let warmScheduled = false;
export function warmMapPreviews() {
  const connection = navigator.connection;
  if (
    warmScheduled ||
    connection?.saveData ||
    /(^|-)2g$/.test(connection?.effectiveType || "")
  )
    return;
  warmScheduled = true;
  const run = async () => {
    // Sequential low-priority work avoids a burst competing with foreground requests.
    for (const layout of [...Object.values(MAP_LAYOUTS), "great_hollow_under"])
      try {
        await previewMap(layout).promise;
      } catch {
        /* On-demand retry remains available. */
      }
  };
  if (globalThis.requestIdleCallback)
    requestIdleCallback(run, { timeout: 2000 });
  else setTimeout(run, 500);
}
