/**
 * Shared map pings: cyberpunk targeting circumference (grid-cell radius) + camera pan.
 * Uses Pixi v8 Graphics API (setStrokeStyle + stroke), same as GridLayer.
 */
import * as PIXI from "pixi.js";
import { useEffect, useMemo, useRef } from "react";
import { useSelector } from "react-redux";
import { useApplication } from "@pixi/react";
import { useViewport } from "../context/ViewportContext";
import { safeDestroy } from "./pixiCleanup";
import { RENDER_LAYERS } from "../constants/renderLayers";
import { resolveCellSize } from "../utils/gridMath";

const PINK = 0xff66ff;
const CYAN = 0x00f2ea;
const PING_MS = 5000;
/** How fresh a ping must be for the camera to follow it. */
const PAN_GRACE_MS = 1500;

function smoothCenterOnWorld(viewport, worldX, worldY, time = 420) {
    if (!viewport || viewport.destroyed) return;
    const center = viewport.center;
    const dx = worldX - center.x;
    const dy = worldY - center.y;
    if (Math.hypot(dx, dy) < 4) {
        viewport.moveCenter(worldX, worldY);
        return;
    }
    viewport.animate({
        position: { x: worldX, y: worldY },
        time,
        ease: "easeInOutCubic",
        removeOnInterrupt: true,
    });
}

function strokeStyle(g, width, color, alpha) {
    g.setStrokeStyle({
        width: Math.max(0.75, width),
        color,
        alpha: Math.max(0, Math.min(1, alpha)),
        cap: "round",
        join: "round",
    });
}

/** Arc via Graphics.arc (Pixi v8). */
function strokeArc(g, radius, startAngle, endAngle) {
    if (radius <= 0) return;
    g.moveTo(Math.cos(startAngle) * radius, Math.sin(startAngle) * radius);
    g.arc(0, 0, radius, startAngle, endAngle);
}

function strokeBrokenCircumference(g, radius, rotation, gapRad, color, alpha, lw) {
    if (radius <= 0 || alpha <= 0) return;
    strokeStyle(g, lw, color, alpha);
    const segment = (Math.PI * 2 - gapRad * 4) / 4;
    for (let i = 0; i < 4; i++) {
        const start = rotation + i * (segment + gapRad) + gapRad * 0.5;
        strokeArc(g, radius, start, start + segment);
    }
    g.stroke();
}

function strokeTicks(g, radius, rotation, tickLen, color, alpha, lw, count = 8) {
    if (radius <= 0 || alpha <= 0) return;
    strokeStyle(g, lw, color, alpha);
    for (let i = 0; i < count; i++) {
        const a = rotation + (i * Math.PI * 2) / count;
        const c = Math.cos(a);
        const s = Math.sin(a);
        const inner = radius - tickLen;
        const outer = radius + tickLen * 0.35;
        g.moveTo(c * inner, s * inner);
        g.lineTo(c * outer, s * outer);
    }
    g.stroke();
}

function strokeBrackets(g, radius, rotation, bracketSpan, color, alpha, lw) {
    if (radius <= 0 || alpha <= 0) return;
    strokeStyle(g, lw, color, alpha);
    for (let i = 0; i < 4; i++) {
        const mid = rotation + (Math.PI / 2) * i + Math.PI / 4;
        const half = bracketSpan / 2;
        const a0 = mid - half;
        const a1 = mid + half;
        strokeArc(g, radius, a0, a1);
        const tip = radius * 0.78;
        g.moveTo(Math.cos(a0) * radius, Math.sin(a0) * radius);
        g.lineTo(Math.cos(a0) * tip, Math.sin(a0) * tip);
        g.moveTo(Math.cos(a1) * radius, Math.sin(a1) * radius);
        g.lineTo(Math.cos(a1) * tip, Math.sin(a1) * tip);
    }
    g.stroke();
}

function strokeCrosshair(g, size, color, alpha, lw) {
    if (size <= 0 || alpha <= 0) return;
    strokeStyle(g, lw, color, alpha);
    const arm = size;
    const gap = size * 0.22;
    g.moveTo(-arm, 0);
    g.lineTo(-gap, 0);
    g.moveTo(gap, 0);
    g.lineTo(arm, 0);
    g.moveTo(0, -arm);
    g.lineTo(0, -gap);
    g.moveTo(0, gap);
    g.lineTo(0, arm);
    const d = size * 0.28;
    g.moveTo(0, -d);
    g.lineTo(d, 0);
    g.lineTo(0, d);
    g.lineTo(-d, 0);
    g.lineTo(0, -d);
    g.stroke();
}

