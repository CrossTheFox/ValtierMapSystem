/**
 * Pixi v8 Neural Mesh scene — graph + Reticle Ping / Bracket Frame / Neon Trail.
 * Optional pixi-viewport camera (see neuralMeshConfig.NEURAL_MESH_CAMERA_MODE).
 */
import * as PIXI from "pixi.js";
import { Viewport } from "pixi-viewport";
import { UI_COLORS } from "../../../../constants/uiColors";
import { isRectNodeShape, isViewportCamera, NEURAL_MESH_WORLD } from "./neuralMeshConfig";
import { ancestorsOf } from "./neuralMeshLayout";

const PINK = Number.parseInt(UI_COLORS.accent.replace("#", ""), 16);
const PINK_HOT = Number.parseInt(UI_COLORS.accentStrong.replace("#", ""), 16);
const CYAN = Number.parseInt(UI_COLORS.anomaly.replace("#", ""), 16);
const BG = 0x07070e;
const MUTED = 0x3a3a4a;
/** Kind palette — bright when unlocked, dimmed otherwise */
const COL = {
    class: PINK,
    trait: 0x7dd3fc,
    ability: PINK,
    talent: 0xc084fc,
    mastery: PINK_HOT,
    limitbreak: 0xff3355,
    ultimate: 0xff2244,
};
const FILL_DARK = 0x0a0a12;
const MAX_DPR = 1.5;

function hexNum(css, fallback) {
    if (!css || typeof css !== "string") return fallback;
    const h = css.replace("#", "");
    const n = Number.parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
    return Number.isFinite(n) ? n : fallback;
}

function kindHue(kind, accent) {
    if (kind === "class") return hexNum(accent, COL.class);
    return COL[kind] || PINK;
}

/** Stroke/fill intensity by unlock state */
function stateBright(state) {
    if (state === "unlocked") return { strokeA: 1, fillA: 0.92, labelA: 1, dim: false };
    if (state === "available" || state === "unowned") return { strokeA: 0.55, fillA: 0.55, labelA: 0.75, dim: true };
    if (state === "xor-out") return { strokeA: 0.28, fillA: 0.35, labelA: 0.4, dim: true };
    return { strokeA: 0.22, fillA: 0.3, labelA: 0.35, dim: true };
}

function isHotKind(kind) {
    return kind === "limitbreak" || kind === "ultimate";
}

function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

function stroke(g, width, color, alpha = 1) {
    g.setStrokeStyle({
        width: Math.max(0.75, width),
        color,
        alpha: Math.max(0, Math.min(1, alpha)),
        cap: "round",
        join: "round",
    });
}

function fill(g, color, alpha = 1) {
    g.setFillStyle({ color, alpha: Math.max(0, Math.min(1, alpha)) });
}

/**
 * @param {HTMLElement} container
 * @param {{ onNodeClick?: (node: object) => void, onCameraChange?: () => void }} handlers
 */
