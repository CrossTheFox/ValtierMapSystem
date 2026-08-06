/**
 * Shared map drawings (circle / rect / polygon) + local drawTool draft.
 */
import * as PIXI from "pixi.js";
import { useEffect, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useApplication } from "@pixi/react";
import { useViewport } from "../context/ViewportContext";
import { safeDestroy } from "./pixiCleanup";
import { removeMapDrawing, updateMapDrawing } from "../../firebase/services/gameService";
import {
    aabbFromPoints,
    resolveCellSize,
    snapWorldToGridPoint,
} from "../utils/gridMath";
import {
    CIRCLE_MODES,
    DRAW_SHAPES,
    circleRadiusCells,
    drawingWorldPoints,
    normalizeDrawingPaths,
    parseDrawingColor,
    resnapDrawing,
    sameGridCell,
    translateDrawing,
} from "../utils/mapDrawings";
import {
    clearTokenSelection,
    clearRulerSelection,
    setSelectedDrawingIds,
} from "../store/uiSlice";
import { RENDER_LAYERS } from "../constants/renderLayers";

const CYAN = 0x00f2ea;
const PINK = 0xff66ff;
const DELETE_RED = 0xff2a3a;
const DELETE_RED_DARK = 0x1a0608;
const HANDLE_SIZE = 22;
const FILL_ALPHA = 0.12;

function makeMeasureLabel(fill = "#00f2ea") {
    const label = new PIXI.Text({
        text: "",
        style: {
            fontFamily: "Fira Code, Courier New, monospace",
            fontSize: 12,
            fontWeight: "bold",
            fill,
            stroke: { color: 0x000000, width: 3, join: "round" },
        },
    });
    label.anchor.set(0.5, 0.5);
    label.eventMode = "none";
    return label;
}

function drawCirclePart(g, a, b, scale, color, cellSize, {
    preview = false,
    circleMode = CIRCLE_MODES.ROUND,
    radiusCells: radiusOverride = null,
    label = null,
} = {}) {
    if (!a || !b) return;
    const radiusCells = Number.isFinite(radiusOverride)
        ? radiusOverride
        : circleRadiusCells(a, b);
    const rPx = Math.max(0, radiusCells) * (cellSize || 1);
    if (rPx < 1 && Math.hypot(b.x - a.x, b.y - a.y) < 1) return;

    if (circleMode === CIRCLE_MODES.SQUARE) {
        const half = rPx || Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
        const x = a.x - half;
        const y = a.y - half;
        const side = Math.max(half * 2, 1);
        g.rect(x, y, side, side);
        g.fill({ color, alpha: preview ? FILL_ALPHA * 0.7 : FILL_ALPHA });
        g.rect(x, y, side, side);
        g.stroke({ width: (preview ? 1.5 : 2) / scale, color, alpha: preview ? 0.7 : 1 });
    } else {
        const r = rPx || Math.hypot(b.x - a.x, b.y - a.y);
        if (r < 1) return;
        g.circle(a.x, a.y, r);
        g.fill({ color, alpha: preview ? FILL_ALPHA * 0.7 : FILL_ALPHA });
        g.circle(a.x, a.y, r);
        g.stroke({ width: (preview ? 1.5 : 2) / scale, color, alpha: preview ? 0.7 : 1 });
    }

    // Center + radius spoke for clarity
    g.circle(a.x, a.y, 3.5 / scale);
    g.fill({ color, alpha: preview ? 0.7 : 1 });
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.stroke({
        width: 1.25 / scale,
        color,
        alpha: preview ? 0.45 : 0.65,
        pixelLine: true,
    });

    if (label) {
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        label.text = `${radiusCells} sq`;
        label.style.fill = `#${color.toString(16).padStart(6, "0")}`;
        label.visible = true;
        label.x = midX;
        label.y = midY - 10 / scale;
        label.scale.set(1 / scale);
    }
}

