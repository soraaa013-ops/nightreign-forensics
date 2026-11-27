import { matchesSearch } from "./search.js?v=merchant-1";
const compareChinese = new Intl.Collator("zh-CN").compare;
import {
  previewMap,
  prepareMap,
  warmMapPreviews,
} from "./map-tiles.js?v=perf-1";
import {
  merchantEmphasis,
  pointIcon,
  typeIcon,
  iconPath,
  iconLabel,
} from "./map-icons.js?v=merchant-1";
import { pointTitle } from "./map-presentation.js?v=perf-1";
import { towerFloors } from "./map-tower.js?v=towers-1";
import { queryMaps } from "./map-query.js?v=perf-1";
import {
  pointInLayer,
  pointObservations,
  pointConsensus,
} from "./map-spatial.js?v=perf-1";
import {
  detailLevel,
  layoutMarkers,
  layoutLabels,
  focusZoom,
} from "./map-layout.js?v=spatial-2";
import { readDraft, writeDraft } from "./draft.js";
import { loadJson } from "./locale.js";

export async function createAtlas({ data, zh, getState, change }) {
  const $ = (id) => document.getElementById(id);
  const viewport = $("atlas-viewport"),
    tiles = $("atlas-tiles"),
    layer = $("atlas-points"),
    editor = $("atlas-editor");
  const [geometry, extension] = await Promise.all([
    loadJson("data/map-geometry.json"),
    loadJson("data/map-dlc-geometry.json?v=towers-1"),
  ]);
  tiles.dataset.managed = "true";
  geometry.points.push(...extension.points);
  Object.assign(geometry.layouts, extension.layouts);
  let underground = false;
  const depthButton = $("atlas-depth");
  depthButton.addEventListener("click", () => {
    underground = !underground;
    terrain = "";
    rebuild();
  });
  const preferences = readDraft("nightreign-atlas-view-v1") || {};
  const autozoomControl = $("atlas-autozoom");
  autozoomControl.checked = preferences.autozoom !== false;
  const cameraHistory = [],
    focused = new Set();
  const savePreferences = () => {
    writeDraft("nightreign-atlas-view-v1", {
      autozoom: autozoomControl.checked,
    });
    draw();
  };
  autozoomControl.addEventListener("change", savePreferences);
  $("atlas-layer-menu").addEventListener("toggle", () => draw());
  $("atlas-back").addEventListener("click", () => {
    const previous = cameraHistory.pop();
    if (previous) {
      zoom = previous.zoom;
      pan = previous.pan;
      focused.clear();
      close(false);
      draw();
    }
  });
  let zoom = 1,
    pan = { x: 0, y: 0 },
    active = null,
    terrain = "",
    points = [],
    records = [],
    lastFocus = null,
    layerMode = "all",
    groups = [],
    layoutKey = "",
    revision = 0,
    editing = false;
  const circles = $("atlas-circles");
  let size = 1,
    origin = { x: 0, y: 0 },
    buttons = [],
    imageGeneration = 0,
    mapPending = false,
    loadingTimer;
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
  const label = (point) => pointTitle(point, records, getState(), zh);
  const locationDetails = (point) => {
    const details = el("details", null, "point-reference");
    details.append(
      el("summary", "详细资料"),
      el("p", `位置：${zh(point.location || point.spawn)}`),
    );

    const known = pointConsensus(records, point);
    if (known && known !== "spawn")
      details.append(el("p", known === "empty" ? "此处为空" : zh(known)));
    return details;
  };
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
      ? `推测：${common === "spawn" ? "出生位置" : common === "empty" ? "此处为空" : zh(common)}`
      : "待观察";
  };
  function measure() {
    size = Math.min(viewport.clientWidth, viewport.clientHeight) * zoom;
    origin = {
      x: (viewport.clientWidth - size) / 2 + pan.x,
      y: (viewport.clientHeight - size) / 2 + pan.y,
    };
  }
  function activateGroup(group, direct = false) {
    if (mapPending) return;
    const point = group.points[0];
    const neighbors = groups.filter(
      (g) =>
        g.points[0].id !== point.id &&
        Math.hypot(g.x - point.x, g.y - point.y) * size <
          (viewport.clientWidth < 760 ? 60 : 42),
    );
    if (
      !direct &&
      autozoomControl.checked &&
      neighbors.length &&
      !focused.has(point.id) &&
      zoom < 12
    ) {
      cameraHistory.push({ zoom, pan: { ...pan } });
      if (cameraHistory.length > 8) cameraHistory.shift();
      focused.clear();
      [point, ...neighbors.map((g) => g.points[0])].forEach((p) =>
        focused.add(p.id),
      );
      zoom = focusZoom(
        point,
        groups.map((g) => g.points[0]),
        Math.min(viewport.clientWidth, viewport.clientHeight),
        zoom,
      );
      const nextSize =
        Math.min(viewport.clientWidth, viewport.clientHeight) * zoom;
      pan = { x: (0.5 - point.x) * nextSize, y: (0.5 - point.y) * nextSize };
      close(false);
      draw();
      $("atlas-status").textContent = "已放大。";
      groups
        .find((g) => g.points[0].id === point.id)
        ?.button.focus({ preventScroll: true });
      if (!pointConsensus(records, point)) return;
    }
    if (
      layerMode === "spawn" &&
      !observed(point) &&
      !pointConsensus(records, point)
    ) {
      active = point;
      apply({ ...getState(), spawn: point.spawn }, "已标记出生位置");
    } else open(point);
  }
  let drawFrame = 0;
  function scheduleDraw() {
    if (!drawFrame)
      drawFrame = requestAnimationFrame(() => {
        drawFrame = 0;
        draw();
      });
  }
  function draw() {
    if (drawFrame) {
      cancelAnimationFrame(drawFrame);
      drawFrame = 0;
    }
    measure();
    tiles.style.width = `${size}px`;
    tiles.style.height = `${size}px`;
    tiles.style.transform = `translate(${origin.x}px,${origin.y}px)`;
    circles.style.width = tiles.style.width;
    circles.style.height = tiles.style.height;
    circles.style.transform = tiles.style.transform;
    $("atlas-back").hidden = !cameraHistory.length;
    const width = viewport.clientWidth,
      height = viewport.clientHeight;
    const level = detailLevel(size);
    const diameter =
      size >= 800 ? (width < 760 ? 44 : 36) : width < 760 ? 24 : 28;
    viewport.dataset.detail = String(level);
    viewport.dataset.zoom = String(zoom);
    $("atlas-scale").textContent =
      level === 2 ? "近看" : level === 1 ? "区域" : "全图";
    const bounds = viewport.getBoundingClientRect();
    const obstacles = [
      document.querySelector(".atlas-controls"),
      $("atlas-layer-name"),
      $("atlas-depth"),
      $("atlas-back"),
      $("atlas-undo"),
      $("atlas-scale"),
    ]
      .filter((n) => n && !n.hidden && !n.disabled)
      .map((n) => {
        const r = n.getBoundingClientRect();
        return {
          x: r.x - bounds.x,
          y: r.y - bounds.y,
          width: r.width,
          height: r.height,
        };
      });
    const key = JSON.stringify([
      size,
      origin.x,
      origin.y,
      width,
      height,
      layerMode,
      revision,
      level,
      diameter,
      obstacles,
    ]);
    if (layoutKey !== key) {
      layoutKey = key;
      groups = points
        .filter((p) => !circleDay() && pointInLayer(p, layerMode))
        .map((point) => ({
          id: point.id,
          x: point.x,
          y: point.y,
          points: [point],
          button: buttons.find((x) => x.point.id === point.id).b,
        }));
      groups.sort(
        (a, b) =>
          Number(!!b.button.dataset.merchant) -
          Number(!!a.button.dataset.merchant),
      );
      const pinBoxes = overlayPins.map(({point: [x, y], symbols}) => ({
        x: origin.x + x * size - symbols.size * 7,
        y: origin.y + y * size - 8,
        width: symbols.size * 14,
        height: 16,
      }));
      const mapObstacles = [...obstacles, ...pinBoxes];
      const placements = layoutMarkers(
        groups.map((g) => ({
          id: g.id,
          x: origin.x + g.x * size,
          y: origin.y + g.y * size,
        })),
        width,
        height,
        diameter,
        Math.min(width, height) < 500 ? obstacles : mapObstacles,
      );
      const byId = new Map(placements.map((p) => [p.id, p]));
      const leaders = [];
      for (const [index, g] of groups.entries()) {
        const b = g.button,
          p = byId.get(g.id);
        b.dataset.group = String(index);
        b.dataset.members = JSON.stringify([g.id]);
        b.hidden = !p;
        if (!p) continue;
        g.screenX = p.screenX;
        g.screenY = p.screenY;
        b.style.left = `${p.screenX}px`;
        b.style.top = `${p.screenY}px`;
        b.style.width =
          b.style.height =
          b.style.minWidth =
          b.style.minHeight =
            `${diameter}px`;
        if (Math.hypot(p.screenX - p.x, p.screenY - p.y) > 3) {
          const line = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "path",
          );
          line.setAttribute("d", `M${p.x},${p.y}L${p.screenX},${p.screenY}`);
          leaders.push(line);
          const dot = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "circle",
          );
          dot.setAttribute("cx", p.x);
          dot.setAttribute("cy", p.y);
          dot.setAttribute("r", 2);
          leaders.push(dot);
        }
      }
      layer.replaceChildren(...groups.map((g) => g.button));
      $("atlas-leaders").replaceChildren(...leaders);
      const entries = new Map(buttons.map((item) => [item.point.id, item]));
      const observations = getState().observations;
      const rank = (id) => observations.findLastIndex((o) => o.key === id);
      const ordered = [...placements].sort((a, b) => rank(b.id) - rank(a.id));
      const sizes = new Map();
      for (const marker of ordered) {
        const headline = entries.get(marker.id)?.headline;
        if (!headline) continue;
        const labelWidth = Math.min(
          156,
          Math.max(48, [...headline].length * 12 + 14),
        );
        const lines = Math.ceil(
          ([...headline].length * 12) / (labelWidth - 14),
        );
        sizes.set(marker.id, { width: labelWidth, height: lines * 16 + 8 });
      }
      const labels = layoutLabels(ordered, width, height, sizes, mapObstacles);
      $("atlas-labels").replaceChildren(
        ...labels.map((box) => {
          const n = el("div", entries.get(box.id).headline, "atlas-map-label");
          n.dataset.for = box.id;
          Object.assign(n.style, {
            left: `${box.x}px`,
            top: `${box.y}px`,
            width: `${box.width}px`,
            height: `${box.height}px`,
          });
          return n;
        }),
      );
    }
    for (const group of groups) {
      group.button.classList.toggle("hovered", hover?.id === group.id);
      group.button.classList.toggle("active", group.id === active?.id);
    }
    $("atlas-out").disabled = zoom <= 1;
    $("atlas-in").disabled = zoom >= 12;
  }
  function zoomTo(
    next,
    cx = viewport.clientWidth / 2,
    cy = viewport.clientHeight / 2,
    deferred = false,
  ) {
    measure();
    const x = (cx - origin.x) / size,
      y = (cy - origin.y) / size;
    if (next < zoom) focused.clear();
    zoom = Math.max(1, Math.min(12, next));
    const newSize =
      Math.min(viewport.clientWidth, viewport.clientHeight) * zoom;
    pan = {
      x: cx - x * newSize - (viewport.clientWidth - newSize) / 2,
      y: cy - y * newSize - (viewport.clientHeight - newSize) / 2,
    };
    if (deferred) scheduleDraw();
    else draw();
  }
  function close(restoreFocus = true) {
    editor.hidden = true;
    active = null;
    draw();
    const focusTarget = buttons.find(
      (x) => x.point.id === lastFocus?.dataset.point,
    )?.b;
    if (restoreFocus)
      (focusTarget?.isConnected ? focusTarget : viewport).focus({
        preventScroll: true,
      });
  }
  function apply(next, message, continueSelection = false) {
    const marked = active;
    active = null;
    change(next);
    const text = records.length
      ? `${message} · 剩余 ${records.length} 份`
      : "没有匹配档案，请修改本次标记或撤销。";
    $("atlas-status").textContent = text;
    if (records.length) {
      if (continueSelection && marked) {
        active = points.find((p) => p.id === marked.id) || marked;
        editing = false;
        $("atlas-toast").hidden = true;
        renderEditor();
        editor.scrollTop = 0;
        draw();
        (
          editor.querySelector(".atlas-quick-exact button") ||
          editor.querySelector("button")
        )?.focus({ preventScroll: true });
        return;
      }
      close(false);
      const toast = $("atlas-toast");
      toast.hidden = false;
      toast.replaceChildren(
        el("span", text),
        btn("撤销", () => {
          document.getElementById("undo-map").click();
          toast.hidden = true;
        }),
      );
      if (marked)
        toast.append(
          btn(marked.spawn ? "修改" : "补充详情", () => {
            toast.hidden = true;
            open(marked);
          }),
        );
      if (
        marked &&
        label(marked) &&
        ![...$("atlas-labels").children].some(
          (n) => n.dataset.for === marked.id,
        )
      ) {
        cameraHistory.push({ zoom, pan: { ...pan } });
        const baseSize = Math.min(viewport.clientWidth, viewport.clientHeight);
        zoom = focusZoom(marked, points, baseSize, zoom, 72);
        pan = {
          x: (0.5 - marked.x) * baseSize * zoom,
          y: (0.5 - marked.y) * baseSize * zoom,
        };
        focused.add(marked.id);
        draw();
      }
      viewport.focus({ preventScroll: true });
    } else {
      active = marked;
      renderEditor();
      draw();
      editor.querySelector("button")?.focus({ preventScroll: true });
    }
  }
  function open(point, focus = true) {
    active = point;
    editing = false;
    lastFocus = buttons.find((x) => x.point.id === point.id)?.b;
    $("atlas-toast").hidden = true;
    renderEditor();
    draw();
    if (focus) editor.querySelector("button")?.focus({ preventScroll: true });
  }
  function renderEditor() {
    if (!active) return;
    const point = active;
    editor.hidden = false;
    const header = el("div", null, "atlas-editor-head");
    const merchantKind = merchantEmphasis(
      pointIcon(point, records, getState(), data.iconRecords),
    );
    header.append(
      el(
        "h2",
        merchantKind === "large"
          ? "大商店"
          : merchantKind === "legendary"
            ? "传奇商店"
            : label(point) || "点位记录",
      ),
    );
    header.firstChild.id = "atlas-point-title";
    header.append(btn("关闭", close));
    const content = [header];
    if (merchantKind) {
      const link = el("a", "检索商人货物", "merchant-map-link");
      link.href = `merchant.html?shop=${merchantKind}`;
      content.push(link);
    }
    const known = pointConsensus(records, point);
    if (point.tower && !editing) {
      const facts = el("div", null, "point-description tower-description");

      for (const floor of towerFloors(records, point.key)) {
        const row = el("section", null, "tower-floor");
        row.append(el("h3", `第${["一", "二", "三"][floor.floor - 1]}层`));
        if (floor.certain)
          row.append(el("p", zh(floor.values[0])), el("small", "当前候选一致"));
        else if (!floor.values.length)
          row.append(el("p", "暂无匹配档案，请先调整筛选条件。"));
        else {
          const choices = el("details");
          choices.append(
            el("summary", `尚未确定 · 查看 ${floor.values.length} 种候选`),
          );
          const list = el("ul");
          floor.values
            .map(zh)
            .sort((a, b) => compareChinese(a, b))
            .forEach((v) => list.append(el("li", v)));
          choices.append(list);
          row.append(choices);
        }
        facts.append(row);
      }
      facts.append(
        btn(
          "记录第三层强敌",
          () => {
            editing = true;
            renderEditor();
          },
          "point-edit",
        ),
      );
      editor.replaceChildren(...content, facts, locationDetails(point));
      return;
    }
    if (point.tower) content.push(el("p", "第三层强敌", "atlas-current"));
    if (known && !editing) {
      const facts = el("div", null, "point-description");
      facts.append(
        el(
          "p",
          (
            point.spawn
              ? getState().spawn === point.spawn
              : getState().observations.some(
                  (o) =>
                    o.key === point.key &&
                    o.match !== "type" &&
                    o.value === known,
                )
          )
            ? "你已确认"
            : "候选档案一致",
          "point-certainty",
        ),
      );
      facts.append(
        btn(
          "修改这处信息",
          () => {
            editing = true;
            renderEditor();
          },
          "point-edit",
        ),
      );
      editor.replaceChildren(...content, facts, locationDetails(point));
      return;
    }

    const current = el("p", pointName(point), "atlas-current");
    if (observed(point) || pointConsensus(records, point))
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
      // Normal selection follows current evidence. Explicit editing excludes only this point’s old observation.
      let values = [
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
      let types = [
        ...new Set(
          values.filter((v) => v.includes(" - ")).map((v) => v.split(" - ")[0]),
        ),
      ];
      const rest = editing
        ? queryMaps(data.records, pointObservations(getState(), point, null))
        : records;
      const exactCounts = new Map(),
        typeCounts = new Map();
      for (const record of rest) {
        const slot = record.slots.find((slot) => slot.key === point.key);
        if (!slot) continue;
        const value = slot.value || "empty";
        exactCounts.set(value, (exactCounts.get(value) || 0) + 1);
        const type = value.split(" - ")[0];
        typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
      }
      values = values.filter((value) => (exactCounts.get(value) || 0) > 0);
      types = types.filter(
        (type) =>
          (typeCounts.get(type) || 0) > 0 && typeCounts.get(type) < rest.length,
      );
      const selected = getState().observations.find((o) => o.key === point.key);
      const makeOption = (value, match = "exact") => {
        const observation = {
          key: point.key,
          category: point.category,
          value,
          ...(match === "type" ? { match } : {}),
        };
        const next = pointObservations(getState(), point, observation);
        const count =
          (match === "type" ? typeCounts : exactCounts).get(value) || 0;
        const localized = zh(value);
        const title =
          value === "empty"
            ? "确认此处为空"
            : match === "exact" &&
                selected?.match === "type" &&
                value.startsWith(`${selected.value} - `)
              ? localized.split(" · ").slice(1).join(" · ") ||
                localized.split(" - ").slice(1).join(" - ") ||
                localized
              : localized;
        const b = btn(
          "",
          () => apply(next, `已标记“${title}”`, match === "type"),
          "atlas-option",
        );
        const path = match === "type" && iconPath(typeIcon(value));
        if (path) {
          const img = el("img");
          img.src = path;
          img.alt = "";
          b.append(img);
          b.classList.add("atlas-icon-option");
          b.setAttribute("aria-label", title);
        } else
          b.append(
            el("span", title),
            el("small", count ? `${count} 份候选` : "无匹配"),
          );
        b.dataset.value = value;
        b.dataset.match = match;
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
        group.setAttribute("aria-label", "快捷标记建筑类型");
        types
          .sort((a, b) => (typeCounts.get(b) || 0) - (typeCounts.get(a) || 0))
          .forEach((type) => group.append(makeOption(type, "type")));
        if (selected) {
          const correction = el("details", null, "atlas-change-type");
          correction.append(el("summary", "修改建筑类型"), group);
          content.push(correction);
        } else content.push(group);
      }
      const search = el("input");
      search.type = "search";
      search.placeholder = "筛选这里的敌人或内容";
      search.setAttribute("aria-label", "搜索这个点位的内容");
      const details = el("details", null, "atlas-exact");
      details.open = false;
      details.append(
        el(
          "summary",
          types.length && !selected ? "具体敌人 / 更多内容" : "更多敌人 / 搜索",
        ),
      );
      const list = el("div", null, "atlas-options");
      const fill = () => {
        const q = search.value.trim();
        const filtered = values
          .filter(
            (v) =>
              editing ||
              !selected ||
              selected.match !== "type" ||
              v.split(" - ")[0] === selected.value,
          )
          .filter((v) =>
            matchesSearch(v === "empty" ? "确认此处为空" : zh(v), q),
          );
        list.replaceChildren(
          ...filtered
            .sort(
              (a, b) =>
                (exactCounts.get(b) || 0) - (exactCounts.get(a) || 0) ||
                compareChinese(zh(a), zh(b)),
            )
            .map((v) => makeOption(v)),
        );
        if (!filtered.length)
          list.append(el("p", "这里没有这项记录，请换个关键词或检查点位。"));
      };
      search.oninput = fill;
      fill();
      if (!types.length || selected) {
        const quick = el("div", null, "atlas-quick-exact");
        values
          .filter(
            (v) =>
              editing ||
              !selected ||
              selected.match !== "type" ||
              v.split(" - ")[0] === selected.value,
          )
          .sort((a, b) => (exactCounts.get(b) || 0) - (exactCounts.get(a) || 0))
          .slice(0, 6)
          .forEach((v) => quick.append(makeOption(v)));
        content.splice(1, 0, quick);
      }
      details.append(search, list);
      content.push(details);
      if (selected && !editing)
        content.push(
          btn(
            "修改这处信息",
            () => {
              editing = true;
              renderEditor();
            },
            "point-edit",
          ),
        );
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
    if (!records.length) content.push(undo);
    content.push(locationDetails(point));
    editor.replaceChildren(...content);
  }
  function showMap(layout) {
    const generation = ++imageGeneration;
    clearTimeout(loadingTimer);
    const status = $("atlas-loading");
    if (tiles.dataset.map || status.querySelector("button"))
      status.hidden = true;
    let fullShown = false,
      failed = false;
    close(false);
    pointers.clear();
    gesture = null;
    const pending = (value) => {
      mapPending = value;
      viewport.toggleAttribute("data-map-pending", value);
      viewport.setAttribute("aria-busy", String(value));
      layer.inert = value;
    };
    const commit = (images, quality) => {
      if (generation !== imageGeneration) return;
      if (quality === "preview" && fullShown) return;
      if (quality === "full") fullShown = true;
      tiles.replaceChildren(...images);
      tiles.dataset.map = layout;
      tiles.dataset.quality = quality;
      pending(false);
      clearTimeout(loadingTimer);
      if (!failed) status.hidden = true;
    };
    // Keep the previous picture until the target overview is decoded. No mismatched pins.
    pending(tiles.dataset.map !== layout);
    const full = prepareMap(layout);
    if (full.ready) commit(full.images, "full");
    else {
      const preview = previewMap(layout, "high");
      const showPreview = (image) => {
        image.className = "atlas-preview";
        commit([image], "preview");
      };
      if (preview.ready) showPreview(preview.image);
      else preview.promise.then(showPreview).catch(() => {});
      if (mapPending)
        loadingTimer = setTimeout(() => {
          if (generation !== imageGeneration || !mapPending || failed) return;
          status.textContent = "正在载入地图…";
          status.hidden = false;
        }, 250);
      full.promise
        .then((images) => commit(images, "full"))
        .catch(() => {
          if (generation !== imageGeneration) return;
          failed = true;
          clearTimeout(loadingTimer);
          status.replaceChildren(
            el("span", "部分底图未能载入。"),
            btn("重试底图", () => showMap(layout)),
          );
          status.hidden = false;
        });
    }
    full.promise.then(warmMapPreviews).catch(() => {});
  }
  function circleDay() {
    return layerMode === "day1" ? 1 : layerMode === "day2" ? 2 : 0;
  }
  const eventSelect = $("atlas-event");
  let terrainRecords = [];
  let overlayPins = [];
  function eventName(record) {
    if (!record.specialEvent || record.specialEvent === "无特殊事件") return "";
    return zh(record.specialEvent)
      .replace(/^第1天\s*·?\s*/, "第一天 ").replace(/^第2天\s*·?\s*/, "第二天 ")
      .replace("天秤恶魔诅咒", "利普拉诅咒")
      .replace("玛利斯气泡", "玛利斯泡沫")
      .replace("蒙格特入侵", "蒙葛特入侵")
      .replace("卡莉果冰风暴", "冰龙·卡莉果冰风暴")
      .replace("格诺斯塔瘟疫", "慧心虫·格诺斯塔瘟疫");
  }
  function updateEncounters() {
    const rows = [];
    for (const [key, title] of [
      ["night1Boss", "① 第一夜"], ["night2Boss", "② 第二夜"],
      ["nightlord", "夜王"], ["extraNightBoss", "额外首领"],
    ]) {
      const names = [...new Set(records.filter(r => r[key]).map(r => zh(r[key])))];
      if (!names.length && key === "extraNightBoss") continue;
      const row = el("div");
      const uncertain = names.length > 1 ||
        (key === "extraNightBoss" && records.some(r => !r[key]));
      const label = el("b", title + (uncertain ? "候选" : ""));
      const value = el("span", names.join("、") || "—");
      if (uncertain) value.tabIndex = 0;
      row.append(label, value);
      rows.push(row);
    }
    $("atlas-bosses").replaceChildren(...rows);
    const events = [...new Set(terrainRecords.map(eventName))];
    const choices = events.filter(Boolean).sort(compareChinese);
    const previous = eventSelect.value;
    eventSelect.replaceChildren(
      new Option(!terrainRecords.length ? "无候选布局" : choices.length ? "全部候选事件" : "无特殊事件", ""),
      ...choices.map(name => new Option(name, name)),
    );
    eventSelect.value = choices.includes(previous) ? previous :
      events.length === 1 && choices.length ? choices[0] : "";
    eventSelect.disabled = choices.length === 0;
  }
  function updateCircles() {
    const day = circleDay();
    const pins = new Map();
    function add(point, symbol) {
      const key = point.join(",");
      if (!pins.has(key)) pins.set(key, {point, symbols: new Set()});
      pins.get(key).symbols.add(symbol);
    }
    const sites = new Set();
    for (const record of terrainRecords) {
      data.circleCenters[record.id].forEach((center, index) => {
        if (!day || day === index + 1) add(center, index + 1);
      });
      if (!eventSelect.value || eventName(record) === eventSelect.value) {
        for (const site of data.eventSites[record.id] || []) sites.add(site);
      }
    }
    for (const site of sites) add(data.eventPoints[site], "event");
    overlayPins = [...pins.values()];
    circles.replaceChildren(...overlayPins.map(({point: [x, y], symbols}) => {
      const pin = el("div", "", "encounter-pin");
      pin.style.left = `${x * 100}%`;
      pin.style.top = `${y * 100}%`;
      for (const symbol of [1, 2, "event"]) {
        if (!symbols.has(symbol)) continue;
        const badge = el("span", symbol === "event" ? "✦" : String(symbol));
        badge.dataset.symbol = symbol;
        pin.append(badge);
      }
      return pin;
    }));
    $("atlas-event-status").textContent = sites.size ? `✦ ${sites.size} 处候选` :
      eventSelect.disabled ? "" : "位置未收录";
    $("atlas-count").textContent = records.length === 1
      ? `已确定 · #${records[0].id}`
      : `${records.length} 份候选`;
  }
  eventSelect.addEventListener("change", () => {
    updateCircles();
    revision++;
    draw();
  });
  function rebuild() {
    $("atlas-toast").hidden = true;
    const state = getState();
    records = queryMaps(data.records, state);
    const inferredTerrains = [...new Set(records.map((r) => r.mapType))];
    const displayTerrain =
      state.mapType ||
      (inferredTerrains.length === 1 ? inferredTerrains[0] : "Default");
    depthButton.hidden = displayTerrain !== "Great Hollow";
    depthButton.textContent = underground
      ? "地下 · 切换地表"
      : "地表 · 切换地下";
    depthButton.setAttribute("aria-pressed", String(underground));
    if (displayTerrain !== terrain) {
      terrain = displayTerrain;
      zoom = 1;
      pan = { x: 0, y: 0 };
      cameraHistory.length = 0;
      focused.clear();
      showMap(
        terrain === "Great Hollow" && underground
          ? "great_hollow_under"
          : geometry.layouts[terrain],
      );
    }
    terrainRecords = records.filter(r => r.mapType === displayTerrain);
    updateEncounters();
    points = geometry.points.filter(
      (p) =>
        p.terrains.includes(displayTerrain) &&
        (!p.spawn || !state.spawn || p.spawn === state.spawn) &&
        (displayTerrain !== "Great Hollow" ||
          (p.level === "地下") === underground) &&
        (!records.length ||
          observed(p) ||
          (p.spawn
            ? records.some((r) => r.spawn === p.spawn)
            : records.some((r) =>
                r.slots.some((slot) => slot.key === p.key && slot.value),
              ))),
    );
    const previousButtons = new Map(
      buttons.map((item) => [item.point.id, item.b]),
    );
    buttons = points.map((point) => {
      const icon = pointIcon(point, records, getState(), data.iconRecords);
      const b =
        previousButtons.get(point.id) ||
        btn(
          "",
          () =>
            activateGroup({ x: point.x, y: point.y, points: [point] }, true),
          "atlas-point",
        );
      b.dataset.point = point.id;
      b.dataset.merchant = merchantEmphasis(icon);
      if (b.dataset.icon !== icon) {
        b.dataset.icon = icon;
        const path = iconPath(icon);
        b.classList.toggle("atlas-unknown", !path);
        b.replaceChildren();
        if (path) {
          const img = el("img");
          img.src = path;
          img.alt = "";
          img.draggable = false;
          b.append(img);
        }
      }
      const headline = label(point);
      b.setAttribute("aria-label", headline || iconLabel(icon));
      b.setAttribute("aria-description", zh(point.location || point.spawn));
      b.classList.toggle("observed", observed(point));
      b.classList.toggle(
        "inferred",
        !observed(point) && !!pointConsensus(records, point),
      );
      return { point, b, headline };
    });
    revision++;
    updateCircles();
    $("atlas-undo").disabled = document.getElementById("undo-map").disabled;
    $("atlas-hint").textContent = state.mapType
      ? `${zh(state.mapType)}`
      : inferredTerrains.length === 1
        ? `由候选推测地形：${zh(displayTerrain)}。`
        : "普通地形";
    if (active) {
      const found = points.find((p) => p.id === active.id);
      if (found) {
        active = found;
        renderEditor();
      } else {
        active = null;
        editor.hidden = true;
      }
    }
    draw();
  }
  function local(event) {
    const r = viewport.getBoundingClientRect();
    return { x: event.clientX - r.left, y: event.clientY - r.top };
  }
  function nearEvent(event) {
    if (mapPending) return [];
    measure();
    const p = local(event);
    return groups
      .filter((g) => !g.button.hidden)
      .map((g) => ({
        group: g,
        distance: Math.hypot(g.screenX - p.x, g.screenY - p.y),
      }))
      .filter((g) => g.distance <= (event.pointerType === "touch" ? 36 : 28))
      .sort((a, b) => a.distance - b.distance)
      .map((g) => g.group);
  }
  // Opening a panel on pointer-up can move a form button under the finger.
  // Consume only that gesture's compatibility click; a new pointer-down resets it.
  let suppressMapClick = false;
  document.addEventListener(
    "pointerdown",
    () => {
      suppressMapClick = false;
    },
    true,
  );
  document.addEventListener(
    "click",
    (event) => {
      if (
        event.detail > 0 &&
        (suppressMapClick || event.target.closest(".atlas-point"))
      ) {
        suppressMapClick = false;
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );
  viewport.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button:not(.atlas-point)")) return;
    const p = local(event);
    pointers.set(event.pointerId, p);
    viewport.setPointerCapture(event.pointerId);
    gesture = {
      start: p,
      pan: { ...pan },
      moved: false,
      startPoint: event.target.closest(".atlas-point")?.dataset.point,
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
      if (hover !== near[0]) {
        hover?.button.classList.remove("hovered");
        hover = near[0] || null;
        hover?.button.classList.add("hovered");
      }
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
          true,
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
      scheduleDraw();
    }
  });
  viewport.addEventListener("pointerup", (event) => {
    if (!pointers.has(event.pointerId)) return;
    const click = gesture && !gesture.moved;
    pointers.delete(event.pointerId);
    if (!click && drawFrame) draw();
    if (click) {
      suppressMapClick = true;
      const hit = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest(".atlas-point");
      const direct =
        hit && hit.dataset.point === gesture.startPoint
          ? groups.find((g) => g.id === hit.dataset.point)
          : null;
      const near = nearEvent(event);
      if (direct) activateGroup(direct, true);
      else if (near.length) activateGroup(near[0]);
      else if (!circleDay())
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
      zoomTo(zoom * (event.deltaY < 0 ? 1.15 : 1 / 1.15), p.x, p.y, true);
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
    cameraHistory.length = 0;
    focused.clear();
    zoom = 1;
    pan = { x: 0, y: 0 };
    draw();
  };
  for (const [mode, text] of [
    ["base", "据点"],
    ["spawn", "出生"],
    ["boss", "敌人"],
    ["gaol", "监牢"],
    ["all", "全部"],
    ["day1", "第一天最终圈心"],
    ["day2", "第二天最终圈心"],
  ]) {
    const b = btn(
      text,
      () => {
        layerMode = mode;
        close(false);
        $("atlas-toast").hidden = true;
        updateLayers();
        $("atlas-layer-menu").open = false;
        draw();
        $("atlas-status").textContent =
          mode === "spawn"
            ? "出生模式：点一下位置即标记，可随时撤销。"
            : circleDay() ? $("atlas-count").textContent : "选择点位";
      },
      "atlas-layer",
    );
    b.dataset.layer = mode;
    $("atlas-layers").append(b);
  }
  function updateLayers() {
    updateCircles();
    const names = {
      base: "据点",
      spawn: "出生",
      boss: "敌人",
      gaol: "监牢",
      all: "全部点位",
      day1: "第一天最终圈心",
      day2: "第二天最终圈心",
    };
    $("atlas-layer-name").textContent = names[layerMode];
    for (const b of $("atlas-layers").children)
      b.setAttribute("aria-pressed", String(b.dataset.layer === layerMode));
  }
  updateLayers();
  new ResizeObserver(draw).observe(viewport);
  rebuild();
  return {
    refresh: rebuild,
    focusPoint(key) {
      const p = points.find((p) => p.key === key);
      if (p) {
        layerMode = "all";
        updateLayers();
        pan = { x: 0, y: 0 };
        zoom = 1;
        draw();
        open(p);
        viewport.scrollIntoView({ block: "center", behavior: "auto" });
        return true;
      }
      return false;
    },
  };
}