export function createNeuralMeshScene(container, handlers = {}) {
    /** @type {PIXI.Application | null} */
    let app = null;
    let destroyed = false;
    /** @type {Viewport | null} */
    let viewport = null;
    const useViewport = isViewportCamera();
    /** @type {ReturnType<typeof buildLayers> | null} */
    let layers = null;
    /** @type {Map<string, { node: object, container: PIXI.Container, shape: PIXI.Graphics, brackets: PIXI.Graphics, orbit?: PIXI.Container, glow?: PIXI.Graphics, label?: PIXI.Text }>} */
    const nodeViews = new Map();
    /** @type {Array<{ from: string, to: string, g: PIXI.Graphics, color: number, width: number }>} */
    let edgeViews = [];
    /** @type {object | null} */
    let graph = null;
    let selectedId = null;
    let animToken = 0;
    /** Bumps on every select/clear — aborts in-flight neon trails (prevents stuck trails). */
    let trailGen = 0;
    let selectGen = 0;
    let bracketTicker = null;
    let orbitTicker = null;
    let pulseTicker = null;
    /** @type {Set<() => void>} */
    const pingTicks = new Set();
    /** @type {Map<string, ReturnType<typeof setTimeout>>} */
    const litTimers = new Map();

    function graphRoot() {
        return viewport || app?.stage || null;
    }

    function emitCameraChange() {
        handlers.onCameraChange?.();
    }

    function buildLayers() {
        const guides = new PIXI.Graphics();
        const edges = new PIXI.Container();
        // Trail UNDER nodes (mock: insertBefore first .node)
        const trail = new PIXI.Container();
        const nodes = new PIXI.Container();
        const fx = new PIXI.Container();
        const root = graphRoot();
        root?.addChild(guides, edges, trail, nodes, fx);
        return { guides, edges, trail, nodes, fx };
    }

    function syncScreen() {
        if (!app || !container) return;
        const cw = container.clientWidth || 0;
        const ch = container.clientHeight || 0;
        if (cw > 0 && ch > 0) {
            if (Math.abs(app.screen.width - cw) > 0.5 || Math.abs(app.screen.height - ch) > 0.5) {
                app.renderer.resize(cw, ch);
            }
        }
        if (viewport) {
            viewport.resize(app.screen.width, app.screen.height);
        }
    }

    /** Fit circular mesh into the stage (viewport camera only). */
    function fitGraph({ animate = false } = {}) {
        if (!viewport || !graph) return;
        const R = graph.R || NEURAL_MESH_WORLD.R;
        const pad = Math.max(64, R * 0.22);
        const span = (R + pad) * 2;
        if (animate && typeof viewport.animate === "function") {
            try {
                viewport.plugins.remove("animate");
            } catch {
                /* ignore */
            }
            viewport.animate({
                time: 420,
                ease: "easeInOutSine",
                position: { x: graph.cx, y: graph.cy },
                scale: Math.min(
                    viewport.screenWidth / span,
                    viewport.screenHeight / span
                ),
            });
        } else {
            viewport.fit(true, span, span);
            viewport.moveCenter(graph.cx, graph.cy);
        }
        emitCameraChange();
    }

    function worldToScreen(wx, wy) {
        if (!viewport) return { x: wx, y: wy };
        const p = viewport.toScreen(wx, wy);
        return { x: p.x, y: p.y };
    }

    function recenter(opts = {}) {
        fitGraph({ animate: opts.animate !== false });
    }

    function destroyDisplayChildren(container) {
        if (!container) return;
        const kids = [...container.children];
        container.removeChildren();
        kids.forEach((c) => {
            try {
                c.destroy({ children: true });
            } catch {
                /* ignore */
            }
        });
        container.alpha = 1;
    }

    function wipeTrail() {
        trailGen += 1;
        destroyDisplayChildren(layers?.trail);
        litTimers.forEach((t) => clearTimeout(t));
        litTimers.clear();
        nodeViews.forEach((v) => {
            v.container.scale.set(1);
            drawNodeShape(v.shape, v.node);
            v.shape.tint = 0xffffff;
        });
    }

    function wipePings() {
        pingTicks.forEach((tick) => {
            try {
                app?.ticker?.remove(tick);
            } catch {
                /* ignore */
            }
        });
        pingTicks.clear();
        destroyDisplayChildren(layers?.fx);
    }

    async function init() {
        if (app || !container) return;
        app = new PIXI.Application();
        await app.init({
            resizeTo: container,
            background: BG,
            backgroundAlpha: 0, // let CSS stage grid / vignette show through (mockup)
            antialias: true,
            autoDensity: true,
            resolution: Math.min(window.devicePixelRatio || 1, MAX_DPR),
        });
        if (destroyed) {
            app.destroy(true);
            app = null;
            return;
        }
        container.appendChild(app.canvas);
        app.canvas.style.display = "block";
        app.canvas.style.width = "100%";
        app.canvas.style.height = "100%";
        app.canvas.style.touchAction = "none";

        if (useViewport) {
            if (!("events" in app.renderer)) {
                app.renderer.addSystem(PIXI.EventSystem, "events");
            }
            const world = NEURAL_MESH_WORLD.size;
            viewport = new Viewport({
                screenWidth: app.screen.width,
                screenHeight: app.screen.height,
                worldWidth: world,
                worldHeight: world,
                ticker: app.ticker,
                events: app.renderer.events,
            });
            viewport
                .drag({ mouseButtons: "left", pressDrag: true })
                .pinch()
                .wheel({ smooth: 4, percent: 0.12 })
                .decelerate({ friction: 0.9 })
                .clampZoom({ minScale: 0.32, maxScale: 2.6 })
                .clamp({ direction: "all", underflow: "center" });
            viewport.eventMode = "static";
            viewport.cursor = "grab";
            app.stage.addChild(viewport);
            viewport.on("moved", emitCameraChange);
            viewport.on("zoomed", emitCameraChange);
            syncScreen();
        }

        layers = buildLayers();
    }

    function clearGraph() {
        clearSelectionFx();
        stopAmbientTickers();
        wipeTrail();
        wipePings();
        destroyDisplayChildren(layers?.edges);
        destroyDisplayChildren(layers?.nodes);
        layers?.guides.clear();
        nodeViews.clear();
        edgeViews = [];
    }

    function drawGuides(cx, cy, Rx, Ry) {
        const g = layers.guides;
        g.clear();
        const rx = Rx || Ry || 200;
        const ry = Ry || Rx || 200;
        const circular = Math.abs(rx - ry) < 0.5;
        [0.34, 0.62, 0.84, 0.98].forEach((f, i) => {
            stroke(g, 1, i === 1 ? CYAN : PINK, i === 1 ? 0.12 : 0.07);
            if (circular) g.circle(cx, cy, rx * f);
            else g.ellipse(cx, cy, rx * f, ry * f);
            g.stroke();
        });
    }

    function stopAmbientTickers() {
        if (orbitTicker && app) {
            app.ticker.remove(orbitTicker);
            orbitTicker = null;
        }
        if (pulseTicker && app) {
            app.ticker.remove(pulseTicker);
            pulseTicker = null;
        }
    }

    function startAmbientTickers() {
        stopAmbientTickers();
        if (!app) return;
        orbitTicker = () => {
            nodeViews.forEach((v) => {
                if (v.node.kind !== "class" || !v.orbit) return;
                v.orbit.rotation += 0.012;
                // Breath on class core ring
                const breath = 0.5 + 0.5 * Math.sin(performance.now() / 700);
                if (v.glow) {
                    v.glow.alpha = 0.25 + breath * 0.55;
                    v.glow.scale.set(1 + breath * 0.06);
                }
            });
        };
        pulseTicker = () => {
            const t = performance.now() / 550;
            nodeViews.forEach((v) => {
                if (!isHotKind(v.node.kind) || v.node.state !== "unlocked" || !v.glow) return;
                const breath = 0.5 + 0.5 * Math.sin(t + (v.node.id.length % 5));
                v.glow.alpha = 0.35 + breath * 0.55;
                v.glow.scale.set(1 + breath * 0.08);
            });
        };
        app.ticker.add(orbitTicker);
        app.ticker.add(pulseTicker);
    }

    function edgePath(from, to, cx, cy) {
        const mx = (from.x + to.x) / 2;
        const my = (from.y + to.y) / 2;
        const qx = mx * 0.72 + cx * 0.28;
        const qy = my * 0.72 + cy * 0.28;
        return { from, to, qx, qy };
    }

    function drawEdgeGraphics(eg, meta, alpha = 1) {
        const { from, to, qx, qy } = meta;
        eg.clear();
        stroke(eg, meta.width, meta.color, alpha);
        eg.moveTo(from.x, from.y);
        eg.quadraticCurveTo(qx, qy, to.x, to.y);
        eg.stroke();
    }

    function drawRoundedPlate(g, nw, nh, hue, bright, opts = {}) {
        const { thick = 1.6, radius = 4, fillCol = FILL_DARK } = opts;
        const hw = nw / 2;
        const hh = nh / 2;
        fill(g, fillCol, bright.fillA);
        g.roundRect(-hw, -hh, nw, nh, radius);
        g.fill();
        stroke(g, thick, hue, bright.strokeA);
        g.roundRect(-hw, -hh, nw, nh, radius);
        g.stroke();
    }

    function drawCirclePlate(g, r, hue, bright, opts = {}) {
        const { thick = 1.6, fillCol = FILL_DARK } = opts;
        fill(g, fillCol, bright.fillA);
        g.circle(0, 0, r);
        g.fill();
        stroke(g, thick, hue, bright.strokeA);
        g.circle(0, 0, r);
        g.stroke();
    }

    function drawNodeShape(g, n) {
        g.clear();
        const hue = kindHue(n.kind, n.accent);
        const bright = stateBright(n.state);
        const nw = n.nw || n.r * 2.2;
        const nh = n.nh || n.r * 1.4;

        if (n.kind === "class") {
            // Dark core + dual ring for contrast (Orbit Lock lives in separate layers)
            const accent = hue;
            fill(g, FILL_DARK, 0.96);
            g.circle(0, 0, n.r * 0.72);
            g.fill();
            stroke(g, 2.6, CYAN, 0.95);
            g.circle(0, 0, n.r * 0.72);
            g.stroke();
            stroke(g, 1.4, accent, 0.85);
            g.circle(0, 0, n.r * 0.88);
            g.stroke();
            return;
        }

        const hot = isHotKind(n.kind);
        const fillCol = hot ? 0x14060a : n.kind === "trait" ? 0x061018 : FILL_DARK;
        const thick = hot ? 2.2 : n.kind === "ability" ? 1.8 : 1.5;
        if (isRectNodeShape()) {
            drawRoundedPlate(g, nw, nh, hue, bright, {
                thick,
                radius: n.kind === "mastery" || n.kind === "talent" ? 3 : 5,
                fillCol,
            });
            return;
        }
        drawCirclePlate(g, n.r || Math.min(nw, nh) / 2, hue, bright, { thick, fillCol });
    }

    function drawNodeGlow(g, n, pulse = 0.7) {
        g.clear();
        if (n.kind === "class") {
            const accent = kindHue("class", n.accent);
            stroke(g, 3.5, accent, 0.35 + pulse * 0.35);
            g.circle(0, 0, n.r * 0.95);
            g.stroke();
            stroke(g, 2, CYAN, 0.2 + pulse * 0.25);
            g.circle(0, 0, n.r * 1.08);
            g.stroke();
            return;
        }
        if (!isHotKind(n.kind) || n.state !== "unlocked") return;
        const hue = kindHue(n.kind, n.accent);
        if (isRectNodeShape()) {
            const nw = (n.nw || 40) + 10;
            const nh = (n.nh || 24) + 8;
            stroke(g, 3.2, hue, 0.25 + pulse * 0.45);
            g.roundRect(-nw / 2, -nh / 2, nw, nh, 6);
            g.stroke();
            return;
        }
        const rad = (n.r || 20) + 6;
        stroke(g, 3.2, hue, 0.25 + pulse * 0.45);
        g.circle(0, 0, rad);
        g.stroke();
    }

    /** Orbit Lock — permanent class-node FX (dashed ring + pink satellite). */
    function buildOrbitLock(r) {
        const orbit = new PIXI.Container();
        const ring = new PIXI.Graphics();
        // Dashed circumference via short arcs
        const rad = r * 1.22;
        const segs = 28;
        for (let i = 0; i < segs; i++) {
            if (i % 2 === 0) continue;
            const a0 = (i / segs) * Math.PI * 2;
            const a1 = ((i + 0.85) / segs) * Math.PI * 2;
            stroke(ring, 1.15, CYAN, 0.55);
            ring.arc(0, 0, rad, a0, a1);
            ring.stroke();
        }
        const dot = new PIXI.Graphics();
        fill(dot, PINK, 1);
        dot.circle(0, -rad, 3.2);
        dot.fill();
        stroke(dot, 1, CYAN, 0.9);
        dot.circle(0, -rad, 3.2);
        dot.stroke();
        orbit.addChild(ring, dot);
        orbit.eventMode = "none";
        return orbit;
    }

    function drawBrackets(g, n, pulse = 0.7) {
        g.clear();
        const hw = (n.nw || n.r * 2) / 2 + 8;
        const hh = (n.nh || n.r * 2) / 2 + 8;
        const arm = Math.max(7, Math.min(hw, hh) * 0.35);
        const corners = [
            { x: -hw, y: -hh, dx: arm, dy: arm, color: CYAN },
            { x: hw, y: -hh, dx: -arm, dy: arm, color: PINK },
            { x: -hw, y: hh, dx: arm, dy: -arm, color: CYAN },
            { x: hw, y: hh, dx: -arm, dy: -arm, color: PINK },
        ];
        corners.forEach((c, i) => {
            const a = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(pulse * Math.PI * 2 + i * 0.7));
            stroke(g, 1.9, c.color, a);
            g.moveTo(c.x + c.dx, c.y);
            g.lineTo(c.x, c.y);
            g.lineTo(c.x, c.y + c.dy);
            g.stroke();
        });
    }

    function makeLabel(n) {
        const circle = !isRectNodeShape() && n.kind !== "class";
        const maxW = circle
            ? Math.max(28, (n.r || 20) * 1.55)
            : Math.max(40, (n.nw || 60) - 10);
        const fontSize =
            n.kind === "class"
                ? 9
                : n.kind === "limitbreak" || n.kind === "ultimate"
                  ? circle
                      ? 7
                      : 8
                  : circle
                    ? 6.5
                    : 7.5;
        const t = new PIXI.Text({
            text: n.label,
            style: {
                fontFamily: "Orbitron, sans-serif",
                fontSize,
                fill: 0xffffff,
                letterSpacing: 0.35,
                align: "center",
                wordWrap: n.kind !== "class",
                wordWrapWidth: maxW,
                breakWords: true,
            },
        });
        t.anchor.set(0.5);
        // Dim only locked/xor; keep available readable
        t.alpha =
            n.state === "locked" || n.state === "xor-out"
                ? 0.45
                : n.state === "available" || n.state === "unowned"
                  ? 0.88
                  : 1;
        t.eventMode = "none";
        return t;
    }

    /**
     * @param {object} graphData
     * @param {{ animate?: boolean }} [opts]
     */
    async function setGraph(graphData, opts = {}) {
        if (!app || !layers) return;
        const animate = opts.animate !== false;
        const token = ++animToken;

        if (graph && animate && nodeViews.size) {
            // collapse
            const start = performance.now();
            await new Promise((resolve) => {
                const tick = (now) => {
                    if (token !== animToken) return resolve();
                    const t = Math.min(1, (now - start) / 380);
                    const u = easeInOut(t);
                    nodeViews.forEach((v) => {
                        v.container.alpha = 1 - u;
                        v.container.scale.set(1 - 0.85 * u);
                    });
                    edgeViews.forEach((e) => {
                        e.g.alpha = 1 - u;
                    });
                    if (t < 1) requestAnimationFrame(tick);
                    else resolve();
                };
                requestAnimationFrame(tick);
            });
        }

        if (token !== animToken) return;
        clearGraph();
        graph = graphData;
        if (!graph?.nodes?.length) return;

        if (useViewport) syncScreen();
        drawGuides(graph.cx, graph.cy, graph.Rx || graph.R, graph.Ry || graph.R);
        const byId = Object.fromEntries(graph.nodes.map((n) => [n.id, n]));

        graph.edges.forEach((e) => {
            const from = byId[e.from];
            const to = byId[e.to];
            if (!from || !to) return;
            const owned =
                from.state === "unlocked" && (to.state === "unlocked" || to.state === "available" || to.state === "unowned");
            const hot = isHotKind(from.kind) || isHotKind(to.kind);
            const color = hot ? COL.limitbreak : owned ? kindHue(to.kind, to.accent) : 0x888899;
            const width = hot ? 1.8 : 1.2;
            const alpha = hot ? (owned ? 0.5 : 0.18) : owned ? 0.42 : 0.12;
            const g = new PIXI.Graphics();
            const meta = { ...edgePath(from, to, graph.cx, graph.cy), width, color, alpha };
            drawEdgeGraphics(g, { ...meta, from, to }, animate ? 0 : alpha);
            layers.edges.addChild(g);
            edgeViews.push({ from: e.from, to: e.to, g, color, width, baseAlpha: alpha, meta: { from, to, qx: meta.qx, qy: meta.qy, width, color } });
        });

        graph.nodes.forEach((n) => {
            const c = new PIXI.Container();
            c.x = n.x;
            c.y = n.y;
            c.eventMode = "static";
            c.cursor = "pointer";
            const hw = (n.nw || n.r * 2) / 2 + 10;
            const hh = (n.nh || n.r * 2) / 2 + 10;
            c.hitArea =
                n.kind === "class" || !isRectNodeShape()
                    ? new PIXI.Circle(0, 0, (n.r || Math.min(hw, hh)) + 14)
                    : new PIXI.Rectangle(-hw, -hh, hw * 2, hh * 2);

            const brackets = new PIXI.Graphics();
            brackets.visible = false;
            const glow = new PIXI.Graphics();
            glow.eventMode = "none";
            const shape = new PIXI.Graphics();
            drawNodeShape(shape, n);
            drawNodeGlow(glow, n, 0.6);
            if (!isHotKind(n.kind) && n.kind !== "class") glow.visible = false;
            if (isHotKind(n.kind) && n.state !== "unlocked") glow.visible = false;

            let orbit = null;
            if (n.kind === "class") {
                orbit = buildOrbitLock(n.r);
            }

            const label = makeLabel(n);

            // Order: glow → orbit → shape → brackets → label
            if (glow) c.addChild(glow);
            if (orbit) c.addChild(orbit);
            c.addChild(shape, brackets, label);
            c.on("pointertap", (ev) => {
                ev.stopPropagation();
                handlers.onNodeClick?.(n);
            });

            if (animate) {
                c.alpha = 0;
                c.scale.set(0.2);
            }
            layers.nodes.addChild(c);
            nodeViews.set(n.id, { node: n, container: c, shape, brackets, label, orbit, glow });
        });

        startAmbientTickers();

        if (useViewport) {
            // Snap camera to full circumference before intro animation
            fitGraph({ animate: false });
        }

        if (animate) {
            const start = performance.now();
            const list = [...nodeViews.values()];
            await new Promise((resolve) => {
                const tick = (now) => {
                    if (token !== animToken) return resolve();
                    const t = Math.min(1, (now - start) / 650);
                    list.forEach((v, i) => {
                        const local = Math.min(1, Math.max(0, (t * 1.2 - i * 0.02) / 0.55));
                        const u = easeInOut(local);
                        const baseA =
                            v.node.state === "locked" || v.node.state === "xor-out" ? 0.55 : 1;
                        v.container.alpha = baseA * u;
                        v.container.scale.set(0.2 + 0.8 * u);
                    });
                    edgeViews.forEach((e, i) => {
                        const local = Math.min(1, Math.max(0, (t * 1.15 - i * 0.012) / 0.5));
                        e.g.alpha = e.baseAlpha * easeInOut(local);
                        if (local > 0) drawEdgeGraphics(e.g, e.meta, e.g.alpha);
                    });
                    if (t < 1) requestAnimationFrame(tick);
                    else resolve();
                };
                requestAnimationFrame(tick);
            });
        }
    }

    function clearSelectionFx() {
        selectedId = null;
        selectGen += 1;
        if (bracketTicker && app) {
            app.ticker.remove(bracketTicker);
            bracketTicker = null;
        }
        nodeViews.forEach((v) => {
            v.brackets.visible = false;
            v.brackets.clear();
            const dim = v.node.state === "locked" || v.node.state === "xor-out";
            v.container.alpha = dim ? 0.55 : 1;
            v.container.scale.set(1);
        });
        edgeViews.forEach((e) => {
            drawEdgeGraphics(e.g, e.meta, e.baseAlpha);
        });
        wipeTrail();
        wipePings();
    }

    function lockBrackets(nodeId) {
        selectedId = nodeId;
        if (bracketTicker && app) app.ticker.remove(bracketTicker);
        let t0 = performance.now();
        bracketTicker = () => {
            const v = nodeViews.get(selectedId);
            if (!v) return;
            const pulse = ((performance.now() - t0) % 1200) / 1200;
            v.brackets.visible = true;
            drawBrackets(v.brackets, v.node, pulse);
        };
        app?.ticker.add(bracketTicker);
        bracketTicker();
    }

    function spawnPing(x, y, r) {
        if (!layers || !app) return;
        const g = new PIXI.Graphics();
        g.x = x;
        g.y = y;
        layers.fx.addChild(g);
        const t0 = performance.now();
        const dur = 1100;
        const tick = () => {
            if (destroyed || !g.parent) {
                app?.ticker?.remove(tick);
                pingTicks.delete(tick);
                return;
            }
            const t = Math.min(1, (performance.now() - t0) / dur);
            g.clear();
            for (let i = 0; i < 3; i++) {
                const local = Math.min(1, Math.max(0, (t - i * 0.15) / 0.7));
                if (local <= 0) continue;
                const scale = 0.35 + local * 1.75;
                const alpha = (1 - local) * 0.85;
                const rad = Math.max(18, r * 1.6) * scale;
                stroke(g, 1.6, i === 1 ? CYAN : PINK, alpha);
                g.circle(0, 0, rad);
                g.stroke();
            }
            const ca = t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75;
            if (ca > 0) {
                stroke(g, 1.4, CYAN, ca);
                g.moveTo(0, -10);
                g.lineTo(0, 10);
                g.moveTo(-10, 0);
                g.lineTo(10, 0);
                g.stroke();
            }
            if (t >= 1) {
                app.ticker.remove(tick);
                pingTicks.delete(tick);
                try {
                    g.destroy();
                } catch {
                    /* ignore */
                }
            }
        };
        pingTicks.add(tick);
        app.ticker.add(tick);
    }

    function pathLengthApprox(pts) {
        let len = 0;
        for (let i = 1; i < pts.length; i++) {
            len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        }
        return Math.max(1, len);
    }

    function sampleChainPath(chain) {
        const byId = Object.fromEntries((graph?.nodes || []).map((n) => [n.id, n]));
        const pts = [];
        for (let i = 0; i < chain.length; i++) {
            const n = byId[chain[i]];
            if (!n) continue;
            if (i === 0) {
                pts.push({ x: n.x, y: n.y, id: n.id });
                continue;
            }
            const prev = byId[chain[i - 1]];
            const mx = (prev.x + n.x) / 2;
            const my = (prev.y + n.y) / 2;
            const qx = mx * 0.72 + graph.cx * 0.28;
            const qy = my * 0.72 + graph.cy * 0.28;
            for (let s = 1; s <= 12; s++) {
                const u = s / 12;
                const x = (1 - u) * (1 - u) * prev.x + 2 * (1 - u) * u * qx + u * u * n.x;
                const y = (1 - u) * (1 - u) * prev.y + 2 * (1 - u) * u * qy + u * u * n.y;
                pts.push({ x, y, id: s === 12 ? n.id : null });
            }
        }
        return pts;
    }

    function pointAtLength(pts, dist) {
        let left = dist;
        for (let i = 1; i < pts.length; i++) {
            const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
            if (left <= seg) {
                const u = seg ? left / seg : 0;
                return {
                    x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * u,
                    y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * u,
                };
            }
            left -= seg;
        }
        return pts[pts.length - 1];
    }

    function lightNodePass(id, gen) {
        const v = nodeViews.get(id);
        if (!v) return;
        const lit = { ...v.node, state: "unlocked" };
        drawNodeShape(v.shape, lit);
        if (v.label) v.label.alpha = 1;
        v.container.scale.set(1.08);
        const prev = litTimers.get(id);
        if (prev) clearTimeout(prev);
        const timer = setTimeout(() => {
            litTimers.delete(id);
            if (gen !== trailGen) return;
            const vv = nodeViews.get(id);
            if (!vv) return;
            drawNodeShape(vv.shape, vv.node);
            if (vv.label) vv.label.alpha = stateBright(vv.node.state).labelA;
            if (selectedId !== id) vv.container.scale.set(1);
        }, 420);
        litTimers.set(id, timer);
    }

    function drawTrailSegment(g, pts, drawn, width, color, alpha) {
        if (!pts.length) return;
        g.clear();
        stroke(g, width, color, alpha);
        g.moveTo(pts[0].x, pts[0].y);
        let acc = 0;
        for (let i = 1; i < pts.length; i++) {
            const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
            if (acc + seg > drawn) {
                const p = pointAtLength(pts, drawn);
                g.lineTo(p.x, p.y);
                break;
            }
            g.lineTo(pts[i].x, pts[i].y);
            acc += seg;
        }
        g.stroke();
    }

    async function neonTrail(chain) {
        if (!layers || !graph || chain.length < 2) return;
        const gen = ++trailGen;
        destroyDisplayChildren(layers.trail);

        const pts = sampleChainPath(chain);
        if (pts.length < 2) return;
        const total = pathLengthApprox(pts);
        const glow = new PIXI.Graphics();
        const core = new PIXI.Graphics();
        const runner = new PIXI.Graphics();
        layers.trail.alpha = 1;
        layers.trail.addChild(glow, core, runner);

        const nodeMarks = chain
            .map((id) => {
                const n = nodeViews.get(id)?.node;
                if (!n) return { id, at: 0 };
                let best = 0;
                let bestD = Infinity;
                for (let i = 0; i <= 80; i++) {
                    const d = (total * i) / 80;
                    const p = pointAtLength(pts, d);
                    const dd = (p.x - n.x) ** 2 + (p.y - n.y) ** 2;
                    if (dd < bestD) {
                        bestD = dd;
                        best = d;
                    }
                }
                return { id, at: best };
            })
            .sort((a, b) => a.at - b.at);

        const onPath = new Set(chain);
        nodeViews.forEach((v, id) => {
            v.container.alpha = onPath.has(id)
                ? v.node.state === "locked" || v.node.state === "xor-out"
                    ? 0.55
                    : 1
                : 0.22;
        });
        edgeViews.forEach((e) => {
            const on = onPath.has(e.from) && onPath.has(e.to);
            if (on) {
                e.g.clear();
                stroke(e.g, 2.2, CYAN, 0.85);
                e.g.moveTo(e.meta.from.x, e.meta.from.y);
                e.g.quadraticCurveTo(e.meta.qx, e.meta.qy, e.meta.to.x, e.meta.to.y);
                e.g.stroke();
            } else {
                drawEdgeGraphics(e.g, e.meta, 0.12);
            }
        });

        let litIdx = 0;
        const dur = Math.min(1100, 380 + chain.length * 160);
        const t0 = performance.now();

        await new Promise((resolve) => {
            const cleanupLocal = () => {
                try {
                    if (glow.parent) layers.trail.removeChild(glow);
                    if (core.parent) layers.trail.removeChild(core);
                    if (runner.parent) layers.trail.removeChild(runner);
                    glow.destroy();
                    core.destroy();
                    runner.destroy();
                } catch {
                    /* ignore */
                }
            };

            const tick = (now) => {
                if (destroyed || gen !== trailGen) {
                    cleanupLocal();
                    return resolve();
                }
                const t = Math.min(1, (now - t0) / dur);
                const u = easeInOut(t);
                const drawn = total * u;

                drawTrailSegment(glow, pts, drawn, 3.4, PINK, 0.6);
                drawTrailSegment(core, pts, drawn, 1.15, 0xffffff, 0.8);

                const tip = pointAtLength(pts, drawn);
                runner.clear();
                fill(runner, PINK_HOT, 0.35 + 0.65 * (1 - t * 0.3));
                runner.circle(tip.x, tip.y, 4.5);
                runner.fill();
                stroke(runner, 1.2, CYAN, 1);
                runner.circle(tip.x, tip.y, 4.5);
                runner.stroke();

                while (litIdx < nodeMarks.length && drawn >= nodeMarks[litIdx].at - 6) {
                    lightNodePass(nodeMarks[litIdx].id, gen);
                    litIdx += 1;
                }

                if (t < 1) {
                    requestAnimationFrame(tick);
                    return;
                }

                // Fade only THIS trail's graphics — never mutate shared trail.alpha after cancel.
                const fade0 = performance.now();
                const fade = (fnow) => {
                    if (destroyed || gen !== trailGen) {
                        cleanupLocal();
                        return resolve();
                    }
                    const ft = Math.min(1, (fnow - fade0) / 450);
                    const a = 1 - ft;
                    glow.alpha = a;
                    core.alpha = a;
                    runner.alpha = a;
                    if (ft < 1) {
                        requestAnimationFrame(fade);
                        return;
                    }
                    if (gen === trailGen) {
                        destroyDisplayChildren(layers.trail);
                    } else {
                        cleanupLocal();
                    }
                    resolve();
                };
                requestAnimationFrame(fade);
            };
            requestAnimationFrame(tick);
        });
    }

    /**
     * Full selection sequence: Ping → Bracket → Neon Trail (center → node).
     * @param {string} nodeId
     */
    async function selectNode(nodeId) {
        if (!graph) return;
        const v = nodeViews.get(nodeId);
        if (!v) return;
        const gen = ++selectGen;
        if (bracketTicker && app) {
            app.ticker.remove(bracketTicker);
            bracketTicker = null;
        }
        wipeTrail();
        wipePings();
        selectedId = null;
        nodeViews.forEach((nv) => {
            nv.brackets.visible = false;
            nv.brackets.clear();
            nv.container.scale.set(1);
        });
        resetPathDim();

        if (gen !== selectGen) return;
        spawnPing(v.node.x, v.node.y, v.node.r);
        lockBrackets(nodeId);

        // Soft camera ease toward the node (keeps selection FX in world space)
        if (viewport && v.node.kind !== "class") {
            try {
                viewport.plugins.remove("animate");
            } catch {
                /* ignore */
            }
            const targetScale = Math.min(2.2, Math.max(viewport.scale.x, 1.05));
            viewport.animate({
                time: 380,
                ease: "easeInOutSine",
                position: { x: v.node.x, y: v.node.y },
                scale: targetScale,
            });
        }

        const chain = ancestorsOf(nodeId, graph.edges);
        if (chain.length >= 2) {
            await neonTrail(chain);
        } else {
            // Still emphasize the lone node briefly
            nodeViews.forEach((nv, id) => {
                nv.container.alpha = id === nodeId ? 1 : 0.28;
            });
        }
        if (gen !== selectGen) return;
    }

    function resetPathDim() {
        nodeViews.forEach((v) => {
            v.container.alpha = v.node.state === "locked" || v.node.state === "xor-out" ? 0.55 : 1;
            if (selectedId !== v.node.id) v.container.scale.set(1);
        });
        edgeViews.forEach((e) => drawEdgeGraphics(e.g, e.meta, e.baseAlpha));
    }

    function deselect() {
        clearSelectionFx();
        resetPathDim();
    }

    function destroy() {
        destroyed = true;
        animToken += 1;
        selectGen += 1;
        trailGen += 1;
        stopAmbientTickers();
        clearSelectionFx();
        if (viewport) {
            try {
                viewport.off("moved", emitCameraChange);
                viewport.off("zoomed", emitCameraChange);
            } catch {
                /* ignore */
            }
            viewport = null;
        }
        if (app) {
            try {
                app.destroy(true);
            } catch {
                /* ignore */
            }
            app = null;
        }
        layers = null;
        graph = null;
        nodeViews.clear();
        edgeViews = [];
    }

    return {
        init,
        setGraph,
        selectNode,
        deselect,
        destroy,
        syncScreen,
        fitGraph,
        recenter,
        worldToScreen,
        get selectedId() {
            return selectedId;
        },
        get usesViewport() {
            return useViewport;
        },
    };
}