function drawRectPart(g, a, b, scale, color, { preview = false } = {}) {
    if (!a || !b) return;
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const w = Math.abs(b.x - a.x);
    const h = Math.abs(b.y - a.y);
    if (w < 1 && h < 1) return;
    g.rect(x, y, Math.max(w, 1), Math.max(h, 1));
    g.fill({ color, alpha: preview ? FILL_ALPHA * 0.7 : FILL_ALPHA });
    g.rect(x, y, Math.max(w, 1), Math.max(h, 1));
    g.stroke({ width: (preview ? 1.5 : 2) / scale, color, alpha: preview ? 0.7 : 1 });
}

function drawPolygonPart(g, points, scale, color, { preview = false, closed = true } = {}) {
    const pts = Array.isArray(points) ? points : [];
    if (pts.length < 2) return;
    const flat = pts.map((p) => ({ x: p.x, y: p.y }));
    const doClose = closed && pts.length >= 3;
    g.poly(flat, doClose);
    if (doClose) {
        g.fill({ color, alpha: preview ? FILL_ALPHA * 0.7 : FILL_ALPHA });
    }
    g.poly(flat, doClose);
    g.stroke({
        width: (preview ? 1.75 : 2.25) / scale,
        color,
        alpha: preview ? 0.75 : 1,
        cap: "round",
        join: "round",
    });
    for (const p of pts) {
        g.circle(p.x, p.y, 3.25 / scale);
        g.fill({ color, alpha: preview ? 0.65 : 0.95 });
    }
}

function drawDrawingGraphics(g, drawing, scale, cellSize, {
    preview = false,
    selected = false,
    label = null,
} = {}) {
    g.clear();
    if (label) {
        label.text = "";
        label.visible = false;
    }
    if (!drawing) return;

    const fallbackColor = preview ? PINK : CYAN;
    const color = parseDrawingColor(drawing.color, fallbackColor);

    const parts = Array.isArray(drawing.parts) && drawing.parts.length
        ? drawing.parts
        : null;

    const drawOne = (part, isPrimaryLabel) => {
        const partColor = parseDrawingColor(part.color, color);
        if (part.shape === DRAW_SHAPES.CIRCLE) {
            drawCirclePart(g, part.a, part.b, scale, partColor, cellSize, {
                preview,
                circleMode: part.circleMode || CIRCLE_MODES.ROUND,
                radiusCells: part.radiusCells,
                label: isPrimaryLabel ? label : null,
            });
        } else if (part.shape === DRAW_SHAPES.RECT) {
            drawRectPart(g, part.a, part.b, scale, partColor, { preview });
        } else if (part.shape === DRAW_SHAPES.FREEHAND) {
            const pts = Array.isArray(part.points)
                ? part.points
                : normalizeDrawingPaths(part.paths)[0];
            drawPolygonPart(g, pts, scale, partColor, {
                preview,
                closed: part.closed !== false,
            });
        }
    };

    if (parts) {
        parts.forEach((part, idx) => drawOne(part, idx === 0));
    } else if (drawing.shape === DRAW_SHAPES.CIRCLE) {
        drawCirclePart(g, drawing.a, drawing.b, scale, color, cellSize, {
            preview,
            circleMode: drawing.circleMode || CIRCLE_MODES.ROUND,
            radiusCells: drawing.radiusCells,
            label,
        });
    } else if (drawing.shape === DRAW_SHAPES.RECT) {
        drawRectPart(g, drawing.a, drawing.b, scale, color, { preview });
    } else if (drawing.shape === DRAW_SHAPES.FREEHAND) {
        if (Array.isArray(drawing.points) && drawing.points.length) {
            drawPolygonPart(g, drawing.points, scale, color, {
                preview,
                closed: drawing.closed !== false,
            });
        } else {
            for (const path of normalizeDrawingPaths(drawing.paths)) {
                drawPolygonPart(g, path, scale, color, {
                    preview,
                    closed: drawing.closed === true,
                });
            }
        }
    }

    if (selected) {
        const box = aabbFromPoints(drawingWorldPoints(drawing));
        if (box) {
            const pad = 10 / scale;
            g.rect(box.minX - pad, box.minY - pad, box.width + pad * 2, box.height + pad * 2);
            g.stroke({ width: 1.5 / scale, color: CYAN, alpha: 0.85 });
        }
    }
}

