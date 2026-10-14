/* TIMELINE · sistema solar. Manual graph: the author places each body and draws each link.
   The camera is a Pixi Viewport (right-drag, wheel, pinch, decelerate); the SVG viewBox follows
   it so text is never selected. A short right-click opens the menu. Empty space can create a
   neutral node. A body (the sun included) can arm a link from «Enlazar».
   The DM edits the title and the date in the dossier. Leaving the field saves and returns to the label.
   The symbol and the type name are one control. Entity ink and aura are chosen beside that control.
   The relation is chosen on a left-click over another body, or on empty space (a new neutral).
   Left-drag on empty space marquees a selection. With several chosen, the menu groups or
   links them together. Data comes from an adapter (mesa / biblioteca). Writes go back
   through `actions`. */
import * as PIXI from "pixi.js";
import { Viewport } from "pixi-viewport";
import {
    DZ_MON,
    anchorFromFields,
    arcRange,
    eraRange,
    eventYear,
    fmtMesa,
    canGroup,
    groupDirection,
    linkPorts,
    panelForest,
    parseDZ,
    plainRecap,
    sessionDayLabel,
    sessionsHungOn,
    rollupIndex,
    twinPorts,
    upsertLink,
    wouldCycle,
} from "../../../utils/archiveTimeline";
import { CODEX_TYPES } from "../../../constants/wiki/archiveCodex";

const SVG_NS = "http://www.w3.org/2000/svg";
const GRID = 32;
const ERA_C = "#ff1493";
const ARC_FALLBACK = "#9aa0b4";
const ROCK = "#c8c4bc";
const NEUTRAL_C = "#d5d8e0";
const SESSION_C = "#c4b5fd";
const SUN_C = "#f5c542";
const INK = "#f5c542";
const AURA_R = 150;
const LENS_KINDS = ["planet", "moon", "asteroid", "neutral", "session"];
const SUN_HOME = { x: 16 + 18 * GRID, y: 16 + 16 * GRID };
const WIRE_C = "#ff1493";

function svgEl(name, attrs, parent) {
    const n = document.createElementNS(SVG_NS, name);
    for (const [k, v] of Object.entries(attrs || {})) {
        if (v == null || v === false) continue;
        n.setAttribute(k, String(v));
    }
    if (parent) parent.appendChild(n);
    return n;
}
function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
}
function button(className, text, onClick) {
    const b = el("button", className, text);
    b.type = "button";
    if (onClick) b.addEventListener("click", onClick);
    return b;
}
function hexToHsv(hex) {
    const raw = /^#[0-9a-fA-F]{6}$/.test(hex || "") ? hex : INK;
    const n = parseInt(raw.slice(1), 16);
    const r = ((n >> 16) & 255) / 255;
    const g = ((n >> 8) & 255) / 255;
    const b = (n & 255) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d) {
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
    }
    return { h, s: max === 0 ? 0 : d / max, v: max };
}
function hsvToHex(h, s, v) {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r = 0;
    let g = 0;
    let b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    const part = (n) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
    return `#${part(r)}${part(g)}${part(b)}`;
}
function fold(s) {
    return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
function snap(x, y) {
    const s = (v) => 16 + Math.round((v - 16) / GRID) * GRID;
    return { x: s(x), y: s(y) };
}
function arcPath(r, a0deg, a1deg) {
    const a0 = (a0deg * Math.PI) / 180;
    const a1 = (a1deg * Math.PI) / 180;
    const large = a1deg - a0deg > 180 ? 1 : 0;
    return `M ${(Math.cos(a0) * r).toFixed(2)} ${(Math.sin(a0) * r).toFixed(2)} A ${r} ${r} 0 ${large} 1 ${(Math.cos(a1) * r).toFixed(2)} ${(Math.sin(a1) * r).toFixed(2)}`;
}
function ticks(parent, r, n, len, color, opacity) {
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        svgEl("line", {
            x1: (Math.cos(a) * r).toFixed(2), y1: (Math.sin(a) * r).toFixed(2),
            x2: (Math.cos(a) * (r - len)).toFixed(2), y2: (Math.sin(a) * (r - len)).toFixed(2),
            stroke: color, "stroke-opacity": opacity, "stroke-width": 1,
        }, parent);
    }
}
function spinEl(node, seconds, reverse) {
    svgEl("animateTransform", {
        attributeName: "transform", type: "rotate", from: "0 0 0",
        to: `${reverse ? -360 : 360} 0 0`, dur: `${seconds}s`, repeatCount: "indefinite",
    }, node);
}
function drawHudPath(parent, d, st) {
    const glow = svgEl("path", {
        d, fill: "none", stroke: st.color, "stroke-width": (st.width || 1.2) + 3.2,
        "stroke-opacity": 0.2 * (st.opacity == null ? 1 : st.opacity),
        "stroke-linecap": "round", "stroke-dasharray": st.dash || null,
    }, parent);
    const path = svgEl("path", {
        d, fill: "none", stroke: st.color, "stroke-width": st.width || 1.2,
        "stroke-opacity": st.opacity == null ? 1 : st.opacity,
        "stroke-linecap": "round", "stroke-dasharray": st.dash || null,
    }, parent);
    return { glow, path };
}
function flowParticles(parent, d, color, count, seconds) {
    const g = svgEl("g", {}, parent);
    const motions = [];
    const n = count || 3;
    const dur = seconds || 2.8;
    for (let i = 0; i < n; i++) {
        const c = svgEl("circle", { r: 2.1, fill: "#fff6d0", stroke: color, "stroke-width": 0.7 }, g);
        const begin = `${-((i * dur) / n)}s`;
        motions.push(svgEl("animateMotion", { dur: `${dur}s`, begin, repeatCount: "indefinite", path: d }, c));
        svgEl("animate", { attributeName: "opacity", values: "0.35;1;0.35", dur: `${dur}s`, begin, repeatCount: "indefinite" }, c);
    }
    return { g, motions };
}
function drawSunGraphic(parent) {
    const g = svgEl("g", { transform: "scale(0.923)" }, parent);
    svgEl("circle", { r: 78, fill: "none", stroke: SUN_C, "stroke-width": 1, "stroke-opacity": 0.45, class: "halo-pulse" }, g);
    svgEl("circle", { r: 68, fill: "none", stroke: SUN_C, "stroke-width": 0.7, "stroke-opacity": 0.55, "stroke-dasharray": "2 4" }, g);
    ticks(g, 60, 28, 4, SUN_C, 0.75);
    [[-56, 0, -42, 0], [42, 0, 56, 0], [0, -56, 0, -42], [0, 42, 0, 56]].forEach(([x1, y1, x2, y2]) => {
        svgEl("line", { x1, y1, x2, y2, stroke: SUN_C, "stroke-width": 1, "stroke-opacity": 0.8 }, g);
    });
    const spin = svgEl("g", {}, g);
    spinEl(spin, 16, false);
    svgEl("circle", { r: 48, fill: "none", stroke: SUN_C, "stroke-width": 1.15 }, spin);
    svgEl("circle", { cx: 48, r: 4.2, fill: "none", stroke: SUN_C, "stroke-width": 0.8 }, spin);
    svgEl("circle", { cx: 48, r: 2.1, fill: "#fff6d0" }, spin);
    const spin2 = svgEl("g", {}, g);
    spinEl(spin2, 26, true);
    svgEl("path", { d: arcPath(36, -30, 210), fill: "none", stroke: "#00f2ea", "stroke-width": 1.35, "stroke-linecap": "round" }, spin2);
    svgEl("circle", { cx: 36, r: 1.7, fill: "#00f2ea" }, spin2);
    svgEl("circle", { r: 26, fill: "none", stroke: SUN_C, "stroke-width": 1.45, class: "hud-pulse" }, g);
    svgEl("circle", { r: 16, fill: "none", stroke: SUN_C, "stroke-width": 0.8, "stroke-opacity": 0.75 }, g);
    svgEl("circle", { r: 7, fill: "none", stroke: "#fff6d0", "stroke-width": 1.4 }, g);
    svgEl("circle", { r: 2, fill: SUN_C, class: "hud-pulse" }, g);
    svgEl("circle", { r: 26, fill: "none", stroke: SUN_C, class: "flash", opacity: 0, "stroke-width": 2 }, g);
}
function drawEraGraphic(parent, color) {
    const g = svgEl("g", {}, parent);
    svgEl("rect", {
        x: -28, y: -16, width: 56, height: 32, rx: 2,
        fill: "none", stroke: color, "stroke-width": 1.35,
    }, g);
    const ink = { fill: "none", stroke: color, "stroke-width": 1.6, "stroke-linecap": "round" };
    svgEl("path", { d: "M -16 -8 L -16 8 M -16 -8 L -10 -8 M -16 8 L -10 8", ...ink }, g);
    svgEl("path", { d: "M 16 -8 L 16 8 M 16 -8 L 10 -8 M 16 8 L 10 8", ...ink }, g);
    const scan = svgEl("line", { x1: -8, y1: 0, x2: 8, y2: 0, stroke: color, "stroke-width": 1.15, "stroke-linecap": "round" }, g);
    svgEl("animateTransform", {
        attributeName: "transform", type: "translate", values: "-4 0; 4 0; -4 0", dur: "3.2s", repeatCount: "indefinite",
    }, scan);
    svgEl("animate", { attributeName: "opacity", values: "0.25;1;0.25", dur: "3.2s", repeatCount: "indefinite" }, scan);
    svgEl("rect", {
        x: -28, y: -16, width: 56, height: 32, rx: 2,
        fill: "none", stroke: color, class: "flash", opacity: 0, "stroke-width": 2,
    }, g);
}
function drawArcGraphic(parent, color) {
    const g = svgEl("g", {}, parent);
    svgEl("polyline", {
        points: "-18,10 -6,10 0,-14 6,10 18,10",
        fill: "none", stroke: color, "stroke-width": 1.7, "stroke-linejoin": "round", "stroke-linecap": "round",
    }, g);
    const dot = svgEl("circle", { cy: -14, r: 2.3, fill: color, stroke: "none" }, g);
    svgEl("animate", { attributeName: "cy", values: "-14;-20;-14", dur: "1.6s", repeatCount: "indefinite" }, dot);
    svgEl("circle", { r: 22, fill: "none", stroke: color, class: "flash", opacity: 0, "stroke-width": 1.5 }, g);
}
function drawEventGraphic(parent, color) {
    const g = svgEl("g", {}, parent);
    svgEl("animateTransform", {
        attributeName: "transform", type: "scale", values: "1;0.7;1.1;1", dur: "1.35s", repeatCount: "indefinite",
    }, g);
    svgEl("polygon", {
        points: "0,-13 11,0 0,13 -11,0",
        fill: "none", stroke: color, "stroke-width": 1.5, "stroke-linejoin": "round",
    }, g);
    svgEl("polygon", { points: "0,-4.5 4,0 0,4.5 -4,0", fill: color, stroke: "none" }, g);
    svgEl("circle", { r: 16, fill: "none", stroke: color, class: "flash", opacity: 0, "stroke-width": 1.5 }, parent);
}
function drawNeutralGraphic(parent, color) {
    const ink = color || NEUTRAL_C;
    const spin = svgEl("g", {}, parent);
    svgEl("animateTransform", {
        attributeName: "transform", type: "rotate", values: "0;90;0", dur: "3.6s", repeatCount: "indefinite",
    }, spin);
    svgEl("rect", {
        x: -8, y: -8, width: 16, height: 16,
        fill: "none", stroke: ink, "stroke-width": 1.3,
    }, spin);
    const core = svgEl("circle", { r: 2.2, fill: "none", stroke: ink, "stroke-width": 1 }, parent);
    svgEl("animate", { attributeName: "r", values: "1.5;3.1;1.5", dur: "3.6s", repeatCount: "indefinite" }, core);
    svgEl("circle", { r: 14, fill: "none", stroke: ink, class: "flash", opacity: 0, "stroke-width": 1.4 }, parent);
}
function drawSessionGraphic(parent, color) {
    const g = svgEl("g", {}, parent);
    svgEl("animateTransform", {
        attributeName: "transform", type: "rotate", values: "-8;8;-8", dur: "2.6s", repeatCount: "indefinite",
    }, g);
    svgEl("polygon", {
        points: "0,-16 14,-8 14,8 0,16 -14,8 -14,-8",
        fill: "none", stroke: color, "stroke-width": 1.45, "stroke-linejoin": "round",
    }, g);
    [[0, -8, "0s"], [-6, 1, "0.2s"], [6, 1, "0.4s"], [0, 9, "0.6s"]].forEach(([cx, cy, begin]) => {
        const pip = svgEl("circle", { cx, cy, r: 1.5, fill: color, stroke: "none" }, g);
        svgEl("animate", {
            attributeName: "opacity", values: "0.25;1;0.25", dur: "1.2s", begin, repeatCount: "indefinite",
        }, pip);
    });
    svgEl("circle", { r: 18, fill: "none", stroke: color, class: "flash", opacity: 0, "stroke-width": 1.5 }, parent);
}
/** Arc colour lifted until it reads on the dark stage (contrast ≥ 3). */
function readable(hex) {
    const raw = String(hex || "").trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(raw)) return ARC_FALLBACK;
    const n = parseInt(raw.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const lin = (c) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
    const contrast = () => (0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) + 0.05) / 0.05;
    let guard = 0;
    while (contrast() < 3 && guard < 8) {
        r = Math.round(r + (255 - r) * 0.28);
        g = Math.round(g + (255 - g) * 0.28);
        b = Math.round(b + (255 - b) * 0.28);
        guard += 1;
    }
    const h = (v) => v.toString(16).padStart(2, "0");
    return `#${h(r)}${h(g)}${h(b)}`;
}
function wait(ms) { return new Promise((resolve) => { setTimeout(resolve, ms); }); }
function typeOf(body) {
    if (!body) return "";
    if (body.kind === "sun") return "lore";
    if (body.kind === "planet") return "era";
    if (body.kind === "moon") return "arco";
    if (body.kind === "session") return "sesion";
    if (body.kind === "neutral") return "neutro";
    return "acontecimiento";
}
/** Arrow tip at (x, y), pointing along (ux, uy). */
function arrowPoints(ux, uy, x, y) {
    const len = Math.hypot(ux, uy) || 1;
    const sx = ux / len;
    const sy = uy / len;
    const px = -sy;
    const py = sx;
    const left = { x: x - sx * 11 + px * 4.5, y: y - sy * 11 + py * 4.5 };
    const right = { x: x - sx * 11 - px * 4.5, y: y - sy * 11 - py * 4.5 };
    return `${x.toFixed(1)},${y.toFixed(1)} ${left.x.toFixed(1)},${left.y.toFixed(1)} ${right.x.toFixed(1)},${right.y.toFixed(1)}`;
}
function curvePath(p) {
    const dx = p.x2 - p.x1;
    const dy = p.y2 - p.y1;
    const dist = Math.hypot(dx, dy);
    if (dist < 8) return `M ${p.x1.toFixed(1)} ${p.y1.toFixed(1)} L ${p.x2.toFixed(1)} ${p.y2.toFixed(1)}`;
    const pull = Math.max(28, Math.min(dist * 0.42, 200));
    const c1x = p.x1 + p.tx1 * pull;
    const c1y = p.y1 + p.ty1 * pull;
    const c2x = p.x2 + p.tx2 * pull;
    const c2y = p.y2 + p.ty2 * pull;
    return `M ${p.x1.toFixed(1)} ${p.y1.toFixed(1)} C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p.x2.toFixed(1)} ${p.y2.toFixed(1)}`;
}

/**
 * @param {HTMLElement} host empty element owned by the engine
 * @returns {{ update: Function, setActive: Function, suggest: Function, select: Function, destroy: Function }}
 */
