/**
 * Cyberpunk square turn-focus flash when initiative camera jumps to a token.
 * Pixi v8 Graphics API (stroke options / clear), same family as PingLayer.
 */
import * as PIXI from "pixi.js";
import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useApplication } from "@pixi/react";
import { useViewport } from "../context/ViewportContext";
import { safeDestroy } from "./pixiCleanup";
import { RENDER_LAYERS } from "../constants/renderLayers";
import { resolveCellSize } from "../utils/gridMath";
import { clearTurnFocus } from "../store/uiSlice";

const PINK = 0xff66ff;
const CYAN = 0x00f2ea;
const FOCUS_MS = 2800;

function strokeOpts(width, color, alpha) {
    return {
        width: Math.max(0.75, width),
        color,
        alpha: Math.max(0, Math.min(1, alpha)),
        cap: "round",
        join: "round",
    };
}

/** Corner brackets + soft square — ping energy, square silhouette. */
function paintSquareReticle(g, half, scale, pulse, spinPhase) {
    g.clear();
    if (half <= 0) return;
    const lw = Math.max(1.35, 2.35 / scale);
    const lwThin = Math.max(1.0, 1.45 / scale);
    const arm = half * (0.28 + pulse * 0.04);
    const pad = half * (0.06 + pulse * 0.02);
    const h = half + pad;

    // Soft fill whisper
    g.rect(-h, -h, h * 2, h * 2);
    g.fill({ color: PINK, alpha: 0.05 + pulse * 0.03 });

    // Magenta outer square (hairline)
    g.rect(-h, -h, h * 2, h * 2);
    g.stroke(strokeOpts(lw * 0.75, PINK, 0.55 + pulse * 0.2));

    // Cyan inset square
    const inset = Math.max(2, half * 0.1);
    g.rect(-h + inset, -h + inset, (h - inset) * 2, (h - inset) * 2);
    g.stroke(strokeOpts(lwThin, CYAN, 0.4 + pulse * 0.15));

    // Corner brackets
    const corners = [
        [-h, -h, 1, 1],
        [h, -h, -1, 1],
        [h, h, -1, -1],
        [-h, h, 1, -1],
    ];
    for (const [cx, cy, sx, sy] of corners) {
        g.moveTo(cx, cy + sy * arm);
        g.lineTo(cx, cy);
        g.lineTo(cx + sx * arm, cy);
        g.stroke(strokeOpts(lw * 1.15, PINK, 0.95));
    }

    // Tiny spinning dashes mid-edge (tech flair)
    const mid = h * 0.55;
    const dash = half * 0.1;
    const rot = spinPhase;
    const mids = [
        [Math.cos(rot) * mid, Math.sin(rot) * mid],
        [Math.cos(rot + Math.PI / 2) * mid, Math.sin(rot + Math.PI / 2) * mid],
        [Math.cos(rot + Math.PI) * mid, Math.sin(rot + Math.PI) * mid],
        [Math.cos(rot + (3 * Math.PI) / 2) * mid, Math.sin(rot + (3 * Math.PI) / 2) * mid],
    ];
    for (const [mx, my] of mids) {
        const len = Math.hypot(mx, my) || 1;
        const nx = -my / len;
        const ny = mx / len;
        g.moveTo(mx - nx * dash, my - ny * dash);
        g.lineTo(mx + nx * dash, my + ny * dash);
        g.stroke(strokeOpts(lwThin, CYAN, 0.75));
    }
}

function paintExpandingSquare(g, half, alpha, scale, rotationOffset) {
    g.clear();
    if (half <= 0 || alpha <= 0) return;
    const lw = Math.max(1.1, 2.0 / scale);
    const gap = half * 0.18;
    const arm = half - gap;
    // Broken square: four side segments with gaps at corners
    const segs = [
        [-arm, -half, arm, -half],
        [half, -arm, half, arm],
        [arm, half, -arm, half],
        [-half, arm, -half, -arm],
    ];
    // Slight rotate via matrix on container instead — draw axis-aligned for clarity
    void rotationOffset;
    for (const [x0, y0, x1, y1] of segs) {
        g.moveTo(x0, y0);
        g.lineTo(x1, y1);
        g.stroke(strokeOpts(lw, PINK, alpha));
    }
    // Inner cyan echo
    const ih = half * 0.92;
    const ig = ih * 0.18;
    const ia = ih - ig;
    const inner = [
        [-ia, -ih, ia, -ih],
        [ih, -ia, ih, ia],
        [ia, ih, -ia, ih],
        [-ih, ia, -ih, -ia],
    ];
    for (const [x0, y0, x1, y1] of inner) {
        g.moveTo(x0, y0);
        g.lineTo(x1, y1);
        g.stroke(strokeOpts(lw * 0.65, CYAN, alpha * 0.55));
    }
}

