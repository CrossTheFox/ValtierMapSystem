/**
 * Shared table rulers + local placement draft.
 * Synced rulers come from game.rulers; draft from ui.rulerTool.draftPoints.
 */
import * as PIXI from "pixi.js";
import { useEffect, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useApplication } from "@pixi/react";
import { useViewport } from "../context/ViewportContext";
import { safeDestroy } from "./pixiCleanup";
import { removeMapRuler, updateMapRuler } from "../../firebase/services/gameService";
import {
    aabbFromPoints,
    buildPolylineMeasure,
    formatMapDistance,
    measureGridCells,
    normalizeRulerPoints,
    resolveCellSize,
    resnapPoints,
    snapToGridCenter,
    translatePoints,
    worldToCell,
} from "../utils/gridMath";
import {
    clearTokenSelection,
    clearDrawingSelection,
    setSelectedRulerIds,
} from "../store/uiSlice";
import { RENDER_LAYERS } from "../constants/renderLayers";

const CYAN = 0x00f2ea;
const CYAN_STR = "#00f2ea";
const PINK = 0xff66ff;
const DARK_BG = 0x050508;
const DELETE_RED = 0xff2a3a;
const DELETE_RED_DARK = 0x1a0608;
const HANDLE_SIZE = 22;

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

function labelForSegment(a, b, map) {
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

function labelForPolyline(points, map) {
    const m = buildPolylineMeasure(points, map);
    const parts = [
        `${m.totalCells} casillas`,
        m.diagonal > 0 ? `${m.diagonal} diag` : null,
        m.straight > 0 ? `${m.straight} recto` : null,
        m.distanceLabel || null,
    ].filter(Boolean);
    return parts.join(" · ");
}

function drawPolyline(g, labelText, points, scale, map, { preview = false, selected = false } = {}) {
    g.clear();
    const pts = Array.isArray(points) ? points : [];
    if (pts.length < 1) {
        if (labelText) {
            labelText.text = "";
            labelText.visible = false;
        }
        return;
    }

    const color = preview ? PINK : CYAN;
    const colorStr = preview ? "#ff66ff" : CYAN_STR;
    const dashPx = 18;
    const gapPx = 7;
    const lineW = selected ? 2.75 : 2;
    const glowW = selected ? 14 : 10;
    const dotR = 5;
    const ringR = 10;

    for (let i = 1; i < pts.length; i += 1) {
        const a = pts[i - 1];
        const b = pts[i];
        g.setStrokeStyle({ width: glowW / scale, color, alpha: 0.12 });
        appendDashes(g, a.x, a.y, b.x, b.y, dashPx / scale, gapPx / scale);
        g.stroke();
        g.setStrokeStyle({ width: lineW / scale, color, alpha: preview ? 0.65 : 1 });
        appendDashes(g, a.x, a.y, b.x, b.y, dashPx / scale, gapPx / scale);
        g.stroke();
    }

    // Live segment from last point to cursor is drawn by caller as last two pts
    const drawNode = (x, y, fillAlpha, ringAlpha) => {
        g.circle(x, y, dotR / scale);
        g.fill({ color, alpha: fillAlpha });
        g.circle(x, y, dotR / scale);
        g.stroke({ width: lineW / scale, color, alpha: 0.5 });
        g.circle(x, y, ringR / scale);
        g.stroke({ width: (lineW * 0.75) / scale, color, alpha: ringAlpha });
    };

    for (let i = 0; i < pts.length; i += 1) {
        const p = pts[i];
        const isLast = i === pts.length - 1;
        drawNode(p.x, p.y, preview && isLast ? 0.4 : 1, preview && isLast ? 0.15 : 0.25);
    }

    if (selected) {
        const box = aabbFromPoints(pts);
        if (box) {
            const pad = 10 / scale;
            g.rect(box.minX - pad, box.minY - pad, box.width + pad * 2, box.height + pad * 2);
            g.stroke({ width: 1.5 / scale, color: CYAN, alpha: 0.85 });
        }
    }

    if (!labelText || pts.length < 2) {
        if (labelText) labelText.visible = false;
        return;
    }

    const a = pts[pts.length - 2];
    const b = pts[pts.length - 1];
    const pixelDist = Math.hypot(b.x - a.x, b.y - a.y);
    if (pixelDist < (ringR * 3) / scale && pts.length === 2) {
        labelText.visible = false;
        return;
    }

    const text = pts.length > 2 ? labelForPolyline(pts, map) : labelForSegment(a, b, map);
    labelText.text = `◈  ${text}`;
    labelText.style.fill = colorStr;
    labelText.scale.set(1 / scale);
    labelText.visible = true;

    const lx = (a.x + b.x) / 2;
    const ly = (a.y + b.y) / 2 - 26 / scale;
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

function handleWorldPos(points) {
    const box = aabbFromPoints(points);
    if (!box) return { x: 0, y: 0 };
    return { x: box.maxX, y: box.minY };
}

/**
 * Square select/drag handle with a small X delete hit on the top-right corner.
 */
function makeRulerHandle({ onSelect, onDragStart, onDragMove, onDragEnd, onDelete }) {
    const btn = new PIXI.Container();
    btn.eventMode = "static";
    btn.cursor = "grab";
    btn.__markHandle = true;
    const half = HANDLE_SIZE / 2;
    btn.hitArea = new PIXI.Rectangle(-half, -half, HANDLE_SIZE, HANDLE_SIZE);

    const g = new PIXI.Graphics();
    const s = HANDLE_SIZE / 2 - 1;
    g.roundRect(-s, -s, s * 2, s * 2, 3);
    g.fill({ color: 0x0a1214, alpha: 0.95 });
    g.roundRect(-s, -s, s * 2, s * 2, 3);
    g.stroke({ width: 1.75, color: CYAN, alpha: 1 });
    // Inner crosshair
    g.moveTo(-s * 0.35, 0);
    g.lineTo(s * 0.35, 0);
    g.moveTo(0, -s * 0.35);
    g.lineTo(0, s * 0.35);
    g.stroke({ width: 1.25, color: CYAN, alpha: 0.7, cap: "round" });
    btn.addChild(g);

    // Delete X chip (top-right of square)
    const del = new PIXI.Container();
    del.eventMode = "static";
    del.cursor = "pointer";
    del.__markHandle = true;
    del.x = s - 2;
    del.y = -s + 2;
    del.hitArea = new PIXI.Circle(0, 0, 9);
    const dg = new PIXI.Graphics();
    dg.circle(0, 0, 7);
    dg.fill({ color: DELETE_RED_DARK, alpha: 0.98 });
    dg.circle(0, 0, 7);
    dg.stroke({ width: 1.5, color: DELETE_RED, alpha: 1 });
    const arm = 3.2;
    dg.moveTo(-arm, -arm);
    dg.lineTo(arm, arm);
    dg.moveTo(arm, -arm);
    dg.lineTo(-arm, arm);
    dg.stroke({ width: 1.8, color: DELETE_RED, alpha: 1, cap: "round" });
    del.addChild(dg);
    btn.addChild(del);

    let dragging = false;
    let startGlobal = null;

    del.on("pointerdown", (e) => {
        e.stopPropagation?.();
        e.stopImmediatePropagation?.();
    });
    del.on("pointertap", (e) => {
        e.stopPropagation?.();
        onDelete?.();
    });

    btn.on("pointerdown", (e) => {
        if (e.target === del || e.target?.parent === del) return;
        if (e.button !== 0) return;
        e.stopPropagation?.();
        dragging = true;
        startGlobal = { x: e.global.x, y: e.global.y };
        btn.cursor = "grabbing";
        onSelect?.(e);
        onDragStart?.(e);
    });

    btn.on("globalpointermove", (e) => {
        if (!dragging || !startGlobal) return;
        e.stopPropagation?.();
        onDragMove?.(e, startGlobal);
    });

    const endDrag = (e) => {
        if (!dragging) return;
        dragging = false;
        btn.cursor = "grab";
        onDragEnd?.(e, startGlobal);
        startGlobal = null;
    };
    btn.on("pointerup", endDrag);
    btn.on("pointerupoutside", endDrag);
    btn.on("globalpointerup", endDrag);

    btn.zIndex = 4;
    return btn;
}

function placeHandle(btn, points, scale) {
    const corner = handleWorldPos(points);
    btn.x = corner.x;
    btn.y = corner.y;
    btn.scale.set(1 / (scale || 1));
}

export default function RulersLayer() {
    const viewport = useViewport();
    const { app } = useApplication();
    const dispatch = useDispatch();
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const map = useSelector((s) => s.world.map);
    const mapId = useSelector((s) => s.world.activeMapId ?? s.world.map?.id);
    const gridConfig = useSelector((s) => s.world.gridConfig);
    const rulers = useSelector((s) => s.game.rulers ?? {});
    const rulerTool = useSelector((s) => s.ui.rulerTool);
    const selectedRulerIds = useSelector((s) => s.ui.selectedRulerIds ?? []);

    const rootRef = useRef(null);
    const draftGRef = useRef(null);
    const draftLabelRef = useRef(null);
    const cursorRef = useRef({ x: 0, y: 0, col: 0, row: 0 });
    const rulerNodesRef = useRef(new Map());
    const dragRef = useRef(null);

    const mapRulers = useMemo(() => {
        return Object.values(rulers).filter((r) => r && (!mapId || r.mapId === mapId));
    }, [rulers, mapId]);

    const mapRef = useRef(map);
    const gridRef = useRef(gridConfig);
    const draftRef = useRef(rulerTool);
    const campaignIdRef = useRef(campaignId);
    const selectedRef = useRef(selectedRulerIds);
    const rulersRef = useRef(rulers);
    useEffect(() => { mapRef.current = map; }, [map]);
    useEffect(() => { gridRef.current = gridConfig; }, [gridConfig]);
    useEffect(() => { draftRef.current = rulerTool; }, [rulerTool]);
    useEffect(() => { campaignIdRef.current = campaignId; }, [campaignId]);
    useEffect(() => { selectedRef.current = selectedRulerIds; }, [selectedRulerIds]);
    useEffect(() => { rulersRef.current = rulers; }, [rulers]);

    // Clear selection on map change
    useEffect(() => {
        dispatch(setSelectedRulerIds([]));
    }, [mapId, dispatch]);

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

    // Synced rulers redraw + handle binding
    useEffect(() => {
        const root = rootRef.current;
        if (!viewport || !root) return;
        // Viewport can briefly exist before scale is attached (mount / map swap).
        if (!viewport.scale) return;

        const scale = viewport.scale.x || 1;
        const seen = new Set();
        const selected = new Set(selectedRulerIds);

        for (const ruler of mapRulers) {
            const points = normalizeRulerPoints(ruler);
            if (!ruler?.id || points.length < 2) continue;
            seen.add(ruler.id);
            let node = rulerNodesRef.current.get(ruler.id);
            if (!node) {
                const container = new PIXI.Container();
                container.zIndex = 1;
                container.__rulerId = ruler.id;
                const g = new PIXI.Graphics();
                g.eventMode = "none";
                const label = makeLabel();
                container.addChild(g);
                container.addChild(label);
                root.addChild(container);
                node = { container, g, label, handle: null, basePoints: points };
                rulerNodesRef.current.set(ruler.id, node);
            }

            node.basePoints = points;
            const isSelected = selected.has(ruler.id);
            drawPolyline(node.g, node.label, points, scale, mapRef.current, {
                preview: false,
                selected: isSelected,
            });

            if (!node.handle) {
                const id = ruler.id;
                node.handle = makeRulerHandle({
                    onSelect: (e) => {
                        dispatch(clearTokenSelection());
                        dispatch(clearDrawingSelection());
                        if (e.shiftKey) {
                            const cur = selectedRef.current || [];
                            const next = cur.includes(id)
                                ? cur.filter((x) => x !== id)
                                : [...cur, id];
                            dispatch(setSelectedRulerIds(next));
                        } else {
                            dispatch(setSelectedRulerIds([id]));
                        }
                    },
                    onDragStart: () => {
                        viewport.plugins?.pause?.("drag");
                        const pts = normalizeRulerPoints(rulersRef.current?.[id]) || node.basePoints;
                        dragRef.current = {
                            id,
                            startPoints: pts.map((p) => ({ ...p })),
                            lastDx: 0,
                            lastDy: 0,
                        };
                    },
                    onDragMove: (e, startGlobal) => {
                        const drag = dragRef.current;
                        if (!drag || drag.id !== id) return;
                        const w0 = viewport.toWorld(startGlobal.x, startGlobal.y);
                        const w1 = viewport.toWorld(e.global.x, e.global.y);
                        const dx = w1.x - w0.x;
                        const dy = w1.y - w0.y;
                        drag.lastDx = dx;
                        drag.lastDy = dy;
                        const moved = translatePoints(drag.startPoints, dx, dy);
                        const s = viewport.scale.x || 1;
                        drawPolyline(node.g, node.label, moved, s, mapRef.current, {
                            preview: false,
                            selected: true,
                        });
                        placeHandle(node.handle, moved, s);
                    },
                    onDragEnd: () => {
                        viewport.plugins?.resume?.("drag");
                        const drag = dragRef.current;
                        dragRef.current = null;
                        if (!drag || drag.id !== id) return;
                        const cid = campaignIdRef.current;
                        if (!cid) return;
                        const moved = translatePoints(drag.startPoints, drag.lastDx, drag.lastDy);
                        const snapped = resnapPoints(moved, mapRef.current, gridRef.current);
                        const measure = buildPolylineMeasure(snapped, mapRef.current);
                        const prev = rulersRef.current?.[id] || {};
                        updateMapRuler(cid, id, {
                            mapId: prev.mapId || mapId,
                            points: snapped,
                            a: snapped[0],
                            b: snapped[snapped.length - 1],
                            straight: measure.straight,
                            diagonal: measure.diagonal,
                            totalCells: measure.totalCells,
                            meters: measure.meters,
                            distanceLabel: measure.distanceLabel,
                            createdBy: prev.createdBy ?? null,
                            createdByName: prev.createdByName ?? null,
                            createdAt: prev.createdAt ?? Date.now(),
                        }).catch(console.error);
                    },
                    onDelete: () => {
                        const cid = campaignIdRef.current;
                        if (cid) removeMapRuler(cid, id).catch(console.error);
                        dispatch(setSelectedRulerIds(
                            (selectedRef.current || []).filter((x) => x !== id),
                        ));
                    },
                });
                node.handle.__rulerId = id;
                node.container.addChild(node.handle);
            }
            placeHandle(node.handle, points, scale);
        }

        for (const [id, node] of rulerNodesRef.current.entries()) {
            if (!seen.has(id)) {
                safeDestroy(node.container);
                rulerNodesRef.current.delete(id);
            }
        }

        const onZoom = () => {
            const s = viewport.scale.x || 1;
            const sel = new Set(selectedRef.current || []);
            for (const ruler of mapRulers) {
                const node = rulerNodesRef.current.get(ruler.id);
                const points = normalizeRulerPoints(ruler);
                if (!node || points.length < 2) continue;
                drawPolyline(node.g, node.label, points, s, mapRef.current, {
                    selected: sel.has(ruler.id),
                });
                if (node.handle) placeHandle(node.handle, points, s);
            }
        };
        viewport.on("zoomed", onZoom);
        return () => viewport.off("zoomed", onZoom);
    }, [viewport, mapRulers, selectedRulerIds, dispatch, mapId]);

    // Live draft preview (anchored segments + cursor)
    useEffect(() => {
        const draftPoints = rulerTool?.draftPoints || [];
        const placing = rulerTool.active && draftPoints.length > 0;
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
            const anchored = draftRef.current?.draftPoints || [];
            if (!g || !label || anchored.length === 0) return;
            dirty = false;
            const pts = [...anchored, cursorRef.current];
            drawPolyline(g, label, pts, viewport.scale.x || 1, mapRef.current, {
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
    }, [viewport, app, rulerTool.active, rulerTool.draftPoints]);

    return null;
}
