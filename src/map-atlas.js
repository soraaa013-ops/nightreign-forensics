import { queryMaps } from "./map-query.js";
import {
  nearestPoints,
  pointObservations,
  pointConsensus,
} from "./map-spatial.js";
import { loadJson } from "./locale.js";

export async function createAtlas({ data, zh, getState, change }) {
  const $ = (id) => document.getElementById(id);
  const viewport = $("atlas-viewport"),
    tiles = $("atlas-tiles"),
    layer = $("atlas-points"),
    editor = $("atlas-editor");
  const geometry = await loadJson("data/map-geometry.json");
  let zoom = 1,
    pan = { x: 0, y: 0 },
    active = null,
    neighbors = [],
    terrain = "",
    points = [],
    records = [],
    lastFocus = null;
  let size = 1,
    origin = { x: 0, y: 0 },
    buttons = [],
    imageGeneration = 0;
  const pointers = new Map();
  let gesture = null,
    hover = null;
  const el = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  const btn = (text, fn, cls = "secondary") => {
    const b = el("button", text, cls);
    b.type = "button";
    b.onclick = fn;
    return b;
  };
  const label = (point) =>
    `${point.spawn ? "出生位置" : zh(point.category)} · ${zh(point.location)}`;
  const observed = (point) =>
    point.spawn
      ? getState().spawn === point.spawn
      : getState().observations.some((o) => o.key === point.key);
  const pointName = (point) => {
    const observation = getState().observations.find(
      (o) => o.key === point.key,
    );
    if (observed(point))
      return point.spawn
        ? "已确认出生位置"
        : `已确认：${observation.value === "empty" ? "此处为空" : zh(observation.value)}`;
    const common = pointConsensus(records, point);
    return common
      ? `推测：${common === "spawn" ? "出生位置" : zh(common)}`
      : "待观察";
  };
  function measure() {
    size = Math.min(viewport.clientWidth, viewport.clientHeight) * zoom;
    origin = {
      x: (viewport.clientWidth - size) / 2 + pan.x,
      y: (viewport.clientHeight - size) / 2 + pan.y,
    };
  }
  function draw() {
    measure();
    tiles.style.width = `${size}px`;
    tiles.style.height = `${size}px`;
    tiles.style.transform = `translate(${origin.x}px,${origin.y}px)`;
    for (const { point, b } of buttons) {
      const x = origin.x + point.x * size,
        y = origin.y + point.y * size;
      b.style.left = `${x}px`;
      b.style.top = `${y}px`;
      b.hidden =
        x < 0 || y < 0 || x > viewport.clientWidth || y > viewport.clientHeight;
      b.classList.toggle("hovered", hover?.id === point.id);
      b.classList.toggle("active", active?.id === point.id);
    }
    $("atlas-out").disabled = zoom <= 1;
    $("atlas-in").disabled = zoom >= 5;
  }
  function zoomTo(
    next,
    cx = viewport.clientWidth / 2,
    cy = viewport.clientHeight / 2,
  ) {
    measure();
    const x = (cx - origin.x) / size,
      y = (cy - origin.y) / size;
    zoom = Math.max(1, Math.min(5, next));
    const newSize =
      Math.min(viewport.clientWidth, viewport.clientHeight) * zoom;
    pan = {
      x: cx - x * newSize - (viewport.clientWidth - newSize) / 2,
      y: cy - y * newSize - (viewport.clientHeight - newSize) / 2,
    };
    draw();
  }
  function close() {
    editor.hidden = true;
    active = null;
    draw();
    const focusTarget = buttons.find(
      (x) => x.point.id === lastFocus?.dataset.point,
    )?.b;
    focusTarget?.focus({ preventScroll: true });
  }
  function apply(next, message) {
    change(next);
    editor
      .querySelector('.atlas-option[aria-pressed="true"], .atlas-spawn')
      ?.focus({ preventScroll: true });
    $("atlas-status").textContent = records.length
      ? `${message}，剩余 ${records.length} 份候选。`
      : "这条标记与已有条件不匹配，或不在当前档案中。请修改标记或撤销上一步。";
  }
  function open(point, near = [point], focus = true) {
    active = point;
    neighbors = near;
    lastFocus = buttons.find((x) => x.point.id === point.id)?.b;
    renderEditor();
    draw();
    if (focus && window.matchMedia("(max-width:800px)").matches)
      viewport.scrollIntoView({ block: "start", behavior: "auto" });
    if (focus) editor.querySelector("button")?.focus({ preventScroll: true });
  }
  function renderEditor() {
    if (!active) return;
    const point = active;
    editor.hidden = false;
    const header = el("div", null, "atlas-editor-head");
    header.append(el("h2", label(point)));
    header.firstChild.id = "atlas-point-title";
    header.append(btn("关闭", close));
    const content = [header];
    if (neighbors.length > 1) {
      const choices = el("div", null, "atlas-neighbors");
      choices.append(el("p", "附近有多个位置，可以切换："));
      neighbors.forEach((p) => {
        const b = btn(label(p), () => open(p, neighbors, false));
        b.setAttribute("aria-pressed", String(p.id === point.id));
        choices.append(b);
      });
      content.push(choices);
    }
    const current = el("p", pointName(point), "atlas-current");
    content.push(current);
    if (point.spawn) {
      const next = { ...getState(), spawn: point.spawn };
      const count = queryMaps(data.records, next).length;
      content.push(
        btn(
          `这里是出生点 · ${count} 份候选`,
          () => apply(next, "已标记出生位置"),
          "primary atlas-spawn",
        ),
      );
      if (observed(point))
        content.push(
          btn("移除出生标记", () =>
            apply({ ...getState(), spawn: "" }, "已移除出生标记"),
          ),
        );
    } else {
      // Keep all known values available, including conflicting ones, so a mistaken clue can be corrected.
      const values = [
        ...new Set(
          data.records
            .filter(
              (r) => !getState().mapType || r.mapType === getState().mapType,
            )
            .flatMap((r) =>
              r.slots
                .filter((s) => s.key === point.key)
                .map((s) => s.value || "empty"),
            ),
        ),
      ];
      const types = [
        ...new Set(
          values.filter((v) => v.includes(" - ")).map((v) => v.split(" - ")[0]),
        ),
      ];
      const makeOption = (value, match = "exact") => {
        const observation = {
          key: point.key,
          category: point.category,
          value,
          ...(match === "type" ? { match } : {}),
        };
        const next = pointObservations(getState(), point, observation);
        const count = queryMaps(data.records, next).length;
        const title = value === "empty" ? "确认此处为空" : zh(value);
        const b = btn(
          "",
          () => apply(next, `已标记“${title}”`),
          "atlas-option",
        );
        b.append(
          el("span", title),
          el("small", count ? `${count} 份候选` : "无匹配 · 可标记后纠错"),
        );
        b.dataset.value = value;
        b.dataset.match = match;
        const selected = getState().observations.find(
          (o) => o.key === point.key,
        );
        b.setAttribute(
          "aria-pressed",
          String(
            selected?.value === value && (selected.match || "exact") === match,
          ),
        );
        return b;
      };
      if (types.length) {
        const group = el("div", null, "atlas-type-options");
        group.append(el("h3", "只知道建筑类型？先标记即可"));
        types.forEach((type) => group.append(makeOption(type, "type")));
        content.push(group);
      }
      const search = el("input");
      search.type = "search";
      search.placeholder = "筛选这里的敌人或内容";
      search.setAttribute("aria-label", "搜索这个点位的内容");
      const list = el("div", null, "atlas-options");
      const fill = () => {
        const q = search.value.trim();
        const filtered = values.filter((v) =>
          (v === "empty" ? "确认此处为空" : zh(v)).includes(q),
        );
        list.replaceChildren(
          ...filtered
            .sort((a, b) => zh(a).localeCompare(zh(b), "zh-CN"))
            .map((v) => makeOption(v)),
        );
        if (!filtered.length)
          list.append(el("p", "这里没有这项记录，请换个关键词或检查点位。"));
      };
      search.oninput = fill;
      fill();
      content.push(el("h3", "知道具体内容时"), search, list);
      if (observed(point))
        content.push(
          btn("移除此处标记", () =>
            apply(pointObservations(getState(), point, null), "已移除点位标记"),
          ),
        );
    }
    if (!records.length)
      content.push(
        el(
          "p",
          "没有匹配档案。请检查本次标记，也可以使用“撤销上一步”。",
          "atlas-conflict",
        ),
      );
    const undo = btn("撤销上一步", () =>
      document.getElementById("undo-map").click(),
    );
    undo.disabled = document.getElementById("undo-map").disabled;
    content.push(undo);
    editor.replaceChildren(...content);
  }
  function rebuild() {
    const state = getState();
    records = queryMaps(data.records, state);
    const inferredTerrains = [...new Set(records.map((r) => r.mapType))];
    const displayTerrain =
      state.mapType ||
      (inferredTerrains.length === 1 ? inferredTerrains[0] : "Default");
    if (displayTerrain !== terrain) {
      terrain = displayTerrain;
      zoom = 1;
      pan = { x: 0, y: 0 };
      const generation = ++imageGeneration;
      $("atlas-loading").hidden = false;
      $("atlas-loading").textContent = "正在载入底图…";
      let loaded = 0,
        failed = false;
      const images = [];
      for (let row = 0; row < 6; row++)
        for (let col = 0; col < 6; col++) {
          const img = el("img");
          img.alt = "";
          img.draggable = false;
          img.onload = () => {
            if (generation !== imageGeneration) return;
            if (++loaded === 36 && !failed) $("atlas-loading").hidden = true;
          };
          img.onerror = () => {
            if (generation !== imageGeneration) return;
            failed = true;
            $("atlas-loading").hidden = false;
            $("atlas-loading").replaceChildren(
              el("span", "部分底图未能载入。"),
              btn("重试底图", () => {
                terrain = "";
                rebuild();
              }),
            );
          };
          img.src = `assets/maps/${geometry.layouts[terrain]}/${col}-${5 - row}.webp`;
          images.push(img);
        }
      tiles.replaceChildren(...images);
    }
    points = geometry.points.filter((p) => p.terrains.includes(displayTerrain));
    buttons = points.map((point) => {
      const common = pointConsensus(records, point);
      const content =
        getState().observations.find((o) => o.key === point.key)?.value ||
        common;
      const glyph = {
        Camp: "营",
        "Small Camp": "营",
        Church: "教",
        "Great Church": "教",
        Ruins: "遗",
        Fort: "堡",
        "Sorcerer's Rise": "塔",
        "Difficult Sorcerer's Rise": "塔",
        Township: "镇",
        empty: "空",
      }[content?.split(" - ")[0]];
      const b = btn(
        point.spawn
          ? "出"
          : glyph ||
              (point.category === "Evergaol"
                ? "牢"
                : point.category.includes("Boss")
                  ? "敌"
                  : point.category === "Castle"
                    ? "城"
                    : "点"),
        () => open(point, nearAt(point)),
        "atlas-point",
      );
      b.dataset.point = point.id;
      b.title = `${label(point)} · ${pointName(point)}`;
      b.setAttribute("aria-label", b.title);
      b.classList.toggle("observed", observed(point));
      b.classList.toggle(
        "inferred",
        !observed(point) && !!pointConsensus(records, point),
      );
      return { point, b };
    });
    layer.replaceChildren(...buttons.map((x) => x.b));
    $("atlas-count").textContent =
      records.length === 1
        ? `已锁定 #${records[0].id} · 点击点位查看内容`
        : `${records.length} 份候选`;
    $("atlas-undo").disabled = document.getElementById("undo-map").disabled;
    $("atlas-hint").textContent = state.mapType
      ? `${zh(state.mapType)} · 点选位置，标记你看到的内容。`
      : inferredTerrains.length === 1
        ? `由候选推测地形：${zh(displayTerrain)}。仍可继续标记。`
        : "当前展示普通地形；遇到特异地形，请在上方选择。";
    if (active) {
      const found = points.find((p) => p.id === active.id);
      if (found) {
        active = found;
        neighbors = nearAt(active);
        renderEditor();
      } else {
        active = null;
        editor.hidden = true;
      }
    }
    draw();
  }
  function nearAt(point) {
    measure();
    return nearestPoints(points, point.x, point.y, size, 32);
  }
  function local(event) {
    const r = viewport.getBoundingClientRect();
    return { x: event.clientX - r.left, y: event.clientY - r.top };
  }
  function nearEvent(event) {
    measure();
    const p = local(event);
    return nearestPoints(
      points,
      (p.x - origin.x) / size,
      (p.y - origin.y) / size,
      size,
      event.pointerType === "touch" ? 36 : 28,
    );
  }
  viewport.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button:not(.atlas-point)")) return;
    const p = local(event);
    pointers.set(event.pointerId, p);
    viewport.setPointerCapture(event.pointerId);
    gesture = {
      start: p,
      pan: { ...pan },
      moved: false,
      startId: event.target.closest(".atlas-point")?.dataset.point,
    };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      gesture = {
        ...gesture,
        moved: true,
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        zoom,
      };
    }
  });
  viewport.addEventListener("pointermove", (event) => {
    const p = local(event);
    if (!pointers.has(event.pointerId)) {
      const near = nearEvent(event);
      hover = near[0] || null;
      draw();
      return;
    }
    pointers.set(event.pointerId, p);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (gesture.distance)
        zoomTo(
          (gesture.zoom * distance) / gesture.distance,
          (a.x + b.x) / 2,
          (a.y + b.y) / 2,
        );
      gesture.moved = true;
      return;
    }
    if (!gesture) return;
    const dx = p.x - gesture.start.x,
      dy = p.y - gesture.start.y;
    if (Math.hypot(dx, dy) > 6) gesture.moved = true;
    if (gesture.moved) {
      const bound =
        Math.max(viewport.clientWidth, viewport.clientHeight) * zoom;
      pan = {
        x: Math.max(-bound, Math.min(bound, gesture.pan.x + dx)),
        y: Math.max(-bound, Math.min(bound, gesture.pan.y + dy)),
      };
      draw();
    }
  });
  viewport.addEventListener("pointerup", (event) => {
    if (!pointers.has(event.pointerId)) return;
    const click = gesture && !gesture.moved;
    pointers.delete(event.pointerId);
    if (click) {
      const near = nearEvent(event);
      if (near.length)
        open(points.find((p) => p.id === gesture.startId) || near[0], near);
      else
        $("atlas-status").textContent =
          "附近没有可标记点位。请放大地图，点击圆点附近。";
    }
    if (pointers.size) {
      const p = [...pointers.values()][0];
      gesture = { start: p, pan: { ...pan }, moved: true };
    } else gesture = null;
  });
  viewport.addEventListener("pointercancel", () => {
    pointers.clear();
    gesture = null;
  });
  viewport.addEventListener("pointerleave", () => {
    hover = null;
    draw();
  });
  viewport.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const p = local(event);
      zoomTo(zoom * (event.deltaY < 0 ? 1.15 : 1 / 1.15), p.x, p.y);
    },
    { passive: false },
  );
  viewport.addEventListener("keydown", (event) => {
    if (event.target !== viewport) return;
    if (
      [
        "+",
        "=",
        "-",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
      ].includes(event.key)
    )
      event.preventDefault();
    if (event.key === "+" || event.key === "=") zoomTo(zoom * 1.3);
    if (event.key === "-") zoomTo(zoom / 1.3);
    if (event.key.startsWith("Arrow")) {
      pan.x +=
        event.key === "ArrowLeft" ? 50 : event.key === "ArrowRight" ? -50 : 0;
      pan.y +=
        event.key === "ArrowUp" ? 50 : event.key === "ArrowDown" ? -50 : 0;
      draw();
    }
  });
  editor.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
  $("atlas-undo").onclick = () => document.getElementById("undo-map").click();
  $("atlas-in").onclick = () => zoomTo(zoom * 1.4);
  $("atlas-out").onclick = () => zoomTo(zoom / 1.4);
  $("atlas-fit").onclick = () => {
    zoom = 1;
    pan = { x: 0, y: 0 };
    draw();
  };
  new ResizeObserver(draw).observe(viewport);
  rebuild();
  return {
    refresh: rebuild,
    focusPoint(key) {
      const p = points.find((p) => p.key === key);
      if (p) {
        pan = { x: 0, y: 0 };
        zoom = 1;
        draw();
        open(p, nearAt(p));
        viewport.scrollIntoView({ block: "center", behavior: "auto" });
        return true;
      }
      return false;
    },
  };
}
