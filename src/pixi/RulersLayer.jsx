/**
 * Shared table rulers + local placement draft.
 * Synced rulers come from game.rulers; draft from ui.rulerTool.
 */
import * as PIXI from "pixi.js";
import { useEffect, useMemo, useRef } from "react";
import { useSelector } from "react-redux";
import { useApplication } from "@pixi/react";
import { useViewport } from "../context/ViewportContext";
import { safeDestroy } from "./pixiCleanup";
import { removeMapRuler } from "../../firebase/services/gameService";
import {
    formatMapDistance,
    measureGridCells,
    resolveCellSize,
    snapToGridCenter,
    worldToCell,
} from "../utils/gridMath";
import { RENDER_LAYERS } from "../constants/renderLayers";

const CYAN = 0x00f2ea;
const CYAN_STR = "#00f2ea";
const PINK = 0xff66ff;
const DARK_BG = 0x050508;
/** Destructive delete-chip red (distinct from magenta accents). */
const DELETE_RED = 0xff2a3a;
const DELETE_RED_DARK = 0x1a0608;

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

function labelForPoints(a, b, map) {
    const cells = measureGridCells(a.col, a.row, b.col, b.row);
    const pixelDist = Math.hypot(b.x - a.x, b.y - a.y);
    const distStr = formatMapDistance(pixelDist, map);
    const parts = [
        `${cells.totalCells} casillas`,
        cells.diagonal > 0 ? `${cells.diagonal} diag` : null,
        cells.straight > 0 ? `${cells.straight} recto` : null,
        distStr || null,
    ].filter(Boolean);
    return parts.join(" · ");
}

function drawRulerLine(g, labelText, a, b, scale, map, { preview = false } = {}) {
    g.clear();
    if (!a || !b) {
        if (labelText) {
            labelText.text = "";
            labelText.visible = false;
        }
        return;
    }

    const ax = a.x;
    const ay = a.y;
    const bx = b.x;
    const by = b.y;
    const color = preview ? PINK : CYAN;
    const colorStr = preview ? "#ff66ff" : CYAN_STR;

    const dashPx = 18;
    const gapPx = 7;
    const lineW = 2;
    const glowW = 10;
    const dotR = 5;
    const ringR = 10;

    // Pixi v8: each pass needs its own stroke()/fill(), otherwise the accumulated
    // path is swept up by the next call and rings render as solid discs.
    g.setStrokeStyle({ width: glowW / scale, color, alpha: 0.12 });
    appendDashes(g, ax, ay, bx, by, dashPx / scale, gapPx / scale);
    g.stroke();
    g.setStrokeStyle({ width: lineW / scale, color, alpha: preview ? 0.65 : 1 });
    appendDashes(g, ax, ay, bx, by, dashPx / scale, gapPx / scale);
    g.stroke();

    const drawNode = (x, y, fillAlpha, ringAlpha) => {
        g.circle(x, y, dotR / scale);
        g.fill({ color, alpha: fillAlpha });
        g.circle(x, y, dotR / scale);
        g.stroke({ width: lineW / scale, color, alpha: 0.5 });
        g.circle(x, y, ringR / scale);
        g.stroke({ width: (lineW * 0.75) / scale, color, alpha: ringAlpha });
    };

    drawNode(ax, ay, 1, 0.25);
    if (bx !== ax || by !== ay) {
        drawNode(bx, by, preview ? 0.4 : 1, preview ? 0.15 : 0.25);
    }

    const pixelDist = Math.hypot(bx - ax, by - ay);
    if (!labelText || pixelDist < (ringR * 3) / scale) {
        if (labelText) labelText.visible = false;
        return;
    }

    const text = labelForPoints(a, b, map);
    labelText.text = `◈  ${text}`;
    labelText.style.fill = colorStr;
    labelText.scale.set(1 / scale);
    labelText.visible = true;

    const lx = (ax + bx) / 2;
    const ly = (ay + by) / 2 - 26 / scale;
    labelText.x = lx;
    labelText.y = ly;

    const tw = labelText.width;
    const th = labelText.height;
    const pad = 5 / scale;
    const brd = 3 / scale;
    g.roundRect(lx - tw / 2 - pad, ly - th / 2 - pad, tw + pad * 2, th + pad * 2, brd);
    g.fill({ color: DARK_BG, alpha: 0.92 });
    g.roundRect(lx - tw / 2 - pad, ly - th / 2 - pad, tw + pad * 2, th + pad * 2, brd);
    g.stroke({ width: 1 / scale, color, alpha: 0.85 });
}

