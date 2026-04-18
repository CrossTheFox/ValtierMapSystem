/**
 * DistanceMeasureLayer
 *
 * Renders a cyberpunk dashed-line measurement overlay directly in the PIXI viewport.
 * Uses the pixi.js v7-compat Graphics API (beginFill / drawCircle / lineStyle / etc.)
 * which is what the rest of this codebase uses.
 *
 * Modes:
 *   • Only pointA set  → live line from pointA to cursor (ticker-driven)
 *   • pointA + pointB  → static line with final distance label
 *   • neither          → nothing rendered
 */
import * as PIXI from "pixi.js";
import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { useApplication } from "@pixi/react";
import { useViewport } from "../context/ViewportContext";

const CYAN      = 0x00f2ea;
const CYAN_STR  = "#00f2ea";
const DARK_BG   = 0x050508;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function calcDistance(pixelDist, map) {
    if (!map || pixelDist <= 0) return "";
    const meters = pixelDist * (map.metersPerPixel ?? 1);
    if (map.unit === "km") {
        return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(meters)} m`;
}

/**
 * Appends dash segments (moveTo/lineTo pairs) to an in-progress Graphics path.
 * The caller is responsible for setting lineStyle before and ending/stroking after.
 */
function appendDashes(g, x1, y1, x2, y2, dashLen, gapLen) {
    const totalLen = Math.hypot(x2 - x1, y2 - y1);
    if (totalLen < 1) return;
    const nx = (x2 - x1) / totalLen;
    const ny = (y2 - y1) / totalLen;
    let pos = 0;
    let isDash = true;
    while (pos < totalLen) {
        const seg = Math.min(isDash ? dashLen : gapLen, totalLen - pos);
        if (isDash) {
            g.moveTo(x1 + nx * pos, y1 + ny * pos);
            g.lineTo(x1 + nx * (pos + seg), y1 + ny * (pos + seg));
        }
        pos += seg;
        isDash = !isDash;
    }
}

/** Full redraw of the measurement graphics + label update. */
function redraw(g, labelText, pointA, pointB, scale, map) {
    g.clear();

    if (!pointA) {
        labelText.text = "";
        labelText.visible = false;
        return;
    }

    const ax = pointA.x;
    const ay = pointA.y;
    const bx = pointB ? pointB.x : ax;
    const by = pointB ? pointB.y : ay;
    const isFinal = !!pointB;

    // Screen-constant sizes (divide by scale → world-unit size)
    const dashPx   = 18;
    const gapPx    = 7;
    const lineW    = 2;
    const glowW    = 10;
    const dotR     = 5;
    const ringR    = 10;

    // Glow pass
    g.lineStyle(glowW / scale, CYAN, 0.1);
    appendDashes(g, ax, ay, bx, by, dashPx / scale, gapPx / scale);

    // Main dashed line
    g.lineStyle(lineW / scale, CYAN, isFinal ? 1.0 : 0.6);
    appendDashes(g, ax, ay, bx, by, dashPx / scale, gapPx / scale);

    // ── Endpoint A ────────────────────────────────────────────────
    g.lineStyle(lineW / scale, CYAN, 0.5);
    g.beginFill(CYAN, 1.0);
    g.drawCircle(ax, ay, dotR / scale);
    g.endFill();

    g.lineStyle((lineW * 0.75) / scale, CYAN, 0.25);
    g.drawCircle(ax, ay, ringR / scale);

    // ── Endpoint B (target cursor or final point) ─────────────────
    if (bx !== ax || by !== ay) {
        g.lineStyle(lineW / scale, CYAN, 0.5);
        g.beginFill(CYAN, isFinal ? 1.0 : 0.35);
        g.drawCircle(bx, by, dotR / scale);
        g.endFill();

        g.lineStyle((lineW * 0.75) / scale, CYAN, isFinal ? 0.25 : 0.12);
        g.drawCircle(bx, by, ringR / scale);
    }

    // ── Distance label ────────────────────────────────────────────
    const pixelDist = Math.hypot(bx - ax, by - ay);
    const distStr = calcDistance(pixelDist, map);

    if (distStr && pixelDist > (ringR * 3) / scale) {
        // Update text (text dimensions are immediately available after assignment)
        labelText.text = `◈  ${distStr}`;
        labelText.scale.set(1 / scale);
        labelText.visible = true;

        const lx = (ax + bx) / 2;
        const ly = (ay + by) / 2 - 22 / scale;
        labelText.x = lx;
        labelText.y = ly;

        // Background rect (using current text dimensions, which account for scale)
        const tw = labelText.width;
        const th = labelText.height;
        const pad = 5 / scale;
        const brd = 3 / scale;

        g.lineStyle(1 / scale, CYAN, 0.8);
        g.beginFill(DARK_BG, 0.9);
        g.drawRoundedRect(
            lx - tw / 2 - pad,
            ly - th / 2 - pad,
            tw + pad * 2,
            th + pad * 2,
            brd,
        );
        g.endFill();
    } else {
        labelText.visible = false;
    }

    // Draw small hash-marks perpendicular to the line every ~60px for
    // a segmented "ruler" feel
    if (pixelDist > 0) {
        const nx = (bx - ax) / pixelDist;
        const ny = (by - ay) / pixelDist;
        const px = -ny; // perpendicular
        const py =  nx;
        const tickInterval = 60 / scale;
        const tickHalf     = 5  / scale;
        const numTicks     = Math.floor(pixelDist / tickInterval);
        g.lineStyle((lineW * 0.6) / scale, CYAN, 0.3);
        for (let i = 1; i <= numTicks; i++) {
            const tx = ax + nx * tickInterval * i;
            const ty = ay + ny * tickInterval * i;
            g.moveTo(tx - px * tickHalf, ty - py * tickHalf);
            g.lineTo(tx + px * tickHalf, ty + py * tickHalf);
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function DistanceMeasureLayer() {
    const viewport = useViewport();
    const { app }  = useApplication();

    const { measureTool }  = useSelector((s) => s.ui);
    const map              = useSelector((s) => s.world.map);

    const graphicsRef  = useRef(null);
    const labelRef     = useRef(null);
    const cursorRef    = useRef({ x: 0, y: 0 });

    // Refs so the ticker callback always reads latest values without re-subscribing
    const measureRef = useRef(measureTool);
    const mapRef     = useRef(map);
    useEffect(() => { measureRef.current = measureTool; }, [measureTool]);
    useEffect(() => { mapRef.current = map; }, [map]);

    // ── Setup PIXI objects (once per viewport mount) ──────────────
    useEffect(() => {
        if (!viewport) return;

        const g = new PIXI.Graphics();
        g.zIndex = 50;
        viewport.addChild(g);
        graphicsRef.current = g;

        const textStyle = new PIXI.TextStyle({
            fontFamily: "Fira Code, Courier New, monospace",
            fontSize: 13,
            fontWeight: "bold",
            fill: CYAN_STR,
        });
        const label = new PIXI.Text("", textStyle);
        label.anchor.set(0.5, 0.5);
        label.zIndex = 51;
        label.visible = false;
        viewport.addChild(label);
        labelRef.current = label;

        return () => {
            g.destroy();
            label.destroy();
            graphicsRef.current = null;
            labelRef.current    = null;
        };
    }, [viewport]);

    // ── Live preview ticker (pointA set, pointB not yet) ──────────
    useEffect(() => {
        const hasA = !!measureTool.pointA;
        const hasB = !!measureTool.pointB;

        if (!viewport || !app || !hasA || hasB) {
            // Clear graphics if we left measuring mode entirely
            if (!hasA) {
                graphicsRef.current?.clear();
                if (labelRef.current) {
                    labelRef.current.text    = "";
                    labelRef.current.visible = false;
                }
            }
            return;
        }

        const onMove = (e) => {
            const world = viewport.toWorld(e.global.x, e.global.y);
            cursorRef.current = { x: world.x, y: world.y };
        };

        const onTick = () => {
            const g     = graphicsRef.current;
            const label = labelRef.current;
            if (!g || !label || !measureRef.current.pointA) return;
            redraw(g, label, measureRef.current.pointA, cursorRef.current, viewport.scale.x, mapRef.current);
        };

        viewport.on("pointermove", onMove);
        app.ticker.add(onTick);

        return () => {
            viewport.off("pointermove", onMove);
            app.ticker.remove(onTick);
        };
    }, [viewport, app, measureTool.pointA, measureTool.pointB]);

    // ── Static final line (both points set) ──────────────────────
    useEffect(() => {
        if (!viewport || !measureTool.pointA || !measureTool.pointB) return;

        const draw = () => {
            const g     = graphicsRef.current;
            const label = labelRef.current;
            if (!g || !label) return;
            redraw(g, label, measureTool.pointA, measureTool.pointB, viewport.scale.x, mapRef.current);
        };

        draw();
        viewport.on("zoomed", draw);

        return () => {
            viewport.off("zoomed", draw);
        };
    }, [viewport, measureTool.pointA, measureTool.pointB]);

    return null;
}
