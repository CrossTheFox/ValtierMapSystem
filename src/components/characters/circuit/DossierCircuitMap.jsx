/**
 * Circuit Sync-Axis viewport (Option 8) — pan/zoom, focus, traces, chrome.
 * Pan/travel uses GSAP (same tween engine as Pixi VTT layers) for smooth 60fps.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, CircularProgress, IconButton } from "@mui/material";
import gsap from "gsap";

import { CyberText, CyberTitle } from "../../customs/CustomTexts";
import CyberTooltip from "../../customs/CyberTooltip";
import { UI_COLORS } from "../../../constants/uiColors";
import {
    CIRCUIT_HUB_X,
    CIRCUIT_HUB_Y,
    CIRCUIT_WORLD_H,
    CIRCUIT_WORLD_W,
    manhattanPath,
    syncToY,
} from "../../../utils/circuitLayout";
import { syncMeterPct } from "../../../utils/syncRank";
import { ensureCircuitCss } from "./circuitCss";
import { runCircuitPacketCascadeLoop } from "./circuitPacketCascade";
import { clearCircuitSeals, runCircuitSealGrade } from "./circuitSealGrade";
import CircuitNode from "./CircuitNode.jsx";

const NAR_ACCENT = UI_COLORS.accentStrong;
const GRID_MAJOR = 80;
const GRID_MINOR = 20;
/** pixi-viewport decelerate-like friction per frame (~60fps). */
const PAN_FRICTION = 0.88;
const PAN_STOP_SPEED = 0.35;
/** DM focus travel pan duration (ms) — GSAP power3.out. */
const FOCUS_TRAVEL_MS = 420;
/** Atmosphere gradient only — axis updates every frame with grid/world. */
const ATMOSPHERE_EVERY_N = 4;
const SYNC_TICKS = [
    { sync: 10, label: "+10", cap: "top", capText: "+10 VÍNCULO" },
    { sync: 5, label: "+5" },
    { sync: 0, label: "0", cap: "mid", capText: "0" },
    { sync: -5, label: "−5" },
    { sync: -10, label: "−10", cap: "bot", capText: "−10 HOSTIL" },
];

function clampPct(n) {
    return Math.max(-20, Math.min(120, n));
}

/**
 * @param {{
 *   layout: { nodes: object[], edges: object[], hubId?: string|null },
 *   selectedId?: string|null,
 *   onSelectNode?: (node: object|null) => void,
 *   propagationState?: object|null,
 *   showStructuralBus?: boolean,
 *   recenterKey?: string|null,
 *   graphLoading?: boolean,
 *   canFocusTravel?: boolean,
 *   canToggleStruct?: boolean,
 *   relationMode?: 'affinity'|'structural',
 *   animPhase?: 'out'|'in'|null,
 *   travelTargetId?: string|null,
 *   focusTravelRequest?: { entityId: string, nonce: number }|null,
 *   onFocusTravelComplete?: () => void,
 *   onFocusEntity?: (entityId: string) => void,
 *   onToggleStruct?: () => void,
 *   canDragNodes?: boolean,
 *   onNodePositionPreview?: (entityId: string, pos: { x: number, y: number }) => void,
 *   onNodePositionCommit?: (entityId: string, pos: { x: number, y: number }) => void,
 *   topLeftSlot?: import('react').ReactNode,
 *   topRightSlot?: import('react').ReactNode,
 * }} props
 */