function createPingVisual(x, y) {
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

function paintReticle(g, cellRadius, scale, rotation, pulse) {
    g.clear();
    const r = cellRadius * (0.96 + 0.04 * pulse);
    const lw = Math.max(1.4, 2.4 / scale);
    const lwThin = Math.max(1.0, 1.5 / scale);
    const gap = 0.28 + pulse * 0.04;

    strokeBrokenCircumference(g, r, rotation, gap, PINK, 0.95, lw);
    strokeBrokenCircumference(g, r * 0.72, -rotation * 1.35, gap * 1.15, CYAN, 0.85, lwThin);
    strokeTicks(g, r, rotation, r * 0.12, PINK, 0.8, lwThin, 8);
    strokeBrackets(g, r * 1.06, rotation, 0.38, CYAN, 0.9, lw);
    strokeCrosshair(g, r * 0.38, CYAN, 0.95, lwThin);

    // Tip notches
    strokeStyle(g, lwThin, PINK, 0.75);
    const tip = r * 0.38;
    const notch = r * 0.06;
    g.moveTo(-tip, -notch);
    g.lineTo(-tip, notch);
    g.moveTo(tip, -notch);
    g.lineTo(tip, notch);
    g.moveTo(-notch, -tip);
    g.lineTo(notch, -tip);
    g.moveTo(-notch, tip);
    g.lineTo(notch, tip);
    g.stroke();
}

function paintPulseRing(g, radius, alpha, scale, rotation) {
    g.clear();
    if (radius <= 0 || alpha <= 0) return;
    const lw = Math.max(1.2, 2.2 / scale);
    const gap = 0.42;
    strokeBrokenCircumference(g, radius, rotation, gap, PINK, alpha, lw);
    strokeBrokenCircumference(
        g,
        radius * 0.94,
        rotation + Math.PI / 4,
        gap * 1.2,
        CYAN,
        alpha * 0.55,
        lw * 0.7,
    );
}

export default function PingLayer() {
    const viewport = useViewport();
    const { app } = useApplication();
    const map = useSelector((s) => s.world.map);
    const gridConfig = useSelector((s) => s.world.gridConfig);
    const mapId = useSelector((s) => s.world.activeMapId ?? s.world.map?.id);
    const pings = useSelector((s) => s.game.pings ?? {});

    const rootRef = useRef(null);
    const visualsRef = useRef(new Map());
    const seenPanRef = useRef(new Set());
    const cellSizeRef = useRef(70);

    const cellSize = resolveCellSize(map, gridConfig);
    useEffect(() => { cellSizeRef.current = cellSize; }, [cellSize]);

    /** Map filtering only: expiry needs the clock, so it happens inside the effects. */
    const mapPings = useMemo(
        () =>
            Object.values(pings).filter(
                (p) => p?.id && !(mapId && p.mapId && p.mapId !== mapId),
            ),
        [pings, mapId],
    );

    useEffect(() => {
        if (!viewport) return;
        const root = new PIXI.Container();
        root.label = "PingLayer";
        root.zIndex = RENDER_LAYERS.UI - 10;
        root.eventMode = "none";
        root.sortableChildren = true;
        viewport.addChild(root);
        rootRef.current = root;
        const visuals = visualsRef.current;
        return () => {
            for (const v of visuals.values()) safeDestroy(v.container);
            visuals.clear();
            safeDestroy(root);
            rootRef.current = null;
        };
    }, [viewport]);

    useEffect(() => {
        if (!viewport) return;
        const now = Date.now();
        for (const ping of mapPings) {
            if (ping.expiresAt && ping.expiresAt <= now) continue;
            if (seenPanRef.current.has(ping.id)) continue;
            seenPanRef.current.add(ping.id);
            // Only follow pings raised just now: mounting or switching maps must not
            // yank the camera towards pings that were already live.
            if (ping.createdAt && now - ping.createdAt > PAN_GRACE_MS) continue;
            smoothCenterOnWorld(viewport, ping.x, ping.y);
        }
        for (const id of [...seenPanRef.current]) {
            if (!pings[id]) seenPanRef.current.delete(id);
        }
    }, [viewport, mapPings, pings]);

    useEffect(() => {
        const root = rootRef.current;
        if (!viewport || !app || !root) return undefined;

        const now = Date.now();
        const activePings = mapPings.filter((p) => !(p.expiresAt && p.expiresAt <= now));
        const liveIds = new Set();
        for (const ping of activePings) {
            liveIds.add(ping.id);
            if (!visualsRef.current.has(ping.id)) {
                const visual = createPingVisual(ping.x, ping.y);
                root.addChild(visual.container);
                visualsRef.current.set(ping.id, visual);
            }
        }
        for (const [id, visual] of visualsRef.current.entries()) {
            if (!liveIds.has(id)) {
                safeDestroy(visual.container);
                visualsRef.current.delete(id);
            }
        }

        // Pings are rare and short-lived: no ticker while nothing is on screen.
        if (visualsRef.current.size === 0) return undefined;

        const onTick = () => {
            const now = performance.now();
            const scale = viewport.scale.x || 1;
            const cellRadius = Math.max(8, (cellSizeRef.current || 70) / 2);

            for (const [id, visual] of visualsRef.current.entries()) {
                const ping = pings[id];
                const start = ping?.createdAt
                    ? performance.now() - (Date.now() - ping.createdAt)
                    : visual.born;
                const t = Math.min(1, Math.max(0, (now - start) / PING_MS));
                const fade = t < 0.72 ? 1 : 1 - (t - 0.72) / 0.28;
                const pulse = 0.5 + 0.5 * Math.sin(now / 140);
                const spin = (now / 900) % (Math.PI * 2);

                paintReticle(visual.reticle, cellRadius, scale, spin, pulse);
                visual.reticle.alpha = (0.8 + 0.2 * pulse) * fade;

                const p0 = t;
                const p1 = (t + 0.38) % 1;
                paintPulseRing(
                    visual.pulseA,
                    cellRadius * (1 + p0 * 1.55),
                    (1 - p0) * 0.85 * fade,
                    scale,
                    spin * 0.6,
                );
                paintPulseRing(
                    visual.pulseB,
                    cellRadius * (1 + p1 * 1.55),
                    (1 - p1) * 0.6 * fade,
                    scale,
                    -spin * 0.85,
                );

                visual.container.alpha = fade;
                if (t >= 1) {
                    safeDestroy(visual.container);
                    visualsRef.current.delete(id);
                }
            }
            // The ping doc can outlive the animation; stop ticking once it faded out.
            if (visualsRef.current.size === 0) app.ticker.remove(onTick);
        };

        app.ticker.add(onTick);
        return () => app.ticker.remove(onTick);
    }, [viewport, app, mapPings, pings, cellSize]);

    return null;
}
