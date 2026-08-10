/**
 * Packet Cascade — live Evento Narrativo loading animation on the Circuit map.
 * Packets travel manhattan traces wave-by-wave; loops until stop().
 */

import { manhattanPath } from "../../../utils/circuitLayout.js";

const HUB_HIT_MS = 380;
const PACKET_MS = 480;
const WAVE_GAP_MS = 220;
const LOOP_PAUSE_MS = 520;

/**
 * Sample points along a manhattan V-then-H path between two world positions.
 * @param {{ x: number, y: number }} from
 * @param {{ x: number, y: number }} to
 * @param {number} [steps]
 */
export function sampleManhattanPoints(from, to, steps = 28) {
    const x0 = from.x;
    const y0 = from.y;
    const x1 = to.x;
    const y1 = to.y;
    const mid = { x: x0, y: y1 };
    const pts = [];
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        if (Math.abs(x1 - x0) < 8) {
            pts.push({ x: x0, y: y0 + (y1 - y0) * t });
        } else if (Math.abs(y1 - y0) < 8) {
            pts.push({ x: x0 + (x1 - x0) * t, y: y0 });
        } else if (t < 0.5) {
            const u = t / 0.5;
            pts.push({ x: x0 + (mid.x - x0) * u, y: y0 + (mid.y - y0) * u });
        } else {
            const u = (t - 0.5) / 0.5;
            pts.push({ x: mid.x + (x1 - mid.x) * u, y: mid.y + (y1 - mid.y) * u });
        }
    }
    return pts;
}

function toneForTrace(traceClass) {
    if (traceClass === "hot") return "hot";
    if (traceClass === "warn") return "warn";
    if (traceClass === "ok") return "ok";
    return "";
}

function wait(ms, signal) {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(new DOMException("Aborted", "AbortError"));
            return;
        }
        const t = window.setTimeout(resolve, ms);
        const onAbort = () => {
            window.clearTimeout(t);
            reject(new DOMException("Aborted", "AbortError"));
        };
        signal?.addEventListener("abort", onAbort, { once: true });
    });
}

/**
 * Resolve layout node for an entity id (or layout node id).
 * @param {Map<string, object>} nodesById
 * @param {string} entityOrNodeId
 */
function resolveNode(nodesById, entityOrNodeId) {
    if (!entityOrNodeId) return null;
    const direct = nodesById.get(entityOrNodeId);
    if (direct) return direct;
    for (const n of nodesById.values()) {
        if (n.entityId === entityOrNodeId || n.id === entityOrNodeId) return n;
    }
    return null;
}

/**
 * @param {{
 *   shellEl: HTMLElement,
 *   worldEl: HTMLElement,
 *   svgEl: SVGElement|null,
 *   nodesById: Map<string, object>,
 *   layoutEdges: Array<{ fromId: string, toId: string, traceClass?: string }>,
 *   waves: Array<{ nodeIds?: string[], edges?: Array<{ fromId: string, toId: string }> }>,
 *   signal: AbortSignal,
 * }} opts
 */