export default function DossierCircuitMap({
    layout,
    selectedId = null,
    onSelectNode,
    propagationState = null,
    showStructuralBus = false,
    recenterKey = null,
    graphLoading = false,
    canFocusTravel = false,
    canToggleStruct = false,
    relationMode = "affinity",
    animPhase = null,
    travelTargetId = null,
    focusTravelRequest = null,
    onFocusTravelComplete,
    onFocusEntity,
    onToggleStruct,
    canDragNodes = false,
    onNodePositionPreview,
    onNodePositionCommit,
    topLeftSlot = null,
    topRightSlot = null,
}) {
    ensureCircuitCss();
    const shellRef = useRef(null);
    const viewportRef = useRef(null);
    const worldRef = useRef(null);
    const gridRef = useRef(null);
    const atmosphereRef = useRef(null);
    const axisRef = useRef(null);
    const inertiaRafRef = useRef(0);
    const travelTweenRef = useRef(null);
    const atmosphereTickRef = useRef(0);
    /** Cached [data-sync] nodes — avoid querySelectorAll every pan frame. */
    const axisMarksRef = useRef(/** @type {HTMLElement[]} */ ([]));
    const travelDoneRef = useRef(onFocusTravelComplete);
    travelDoneRef.current = onFocusTravelComplete;
    const pendingCenterAfterTravelRef = useRef(false);
    const nodeDragRef = useRef(null);
    const [draggingNodeId, setDraggingNodeId] = useState(null);
    const dragPreviewRef = useRef(onNodePositionPreview);
    dragPreviewRef.current = onNodePositionPreview;
    const dragCommitRef = useRef(onNodePositionCommit);
    dragCommitRef.current = onNodePositionCommit;
    const stateRef = useRef({
        x: 0,
        y: 0,
        scale: 0.72,
        dragging: false,
        lastX: 0,
        lastY: 0,
        lastT: 0,
        vx: 0,
        vy: 0,
        moved: false,
        traveling: false,
        nodeDragging: false,
    });

    const nodesById = useMemo(() => {
        const m = new Map();
        for (const n of layout?.nodes || []) m.set(n.id, n);
        return m;
    }, [layout]);

    const selectedNode = selectedId ? nodesById.get(selectedId) : null;
    const hubNode = nodesById.get(layout?.hubId) || layout?.nodes?.find((n) => n.kind === "hub");

    const waveSets = useMemo(() => {
        const w1 = new Set();
        const w2 = new Set();
        if (!propagationState?.waves?.length) return { w1, w2, live: false };
        const waves = propagationState.waves;
        for (const id of waves[0]?.nodeIds || []) w1.add(id);
        for (const id of waves[1]?.nodeIds || []) w2.add(id);
        return { w1, w2, live: propagationState.mode === "live" && propagationState.active };
    }, [propagationState]);

    const refreshAxisMarks = useCallback(() => {
        const axis = axisRef.current;
        axisMarksRef.current = axis
            ? Array.from(axis.querySelectorAll("[data-sync]"))
            : [];
    }, []);

    /** Sync ruler — every frame with grid/world (GPU transform, no layout thrash). */
    const applyAxis = useCallback(() => {
        const st = stateRef.current;
        const viewport = viewportRef.current;
        if (!viewport) return;
        const vh = viewport.clientHeight;
        const pad = 10;
        const marks = axisMarksRef.current;
        for (let i = 0; i < marks.length; i++) {
            const el = marks[i];
            const sync = Number(el.dataset.sync);
            const screenY = syncToY(sync) * st.scale + st.y;
            const off = screenY < pad || screenY > vh - pad;
            if (off) {
                if (!el.classList.contains("is-off")) el.classList.add("is-off");
                continue;
            }
            if (el.classList.contains("is-off")) el.classList.remove("is-off");
            // Mid cap ("0") stays vertically centered on the tick line
            const mid = el.classList.contains("cap") && el.classList.contains("mid");
            el.style.transform = mid
                ? `translate3d(0, ${screenY}px, 0) translateY(-50%)`
                : `translate3d(0, ${screenY}px, 0)`;
        }
    }, []);

    /** Soft glow bands — expensive string rebuild; safe to throttle. */
    const applyAtmosphere = useCallback(() => {
        const st = stateRef.current;
        const viewport = viewportRef.current;
        const atmosphere = atmosphereRef.current;
        if (!atmosphere || !viewport) return;
        const vh = Math.max(1, viewport.clientHeight);
        const y10 = syncToY(10) * st.scale + st.y;
        const y0 = syncToY(0) * st.scale + st.y;
        const yNeg10 = syncToY(-10) * st.scale + st.y;
        const p = (y) => `${clampPct((y / vh) * 100)}%`;
        atmosphere.style.background = [
            "linear-gradient(180deg,",
            `rgba(61,214,140,0.14) ${p(y10 - vh * 0.35)},`,
            `rgba(61,214,140,0.09) ${p(y10)},`,
            `rgba(61,214,140,0.03) ${p((y10 + y0) / 2)},`,
            `transparent ${p(y0 - 24)},`,
            `transparent ${p(y0 + 24)},`,
            `rgba(245,197,66,0.04) ${p((y0 + yNeg10) / 2)},`,
            `rgba(255,51,85,0.09) ${p(yNeg10)},`,
            `rgba(255,51,85,0.13) ${p(yNeg10 + vh * 0.35)})`,
        ].join(" ");
    }, []);

    /**
     * @param {{ atmosphere?: boolean|'throttle' }} [opts]
     *   Axis always updates with world/grid. Atmosphere: true | false | 'throttle'.
     */
    const applyTransform = useCallback((opts = {}) => {
        const { atmosphere = true } = opts;
        const st = stateRef.current;
        const world = worldRef.current;
        if (world) {
            world.style.transform = `translate3d(${st.x}px, ${st.y}px, 0) scale(${st.scale})`;
        }

        const grid = gridRef.current;
        if (grid) {
            const maj = GRID_MAJOR * st.scale;
            const min = GRID_MINOR * st.scale;
            grid.style.backgroundSize = `${maj}px ${maj}px, ${maj}px ${maj}px, ${min}px ${min}px, ${min}px ${min}px`;
            const posX = st.x;
            const posY = st.y;
            grid.style.backgroundPosition = `${posX}px ${posY}px, ${posX}px ${posY}px, ${posX}px ${posY}px, ${posX}px ${posY}px`;
        }

        applyAxis();

        if (atmosphere === false) return;
        if (atmosphere === "throttle") {
            atmosphereTickRef.current = (atmosphereTickRef.current + 1) % ATMOSPHERE_EVERY_N;
            if (atmosphereTickRef.current !== 0) return;
        }
        applyAtmosphere();
    }, [applyAxis, applyAtmosphere]);

    const stopInertia = useCallback(() => {
        if (inertiaRafRef.current) {
            cancelAnimationFrame(inertiaRafRef.current);
            inertiaRafRef.current = 0;
        }
    }, []);

    const stopTravel = useCallback(() => {
        if (travelTweenRef.current) {
            travelTweenRef.current.kill();
            travelTweenRef.current = null;
        }
        stateRef.current.traveling = false;
        viewportRef.current?.classList.remove("ckt-panning");
    }, []);

    const startInertia = useCallback(() => {
        stopInertia();
        const st = stateRef.current;
        viewportRef.current?.classList.add("ckt-panning");
        const tick = () => {
            st.vx *= PAN_FRICTION;
            st.vy *= PAN_FRICTION;
            if (Math.hypot(st.vx, st.vy) < PAN_STOP_SPEED) {
                st.vx = 0;
                st.vy = 0;
                inertiaRafRef.current = 0;
                viewportRef.current?.classList.remove("ckt-panning");
                applyTransform({ atmosphere: true });
                return;
            }
            st.x += st.vx;
            st.y += st.vy;
            applyTransform({ atmosphere: "throttle" });
            inertiaRafRef.current = requestAnimationFrame(tick);
        };
        inertiaRafRef.current = requestAnimationFrame(tick);
    }, [applyTransform, stopInertia]);

    const centerOnHub = useCallback((scale = 0.72) => {
        const viewport = viewportRef.current;
        const st = stateRef.current;
        st.scale = scale;
        const vw = viewport?.clientWidth || 900;
        const vh = viewport?.clientHeight || 560;
        st.x = vw / 2 - CIRCUIT_HUB_X * st.scale;
        st.y = vh / 2 - CIRCUIT_HUB_Y * st.scale;
    }, []);

    const animatePanToWorld = useCallback((wx, wy, durationMs, onDone) => {
        stopInertia();
        stopTravel();
        const st = stateRef.current;
        const viewport = viewportRef.current;
        const vw = viewport?.clientWidth || 900;
        const vh = viewport?.clientHeight || 560;
        const targetX = vw / 2 - wx * st.scale;
        const targetY = vh / 2 - wy * st.scale;
        if (Math.hypot(targetX - st.x, targetY - st.y) < 1.5) {
            st.x = targetX;
            st.y = targetY;
            applyTransform({ atmosphere: true });
            onDone?.();
            return;
        }
        st.traveling = true;
        st.vx = 0;
        st.vy = 0;
        viewport?.classList.add("ckt-panning");
        const proxy = { x: st.x, y: st.y };
        travelTweenRef.current = gsap.to(proxy, {
            x: targetX,
            y: targetY,
            duration: Math.max(0.12, durationMs / 1000),
            ease: "power3.out",
            overwrite: true,
            onUpdate: () => {
                st.x = proxy.x;
                st.y = proxy.y;
                applyTransform({ atmosphere: "throttle" });
            },
            onComplete: () => {
                travelTweenRef.current = null;
                st.traveling = false;
                st.x = targetX;
                st.y = targetY;
                viewport?.classList.remove("ckt-panning");
                applyTransform({ atmosphere: true });
                onDone?.();
            },
        });
    }, [applyTransform, stopInertia, stopTravel]);

    const zoomAt = useCallback((clientX, clientY, nextScale) => {
        stopInertia();
        const viewport = viewportRef.current;
        if (!viewport) return;
        const st = stateRef.current;
        st.vx = 0;
        st.vy = 0;
        const rect = viewport.getBoundingClientRect();
        const px = clientX - rect.left;
        const py = clientY - rect.top;
        const wx = (px - st.x) / st.scale;
        const wy = (py - st.y) / st.scale;
        st.scale = Math.min(1.7, Math.max(0.45, nextScale));
        st.x = px - wx * st.scale;
        st.y = py - wy * st.scale;
        applyTransform();
    }, [applyTransform, stopInertia]);

    useEffect(() => {
        ensureCircuitCss();
        refreshAxisMarks();
        centerOnHub(0.72);
        applyTransform();
        const viewport = viewportRef.current;
        const onWheelNative = (e) => {
            e.preventDefault();
            const factor = e.deltaY > 0 ? 0.92 : 1.08;
            zoomAt(e.clientX, e.clientY, stateRef.current.scale * factor);
        };
        viewport?.addEventListener("wheel", onWheelNative, { passive: false });
        const ro = new ResizeObserver(() => {
            applyTransform();
        });
        if (viewport) ro.observe(viewport);
        return () => {
            viewport?.removeEventListener("wheel", onWheelNative);
            ro.disconnect();
            stopInertia();
            stopTravel();
        };
    }, [applyTransform, centerOnHub, zoomAt, stopInertia, stopTravel, refreshAxisMarks]);

    // Soft recenter when hub identity changes outside an active focus-travel
    useEffect(() => {
        if (!recenterKey) return;
        if (stateRef.current.traveling) return;
        if (focusTravelRequest) return;
        if (pendingCenterAfterTravelRef.current) {
            pendingCenterAfterTravelRef.current = false;
            stopInertia();
            stateRef.current.vx = 0;
            stateRef.current.vy = 0;
            centerOnHub(stateRef.current.scale || 0.72);
            applyTransform();
            return;
        }
        stopInertia();
        stateRef.current.vx = 0;
        stateRef.current.vy = 0;
        centerOnHub(0.72);
        applyTransform();
    }, [recenterKey, centerOnHub, applyTransform, stopInertia, focusTravelRequest]);

    // DM focus travel: pan toward target node, then notify parent to swap hub
    useEffect(() => {
        if (!focusTravelRequest?.entityId || !focusTravelRequest?.nonce) return undefined;
        const eid = focusTravelRequest.entityId;
        const node = (layout?.nodes || []).find(
            (n) => n.entityId === eid || n.id === eid,
        );
        const wx = Number.isFinite(node?.x) ? node.x : CIRCUIT_HUB_X;
        const wy = Number.isFinite(node?.y) ? node.y : CIRCUIT_HUB_Y;
        let cancelled = false;
        animatePanToWorld(wx, wy, FOCUS_TRAVEL_MS, () => {
            if (cancelled) return;
            // Keep screen center; next layout hub will snap via pendingCenterAfterTravel
            pendingCenterAfterTravelRef.current = true;
            travelDoneRef.current?.();
        });
        return () => {
            cancelled = true;
            stopTravel();
        };
    // Only re-run when a new travel request is issued (nonce), not on every layout tick
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: travel keyed by nonce
    }, [focusTravelRequest?.nonce]);

    // Packet Cascade loop while Evento narrativo is generating (propagation live)
    useEffect(() => {
        const live = propagationState?.mode === "live" && propagationState?.active;
        const waves = propagationState?.waves;
        if (!live || !waves?.length) return undefined;

        const shell = shellRef.current;
        const world = worldRef.current;
        if (!shell || !world) return undefined;

        clearCircuitSeals(shell);
        const ac = new AbortController();
        const svgEl = world.querySelector("svg.ckt-svg");
        runCircuitPacketCascadeLoop({
            shellEl: shell,
            worldEl: world,
            svgEl,
            nodesById,
            layoutEdges: layout?.edges || [],
            waves,
            signal: ac.signal,
        }).catch(() => { /* aborted */ });

        return () => {
            ac.abort();
        };
    }, [
        propagationState?.mode,
        propagationState?.active,
        propagationState?.waves,
        nodesById,
        layout?.edges,
    ]);

    // F1 Seal Grade when cascade validation completes
    useEffect(() => {
        const seal = propagationState?.mode === "result" && propagationState?.seal;
        if (!seal) {
            if (propagationState?.mode !== "result") {
                clearCircuitSeals(shellRef.current);
            }
            return undefined;
        }

        const shell = shellRef.current;
        const world = worldRef.current;
        if (!shell || !world) return undefined;

        const ac = new AbortController();
        runCircuitSealGrade({
            shellEl: shell,
            worldEl: world,
            gradesByEntityId: seal.gradesByEntityId || {},
            overall: {
                grade: seal.grade,
                pct: seal.pct,
                conf: seal.conf,
                label: seal.label,
            },
            signal: ac.signal,
        }).catch(() => { /* aborted */ });

        return () => {
            ac.abort();
        };
    }, [
        propagationState?.mode,
        propagationState?.seal,
        propagationState?.sealNonce,
    ]);

    const onPointerDown = (e) => {
        if (stateRef.current.nodeDragging) return;
        if (e.target.closest(".ckt-node, .ckt-chrome, button, input, [data-ckt-overlay]")) return;
        if (stateRef.current.traveling) return;
        stopInertia();
        const st = stateRef.current;
        st.dragging = true;
        st.moved = false;
        st.vx = 0;
        st.vy = 0;
        st.lastX = e.clientX;
        st.lastY = e.clientY;
        st.lastT = performance.now();
        viewportRef.current?.classList.add("dragging", "ckt-panning");
        viewportRef.current?.setPointerCapture?.(e.pointerId);
    };

    const onPointerMove = (e) => {
        const st = stateRef.current;
        const nd = nodeDragRef.current;
        if (nd?.active) {
            const scale = Math.max(0.01, st.scale || 1);
            const dx = (e.clientX - nd.startClientX) / scale;
            const dy = (e.clientY - nd.startClientY) / scale;
            if (Math.abs(dx) + Math.abs(dy) > 1) nd.moved = true;
            const pad = 40;
            const next = {
                x: Math.round(Math.min(CIRCUIT_WORLD_W - pad, Math.max(pad, nd.originX + dx))),
                y: Math.round(Math.min(CIRCUIT_WORLD_H - pad, Math.max(pad, nd.originY + dy))),
            };
            nd.x = next.x;
            nd.y = next.y;
            dragPreviewRef.current?.(nd.entityId, next);
            return;
        }
        if (!st.dragging) return;
        const now = performance.now();
        const dt = Math.max(1, now - (st.lastT || now));
        const dx = e.clientX - st.lastX;
        const dy = e.clientY - st.lastY;
        if (Math.abs(dx) + Math.abs(dy) > 2) st.moved = true;
        // Velocity in px/frame (~16ms), EMA for stability
        const instVx = dx * (16 / dt);
        const instVy = dy * (16 / dt);
        st.vx = st.vx * 0.35 + instVx * 0.65;
        st.vy = st.vy * 0.35 + instVy * 0.65;
        st.lastX = e.clientX;
        st.lastY = e.clientY;
        st.lastT = now;
        st.x += dx;
        st.y += dy;
        applyTransform({ atmosphere: "throttle" });
    };

    const endNodeDrag = useCallback((e) => {
        const nd = nodeDragRef.current;
        if (!nd?.active) return;
        nodeDragRef.current = null;
        stateRef.current.nodeDragging = false;
        setDraggingNodeId(null);
        viewportRef.current?.classList.remove("ckt-node-dragging");
        try {
            if (e?.pointerId != null) {
                (e.currentTarget || viewportRef.current)?.releasePointerCapture?.(e.pointerId);
            }
        } catch {
            /* ignore */
        }
        if (nd.moved && Number.isFinite(nd.x) && Number.isFinite(nd.y)) {
            dragCommitRef.current?.(nd.entityId, { x: nd.x, y: nd.y });
        }
    }, []);

    const handleNodeDragStart = useCallback((node, e) => {
        if (!canDragNodes || !node) return;
        if (stateRef.current.traveling) return;
        stopInertia();
        stopTravel();
        const st = stateRef.current;
        st.dragging = false;
        st.vx = 0;
        st.vy = 0;
        st.nodeDragging = true;
        const entityId = node.entityId || node.id;
        nodeDragRef.current = {
            active: true,
            entityId,
            startClientX: e.clientX,
            startClientY: e.clientY,
            originX: Number(node.x) || 0,
            originY: Number(node.y) || 0,
            x: Number(node.x) || 0,
            y: Number(node.y) || 0,
            moved: false,
            pointerId: e.pointerId,
        };
        setDraggingNodeId(entityId);
        viewportRef.current?.classList.add("ckt-node-dragging");
        try {
            viewportRef.current?.setPointerCapture?.(e.pointerId);
        } catch {
            /* ignore */
        }
    }, [canDragNodes, stopInertia, stopTravel]);

    const endDrag = (e) => {
        if (nodeDragRef.current?.active) {
            endNodeDrag(e);
            return;
        }
        const st = stateRef.current;
        if (!st.dragging) return;
        st.dragging = false;
        viewportRef.current?.classList.remove("dragging");
        try {
            viewportRef.current?.releasePointerCapture?.(e.pointerId);
        } catch {
            /* ignore */
        }
        if (st.moved && Math.hypot(st.vx, st.vy) >= PAN_STOP_SPEED) {
            startInertia();
        } else {
            st.vx = 0;
            st.vy = 0;
            viewportRef.current?.classList.remove("ckt-panning");
            applyTransform({ atmosphere: true });
        }
    };

    const runZoomControl = (act) => {
        stopInertia();
        const rect = viewportRef.current?.getBoundingClientRect();
        const cx = (rect?.left || 0) + (rect?.width || 0) / 2;
        const cy = (rect?.top || 0) + (rect?.height || 0) / 2;
        if (act === "zoom-in") zoomAt(cx, cy, stateRef.current.scale * 1.12);
        if (act === "zoom-out") zoomAt(cx, cy, stateRef.current.scale * 0.9);
        if (act === "reset") {
            stateRef.current.vx = 0;
            stateRef.current.vy = 0;
            centerOnHub(0.72);
            applyTransform();
            onSelectNode?.(hubNode || null);
        }
    };

    const syncLabel = (() => {
        const n = Number(selectedNode?.sync);
        if (!selectedNode || selectedNode.kind === "hub" || !Number.isFinite(n) || n === 0) return "—";
        return n > 0 ? `+${n}` : String(n);
    })();

    const zoomBtnSx = {
        width: 32,
        height: 32,
        border: `1px solid ${NAR_ACCENT}40`,
        bgcolor: "rgba(10,10,20,0.9)",
        color: NAR_ACCENT,
        borderRadius: "6px",
        fontFamily: '"Orbitron", sans-serif',
        fontSize: "0.75rem",
        "&:hover": {
            backgroundColor: `${NAR_ACCENT}18`,
            borderColor: NAR_ACCENT,
            boxShadow: `0 0 8px ${NAR_ACCENT}33`,
        },
    };

    return (
        <Box
            ref={shellRef}
            className={`ckt-shell${animPhase ? " ckt-animating" : ""}`}
            sx={{ height: "100%", minHeight: 0 }}
        >
            <Box
                ref={viewportRef}
                className="ckt-viewport"
                onContextMenu={(e) => {
                    e.preventDefault();
                }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onDoubleClick={(e) => {
                    if (e.target.closest(".ckt-node")) return;
                    onSelectNode?.(hubNode || null);
                }}
            >
                <div ref={atmosphereRef} className="ckt-atmosphere" aria-hidden />
                <div ref={gridRef} className="ckt-grid" aria-hidden />

                <Box ref={worldRef} className="ckt-world">
                    <div className="ckt-hub-ring" style={{ opacity: hubNode ? 1 : 0 }} />
                    <div className="ckt-horizon" style={{ opacity: hubNode ? 1 : 0.35 }} />

                    <svg
                        className={`ckt-svg${animPhase === "out" ? " ckt-traces-exit" : ""}${animPhase === "in" ? " ckt-traces-enter" : ""}`}
                        viewBox={`0 0 ${CIRCUIT_WORLD_W} ${CIRCUIT_WORLD_H}`}
                    >
                        {(layout?.edges || []).map((edge, i) => {
                            const from = nodesById.get(edge.fromId) || hubNode;
                            const to = nodesById.get(edge.toId);
                            if (!from || !to) return null;
                            const d = manhattanPath(from, to);
                            const tc = edge.structural
                                ? "struct"
                                : edge.secondary
                                    ? "secondary"
                                    : edge.traceClass || "idle";
                            return (
                                <g key={`${edge.fromId}-${edge.toId}-${i}`}>
                                    <path className={`trace ${tc}`} d={d} />
                                    <path className={`trace-flow ${tc}`} d={d} />
                                    <circle className={`pad ${tc === "secondary" ? "idle" : tc}`} cx={to.x} cy={to.y} r={4} />
                                </g>
                            );
                        })}
                    </svg>

                    {(layout?.nodes || []).map((node) => {
                        const isSelected = selectedId === node.id || (!selectedId && node.kind === "hub");
                        // During cascade live, dim/hit is owned by circuitPacketCascade (DOM)
                        const dim = !waveSets.live
                            && Boolean(selectedId)
                            && selectedId !== node.id
                            && node.kind !== "hub";
                        let waveClass = "";
                        if (!waveSets.live) {
                            const eid = node.entityId || node.id;
                            if (waveSets.w1.has(eid) || waveSets.w1.has(node.id)) waveClass = "wave1";
                            else if (waveSets.w2.has(eid) || waveSets.w2.has(node.id)) waveClass = "wave2";
                        }
                        if (animPhase === "out") {
                            const isTravelTarget = Boolean(
                                travelTargetId
                                && (node.entityId === travelTargetId || node.id === travelTargetId),
                            );
                            if (isTravelTarget) {
                                waveClass = `${waveClass} ckt-travel-target`.trim();
                            } else if (node.kind !== "hub" || travelTargetId) {
                                // Exit neighbors always; exit hub only during focus travel
                                waveClass = `${waveClass} ckt-exit`.trim();
                            }
                        } else if (animPhase === "in" && node.kind !== "hub") {
                            waveClass = `${waveClass} ckt-enter`.trim();
                        }
                        return (
                            <CircuitNode
                                key={node.id}
                                node={node}
                                selected={isSelected}
                                dim={dim}
                                waveClass={waveClass}
                                dragging={draggingNodeId === (node.entityId || node.id)}
                                canDrag={canDragNodes}
                                onDragStart={handleNodeDragStart}
                                onSelect={onSelectNode}
                                canFocusTravel={canFocusTravel}
                                canToggleStruct={canToggleStruct}
                                relationMode={relationMode}
                                onFocusEntity={onFocusEntity}
                                onToggleStruct={onToggleStruct}
                            />
                        );
                    })}
                </Box>

                {waveSets.live && (
                    <div className="ckt-cascade-badge" aria-live="polite">
                        EVENTO · PROPAGANDO…
                    </div>
                )}

                <div className="ckt-verdict-banner" data-ckt-verdict aria-live="polite">
                    <div className="big" data-ckt-verdict-title>GRADE</div>
                    <div className="meta" data-ckt-verdict-meta />
                </div>

                <Box
                    className="ckt-chrome"
                    sx={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 6,
                        pointerEvents: "none",
                        "& > *": { pointerEvents: "auto" },
                    }}
                >
                    <div ref={axisRef} className="ckt-axis" aria-hidden>
                        {SYNC_TICKS.map((t) => (
                            <div
                                key={`tick-${t.sync}`}
                                className={`tick${t.cap === "mid" ? " mid" : ""}`}
                                data-sync={t.sync}
                            >
                                {/* Caps (+10 VÍNCULO / 0 / −10 HOSTIL) own the label — avoid duplicate gray numbers */}
                                {!t.cap && <span>{t.label}</span>}
                            </div>
                        ))}
                        {SYNC_TICKS.filter((t) => t.cap).map((t) => (
                            <div
                                key={`cap-${t.sync}`}
                                className={`cap ${t.cap}`}
                                data-sync={t.sync}
                            >
                                {t.capText}
                            </div>
                        ))}
                    </div>

                    <Box
                        sx={{
                            position: "absolute",
                            top: 10,
                            left: 88,
                            right: 12,
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            flexWrap: "wrap",
                        }}
                    >
                        {topLeftSlot}
                        <Box sx={{ ml: "auto", display: "flex", gap: 0.5, alignItems: "center" }}>
                            {topRightSlot}
                        </Box>
                    </Box>

                    <Box
                        sx={{
                            position: "absolute",
                            left: 88,
                            top: 52,
                            bgcolor: "rgba(10,10,20,0.88)",
                            border: `1px solid ${UI_COLORS.border}`,
                            borderRadius: "8px",
                            p: 1,
                            backdropFilter: "blur(12px)",
                            fontSize: "0.6rem",
                            color: UI_COLORS.textSecondary,
                            minWidth: 140,
                        }}
                    >
                        <CyberTitle sx={{ fontSize: "0.42rem", letterSpacing: "0.12em", color: UI_COLORS.anomaly, mb: 0.5 }}>
                            LECTURA
                        </CyberTitle>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, my: 0.4 }}>
                            <Box sx={{ width: 18, height: 3, bgcolor: UI_COLORS.boon, boxShadow: `0 0 6px ${UI_COLORS.boon}` }} />
                            ↑ Mejor sync
                        </Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, my: 0.4 }}>
                            <Box sx={{ width: 18, height: 3, bgcolor: "#778899" }} />
                            ↔ Neutro
                        </Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, my: 0.4 }}>
                            <Box sx={{ width: 18, height: 3, bgcolor: UI_COLORS.danger, boxShadow: `0 0 6px ${UI_COLORS.danger}` }} />
                            ↓ Peor sync
                        </Box>
                    </Box>

                    <Box
                        sx={{
                            position: "absolute",
                            right: 12,
                            top: 52,
                            width: 220,
                            bgcolor: "rgba(10,10,20,0.9)",
                            border: `1px solid ${UI_COLORS.anomaly}4d`,
                            borderRadius: "8px",
                            p: 1.5,
                            backdropFilter: "blur(14px)",
                        }}
                    >
                        <CyberTitle sx={{ fontSize: "0.58rem", letterSpacing: "0.14em", color: UI_COLORS.anomaly, mb: 0.75 }}>
                            NODO SELECCIONADO
                        </CyberTitle>
                        <CyberText sx={{ fontSize: "1.05rem", fontWeight: 600, color: UI_COLORS.textPrimary, display: "block" }}>
                            {selectedNode?.title || hubNode?.title || "—"}
                        </CyberText>
                        <CyberText
                            sx={{
                                fontFamily: '"Fira Code", monospace',
                                fontSize: "0.62rem",
                                color: UI_COLORS.textSecondary,
                                mb: 1.25,
                                display: "block",
                            }}
                        >
                            {selectedNode?.rankLabel || selectedNode?.labelRank || (hubNode ? "ANCLA" : "OVERVIEW")}
                            {" · "}
                            {selectedNode?.kind || (hubNode ? "hub" : "—")}
                            {" · "}
                            {syncLabel}
                        </CyberText>
                        <Box
                            sx={{
                                height: 10,
                                borderRadius: "2px",
                                background: `linear-gradient(90deg, ${UI_COLORS.danger}, #333 50%, ${UI_COLORS.boon})`,
                                border: `1px solid ${UI_COLORS.border}`,
                                position: "relative",
                                mb: 1,
                            }}
                        >
                            <Box
                                sx={{
                                    position: "absolute",
                                    top: "50%",
                                    left: `${syncMeterPct(selectedNode?.kind === "hub" ? 0 : selectedNode?.sync)}%`,
                                    width: 10,
                                    height: 10,
                                    transform: "translate(-50%, -50%) rotate(45deg)",
                                    bgcolor: "#fff",
                                    border: `1px solid ${UI_COLORS.anomaly}`,
                                    boxShadow: `0 0 8px ${UI_COLORS.anomaly}`,
                                }}
                            />
                        </Box>
                        <CyberText sx={{ fontSize: "0.62rem", color: UI_COLORS.textSecondary, lineHeight: 1.4 }}>
                            {selectedNode?.kind === "cluster"
                                ? "Click para expandir el grupo de este rango."
                                : hubNode
                                    ? "Altura = afinidad (−10…+10). Click enfoca."
                                    : "Click un personaje para centrar el circuito."}
                        </CyberText>
                    </Box>

                    <Box
                        sx={{
                            position: "absolute",
                            right: 12,
                            bottom: 12,
                            display: "flex",
                            flexDirection: "row",
                            gap: 0.5,
                        }}
                    >
                        {[
                            { act: "zoom-out", label: "−", tip: "Zoom −" },
                            { act: "zoom-in", label: "+", tip: "Zoom +" },
                            { act: "reset", label: "⟲", tip: hubNode ? "Centrar hub" : "Centrar vista" },
                        ].map((b) => (
                            <CyberTooltip key={b.act} title={b.tip}>
                                <IconButton
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        runZoomControl(b.act);
                                    }}
                                    sx={zoomBtnSx}
                                >
                                    {b.label}
                                </IconButton>
                            </CyberTooltip>
                        ))}
                    </Box>
                </Box>

                {graphLoading && (
                    <Box
                        className="ckt-graph-loading"
                        aria-busy="true"
                        aria-live="polite"
                    >
                        <CircularProgress
                            size={28}
                            thickness={4}
                            sx={{ color: UI_COLORS.anomaly, mb: 1.25 }}
                        />
                        <CyberTitle
                            sx={{
                                fontSize: "0.62rem",
                                letterSpacing: "0.16em",
                                color: UI_COLORS.anomaly,
                                mb: 0.5,
                            }}
                        >
                            SINCRONIZANDO RED
                        </CyberTitle>
                        <CyberText
                            sx={{
                                fontSize: "0.72rem",
                                color: UI_COLORS.textSecondary,
                                textAlign: "center",
                                maxWidth: 280,
                            }}
                        >
                            Cargando vínculos y nodos del grafo narrativo…
                        </CyberText>
                    </Box>
                )}
            </Box>
        </Box>
    );
}
