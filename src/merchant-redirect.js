// Keep previously shared merchant URLs working in the combined workspace.
const old = new URL(location.href);
const url = new URL("map.html", location.href);
url.searchParams.set("panel", "merchant");
if (old.searchParams.has("q"))
  url.searchParams.set("merchant", old.searchParams.get("q"));
if (old.searchParams.has("shop"))
  url.searchParams.set("shop", old.searchParams.get("shop"));
location.replace(url);
