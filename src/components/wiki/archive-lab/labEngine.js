/* Neural Lab camera. Same gesture as the solar: Pixi Viewport pans with the right
   button, the wheel zooms, and the SVG viewBox follows so the cards stay sharp.
   Left-drag on empty space marquees. Left-drag on a card moves the selection.
   A short right-click opens the menu. Positions stay where the author left them. */
import * as PIXI from "pixi.js";
import { Viewport } from "pixi-viewport";
import { CODEX_TYPES } from "../../../constants/wiki/archiveCodex";
import {
    WIKI_ALWAYS_STRUCTURAL_RELATION_TYPES,
    WIKI_RELATION_TYPE_LABELS,
    isAffinityRelation,
} from "../../../constants/wikiRelationTypes";
import { ARCHIVE_LAB_CSS } from "../../../constants/archiveLabStyles";
import { LAB_BOARD_TYPES, LAB_CARD, containmentLinks, groupHulls } from "../../../utils/labContainment";

const SVG_NS = "http://www.w3.org/2000/svg";
const WORLD = 12000;
const FX_WAVE = [0x00f2ea, 0xff1493, 0xf5c542, 0xaa66ff];

function svgEl(name, attrs, parent) {
    const node = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attrs || {})) {
        if (value == null || value === false) continue;
        node.setAttribute(key, String(value));
    }
    if (parent) parent.appendChild(node);
    return node;
}