export async function runCircuitPacketCascadeLoop(opts) {
    const {
        shellEl,
        worldEl,
        svgEl,
        nodesById,
        layoutEdges = [],
        waves = [],
        signal,
    } = opts;
    if (!shellEl || !worldEl || !waves?.length) return;

    const layer = document.createElement("div");
    layer.className = "ckt-pkt-layer";
    worldEl.appendChild(layer);

    shellEl.classList.add("ckt-cascade-live", "wave-live");

    const nodeEls = () => [...worldEl.querySelectorAll(".ckt-node[data-ckt-eid]")];
    const findNodeEl = (entityId) => {
        const n = resolveNode(nodesById, entityId);
        if (!n) return null;
        const eid = String(n.entityId || n.id);
        const nid = String(n.id);
        return (
            worldEl.querySelector(`.ckt-node[data-ckt-eid="${eid.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`)
            || worldEl.querySelector(`.ckt-node[data-ckt-nid="${nid.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`)
        );
    };

    const setDim = (el, on) => {
        if (!el) return;
        el.dataset.cktDim = on ? "1" : "0";
        el.classList.toggle("dim", on);
    };
    const setLit = (el, on) => {
        if (!el) return;
        el.dataset.cktLit = on ? "1" : "0";
        el.classList.toggle("ckt-pkt-lit", on);
    };
    const flashHit = (entityId) => {
        const el = findNodeEl(entityId);
        if (!el) return;
        setDim(el, false);
        setLit(el, true);
        el.dataset.cktHit = "1";
        el.classList.remove("ckt-pkt-hit");
        void el.offsetWidth;
        el.classList.add("ckt-pkt-hit");
        window.setTimeout(() => {
            if (el.dataset.cktHit === "1") {
                el.dataset.cktHit = "0";
                el.classList.remove("ckt-pkt-hit");
            }
        }, 520);
    };

    const layoutEdgeTone = new Map();
    for (const e of layoutEdges) {
        layoutEdgeTone.set(`${e.fromId}|${e.toId}`, e.traceClass || "idle");
        const from = nodesById.get(e.fromId);
        const to = nodesById.get(e.toId);
        if (from?.entityId && to?.entityId) {
            layoutEdgeTone.set(`${from.entityId}|${to.entityId}`, e.traceClass || "idle");
        }
    }

    const armTrace = (fromId, toId, on) => {
        if (!svgEl) return;
        const from = resolveNode(nodesById, fromId);
        const to = resolveNode(nodesById, toId);
        if (!from || !to) return;
        const d = manhattanPath(from, to);
        for (const path of svgEl.querySelectorAll("path.trace")) {
            if (path.getAttribute("d") === d) {
                path.classList.toggle("ckt-armed", on);
            }
        }
    };

    const clearVisuals = () => {
        layer.replaceChildren();
        for (const el of nodeEls()) {
            el.dataset.cktDim = "0";
            el.dataset.cktLit = "0";
            el.dataset.cktHit = "0";
            el.classList.remove("dim", "ckt-pkt-hit", "ckt-pkt-lit");
        }
        svgEl?.querySelectorAll("path.trace.ckt-armed").forEach((p) => p.classList.remove("ckt-armed"));
    };

    const animatePacket = (fromId, toId, tone) => new Promise((resolve, reject) => {
        if (signal.aborted) {
            reject(new DOMException("Aborted", "AbortError"));
            return;
        }
        const from = resolveNode(nodesById, fromId);
        const to = resolveNode(nodesById, toId);
        if (!from || !to) {
            resolve();
            return;
        }
        const pts = sampleManhattanPoints(from, to);
        const pkt = document.createElement("div");
        pkt.className = `ckt-pkt${tone ? ` ${tone}` : ""}`;
        layer.appendChild(pkt);
        armTrace(fromId, toId, true);

        const t0 = performance.now();
        const tick = (now) => {
            if (signal.aborted) {
                pkt.remove();
                reject(new DOMException("Aborted", "AbortError"));
                return;
            }
            const u = Math.min(1, (now - t0) / PACKET_MS);
            const i = Math.min(pts.length - 1, Math.floor(u * (pts.length - 1)));
            const p = pts[i];
            pkt.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) translate(-50%, -50%)`;
            pkt.style.opacity = "1";
            if (u < 1) {
                requestAnimationFrame(tick);
            } else {
                pkt.remove();
                flashHit(toId);
                resolve();
            }
        };
        requestAnimationFrame(tick);
    });

    const edgesForWave = (wave, waveIndex) => {
        if (wave?.edges?.length) return wave.edges;
        // Fallback: layout edges into this wave's nodes from previously lit set
        const targets = new Set(wave?.nodeIds || []);
        const prevLit = new Set();
        for (let i = 0; i < waveIndex; i++) {
            for (const id of waves[i]?.nodeIds || []) prevLit.add(id);
        }
        const out = [];
        for (const e of layoutEdges) {
            const to = nodesById.get(e.toId);
            const toEid = to?.entityId || e.toId;
            const from = nodesById.get(e.fromId);
            const fromEid = from?.entityId || e.fromId;
            if (targets.has(toEid) && (prevLit.has(fromEid) || waveIndex === 1)) {
                out.push({ fromId: fromEid, toId: toEid });
            }
        }
        return out;
    };

    try {
        while (!signal.aborted) {
            clearVisuals();
            // Dim everyone except hub until lit
            const hubId = waves[0]?.nodeIds?.[0];
            for (const el of nodeEls()) {
                const eid = el.getAttribute("data-ckt-eid");
                setDim(el, Boolean(eid && eid !== hubId));
            }
            if (hubId) flashHit(hubId);
            await wait(HUB_HIT_MS, signal);

            for (let wi = 1; wi < waves.length; wi++) {
                const wave = waves[wi];
                const edges = edgesForWave(wave, wi);
                await Promise.all(edges.map((e) => {
                    const key = `${e.fromId}|${e.toId}`;
                    const tc = layoutEdgeTone.get(key) || "";
                    return animatePacket(e.fromId, e.toId, toneForTrace(tc)).catch((err) => {
                        if (err?.name === "AbortError") throw err;
                    });
                }));
                // Ensure all wave nodes lit even if edge missing
                for (const id of wave?.nodeIds || []) flashHit(id);
                await wait(WAVE_GAP_MS, signal);
            }

            await wait(LOOP_PAUSE_MS, signal);
        }
    } catch (err) {
        if (err?.name !== "AbortError") throw err;
    } finally {
        clearVisuals();
        layer.remove();
        shellEl.classList.remove("ckt-cascade-live", "wave-live");
    }
}
