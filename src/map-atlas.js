import { queryMaps } from "./map-query.js";
import {
  pointInLayer,
  pointObservations,
  pointConsensus,
} from "./map-spatial.js";
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
    loadJson("data/map-dlc-geometry.json"),
  ]);
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
  const detailControl = $("atlas-detail"),
    autozoomControl = $("atlas-autozoom");
  detailControl.value = ["auto", "none", "names", "details"].includes(
    preferences.detail,
  )
    ? preferences.detail
    : "auto";
  autozoomControl.checked = preferences.autozoom !== false;
  const cameraHistory = [],
    focused = new Set();
  const savePreferences = () => {
    writeDraft("nightreign-atlas-view-v1", {
      detail: detailControl.value,
      autozoom: autozoomControl.checked,
    });
    draw();
  };
  detailControl.addEventListener("change", savePreferences);
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
  const label = (point) => {
    const type = point.spawn ? "出生位置" : zh(point.category),
      place = zh(point.location);
    return type === place ? place : `${type} · ${place}`;
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
  function activateGroup(group, keyboard = false) {
    const point = group.points[0];
    const neighbors = groups.filter(
      (g) =>
        g.points[0].id !== point.id &&
        Math.hypot(g.x - point.x, g.y - point.y) * size <
          (viewport.clientWidth < 760 ? 60 : 42),
    );
    if (
      !keyboard &&
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
      $("atlas-status").textContent =
        "已放大目标附近，点位分别显示。点击所需点位查看或标记。";
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
  function draw() {
    measure();
    tiles.style.width = `${size}px`;
    tiles.style.height = `${size}px`;
    tiles.style.transform = `translate(${origin.x}px,${origin.y}px)`;
    $("atlas-back").hidden = !cameraHistory.length;
    const width = viewport.clientWidth,
      height = viewport.clientHeight;
    const level = detailLevel(size, detailControl.value);
    const diameter =
      size >= 800 ? (width < 760 ? 44 : 32) : width < 760 ? 24 : 28;
    viewport.dataset.detail = String(level);
    viewport.dataset.zoom = String(zoom);
    $("atlas-scale").textContent =
      level === 2
        ? "近看 · 内容与状态"
        : level === 1
          ? "区域 · 点位名称"
          : "全图 · 密集处点击放大";
    const bounds = viewport.getBoundingClientRect();
    const obstacles = [
      document.querySelector(".atlas-controls"),
      $("atlas-layer-menu"),
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
      obstacles,
    ]);
    if (layoutKey !== key) {
      layoutKey = key;
      groups = points
        .filter((p) => pointInLayer(p, layerMode))
        .map((point) => ({
          id: point.id,
          x: point.x,
          y: point.y,
          points: [point],
          button: buttons.find((x) => x.point.id === point.id).b,
        }));
      const placements = layoutMarkers(
        groups.map((g) => ({
          id: g.id,
          x: origin.x + g.x * size,
          y: origin.y + g.y * size,
        })),
        width,
        height,
        diameter,
        obstacles,
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
      const labelWidth = width < 760 ? 140 : 168;
      const labels = level
        ? layoutLabels(
            placements,
            width,
            height,
            new Map(
              placements.map((p) => [
                p.id,
                { width: labelWidth, height: level === 2 ? 68 : 38 },
              ]),
            ),
            obstacles,
          )
        : [];
      $("atlas-labels").replaceChildren(
        ...labels.map((box) => {
          const point = points.find((p) => p.id === box.id),
            n = el("div", null, "atlas-map-label");
          n.dataset.for = point.id;
          n.style.left = `${box.x}px`;
          n.style.top = `${box.y}px`;
          n.style.width = `${box.width}px`;
          n.style.height = `${box.height}px`;
          n.append(
            el("strong", point.spawn ? zh(point.spawn) : zh(point.location)),
          );
          if (level === 2)
            n.append(
              el("span", buttons.find((b) => b.point.id === point.id).detail),
            );
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
    draw();
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
  function apply(next, message) {
    const marked = active;
    active = null;
    change(next);
    const text = records.length
      ? `${message} · 剩余 ${records.length} 份`
      : "没有匹配档案，请修改本次标记或撤销。";
    $("atlas-status").textContent = text;
    if (records.length) {
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
    header.append(el("h2", label(point)));
    header.firstChild.id = "atlas-point-title";
    header.append(btn("关闭", close));
    const content = [header];
    const known = pointConsensus(records, point);
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
        el(
          "h3",
          known === "spawn"
            ? "出生位置"
            : known === "empty"
              ? "此处为空"
              : zh(known),
        ),
      );
      const description =
        known === "spawn"
          ? "当前候选均从这个位置出生。"
          : known === "empty"
            ? "当前候选在此处均未记录据点或敌人。"
            : `当前 ${records.length} 份候选在这个位置的内容一致。`;
      facts.append(
        el("p", description),
        el("p", `位置：${zh(point.location)}`, "point-location"),
      );
      if (known !== "spawn" && zh(point.category) !== zh(point.location))
        facts.append(el("p", `类型：${zh(point.category)}`, "point-location"));
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
      editor.replaceChildren(header, facts);
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
        const title = value === "empty" ? "确认此处为空" : zh(value);
        const b = btn(
          "",
          () => apply(next, `已标记“${title}”`),
          "atlas-option",
        );
        b.append(
          el("span", title),
          el("small", count ? `${count} 份候选` : "无匹配"),
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
          .filter((v) => (v === "empty" ? "确认此处为空" : zh(v)).includes(q));
        list.replaceChildren(
          ...filtered
            .sort(
              (a, b) =>
                (exactCounts.get(b) || 0) - (exactCounts.get(a) || 0) ||
                zh(a).localeCompare(zh(b), "zh-CN"),
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
    editor.replaceChildren(...content);
  }
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
          img.src = `assets/maps/${terrain === "Great Hollow" && underground ? "great_hollow_under" : geometry.layouts[terrain]}/${col}-${5 - row}.webp`;
          images.push(img);
        }
      tiles.replaceChildren(...images);
    }
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
        () => activateGroup({ x: point.x, y: point.y, points: [point] }, true),
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
      const possibilities = [
        ...new Set(
          records.flatMap((r) =>
            r.slots
              .filter((s) => s.key === point.key && s.value)
              .map((s) => zh(s.value.split(" - ")[0])),
          ),
        ),
      ];
      const detail =
        observed(point) || common
          ? pointName(point)
          : point.spawn
            ? "候选出生位置"
            : possibilities.length
              ? `候选：${possibilities.slice(0, 2).join(" / ")}${possibilities.length > 2 ? "…" : ""}`
              : "待观察";
      return { point, b, detail };
    });
    revision++;
    $("atlas-count").textContent =
      records.length === 1
        ? `已确定 · #${records[0].id}`
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
  // Pointer-up handles mouse and touch selection once. Mobile browsers also emit
  // a synthetic click, which must not reopen the marker after a quick mark.
  viewport.addEventListener(
    "click",
    (event) => {
      if (event.detail > 0 && event.target.closest(".atlas-point")) {
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
      startGroup: event.target.closest(".atlas-point")?.dataset.group,
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
        hover = near[0] || null;
        draw();
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
      if (near.length) activateGroup(near[0]);
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
            : "点选位置查看或标记，自动吸附最近点位。";
      },
      "atlas-layer",
    );
    b.dataset.layer = mode;
    $("atlas-layers").append(b);
  }
  function updateLayers() {
    const names = {
      base: "据点",
      spawn: "出生",
      boss: "敌人",
      gaol: "监牢",
      all: "全部点位",
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