function createFocusVisual(x, y) {
    const container = new PIXI.Container();
    container.x = x;
    container.y = y;
    container.eventMode = "none";
    container.sortableChildren = true;

    const pulseA = new PIXI.Graphics();
    pulseA.zIndex = 1;
    const pulseB = new PIXI.Graphics();
    pulseB.zIndex = 2;
    const reticle = new PIXI.Graphics();
    reticle.zIndex = 3;
    container.addChild(pulseA, pulseB, reticle);

    return { container, pulseA, pulseB, reticle, born: performance.now() };
}

export default function TurnFocusLayer() {
    const dispatch = useDispatch();
    const viewport = useViewport();
    const { app } = useApplication();
    const map = useSelector((s) => s.world.map);
    const gridConfig = useSelector((s) => s.world.gridConfig);
    const mapId = useSelector((s) => s.world.activeMapId ?? s.world.map?.id);
    const turnFocus = useSelector((s) => s.ui.turnFocus);

    const rootRef = useRef(null);
    const visualRef = useRef(null);
    const cellSizeRef = useRef(70);
    const focusIdRef = useRef(null);

    const cellSize = resolveCellSize(map, gridConfig);
    useEffect(() => { cellSizeRef.current = cellSize; }, [cellSize]);

    useEffect(() => {
        if (!viewport) return undefined;
        const root = new PIXI.Container();
        root.label = "TurnFocusLayer";
        root.zIndex = RENDER_LAYERS.UI - 9;
        root.eventMode = "none";
        root.sortableChildren = true;
        viewport.addChild(root);
        rootRef.current = root;
        return () => {
            if (visualRef.current) {
                safeDestroy(visualRef.current.container);
                visualRef.current = null;
            }
            safeDestroy(root);
            rootRef.current = null;
        };
    }, [viewport]);

    useEffect(() => {
        const root = rootRef.current;
        if (!viewport || !app || !root) return undefined;

        const focus = turnFocus;
        const onMap = focus && !(mapId && focus.mapId && focus.mapId !== mapId);
        const expired = focus?.createdAt && Date.now() - focus.createdAt > FOCUS_MS + 400;

        if (!focus || !onMap || expired) {
            if (visualRef.current) {
                safeDestroy(visualRef.current.container);
                visualRef.current = null;
                focusIdRef.current = null;
            }
            if (expired && focus) dispatch(clearTurnFocus());
            return undefined;
        }

        if (focusIdRef.current !== focus.id) {
            if (visualRef.current) {
                safeDestroy(visualRef.current.container);
                visualRef.current = null;
            }
            const visual = createFocusVisual(focus.x, focus.y);
            root.addChild(visual.container);
            visualRef.current = visual;
            focusIdRef.current = focus.id;
        } else if (visualRef.current) {
            visualRef.current.container.x = focus.x;
            visualRef.current.container.y = focus.y;
        }

        const onTick = () => {
            const visual = visualRef.current;
            if (!visual) {
                app.ticker.remove(onTick);
                return;
            }
            const start = focus.createdAt
                ? performance.now() - (Date.now() - focus.createdAt)
                : visual.born;
            const now = performance.now();
            const t = Math.min(1, Math.max(0, (now - start) / FOCUS_MS));
            const fade = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
            const pulse = 0.5 + 0.5 * Math.sin(now / 130);
            const spin = (now / 850) % (Math.PI * 2);
            const scale = viewport.scale.x || 1;
            const half = Math.max(10, (cellSizeRef.current || 70) / 2);

            paintSquareReticle(visual.reticle, half * (0.98 + pulse * 0.03), scale, pulse, spin);
            visual.reticle.alpha = (0.85 + 0.15 * pulse) * fade;

            const p0 = t;
            const p1 = (t + 0.42) % 1;
            paintExpandingSquare(
                visual.pulseA,
                half * (1 + p0 * 1.65),
                (1 - p0) * 0.9 * fade,
                scale,
                spin,
            );
            paintExpandingSquare(
                visual.pulseB,
                half * (1 + p1 * 1.65),
                (1 - p1) * 0.55 * fade,
                scale,
                -spin,
            );

            visual.container.alpha = fade;
            if (t >= 1) {
                safeDestroy(visual.container);
                visualRef.current = null;
                focusIdRef.current = null;
                dispatch(clearTurnFocus());
                app.ticker.remove(onTick);
            }
        };

        app.ticker.add(onTick);
        return () => app.ticker.remove(onTick);
    }, [viewport, app, turnFocus, mapId, dispatch]);

    return null;
}