export function createSolarEngine(host) {
    let data = { scopeKey: "", canEdit: false, sun: { name: "", summary: "", now: "" }, eras: [], arcs: [], events: [], sessions: [], links: [] };
    let actions = {};
    let eventById = new Map();
    let eraById = new Map();
    let arcById = new Map();
    let neutralById = new Map();
    let st = freshState("");
    let ui = null;
    let bodies = {};
    let links = [];
    let cam = { x: 0, y: 0, w: 1600, h: 900 };
    let busy = false;
    let gen = 0;
    let pointer = null;
    let active = true;
    let destroyed = false;
    const seen = new Set();
    let flying = [];
    let resizeObs = null;
    let pixiApp = null;
    let viewport = null;

    function freshState(scopeKey) {
        return {
            scopeKey, pos: {}, filter: "todo", focus: "", focusSet: new Set(),
            kinds: new Set(LENS_KINDS), q: "", selected: null, selection: new Set(),
            panelOpen: true, form: null, menu: null, wire: null, didIntro: false, enterId: "", saving: false,
            cameFrom: null, typeOpen: false, paintOpen: false, holdDossier: false, dossierMini: false, searchOpen: false,
            folded: new Set(), parPage: {},
        };
    }
    function persistLayout(id) {
        const p = st.pos[id];
        const body = id === "sol" ? bodies.sol : bodies[id];
        if (!p || !actions.saveLayout || body?.readOnly) return;
        const type = id === "sol" ? "sol" : typeOf(body);
        if (!type) return;
        run(() => actions.saveLayout(type, id, p.x, p.y));
    }
    const canEdit = () => !!data.canEdit;
    const eventOf = (id) => eventById.get(id);
    const eraOf = (id) => eraById.get(id);
    const toast = (msg) => actions.toast?.(msg);
    const askConfirm = (msg, run) => {
        Promise.resolve(actions.confirm ? actions.confirm(msg) : window.confirm(msg)).then((ok) => { if (ok) run(); });
    };
    const allEras = () => data.eras.slice().sort((a, b) => (Number(a.start) || 0) - (Number(b.start) || 0) || a.title.localeCompare(b.title, "es"));
    const allArcs = () => data.arcs.slice().sort((a, b) => a.title.localeCompare(b.title, "es"));
    const sessionsFor = (id) => sessionsHungOn(data.sessions, id);

    function searchHit(b) {
        const q = fold((st.q || "").trim());
        if (!q) return true;
        return fold(b.name).includes(q) || fold(b.year || "").includes(q) || fold(String(b.start ?? "")).includes(q);
    }

    /* ── model ── */

    function buildModel() {
        const list = [];
        const sun = data.sun;
            list.push({
                id: "sol", kind: "sun", name: sun.name || "Lore", summary: sun.summary || "", body: "", people: [], places: [], year: sun.now ? `${sun.now} D.Z.` : "",
            color: SUN_C, r: 72, selectR: 80, layoutX: sun.layoutX, layoutY: sun.layoutY,
        });
        for (const er of allEras()) {
            const rg = eraRange(er);
            const year = !rg ? "" : rg.open ? `${rg.y0} D.Z. — abierta` : `${rg.y0}–${rg.y1} D.Z.`;
            list.push({
                id: er.id, kind: "planet", name: er.title, summary: er.summary || "", body: er.body || "",
                people: er.people || [], places: er.places || [], year, color: ERA_C, r: 30, selectR: 44,
                layoutX: er.layoutX, layoutY: er.layoutY,
            });
        }
        for (const ar of allArcs()) {
            const rg = arcRange(ar);
            const year = rg ? (rg.y0 === rg.y1 ? `${rg.y0} D.Z.` : `${rg.y0}–${rg.y1} D.Z.`) : "";
            list.push({
                id: ar.id, kind: "moon", name: ar.title, summary: ar.summary || "", body: ar.body || "",
                people: ar.people || [], places: ar.places || [], year,
                color: ar.color ? readable(ar.color) : ARC_FALLBACK,
                r: 18, selectR: 24, layoutX: ar.layoutX, layoutY: ar.layoutY, readOnly: !!ar.readOnly,
            });
        }
        for (const node of data.neutrals || []) {
            list.push({
                id: node.id, kind: "neutral", name: node.title || "Sin título", summary: node.summary || "", body: node.body || "",
                people: node.people || [], places: node.places || [], year: "",
                color: NEUTRAL_C, r: 14, selectR: 18,
                layoutX: node.layoutX, layoutY: node.layoutY,
            });
        }
        for (const ev of data.events) {
            const when = eventYear(ev, eventOf, eraOf);
            list.push({
                id: ev.id, kind: "asteroid", name: ev.title, summary: ev.summary || "", body: ev.body || "",
                people: ev.people || [], places: ev.places || [], year: when.text,
                color: ROCK, r: 14, selectR: 18,
                layoutX: ev.layoutX, layoutY: ev.layoutY,
            });
        }
        for (const s of data.sessions || []) {
            if (s.layoutX == null || s.layoutY == null) continue;
            list.push({
                id: s.id, kind: "session", name: s.title, summary: "", body: s.body || s.recap || "",
                year: s.inGame ? sessionDayLabel(s) : "Sin fecha",
                color: SESSION_C, r: 18, selectR: 24,
                layoutX: s.layoutX, layoutY: s.layoutY,
            });
        }
        const form = st.form;
        const draftKind = draftBodyKind(form);
        if (draftKind) {
            list.push({
                id: "draft", kind: draftKind, name: form.fields?.title || "Nuevo", summary: "", year: "",
                color: draftKind === "planet" ? ERA_C : draftKind === "moon" ? ARC_FALLBACK : draftKind === "session" ? SESSION_C : ROCK,
                r: draftKind === "planet" ? 20 : draftKind === "moon" ? 11 : draftKind === "session" ? 10 : 5.5,
                selectR: draftKind === "planet" ? 38 : draftKind === "moon" ? 24 : draftKind === "session" ? 24 : 18,
                layoutX: form.x, layoutY: form.y,
            });
        }
        const paintedList = list.map((spec) => {
            const server = data.paints?.[spec.id] || {};
            if (server.color || server.auraColor || server.auraRadius) rememberPaint(spec.id, server);
            const live = paintFlight?.id === spec.id ? paintFlight : null;
            const mem = paintMem.get(spec.id) || {};
            const color = live?.color || server.color || mem.color || spec.color || INK;
            const auraColor = live?.auraColor || server.auraColor || mem.auraColor || color;
            const radius = [live?.auraRadius, server.auraRadius, mem.auraRadius]
                .map(Number)
                .find((n) => Number.isFinite(n) && n >= 16);
            return { ...spec, color, auraColor, auraRadius: radius || AURA_R };
        }).filter((spec) => !swap?.toId || spec.id !== swap.fromId || !list.some((row) => row.id === swap.toId));
        if (swap?.toId && !sourceHas(swap.fromId)) swap = null;
        const by = Object.fromEntries(paintedList.map((b) => [b.id, b]));
        const cables = [];
        for (const link of data.links || []) {
            if (!by[link.fromId] || !by[link.toId]) continue;
            cables.push({ from: link.fromId, to: link.toId, kind: link.kind });
        }
        return { list: paintedList, cables };
    }
    function draftBodyKind(form) {
        if (!form || form.mode !== "create") return "";
        if (form.kind === "era") return "planet";
        if (form.kind === "arco") return "moon";
        if (form.kind === "sesion") return "session";
        if (form.kind === "evento") return "asteroid";
        return "";
    }

    /* ── layout ── */

    function freeSpot(x, y, used) {
        const min = 104;
        const clear = (p) => used.every((u) => Math.hypot(u.x - p.x, u.y - p.y) >= min);
        let p = snap(x, y);
        if (clear(p)) return p;
        for (let n = 1; n < 90; n += 1) {
            const ring = Math.ceil(n / 8);
            const ang = n * 2.399963;
            p = snap(x + Math.cos(ang) * GRID * ring * 2.2, y + Math.sin(ang) * GRID * ring * 2.2);
            if (clear(p)) return p;
        }
        return p;
    }
    function ensurePos(list) {
        const pos = st.pos;
        if (!pos.sol) {
            const sun = list.find((b) => b.id === "sol");
            pos.sol = {
                x: sun?.layoutX ?? SUN_HOME.x,
                y: sun?.layoutY ?? SUN_HOME.y,
                labelAng: Math.PI / 2,
            };
        }
        const used = [{ x: pos.sol.x, y: pos.sol.y }];
        for (const b of list) {
            if (b.id === "sol") {
                b.x = pos.sol.x;
                b.y = pos.sol.y;
                b.labelAng = pos.sol.labelAng;
                continue;
            }
            if (!pos[b.id]) {
                if (b.layoutX != null && b.layoutY != null) {
                    pos[b.id] = { x: b.layoutX, y: b.layoutY, labelAng: Math.PI / 2 };
                } else {
                    const spot = freeSpot(pos.sol.x + 200, pos.sol.y + 80, used);
                    pos[b.id] = { x: spot.x, y: spot.y, labelAng: Math.PI / 2 };
                }
            }
            used.push(pos[b.id]);
            b.x = pos[b.id].x;
            b.y = pos[b.id].y;
            b.labelAng = pos[b.id].labelAng ?? Math.PI / 2;
        }
    }

    /* ── mount ── */

    function mount() {
        host.innerHTML = `<div class="solar">
      <div class="solar-stage">
        <div class="solar-dossier scroll" hidden role="dialog" aria-labelledby="solar-dossier-title"></div>
      </div>
      <aside class="solar-panel">
        <div class="solar-body scroll"></div>
      </aside>
    </div>
    <div class="solar-menu scroll" hidden role="menu"></div>
    <div class="solar-wire" hidden></div>`;
        const root = host.querySelector(".solar");
        const stage = root.querySelector(".solar-stage");
        const svg = svgEl("svg", { role: "img", preserveAspectRatio: "none" });
        svg.setAttribute("aria-label", "Línea de tiempo");
        stage.appendChild(svg);
        const marquee = svgEl("g", { display: "none" }, svg);
        svgEl("rect", { fill: "#ff2bd6", "fill-opacity": "0.1", stroke: "#ff2bd6", "stroke-width": "1.5", "vector-effect": "non-scaling-stroke" }, marquee);
        svgEl("rect", { fill: "none", stroke: "#00f2ea", "stroke-width": "1", "vector-effect": "non-scaling-stroke" }, marquee);
        ui = {
            root, stage, svg,
            blobLayer: svgEl("g", {}, svg),
            linkLayer: svgEl("g", {}, svg),
            bodyLayer: svgEl("g", {}, svg),
            panel: root.querySelector(".solar-panel"),
            body: root.querySelector(".solar-body"),
            dossier: host.querySelector(".solar-dossier"),
            menu: host.querySelector(".solar-menu"),
            wire: host.querySelector(".solar-wire"),
            marquee,
        };
        svg.appendChild(marquee);
        wire();
    }
    function onDocPointerDown(ev) {
        const live = document.activeElement;
        const editing = live && ui?.dossier?.contains(live) && (live.classList?.contains("inline") || !!live.closest?.(".date-edit"));
        const insideEditor = ev.target.closest?.(".date-edit, input.inline, textarea.inline, .rich-edit, .mention-pop");
        if (editing && !insideEditor) {
            st.suppressClick = true;
            live.blur();
            setTimeout(() => { st.suppressClick = false; }, 0);
        }
        let dirty = false;
        if (st.typeOpen && !ev.target.closest?.(".type-face, .type-menu")) {
            st.typeOpen = false;
            dirty = true;
        }
        if (st.paintOpen && !st.paintDrag && !ev.target.closest?.(".paint-pop, .paints, .swatch, .paint")) {
            st.paintOpen = false;
            dirty = true;
        }
        if (dirty && !st.holdDossier) renderDossier();
        if (!st.menu) return;
        if (ev.target.closest?.(".solar-menu")) return;
        closeMenu();
    }
    function wire() {
        ui.panel.addEventListener("click", (ev) => {
            if (ev.target.closest(".fold, .par-nav")) return;
            const node = ev.target.closest("[data-node]");
            if (!node) return;
            ev.stopPropagation();
            if (node.dataset.place) {
                if (!canEdit()) return;
                const sol = st.pos.sol || SUN_HOME;
                beginCreate("sesion", null, { x: sol.x + 180, y: sol.y + 140 }, { sessionId: node.dataset.node });
                return;
            }
            select(node.dataset.node, { keep: true });
            frameIds([node.dataset.node], true);
        });
        ui.panel.addEventListener("input", (ev) => {
            if (!ev.target.classList.contains("solar-q")) return;
            st.q = ev.target.value;
            applyAlphas();
            buildPanel(true);
        });
        ui.root.addEventListener("contextmenu", (ev) => ev.preventDefault());
        ui.dossier.addEventListener("pointerdown", (ev) => ev.stopPropagation());
        ui.dossier.addEventListener("click", (ev) => ev.stopPropagation());
        ui.menu.addEventListener("click", (ev) => {
            const btn = ev.target.closest("button");
            ev.stopPropagation();
            if (!btn || btn.disabled) return;
            runMenu(btn.dataset.act);
        });
        ui.menu.addEventListener("pointerover", (ev) => {
            const btn = ev.target.closest("button");
            if (!btn || btn.disabled || st.menu?.mode !== "link" || !st.wire?.toId) return;
            const kind = btn.dataset.act;
            if (!["sigue", "paralelo", "agrupa"].includes(kind) || kind === st.wire.kind) return;
            st.wire.kind = kind;
            ui.menu.querySelectorAll("button").forEach((node) => node.classList.toggle("on", node.dataset.act === kind));
            paintWire();
        });
        document.addEventListener("keydown", onKey, true);
        document.addEventListener("pointerdown", onDocPointerDown, true);
        resizeObs = new ResizeObserver(() => { if (ui && ui.stage.clientWidth > 0) fitRatio(); });
        resizeObs.observe(ui.stage);
        mountViewport();
    }
    function zoomClamp() {
        const sw = Math.max(1, viewport?.screenWidth || ui?.stage?.clientWidth || 1);
        return { minScale: sw / 6400, maxScale: sw / 280 };
    }
    function applyZoomClamp() {
        const plug = viewport?.plugins?.get?.("clamp-zoom");
        if (!plug) return;
        const z = zoomClamp();
        plug.options.minScale = z.minScale;
        plug.options.maxScale = z.maxScale;
    }
    async function mountViewport() {
        const stage = ui?.stage;
        if (!stage || pixiApp || destroyed) return;
        const app = new PIXI.Application();
        await app.init({
            resizeTo: stage,
            backgroundAlpha: 0,
            antialias: true,
            autoDensity: true,
            resolution: Math.min(window.devicePixelRatio || 1, 2),
        });
        if (destroyed || !ui) {
            app.destroy(true);
            return;
        }
        app.canvas.className = "solar-camera";
        app.canvas.style.touchAction = "none";
        app.canvas.addEventListener("contextmenu", (event) => event.preventDefault(), true);
        stage.appendChild(app.canvas);
        if (!("events" in app.renderer)) app.renderer.addSystem(PIXI.EventSystem, "events");
        const z = zoomClamp();
        const vp = new Viewport({
            screenWidth: app.screen.width,
            screenHeight: app.screen.height,
            worldWidth: 12000,
            worldHeight: 12000,
            ticker: app.ticker,
            events: app.renderer.events,
        });
        vp.drag({ mouseButtons: "right", pressDrag: true })
            .pinch()
            .wheel({ smooth: 4, percent: 0.12 })
            .decelerate({ friction: 0.9 })
            .clampZoom(z);
        vp.eventMode = "static";
        vp.cursor = "grab";
        const hit = new PIXI.Container();
        hit.eventMode = "static";
        hit.hitArea = new PIXI.Rectangle(-20000, -20000, 40000, 40000);
        hit.on("pointerdown", onHitDown);
        vp.addChild(hit);
        vp.on("moved", syncFromViewport);
        vp.on("zoomed", syncFromViewport);
        vp.on("pointerdown", onPanDown);
        vp.on("pointerup", onStageUp);
        vp.on("pointerupoutside", onStageUp);
        app.stage.addChild(vp);
        pixiApp = app;
        const ratio = stage.clientHeight / Math.max(1, stage.clientWidth);
        if (ratio) {
            const cx = cam.x + cam.w / 2;
            const cy = cam.y + cam.h / 2;
            cam.h = cam.w * ratio;
            cam.x = cx - cam.w / 2;
            cam.y = cy - cam.h / 2;
        }
        viewport = vp;
        fitRatio();
        writeViewport(cam, false);
    }

    /* ── drawing ── */

    function clearNode(node) { while (node.firstChild) node.removeChild(node.firstChild); }
    function rebuild() {
        gen += 1;
        const model = buildModel();
        ensurePos(model.list);
        bodies = {};
        links = [];
        clearNode(ui.blobLayer);
        clearNode(ui.linkLayer);
        clearNode(ui.bodyLayer);
        const defs = svgEl("defs", {}, ui.blobLayer);
        ui.auraDefs = defs;
        const filter = svgEl("filter", { id: "solar-blur", x: "-80%", y: "-80%", width: "260%", height: "260%" }, defs);
        svgEl("feGaussianBlur", { stdDeviation: "22" }, filter);
        for (const spec of model.list) {
            bodies[spec.id] = spec;
            buildBody(spec);
        }
        const tagged = new Set();
        for (const spec of model.cables) {
            if (spec.unsituated && !tagged.has(spec.to)) { spec.tag = true; tagged.add(spec.to); }
            makeLink(spec);
        }
        syncBlobs();
        buildPanel(false);
        syncBar();
        syncFold();
        if (st.wire) { clearWirePath(); paintWire(); }
        noteDrawn();
    }
    function noteDrawn() {
        linkSig = links.map((link) => `${link.from}|${link.kind}|${link.to}`).sort().join(";");
        panelSig = `${Object.values(bodies).map((b) => `${b.id}|${b.kind}|${b.name}|${b.year || ""}`).sort().join(";")}#${linkSig}`;
    }
    function dropBody(id) {
        const b = bodies[id];
        if (!b) return;
        b.g?.remove();
        b.aura?.remove();
        const gid = `a_${String(id).replace(/[^a-zA-Z0-9_-]/g, "_")}`;
        ui.auraDefs?.querySelector(`#${gid}`)?.remove();
        delete bodies[id];
    }
    function faceKey(b) {
        return `${b.kind}|${b.name}|${b.year || ""}`;
    }
    function updateBody(b, spec) {
        if (pointer?.mode !== "drag") {
            b.x = spec.x;
            b.y = spec.y;
            b.labelAng = spec.labelAng;
            b.g.setAttribute("transform", `translate(${b.x} ${b.y})`);
        }
        const prev = b.color;
        b.summary = spec.summary;
        b.body = spec.body || "";
        b.people = spec.people || [];
        b.places = spec.places || [];
        b.readOnly = spec.readOnly;
        b.color = spec.color;
        b.auraColor = spec.auraColor;
        b.auraRadius = spec.auraRadius;
        if (prev && spec.color && prev.toLowerCase() !== spec.color.toLowerCase()) tintNode(b.scaler, prev, spec.color);
        if (b.aura) {
            b.aura.setAttribute("r", b.auraRadius || AURA_R);
            const ink = b.auraColor || b.color || INK;
            (b.auraStops || []).forEach((stop) => stop.setAttribute("stop-color", ink));
        }
    }
    function paintPanelColors() {
        ui.body.querySelectorAll("[data-node]").forEach((node) => {
            const b = bodies[node.dataset.node];
            if (!b) return;
            const prev = node.dataset.ink;
            if (prev === b.color) return;
            node.style.setProperty("--c", b.color);
            if (prev) {
                node.querySelectorAll(".glyph").forEach((glyph) => {
                    if (glyph.closest("[data-node]") !== node) return;
                    tintNode(glyph, prev, b.color);
                });
            }
            node.dataset.ink = b.color;
        });
    }
    function reconcile() {
        const model = buildModel();
        ensurePos(model.list);
        const next = new Set(model.list.map((spec) => spec.id));
        Object.keys(bodies).forEach((id) => { if (!next.has(id)) dropBody(id); });
        model.list.forEach((spec) => {
            const prev = bodies[spec.id];
            if (!prev || faceKey(prev) !== faceKey(spec)) {
                const x = pointer?.mode === "drag" && prev ? prev.x : spec.x;
                const y = pointer?.mode === "drag" && prev ? prev.y : spec.y;
                if (prev) dropBody(spec.id);
                spec.x = x;
                spec.y = y;
                bodies[spec.id] = spec;
                buildBody(spec);
                spec.scaler.setAttribute("transform", "scale(1)");
                return;
            }
            updateBody(prev, spec);
        });
        const cablesKey = model.cables.map((cable) => `${cable.from}|${cable.kind}|${cable.to}`).sort().join(";");
        if (cablesKey !== linkSig) {
            linkSig = cablesKey;
            links = [];
            clearNode(ui.linkLayer);
            const tagged = new Set();
            model.cables.forEach((spec) => {
                if (spec.unsituated && !tagged.has(spec.to)) { spec.tag = true; tagged.add(spec.to); }
                makeLink(spec);
            });
            links.forEach((link) => {
                link.done = true;
                setPattern(link);
                link.travelers.setAttribute("opacity", "1");
            });
            if (st.wire) { clearWirePath(); paintWire(); }
        } else if (pointer?.mode !== "drag") links.forEach(updateLink);
        syncBlobs();
        const structure = `${model.list.map((b) => `${b.id}|${b.kind}|${b.name}|${b.year || ""}`).sort().join(";")}#${cablesKey}`;
        if (structure !== panelSig) {
            panelSig = structure;
            buildPanel(false);
            syncBar();
        } else paintPanelColors();
    }
    function layoutLabel(b) {
        if (!b.labelLines?.length) return;
        const ang = b.labelAng ?? Math.PI / 2;
        const r = b.kind === "sun" ? 86 : b.r;
        const gap = 12;
        const sizes = b.labelLines.map((line) => Number(line.getAttribute("font-size")));
        const ox = Math.cos(ang) * (r + gap);
        const oy = Math.sin(ang) * (r + gap);
        const anchor = Math.cos(ang) > 0.4 ? "start" : Math.cos(ang) < -0.4 ? "end" : "middle";
        const block = sizes.reduce((sum, size) => sum + size + 3, 0);
        const down = Math.sin(ang) >= -0.15;
        const y0 = down ? oy : oy - block + sizes[0];
        b.label.setAttribute("text-anchor", anchor);
        b.labelLines.forEach((line, i) => {
            const y = y0 + sizes.slice(0, i).reduce((sum, size) => sum + size + 3, 0);
            line.setAttribute("x", ox.toFixed(1));
            line.setAttribute("y", y.toFixed(1));
        });
    }
    function addLine(text, value, fill, size, family) {
        const line = svgEl("tspan", { fill, "font-size": size, "font-family": family }, text);
        line.textContent = value;
        return line;
    }
    function buildBody(b) {
        const g = svgEl("g", { transform: `translate(${b.x} ${b.y})` }, ui.bodyLayer);
        g.dataset.id = b.id;
        const scaler = svgEl("g", {}, g);
        scaler.setAttribute("transform", "scale(0)");
        if (b.kind === "sun") {
            drawSunGraphic(scaler);
            if (String(b.color).toLowerCase() !== SUN_C) tintNode(scaler, SUN_C, b.color);
        } else if (b.kind === "planet") drawEraGraphic(scaler, b.color);
        else if (b.kind === "moon") drawArcGraphic(scaler, b.color);
        else if (b.kind === "session") drawSessionGraphic(scaler, b.color);
        else if (b.kind === "neutral") drawNeutralGraphic(scaler, b.color);
        else drawEventGraphic(scaler, b.color);
        const text = svgEl("text", { "font-family": "Fira Sans, sans-serif" }, scaler);
        const small = b.kind === "asteroid" || b.kind === "child";
        const lines = [addLine(text, b.name, "#ffffff", small ? 11 : 14, "Fira Sans, sans-serif")];
        if (b.year) lines.push(addLine(text, b.year, "#aaaaaa", small ? 11 : 12, "Fira Code, monospace"));
        else if (b.kind !== "sun") lines.push(addLine(text, "Sin fecha", "#aaaaaa", small ? 11 : 12, "Fira Code, monospace"));
        b.label = text;
        b.labelLines = lines;
        layoutLabel(b);
        const ring = b.kind === "planet"
            ? svgEl("rect", {
                x: -36, y: -24, width: 72, height: 48, rx: 3,
                fill: "none", stroke: "#ffffff", "stroke-width": 1,
                "vector-effect": "non-scaling-stroke", display: "none",
            }, g)
            : svgEl("circle", {
                r: b.selectR, fill: "none", stroke: "#ffffff", "stroke-width": 1,
                "vector-effect": "non-scaling-stroke", display: "none",
            }, g);
        b.g = g;
        b.scaler = scaler;
        b.ring = ring;
        b.flash = scaler.querySelector(".flash");
        const gid = `a_${String(b.id).replace(/[^a-zA-Z0-9_-]/g, "_")}`;
        const grad = svgEl("radialGradient", { id: gid, cx: "50%", cy: "50%", r: "50%" }, ui.auraDefs);
        const fade = [0.32, 0.14, 0.05, 0];
        b.auraStops = [0, 0.32, 0.66, 1].map((offset, i) => svgEl("stop", {
            offset: String(offset),
            "stop-color": b.auraColor || b.color || INK,
            "stop-opacity": fade[i],
        }, grad));
        b.aura = svgEl("circle", {
            r: b.auraRadius || AURA_R,
            fill: `url(#${gid})`,
            filter: "url(#solar-blur)",
        }, ui.blobLayer);
    }
    function tintNode(node, from, to) {
        if (!node || !from || !to || from.toLowerCase() === to.toLowerCase()) return;
        node.querySelectorAll("*").forEach((el) => {
            ["stroke", "fill"].forEach((attr) => {
                const value = el.getAttribute(attr);
                if (value && value.toLowerCase() === from.toLowerCase()) el.setAttribute(attr, to);
            });
        });
    }
    function styleOf(spec) {
        if (spec.kind === "sigue") return { color: SUN_C, width: 1.45, dash: null, opacity: 0.95 };
        if (spec.kind === "paralelo") return { color: "#00f2ea", width: 1.2, dash: null, opacity: 0.92 };
        if (spec.kind === "agrupa") return { color: "#8a8f9c", width: 1, dash: null, opacity: 0.4 };
        return { color: WIRE_C, width: 1.4, dash: "5 4", opacity: 1 };
    }
    function makeLink(spec) {
        const a = bodies[spec.from];
        const b = bodies[spec.to];
        if (!a || !b) return null;
        const g = svgEl("g", {}, ui.linkLayer);
        const sty = styleOf(spec);
        const ends = linkPorts(a, b);
        const rails = spec.kind === "paralelo"
            ? twinPorts(ends, 2.6).map((ports) => drawHudPath(g, curvePath(ports), sty))
            : [drawHudPath(g, curvePath(ends), sty)];
        const drawn = rails[0];
        const flow = spec.kind === "paralelo" || spec.kind === "agrupa"
            ? { g: svgEl("g", { opacity: "0" }, g), motions: [] }
            : flowParticles(g, curvePath(ends), sty.color, 3, 3.2);
        flow.g.setAttribute("opacity", "0");
        const head = spec.kind === "sigue"
            ? svgEl("polygon", { points: arrowPoints(-ends.tx2, -ends.ty2, ends.x2, ends.y2), fill: sty.color }, g)
            : null;
        let jumpText = null;
        let tagText = null;
        if (spec.jump) {
            jumpText = svgEl("text", {
                fill: "#ff3355", "font-family": "Fira Code, monospace", "font-size": 13,
                "letter-spacing": "0.14em", "text-anchor": "middle",
            }, g);
            jumpText.textContent = spec.jump;
        }
        if (spec.tag) {
            tagText = svgEl("text", { fill: "#aaaaaa", "font-family": "Fira Sans, sans-serif", "font-size": 11, "text-anchor": "middle" }, g);
            tagText.textContent = "Sin situar";
        }
        const link = { ...spec, g, rails, path: drawn.path, glow: drawn.glow, travelers: flow.g, motions: flow.motions, head, jumpText, tagText, dash: sty.dash, done: false };
        placeAnnotations(link);
        links.push(link);
        return link;
    }
    function anchorOnPath(pathEl, t) {
        const len = pathEl.getTotalLength() || 1;
        const pt = pathEl.getPointAtLength(Math.max(0, Math.min(len, len * t)));
        const prev = pathEl.getPointAtLength(Math.max(0, len * t - 8));
        const tx = pt.x - prev.x;
        const ty = pt.y - prev.y;
        const mag = Math.hypot(tx, ty) || 1;
        let nx = -ty / mag;
        let ny = tx / mag;
        if (ny > 0) { nx = -nx; ny = -ny; }
        return { x: pt.x + nx * 16, y: pt.y + ny * 16 };
    }
    function placeAnnotations(link) {
        if (link.jumpText) {
            const p = anchorOnPath(link.path, 0.5);
            link.jumpText.setAttribute("x", p.x.toFixed(1));
            link.jumpText.setAttribute("y", p.y.toFixed(1));
        }
        if (link.tagText) {
            const p = anchorOnPath(link.path, 0.62);
            link.tagText.setAttribute("x", p.x.toFixed(1));
            link.tagText.setAttribute("y", p.y.toFixed(1));
        }
    }
    function updateLink(link) {
        const a = bodies[link.from];
        const b = bodies[link.to];
        if (!a || !b) return;
        const ends = linkPorts(a, b);
        const paths = link.kind === "paralelo" ? twinPorts(ends, 2.6).map(curvePath) : [curvePath(ends)];
        (link.rails || []).forEach((rail, i) => {
            const d = paths[Math.min(i, paths.length - 1)];
            rail.path.setAttribute("d", d);
            rail.glow.setAttribute("d", d);
        });
        link.motions.forEach((motion) => motion.setAttribute("path", paths[0]));
        if (link.head) link.head.setAttribute("points", arrowPoints(-ends.tx2, -ends.ty2, ends.x2, ends.y2));
        placeAnnotations(link);
    }
    function syncBodies() {
        Object.values(bodies).forEach((b) => b.g.setAttribute("transform", `translate(${b.x} ${b.y})`));
        syncBlobs();
    }
    function syncBlobs() {
        Object.values(bodies).forEach((b) => {
            if (!b.aura) return;
            b.aura.setAttribute("cx", b.x);
            b.aura.setAttribute("cy", b.y);
            b.aura.setAttribute("r", b.auraRadius || AURA_R);
            const ink = b.auraColor || b.color || INK;
            (b.auraStops || []).forEach((stop) => stop.setAttribute("stop-color", ink));
            const alpha = bodyAlpha(b.id);
            b.aura.setAttribute("opacity", String(alpha));
        });
    }
    function updateAll() {
        syncBodies();
        links.forEach(updateLink);
        applyAlphas();
    }
    function chosenHas(id) {
        return !!st.selection?.has(id);
    }
    function kindOn(b) {
        if (!b || b.kind === "sun" || b.kind === "draft") return true;
        if (st.focus && b.id === st.focus) return true;
        return !st.kinds || st.kinds.has(b.kind);
    }
    function focusOn(id) {
        if (!st.focus || id === "draft") return true;
        return st.focusSet.has(id);
    }
    function neighborIds() {
        if (st.selection?.size !== 1) return new Set();
        const id = [...st.selection][0];
        const set = new Set();
        links.forEach((link) => {
            if (link.from === id) set.add(link.to);
            else if (link.to === id) set.add(link.from);
        });
        return set;
    }
    function bodyAlpha(id) {
        const b = bodies[id];
        if (!b) return 0.12;
        if (b.kind === "draft") return 1;
        if (!searchHit(b)) return 0.12;
        if (!kindOn(b) || !focusOn(id)) return 0.1;
        if (chosenHas(id)) return 1;
        if (st.selection?.size === 1 && neighborIds().has(id)) return 1;
        if (st.selection?.size) return 0.16;
        return 1;
    }
    function linkAlpha(link) {
        const touch = st.selection?.size === 1 && (chosenHas(link.from) || chosenHas(link.to));
        if (touch) return Math.min(bodyAlpha(link.from), bodyAlpha(link.to)) < 0.5 ? 0.12 : 1;
        return Math.min(bodyAlpha(link.from), bodyAlpha(link.to));
    }
    function applyAlphas() {
        Object.values(bodies).forEach((b) => {
            if (!b.g) return;
            b.g.setAttribute("opacity", String(bodyAlpha(b.id)));
            b.ring.setAttribute("display", chosenHas(b.id) ? "inline" : "none");
        });
        links.forEach((link) => link.g.setAttribute("opacity", String(linkAlpha(link))));
        syncBlobs();
        const near = neighborIds();
        ui.panel.querySelectorAll("[data-node]").forEach((node) => {
            const on = chosenHas(node.dataset.node);
            node.classList.toggle("is-on", on);
            node.classList.toggle("is-near", !on && near.has(node.dataset.node));
            if (on) node.setAttribute("aria-current", "true");
            else node.removeAttribute("aria-current");
        });
    }
    function focusIds(rootId) {
        const set = new Set([rootId]);
        let grew = true;
        while (grew) {
            grew = false;
            links.forEach((link) => {
                const walk = link.kind === "agrupa";
                if (walk && set.has(link.from) && !set.has(link.to)) { set.add(link.to); grew = true; }
            });
        }
        return set;
    }

    /* ── camera ── */

    function world(e) {
        const pt = ui.svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const ctm = ui.svg.getScreenCTM();
        if (!ctm) return { x: 0, y: 0 };
        return pt.matrixTransform(ctm.inverse());
    }
    function hitBody(wx, wy) {
        let best = null;
        let bestR = Infinity;
        Object.values(bodies).forEach((b) => {
            if (!kindOn(b) || !focusOn(b.id)) return;
            const hit = b.selectR + 8;
            const dx = wx - b.x;
            const dy = wy - b.y;
            if (dx * dx + dy * dy <= hit * hit && hit < bestR) { best = b; bestR = hit; }
        });
        return best;
    }
    function applyCam() { ui.svg.setAttribute("viewBox", `${cam.x} ${cam.y} ${cam.w} ${cam.h}`); }
    function syncFromViewport() {
        if (!viewport || !ui) return;
        const scale = viewport.scale.x || 1;
        const sw = viewport.screenWidth || ui.stage.clientWidth || 0;
        const sh = viewport.screenHeight || ui.stage.clientHeight || 0;
        if (sw < 2 || sh < 2) return;
        cam.x = -viewport.x / scale;
        cam.y = -viewport.y / scale;
        cam.w = sw / scale;
        cam.h = sh / scale;
        applyCam();
    }
    function writeViewport(next, animate) {
        cam = { x: next.x, y: next.y, w: next.w, h: next.h };
        if (!viewport) { applyCam(); return; }
        const sw = Math.max(1, viewport.screenWidth || ui.stage.clientWidth);
        const scale = sw / Math.max(1, next.w);
        const x = -next.x * scale;
        const y = -next.y * scale;
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
        viewport.position.set(x, y);
        syncFromViewport();
    }
    function moveCam(next, animate) {
        writeViewport(next, animate);
    }
    function frameIds(ids, animate) {
        const list = ids.map((id) => bodies[id]).filter(Boolean);
        if (!list.length) return;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        list.forEach((b) => {
            const pad = b.kind === "sun" ? 140 : b.r + 78;
            minX = Math.min(minX, b.x - pad);
            maxX = Math.max(maxX, b.x + pad + 90);
            minY = Math.min(minY, b.y - pad);
            maxY = Math.max(maxY, b.y + pad + 40);
        });
        const bw = Math.max(420, maxX - minX);
        const bh = Math.max(280, maxY - minY);
        const stageW = ui.stage.clientWidth || 1;
        const stageR = stageW ? ui.stage.clientHeight / stageW : 0.62;
        const panelW = ui.panel && getComputedStyle(ui.panel).display !== "none"
            ? ui.panel.getBoundingClientRect().width
            : 0;
        const cover = Math.min(0.46, Math.max(0, panelW / stageW));
        const visible = Math.max(0.54, 1 - cover);
        let vw = bw / visible;
        let vh = vw * stageR;
        if (vh < bh) { vh = bh; vw = vh / Math.max(0.2, stageR); }
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const shift = (cover * vw) / 2;
        moveCam({ x: cx - vw / 2 + shift, y: cy - vh / 2, w: vw, h: vh }, animate);
    }
    function fitRatio() {
        if (viewport && pixiApp && ui?.stage) {
            const w = ui.stage.clientWidth;
            const h = ui.stage.clientHeight;
            if (w < 2 || h < 2) return;
            pixiApp.renderer?.resize?.(w, h);
            if (pixiApp.canvas) {
                pixiApp.canvas.style.width = "100%";
                pixiApp.canvas.style.height = "100%";
            }
            viewport.resize(w, h);
            applyZoomClamp();
            syncFromViewport();
            return;
        }
        const ratio = ui.stage.clientHeight / Math.max(1, ui.stage.clientWidth);
        if (!ratio) return;
        const cx = cam.x + cam.w / 2;
        const cy = cam.y + cam.h / 2;
        cam.h = cam.w * ratio;
        cam.x = cx - cam.w / 2;
        cam.y = cy - cam.h / 2;
        applyCam();
    }

    /* ── panel (graph list) ── */

    function roleOf(b) {
        if (!b) return "";
        if (b.kind === "sun") return "Sol";
        if (b.kind === "planet") return "Era";
        if (b.kind === "moon") return b.readOnly ? "Arco · catálogo" : "Arco";
        if (b.kind === "session") return "Sesión";
        if (b.kind === "neutral") return "Neutro";
        return "Acontecimiento";
    }
    function yearMark(b) {
        const found = String(b.year || "").match(/\d{3,4}/);
        return found ? found[0] : "s/f";
    }
    function nodeVisible(node) {
        const b = bodies[node.id];
        if (!b) return false;
        if (!focusOn(node.id)) return false;
        if (!fold((st.q || "").trim())) return true;
        if (searchHit(b)) return true;
        return (node.steps || []).some((step) => step.some((kid) => nodeVisible(kid)));
    }
    function appendSessions(parent, id) {
        for (const s of sessionsFor(id)) {
            const block = el("div", "session");
            block.appendChild(el("p", "when", `${s.title} · mesa ${fmtMesa(s.date)}`));
            block.appendChild(el("p", "rg", sessionDayLabel(s)));
            if (s.recap) block.appendChild(el("p", "recap", plainRecap(s.recap)));
            parent.appendChild(block);
        }
    }
    function branchOpen(id) {
        if (fold((st.q || "").trim())) return true;
        return !st.folded?.has(id);
    }
    function foldButton(node) {
        const has = (node.steps || []).some((step) => step.length);
        if (!has) return null;
        const open = branchOpen(node.id);
        const btn = button("fold", open ? "▾" : "▸", (ev) => {
            ev.stopPropagation();
            if (st.folded.has(node.id)) st.folded.delete(node.id);
            else st.folded.add(node.id);
            buildPanel(false);
        });
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        btn.setAttribute("aria-label", open ? "Replegar hijas" : "Desplegar hijas");
        return btn;
    }
    function twinRail() {
        const rail = el("div", "twin");
        rail.setAttribute("aria-hidden", "true");
        rail.append(el("span"), el("span"));
        return rail;
    }
    function renderTwig(node) {
        if (!node.steps?.length || !branchOpen(node.id)) return null;
        const b = bodies[node.id];
        const twig = el("div", "twig");
        if (b) twig.style.setProperty("--c", b.color);
        node.steps.forEach((step) => {
            const visible = step.filter((kid) => nodeVisible(kid));
            if (visible.length > 1) {
                const block = renderParallel(visible);
                if (block) twig.appendChild(block);
            } else if (visible.length === 1) {
                const n = renderLeaf(visible[0]);
                if (n) twig.appendChild(n);
            }
        });
        return twig.childElementCount ? twig : null;
    }
    function renderLeaf(node) {
        if (!nodeVisible(node)) return null;
        const b = bodies[node.id];
        const row = el("div", "leaf");
        row.classList.toggle("is-off", !kindOn(b));
        row.dataset.node = node.id;
        row.dataset.ink = b.color;
        row.style.setProperty("--c", b.color);
        const top = el("div", "leaf-top");
        top.appendChild(glyphSvg(b));
        const fold = foldButton(node);
        if (fold) top.appendChild(fold);
        row.appendChild(top);
        row.appendChild(el("p", "nm", b.name));
        row.appendChild(el("p", "rg", b.year || "Sin fecha"));
        const twig = renderTwig(node);
        if (twig) row.appendChild(twig);
        return row;
    }
    function renderCard(node) {
        if (!nodeVisible(node)) return null;
        const b = bodies[node.id];
        const card = el("article", "par-card");
        card.classList.toggle("is-off", !kindOn(b));
        card.dataset.node = node.id;
        card.dataset.ink = b.color;
        card.style.setProperty("--c", b.color);
        const top = el("div", "par-top");
        top.appendChild(glyphSvg(b));
        const fold = foldButton(node);
        if (fold) top.appendChild(fold);
        card.append(top, el("p", "nm", b.name), el("p", "rg", b.year || "Sin fecha"));
        const twig = renderTwig(node);
        if (twig) card.appendChild(twig);
        if (b.kind === "asteroid") appendSessions(card, b.id);
        return card;
    }
    function renderParallel(nodes) {
        const key = nodes.map((node) => node.id).join("|");
        const max = Math.max(0, Math.ceil(nodes.length / 2) * 2 - 2);
        let page = st.parPage[key] || 0;
        if (page > max) page = max;
        if (page < 0) page = 0;
        page -= page % 2;
        const slice = nodes.slice(page, page + Math.min(2, nodes.length));
        const block = el("div", "par-block");
        const pair = el("div", slice.length > 1 ? "par-pair" : "par-pair is-one");
        slice.forEach((node, index) => {
            if (index) pair.appendChild(twinRail());
            const card = renderCard(node);
            if (card) pair.appendChild(card);
        });
        if (nodes.length > 2) {
            const nav = (dir) => {
                const btn = button("par-nav", null, (ev) => {
                    ev.stopPropagation();
                    st.parPage[key] = dir < 0 ? Math.max(0, page - 2) : Math.min(max, page + 2);
                    buildPanel(false);
                });
                const svg = svgEl("svg", { viewBox: "0 0 28 22", class: "par-ico", "aria-hidden": "true" });
                const lines = dir < 0 ? "M14 6h10M14 12h10" : "M4 6h10M4 12h10";
                const arrow = dir < 0 ? "M10 3L4 9l6 6" : "M18 3l6 6-6 6";
                svgEl("path", { d: lines, fill: "none", stroke: "#00f2ea", "stroke-width": "1.7", "stroke-linecap": "round" }, svg);
                svgEl("path", { d: arrow, fill: "none", stroke: "#00f2ea", "stroke-width": "1.7", "stroke-linecap": "round", "stroke-linejoin": "round" }, svg);
                btn.appendChild(svg);
                btn.setAttribute("aria-label", dir < 0 ? "Paralelos anteriores" : "Paralelos siguientes");
                btn.disabled = dir < 0 ? page <= 0 : page >= max;
                return btn;
            };
            block.append(nav(-1), pair, nav(1));
        } else {
            block.classList.add("is-pair");
            block.appendChild(pair);
        }
        return pair.childElementCount ? block : null;
    }
    function renderStop(node, index) {
        if (!nodeVisible(node)) return null;
        const b = bodies[node.id];
        const textRight = index % 2 === 1;
        const row = el("div", "stop");
        row.classList.toggle("is-off", !kindOn(b));
        row.dataset.node = node.id;
        row.dataset.ink = b.color;
        row.style.setProperty("--c", b.color);
        const mark = el("p", `mark ${textRight ? "left" : "right"}`, yearMark(b));
        mark.dataset.node = node.id;
        const hub = el("div", "hub");
        const hubNode = button("node", null);
        hubNode.dataset.node = node.id;
        hubNode.dataset.ink = b.color;
        hubNode.style.setProperty("--c", b.color);
        hubNode.setAttribute("aria-label", b.name);
        hubNode.appendChild(glyphSvg(b));
        hub.appendChild(hubNode);
        const copy = el("div", `copy ${textRight ? "to-right" : "to-left"}`);
        const head = el("div", "head");
        head.dataset.node = node.id;
        const kicker = el("div", "kicker-row");
        const fold = foldButton(node);
        if (fold) kicker.appendChild(fold);
        kicker.appendChild(el("p", "kicker", roleOf(b)));
        head.appendChild(kicker);
        head.appendChild(el("p", b.kind === "sun" || b.kind === "planet" ? "nm era" : "nm", b.name));
        head.appendChild(el("p", "rg", b.year || "Sin fecha"));
        copy.appendChild(head);
        const twig = renderTwig(node);
        if (twig) copy.appendChild(twig);
        if (b.kind === "asteroid") appendSessions(copy, b.id);
        if (textRight) row.append(mark, hub, copy);
        else row.append(copy, hub, mark);
        return row;
    }
    function takeSun(forest) {
        let sun = null;
        const rest = [];
        forest.forEach((step) => {
            const kept = [];
            step.forEach((node) => {
                if (node.id === "sol") sun = node;
                else kept.push(node);
            });
            if (kept.length) rest.push(kept);
        });
        return { sun: sun || { id: "sol", steps: [] }, rest };
    }
    function visibleRoots(nodes) {
        const out = [];
        nodes.forEach((node) => {
            if (nodeVisible(node)) out.push(node);
            else (node.steps || []).forEach((step) => out.push(...visibleRoots(step)));
        });
        return out;
    }
    function buildPanel(refocus) {
        const panel = ui.body;
        const q = st.q || "";
        panel.replaceChildren();
        const graph = el("div", "solar-graph");
        const querying = !!fold(q.trim());
        const ids = Object.values(bodies).filter((b) => b.id !== "draft").map((b) => b.id);
        const names = Object.fromEntries(Object.values(bodies).map((b) => [b.id, b.name]));
        const forest = panelForest(ids, data.links || [], names);
        const sunNode = takeSun(forest);
        const chrono = el("div", "chrono");
        chrono.appendChild(el("div", "rail"));
        let n = 0;
        let any = false;
        const sun = renderStop(sunNode.sun, n);
        if (sun) { chrono.appendChild(sun); n += 1; any = true; }
        sunNode.rest.forEach((step) => {
            const visible = visibleRoots(step);
            if (!visible.length) return;
            if (visible.length > 1) {
                const block = renderParallel(visible);
                if (block) { chrono.appendChild(block); any = true; }
                return;
            }
            const row = renderStop(visible[0], n);
            if (row) { chrono.appendChild(row); n += 1; any = true; }
        });
        graph.appendChild(chrono);
        const loose = (data.sessions || []).filter((s) => s.layoutX == null || s.layoutY == null);
        if (loose.length && actions.placeSession) {
            graph.appendChild(el("p", "bucket", "Sesiones sin colocar"));
            const shown = loose.filter((s) => !querying || fold(s.title).includes(fold(q.trim())));
            if (shown.length) {
                shown.forEach((s) => {
                    const row = el("div", "leaf");
                    row.dataset.node = s.id;
                    row.dataset.place = "1";
                    row.style.setProperty("--c", SESSION_C);
                    row.appendChild(glyphSvg({ kind: "session", color: INK }));
                    row.appendChild(el("p", "nm", s.title));
                    row.appendChild(el("p", "rg", "Sin colocar"));
                    graph.appendChild(row);
                });
            } else graph.appendChild(el("p", "empty-mini", "Nada."));
        }
        if (querying && !any) graph.appendChild(el("p", "empty-mini", "Sin coincidencias."));
        panel.appendChild(graph);
        if (refocus) {
            const i = panel.querySelector(".solar-q");
            if (i) { i.focus(); const len = i.value.length; i.setSelectionRange(len, len); }
        }
    }
    function publishChrome() {
        actions.onChrome?.({
            filter: st.filter || "todo",
            focus: st.focus || "",
            kinds: Object.fromEntries(LENS_KINDS.map((kind) => [kind, !st.kinds || st.kinds.has(kind)])),
            panelOpen: st.panelOpen !== false,
            searchOpen: !!st.searchOpen,
            q: st.q || "",
            eras: allEras().map((er) => ({ id: er.id, title: er.title })),
            arcs: allArcs().map((ar) => ({ id: ar.id, title: ar.title })),
        });
    }
    function syncBar() { publishChrome(); }
    function syncFold() {
        const open = st.panelOpen !== false;
        ui.root.classList.toggle("is-shut", !open);
        publishChrome();
    }
    function setQuery(value) {
        st.q = value || "";
        st.searchOpen = true;
        applyAlphas();
        buildPanel(false);
        publishChrome();
    }
    function toggleSearch() {
        st.searchOpen = !st.searchOpen;
        if (!st.searchOpen && st.q) {
            st.q = "";
            applyAlphas();
            buildPanel(false);
        }
        publishChrome();
    }
    function togglePanel() {
        st.panelOpen = !st.panelOpen;
        syncFold();
    }
    function focusEra(id) {
        if (!id) {
            st.focus = "";
            st.focusSet = new Set();
            st.filter = "todo";
            publishChrome();
            applyAlphas();
            buildPanel(false);
            return;
        }
        st.filter = "focus";
        st.focus = id;
        st.focusSet = focusIds(id);
        publishChrome();
        select(id, { keep: true });
        frameIds([...st.focusSet], true);
        applyAlphas();
        buildPanel(false);
    }
    function toggleKind(kind) {
        if (!LENS_KINDS.includes(kind)) return;
        if (!st.kinds) st.kinds = new Set(LENS_KINDS);
        if (st.kinds.has(kind)) st.kinds.delete(kind);
        else st.kinds.add(kind);
        st.filter = st.kinds.size === LENS_KINDS.length ? "todo" : "kinds";
        publishChrome();
        applyAlphas();
        buildPanel(false);
    }
    function setFilter(filter) {
        st.focus = "";
        st.focusSet = new Set();
        if (filter === "eras") st.kinds = new Set(["planet"]);
        else if (filter === "rocks") st.kinds = new Set(["planet", "moon", "neutral", "session"]);
        else st.kinds = new Set(LENS_KINDS);
        st.filter = filter || "todo";
        publishChrome();
        applyAlphas();
        buildPanel(false);
    }
    function neighbors(id) {
        const parents = [];
        const children = [];
        links.forEach((link) => {
            if (link.to === id && bodies[link.from]) parents.push(link.from);
            if (link.from === id && bodies[link.to]) children.push(link.to);
        });
        return { parents: [...new Set(parents)], children: [...new Set(children)] };
    }

    /* ── dossier and forms ── */

    function frame(root, color) {
        root.replaceChildren();
        root.style.setProperty("--c", color);
        ["bar", "corner tl", "corner tr", "corner bl", "corner br"].forEach((name) => root.appendChild(el("span", name)));
    }
    function header(root, role) {
        const head = el("header");
        head.appendChild(el("p", "role", role));
        head.appendChild(headTools(null));
        root.appendChild(head);
    }
    function editable(b) {
        if (!b || !canEdit()) return false;
        if (b.kind === "sun") return !!actions.saveNow;
        return !b.readOnly;
    }
    function formKindOf(b) {
        if (!b) return "";
        if (b.kind === "sun") return "sun";
        if (b.kind === "planet") return "era";
        if (b.kind === "moon") return "arco";
        if (b.kind === "session") return "sesion";
        if (b.kind === "neutral") return "neutro";
        return "evento";
    }
    function canRetype(b) {
        return editable(b) && ["planet", "moon", "neutral", "asteroid"].includes(b.kind) && !!actions.convertNode;
    }
    function glyphSvg(b) {
        const sun = b?.kind === "sun";
        const wide = b?.kind === "planet";
        const svg = svgEl("svg", {
            class: "glyph",
            viewBox: sun ? "-90 -90 180 180" : wide ? "-36 -26 72 52" : "-24 -24 48 48",
            "aria-hidden": "true",
        });
        if (!b || sun) drawSunGraphic(svg);
        else if (b.kind === "planet") drawEraGraphic(svg, b.color);
        else if (b.kind === "moon") drawArcGraphic(svg, b.color);
        else if (b.kind === "session") drawSessionGraphic(svg, b.color);
        else if (b.kind === "neutral") drawNeutralGraphic(svg, b.color);
        else drawEventGraphic(svg, b.color);
        return svg;
    }
    function trashSvg() {
        const svg = svgEl("svg", { viewBox: "0 0 24 24", class: "ico", "aria-hidden": "true" });
        svgEl("path", {
            d: "M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13",
            fill: "none", stroke: "currentColor", "stroke-width": "1.6", "stroke-linecap": "round", "stroke-linejoin": "round",
        }, svg);
        return svg;
    }
    function closeSvg() {
        const svg = svgEl("svg", { viewBox: "0 0 24 24", class: "ico", "aria-hidden": "true" });
        svgEl("path", {
            d: "M6 6l12 12M18 6L6 18",
            fill: "none", stroke: "currentColor", "stroke-width": "1.6", "stroke-linecap": "round",
        }, svg);
        return svg;
    }
    function iconButton(label, graphic, className, onClick) {
        const btn = button(className, null, onClick);
        btn.setAttribute("aria-label", label);
        btn.appendChild(graphic);
        return btn;
    }
    function chevronSvg(up) {
        const svg = svgEl("svg", { viewBox: "0 0 24 24", class: "ico", "aria-hidden": "true" });
        svgEl("path", {
            d: up ? "M6 14l6-6 6 6" : "M6 10l6 6 6-6",
            fill: "none", stroke: "currentColor", "stroke-width": "1.8",
            "stroke-linecap": "round", "stroke-linejoin": "round",
        }, svg);
        return svg;
    }
    function headTools(b) {
        const tools = el("div", "head-tools");
        const mini = !!st.dossierMini;
        if (b) {
            tools.appendChild(iconButton(mini ? "Abrir ficha" : "Minimizar", chevronSvg(!mini), "icon-btn", () => {
                st.dossierMini = !st.dossierMini;
                st.paintOpen = false;
                st.typeOpen = false;
                renderDossier();
            }));
        }
        if (b && !mini && editable(b) && b.id !== "sol") {
            tools.appendChild(iconButton("Borrar", trashSvg(), "icon-btn danger", () => confirmDelete(b.id)));
        }
        tools.appendChild(iconButton("Cerrar", closeSvg(), "icon-btn", () => select(null)));
        return tools;
    }
    let saveTimer = 0;
    let paintTimer = 0;
    let paintFlight = null;
    let holdRender = false;
    let renderQueued = false;
    let swap = null;
    let linkSig = "";
    let panelSig = "";
    const paintMem = new Map();
    function rememberPaint(id, paint) {
        if (!id || !paint) return;
        const prev = paintMem.get(id) || {};
        const next = { ...prev };
        if (paint.color) next.color = paint.color;
        if (paint.auraColor) next.auraColor = paint.auraColor;
        if (Number.isFinite(Number(paint.auraRadius)) && Number(paint.auraRadius) >= 16) next.auraRadius = Number(paint.auraRadius);
        paintMem.set(id, next);
    }
    function sourceHas(id) {
        if (!id) return false;
        return id === "sol" || eraById.has(id) || arcById.has(id) || eventById.has(id) || neutralById.has(id)
            || (data.sessions || []).some((s) => s.id === id);
    }
    function queueCommit(task) {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => { run(task); }, 320);
    }
    function bindCommit(node, task) {
        node.addEventListener("keydown", (ev) => {
            if (ev.key === "Escape") {
                ev.preventDefault();
                st.skipCommit = true;
                st.holdDossier = false;
                renderDossier();
                return;
            }
            if (ev.key === "Enter" && ev.target.tagName !== "SELECT" && ev.target.tagName !== "TEXTAREA" && !ev.target.isContentEditable) {
                ev.preventDefault();
                ev.target.blur();
            }
        });
        node.addEventListener("focusout", (ev) => {
            if (node.contains(ev.relatedTarget)) return;
            if (st.skipCommit) { st.skipCommit = false; st.holdDossier = false; return; }
            st.holdDossier = false;
            queueCommit(task);
            setTimeout(() => { if (!st.holdDossier) renderDossier(); }, 0);
        });
    }
    function openField(host, node, task) {
        st.holdDossier = true;
        host.replaceChildren(node);
        bindCommit(host, task);
        const input = node.matches?.("input, textarea, select") ? node : node.querySelector("input, textarea, select");
        input?.focus();
        if (input?.select) input.select();
    }
    async function patchBody(b, patch) {
        if (b.kind === "sun") {
            await actions.saveNow(String(patch.now ?? "").trim());
            return;
        }
        if (b.kind === "neutral") {
            await actions.saveNeutral(b.id, {
                title: patch.title ?? b.name,
                summary: patch.summary !== undefined ? patch.summary : (b.summary || ""),
                layoutX: b.x, layoutY: b.y,
            });
            return;
        }
        if (b.kind === "session") {
            const save = actions.saveSession || actions.placeSession;
            if (!save) return;
            const s = (data.sessions || []).find((row) => row.id === b.id);
            await save(b.id, {
                title: patch.title ?? s?.title ?? b.name,
                body: patch.body !== undefined ? patch.body : (s?.body || b.body || ""),
                inGame: patch.inGame !== undefined ? patch.inGame : (s?.inGame || ""),
                layoutX: b.x,
                layoutY: b.y,
            });
            return;
        }
        if (b.kind === "planet") {
            const er = eraById.get(b.id);
            const start = patch.start !== undefined ? patch.start : er.start;
            const end = patch.end !== undefined ? patch.end : er.end;
            await actions.saveEra(b.id, {
                title: patch.title ?? er.title,
                summary: patch.summary !== undefined ? patch.summary : (er.summary || ""),
                start: start === "" || start == null ? null : Number(start),
                end: end === "" || end == null ? null : Number(end),
                layoutX: b.x, layoutY: b.y,
            });
            return;
        }
        if (b.kind === "moon") {
            const ar = arcById.get(b.id);
            await actions.saveArc(b.id, {
                title: patch.title ?? ar.title,
                summary: patch.summary !== undefined ? patch.summary : (ar.summary || ""),
                color: ar.color || "", eraIds: [...(ar.eraIds || [])],
                start: patch.start !== undefined ? (patch.start || null) : (ar.start || null),
                end: patch.end !== undefined ? (patch.end || null) : (ar.end || null),
                layoutX: b.x, layoutY: b.y,
            });
            return;
        }
        const ev = eventById.get(b.id);
        const a = ev.anchor || {};
        const parsed = parseDZ(a.start);
        const endParsed = parseDZ(a.end);
        const fields = {
            title: patch.title ?? ev.title,
            summary: patch.summary !== undefined ? patch.summary : (ev.summary || ""),
            precision: patch.precision || a.precision || "year",
            y: patch.y != null ? patch.y : (parsed ? String(parsed.y) : ""),
            m: patch.m != null ? patch.m : (parsed?.m ? String(parsed.m) : "1"),
            d: patch.d != null ? patch.d : (parsed?.d ? String(parsed.d) : ""),
            y2: patch.y2 != null ? patch.y2 : (endParsed ? String(endParsed.y) : ""),
            bucketEra: patch.bucketEra != null ? patch.bucketEra : (a.bucketUnit === "era" ? (a.bucketRef || "") : ""),
            parentId: a.parentId || "",
            eraIds: [...(a.eraIds || [])],
            arcIds: [...(a.arcIds || [])],
        };
        const err = validate({ kind: "evento" }, fields);
        if (err) { toast(err); return; }
        await actions.saveEvent(b.id, {
            title: fields.title.trim(), summary: fields.summary, anchor: anchorFromFields(fields),
            layoutX: b.x, layoutY: b.y,
        });
    }
    function commitTitle(b, raw) {
        const title = String(raw || "").trim();
        if (!title) { toast("Hace falta un título."); return; }
        if (title === (b.name || "")) return;
        if (b.kind === "planet" || b.kind === "moon" || b.kind === "neutral") {
            const err = validate({ kind: formKindOf(b) }, { title });
            if (err) { toast(err); return; }
        }
        return patchBody(b, { title });
    }
    function canEditSummary(b) {
        return editable(b) && ["neutral", "planet", "moon", "asteroid", "session"].includes(b.kind);
    }
    function commitSummary(b, raw) {
        const summary = String(raw ?? "").trim();
        if (summary === String(b.summary || "").trim()) return;
        return patchBody(b, { summary });
    }
    function dateHit(b) {
        if (b.kind === "neutral") return null;
        if (b.kind === "sun" && !actions.saveNow) return null;
        if (!editable(b)) return null;
        return true;
    }
    function paintDateEditor(host, b) {
        if (b.kind === "sun") {
            const input = textInput("now", data.sun.now || "", "7036-02-12");
            input.classList.add("inline");
            openField(host, input, () => {
                const now = input.value.trim();
                if (now === String(data.sun.now || "")) return;
                return patchBody(b, { now });
            });
            return;
        }
        if (b.kind === "session") {
            const s = (data.sessions || []).find((row) => row.id === b.id);
            const input = textInput("inGame", s?.inGame || "", "AAAA-MM-DD");
            input.classList.add("inline");
            openField(host, input, () => {
                const inGame = input.value.trim();
                if (inGame && !parseDZ(inGame)) { toast("Día D.Z.: AAAA, AAAA-MM o AAAA-MM-DD."); return; }
                if (inGame === String(s?.inGame || "")) return;
                return patchBody(b, { inGame });
            });
            return;
        }
        if (b.kind === "planet" || b.kind === "moon") {
            const row = b.kind === "planet" ? eraById.get(b.id) : arcById.get(b.id);
            const box = el("div", "date-edit");
            box.append(
                field("Inicio", textInput("start", row?.start ?? "", b.kind === "planet" ? "Año D.Z." : "AAAA, AAAA-MM o AAAA-MM-DD")),
                field("Fin", textInput("end", row?.end ?? "", "Opcional")),
            );
            openField(host, box, () => {
                const start = box.querySelector("[data-field=start]").value.trim();
                const end = box.querySelector("[data-field=end]").value.trim();
                if (b.kind === "planet") {
                    if (start && !Number.isFinite(Number(start))) { toast("El inicio es un año D.Z."); return; }
                    if (end && !Number.isFinite(Number(end))) { toast("El fin es un año D.Z."); return; }
                } else if ((start && !parseDZ(start)) || (end && !parseDZ(end))) {
                    toast("Fechas: AAAA, AAAA-MM o AAAA-MM-DD.");
                    return;
                }
                if (String(row?.start ?? "") === start && String(row?.end ?? "") === end) return;
                return patchBody(b, { start, end });
            });
            return;
        }
        const ev = eventById.get(b.id);
        const a = ev?.anchor || {};
        const parsed = parseDZ(a.start);
        const box = el("div", "date-edit");
        const prec = selectInput("precision", a.precision || "year", [
            ["year", "Año"], ["month", "Mes"], ["day", "Día"], ["range", "Rango"],
            ["decade", "Década"], ["century", "Siglo"], ["eon", "Eón"], ["era", "Era"], ["inherited", "Heredada del padre"],
        ]);
        prec.addEventListener("change", () => syncPrec(box));
        box.appendChild(field("Precisión", prec));
        const yWrap = field("Año", textInput("y", parsed ? String(parsed.y) : "", "Año D.Z."));
        yWrap.dataset.prec = "year month day range decade century eon";
        box.appendChild(yWrap);
        const mWrap = field("Mes", selectInput("m", parsed?.m ? String(parsed.m) : "1", DZ_MON.map((name, i) => [String(i + 1), name])));
        mWrap.dataset.prec = "month day";
        box.appendChild(mWrap);
        const dWrap = field("Día", textInput("d", parsed?.d ? String(parsed.d) : "", "1"));
        dWrap.dataset.prec = "day";
        box.appendChild(dWrap);
        const y2Wrap = field("Fin del rango", textInput("y2", a.end ? String(parseDZ(a.end)?.y || "") : "", "Año D.Z."));
        y2Wrap.dataset.prec = "range";
        box.appendChild(y2Wrap);
        const beWrap = field("Cubo de era", selectInput("bucketEra", a.bucketUnit === "era" ? (a.bucketRef || "") : "", [["", "Elige una era"], ...allEras().map((e) => [e.id, e.title])]));
        beWrap.dataset.prec = "era";
        box.appendChild(beWrap);
        syncPrec(box);
        openField(host, box, () => {
            const fields = readForm(box);
            const err = validate({ kind: "evento" }, { ...fields, title: b.name });
            if (err) { toast(err); return; }
            return patchBody(b, fields);
        });
    }
    function directLink(a, bId) {
        return (data.links || []).find((link) => (
            (link.fromId === a && link.toId === bId) || (link.fromId === bId && link.toId === a)
        ));
    }
    function groupMates(id) {
        const adj = new Map();
        const add = (a, b) => {
            if (!adj.has(a)) adj.set(a, []);
            adj.get(a).push(b);
        };
        for (const link of data.links || []) {
            if (link.kind !== "agrupa") continue;
            add(link.fromId, link.toId);
            add(link.toId, link.fromId);
        }
        const seen = new Set([id]);
        const stack = [id];
        while (stack.length) {
            const cur = stack.pop();
            for (const next of adj.get(cur) || []) {
                if (seen.has(next)) continue;
                seen.add(next);
                stack.push(next);
            }
        }
        seen.delete(id);
        return [...seen].sort((a, b) => (bodies[a]?.name || a).localeCompare(bodies[b]?.name || b, "es"));
    }
    function relCard(otherId) {
        const other = bodies[otherId];
        const card = el("div", "rel-card");
        const link = directLink(st.selected, otherId);
        if (editable(bodies[st.selected]) && link && actions.dropLink) {
            const ico = button("rel-ico", null, (ev) => {
                ev.stopPropagation();
                const name = other?.name || otherId;
                askConfirm(`¿Quitar el enlace con «${name}»?`, () => run(() => actions.dropLink(st.selected, otherId)));
            });
            ico.setAttribute("aria-label", "Quitar enlace");
            const mark = el("span", "glyph-slot");
            mark.appendChild(glyphSvg(other || { kind: "neutral", color: NEUTRAL_C }));
            const bin = el("span", "trash-slot");
            bin.appendChild(trashSvg());
            ico.append(mark, bin);
            card.appendChild(ico);
        } else {
            const mark = el("span", "glyph-slot");
            mark.appendChild(glyphSvg(other || { kind: "neutral", color: NEUTRAL_C }));
            mark.addEventListener("click", () => travelTo(otherId));
            card.appendChild(mark);
        }
        const go = button("rel-go", null, () => travelTo(otherId));
        const name = el("span", "nm", other?.name || otherId);
        const when = el("span", "when", other?.year || "Sin fecha");
        go.title = `${other?.name || otherId} · ${other?.year || "Sin fecha"}`;
        go.append(name, when);
        card.appendChild(go);
        return card;
    }
    function travelTo(id) {
        if (!id || id === st.selected) return;
        const from = bodies[st.selected];
        select(id, {
            keep: true,
            travel: true,
            origin: from ? { id: from.id, name: from.name } : null,
        });
        frameIds([id], true);
    }
    function canPaint(body) {
        return !!body && body.id !== "draft" && canEdit() && !!actions.savePaint;
    }
    function applyPaint(body, patch) {
        const prev = body.color;
        if (patch.color) {
            tintNode(body.scaler, prev, patch.color);
            const face = ui.dossier?.querySelector(".type-face .glyph");
            if (face) tintNode(face, prev, patch.color);
            body.color = patch.color;
            if (ui.dossier) ui.dossier.style.setProperty("--c", patch.color);
        }
        if (patch.auraColor) body.auraColor = patch.auraColor;
        if (patch.auraRadius) body.auraRadius = Number(patch.auraRadius);
        if (body.aura) body.aura.setAttribute("r", body.auraRadius || AURA_R);
        const auraInk = body.auraColor || body.color || INK;
        (body.auraStops || []).forEach((stop) => stop.setAttribute("stop-color", auraInk));
        ui.dossier?.querySelector(".swatch.ink")?.style.setProperty("--c", body.color);
        ui.dossier?.querySelector(".swatch.aura")?.style.setProperty("--c", auraInk);
        paintFlight = {
            id: body.id,
            color: body.color,
            auraColor: auraInk,
            auraRadius: body.auraRadius || AURA_R,
        };
        rememberPaint(body.id, { color: body.color, auraColor: auraInk, auraRadius: body.auraRadius || AURA_R });
        const snap = paintFlight;
        clearTimeout(paintTimer);
        paintTimer = setTimeout(() => {
            run(() => actions.savePaint(snap.id, {
                color: snap.color, auraColor: snap.auraColor, auraRadius: snap.auraRadius,
            })).finally(() => {
                if (
                    paintFlight
                    && paintFlight.id === snap.id
                    && paintFlight.color === snap.color
                    && paintFlight.auraColor === snap.auraColor
                    && paintFlight.auraRadius === snap.auraRadius
                ) paintFlight = null;
            });
        }, 280);
    }
    function bindDrag(surface, onRatio) {
        const read = (ev) => {
            const box = surface.getBoundingClientRect();
            if (box.width < 8 || box.height < 8) return;
            const x = Math.min(1, Math.max(0, (ev.clientX - box.left) / box.width));
            const y = Math.min(1, Math.max(0, (ev.clientY - box.top) / box.height));
            onRatio(x, y);
        };
        surface.addEventListener("pointerdown", (ev) => {
            if (ev.button != null && ev.button !== 0) return;
            ev.preventDefault();
            ev.stopPropagation();
            st.paintDrag = true;
            read(ev);
            const move = (e) => { if (st.paintDrag) read(e); };
            const end = () => {
                st.paintDrag = false;
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", end);
                window.removeEventListener("pointercancel", end);
            };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", end);
            window.addEventListener("pointercancel", end);
        });
    }
    function paintPop(body) {
        const pop = el("div", "paint-pop");
        const channel = st.paintChannel === "aura" ? "aura" : "ink";
        pop.dataset.channel = channel;
        pop.addEventListener("pointerdown", (ev) => ev.stopPropagation());
        pop.addEventListener("click", (ev) => ev.stopPropagation());
        let hsv = hexToHsv(channel === "aura" ? (body.auraColor || body.color || INK) : (body.color || INK));
        const plane = el("div", "sv");
        const svThumb = el("span", "thumb");
        plane.appendChild(svThumb);
        const hue = el("div", "hue");
        const hueThumb = el("span", "thumb");
        hue.appendChild(hueThumb);
        const hex = el("input", "hex");
        hex.type = "text";
        hex.spellcheck = false;
        hex.setAttribute("aria-label", "Hex");
        hex.maxLength = 7;
        const slide = el("div", "slide");
        slide.setAttribute("role", "slider");
        slide.setAttribute("aria-label", "Radio del aura");
        slide.setAttribute("aria-valuemin", "60");
        slide.setAttribute("aria-valuemax", "320");
        const track = el("span", "slide-track");
        const fill = el("span", "slide-fill");
        const knob = el("span", "slide-knob");
        track.appendChild(fill);
        slide.append(track, knob);
        const read = el("span", "paint-n", String(body.auraRadius || AURA_R));
        const radiusRow = el("div", "paint-row");
        radiusRow.append(el("span", "", "Radio"), slide, read);

        function place() {
            const hexNow = hsvToHex(hsv.h, hsv.s, hsv.v);
            plane.style.background = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), hsl(${hsv.h} 100% 50%)`;
            svThumb.style.left = `${hsv.s * 100}%`;
            svThumb.style.top = `${(1 - hsv.v) * 100}%`;
            hueThumb.style.left = `${(hsv.h / 360) * 100}%`;
            if (document.activeElement !== hex) hex.value = hexNow;
            const radius = body.auraRadius || AURA_R;
            const t = (radius - 60) / (320 - 60);
            fill.style.width = `${Math.min(1, Math.max(0, t)) * 100}%`;
            knob.style.left = `${Math.min(1, Math.max(0, t)) * 100}%`;
            read.textContent = String(Math.round(radius));
            slide.setAttribute("aria-valuenow", String(Math.round(radius)));
        }
        function commitHsv() {
            const next = hsvToHex(hsv.h, hsv.s, hsv.v);
            if (channel === "ink") applyPaint(body, { color: next });
            else applyPaint(body, { auraColor: next });
            place();
        }
        bindDrag(plane, (x, y) => {
            hsv = { ...hsv, s: x, v: 1 - y };
            commitHsv();
        });
        bindDrag(hue, (x) => {
            hsv = {
                ...hsv,
                h: Math.min(359.999, x * 360),
                s: hsv.s < 0.04 ? 1 : hsv.s,
                v: hsv.v < 0.04 ? 1 : hsv.v,
            };
            commitHsv();
        });
        hex.addEventListener("input", () => {
            const value = hex.value.trim();
            if (!/^#[0-9a-fA-F]{6}$/.test(value)) return;
            hsv = hexToHsv(value);
            commitHsv();
        });
        bindDrag(slide, (x) => {
            const radius = Math.round(60 + x * (320 - 60));
            applyPaint(body, { auraRadius: radius });
            place();
        });
        pop.append(plane, hue, hex);
        if (channel === "aura") pop.appendChild(radiusRow);
        place();
        return pop;
    }
    function colorDot(body, channel, label) {
        const interactive = canPaint(body);
        const open = st.paintOpen && (st.paintChannel === "aura" ? "aura" : "ink") === channel;
        const node = interactive ? button(`swatch ${channel}${open ? " on" : ""}`, null, () => {
            if (st.suppressClick) return;
            if (open) st.paintOpen = false;
            else {
                st.paintOpen = true;
                st.paintChannel = channel;
                st.typeOpen = false;
            }
            renderDossier();
        }) : el("span", `swatch ${channel} is-static`);
        const ink = channel === "ink" ? (body.color || INK) : (body.auraColor || body.color || INK);
        node.style.setProperty("--c", ink);
        node.append(el("i"), el("span", "", label));
        if (interactive) {
            node.setAttribute("aria-label", channel === "ink" ? "Color de la entidad" : "Color del aura");
            node.setAttribute("aria-expanded", open ? "true" : "false");
        }
        return node;
    }
    function colorMarks(body) {
        const wrap = el("div", "paints");
        wrap.append(colorDot(body, "ink", "Entidad"), colorDot(body, "aura", "Aura"));
        if (st.paintOpen && canPaint(body)) wrap.appendChild(paintPop(body));
        return wrap;
    }
    function publishChip(b) {
        if (!data.publish || !actions.setPublished || !canEdit() || b.kind === "sun" || b.id === "draft") return null;
        const on = data.publish.visible?.[b.id] === "players";
        const node = button(`pub-chip${on ? " on" : ""}`, null, () => {
            if (st.suppressClick) return;
            node.classList.add("is-busy");
            run(async () => {
                try {
                    await actions.setPublished(b.id, !on);
                    toast(on ? "Oculto para la mesa." : "Publicado: los jugadores lo ven en su Timeline.");
                } finally {
                    node.classList.remove("is-busy");
                }
            });
        });
        node.setAttribute("aria-pressed", on ? "true" : "false");
        node.title = on
            ? "Los jugadores ven este nodo. Las menciones a fichas que no publicaste quedan como texto sin enlace."
            : "Solo tú lo ves. Publicarlo lo agrega al Timeline de los jugadores de esta mesa.";
        node.append(
            el("i"),
            el("span", "k", "Mesa"),
            el("span", "v", on ? "Visible para los jugadores" : "Solo DM"),
            el("span", "hint", on ? "Ocultar" : "Publicar"),
        );
        return node;
    }
    function summaryBlock(b) {
        const block = el("section", "sum-block");
        const rule = el("div", "rel-rule");
        rule.appendChild(el("span", "", "Descripción"));
        block.appendChild(rule);
        const host = el("div", "sum-body");
        const text = String(b.summary || "").trim();
        if (canEditSummary(b)) {
            const hit = button(text ? "sum-hit" : "sum-hit is-empty", text || "Sin descripción", () => {
                if (st.suppressClick) return;
                const area = areaInput("summary", b.summary || "");
                area.classList.add("inline", "sum-edit");
                area.rows = 3;
                area.setAttribute("aria-label", "Descripción");
                openField(host, area, () => commitSummary(b, area.value));
            });
            host.appendChild(hit);
        } else host.appendChild(el("p", text ? "sum" : "sum is-empty", text || "Sin descripción"));
        block.appendChild(host);
        return block;
    }
    const CARD_KINDS = new Set(["neutral", "planet", "moon", "asteroid"]);
    function commitBody(b, raw) {
        const body = raw || "";
        if (body === (b.body || "")) return;
        b.body = body;
        run(() => actions.saveBody?.({ id: b.id, body }));
    }
    function commitIndex(b, people, places) {
        b.people = people;
        b.places = places;
        run(() => actions.saveIndex?.({ id: b.id, people, places }));
    }
    function closePops() {
        ui.dossier.querySelectorAll(".mention-pop").forEach((node) => node.remove());
    }
    function mentionMeta(id, fallback) {
        const row = (data.mentions || []).find((m) => m.id === id);
        const type = row?.type || "";
        return {
            title: row?.title || fallback || "Sin título",
            type,
            label: CODEX_TYPES[type]?.label || "",
            color: CODEX_TYPES[type]?.color || "#f5c542",
        };
    }
    function mentionSpan(id, fallback) {
        const meta = mentionMeta(id, fallback);
        const span = el("span", "mn");
        span.contentEditable = "false";
        span.dataset.mid = id;
        span.dataset.mtitle = meta.title;
        span.style.setProperty("--c", meta.color);
        span.textContent = meta.title;
        span.title = meta.label ? `${meta.label} · ${meta.title}` : meta.title;
        return span;
    }
    function fillRich(root, raw) {
        root.replaceChildren();
        const src = String(raw || "");
        const re = /@\[([^\]]*)\]\(([^)]+)\)/g;
        let i = 0;
        let m;
        while ((m = re.exec(src))) {
            if (m.index > i) root.appendChild(document.createTextNode(src.slice(i, m.index)));
            root.appendChild(mentionSpan(m[2], m[1]));
            i = m.index + m[0].length;
        }
        if (i < src.length) root.appendChild(document.createTextNode(src.slice(i)));
        if (!root.childNodes.length) root.appendChild(document.createTextNode(""));
    }
    function serializeRich(root) {
        let out = "";
        const walk = (node) => {
            if (node.nodeType === 3) { out += node.textContent; return; }
            if (node.nodeName === "BR") { out += "\n"; return; }
            if (node.dataset?.mid) {
                const title = String(node.dataset.mtitle || node.textContent || "Sin título").replace(/[[\]]/g, "");
                out += `@[${title}](${node.dataset.mid})`;
                return;
            }
            if (node.nodeName === "DIV" || node.nodeName === "P") {
                if (out && !out.endsWith("\n")) out += "\n";
                node.childNodes.forEach(walk);
                return;
            }
            node.childNodes.forEach(walk);
        };
        root.childNodes.forEach(walk);
        return out.replace(/\u00a0/g, " ");
    }
    function mentionHits(query, selfId) {
        const q = String(query || "").toLowerCase();
        return (data.mentions || [])
            .filter((m) => m?.id && m.id !== selfId && m.title && (!q || String(m.title).toLowerCase().includes(q)))
            .slice(0, 8);
    }
    function caretIn(root) {
        const sel = window.getSelection();
        if (!sel?.rangeCount) return null;
        const range = sel.getRangeAt(0);
        if (!root.contains(range.startContainer) || range.startContainer.nodeType !== 3) return null;
        return { node: range.startContainer, offset: range.startOffset };
    }
    function bindMention(area) {
        const paint = () => {
            closePops();
            const caret = caretIn(area);
            if (!caret) return;
            const text = caret.node.textContent.slice(0, caret.offset);
            const at = text.lastIndexOf("@");
            if (at < 0) return;
            const frag = text.slice(at + 1);
            if (/[\s\n\]]/.test(frag)) return;
            const hits = mentionHits(frag, area.dataset.owner || "");
            if (!hits.length) return;
            const pop = el("div", "mention-pop");
            pop.setAttribute("role", "listbox");
            hits.forEach((m, i) => {
                const meta = mentionMeta(m.id, m.title);
                const opt = button(i === 0 ? "on" : "", null, () => {
                    const live = caret.node;
                    const cut = live.textContent.slice(0, caret.offset);
                    const after = live.textContent.slice(caret.offset);
                    const lead = at > 0 && !/\s$/.test(cut.slice(0, at)) ? " " : "";
                    live.textContent = `${cut.slice(0, at)}${lead}`;
                    const chip = mentionSpan(m.id, m.title);
                    const rest = document.createTextNode(after.startsWith(" ") ? after : ` ${after}`);
                    live.after(chip, rest);
                    const sel = window.getSelection();
                    const range = document.createRange();
                    range.setStart(rest, Math.min(1, rest.textContent.length));
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                    closePops();
                    area.focus();
                });
                opt.addEventListener("pointerdown", (ev) => ev.preventDefault());
                const name = el("span", "mn-name", meta.title);
                name.style.setProperty("--c", meta.color);
                opt.append(name, el("span", "mn-type", meta.label));
                pop.appendChild(opt);
            });
            area.parentElement.appendChild(pop);
        };
        area.addEventListener("input", paint);
        area.addEventListener("keyup", (ev) => {
            if (ev.key === "Escape" || ev.key === "Enter") return;
            paint();
        });
        area.addEventListener("keydown", (ev) => {
            const pop = area.parentElement?.querySelector(".mention-pop");
            if (!pop) return;
            const opts = [...pop.querySelectorAll("button")];
            const cur = Math.max(0, opts.findIndex((o) => o.classList.contains("on")));
            if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
                ev.preventDefault();
                ev.stopPropagation();
                const next = opts[(cur + (ev.key === "ArrowDown" ? 1 : opts.length - 1)) % opts.length];
                opts.forEach((o) => o.classList.toggle("on", o === next));
            } else if (ev.key === "Enter" || ev.key === "Tab") {
                ev.preventDefault();
                ev.stopPropagation();
                opts[cur]?.click();
            } else if (ev.key === "Escape") {
                ev.preventDefault();
                ev.stopPropagation();
                closePops();
            }
        });
    }
    function sinopsisBlock(b) {
        const block = el("section", "sum-block");
        const rule = el("div", "rel-rule");
        rule.appendChild(el("span", "", b.kind === "session" ? "Idea" : "Sinopsis"));
        block.appendChild(rule);
        const host = el("div", "sum-body");
        const raw = String(b.body || "");
        const openEditor = () => {
            if (st.suppressClick) return;
            const area = el("div", "inline sum-edit rich-edit");
            area.contentEditable = "true";
            area.dataset.owner = b.id;
            area.setAttribute("role", "textbox");
            area.setAttribute("aria-label", "Sinopsis");
            area.setAttribute("aria-multiline", "true");
            fillRich(area, raw);
            st.holdDossier = true;
            host.replaceChildren(area);
            bindCommit(host, () => { closePops(); commitBody(b, serializeRich(area)); });
            bindMention(area);
            area.focus();
        };
        if (canEditSummary(b)) {
            const hit = el("div", raw.trim() ? "sum-hit rich" : "sum-hit rich is-empty");
            hit.tabIndex = 0;
            if (!raw.trim()) hit.textContent = b.kind === "session" ? "Sin idea. Puede ser lo que todavía no ocurre." : "Sin sinopsis. Escribe @ para mencionar.";
            else fillRich(hit, raw);
            hit.addEventListener("click", openEditor);
            hit.addEventListener("keydown", (ev) => {
                if (ev.key === "Enter") { ev.preventDefault(); openEditor(); }
            });
            host.appendChild(hit);
        } else {
            const view = el("div", raw.trim() ? "sum rich" : "sum is-empty");
            if (!raw.trim()) view.textContent = "Sin sinopsis";
            else fillRich(view, raw);
            host.appendChild(view);
        }
        block.appendChild(host);
        return block;
    }
    function indexName(id) {
        return (data.mentions || []).find((m) => m.id === id)?.title || "Sin título";
    }
    function indexChip(label, extra, onRemove) {
        const node = el("span", `ix-chip${extra ? ` ${extra}` : ""}`);
        node.appendChild(el("span", "", label));
        if (onRemove) {
            const x = button("ix-x", "×", onRemove);
            x.setAttribute("aria-label", `Quitar ${label}`);
            node.appendChild(x);
        }
        return node;
    }
    function indexCatalog(kind) {
        const want = kind === "personaje" ? "personaje" : "locacion";
        return (data.mentions || []).filter((m) => m.type === want && m.id);
    }
    function indexPlus(b) {
        const btn = button("icon-btn ix-plus", null, () => {
            const host = btn.closest(".ix-block");
            const open = host.querySelector(".ix-pick");
            host.querySelectorAll(".ix-pick").forEach((node) => node.remove());
            if (open) return;
            const have = new Set([...(b.people || []), ...(b.places || [])]);
            const pop = el("div", "mention-pop ix-pick");
            const addGroup = (kind, label) => {
                const hits = indexCatalog(kind).filter((m) => !have.has(m.id));
                if (!hits.length) return 0;
                pop.appendChild(el("p", "ix-kicker", label));
                hits.slice(0, 12).forEach((m) => {
                    pop.appendChild(button("", m.title, () => {
                        if (kind === "personaje") commitIndex(b, [...(b.people || []), m.id], b.places || []);
                        else commitIndex(b, b.people || [], [...(b.places || []), m.id]);
                        renderDossier();
                    }));
                });
                return hits.length;
            };
            const people = addGroup("personaje", "Personaje");
            const places = addGroup("lugar", "Lugar");
            if (!people && !places) {
                const empty = el("div", "ix-void");
                empty.append(
                    el("p", "k", "Códice"),
                    el("p", "t", "Nada que indexar"),
                    el("p", "d", "Crea un personaje o un lugar en el Códice. Después aparecen aquí."),
                );
                pop.appendChild(empty);
            }
            host.appendChild(pop);
        });
        btn.setAttribute("aria-label", "Indexar personaje o lugar");
        const svg = svgEl("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" });
        svgEl("path", {
            d: "M12 5v14M5 12h14", fill: "none", stroke: "currentColor",
            "stroke-width": "1.8", "stroke-linecap": "round",
        }, svg);
        btn.appendChild(svg);
        return btn;
    }
    function indexBlock(b) {
        const block = el("section", "sum-block ix-block");
        const rule = el("div", "rel-rule ix-rule");
        rule.appendChild(el("span", "", "Indexado"));
        if (canEditSummary(b)) rule.appendChild(indexPlus(b));
        block.appendChild(rule);
        const ownOf = (id) => {
            const body = bodies[id];
            return { people: body?.people || [], places: body?.places || [] };
        };
        const roll = rollupIndex(b.id, data.links || [], ownOf);
        const list = el("div", "ix-list");
        const paint = (ids, extra, removable) => {
            ids.forEach((id) => {
                list.appendChild(indexChip(indexName(id), extra, removable && canEditSummary(b) ? () => {
                    const people = extra === "is-place" ? (b.people || []) : (b.people || []).filter((x) => x !== id);
                    const places = extra === "is-place" ? (b.places || []).filter((x) => x !== id) : (b.places || []);
                    commitIndex(b, people, places);
                    renderDossier();
                } : null));
            });
        };
        paint(b.people || [], "", true);
        paint(roll.inheritedPeople, "is-inherited", false);
        paint(b.places || [], "is-place", true);
        paint(roll.inheritedPlaces, "is-place is-inherited", false);
        if (!list.childElementCount) list.appendChild(el("p", "sum is-empty", "Sin indexar"));
        block.appendChild(list);
        return block;
    }
    function flowMark(dir) {
        const svg = svgEl("svg", { viewBox: "0 0 24 24", class: "sep-ico", "aria-hidden": "true" });
        const d = dir === "left" ? "M20 12H6M10 7l-6 5 6 5" : "M4 12h14M14 7l6 5-6 5";
        svgEl("path", {
            d, fill: "none", stroke: "#f5c542", "stroke-width": "1.6",
            "stroke-linecap": "round", "stroke-linejoin": "round",
        }, svg);
        return svg;
    }
    function twinMark() {
        const svg = svgEl("svg", { viewBox: "0 0 24 24", class: "sep-ico", "aria-hidden": "true" });
        svgEl("path", {
            d: "M4 9h16M4 15h16", fill: "none", stroke: "#00f2ea", "stroke-width": "1.8", "stroke-linecap": "round",
        }, svg);
        return svg;
    }
    function relHead(label, mark) {
        const heading = el("h3", "rel-h");
        heading.append(mark, el("span", "", label));
        return heading;
    }
    function relSep(kind) {
        const sep = el("div", `rel-sep ${kind}`);
        sep.setAttribute("aria-hidden", "true");
        sep.appendChild(kind === "paralelo" ? twinMark() : flowMark("right"));
        return sep;
    }
    function sessionTools(b) {
        const session = (data.sessions || []).find((row) => row.id === b.id);
        const box = el("div", "session-tools");
        box.appendChild(el("p", "meta", "La idea vive en el Lore. El recap lo escribe el acta, si anexas una."));
        const camps = data.campaigns || [];
        if (!camps.length) {
            box.appendChild(el("p", "meta", "Sin campaña enlazada. Esta sesión no crea un acta."));
        } else if (canEdit() && actions.annexSession) {
            camps.forEach((camp) => {
                const rows = (data.actas || []).filter((acta) => acta.campaignId === camp.id);
                const current = rows.find((acta) => acta.loreSessionId === b.id);
                const pick = selectInput("annex", current?.id || "", [
                    ["", "Sin anexar"],
                    ...rows.map((acta) => [acta.id, acta.title]),
                ]);
                pick.addEventListener("change", () => run(() => actions.annexSession(b.id, camp.id, pick.value)));
                box.appendChild(field(camp.name || "Mesa", pick));
                if (!rows.length) box.appendChild(el("p", "meta", "Todavía no hay actas en esa mesa. Se crean en el Diario, y no nacen solas en el Lore."));
                if (current && actions.openActa) box.appendChild(button("act", "Abrir acta", () => actions.openActa(current.id)));
            });
        }
        if (canEdit() && actions.setSessionArc) {
            const currentArc = (data.links || []).find((link) => link.kind === "agrupa" && link.toId === b.id && link.fromType === "arco");
            const pick = selectInput("arc", currentArc?.fromId || "", [
                ["", "Sin arco"],
                ...allArcs().map((arc) => [arc.id, arc.title]),
            ]);
            pick.addEventListener("change", () => run(() => actions.setSessionArc(b.id, pick.value)));
            box.appendChild(field("Arco", pick));
        }
        if (canEdit() && actions.hangSession) {
            const hung = session?.eventIds || [];
            hung.forEach((eventId) => {
                const ev = (data.events || []).find((row) => row.id === eventId);
                const line = el("div", "acts");
                line.append(
                    el("span", "", ev?.title || "Acontecimiento"),
                    button("act", "Soltar", () => run(() => actions.unhangSession(b.id, eventId))),
                );
                box.appendChild(line);
            });
            const free = (data.events || []).filter((ev) => !hung.includes(ev.id));
            const pick = selectInput("hang", "", [["", "Colgar acontecimiento"], ...free.map((ev) => [ev.id, ev.title])]);
            pick.addEventListener("change", () => {
                if (!pick.value) return;
                run(() => actions.hangSession(b.id, pick.value));
            });
            box.appendChild(field("Colgar", pick));
            box.appendChild(el("p", "meta", "Colgar no dibuja una línea."));
        }
        const people = (data.mentions || []).filter((row) => row.type === "personaje");
        if (canEdit() && people.length && actions.saveSession) {
            const chosen = new Set(session?.personajeIds || []);
            const rule = el("div", "rel-rule");
            rule.appendChild(el("span", "", "Personajes"));
            box.appendChild(rule);
            people.forEach((person) => {
                const on = chosen.has(person.id);
                box.appendChild(button(on ? "act pri" : "act", person.title, () => {
                    const ids = new Set(session?.personajeIds || []);
                    if (ids.has(person.id)) ids.delete(person.id);
                    else ids.add(person.id);
                    run(() => actions.saveSession(b.id, { personajeIds: [...ids] }));
                }));
            });
        }
        return box;
    }
    function renderDossier() {
        const root = ui.dossier;
        if (st.holdDossier && root.contains(document.activeElement)) return;
        if (st.paintDrag) return;
        const paintChannel = st.paintChannel === "aura" ? "aura" : "ink";
        if (st.paintOpen && root.querySelector(".paint-pop")?.dataset.channel === paintChannel) return;
        const form = st.form;
        const id = st.selected;
        const b = id && bodies[id];
        if (!b && !form) { root.hidden = true; root.replaceChildren(); return; }
        root.hidden = false;
        root.classList.toggle("is-mini", !!st.dossierMini && !form);
        frame(root, b?.color || SUN_C);
        if (form) { renderForm(root, form, b); return; }
        const head = el("header", "dossier-top");
        const face = canRetype(b) ? button("type-face", null, () => {
            if (st.suppressClick) return;
            st.typeOpen = !st.typeOpen;
            st.paintOpen = false;
            renderDossier();
        }) : el("div", "type-face is-static");
        face.append(glyphSvg(b), el("span", "role", roleOf(b)));
        if (canRetype(b)) face.setAttribute("aria-expanded", st.typeOpen ? "true" : "false");
        const title = el("h2");
        title.id = "solar-dossier-title";
        if (editable(b) && b.kind !== "sun") {
            const hit = button("inline-hit", b.name, () => {
                if (st.suppressClick) return;
                const input = textInput("title", b.name);
                input.classList.add("inline");
                openField(title, input, () => commitTitle(b, input.value));
            });
            title.appendChild(hit);
        } else title.textContent = b.name;
        const meta = el("div", "meta");
        const dateLabel = b.year || "Sin fecha";
        if (dateHit(b)) {
            meta.appendChild(button("inline-hit", dateLabel, () => {
                if (st.suppressClick) return;
                paintDateEditor(meta, b);
            }));
        } else meta.textContent = dateLabel;
        const typeSlot = el("div", "type-slot");
        typeSlot.appendChild(face);
        if (st.dossierMini) {
            const ident = el("div", "ident");
            ident.append(title, meta);
            head.append(typeSlot, ident, headTools(b));
            root.appendChild(head);
            return;
        }
        head.append(typeSlot, title, headTools(b));
        root.appendChild(head);
        const metaRow = el("div", "meta-row");
        const emptyDate = !b.year;
        if (dateHit(b)) {
            const hit = button(emptyDate ? "date-chip is-empty" : "date-chip", null, () => {
                if (st.suppressClick) return;
                paintDateEditor(meta, b);
            });
            hit.append(el("span", "k", "Fecha"), el("span", "v", dateLabel));
            meta.replaceChildren(hit);
        } else {
            const node = el("span", emptyDate ? "date-chip is-empty is-static" : "date-chip is-static");
            node.append(el("span", "k", "Fecha"), el("span", "v", dateLabel));
            meta.replaceChildren(node);
        }
        metaRow.append(meta, colorMarks(b));
        root.appendChild(metaRow);
        const pub = publishChip(b);
        if (pub) root.appendChild(pub);
        if (st.typeOpen && canRetype(b)) {
            const menu = el("div", "type-menu");
            menu.setAttribute("role", "listbox");
            const glyphKind = { neutro: "neutral", era: "planet", arco: "moon", evento: "asteroid" };
            [["neutro", "Neutro"], ["era", "Era"], ["arco", "Arco"], ["evento", "Acontecimiento"]].forEach(([kind, label]) => {
                const opt = button(formKindOf(b) === kind ? "on" : "", null, () => {
                    st.typeOpen = false;
                    if (formKindOf(b) === kind) { renderDossier(); return; }
                    const fromId = b.id;
                    const carried = paintMem.get(fromId) || data.paints?.[fromId] || null;
                    run(async () => {
                        holdRender = true;
                        let next = null;
                        try {
                            next = await actions.convertNode({
                                fromKind: formKindOf(b), id: fromId, toKind: kind,
                                fields: {
                                    title: b.name, summary: b.summary || "", body: b.body || "",
                                    people: b.people || [], places: b.places || [],
                                    layoutX: b.x, layoutY: b.y,
                                },
                            });
                            if (!next) return;
                            if (carried) rememberPaint(next, carried);
                            swap = { fromId, toId: next };
                            st.pendingSelect = next;
                        } finally {
                            holdRender = false;
                            renderQueued = false;
                            render();
                        }
                    });
                });
                opt.setAttribute("role", "option");
                opt.append(glyphSvg({ kind: glyphKind[kind], color: b.color }), el("span", "", label));
                menu.appendChild(opt);
            });
            typeSlot.appendChild(menu);
        }
        if (st.cameFrom && st.cameFrom.id !== b.id) {
            const from = button("from", `Desde «${st.cameFrom.name}»`, () => {
                const back = st.cameFrom.id;
                select(back, { keep: true });
                if (bodies[back]) frameIds([back], true);
            });
            root.appendChild(from);
        }
        root.appendChild(summaryBlock(b));
        if (CARD_KINDS.has(b.kind) || b.kind === "session") {
            root.appendChild(sinopsisBlock(b));
            if (CARD_KINDS.has(b.kind)) root.appendChild(indexBlock(b));
        }
        const rel = { previos: [], posteriores: [], paralelos: [] };
        for (const link of data.links || []) {
            const from = link.fromId === id;
            const to = link.toId === id;
            if (!from && !to) continue;
            const other = from ? link.toId : link.fromId;
            if (link.kind === "sigue") (from ? rel.posteriores : rel.previos).push(other);
            else if (link.kind === "paralelo") rel.paralelos.push(other);
        }
        const board = el("div", "rel-board");
        const cols = el("div", "rel-cols");
        const bands = [
            ["Previo", rel.previos, flowMark("left")],
            ["Paralelo", rel.paralelos, twinMark()],
            ["Posterior", rel.posteriores, flowMark("right")],
        ];
        bands.forEach(([label, ids, mark]) => {
            const col = el("section", "rel-col");
            col.appendChild(relHead(label, mark));
            if (!ids.length) col.appendChild(el("p", "empty-mini", "—"));
            else ids.forEach((other) => col.appendChild(relCard(other)));
            cols.appendChild(col);
        });
        board.appendChild(cols);
        const rule = el("div", "rel-rule");
        rule.appendChild(el("span", "", "Agrupados"));
        board.appendChild(rule);
        const mates = groupMates(id);
        const band = el("div", "rel-group");
        if (!mates.length) band.appendChild(el("p", "empty-mini", "—"));
        else mates.forEach((other) => band.appendChild(relCard(other)));
        board.appendChild(band);
        root.appendChild(board);
        if (b.kind === "session") root.appendChild(sessionTools(b));
        const sessions = b.kind === "asteroid" ? sessionsFor(id) : [];
        if (sessions.length) {
            root.appendChild(el("h3", "", "Sesión"));
            sessions.forEach((s) => {
                const block = el("div", "session");
                block.appendChild(el("p", "when", s.title));
                block.appendChild(el("p", "rg", sessionDayLabel(s)));
                if (s.body || s.recap) block.appendChild(el("p", "recap", plainRecap(s.body || s.recap)));
                root.appendChild(block);
                if (canEdit() && actions.unhangSession) {
                    const row = el("div", "acts");
                    row.appendChild(button("act", "Quitar sesión", () => askConfirm(`¿Desenganchar la sesión «${s.title}»? El acontecimiento se queda.`, () => run(() => actions.unhangSession(s.id, id)))));
                    root.appendChild(row);
                }
            });
        }
        if (b.readOnly) root.appendChild(el("p", "meta", "Arco del catálogo de la campaña. Se edita en los ajustes de arcos."));
    }
    async function run(task) {
        try {
            await task();
        } catch (err) {
            console.error("solar:", err);
            toast(err?.userMessage || "No se pudo guardar.");
        }
    }
    function field(label, node) {
        const wrap = el("label", "solar-field");
        wrap.append(el("span", "fl-t", label), node);
        return wrap;
    }
    function textInput(name, value, placeholder) {
        const input = el("input", "input");
        input.dataset.field = name;
        input.value = value ?? "";
        if (placeholder) input.placeholder = placeholder;
        return input;
    }
    function areaInput(name, value) {
        const input = el("textarea", "input");
        input.dataset.field = name;
        input.value = value || "";
        return input;
    }
    function selectInput(name, value, options) {
        const input = el("select", "input");
        input.dataset.field = name;
        options.forEach(([val, label]) => {
            const opt = el("option", "", label);
            opt.value = val;
            if (String(value || "") === String(val)) opt.selected = true;
            input.appendChild(opt);
        });
        return input;
    }
    function checks(group, options, selected) {
        const box = el("div", "solar-checks");
        options.forEach((opt) => {
            const label = el("label", "solar-check");
            const input = el("input");
            input.type = "checkbox";
            input.dataset.group = group;
            input.value = opt.id;
            input.checked = (selected || []).includes(opt.id);
            label.append(input, document.createTextNode(opt.title));
            box.appendChild(label);
        });
        if (!options.length) box.appendChild(el("p", "empty-mini", "Nada."));
        return box;
    }
    function formTitle(form, b) {
        if (form.mode === "edit" && b) return b.name;
        const names = { era: "Nueva era", arco: "Nuevo arco", evento: "Nuevo acontecimiento", sesion: "Nueva sesión" };
        return names[form.kind] || "Ficha";
    }
    function renderForm(root, form, b) {
        header(root, form.mode === "create" ? "Crear" : (roleOf(b) || "Ficha"));
        const title = el("h2", "", formTitle(form, b));
        title.id = "solar-dossier-title";
        root.appendChild(title);
        const fields = form.fields || {};
        if (form.kind !== "sun" && form.kind !== "sesion") {
            const tipo = selectInput("kind", form.kind, [
                ["neutro", "Neutro"], ["era", "Era"], ["arco", "Arco"], ["evento", "Acontecimiento"],
            ]);
            tipo.addEventListener("change", () => {
                const next = readForm(root);
                st.form = { ...form, kind: tipo.value, fields: { ...form.fields, ...next } };
                renderDossier();
            });
            root.appendChild(field("Tipo", tipo));
            root.appendChild(field("Título", textInput("title", fields.title)));
            root.appendChild(field("Resumen", areaInput("summary", fields.summary)));
        }
        if (form.kind === "sun") {
            root.appendChild(field("Ahora D.Z.", textInput("now", fields.now, "7036-02-12")));
            root.appendChild(el("p", "meta", "Fecha narrativa presente de la mesa."));
        } else if (form.kind === "neutro") {
            root.appendChild(el("p", "meta", "Comparte título y resumen. El tipo, arriba, abre los datos de esa entidad."));
        } else if (form.kind === "era") {
            root.appendChild(field("Inicio", textInput("start", fields.start, "Opcional. Año D.Z.")));
            root.appendChild(field("Fin", textInput("end", fields.end, "Vacío = abierta, si hay inicio")));
            root.appendChild(el("p", "meta", "La fecha es un rótulo. No ordena y no crea líneas."));
        } else if (form.kind === "arco") {
            root.appendChild(field("Color", textInput("color", fields.color, "#00f2ea")));
            root.appendChild(field("Inicio", textInput("start", fields.start, "Opcional. AAAA, AAAA-MM o AAAA-MM-DD")));
            root.appendChild(field("Fin", textInput("end", fields.end, "Opcional")));
            root.appendChild(el("p", "meta", "La fecha es un rótulo. Agrupar se dibuja en el solar."));
        } else if (form.kind === "sesion") {
            root.appendChild(field("Título", textInput("title", fields.title)));
            root.appendChild(field("Idea", areaInput("body", fields.body)));
            root.appendChild(field("Día D.Z.", textInput("inGame", fields.inGame, "Opcional. AAAA-MM-DD")));
            root.appendChild(el("p", "meta", "Sesión del Lore. No crea un acta de mesa."));
        } else if (form.kind === "evento") {
            const prec = selectInput("precision", fields.precision || "year", [
                ["year", "Año"], ["month", "Mes"], ["day", "Día"], ["range", "Rango"],
                ["decade", "Década"], ["century", "Siglo"], ["eon", "Eón"], ["era", "Era"], ["inherited", "Heredada del padre"],
            ]);
            prec.addEventListener("change", () => syncPrec(root));
            root.appendChild(field("Precisión", prec));
            const yWrap = field("Año", textInput("y", fields.y, "Año D.Z."));
            yWrap.dataset.prec = "year month day range decade century eon";
            root.appendChild(yWrap);
            const mWrap = field("Mes", selectInput("m", fields.m || "1", DZ_MON.map((name, i) => [String(i + 1), name])));
            mWrap.dataset.prec = "month day";
            root.appendChild(mWrap);
            const dWrap = field("Día", textInput("d", fields.d, "1"));
            dWrap.dataset.prec = "day";
            root.appendChild(dWrap);
            const y2Wrap = field("Fin del rango", textInput("y2", fields.y2, "Año D.Z."));
            y2Wrap.dataset.prec = "range";
            root.appendChild(y2Wrap);
            const beWrap = field("Cubo de era", selectInput("bucketEra", fields.bucketEra || "", [["", "Elige una era"], ...allEras().map((e) => [e.id, e.title])]));
            beWrap.dataset.prec = "era";
            root.appendChild(beWrap);
            root.appendChild(el("p", "meta", "Basta el título. La fecha, si la escribes, es un rótulo: no ordena y no crea líneas."));
            syncPrec(root);
        }
        const acts = el("div", "acts");
        const save = button("act pri", st.saving ? "Guardando…" : "Guardar", saveForm);
        save.disabled = st.saving;
        acts.append(save, button("act", "Cancelar", () => {
            dropDraft();
            st.form = null;
            if (st.selected === "draft") markMany([], null);
            render();
        }));
        root.appendChild(acts);
    }
    function syncPrec(root) {
        const p = root.querySelector("[data-field=precision]")?.value || "year";
        root.querySelectorAll("[data-prec]").forEach((node) => { node.hidden = !node.dataset.prec.split(" ").includes(p); });
    }
    function readForm(root) {
        const out = {};
        root.querySelectorAll("[data-field]").forEach((node) => {
            out[node.dataset.field] = node.type === "checkbox" ? node.checked : node.value;
        });
        root.querySelectorAll("[data-group]").forEach((node) => {
            const g = node.dataset.group;
            out[g] = out[g] || [];
            if (node.checked) out[g].push(node.value);
        });
        return out;
    }
    function validate(form, fields) {
        if (form.kind === "sun" || form.kind === "neutro") {
            if (form.kind === "neutro" && !String(fields.title || "").trim()) return "Hace falta un título.";
            return "";
        }
        if (form.kind === "era") {
            if (!String(fields.title || "").trim()) return "Hace falta un título.";
            if (String(fields.start || "").trim() && !Number.isFinite(Number(fields.start))) return "El inicio es un año D.Z.";
            if (String(fields.end || "").trim() && !Number.isFinite(Number(fields.end))) return "El fin es un año D.Z.";
            return "";
        }
        if (form.kind === "arco") {
            if (!String(fields.title || "").trim()) return "Hace falta un título.";
            if ((fields.start && !parseDZ(fields.start)) || (fields.end && !parseDZ(fields.end))) return "Fechas: AAAA, AAAA-MM o AAAA-MM-DD.";
            return "";
        }
        if (form.kind === "sesion") {
            if (!String(fields.title || "").trim()) return "Hace falta un título.";
            if (String(fields.inGame || "").trim() && !parseDZ(fields.inGame)) return "Día D.Z.: AAAA, AAAA-MM o AAAA-MM-DD.";
            return "";
        }
        if (!String(fields.title || "").trim()) return "Hace falta un título.";
        return "";
    }
    async function saveForm() {
        const form = st.form;
        if (!form || !canEdit() || st.saving) return;
        const fields = readForm(ui.dossier);
        const err = validate(form, fields);
        if (err) { toast(err); return; }
        st.saving = true;
        renderDossier();
        try {
            const id = await commit(form, fields);
            if (st.form !== form) return;
            if (form.mode === "create" && id && st.pos.draft) {
                st.pos[id] = { ...st.pos.draft, labelAng: Math.PI / 2 };
                delete st.pos.draft;
                st.enterId = id;
            }
            if (form.mode === "edit" && id && id !== form.id) {
                const prev = st.pos[form.id];
                if (prev) st.pos[id] = { ...prev };
                delete st.pos[form.id];
                st.enterId = id;
            }
            st.form = null;
            markMany(id ? [id] : [...(st.selection || [])], id || st.selected);
        } catch (e) {
            console.error("solar save:", e);
            toast(e?.userMessage || "No se pudo guardar.");
        } finally {
            st.saving = false;
            if (!destroyed) render();
        }
    }
    async function commit(form, fields) {
        if (form.kind === "sun") {
            await actions.saveNow(String(fields.now || "").trim());
            return "sol";
        }
        const body = form.id ? bodies[form.id] : null;
        const place = form.mode === "create"
            ? { layoutX: form.x, layoutY: form.y }
            : (body ? { layoutX: body.x, layoutY: body.y } : {});
        if (form.mode === "edit" && form.originKind && form.originKind !== form.kind) {
            return actions.convertNode({
                fromKind: form.originKind, id: form.id, toKind: form.kind, fields: { ...fields, ...place },
            });
        }
        if (form.kind === "neutro") {
            return actions.saveNeutral(form.mode === "edit" ? form.id : null, {
                title: fields.title.trim(), summary: fields.summary || "", ...place,
            });
        }
        if (form.kind === "sesion") {
            const save = actions.saveSession || actions.placeSession;
            return save(form.mode === "edit" ? form.id : null, {
                title: String(fields.title || "").trim(),
                body: fields.body || "",
                inGame: String(fields.inGame || "").trim(),
                ...place,
            });
        }
        if (form.kind === "era") {
            const start = String(fields.start || "").trim();
            const end = String(fields.end || "").trim();
            return actions.saveEra(form.mode === "edit" ? form.id : null, {
                title: fields.title.trim(), summary: fields.summary || "",
                start: start === "" ? null : Number(start),
                end: end === "" ? null : Number(end),
                ...place,
            });
        }
        if (form.kind === "arco") {
            const prev = form.mode === "edit" ? arcById.get(form.id) : null;
            return actions.saveArc(form.mode === "edit" ? form.id : null, {
                title: fields.title.trim(), summary: fields.summary || "",
                color: String(fields.color || "").trim(), start: String(fields.start || "").trim() || null,
                end: String(fields.end || "").trim() || null, eraIds: prev?.eraIds || [],
                ...place,
            });
        }
        const prev = form.mode === "edit" ? eventById.get(form.id)?.anchor : null;
        const anchor = anchorFromFields(fields);
        if (prev) {
            anchor.eraIds = prev.eraIds || [];
            anchor.arcIds = prev.arcIds || [];
            anchor.parentId = prev.parentId || null;
        }
        return actions.saveEvent(form.mode === "edit" ? form.id : null, {
            title: fields.title.trim(), summary: fields.summary || "", anchor, ...place,
        });
    }
    function dropDraft() { delete st.pos.draft; }
    function beginEdit(id) {
        const b = bodies[id];
        if (!editable(b)) return;
        if (b.kind === "sun") {
            st.form = { mode: "edit", kind: "sun", originKind: "sun", id, fields: { now: data.sun.now || "" } };
        } else if (b.kind === "neutral") {
            st.form = { mode: "edit", kind: "neutro", originKind: "neutro", id, fields: { title: b.name, summary: b.summary || "" } };
        } else if (b.kind === "planet") {
            const er = eraById.get(id);
            st.form = { mode: "edit", kind: "era", originKind: "era", id, fields: { title: er.title, summary: er.summary || "", start: er.start ?? "", end: er.end ?? "" } };
        } else if (b.kind === "moon") {
            const ar = arcById.get(id);
            st.form = { mode: "edit", kind: "arco", originKind: "arco", id, fields: { title: ar.title, summary: ar.summary || "", color: ar.color || "", start: ar.start || "", end: ar.end || "", eraIds: [...(ar.eraIds || [])] } };
        } else if (b.kind === "session") {
            const s = (data.sessions || []).find((row) => row.id === id);
            st.form = { mode: "edit", kind: "sesion", originKind: "sesion", id, fields: { title: s?.title || b.name, body: s?.body || "", inGame: s?.inGame || "" } };
        } else {
            const ev = eventById.get(id);
            const a = ev.anchor;
            const parsed = parseDZ(a.start);
            st.form = {
                mode: "edit", kind: "evento", originKind: "evento", id,
                fields: {
                    title: ev.title, summary: ev.summary || "", precision: a.precision || "year",
                    y: parsed ? String(parsed.y) : (a.bucketRef || ""), m: parsed?.m ? String(parsed.m) : "1", d: parsed?.d ? String(parsed.d) : "",
                    y2: a.end ? String(parseDZ(a.end)?.y || a.end) : "", bucketEra: a.bucketUnit === "era" ? a.bucketRef : "",
                    parentId: a.parentId || "", eraIds: [...(a.eraIds || [])], arcIds: [...(a.arcIds || [])],
                },
            };
        }
        markMany([id], id);
        applyAlphas();
        renderDossier();
    }
    function kindOf(b) {
        if (b.kind === "planet") return "era";
        if (b.kind === "moon") return "arco";
        if (b.kind === "session") return "sesion";
        if (b.kind === "neutral") return "neutro";
        return "evento";
    }
    function deletableIds() {
        return [...(st.selection || [])].filter((id) => {
            const b = bodies[id];
            return b && b.id !== "sol" && b.id !== "draft" && editable(b);
        });
    }
    function confirmDelete(id) {
        if (id === "sol" || !bodies[id]) return;
        const b = bodies[id];
        const kind = kindOf(b);
        const msg = b.kind === "session"
            ? `¿Borrar «${b.name}» del Lore? Si había un acta anexada, se suelta y el recap se queda en la mesa.`
            : `¿Borrar «${b.name}»? Los enlaces de este cuerpo se quitan.`;
        askConfirm(msg, () => run(async () => {
            await actions.remove(kind, id);
            delete st.pos[id];
            if (st.selection?.has(id)) {
                st.selection.delete(id);
                if (st.selected === id) st.selected = st.selection.size === 1 ? [...st.selection][0] : null;
            }
            if (st.form?.id === id) st.form = null;
            render();
        }));
    }
    function confirmDeleteMany() {
        const ids = deletableIds();
        if (!ids.length) return;
        const sessions = ids.filter((id) => bodies[id]?.kind === "session").length;
        const n = ids.length;
        const msg = sessions === n
            ? `¿Borrar ${n} sesiones del Lore? Las actas anexadas se sueltan.`
            : `¿Borrar ${n} entidades? Los enlaces de estos cuerpos se quitan.`;
        askConfirm(msg, () => run(async () => {
            for (const id of ids) {
                const b = bodies[id];
                if (!b) continue;
                await actions.remove(kindOf(b), id);
                delete st.pos[id];
                st.selection?.delete(id);
                if (st.form?.id === id) st.form = null;
            }
            if (st.selected && !st.selection?.has(st.selected)) {
                st.selected = st.selection?.size === 1 ? [...st.selection][0] : null;
            }
            render();
        }));
    }
    function freeNear(x, y) {
        let p = snap(x, y);
        const used = new Set(Object.values(bodies).map((b) => `${b.x},${b.y}`));
        let n = 0;
        let col = 0;
        while (used.has(`${p.x},${p.y}`) && n < 64) {
            p = { x: p.x + GRID, y: p.y };
            col += 1;
            if (col >= 8) { col = 0; p = { x: snap(x, y).x, y: p.y + GRID }; }
            n += 1;
        }
        return p;
    }
    function beginCreate(kind, _target, at, prefill) {
        const p = freeNear(at.x, at.y);
        const fields = { title: "", summary: "", precision: "year", start: "", end: "", ...(prefill || {}) };
        st.form = { mode: "create", kind, fields, x: p.x, y: p.y };
        markMany(["draft"], "draft");
        st.enterId = "draft";
        render();
    }

    /* ── context menu ── */

    function openMenuAt(clientX, clientY, wx, wy, id, mode) {
        st.menu = { mode: mode || (id ? "node" : "place"), id: id || "", x: clientX, y: clientY, wx, wy };
        paintMenu();
    }
    function closeMenu(opts) {
        const menu = st.menu;
        st.menu = null;
        if (ui?.menu) { ui.menu.hidden = true; ui.menu.replaceChildren(); }
        if (menu?.mode === "link" && st.wire?.toId && !opts?.keepWire) cancelWire();
    }
    function placeMenu(menu) {
        menu.hidden = false;
        menu.style.left = `${st.menu.x}px`;
        menu.style.top = `${st.menu.y}px`;
        const r = menu.getBoundingClientRect();
        if (r.right > window.innerWidth - 8) menu.style.left = `${Math.max(8, st.menu.x - r.width)}px`;
        if (r.bottom > window.innerHeight - 8) menu.style.top = `${Math.max(8, st.menu.y - r.height)}px`;
    }
    function menuButton(item) {
        const btn = button([item.danger ? "danger" : "", item.on ? "on" : ""].filter(Boolean).join(" "), item.icon ? null : item.label);
        if (item.icon) btn.append(item.icon, el("span", "", item.label));
        btn.dataset.act = item.act;
        btn.setAttribute("role", "menuitem");
        if (item.disabled) {
            btn.disabled = true;
            if (item.title) btn.title = item.title;
        }
        return btn;
    }
    function paintMenu() {
        const menu = ui.menu;
        menu.replaceChildren();
        const items = [];
        if (st.menu?.mode === "link") {
            const sources = wireSources();
            const to = bodies[st.wire?.toId];
            [["sigue", "Posterior"], ["paralelo", "Paralelo"], ["agrupa", "Agrupar"]].forEach(([act, label]) => {
                const why = linkWhy(sources, to, act);
                items.push({ act, label, disabled: !!why, title: why, on: st.wire?.kind === act });
            });
            items.push({ sep: true });
            items.push({ act: "cancel", label: "Cancelar" });
        } else if (st.menu?.mode === "multi") {
            items.push({ act: "cluster", label: "Agrupar entre sí" });
            items.push({ act: "bundle", label: "Enlazar en grupo" });
            if (deletableIds().length) {
                items.push({ sep: true });
                items.push({ act: "del-all", label: "Eliminar todo", danger: true, icon: trashSvg() });
            }
        } else if (st.menu?.mode === "node") {
            const target = st.menu.id ? bodies[st.menu.id] : null;
            if (target && target.id !== "draft") items.push({ act: "wire", label: "Enlazar" });
            if (target && editable(target) && target.id !== "sol") {
                items.push({ act: "del", label: "Borrar" });
            }
        } else {
            items.push({ act: "crear", label: "Crear entidad" });
            if (actions.saveSession || actions.placeSession) items.push({ act: "sesion", label: "Sesión" });
        }
        items.forEach((item) => {
            if (item.sep) { menu.appendChild(el("div", "sep")); return; }
            menu.appendChild(menuButton(item));
        });
        placeMenu(menu);
    }
    function runMenu(act) {
        const menu = st.menu;
        if (!menu || !canEdit()) { closeMenu(); return; }
        if (menu.mode === "link") {
            closeMenu({ keepWire: true });
            const target = bodies[st.wire?.toId];
            const sources = wireSources();
            if (act === "cancel" || !target || !sources.length) { cancelWire(); return; }
            const legal = sources.filter((from) => kindLegal(from, target, act));
            if (!legal.length) { cancelWire(); return; }
            st.wire.kind = act;
            st.wire.fromIds = legal.map((body) => body.id);
            confirmWire(target);
            return;
        }
        closeMenu();
        const target = menu.id ? bodies[menu.id] : null;
        if (act === "edit" && target) { beginEdit(target.id); return; }
        if (act === "del" && target) { confirmDelete(target.id); return; }
        if (act === "wire" && target && target.id !== "draft") { beginWire([target.id]); return; }
        if (act === "cluster") { groupAmong(); return; }
        if (act === "bundle") { beginWire([...st.selection]); return; }
        if (act === "del-all") { confirmDeleteMany(); return; }
        if (act === "crear") { run(() => createNeutral({ x: menu.wx, y: menu.wy }, { mode: "edit" })); return; }
        if (act === "sesion") beginCreate("sesion", target, { x: menu.wx, y: menu.wy });
    }

    /* ── selection and gestures ── */

    function markMany(ids, primary) {
        const set = new Set((ids || []).filter(Boolean));
        st.selection = set;
        st.selected = primary && set.has(primary) ? primary : (set.size === 1 ? [...set][0] : null);
    }
    function select(id, opts) {
        if (opts?.travel) st.cameFrom = opts.origin || null;
        else st.cameFrom = null;
        st.typeOpen = false;
        st.paintOpen = false;
        const form = st.form;
        const leavingCreate = form?.mode === "create" && id !== "draft" && !(form.kind === "sesion" && id === form.hostId);
        const leavingEdit = form?.mode === "edit" && id !== form.id;
        const drop = (leavingCreate || leavingEdit) && !opts?.keepForm;
        if (drop) {
            dropDraft();
            st.form = null;
        }
        if (opts?.add && id) {
            const next = new Set(drop ? [] : st.selection);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            markMany([...next], next.has(id) ? id : null);
        } else {
            markMany(id ? [id] : [], id || null);
        }
        if (drop) { render(); return; }
        applyAlphas();
        renderDossier();
        if (id && st.selection.size === 1 && ui) {
            const node = ui.panel.querySelector(`[data-node="${CSS.escape(id)}"]`);
            node?.scrollIntoView({ block: "nearest" });
        }
    }
    function onKey(ev) {
        if (ev.key !== "Escape" || !host.isConnected) return;
        if (document.querySelector("[data-archive-confirm]")) return;
        if (pointer?.mode === "marquee") {
            pointer = null;
            unbindBodyDrag();
            hideMarquee();
            viewport?.plugins.resume("drag");
            viewport?.plugins.resume("decelerate");
            if (viewport) viewport.cursor = "grab";
            ev.stopPropagation();
            ev.preventDefault();
            return;
        }
        if (st.wire) { cancelWire(); ev.stopPropagation(); ev.preventDefault(); return; }
        if (st.menu) { closeMenu(); ev.stopPropagation(); ev.preventDefault(); return; }
        if (st.form || st.selection?.size) {
            select(null);
            ev.stopPropagation();
            ev.preventDefault();
        }
    }
    function clientToWorld(clientX, clientY) {
        const rect = pixiApp.canvas.getBoundingClientRect();
        const p = viewport.toWorld(clientX - rect.left, clientY - rect.top);
        return { x: p.x, y: p.y };
    }
    function pickAt(wx, wy) {
        const body = hitBody(wx, wy);
        if (!body) return null;
        if ((body.kind === "asteroid" || body.kind === "child") && sessionsFor(body.id).length) {
            const ang = (body.labelAng ?? 0) + Math.PI;
            const sx = body.x + Math.cos(ang) * (body.r + 14);
            const sy = body.y + Math.sin(ang) * (body.r + 14);
            if ((wx - sx) ** 2 + (wy - sy) ** 2 <= 16 * 16) return { id: body.id, session: true };
        }
        return body;
    }
    function bindBodyDrag() {
        window.addEventListener("pointermove", onBodyDragMove);
        window.addEventListener("pointerup", onBodyDragUp);
        window.addEventListener("pointercancel", onBodyDragUp);
    }
    function unbindBodyDrag() {
        window.removeEventListener("pointermove", onBodyDragMove);
        window.removeEventListener("pointerup", onBodyDragUp);
        window.removeEventListener("pointercancel", onBodyDragUp);
    }
    let wirePath = null;
    function clearWirePath() {
        wirePath?.g?.remove();
        wirePath = null;
    }
    function kindLegal(from, to, kind) {
        return !kindBlock(from, to, kind);
    }
    function kindBlock(from, to, kind) {
        if (!from || !to || from.id === to.id) return "Ese enlace no une dos nodos.";
        if (kind === "agrupa" && !canGroup(typeOf(from), typeOf(to))) return "Ese par no se puede agrupar.";
        if (kind !== "paralelo" && wouldCycle(data.links || [], kind, from.id, to.id)) return "Ese enlace cerraría un ciclo.";
        return "";
    }
    function cancelWire() {
        const locked = !!st.wire?.toId;
        st.wire = null;
        window.removeEventListener("pointermove", onWireMove);
        if (ui?.wire) { ui.wire.hidden = true; ui.wire.replaceChildren(); }
        clearWirePath();
        if (viewport && pointer?.mode !== "right" && pointer?.mode !== "drag" && pointer?.mode !== "marquee") viewport.cursor = "grab";
        if (locked && st.menu?.mode === "link") closeMenu({ keepWire: true });
    }
    function beginWire(ids) {
        closeMenu();
        const fromIds = [...new Set((ids || []).filter((id) => bodies[id] && id !== "draft"))];
        if (!fromIds.length) return;
        const first = bodies[fromIds[0]];
        st.wire = { fromIds, toId: "", kind: "sigue", hoverId: "", x: first.x, y: first.y };
        if (viewport) viewport.cursor = "crosshair";
        window.addEventListener("pointermove", onWireMove);
        paintWire();
    }
    function wireSources() {
        return (st.wire?.fromIds || []).map((id) => bodies[id]).filter(Boolean);
    }
    function nearBody(wx, wy, skip) {
        let best = null;
        let bestD = Infinity;
        for (const b of Object.values(bodies)) {
            if (!b || skip.has(b.id) || b.id === "draft") continue;
            const reach = (b.selectR || b.r || 10) + 28;
            const d = Math.hypot(b.x - wx, b.y - wy);
            if (d <= reach && d < bestD) { best = b; bestD = d; }
        }
        return best;
    }
    function onWireMove(ev) {
        if (!st.wire || st.wire.toId || !viewport) return;
        const w = clientToWorld(ev.clientX, ev.clientY);
        const skip = new Set(st.wire.fromIds || []);
        const near = nearBody(w.x, w.y, skip);
        st.wire.x = w.x;
        st.wire.y = w.y;
        st.wire.hoverId = near ? near.id : "";
        if (viewport) viewport.cursor = near ? "pointer" : "crosshair";
        paintWire();
    }
    function paintStroke(node, sty, glow) {
        node.setAttribute("stroke", sty.color);
        node.setAttribute("stroke-width", glow ? (sty.width || 1.2) + 3.2 : (sty.width || 1.2));
        const opacity = sty.opacity == null ? 1 : sty.opacity;
        node.setAttribute("stroke-opacity", String(glow ? 0.2 * opacity : opacity));
        if (sty.dash) node.setAttribute("stroke-dasharray", sty.dash);
        else node.removeAttribute("stroke-dasharray");
    }
    function paintWire() {
        const wire = st.wire;
        const sources = wireSources();
        if (!wire || !sources.length || !ui) { clearWirePath(); return; }
        const target = wire.toId ? bodies[wire.toId] : null;
        const kind = wire.kind || "sigue";
        const sty = target ? styleOf({ kind }) : styleOf({});
        clearWirePath();
        const g = svgEl("g", {}, ui.linkLayer);
        wirePath = { g };
        const tip = target || { x: wire.x ?? sources[0].x, y: wire.y ?? sources[0].y, r: 8 };
        sources.forEach((from) => {
            const ends = linkPorts(from, tip);
            const ports = kind === "paralelo" && target ? twinPorts(ends, 2.6) : [ends];
            ports.forEach((portsRow) => {
                const drawn = drawHudPath(g, curvePath(portsRow), sty);
                paintStroke(drawn.path, sty, false);
                paintStroke(drawn.glow, sty, true);
            });
            if (kind === "sigue" && target) {
                svgEl("polygon", {
                    points: arrowPoints(-ends.tx2, -ends.ty2, ends.x2, ends.y2),
                    fill: sty.color,
                }, g);
            }
        });
        if (!target) {
            const ghost = svgEl("g", { transform: `translate(${tip.x} ${tip.y})` }, g);
            drawNeutralGraphic(ghost);
            const aim = wire.hoverId ? bodies[wire.hoverId] : null;
            if (aim) {
                svgEl("circle", {
                    cx: aim.x, cy: aim.y,
                    r: (aim.selectR || aim.r || 12) + 8,
                    fill: "none", stroke: "#ffffff", "stroke-width": 1,
                    "stroke-dasharray": "3 4", "stroke-opacity": "0.9",
                    "vector-effect": "non-scaling-stroke",
                }, g);
            }
        }
    }
    function lockWire(target) {
        const sources = wireSources().filter((from) => from.id !== target?.id);
        if (!st.wire || !sources.length || !target) return;
        st.wire.fromIds = sources.map((body) => body.id);
        st.wire.toId = target.id;
        st.wire.hoverId = "";
        st.wire.kind = ["sigue", "paralelo", "agrupa"].find((kind) => sources.some((from) => kindLegal(from, target, kind))) || "sigue";
        st.wire.pendingMenu = true;
        paintWire();
    }
    function linkWhy(sources, to, kind) {
        if (!sources.length || !to) return "Ese enlace no une dos nodos.";
        if (sources.some((from) => !kindBlock(from, to, kind))) return "";
        return kindBlock(sources[0], to, kind);
    }
    function groupAmong() {
        const ids = [...(st.selection || [])].filter((id) => bodies[id] && id !== "draft");
        const rows = [];
        let links = data.links || [];
        let skipped = 0;
        const tryPair = (parent, child) => {
            const next = {
                kind: "agrupa", fromType: typeOf(parent), fromId: parent.id, toType: typeOf(child), toId: child.id,
            };
            const result = upsertLink(links, next);
            return result.ok ? { next, links: result.links } : null;
        };
        for (let i = 0; i < ids.length; i += 1) {
            for (let j = i + 1; j < ids.length; j += 1) {
                const a = bodies[ids[i]];
                const b = bodies[ids[j]];
                const dir = groupDirection(typeOf(a), typeOf(b));
                const from = dir === "ab" ? a : dir === "ba" ? b : null;
                const to = from && from.id === a.id ? b : a;
                if (!from) { skipped += 1; continue; }
                let placed = tryPair(from, to);
                if (!placed && typeOf(a) === typeOf(b)) placed = tryPair(to, from);
                if (!placed) { skipped += 1; continue; }
                links = placed.links;
                rows.push(placed.next);
            }
        }
        if (!rows.length) { toast("Esos nodos no se pueden agrupar entre sí."); return; }
        run(async () => {
            const result = await actions.saveLinks(rows);
            const done = result?.saved?.length ?? rows.length;
            const skip = (result?.skipped?.length || 0) + skipped;
            if (skip) toast(`Se agruparon ${done}. Se omitieron ${skip}.`);
        });
    }
    async function createNeutral(at, arm) {
        if (!actions.saveNeutral) { toast("Aquí no se puede crear una entidad."); return; }
        const p = freeNear(at.x, at.y);
        const id = await actions.saveNeutral(null, {
            title: "Sin título", summary: "", layoutX: p.x, layoutY: p.y,
        });
        st.pos[id] = { x: p.x, y: p.y, labelAng: Math.PI / 2 };
        st.enterId = id;
        st.arm = { ...(arm || { mode: "edit" }), id };
        markMany([id], id);
    }
    function confirmWire(target) {
        const wire = st.wire;
        const sources = wireSources();
        if (!wire || !sources.length || !target) return;
        const rows = sources.map((from) => ({
            kind: wire.kind,
            fromType: typeOf(from),
            fromId: from.id,
            toType: typeOf(target),
            toId: target.id,
        }));
        cancelWire();
        run(async () => {
            const result = actions.saveLinks
                ? await actions.saveLinks(rows)
                : { saved: rows, skipped: [] };
            if (!actions.saveLinks) {
                for (const row of rows) await actions.saveLink(row);
            }
            if (!result?.saved?.length && result?.skipped?.length) { toast(result.skipped[0].reason); return; }
            if (result?.skipped?.length) toast(`Se enlazaron ${result.saved.length}. Se omitieron ${result.skipped.length}.`);
        });
    }
    function hideMarquee() {
        ui?.marquee?.setAttribute("display", "none");
    }
    function paintMarquee() {
        const g = ui?.marquee;
        if (!g || pointer?.mode !== "marquee") return;
        const x = Math.min(pointer.x, pointer.cx);
        const y = Math.min(pointer.y, pointer.cy);
        const w = Math.abs(pointer.cx - pointer.x);
        const h = Math.abs(pointer.cy - pointer.y);
        g.removeAttribute("display");
        g.querySelectorAll("rect").forEach((rect) => {
            rect.setAttribute("x", x);
            rect.setAttribute("y", y);
            rect.setAttribute("width", String(Math.max(w, 0.5)));
            rect.setAttribute("height", String(Math.max(h, 0.5)));
        });
    }
    function commitSelection(ids, primary) {
        if (st.form) {
            dropDraft();
            st.form = null;
            markMany(ids, primary);
            render();
            return;
        }
        markMany(ids, primary);
        applyAlphas();
        renderDossier();
    }
    function seatBody(b, x, y) {
        const p = snap(x, y);
        b.x = p.x;
        b.y = p.y;
        const seat = { x: p.x, y: p.y, labelAng: b.labelAng };
        if (b.id === "sol") st.pos.sol = seat;
        else st.pos[b.id] = seat;
        if (b.id === "draft" && st.form) { st.form.x = p.x; st.form.y = p.y; return; }
        persistLayout(b.id);
    }
    function finishMarquee() {
        const p = pointer;
        pointer = null;
        unbindBodyDrag();
        hideMarquee();
        viewport?.plugins.resume("drag");
        viewport?.plugins.resume("decelerate");
        if (viewport) viewport.cursor = "grab";
        if (!p || !viewport) return;
        const scale = viewport.scale?.x || 1;
        const x1 = Math.min(p.x, p.cx);
        const y1 = Math.min(p.y, p.cy);
        const x2 = Math.max(p.x, p.cx);
        const y2 = Math.max(p.y, p.cy);
        if ((x2 - x1) * scale < 6 && (y2 - y1) * scale < 6) {
            if (!p.shift) select(null);
            return;
        }
        const hits = Object.values(bodies)
            .filter((b) => b.id !== "draft" && b.x >= x1 && b.x <= x2 && b.y >= y1 && b.y <= y2)
            .map((b) => b.id);
        if (p.shift) {
            const set = new Set(st.selection);
            hits.forEach((id) => set.add(id));
            commitSelection([...set], set.size === 1 ? [...set][0] : null);
            return;
        }
        commitSelection(hits, hits.length === 1 ? hits[0] : null);
    }
    function onHitDown(ev) {
        if (!viewport || (ev.button != null && ev.button !== 0)) return;
        const native = ev.nativeEvent;
        const top = native && Number.isFinite(native.clientX)
            ? document.elementFromPoint(native.clientX, native.clientY)
            : null;
        if (top?.closest?.(".solar-dossier, .solar-menu, .solar-panel, .tl-tools, .paint-pop, .tool-pop")) return;
        const wpt = viewport.toWorld(ev.global);
        const picked = pickAt(wpt.x, wpt.y);
        const body = picked && !picked.session ? bodies[picked.id] : null;
        if (st.wire && !st.wire.toId) {
            ev.stopPropagation();
            const skip = new Set(st.wire.fromIds || []);
            const near = nearBody(wpt.x, wpt.y, skip);
            if (near) {
                lockWire(near);
                if (st.wire?.toId) {
                    st.wire.pendingMenu = false;
                    const pt = screenPoint(ev);
                    st.menu = { mode: "link", id: "", x: pt.x, y: pt.y, wx: wpt.x, wy: wpt.y };
                    paintMenu();
                }
            } else {
                const pt = screenPoint(ev);
                run(() => createNeutral({ x: wpt.x, y: wpt.y }, { mode: "wire", x: pt.x, y: pt.y }));
            }
            return;
        }
        if (st.wire?.toId) {
            ev.stopPropagation();
            cancelWire();
            return;
        }
        ev.stopPropagation();
        viewport.plugins.pause("drag");
        viewport.plugins.pause("decelerate");
        if (!body) {
            pointer = { mode: "marquee", x: wpt.x, y: wpt.y, cx: wpt.x, cy: wpt.y, shift: !!ev.shiftKey };
            viewport.cursor = "crosshair";
            bindBodyDrag();
            return;
        }
        if (ev.shiftKey) {
            select(body.id, { add: true });
            viewport.plugins.resume("drag");
            viewport.plugins.resume("decelerate");
            return;
        }
        if (!(st.selection?.has(body.id) && st.selection.size > 1)) select(body.id, { keep: true });
        const live = bodies[body.id];
        if (!live || !canEdit() || live.readOnly || busy) {
            viewport.plugins.resume("drag");
            viewport.plugins.resume("decelerate");
            return;
        }
        const ids = st.selection?.has(live.id) && st.selection.size > 1 ? [...st.selection] : [live.id];
        const members = ids.map((id) => bodies[id]).filter((b) => b && !b.readOnly).map((b) => ({ id: b.id, x: b.x, y: b.y }));
        pointer = { mode: "drag", members, x: wpt.x, y: wpt.y, moved: false };
        viewport.cursor = "grabbing";
        bindBodyDrag();
    }
    function onBodyDragMove(ev) {
        if (!pointer || !viewport) return;
        const w = clientToWorld(ev.clientX, ev.clientY);
        if (pointer.mode === "marquee") {
            pointer.cx = w.x;
            pointer.cy = w.y;
            paintMarquee();
            return;
        }
        if (pointer.mode !== "drag") return;
        if (Math.hypot(w.x - pointer.x, w.y - pointer.y) > 2) pointer.moved = true;
        const dx = w.x - pointer.x;
        const dy = w.y - pointer.y;
        pointer.members.forEach((m) => {
            const b = bodies[m.id];
            if (!b) return;
            b.x = m.x + dx;
            b.y = m.y + dy;
        });
        syncBodies();
        links.forEach(updateLink);
    }
    function onBodyDragUp(ev) {
        if (!pointer) return;
        if (pointer.mode === "marquee") { finishMarquee(); return; }
        if (pointer.mode !== "drag") return;
        if (pointer.moved && viewport) {
            const w = clientToWorld(ev.clientX, ev.clientY);
            const dx = w.x - pointer.x;
            const dy = w.y - pointer.y;
            pointer.members.forEach((m) => {
                const b = bodies[m.id];
                if (b) seatBody(b, m.x + dx, m.y + dy);
            });
            updateAll();
        }
        pointer = null;
        unbindBodyDrag();
        viewport?.plugins.resume("drag");
        viewport?.plugins.resume("decelerate");
        if (viewport) viewport.cursor = st.wire ? "crosshair" : "grab";
    }
    function screenPoint(ev) {
        const native = ev.nativeEvent || ev;
        if (Number.isFinite(native.clientX)) return { x: native.clientX, y: native.clientY };
        const rect = pixiApp.canvas.getBoundingClientRect();
        return { x: rect.left + (ev.global?.x || 0), y: rect.top + (ev.global?.y || 0) };
    }
    function onStageUp(ev) {
        if ((ev.button == null || ev.button === 0) && st.wire?.pendingMenu) {
            const wire = st.wire;
            wire.pendingMenu = false;
            window.removeEventListener("pointermove", onWireMove);
            const pt = screenPoint(ev);
            setTimeout(() => {
                if (destroyed || st.wire !== wire || !wire.toId) return;
                st.menu = { mode: "link", x: pt.x, y: pt.y, wx: 0, wy: 0 };
                paintMenu();
            }, 0);
        }
        onPanUp(ev);
    }
    function onPanDown(ev) {
        if (!viewport || ev.button !== 2 || pointer?.mode === "drag" || pointer?.mode === "marquee") return;
        const wpt = viewport.toWorld(ev.global);
        const picked = pickAt(wpt.x, wpt.y);
        pointer = {
            mode: "right", gx: ev.global.x, gy: ev.global.y, wx: wpt.x, wy: wpt.y,
            id: picked && !picked.session ? picked.id : "",
        };
        viewport.cursor = "grabbing";
    }
    function onPanUp(ev) {
        if (!pointer || pointer.mode !== "right") return;
        const moved = Math.hypot((ev.global?.x ?? pointer.gx) - pointer.gx, (ev.global?.y ?? pointer.gy) - pointer.gy) > 6;
        const info = pointer;
        pointer = null;
        if (viewport) viewport.cursor = "grab";
        if (moved || !canEdit()) return;
        if (st.wire) cancelWire();
        const body = info.id ? bodies[info.id] : null;
        const pt = screenPoint(ev);
        const many = (st.selection?.size || 0) > 1;
        if (many) openMenuAt(pt.x, pt.y, info.wx, info.wy, "", "multi");
        else if (body && body.id !== "draft") openMenuAt(pt.x, pt.y, info.wx, info.wy, body.id, "node");
        else openMenuAt(pt.x, pt.y, info.wx, info.wy, "", "place");
    }

    /* ── motion: intro draw, redraw, reorder ── */

    function setPattern(link) {
        const dash = link.dash || "none";
        (link.rails || []).forEach((rail) => {
            rail.path.style.strokeDasharray = dash;
            rail.glow.style.strokeDasharray = dash;
            rail.path.style.strokeDashoffset = "0";
            rail.glow.style.strokeDashoffset = "0";
        });
    }
    function pop(id) {
        const b = bodies[id];
        if (!b?.scaler) return;
        const t0 = performance.now();
        if (b.flash) b.flash.setAttribute("opacity", "0.9");
        const step = (now) => {
            const t = Math.min(1, (now - t0) / 180);
            b.scaler.setAttribute("transform", `scale(${1 - (1 - t) ** 3})`);
            if (t < 1) requestAnimationFrame(step);
            else if (b.flash) b.flash.setAttribute("opacity", "0");
        };
        requestAnimationFrame(step);
    }
    function revealBody(id) {
        if (seen.has(id) || !bodies[id]) return;
        seen.add(id);
        pop(id);
        links.filter((link) => link.from === id).forEach((link, index) => {
            flying.push(wait(index * 36).then(() => drawOne(link, 220)));
        });
    }
    function dashIn(link, dur) {
        const rails = link.rails || [];
        const len = Math.max(1, rails[0]?.path.getTotalLength() || 1);
        rails.forEach((rail) => {
            rail.path.style.strokeDasharray = `${len}`;
            rail.glow.style.strokeDasharray = `${len}`;
        });
        const t0 = performance.now();
        return new Promise((resolve) => {
            const step = (now) => {
                const t = Math.min(1, (now - t0) / dur);
                const off = String(len * (1 - (1 - (1 - t) ** 3)));
                rails.forEach((rail) => {
                    rail.path.style.strokeDashoffset = off;
                    rail.glow.style.strokeDashoffset = off;
                });
                if (t < 1) requestAnimationFrame(step);
                else resolve();
            };
            requestAnimationFrame(step);
        });
    }
    async function drawOne(link, dur) {
        if (!link || link.done) return;
        link.done = true;
        revealBody(link.from);
        await dashIn(link, dur);
        setPattern(link);
        link.travelers.setAttribute("opacity", "1");
        revealBody(link.to);
    }
    function prepareDraw() {
        seen.clear();
        flying = [];
        links.forEach((link) => {
            link.done = false;
            const len = Math.max(1, link.rails?.[0]?.path.getTotalLength() || 1);
            (link.rails || []).forEach((rail) => {
                rail.path.style.strokeDasharray = `${len}`;
                rail.glow.style.strokeDasharray = `${len}`;
                rail.path.style.strokeDashoffset = `${len}`;
                rail.glow.style.strokeDashoffset = `${len}`;
            });
            link.travelers.setAttribute("opacity", "0");
        });
        Object.values(bodies).forEach((b) => b.scaler.setAttribute("transform", "scale(0)"));
    }
    function settle() {
        seen.clear();
        Object.values(bodies).forEach((b) => { seen.add(b.id); b.scaler.setAttribute("transform", "scale(1)"); });
        links.forEach((link) => { link.done = true; setPattern(link); link.travelers.setAttribute("opacity", "1"); });
    }
    async function playDraw() {
        const token = gen;
        busy = true;
        try {
            prepareDraw();
            revealBody("sol");
            const chain = links.slice();
            const dur = Math.max(70, Math.round(600 / Math.max(1, chain.length)));
            for (const link of chain) {
                if (token !== gen) return;
                await drawOne(link, dur);
            }
            Object.keys(bodies).forEach((id) => { if (!seen.has(id)) revealBody(id); });
            while (flying.length) {
                if (token !== gen) return;
                await Promise.all(flying.splice(0, flying.length));
            }
        } finally {
            if (token === gen) { busy = false; applyAlphas(); }
        }
    }
    function collect() {
        const items = links.map((link) => ({ link, len: Math.max(1, link.rails?.[0]?.path.getTotalLength() || 1) }));
        const t0 = performance.now();
        return new Promise((resolve) => {
            const step = (now) => {
                const t = Math.min(1, (now - t0) / 350);
                const e = t * t;
                items.forEach(({ link, len }) => {
                    (link.rails || []).forEach((rail) => {
                        rail.path.style.strokeDasharray = `${len}`;
                        rail.glow.style.strokeDasharray = `${len}`;
                        rail.path.style.strokeDashoffset = String(len * e);
                        rail.glow.style.strokeDashoffset = String(len * e);
                    });
                });
                Object.values(bodies).forEach((b) => b.scaler.setAttribute("transform", `scale(${1 - e})`));
                links.forEach((link) => link.travelers.setAttribute("opacity", String(1 - e)));
                if (t < 1) requestAnimationFrame(step);
                else resolve();
            };
            requestAnimationFrame(step);
        });
    }
    async function redraw() {
        if (busy) return;
        busy = true;
        try { await collect(); await playDraw(); } finally { busy = false; }
    }
    function enterBody(id) {
        const b = bodies[id];
        if (!b) return;
        b.scaler.setAttribute("transform", "scale(0)");
        pop(id);
        links.filter((link) => link.from === id || link.to === id).forEach((link) => {
            link.done = false;
            dashIn(link, 420).then(() => { setPattern(link); link.travelers.setAttribute("opacity", "1"); link.done = true; });
        });
    }

    function render() {
        if (destroyed) return;
        if (!canEdit() && st.form) {
            dropDraft();
            st.form = null;
            if (st.selected === "draft") markMany([], null);
        }
        if (!ui) mount();
        /* A body just created may arrive in a later snapshot: keep its selection and entry until then. */
        const enter = st.enterId || "";
        const intro = !st.didIntro && active;
        if (!st.didIntro) rebuild();
        else reconcile();
        if (st.pendingSelect && bodies[st.pendingSelect]) {
            markMany([st.pendingSelect], st.pendingSelect);
            st.pendingSelect = "";
        }
        if (st.selection) {
            [...st.selection].forEach((id) => {
                if (!bodies[id] && id !== enter && id !== st.pendingSelect) st.selection.delete(id);
            });
            if (st.selected && !st.selection.has(st.selected)) {
                st.selected = st.pendingSelect || (st.selection.size === 1 ? [...st.selection][0] : null);
            }
        }
        if (intro) {
            st.didIntro = true;
            st.enterId = "";
            frameIds(Object.keys(bodies), false);
            requestAnimationFrame(() => {
                if (!destroyed) frameIds(Object.keys(bodies), false);
            });
            playDraw();
        } else {
            busy = false;
            settle();
            applyAlphas();
            if (enter && bodies[enter]) { enterBody(enter); st.enterId = ""; }
        }
        if (st.arm && bodies[st.arm.id]) {
            const arm = st.arm;
            st.arm = null;
            markMany([arm.id], arm.id);
            if (arm.mode === "wire" && st.wire) {
                lockWire(bodies[arm.id]);
                if (st.wire?.toId) {
                    st.wire.pendingMenu = false;
                    st.menu = { mode: "link", id: "", x: arm.x || 0, y: arm.y || 0, wx: 0, wy: 0 };
                    paintMenu();
                }
            }
        }
        renderDossier();
        publishChrome();
    }

    return {
        /** New data from the adapter. A new `scopeKey` (another Lore or mesa) resets the view. */
        update(nextData, nextActions) {
            data = nextData;
            actions = nextActions || {};
            eventById = new Map(data.events.map((e) => [e.id, e]));
            eraById = new Map(data.eras.map((e) => [e.id, e]));
            arcById = new Map(data.arcs.map((a) => [a.id, a]));
            neutralById = new Map((data.neutrals || []).map((n) => [n.id, n]));
            if (holdRender) { renderQueued = true; return; }
            if (data.scopeKey !== st.scopeKey) {
                cancelWire();
                st = freshState(data.scopeKey);
                closeMenu();
                paintMem.clear();
                swap = null;
                linkSig = "";
                panelSig = "";
            }
            if (st.form?.mode === "edit" && st.form.kind !== "sun") {
                const id = st.form.id;
                const alive = eraById.has(id) || arcById.has(id) || eventById.has(id) || neutralById.has(id)
                    || (data.sessions || []).some((s) => s.id === id);
                if (!alive) st.form = null;
            }
            render();
        },
        /** The solar view is shown (true) or the calendar covers it (false). The dossier stays usable. */
        setActive(next) {
            active = !!next;
            if (!ui) return;
            closeMenu();
            if (active) {
                requestAnimationFrame(() => {
                    if (!ui || destroyed) return;
                    if (!st.didIntro) { render(); return; }
                    fitRatio();
                    if (st.selected && bodies[st.selected]) frameIds([st.selected], true);
                });
            }
        },
        /** Calendar click: a create form already filled with that day. Nothing is saved until «Guardar». */
        suggest(prefill) {
            if (!canEdit() || !ui) return;
            const sol = st.pos.sol || SUN_HOME;
            beginCreate("evento", null, { x: sol.x + 160, y: sol.y + 220 }, prefill);
        },
        /** Empty solar: create a neutral, or a Lore session, beside the sun. */
        startBlank(kind) {
            if (!canEdit() || !ui) return;
            const sol = st.pos.sol || SUN_HOME;
            const at = { x: sol.x + 240, y: sol.y + 80 };
            if (kind === "sesion") beginCreate("sesion", null, at);
            else run(() => createNeutral(at, { mode: "edit" }));
        },
        select(id) {
            if (!ui || !bodies[id]) return;
            select(id, { keep: true });
            if (active) frameIds([id], true);
        },
        redraw() { redraw(); },
        setFilter(name) { setFilter(name); },
        toggleKind(kind) { toggleKind(kind); },
        setQuery(value) { setQuery(value); },
        toggleSearch() { toggleSearch(); },
        togglePanel() { togglePanel(); },
        focusEra(id) { focusEra(id); },
        destroy() {
            destroyed = true;
            gen += 1;
            cancelWire();
            document.removeEventListener("keydown", onKey, true);
            document.removeEventListener("pointerdown", onDocPointerDown, true);
            unbindBodyDrag();
            resizeObs?.disconnect();
            try { viewport?.destroy(); } catch { /* teardown order */ }
            viewport = null;
            try { pixiApp?.destroy(true); } catch { /* teardown order */ }
            pixiApp = null;
            host.replaceChildren();
            ui = null;
        },
    };
}