function makeLabel() {
    const style = new PIXI.TextStyle({
        fontFamily: "Fira Code, Courier New, monospace",
        fontSize: 12,
        fontWeight: "bold",
        fill: CYAN_STR,
    });
    const label = new PIXI.Text("", style);
    label.anchor.set(0.5, 0.5);
    label.eventMode = "none";
    return label;
}

/** Top-right corner of the axis-aligned box defined by endpoints A/B. */
function deleteButtonWorldPos(a, b) {
    return {
        x: Math.max(a.x, b.x),
        y: Math.min(a.y, b.y),
    };
}

/**
 * Visible trash/X chip — Pixi v8 stroke/fill API. Drawn once in screen units and
 * kept constant on screen via `scale`, so zooming never rebuilds the geometry.
 */
function makeDeleteButton(onDelete) {
    const btn = new PIXI.Container();
    btn.eventMode = "static";
    btn.cursor = "pointer";
    btn.hitArea = new PIXI.Circle(0, 0, 15);

    const g = new PIXI.Graphics();
    const r = 12;
    const ringW = 2.25;
    const xW = 2.85;

    // Soft outer glow
    g.circle(0, 0, r + 2.5);
    g.stroke({ width: 4, color: DELETE_RED, alpha: 0.22 });

    // Chip body
    g.circle(0, 0, r);
    g.fill({ color: DELETE_RED_DARK, alpha: 0.97 });
    g.circle(0, 0, r);
    g.stroke({ width: ringW, color: DELETE_RED, alpha: 1, cap: "round" });

    // Crisp X (separate stroke passes so Pixi v8 doesn't merge paths oddly)
    const arm = r * 0.42;
    g.moveTo(-arm, -arm);
    g.lineTo(arm, arm);
    g.stroke({ width: xW, color: DELETE_RED, alpha: 1, cap: "round", join: "round" });
    g.moveTo(arm, -arm);
    g.lineTo(-arm, arm);
    g.stroke({ width: xW, color: DELETE_RED, alpha: 1, cap: "round", join: "round" });

    btn.addChild(g);
    btn.zIndex = 4;
    btn.on("pointertap", (e) => {
        e.stopPropagation?.();
        onDelete?.();
    });
    btn.on("pointerdown", (e) => {
        e.stopPropagation?.();
    });
    return btn;
}

function placeDeleteButton(btn, ruler, scale) {
    const corner = deleteButtonWorldPos(ruler.a, ruler.b);
    btn.x = corner.x;
    btn.y = corner.y;
    btn.scale.set(1 / (scale || 1));
}