function handleWorldPos(drawing) {
    const box = aabbFromPoints(drawingWorldPoints(drawing));
    if (!box) return { x: 0, y: 0 };
    return { x: box.maxX, y: box.minY };
}

function makeDrawingHandle({ onSelect, onDragStart, onDragMove, onDragEnd, onDelete }) {
    const btn = new PIXI.Container();
    btn.eventMode = "static";
    btn.cursor = "grab";
    btn.__markHandle = true;
    const half = HANDLE_SIZE / 2;
    btn.hitArea = new PIXI.Rectangle(-half, -half, HANDLE_SIZE, HANDLE_SIZE);

    const g = new PIXI.Graphics();
    const s = HANDLE_SIZE / 2 - 1;
    g.roundRect(-s, -s, s * 2, s * 2, 3);
    g.fill({ color: 0x140a12, alpha: 0.95 });
    g.roundRect(-s, -s, s * 2, s * 2, 3);
    g.stroke({ width: 1.75, color: PINK, alpha: 1 });
    g.moveTo(-s * 0.35, 0);
    g.lineTo(s * 0.35, 0);
    g.moveTo(0, -s * 0.35);
    g.lineTo(0, s * 0.35);
    g.stroke({ width: 1.25, color: PINK, alpha: 0.7, cap: "round" });
    btn.addChild(g);

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

function placeHandle(btn, drawing, scale) {
    const corner = handleWorldPos(drawing);
    btn.x = corner.x;
    btn.y = corner.y;
    btn.scale.set(1 / (scale || 1));
}

export default function DrawingsLayer() {
    const viewport = useViewport();
    const { app } = useApplication();
    const dispatch = useDispatch();
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const map = useSelector((s) => s.world.map);
    const mapId = useSelector((s) => s.world.activeMapId ?? s.world.map?.id);
    const gridConfig = useSelector((s) => s.world.gridConfig);
    const drawings = useSelector((s) => s.game.drawings ?? {});
    const drawTool = useSelector((s) => s.ui.drawTool);
    const selectedDrawingIds = useSelector((s) => s.ui.selectedDrawingIds ?? []);

    const rootRef = useRef(null);
    const draftGRef = useRef(null);
    const draftLabelRef = useRef(null);
    const cursorRef = useRef({ x: 0, y: 0 });
    const nodesRef = useRef(new Map());
    const dragRef = useRef(null);

    const mapDrawings = useMemo(
        () => Object.values(drawings).filter((d) => d && (!mapId || d.mapId === mapId)),
        [drawings, mapId],
    );

    const mapRef = useRef(map);
    const gridRef = useRef(gridConfig);
    const drawToolRef = useRef(drawTool);
    const campaignIdRef = useRef(campaignId);
    const selectedRef = useRef(selectedDrawingIds);
    const drawingsRef = useRef(drawings);
    useEffect(() => { mapRef.current = map; }, [map]);
    useEffect(() => { gridRef.current = gridConfig; }, [gridConfig]);
    useEffect(() => { drawToolRef.current = drawTool; }, [drawTool]);
    useEffect(() => { campaignIdRef.current = campaignId; }, [campaignId]);
    useEffect(() => { selectedRef.current = selectedDrawingIds; }, [selectedDrawingIds]);
    useEffect(() => { drawingsRef.current = drawings; }, [drawings]);

    useEffect(() => {
        dispatch(setSelectedDrawingIds([]));
    }, [mapId, dispatch]);

    useEffect(() => {
        if (!viewport) return;
        const root = new PIXI.Container();
        root.zIndex = RENDER_LAYERS.ROUTES + 4;
        root.sortableChildren = true;
        viewport.addChild(root);
        rootRef.current = root;

        const draftG = new PIXI.Graphics();
        draftG.zIndex = 2;
        root.addChild(draftG);
        draftGRef.current = draftG;

        const draftLabel = makeMeasureLabel("#ff66ff");
        draftLabel.zIndex = 3;
        root.addChild(draftLabel);
        draftLabelRef.current = draftLabel;

        const nodes = nodesRef.current;
        return () => {
            for (const node of nodes.values()) safeDestroy(node.container);
            nodes.clear();
            safeDestroy(root);
            rootRef.current = null;
            draftGRef.current = null;
            draftLabelRef.current = null;
        };
    }, [viewport]);

    useEffect(() => {
        const root = rootRef.current;
        if (!viewport || !root) return;
        // Viewport can briefly exist before scale is attached (mount / map swap).
        if (!viewport.scale) return;

        const scale = viewport.scale.x || 1;
        const cellSize = resolveCellSize(mapRef.current, gridRef.current);
        const seen = new Set();
        const selected = new Set(selectedDrawingIds);

        for (const drawing of mapDrawings) {
            if (!drawing?.id) continue;
            seen.add(drawing.id);
            let node = nodesRef.current.get(drawing.id);
            if (!node) {
                const container = new PIXI.Container();
                container.zIndex = 1;
                container.__drawingId = drawing.id;
                const g = new PIXI.Graphics();
                g.eventMode = "none";
                container.addChild(g);
                const label = makeMeasureLabel();
                label.zIndex = 2;
                container.addChild(label);
                root.addChild(container);
                node = { container, g, label, handle: null, base: drawing };
                nodesRef.current.set(drawing.id, node);
            }
            node.base = drawing;
            drawDrawingGraphics(node.g, drawing, scale, cellSize, {
                selected: selected.has(drawing.id),
                label: node.label,
            });

            if (!node.handle) {
                const id = drawing.id;
                node.handle = makeDrawingHandle({
                    onSelect: (e) => {
                        dispatch(clearTokenSelection());
                        dispatch(clearRulerSelection());
                        if (e.shiftKey) {
                            const cur = selectedRef.current || [];
                            const next = cur.includes(id)
                                ? cur.filter((x) => x !== id)
                                : [...cur, id];
                            dispatch(setSelectedDrawingIds(next));
                        } else {
                            dispatch(setSelectedDrawingIds([id]));
                        }
                    },
                    onDragStart: () => {
                        viewport.plugins?.pause?.("drag");
                        dragRef.current = {
                            id,
                            start: { ...(drawingsRef.current?.[id] || node.base) },
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
                        const moved = translateDrawing(drag.start, dx, dy);
                        const s = viewport.scale.x || 1;
                        const cs = resolveCellSize(mapRef.current, gridRef.current);
                        drawDrawingGraphics(node.g, moved, s, cs, {
                            selected: true,
                            label: node.label,
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
                        let moved = translateDrawing(drag.start, drag.lastDx, drag.lastDy);
                        moved = resnapDrawing(moved, (x, y) =>
                            snapWorldToGridPoint(x, y, mapRef.current, gridRef.current),
                        );
                        if (moved.shape === DRAW_SHAPES.CIRCLE && moved.a && moved.b) {
                            moved.radiusCells = circleRadiusCells(moved.a, moved.b);
                        }
                        updateMapDrawing(cid, id, {
                            ...moved,
                            mapId: moved.mapId || mapId,
                        }).catch(console.error);
                    },
                    onDelete: () => {
                        const cid = campaignIdRef.current;
                        if (cid) removeMapDrawing(cid, id).catch(console.error);
                        dispatch(setSelectedDrawingIds(
                            (selectedRef.current || []).filter((x) => x !== id),
                        ));
                    },
                });
                node.handle.__drawingId = id;
                node.container.addChild(node.handle);
            }
            placeHandle(node.handle, drawing, scale);
        }

        for (const [id, node] of nodesRef.current.entries()) {
            if (!seen.has(id)) {
                safeDestroy(node.container);
                nodesRef.current.delete(id);
            }
        }

        const onZoom = () => {
            const s = viewport.scale.x || 1;
            const cs = resolveCellSize(mapRef.current, gridRef.current);
            const sel = new Set(selectedRef.current || []);
            for (const drawing of mapDrawings) {
                const node = nodesRef.current.get(drawing.id);
                if (!node) continue;
                drawDrawingGraphics(node.g, drawing, s, cs, {
                    selected: sel.has(drawing.id),
                    label: node.label,
                });
                if (node.handle) placeHandle(node.handle, drawing, s);
            }
        };
        viewport.on("zoomed", onZoom);
        return () => viewport.off("zoomed", onZoom);
    }, [viewport, mapDrawings, selectedDrawingIds, dispatch, mapId]);

    // Draft preview
    useEffect(() => {
        const placing = !!drawTool?.active;
        if (!viewport || !app || !placing) {
            draftGRef.current?.clear();
            if (draftLabelRef.current) {
                draftLabelRef.current.text = "";
                draftLabelRef.current.visible = false;
            }
            return undefined;
        }

        let dirty = true;
        const onMove = (e) => {
            const world = viewport.toWorld(e.global.x, e.global.y);
            cursorRef.current = { x: world.x, y: world.y };
            dirty = true;
        };
        const onZoom = () => { dirty = true; };

        const onTick = () => {
            if (!dirty) return;
            dirty = false;
            const g = draftGRef.current;
            const label = draftLabelRef.current;
            const dt = drawToolRef.current;
            if (!g || !dt) return;
            const scale = viewport.scale.x || 1;
            const cellSize = resolveCellSize(mapRef.current, gridRef.current);
            const cursor = cursorRef.current;
            const snapped = snapWorldToGridPoint(
                cursor.x,
                cursor.y,
                mapRef.current,
                gridRef.current,
            );
            const colorHex = dt.color || "#ff66ff";

            const preview = {
                shape: dt.shape,
                parts: [],
                color: colorHex,
                circleMode: dt.circleMode,
            };

            if (Array.isArray(dt.draftParts) && dt.draftParts.length) {
                preview.parts = [...dt.draftParts];
                preview.shape = "compound";
            }

            if (dt.draftPoint && (dt.shape === DRAW_SHAPES.CIRCLE || dt.shape === DRAW_SHAPES.RECT)) {
                preview.parts = [
                    ...(preview.parts || []),
                    {
                        shape: dt.shape,
                        a: dt.draftPoint,
                        b: snapped,
                        circleMode: dt.circleMode,
                        radiusCells: circleRadiusCells(dt.draftPoint, snapped),
                        color: colorHex,
                    },
                ];
                preview.shape = "compound";
            }

            if (dt.shape === DRAW_SHAPES.FREEHAND) {
                const draft = Array.isArray(dt.draftPath) ? dt.draftPath : [];
                if (draft.length) {
                    const nearClose = draft.length >= 3 && (
                        sameGridCell(snapped, draft[0]) || sameGridCell(snapped, draft[draft.length - 1])
                    );
                    const live = nearClose ? draft : [...draft, snapped];
                    preview.parts = [
                        ...(preview.parts || []),
                        {
                            shape: DRAW_SHAPES.FREEHAND,
                            points: live,
                            closed: nearClose,
                            color: colorHex,
                        },
                    ];
                    preview.shape = "compound";
                }
            }

            const hasContent = preview.parts?.length > 0;
            if (!hasContent) {
                g.clear();
                if (label) {
                    label.text = "";
                    label.visible = false;
                }
                return;
            }
            drawDrawingGraphics(g, preview, scale, cellSize, {
                preview: true,
                label,
            });
        };

        dirty = true;
        viewport.on("pointermove", onMove);
        viewport.on("zoomed", onZoom);
        app.ticker.add(onTick);
        return () => {
            viewport.off("pointermove", onMove);
            viewport.off("zoomed", onZoom);
            app.ticker.remove(onTick);
        };
    }, [
        viewport,
        app,
        drawTool?.active,
        drawTool?.shape,
        drawTool?.circleMode,
        drawTool?.color,
        drawTool?.draftPoint,
        drawTool?.draftParts,
        drawTool?.draftPath,
        drawTool?.draftPaths,
    ]);

    return null;
}