function fold(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

function snap(value) {
    return 16 + Math.round((value - 16) / 16) * 16;
}

function relType(row) {
    return row?.relation_type || row?.relationType || "";
}

function endId(row, end) {
    if (end === "from") return row?.from_ficha_id || row?.fromEntityId || "";
    return row?.to_ficha_id || row?.toEntityId || "";
}

/**
 * @param {HTMLElement} host
 * @param {{
 *   onSelect?: (ids: string[]) => void,
 *   onMove?: (moves: { id: string, x: number, y: number }[]) => void,
 *   onMenu?: (menu: { mode: string, ids: string[], clientX: number, clientY: number, worldX: number, worldY: number }) => void,
 *   onLink?: (link: { fromId: string, toId: string, clientX: number, clientY: number }) => void,
 *   onStrength?: (row: { id: string, fromId: string, toId: string, relationType: string, strength: number }) => void,
 * }} actions
 */
export function createLabEngine(host, actions = {}) {
    let destroyed = false;
    let pixiApp = null;
    let viewport = null;
    let resizeObs = null;
    let pointer = null;
    let link = null;
    let framed = "";
    let paintKey = "";
    let hoverId = "";
    let badgeHits = [];
    let armedAt = 0;
    const born = new Set();
    const pendingStrength = new Map();
    const pins = new Map();
    const STEP = 22;
    let fx = null;
    let fxClock = 0;
    let bursts = [];
    let state = {
        entities: [],
        relations: [],
        positions: {},
        selectedIds: [],
        query: "",
        kindFilter: "all",
        groupMode: "libre",
        readOnly: false,
        focusId: "",
        waves: [],
        impactMarks: {},
        edgeDeltas: {},
        ghosts: [],
        anchorIds: [],
        phase: "idle",
    };
    let cam = { x: 80, y: 40, w: 1400, h: 860 };
    let gutter = { right: 8 };
    let menuStage = null;
    const blockMenu = (event) => {
        event.preventDefault();
        event.returnValue = false;
        return false;
    };
    const overLab = (event) => {
        if (!menuStage) return false;
        const target = event.target;
        if (target === menuStage || (target && menuStage.contains(target))) return true;
        const path = typeof event.composedPath === "function" ? event.composedPath() : [];
        if (path.includes(menuStage)) return true;
        if (typeof event.clientX !== "number") return false;
        const rect = menuStage.getBoundingClientRect();
        return event.clientX >= rect.left && event.clientX <= rect.right
            && event.clientY >= rect.top && event.clientY <= rect.bottom;
    };
    const blockMenuIfLab = (event) => {
        if (!overLab(event)) return undefined;
        const tag = event.target?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return undefined;
        return blockMenu(event);
    };
    const ui = mount();

    function mount() {
        let style = document.getElementById("ckt-lab-css");
        if (!style) {
            style = document.createElement("style");
            style.id = "ckt-lab-css";
            document.head.appendChild(style);
        }
        style.textContent = ARCHIVE_LAB_CSS;
        host.innerHTML = `<div class="lab-stage"><div class="ckt-shell"><div class="ckt-viewport"><div class="ckt-grid"></div><div class="ckt-world"></div></div></div></div>`;
        const stage = host.querySelector(".lab-stage");
        const grid = host.querySelector(".ckt-grid");
        const world = host.querySelector(".ckt-world");
        const svg = svgEl("svg", { class: "ckt-svg", width: "12000", height: "12000" });
        svg.setAttribute("aria-label", "Neural Lab");
        world.appendChild(svg);
        const hullLayer = svgEl("g", {}, svg);
        const edgeLayer = svgEl("g", {}, svg);
        const ghostLayer = svgEl("g", {}, svg);
        const nodes = document.createElement("div");
        world.appendChild(nodes);
        const wire = svgEl("path", {
            class: "link-wire",
            fill: "none",
            display: "none",
        }, svg);
        const ghost = svgEl("circle", {
            class: "link-ghost",
            r: "11",
            fill: "none",
            display: "none",
        }, svg);
        const marquee = svgEl("g", { display: "none" }, svg);
        svgEl("rect", {
            fill: "#ff2bd6",
            "fill-opacity": "0.1",
            stroke: "#ff2bd6",
            "stroke-width": "1.5",
        }, marquee);
        menuStage = stage;
        stage.oncontextmenu = blockMenu;
        host.oncontextmenu = blockMenuIfLab;
        stage.addEventListener("contextmenu", blockMenu, true);
        document.addEventListener("contextmenu", blockMenuIfLab, true);
        document.addEventListener("keydown", onKey, true);
        window.addEventListener("pointermove", onWireMove);
        resizeObs = new ResizeObserver(() => fitRatio());
        resizeObs.observe(stage);
        mountViewport(stage);
        return { stage, grid, world, svg, hullLayer, edgeLayer, ghostLayer, nodes, wire, ghost, marquee };
    }

    function zoomClamp() {
        const sw = Math.max(1, viewport?.screenWidth || ui.stage.clientWidth || 1);
        return { minScale: sw / 6400, maxScale: sw / 280 };
    }

    async function mountViewport(stage) {
        const app = new PIXI.Application();
        await app.init({
            resizeTo: stage,
            backgroundAlpha: 0,
            antialias: true,
            autoDensity: true,
            resolution: Math.min(window.devicePixelRatio || 1, 2),
        });
        if (destroyed) {
            app.destroy(true);
            return;
        }
        app.canvas.className = "lab-camera";
        app.canvas.style.touchAction = "none";
        app.canvas.oncontextmenu = blockMenu;
        app.canvas.addEventListener("contextmenu", blockMenu, true);
        if (app.renderer?.events) app.renderer.events.autoPreventDefault = false;
        const dom = app.renderer?.events?.domElement;
        if (dom && dom !== app.canvas) {
            dom.oncontextmenu = blockMenu;
            dom.addEventListener("contextmenu", blockMenu, true);
        }
        stage.appendChild(app.canvas);
        if (!("events" in app.renderer)) app.renderer.addSystem(PIXI.EventSystem, "events");
        const vp = new Viewport({
            screenWidth: app.screen.width,
            screenHeight: app.screen.height,
            worldWidth: WORLD,
            worldHeight: WORLD,
            ticker: app.ticker,
            events: app.renderer.events,
            disableOnContextMenu: true,
        });
        vp.drag({ mouseButtons: "right", pressDrag: true })
            .pinch()
            .wheel({ smooth: 4, percent: 0.12 })
            .decelerate({ friction: 0.9 })
            .clampZoom(zoomClamp());
        vp.eventMode = "static";
        vp.cursor = "grab";
        const hit = new PIXI.Container();
        hit.eventMode = "static";
        hit.hitArea = new PIXI.Rectangle(-WORLD, -WORLD, WORLD * 2, WORLD * 2);
        hit.on("pointerdown", onHitDown);
        vp.addChild(hit);
        const fxRoot = new PIXI.Container();
        fxRoot.eventMode = "none";
        fxRoot.blendMode = "add";
        const sweep = new PIXI.Graphics();
        const rings = new PIXI.Graphics();
        const packets = new PIXI.Graphics();
        const burst = new PIXI.Graphics();
        fxRoot.addChild(sweep, rings, packets, burst);
        vp.addChild(fxRoot);
        fx = { sweep, rings, packets, burst, dirty: false };
        app.ticker.add(fxTick);
        vp.on("moved", syncFromViewport);
        vp.on("zoomed", syncFromViewport);
        vp.on("pointerdown", onPanDown);
        vp.on("pointerup", onPanUp);
        vp.on("pointerupoutside", onPanUp);
        app.stage.addChild(vp);
        pixiApp = app;
        viewport = vp;
        fitRatio();
        writeViewport(cam, false);
        paint();
    }

    function applyCam() {
        if (!ui.world) return;
        const scale = viewport?.scale?.x || ((ui.stage.clientWidth || 1) / Math.max(1, cam.w));
        const x = viewport ? viewport.x : -cam.x * scale;
        const y = viewport ? viewport.y : -cam.y * scale;
        ui.world.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
        const major = 80 * scale;
        const minor = 20 * scale;
        ui.grid.style.backgroundSize = `${major}px ${major}px, ${major}px ${major}px, ${minor}px ${minor}px, ${minor}px ${minor}px`;
        ui.grid.style.backgroundPosition = `${x}px ${y}px, ${x}px ${y}px, ${x}px ${y}px, ${x}px ${y}px`;
        placePins();
    }

    function placePins() {
        if (!pins.size || !ui.stage) return;
        const scale = viewport?.scale?.x || ((ui.stage.clientWidth || 1) / Math.max(1, cam.w));
        const ox = viewport ? viewport.x : -cam.x * scale;
        const oy = viewport ? viewport.y : -cam.y * scale;
        const sw = ui.stage.clientWidth - (gutter.right || 0);
        const stageH = ui.stage.clientHeight || 0;
        const list = cards();
        const byId = new Map();
        pins.forEach((id, el) => {
            if (!byId.has(id)) byId.set(id, []);
            byId.get(id).push(el);
        });
        byId.forEach((els, id) => {
            const card = list.find((row) => row.id === id);
            if (!card) {
                els.forEach((el) => { el.style.visibility = "hidden"; });
                return;
            }
            const firstW = els[0].offsetWidth || 280;
            const right = (card.x + LAB_CARD.w) * scale + ox + 14;
            const leftEdge = card.x * scale + ox - 14;
            const preferRight = right + firstW <= sw - 8 || leftEdge - firstW < 8;
            const nodeY = Math.max(8, card.y * scale + oy - 12);
            let y = nodeY;
            let laneRight = preferRight;
            els.forEach((el, index) => {
                const w = el.offsetWidth || 280;
                const h = el.offsetHeight || 160;
                let useRight = laneRight;
                let placeY = y;
                if (index > 0 && stageH > 0 && placeY + h > stageH - 8) {
                    const flipRight = !preferRight;
                    const flipX = flipRight ? right : leftEdge - w;
                    if (flipX > -8 && flipX + w < ui.stage.clientWidth + 8) {
                        useRight = flipRight;
                        laneRight = useRight;
                        placeY = nodeY;
                    }
                }
                if (stageH > 0 && placeY + h > stageH - 8) placeY = Math.max(8, stageH - h - 8);
                const x = useRight ? right : leftEdge - w;
                el.style.visibility = x > ui.stage.clientWidth || x + w < 0 ? "hidden" : "visible";
                el.style.transform = `translate(${Math.round(x)}px, ${Math.round(placeY)}px)`;
                y = placeY + h + 8;
            });
        });
    }

    function syncFromViewport() {
        if (!viewport) return;
        const scale = viewport.scale.x || 1;
        const sw = viewport.screenWidth || ui.stage.clientWidth || 0;
        const sh = viewport.screenHeight || ui.stage.clientHeight || 0;
        if (sw < 2 || sh < 2) return;
        cam = {
            x: -viewport.x / scale,
            y: -viewport.y / scale,
            w: sw / scale,
            h: sh / scale,
        };
        applyCam();
    }

    function writeViewport(next, animate) {
        cam = { ...next };
        if (!viewport) {
            applyCam();
            return;
        }
        const sw = Math.max(1, viewport.screenWidth || ui.stage.clientWidth);
        const scale = sw / Math.max(1, next.w);
        if (animate && typeof viewport.animate === "function") {
            viewport.animate({
                time: 350,
                ease: "easeOutCubic",
                position: { x: next.x + next.w / 2, y: next.y + next.h / 2 },
                scale,
                removeOnInterrupt: true,
            });
            return;
        }
        viewport.scale.set(scale);
        viewport.position.set(-next.x * scale, -next.y * scale);
        syncFromViewport();
    }

    function fitRatio() {
        if (!viewport || !pixiApp) return;
        const w = ui.stage.clientWidth;
        const h = ui.stage.clientHeight;
        if (w < 2 || h < 2) return;
        pixiApp.renderer?.resize?.(w, h);
        pixiApp.canvas.style.width = "100%";
        pixiApp.canvas.style.height = "100%";
        viewport.resize(w, h);
        const plug = viewport.plugins?.get?.("clamp-zoom");
        if (plug) {
            const z = zoomClamp();
            plug.options.minScale = z.minScale;
            plug.options.maxScale = z.maxScale;
        }
        syncFromViewport();
    }

    function visibleEntities() {
        const query = fold(state.query).trim();
        const kind = state.kindFilter || "all";
        return (state.entities || []).filter((entity) => {
            if (!LAB_BOARD_TYPES.includes(entity?.entityType)) return false;
            if (kind !== "all" && entity.boardKind !== kind && entity.entityType !== kind) return false;
            if (query && !fold(entity.title).includes(query)) return false;
            return true;
        });
    }

    function cardPos(entity, index) {
        const saved = state.positions?.[entity.id];
        if (saved && Number.isFinite(Number(saved.x)) && Number.isFinite(Number(saved.y))) {
            return { x: Number(saved.x), y: Number(saved.y) };
        }
        const col = index % 6;
        const row = Math.floor(index / 6);
        return {
            x: LAB_CARD.originX + col * (LAB_CARD.w + 32),
            y: LAB_CARD.originY + row * (LAB_CARD.h + 36),
        };
    }

    function cards() {
        return visibleEntities().map((entity, index) => ({
            ...entity,
            ...cardPos(entity, index),
        }));
    }

    function clear(node) {
        while (node.firstChild) node.removeChild(node.firstChild);
    }

    function esc(value) {
        return String(value ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
    }
    function traceClass(rel) {
        const type = relType(rel);
        if (WIKI_ALWAYS_STRUCTURAL_RELATION_TYPES.has(type)) return "struct";
        const strength = Number(rel.strength ?? 0);
        if (strength <= -3) return "hot";
        if (strength >= 3) return "ok";
        if (strength !== 0) return "warn";
        return "idle";
    }
    function route(a, b) {
        const aw = LAB_CARD.w;
        const ah = LAB_CARD.h / 2;
        if (Math.abs(a.x - b.x) < 8) {
            const [u, d] = a.y < b.y ? [a, b] : [b, a];
            const pts = [{ x: u.x, y: u.y + ah }, { x: d.x, y: d.y - ah }];
            return a.y <= b.y ? pts : pts.slice().reverse();
        }
        const leftFirst = a.x <= b.x;
        const l = leftFirst ? a : b;
        const r = leftFirst ? b : a;
        const x0 = l.x + aw / 2;
        const x1 = r.x - aw / 2;
        const mx = (x0 + x1) / 2;
        const pts = [{ x: x0, y: l.y }, { x: mx, y: l.y }, { x: mx, y: r.y }, { x: x1, y: r.y }];
        return leftFirst ? pts : pts.slice().reverse();
    }
    function pathD(pts) {
        return `M ${pts[0].x} ${pts[0].y} ${pts.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ")}`;
    }
    function labelPoint(pts) {
        let best = -1;
        let at = pts[0];
        for (let i = 1; i < pts.length; i += 1) {
            const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
            if (len > best) {
                best = len;
                at = { x: (pts[i].x + pts[i - 1].x) / 2, y: (pts[i].y + pts[i - 1].y) / 2 };
            }
        }
        return at;
    }
    function centerOf(card) {
        return { x: card.x + LAB_CARD.w / 2, y: card.y + LAB_CARD.h / 2 };
    }
    function strengthText(value) {
        const n = Math.round(Number(value) || 0);
        return n > 0 ? `+${n}` : String(n);
    }
    function toneOf(rel, from, to) {
        if (!isAffinityRelation({
            relationType: relType(rel),
            fromEntityType: from?.entityType,
            toEntityType: to?.entityType,
        })) return { tone: "struct", locked: true, strength: 0 };
        const strength = Math.max(-10, Math.min(10, Math.round(Number(rel.strength) || 0)));
        return { tone: traceClass({ ...rel, strength }), locked: false, strength };
    }
    function waveMaps() {
        const byId = new Map();
        const edges = new Set();
        (state.waves || []).forEach((wave, index) => {
            for (const id of wave.nodeIds || []) {
                if (!byId.has(id)) byId.set(id, index);
            }
            for (const edge of wave.edges || []) {
                if (!edge?.fromId || !edge?.toId) continue;
                edges.add(`${edge.fromId}|${edge.toId}`);
                edges.add(`${edge.toId}|${edge.fromId}`);
            }
        });
        return { byId, edges };
    }
    function graphSignature(list) {
        const rel = (state.relations || [])
            .map((row) => `${endId(row, "from")}>${endId(row, "to")}:${relType(row)}`)
            .join(";");
        const waves = (state.waves || []).map((wave) => (wave.nodeIds || []).join(",")).join("|");
        return `${list.map((card) => `${card.id}:${card.title}:${card.entityType}`).join(",")}|${rel}|${(state.selectedIds || []).join(",")}|${state.groupMode}|${state.kindFilter}|${state.query}|${waves}|${state.phase}`;
    }
    function placeNodes(list) {
        const dragging = new Set(pointer?.mode === "drag" ? pointer.members.map((row) => row.id) : []);
        for (const card of list) {
            const node = ui.nodes.querySelector(`[data-id="${card.id}"]`);
            if (!node) continue;
            node.style.left = `${card.x + LAB_CARD.w / 2}px`;
            node.style.top = `${card.y + LAB_CARD.h / 2}px`;
            node.classList.toggle("dragging", dragging.has(card.id));
            node.classList.toggle("hot", hoverId === card.id && !dragging.has(card.id));
        }
        ui.edgeLayer.querySelectorAll("path.trace").forEach((path) => {
            const [fromId, toId] = (path.dataset.key || "").split("|");
            const from = list.find((card) => card.id === fromId);
            const to = list.find((card) => card.id === toId);
            if (!from || !to) return;
            const pts = route(centerOf(from), centerOf(to));
            const d = pathD(pts);
            path.setAttribute("d", d);
            const flow = path.nextElementSibling;
            if (flow?.classList.contains("trace-flow")) flow.setAttribute("d", d);
            const pad = flow?.nextElementSibling;
            const tip = pts[pts.length - 1];
            if (pad?.tagName === "rect") {
                pad.setAttribute("x", String(tip.x - 3.5));
                pad.setAttribute("y", String(tip.y - 3.5));
            }
            const mid = labelPoint(pts);
            const tag = ui.edgeLayer.querySelector(`g.rel-tag[data-key="${from.id}|${to.id}"]`);
            if (tag) tag.setAttribute("transform", `translate(${mid.x} ${mid.y})`);
            const num = ui.edgeLayer.querySelector(`g.rel-num[data-key="${from.id}|${to.id}"]`);
            if (num) {
                const dx = Number(num.dataset.dx) || 28;
                const bx = mid.x + dx;
                num.setAttribute("transform", `translate(${bx} ${mid.y})`);
                const hit = badgeHits.find((row) => row.key === `${from.id}|${to.id}`);
                if (hit) {
                    hit.x = bx;
                    hit.y = mid.y;
                }
            }
        });
    }
    function drawBoard(list) {
        const byId = new Map(list.map((card) => [card.id, card]));
        const selected = new Set(state.selectedIds || []);
        const focus = selected.size === 1 ? [...selected][0] : "";
        const waves = waveMaps();
        const near = new Set(focus ? [focus] : []);
        if (focus) {
            for (const rel of state.relations || []) {
                const from = endId(rel, "from");
                const to = endId(rel, "to");
                if (from === focus) near.add(to);
                if (to === focus) near.add(from);
            }
        }
        const degree = new Map(list.map((card) => [card.id, 0]));
        for (const rel of state.relations || []) {
            const from = endId(rel, "from");
            const to = endId(rel, "to");
            if (degree.has(from)) degree.set(from, degree.get(from) + 1);
            if (degree.has(to)) degree.set(to, degree.get(to) + 1);
        }
        clear(ui.hullLayer);
        clear(ui.edgeLayer);
        badgeHits = [];
        const positions = Object.fromEntries(list.map((card) => [card.id, { x: card.x, y: card.y }]));
        for (const hull of groupHulls(list, state.relations, positions, state.groupMode)) {
            const parent = byId.get(hull.parentId);
            const color = CODEX_TYPES[parent?.entityType]?.color || "#00f2ea";
            svgEl("rect", {
                class: "hull", x: hull.x, y: hull.y, width: hull.w, height: hull.h, rx: 18, stroke: color,
            }, ui.hullLayer);
        }
        const hidden = new Set(
            containmentLinks(list, state.relations, state.groupMode === "libre" ? "" : state.groupMode)
                .map((row) => `${row.childId}|${row.parentId}|${row.relation}`),
        );
        for (const rel of state.relations || []) {
            const from = byId.get(endId(rel, "from"));
            const to = byId.get(endId(rel, "to"));
            if (!from || !to) continue;
            const type = relType(rel);
            const pair = `${from.id}|${to.id}|${type}`;
            const back = `${to.id}|${from.id}|${type}`;
            if (state.groupMode !== "libre" && (hidden.has(pair) || hidden.has(back))) continue;
            const weighed = toneOf(rel, from, to);
            const cls = weighed.tone;
            const live = waves.edges.has(`${from.id}|${to.id}`) || waves.byId.has(from.id) && waves.byId.has(to.id);
            const dimTrace = Boolean(focus) && from.id !== focus && to.id !== focus && !live;
            const tone = `${cls}${dimTrace ? " dim" : ""}${live ? " live" : ""}`;
            const pts = route(centerOf(from), centerOf(to));
            const d = pathD(pts);
            const tip = pts[pts.length - 1];
            const mid = labelPoint(pts);
            const label = WIKI_RELATION_TYPE_LABELS[type] || type;
            const edgeKey = `${from.id}|${to.id}`;
            svgEl("path", { class: `trace ${tone}`, d, "data-key": edgeKey }, ui.edgeLayer);
            svgEl("path", { class: `trace-flow ${tone}`, d, "data-key": edgeKey }, ui.edgeLayer);
            svgEl("rect", { class: `pad ${tone}`, x: tip.x - 3.5, y: tip.y - 3.5, width: 7, height: 7, "data-key": edgeKey }, ui.edgeLayer);
            const plateW = Math.max(44, label.length * 6.2 + 16);
            const tag = svgEl("g", {
                class: `rel-tag ${tone}`,
                "data-key": `${from.id}|${to.id}`,
                transform: `translate(${mid.x} ${mid.y})`,
            }, ui.edgeLayer);
            svgEl("rect", { class: "rel-plate", x: -plateW / 2, y: -9, width: plateW, height: 16, rx: 3 }, tag);
            const text = svgEl("text", { class: "rel-label", "text-anchor": "middle", y: "3.5" }, tag);
            text.textContent = label;
            const dx = plateW / 2 + 16;
            const bx = mid.x + dx;
            const num = svgEl("g", {
                class: `rel-num ${tone}`,
                "data-key": `${from.id}|${to.id}`,
                "data-dx": dx,
                transform: `translate(${bx} ${mid.y})`,
            }, ui.edgeLayer);
            if (weighed.locked) {
                num.classList.add("locked");
                svgEl("polygon", { class: "rel-num-plate", points: "0,-12 12,0 0,12 -12,0" }, num);
                svgEl("path", { class: "rel-lock", d: "M -3 -1 V -3.2 A 3 3 0 0 1 3 -3.2 V -1" }, num);
                svgEl("rect", { class: "rel-lock-body", x: -4.2, y: -1, width: 8.4, height: 6, rx: 1 }, num);
            } else {
                svgEl("circle", { class: "rel-num-plate", r: 11 }, num);
                const figure = svgEl("text", { class: "rel-num-label", "text-anchor": "middle", y: "3.2" }, num);
                figure.textContent = strengthText(weighed.strength);
            }
            if (!weighed.locked && !state.readOnly) {
                svgEl("polygon", {
                    class: `rel-step up${weighed.strength >= 10 ? " off" : ""}`,
                    points: "-7,-16 7,-16 0,-28",
                }, num);
                svgEl("polygon", {
                    class: `rel-step down${weighed.strength <= -10 ? " off" : ""}`,
                    points: "-7,16 7,16 0,28",
                }, num);
            }
            badgeHits.push({
                key: `${from.id}|${to.id}`,
                id: rel.id || "",
                fromId: from.id,
                toId: to.id,
                relationType: type,
                x: bx,
                y: mid.y,
                strength: weighed.strength,
                locked: weighed.locked,
            });
            if (live && state.phase !== "generating") {
                const pkt = svgEl("circle", { class: `pkt ${cls}`, r: 3.4 }, ui.edgeLayer);
                svgEl("animateMotion", { dur: "1.45s", repeatCount: "indefinite", path: d }, pkt);
            }
        }
        ui.nodes.innerHTML = list.map((card) => {
            const meta = CODEX_TYPES[card.entityType] || { code: "—", color: "#ffffff" };
            const on = selected.has(card.id);
            const wave = waves.byId.has(card.id) ? waves.byId.get(card.id) : null;
            const dim = Boolean(focus) && !near.has(card.id) && wave == null;
            const rank = card.boardKind === "pj" ? "PJ" : card.boardKind === "npc" ? "NPC" : (meta.code || "");
            const fresh = !born.has(card.id);
            born.add(card.id);
            const links = degree.get(card.id) || 0;
            const scanning = wave != null && state.phase === "generating";
            return `<div class="ckt-node${on ? " selected" : ""}${dim ? " dim" : ""}${wave != null ? ` w${wave}` : ""}${scanning ? " gen" : ""}${fresh ? " ckt-enter" : ""}" data-id="${esc(card.id)}" style="left:${card.x + LAB_CARD.w / 2}px;top:${card.y + LAB_CARD.h / 2}px">
              <span class="ckt-port w"></span><span class="ckt-port e"></span><span class="ckt-port n"></span><span class="ckt-port s"></span>
              <div class="avw"><div class="av" style="border-color:${meta.color}"><span class="code" style="color:${meta.color}">${esc(meta.code)}</span></div>${on ? '<span class="ring"></span>' : ""}</div>
              <div class="nm">${esc(card.title || "Sin título")}</div>
              <div class="rank" style="color:${meta.color}">${esc(rank)}</div>
              <div class="sy">${links} vínculo${links === 1 ? "" : "s"}</div>
            </div>`;
        }).join("");
    }
    function paint() {
        if (!ui?.nodes || destroyed) return;
        const list = cards();
        const key = graphSignature(list);
        if (key !== paintKey) {
            paintKey = key;
            drawBoard(list);
        } else {
            placeNodes(list);
        }
        syncLive(list);
        paintWire();
        markAim();
        placePins();
    }

    function paintWire() {
        if (!link || !viewport) {
            ui.wire.setAttribute("display", "none");
            ui.ghost?.setAttribute("display", "none");
            return;
        }
        const from = cards().find((card) => card.id === link.fromId);
        if (!from) {
            ui.wire.setAttribute("display", "none");
            ui.ghost?.setAttribute("display", "none");
            return;
        }
        const aim = link.hoverId ? cards().find((card) => card.id === link.hoverId) : null;
        const origin = centerOf(from);
        ui.wire.setAttribute("display", "inline");
        if (aim) {
            ui.wire.setAttribute("d", pathD(route(origin, centerOf(aim))));
            ui.ghost?.setAttribute("display", "none");
            return;
        }
        ui.wire.setAttribute("d", `M ${origin.x} ${origin.y} L ${link.x} ${link.y}`);
        ui.ghost?.setAttribute("display", "inline");
        ui.ghost?.setAttribute("cx", String(link.x));
        ui.ghost?.setAttribute("cy", String(link.y));
    }

    function paintMarquee() {
        if (!pointer || pointer.mode !== "marquee") {
            ui.marquee.setAttribute("display", "none");
            return;
        }
        const x = Math.min(pointer.x, pointer.cx);
        const y = Math.min(pointer.y, pointer.cy);
        const w = Math.abs(pointer.cx - pointer.x);
        const h = Math.abs(pointer.cy - pointer.y);
        const rect = ui.marquee.querySelector("rect");
        ui.marquee.setAttribute("display", "inline");
        rect?.setAttribute("x", String(x));
        rect?.setAttribute("y", String(y));
        rect?.setAttribute("width", String(w));
        rect?.setAttribute("height", String(h));
    }

    function paintFigure(key, strength) {
        const tone = strength <= -3 ? "hot" : strength >= 3 ? "ok" : strength !== 0 ? "warn" : "idle";
        ui.edgeLayer.querySelectorAll(`[data-key="${key}"]`).forEach((node) => {
            node.classList.remove("ok", "hot", "warn", "idle", "struct");
            node.classList.add(tone);
        });
        const num = ui.edgeLayer.querySelector(`g.rel-num[data-key="${key}"]`);
        const text = num?.querySelector(".rel-num-label");
        if (text && text.textContent !== strengthText(strength)) text.textContent = strengthText(strength);
        num?.querySelector(".rel-step.up")?.classList.toggle("off", strength >= 10);
        num?.querySelector(".rel-step.down")?.classList.toggle("off", strength <= -10);
        const hit = badgeHits.find((row) => row.key === key);
        if (hit) hit.strength = strength;
    }

    function syncLive(list) {
        const byId = new Map(list.map((card) => [card.id, card]));
        for (const rel of state.relations || []) {
            const from = byId.get(endId(rel, "from"));
            const to = byId.get(endId(rel, "to"));
            if (!from || !to) continue;
            const weighed = toneOf(rel, from, to);
            if (weighed.locked) continue;
            const key = `${from.id}|${to.id}`;
            const pending = pendingStrength.get(key);
            const strength = pending != null ? pending : weighed.strength;
            if (pending != null && pending === weighed.strength) pendingStrength.delete(key);
            paintFigure(key, strength);
        }
        syncImpact(list);
    }

    function paintGhosts(list) {
        const ghosts = state.ghosts || [];
        const byId = new Map(list.map((card) => [card.id, card]));
        const want = new Set();
        for (const row of ghosts) {
            const from = byId.get(row.fromId);
            const to = byId.get(row.toId);
            if (!from || !to) continue;
            want.add(row.key);
            let group = ui.ghostLayer.querySelector(`g.ghost-edge[data-key="${row.key}"]`);
            if (!group) {
                group = svgEl("g", { class: "ghost-edge", "data-key": row.key }, ui.ghostLayer);
                svgEl("path", { class: "ghost-trace" }, group);
                const tag = svgEl("g", { class: "ghost-tag" }, group);
                svgEl("rect", { class: "ghost-plate", y: -9, height: 17, rx: 3 }, tag);
                svgEl("text", { class: "ghost-label", "text-anchor": "middle", y: "3.6" }, tag);
            }
            const pts = route(centerOf(from), centerOf(to));
            const path = group.querySelector(".ghost-trace");
            path.setAttribute("d", pathD(pts));
            path.setAttribute("stroke", row.color);
            path.setAttribute("color", row.color);
            const mid = labelPoint(pts);
            const tag = group.querySelector(".ghost-tag");
            tag.setAttribute("transform", `translate(${mid.x} ${mid.y - 18})`);
            const text = `NUEVO · ${row.label}`;
            const label = tag.querySelector(".ghost-label");
            if (label.textContent !== text) label.textContent = text;
            label.setAttribute("fill", row.color);
            const plate = tag.querySelector(".ghost-plate");
            const w = Math.max(60, text.length * 6.1 + 16);
            plate.setAttribute("x", String(-w / 2));
            plate.setAttribute("width", String(w));
            plate.setAttribute("stroke", row.color);
        }
        ui.ghostLayer.querySelectorAll("g.ghost-edge").forEach((group) => {
            if (!want.has(group.dataset.key)) group.remove();
        });
    }

    function syncImpact(list = cards()) {
        const marks = state.impactMarks || {};
        const edges = state.edgeDeltas || {};
        const marking = Object.keys(marks).length > 0;
        const edgeMarking = Object.keys(edges).length > 0;
        paintGhosts(list);
        const anchors = new Set(marking ? state.anchorIds || [] : []);
        ui.nodes?.querySelectorAll(".ckt-node").forEach((node) => {
            const id = node.dataset.id || "";
            const anchorOnly = anchors.has(id) && !marks[id];
            const mark = marks[id] || (anchorOnly ? { label: "ANCLA DEL EVENTO", color: "#00f2ea" } : null);
            node.classList.toggle("impact-anchor", anchorOnly);
            if (mark) node.classList.remove("dim");
            const want = !mark ? ""
                : mark.status === "accepted" ? "done"
                    : mark.status === "rejected" ? "rej"
                        : mark.grade || "";
            if ((node.dataset.seal || "") !== want) {
                node.classList.remove("seal-ok", "seal-warn", "seal-fail", "seal-done", "seal-rej", "show-seal");
                node.dataset.seal = want;
                if (want) node.classList.add(`seal-${want}`, "show-seal");
            }
            if (marking) node.classList.remove("w0", "w1", "w2", "w3", "w4", "w5");
            node.classList.toggle("impact-idle", marking && !mark);
            let chip = node.querySelector(".ckt-float");
            if (!mark) {
                chip?.remove();
                return;
            }
            if (!chip) {
                chip = document.createElement("div");
                chip.className = "ckt-float";
                node.appendChild(chip);
            }
            if (chip.textContent !== mark.label) chip.textContent = mark.label;
            chip.style.color = mark.color;
            chip.style.borderColor = mark.color;
        });
        if (marking) ui.edgeLayer?.querySelectorAll("circle.pkt").forEach((node) => node.remove());
        ui.edgeLayer?.querySelectorAll("[data-key]").forEach((node) => {
            const kind = node.classList.contains("trace")
                || node.classList.contains("trace-flow")
                || node.classList.contains("rel-tag")
                || node.classList.contains("rel-num")
                || node.classList.contains("pad");
            if (!kind) return;
            const [a, b] = String(node.dataset.key).split("|");
            const row = edges[node.dataset.key] || edges[`${b}|${a}`];
            node.classList.toggle("impact-idle", edgeMarking && !row);
            if (row) node.classList.remove("dim");
            node.classList.toggle("rv-accepted", row?.status === "accepted");
            node.classList.toggle("rv-rejected", row?.status === "rejected");
            node.classList.toggle("rv-pending", Boolean(row) && row.status !== "accepted" && row.status !== "rejected");
            if (!node.classList.contains("rel-num")) return;
            let ghost = node.querySelector(".rel-delta");
            if (!row) {
                ghost?.remove();
                return;
            }
            if (!ghost) {
                ghost = svgEl("text", {
                    class: "rel-delta",
                    x: "18",
                    y: "3.2",
                    "text-anchor": "start",
                }, node);
            }
            if (ghost.textContent !== row.text) ghost.textContent = row.text;
            ghost.setAttribute("fill", row.color);
        });
    }

    function pointAlong(pts, t) {
        let total = 0;
        const lens = [];
        for (let i = 1; i < pts.length; i += 1) {
            const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
            lens.push(len);
            total += len;
        }
        let left = Math.max(0, Math.min(1, t)) * total;
        for (let i = 1; i < pts.length; i += 1) {
            const len = lens[i - 1];
            if (left <= len || i === pts.length - 1) {
                const k = len ? left / len : 0;
                return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k };
            }
            left -= len;
        }
        return pts[pts.length - 1];
    }

    function spawnBursts() {
        const byId = new Map(cards().map((card) => [card.id, card]));
        const marks = state.impactMarks || {};
        const order = (state.waves || []).flatMap((wave) => wave.nodeIds || []);
        const ids = [...new Set([...order.filter((id) => marks[id]), ...Object.keys(marks)])];
        bursts = ids.map((id, index) => {
            const card = byId.get(id);
            if (!card) return null;
            const c = centerOf(card);
            return {
                x: c.x,
                y: c.y,
                color: PIXI.Color.shared.setValue(marks[id].color || "#00f2ea").toNumber(),
                at: fxClock,
                delay: Math.min(index, 10) * 0.08,
                spin: index * 0.7,
            };
        }).filter(Boolean);
    }

    function fxTick(ticker) {
        if (!fx || !viewport || destroyed) return;
        fxClock += (ticker?.deltaMS || 16) / 1000;
        const generating = state.phase === "generating";
        if (!generating && !bursts.length) {
            if (fx.dirty) {
                fx.sweep.clear();
                fx.rings.clear();
                fx.packets.clear();
                fx.burst.clear();
                fx.dirty = false;
            }
            return;
        }
        fx.dirty = true;
        const px = 1 / (viewport.scale.x || 1);
        fx.sweep.clear();
        fx.rings.clear();
        fx.packets.clear();
        fx.burst.clear();
        if (generating) {
            const byId = new Map(cards().map((card) => [card.id, card]));
            const anchor = (state.waves?.[0]?.nodeIds || []).map((id) => byId.get(id)).find(Boolean);
            if (anchor) {
                const c = centerOf(anchor);
                let reach = 260;
                for (const wave of state.waves || []) {
                    for (const id of wave.nodeIds || []) {
                        const card = byId.get(id);
                        if (!card) continue;
                        const p = centerOf(card);
                        reach = Math.max(reach, Math.hypot(p.x - c.x, p.y - c.y) + 140);
                    }
                }
                for (let k = 0; k < 3; k += 1) {
                    const t = (fxClock / 1.8 + k / 3) % 1;
                    fx.rings.circle(c.x, c.y, 50 + t * reach).stroke({ width: 2 * px, color: 0x00f2ea, alpha: (1 - t) * 0.6 });
                }
                const head = fxClock * 1.9;
                for (let i = 0; i < 12; i += 1) {
                    const a1 = head - i * 0.05;
                    fx.sweep.moveTo(c.x, c.y).arc(c.x, c.y, reach, a1 - 0.05, a1).lineTo(c.x, c.y)
                        .fill({ color: 0x00f2ea, alpha: 0.11 * (1 - i / 12) });
                }
                fx.sweep.moveTo(c.x, c.y)
                    .lineTo(c.x + Math.cos(head) * reach, c.y + Math.sin(head) * reach)
                    .stroke({ width: 1.5 * px, color: 0xb8fffb, alpha: 0.75 });
                fx.rings.circle(c.x, c.y, 8 * px + 6).fill({ color: 0x00f2ea, alpha: 0.35 + 0.25 * Math.sin(fxClock * 8) });
            }
            (state.waves || []).forEach((wave, wi) => {
                const color = FX_WAVE[Math.min(wi, FX_WAVE.length - 1)];
                (wave.edges || []).forEach((edge, ei) => {
                    const from = byId.get(edge.fromId);
                    const to = byId.get(edge.toId);
                    if (!from || !to) return;
                    const pts = route(centerOf(from), centerOf(to));
                    const t = (fxClock * 0.75 + wi * 0.27 + ei * 0.13) % 1;
                    for (let k = 0; k < 4; k += 1) {
                        const p = pointAlong(pts, t - k * 0.035);
                        fx.packets.circle(p.x, p.y, (4.2 - k) * px).fill({ color, alpha: 1 - k * 0.24 });
                    }
                });
            });
        }
        const LIFE = 1.15;
        bursts = bursts.filter((b) => fxClock - b.at < LIFE + b.delay);
        for (const b of bursts) {
            const t = (fxClock - b.at - b.delay) / LIFE;
            if (t < 0) continue;
            const ease = 1 - (1 - t) ** 3;
            fx.burst.circle(b.x, b.y, 40 + ease * 120).stroke({ width: (3.5 * (1 - t) + 0.6) * px, color: b.color, alpha: 1 - t });
            fx.burst.circle(b.x, b.y, 30 + ease * 60).stroke({ width: 1.2 * px, color: 0xffffff, alpha: (1 - t) * 0.5 });
            for (let k = 0; k < 10; k += 1) {
                const a = (k / 10) * Math.PI * 2 + b.spin;
                const d = 50 + ease * 100;
                fx.burst.circle(b.x + Math.cos(a) * d, b.y + Math.sin(a) * d, (3 * (1 - t) + 1) * px)
                    .fill({ color: b.color, alpha: 1 - t });
            }
        }
    }

    function pickNudge(x, y) {
        const reach = 14 / (viewport?.scale?.x || 1);
        let best = null;
        let bestD = reach;
        for (const row of badgeHits) {
            if (row.locked) continue;
            for (const dir of [1, -1]) {
                const dist = Math.hypot(row.x - x, row.y - dir * STEP - y);
                if (dist <= bestD) {
                    best = { row, dir };
                    bestD = dist;
                }
            }
        }
        return best;
    }

    function nudgeStrength(hit) {
        const next = Math.max(-10, Math.min(10, hit.row.strength + hit.dir));
        if (next === hit.row.strength) return;
        pendingStrength.set(hit.row.key, next);
        hit.row.strength = next;
        paintFigure(hit.row.key, next);
        actions.onStrength?.({
            id: hit.row.id,
            fromId: hit.row.fromId,
            toId: hit.row.toId,
            relationType: hit.row.relationType,
            strength: next,
        });
    }
    function pickAt(x, y, pad = 0) {
        const list = cards();
        for (let i = list.length - 1; i >= 0; i -= 1) {
            const card = list[i];
            if (x >= card.x - pad && x <= card.x + LAB_CARD.w + pad && y >= card.y - pad && y <= card.y + LAB_CARD.h + pad) return card;
        }
        return null;
    }
    function markAim() {
        const id = link?.hoverId || "";
        ui.nodes?.querySelectorAll(".ckt-node").forEach((node) => {
            const mine = node.dataset.id === id;
            node.classList.toggle("aim", mine);
            if (mine) node.classList.remove("hot");
        });
    }

    function clientToWorld(clientX, clientY) {
        const rect = pixiApp.canvas.getBoundingClientRect();
        const gx = (clientX - rect.left) * (pixiApp.screen.width / Math.max(1, rect.width));
        const gy = (clientY - rect.top) * (pixiApp.screen.height / Math.max(1, rect.height));
        return viewport.toWorld({ x: gx, y: gy });
    }

    function screenPoint(event) {
        const native = event.nativeEvent || event;
        if (Number.isFinite(native.clientX)) return { x: native.clientX, y: native.clientY };
        const rect = pixiApp.canvas.getBoundingClientRect();
        return { x: rect.left + (event.global?.x || 0), y: rect.top + (event.global?.y || 0) };
    }

    function select(ids) {
        state = { ...state, selectedIds: ids };
        actions.onSelect?.(ids);
        paint();
    }

    function onHitDown(event) {
        if (!viewport || (event.button != null && event.button !== 0)) return;
        const world = viewport.toWorld(event.global);
        const card = pickAt(world.x, world.y);
        if (link) {
            event.stopPropagation();
            if (performance.now() - armedAt < 280) return;
            const aim = (card && card.id !== link.fromId) ? card : pickAt(world.x, world.y, 18);
            if (aim && aim.id !== link.fromId) {
                const point = screenPoint(event);
                const fromId = link.fromId;
                link = null;
                if (viewport) viewport.cursor = "grab";
                markAim();
                paintWire();
                actions.onLink?.({ fromId, toId: aim.id, clientX: point.x, clientY: point.y });
            } else if (!aim) {
                link = null;
                if (viewport) viewport.cursor = "grab";
                markAim();
                paintWire();
            }
            return;
        }
        const nudge = !state.readOnly ? pickNudge(world.x, world.y) : null;
        if (nudge) {
            event.stopPropagation();
            nudgeStrength(nudge);
            return;
        }
        event.stopPropagation();
        viewport.plugins.pause("drag");
        viewport.plugins.pause("decelerate");
        if (!card) {
            pointer = { mode: "marquee", x: world.x, y: world.y, cx: world.x, cy: world.y, shift: !!event.shiftKey };
            viewport.cursor = "crosshair";
            bindDrag();
            return;
        }
        if (event.shiftKey) {
            const set = new Set(state.selectedIds || []);
            if (set.has(card.id)) set.delete(card.id);
            else set.add(card.id);
            viewport.plugins.resume("drag");
            viewport.plugins.resume("decelerate");
            select([...set]);
            return;
        }
        const already = (state.selectedIds || []).includes(card.id) && state.selectedIds.length > 1;
        const ids = already ? [...state.selectedIds] : [card.id];
        if (!already) select(ids);
        if (state.readOnly) {
            viewport.plugins.resume("drag");
            viewport.plugins.resume("decelerate");
            return;
        }
        const members = cards()
            .filter((row) => ids.includes(row.id))
            .map((row) => ({ id: row.id, x: row.x, y: row.y }));
        pointer = { mode: "drag", members, x: world.x, y: world.y, moved: false };
        viewport.cursor = "grabbing";
        bindDrag();
    }

    function bindDrag() {
        window.addEventListener("pointermove", onDragMove);
        window.addEventListener("pointerup", onDragUp);
    }

    function unbindDrag() {
        window.removeEventListener("pointermove", onDragMove);
        window.removeEventListener("pointerup", onDragUp);
    }

    function onDragMove(event) {
        if (!pointer || !viewport) return;
        const world = clientToWorld(event.clientX, event.clientY);
        if (pointer.mode === "marquee") {
            pointer.cx = world.x;
            pointer.cy = world.y;
            paintMarquee();
            return;
        }
        if (Math.hypot(world.x - pointer.x, world.y - pointer.y) > 2) pointer.moved = true;
        const dx = world.x - pointer.x;
        const dy = world.y - pointer.y;
        const positions = { ...state.positions };
        pointer.members.forEach((member) => {
            positions[member.id] = { x: member.x + dx, y: member.y + dy };
        });
        state = { ...state, positions };
        paint();
    }

    function finishMarquee() {
        const x1 = Math.min(pointer.x, pointer.cx);
        const y1 = Math.min(pointer.y, pointer.cy);
        const x2 = Math.max(pointer.x, pointer.cx);
        const y2 = Math.max(pointer.y, pointer.cy);
        const scale = viewport?.scale?.x || 1;
        if ((x2 - x1) * scale < 6 && (y2 - y1) * scale < 6) {
            if (!pointer.shift) select([]);
            return;
        }
        const hits = cards()
            .filter((card) => card.x < x2 && card.x + LAB_CARD.w > x1 && card.y < y2 && card.y + LAB_CARD.h > y1)
            .map((card) => card.id);
        if (pointer.shift) {
            select([...new Set([...(state.selectedIds || []), ...hits])]);
            return;
        }
        select(hits);
    }

    function onDragUp(event) {
        if (!pointer) return;
        const mode = pointer.mode;
        if (mode === "marquee") {
            finishMarquee();
        } else if (mode === "drag" && pointer.moved) {
            const world = clientToWorld(event.clientX, event.clientY);
            const dx = world.x - pointer.x;
            const dy = world.y - pointer.y;
            const moves = pointer.members.map((member) => ({
                id: member.id,
                x: snap(member.x + dx),
                y: snap(member.y + dy),
            }));
            const positions = { ...state.positions };
            moves.forEach((move) => {
                positions[move.id] = { x: move.x, y: move.y };
            });
            state = { ...state, positions };
            paint();
            actions.onMove?.(moves);
        }
        pointer = null;
        ui.marquee.setAttribute("display", "none");
        unbindDrag();
        viewport?.plugins.resume("drag");
        viewport?.plugins.resume("decelerate");
        if (viewport) viewport.cursor = link ? "crosshair" : "grab";
    }

    function onPanDown(event) {
        if (!viewport || event.button !== 2 || pointer) return;
        const world = viewport.toWorld(event.global);
        const card = pickAt(world.x, world.y);
        pointer = {
            mode: "right",
            gx: event.global.x,
            gy: event.global.y,
            wx: world.x,
            wy: world.y,
            id: card?.id || "",
        };
        viewport.cursor = "grabbing";
    }

    function onPanUp(event) {
        if (!pointer || pointer.mode !== "right") return;
        const moved = Math.hypot((event.global?.x ?? pointer.gx) - pointer.gx, (event.global?.y ?? pointer.gy) - pointer.gy) > 6;
        const info = pointer;
        pointer = null;
        if (viewport) viewport.cursor = link ? "crosshair" : "grab";
        if (moved || state.readOnly) return;
        if (link) {
            link = null;
            if (viewport) viewport.cursor = "grab";
            markAim();
            paintWire();
            return;
        }
        const point = screenPoint(event);
        const selected = state.selectedIds || [];
        const many = selected.length > 1 && (!info.id || selected.includes(info.id));
        actions.onMenu?.({
            mode: many ? "multi" : info.id ? "node" : "empty",
            ids: many ? selected : info.id ? [info.id] : [],
            clientX: point.x,
            clientY: point.y,
            worldX: info.wx,
            worldY: info.wy,
        });
    }

    function onKey(event) {
        if (event.key !== "Escape" || !link) return;
        link = null;
        if (viewport) viewport.cursor = "grab";
        markAim();
        paintWire();
    }

    function onWireMove(event) {
        if (!viewport || !pixiApp) return;
        if (link) {
            const world = clientToWorld(event.clientX, event.clientY);
            const card = pickAt(world.x, world.y, 18);
            const hover = card && card.id !== link.fromId ? card.id : "";
            link = { ...link, x: world.x, y: world.y, hoverId: hover };
            if (viewport) viewport.cursor = hover ? "pointer" : "crosshair";
            markAim();
            paintWire();
            return;
        }
        if (pointer) return;
        const world = clientToWorld(event.clientX, event.clientY);
        const nudge = !state.readOnly && pickNudge(world.x, world.y);
        if (nudge) {
            if (viewport) viewport.cursor = "pointer";
            if (hoverId) {
                hoverId = "";
                ui.nodes?.querySelectorAll(".ckt-node.hot").forEach((node) => node.classList.remove("hot"));
            }
            return;
        }
        if (viewport && viewport.cursor === "pointer") viewport.cursor = "grab";
        const card = pickAt(world.x, world.y);
        const next = card?.id || "";
        if (next === hoverId) return;
        hoverId = next;
        ui.nodes?.querySelectorAll(".ckt-node").forEach((node) => {
            node.classList.toggle("hot", node.dataset.id === hoverId);
        });
    }

    function frameIds(ids) {
        const list = cards().filter((card) => ids.includes(card.id));
        if (!list.length || !ui.stage.clientWidth) return;
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        list.forEach((card) => {
            minX = Math.min(minX, card.x - 80);
            minY = Math.min(minY, card.y - 80);
            maxX = Math.max(maxX, card.x + LAB_CARD.w + 80);
            maxY = Math.max(maxY, card.y + LAB_CARD.h + 80);
        });
        const bw = Math.max(480, maxX - minX);
        const bh = Math.max(320, maxY - minY);
        const stageR = ui.stage.clientHeight / Math.max(1, ui.stage.clientWidth);
        let w = bw;
        let h = w * stageR;
        if (h < bh) {
            h = bh;
            w = h / Math.max(0.2, stageR);
        }
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        writeViewport({ x: cx - w / 2, y: cy - h / 2, w, h }, true);
    }

    const api = {
        setState(next) {
            const prevFocus = state.focusId;
            const prevPhase = state.phase;
            const dragging = pointer?.mode === "drag" || pointer?.mode === "marquee";
            state = { ...state, ...next, positions: dragging ? state.positions : (next.positions || state.positions) };
            if (state.phase === "result" && prevPhase !== "result") spawnBursts();
            if (state.phase !== "result" && prevPhase === "result") bursts = [];
            if (dragging) return;
            paint();
            if (state.focusId && state.focusId !== prevFocus && state.focusId !== framed) {
                framed = state.focusId;
                frameIds([state.focusId]);
            }
        },
        armLink(fromId) {
            const from = cards().find((card) => card.id === fromId);
            if (!from) return;
            link = {
                fromId,
                x: from.x + LAB_CARD.w / 2,
                y: from.y + LAB_CARD.h / 2,
            };
            armedAt = performance.now();
            if (viewport) viewport.cursor = "crosshair";
            paintWire();
        },
        disarm() {
            link = null;
            if (viewport) viewport.cursor = "grab";
            markAim();
            paintWire();
        },
        frame(ids) {
            frameIds(ids);
        },
        select(ids) {
            select(Array.isArray(ids) ? ids : []);
        },
        /** Keeps a DOM element beside a card through pan and zoom. Returns the unpin. */
        pin(el, id) {
            if (!el || !id) return () => {};
            pins.set(el, id);
            const watch = new ResizeObserver(() => placePins());
            watch.observe(el);
            placePins();
            return () => {
                watch.disconnect();
                pins.delete(el);
            };
        },
        setGutter(next) {
            gutter = { ...gutter, ...next };
            placePins();
        },
        dropPending(key) {
            if (key) pendingStrength.delete(key);
            else pendingStrength.clear();
            paint();
        },
        destroy() {
            destroyed = true;
            document.removeEventListener("contextmenu", blockMenuIfLab, true);
            if (menuStage) menuStage.oncontextmenu = null;
            host.oncontextmenu = null;
            menuStage?.removeEventListener("contextmenu", blockMenu, true);
            document.removeEventListener("keydown", onKey, true);
            window.removeEventListener("pointermove", onWireMove);
            unbindDrag();
            pins.clear();
            pixiApp?.ticker?.remove?.(fxTick);
            resizeObs?.disconnect();
            viewport?.destroy?.({ children: true });
            pixiApp?.destroy?.(true, { children: true });
            viewport = null;
            pixiApp = null;
            host.innerHTML = "";
        },
    };
    return api;
}