export default function RulersLayer() {
    const viewport = useViewport();
    const { app } = useApplication();
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const map = useSelector((s) => s.world.map);
    const mapId = useSelector((s) => s.world.activeMapId ?? s.world.map?.id);
    const gridConfig = useSelector((s) => s.world.gridConfig);
    const rulers = useSelector((s) => s.game.rulers ?? {});
    const rulerTool = useSelector((s) => s.ui.rulerTool);

    const rootRef = useRef(null);
    const draftGRef = useRef(null);
    const draftLabelRef = useRef(null);
    const cursorRef = useRef({ x: 0, y: 0, col: 0, row: 0 });
    const rulerNodesRef = useRef(new Map());

    const mapRulers = useMemo(() => {
        return Object.values(rulers).filter((r) => r && (!mapId || r.mapId === mapId));
    }, [rulers, mapId]);

    const mapRef = useRef(map);
    const gridRef = useRef(gridConfig);
    const draftRef = useRef(rulerTool);
    const campaignIdRef = useRef(campaignId);
    useEffect(() => { mapRef.current = map; }, [map]);
    useEffect(() => { gridRef.current = gridConfig; }, [gridConfig]);
    useEffect(() => { draftRef.current = rulerTool; }, [rulerTool]);
    useEffect(() => { campaignIdRef.current = campaignId; }, [campaignId]);

    // Root container
    useEffect(() => {
        if (!viewport) return;
        const root = new PIXI.Container();
        root.zIndex = RENDER_LAYERS.ROUTES + 5;
        root.sortableChildren = true;
        viewport.addChild(root);
        rootRef.current = root;

        const draftG = new PIXI.Graphics();
        draftG.zIndex = 2;
        root.addChild(draftG);
        draftGRef.current = draftG;

        const draftLabel = makeLabel();
        draftLabel.zIndex = 3;
        root.addChild(draftLabel);
        draftLabelRef.current = draftLabel;

        const nodes = rulerNodesRef.current;
        return () => {
            for (const node of nodes.values()) {
                safeDestroy(node.container);
            }
            nodes.clear();
            safeDestroy(root);
            rootRef.current = null;
            draftGRef.current = null;
            draftLabelRef.current = null;
        };
    }, [viewport]);

    // Synced rulers redraw
    useEffect(() => {
        const root = rootRef.current;
        if (!viewport || !root) return;

        const scale = viewport.scale.x || 1;
        const seen = new Set();

        for (const ruler of mapRulers) {
            if (!ruler?.id || !ruler.a || !ruler.b) continue;
            seen.add(ruler.id);
            let node = rulerNodesRef.current.get(ruler.id);
            if (!node) {
                const container = new PIXI.Container();
                container.zIndex = 1;
                const g = new PIXI.Graphics();
                const label = makeLabel();
                container.addChild(g);
                container.addChild(label);
                root.addChild(container);
                node = { container, g, label, deleteBtn: null };
                rulerNodesRef.current.set(ruler.id, node);
            }

            drawRulerLine(node.g, node.label, ruler.a, ruler.b, scale, mapRef.current, { preview: false });

            // Delete button at top-right corner of A/B bounding box
            if (!node.deleteBtn) {
                const id = ruler.id;
                node.deleteBtn = makeDeleteButton(() => {
                    const cid = campaignIdRef.current;
                    if (cid) removeMapRuler(cid, id).catch(console.error);
                });
                node.container.addChild(node.deleteBtn);
            }
            placeDeleteButton(node.deleteBtn, ruler, scale);
        }

        for (const [id, node] of rulerNodesRef.current.entries()) {
            if (!seen.has(id)) {
                safeDestroy(node.container);
                rulerNodesRef.current.delete(id);
            }
        }

        // `zoomed` fires once per wheel event, so this path only updates transforms.
        const onZoom = () => {
            const s = viewport.scale.x || 1;
            for (const ruler of mapRulers) {
                const node = rulerNodesRef.current.get(ruler.id);
                if (!node || !ruler.a || !ruler.b) continue;
                drawRulerLine(node.g, node.label, ruler.a, ruler.b, s, mapRef.current);
                if (node.deleteBtn) placeDeleteButton(node.deleteBtn, ruler, s);
            }
        };
        viewport.on("zoomed", onZoom);
        return () => viewport.off("zoomed", onZoom);
    }, [viewport, mapRulers]);

    // Live draft preview
    useEffect(() => {
        const placing = rulerTool.active && !!rulerTool.draftA;
        if (!viewport || !app || !placing) {
            draftGRef.current?.clear();
            if (draftLabelRef.current) {
                draftLabelRef.current.text = "";
                draftLabelRef.current.visible = false;
            }
            return undefined;
        }

        const snapCursor = (worldX, worldY) => {
            const gc = gridRef.current;
            const cell = resolveCellSize(mapRef.current, gc);
            if (gc?.snap === false) {
                const { col, row } = worldToCell(worldX, worldY, cell);
                return { x: worldX, y: worldY, col, row };
            }
            const snapped = snapToGridCenter(worldX, worldY, cell);
            const { col, row } = worldToCell(snapped.x, snapped.y, cell);
            return { x: snapped.x, y: snapped.y, col, row };
        };

        // Dashes are rebuilt from scratch on each paint, so only repaint on input.
        let dirty = true;

        const onMove = (e) => {
            const world = viewport.toWorld(e.global.x, e.global.y);
            const next = snapCursor(world.x, world.y);
            const prev = cursorRef.current;
            if (next.x === prev.x && next.y === prev.y) return;
            cursorRef.current = next;
            dirty = true;
        };
        const onZoom = () => { dirty = true; };

        const onTick = () => {
            if (!dirty) return;
            const g = draftGRef.current;
            const label = draftLabelRef.current;
            const draft = draftRef.current?.draftA;
            if (!g || !label || !draft) return;
            dirty = false;
            drawRulerLine(g, label, draft, cursorRef.current, viewport.scale.x || 1, mapRef.current, {
                preview: true,
            });
        };

        viewport.on("pointermove", onMove);
        viewport.on("zoomed", onZoom);
        app.ticker.add(onTick);
        return () => {
            viewport.off("pointermove", onMove);
            viewport.off("zoomed", onZoom);
            app.ticker.remove(onTick);
        };
    }, [viewport, app, rulerTool.active, rulerTool.draftA]);

    return null;
}
