import * as PIXI from "pixi.js";
import { useApplication } from "@pixi/react";
import { Viewport } from "pixi-viewport";
import { useEffect, useRef, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RENDER_LAYERS } from "../constants/renderLayers";
import { safeDestroy } from "./pixiCleanup";
import { loadTexture } from "../../firebase/services/assetLoader";
import {
    setIsSelectingPosition,
    restoreDialog,
    setSelectedWorldPosition,
    openContextMenu,
    closeContextMenu,
    pushRulerDraftPoint,
    setRulerDraftPoints,
    clearRulerDraft,
    setDrawDraftPoint,
    pushDrawDraftPart,
    setDrawDraftPath,
    clearDrawDraft,
} from "../store/uiSlice";
import { DIALOG_IDS } from "../constants/dialogIds";
import locationIconPath from "../assets/LocationNode.svg";
import { UI_COLORS } from "../constants/uiColors";
import {
    buildPolylineMeasure,
    resolveGridDimensions,
    snapWorldToGridPoint,
} from "../utils/gridMath";
import {
    CIRCLE_MODES,
    DRAW_SHAPES,
    circleRadiusCells,
    sameGridCell,
} from "../utils/mapDrawings";
import { addMapRuler, addMapDrawing } from "../../firebase/services/gameService";
import { EMPTY_TABLE_FILL, isEmptyTableMap } from "../constants/emptyTableMap";

const RIGHT_CLICK_DRAG_THRESHOLD = 5; // px — below this → treat as click, not drag

function eventCtrlKey(e) {
    return Boolean(e?.ctrlKey || e?.metaKey || e?.originalEvent?.ctrlKey || e?.originalEvent?.metaKey);
}

function persistRulerFromPoints(campaignId, mapId, points, profile, map) {
    if (!campaignId || !mapId || !points || points.length < 2) return;
    const measure = buildPolylineMeasure(points, map);
    return addMapRuler(campaignId, {
        mapId,
        points,
        a: points[0],
        b: points[points.length - 1],
        straight: measure.straight,
        diagonal: measure.diagonal,
        totalCells: measure.totalCells,
        meters: measure.meters,
        distanceLabel: measure.distanceLabel,
        createdBy: profile?.uid ?? null,
        createdByName: profile?.nickname ?? null,
    });
}

export default function MapViewportProvider({ children, onViewportReady }) {
    const { app } = useApplication();
    const dispatch = useDispatch();

    const { map, assetsStatus, gridConfig, selectedCampaignId, activeMapId } = useSelector((state) => state.world);
    const { isSelectingPosition, rulerTool, drawTool } = useSelector((state) => state.ui);
    const profile = useSelector((state) => state.player.profile);
    const gridConfigRef = useRef(gridConfig);
    const mapRef = useRef(map);
    useEffect(() => { gridConfigRef.current = gridConfig; }, [gridConfig]);
    useEffect(() => { mapRef.current = map; }, [map]);

    const [viewport, setViewport] = useState(null);
    const viewportRef = useRef(null);
    const ghostRef    = useRef(null);

    const rulerToolRef = useRef(rulerTool);
    const drawToolRef = useRef(drawTool);
    const isSelectingRef = useRef(isSelectingPosition);
    const campaignIdRef = useRef(selectedCampaignId);
    const mapIdRef = useRef(activeMapId ?? map?.id);
    const profileRef = useRef(profile);
    useEffect(() => { rulerToolRef.current = rulerTool; }, [rulerTool]);
    useEffect(() => { drawToolRef.current = drawTool; }, [drawTool]);
    useEffect(() => { isSelectingRef.current = isSelectingPosition; }, [isSelectingPosition]);
    useEffect(() => { campaignIdRef.current = selectedCampaignId; }, [selectedCampaignId]);
    useEffect(() => {
        mapIdRef.current = activeMapId ?? map?.id ?? null;
    }, [activeMapId, map?.id]);
    useEffect(() => { profileRef.current = profile; }, [profile]);

    // ── Create viewport ───────────────────────────────────────────
    useEffect(() => {
        if (!app || assetsStatus !== "succeeded" || !map) return;
        if (viewportRef.current) return;

        const canvas = app.canvas;
        const handleContextMenu = (e) => e.preventDefault();
        if (canvas) canvas.addEventListener("contextmenu", handleContextMenu);

        if (!("events" in app?.renderer)) {
            app.renderer.addSystem(PIXI.EventSystem, "events");
        }

        // Match GridLayer extent (cols×cell × rows×cell), not raw map px alone —
        // ceil(h/cell) can leave the grid taller/wider than map.width/height.
        const gridDims = resolveGridDimensions(map, gridConfigRef.current);
        const gridW = gridDims.columns * gridDims.cellSize;
        const gridH = gridDims.rows * gridDims.cellSize;
        const worldW = Math.max(map.width || 0, gridW, 1);
        const worldH = Math.max(map.height || 0, gridH, 1);

        const vp = new Viewport({
            screenWidth:  app.screen.width,
            screenHeight: app.screen.height,
            worldWidth:   worldW,
            worldHeight:  worldH,
            ticker: app.ticker,
            events: app.renderer.events,
        });

        vp.sortableChildren = true;

        vp
            .drag({ mouseButtons: "right" })  // right-click drags the map
            .pinch()
            .wheel({ percent: 0.1 })
            .decelerate()
            .clampZoom({ minScale: 0.1, maxScale: 5 });

        let mapSprite = null;
        let blankBoard = null;
        let mapLoadCancelled = false;

        const paintBlankBoard = () => {
            if (mapLoadCancelled || vp.destroyed) return;
            blankBoard = new PIXI.Graphics();
            blankBoard.rect(0, 0, worldW, worldH);
            blankBoard.fill({ color: EMPTY_TABLE_FILL });
            blankBoard.zIndex = RENDER_LAYERS.MAP;
            blankBoard.eventMode = "none";
            vp.addChild(blankBoard);
        };

        if (map.imageUrl && !isEmptyTableMap(map)) {
            (async () => {
                try {
                    const texture = await loadTexture(map.imageUrl);
                    if (mapLoadCancelled || vp.destroyed) return;
                    mapSprite = new PIXI.Sprite(texture);
                    mapSprite.anchor.set(0);
                    mapSprite.zIndex = RENDER_LAYERS.MAP;
                    vp.addChild(mapSprite);
                } catch (err) {
                    console.error("Error cargando mapa:", err);
                    paintBlankBoard();
                }
            })();
        } else {
            paintBlankBoard();
        }

        app.stage.addChild(vp);
        viewportRef.current = vp;
        setViewport(vp);
        onViewportReady?.(vp);

        return () => {
            mapLoadCancelled = true;
            onViewportReady?.(null);
            safeDestroy(ghostRef.current);
            ghostRef.current = null;
            safeDestroy(mapSprite);
            safeDestroy(blankBoard);
            try {
                if (vp.parent) vp.parent.removeChild(vp);
            } catch {
                /* strict mode / teardown order: parent may already be gone */
            }
            try {
                // Child layers clean up their own containers first.
                if (!vp.destroyed) vp.destroy({ children: false });
            } catch {
                /* idem */
            }
            viewportRef.current = null;
            setViewport(null);
            if (canvas) canvas.removeEventListener("contextmenu", handleContextMenu);
        };
    }, [app, map, assetsStatus, onViewportReady]);

    // ── Resize ────────────────────────────────────────────────────
    useEffect(() => {
        if (!app || !viewport) return;
        const onResize = () => viewport.resize(app.screen.width, app.screen.height);
        onResize();
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [app, viewport]);

    // ── Right-click: drag vs context-menu / cancel ruler draft ────
    // Right-click + drag  → pixi-viewport pans
    // Right-click + no drag while placing ruler → cancel current draft
    // Otherwise → open context menu (ping, etc.)
    useEffect(() => {
        if (!viewport) return;

        let rightStart = null;

        const onDown = (e) => {
            if (e.button === 2) rightStart = { x: e.global.x, y: e.global.y };
        };

        const onDragStart = () => {
            rightStart = null;
            dispatch(closeContextMenu());
        };

        const onUp = (e) => {
            if (e.button !== 2 || !rightStart) return;
            const dist = Math.hypot(e.global.x - rightStart.x, e.global.y - rightStart.y);
            rightStart = null;
            if (dist >= RIGHT_CLICK_DRAG_THRESHOLD) return;

            // Token context menu owns RMB on markers
            let t = e.target;
            while (t && t !== viewport) {
                if (t.__tokenId) return;
                t = t.parent;
            }

            // Cancel in-progress ruler / drawing draft (RMB without pan)
            const rt = rulerToolRef.current;
            const dt = drawToolRef.current;
            const hasRulerDraft = rt?.active && Array.isArray(rt.draftPoints) && rt.draftPoints.length > 0;
            const hasDrawDraft = dt?.active && (
                dt.draftPoint
                || (Array.isArray(dt.draftParts) && dt.draftParts.length > 0)
                || (Array.isArray(dt.draftPaths) && dt.draftPaths.length > 0)
                || (Array.isArray(dt.draftPath) && dt.draftPath.length > 0)
            );
            if (hasRulerDraft) {
                dispatch(clearRulerDraft());
                dispatch(closeContextMenu());
                return;
            }
            if (hasDrawDraft) {
                dispatch(clearDrawDraft());
                dispatch(closeContextMenu());
                return;
            }

            const worldPos = viewport.toWorld(e.global.x, e.global.y);
            dispatch(openContextMenu({
                screenX: e.global.x,
                screenY: e.global.y,
                worldX: worldPos.x,
                worldY: worldPos.y,
                type: "map",
                location: null,
            }));
        };

        viewport.on("pointerdown", onDown);
        viewport.on("pointerup", onUp);
        viewport.on("drag-start", onDragStart);

        return () => {
            viewport.off("pointerdown", onDown);
            viewport.off("pointerup", onUp);
            viewport.off("drag-start", onDragStart);
        };
    }, [viewport, dispatch]);

    // ── Ruler mode: LMB anchors; Ctrl+LMB continues polyline; plain LMB finalizes ─
    const isRulerMode = !!rulerTool?.active;
    const isDrawMode = !!drawTool?.active;

    useEffect(() => {
        if (!viewport || !isRulerMode) return undefined;

        const onDown = (e) => {
            if (e.button !== 0) return;
            if (isSelectingRef.current) return;
            // Ignore clicks claimed by tokens / interactive marks (handles)
            let t = e.target;
            while (t && t !== viewport) {
                if (t.__tokenId || t.__rulerId || t.__drawingId || t.__markHandle) return;
                t = t.parent;
            }

            const world = viewport.toWorld(e.global.x, e.global.y);
            const point = snapWorldToGridPoint(
                world.x,
                world.y,
                mapRef.current,
                gridConfigRef.current,
            );
            const draftPoints = rulerToolRef.current?.draftPoints || [];
            const ctrl = eventCtrlKey(e);

            if (draftPoints.length === 0) {
                dispatch(pushRulerDraftPoint(point));
                return;
            }

            const nextPoints = [...draftPoints, point];

            if (ctrl) {
                dispatch(setRulerDraftPoints(nextPoints));
                return;
            }

            const campaignId = campaignIdRef.current;
            const mapId = mapIdRef.current;
            persistRulerFromPoints(
                campaignId,
                mapId,
                nextPoints,
                profileRef.current,
                mapRef.current,
            )?.catch(console.error);

            dispatch(clearRulerDraft());
        };

        viewport.on("pointerdown", onDown);
        return () => viewport.off("pointerdown", onDown);
    }, [viewport, isRulerMode, dispatch]);

    // ── Draw mode: circle / rect (2-click) + polygon on grid (close on endpoint) ─
    useEffect(() => {
        if (!viewport || !isDrawMode) return undefined;

        const persistDrawing = (payload) => {
            const campaignId = campaignIdRef.current;
            const mapId = mapIdRef.current;
            if (!campaignId || !mapId) return;
            const profile = profileRef.current;
            const dt = drawToolRef.current;
            addMapDrawing(campaignId, {
                color: dt?.color || "#00f2ea",
                ...payload,
                mapId,
                createdBy: profile?.uid ?? null,
                createdByName: profile?.nickname ?? null,
            }).catch(console.error);
        };

        const onDown = (e) => {
            if (e.button !== 0) return;
            if (isSelectingRef.current) return;
            let t = e.target;
            while (t && t !== viewport) {
                if (t.__tokenId || t.__rulerId || t.__drawingId || t.__markHandle) return;
                t = t.parent;
            }

            const dt = drawToolRef.current;
            const shape = dt?.shape || DRAW_SHAPES.CIRCLE;
            const world = viewport.toWorld(e.global.x, e.global.y);
            const point = snapWorldToGridPoint(
                world.x,
                world.y,
                mapRef.current,
                gridConfigRef.current,
            );
            const ctrl = eventCtrlKey(e);
            const color = dt?.color || "#00f2ea";

            // Polygon-on-grid: LMB vertices; click first/last endpoint (≥3 verts) to close.
            if (shape === DRAW_SHAPES.FREEHAND) {
                const draft = Array.isArray(dt.draftPath) ? dt.draftPath : [];
                if (draft.length === 0) {
                    dispatch(setDrawDraftPath([point]));
                    return;
                }

                const first = draft[0];
                const last = draft[draft.length - 1];
                const hitsFirst = sameGridCell(point, first);
                const hitsLast = sameGridCell(point, last);
                const canClose = draft.length >= 3 && (hitsFirst || hitsLast);

                if (canClose) {
                    const closedPts = hitsFirst
                        ? draft
                        : [...draft];
                    const part = {
                        shape: DRAW_SHAPES.FREEHAND,
                        points: closedPts,
                        closed: true,
                        a: closedPts[0],
                        b: closedPts[closedPts.length - 1],
                        color,
                    };
                    const existingParts = Array.isArray(dt.draftParts) ? dt.draftParts : [];
                    const existingPaths = Array.isArray(dt.draftPaths) ? dt.draftPaths : [];

                    if (ctrl) {
                        dispatch(pushDrawDraftPart(part));
                        if (existingPaths.length || draft.length) {
                            // keep parts-only compound; clear path draft
                        }
                        dispatch(setDrawDraftPath(null));
                        return;
                    }

                    const parts = [...existingParts, part];
                    if (parts.length === 1 && existingPaths.length === 0) {
                        persistDrawing({
                            shape: DRAW_SHAPES.FREEHAND,
                            points: closedPts,
                            closed: true,
                            a: closedPts[0],
                            b: closedPts[closedPts.length - 1],
                            color,
                        });
                    } else {
                        persistDrawing({
                            shape: "compound",
                            parts,
                            color,
                            a: parts[0].a,
                            b: parts[0].b,
                        });
                    }
                    dispatch(clearDrawDraft());
                    return;
                }

                if (hitsLast) return; // ignore duplicate last vertex
                dispatch(setDrawDraftPath([...draft, point]));
                return;
            }

            const draftPoint = dt?.draftPoint;

            if (!draftPoint) {
                dispatch(setDrawDraftPoint(point));
                return;
            }

            const circleMode = dt?.circleMode === CIRCLE_MODES.SQUARE
                ? CIRCLE_MODES.SQUARE
                : CIRCLE_MODES.ROUND;
            const part = shape === DRAW_SHAPES.CIRCLE
                ? {
                    shape,
                    a: draftPoint,
                    b: point,
                    circleMode,
                    radiusCells: circleRadiusCells(draftPoint, point),
                    color,
                }
                : { shape, a: draftPoint, b: point, color };
            const existingParts = Array.isArray(dt.draftParts) ? dt.draftParts : [];

            if (ctrl) {
                dispatch(pushDrawDraftPart(part));
                dispatch(setDrawDraftPoint(null));
                return;
            }

            const parts = [...existingParts, part];
            if (parts.length === 1) {
                persistDrawing({
                    shape,
                    a: part.a,
                    b: part.b,
                    circleMode: part.circleMode,
                    radiusCells: part.radiusCells ?? null,
                    color,
                });
            } else {
                persistDrawing({
                    shape: "compound",
                    a: parts[0].a,
                    b: parts[0].b,
                    parts,
                    color,
                });
            }
            dispatch(clearDrawDraft());
        };

        viewport.on("pointerdown", onDown);
        return () => viewport.off("pointerdown", onDown);
    }, [viewport, isDrawMode, dispatch]);

    // ── Position-selection mode (left-click places location) ─────
    useEffect(() => {
        if (!viewport || !isSelectingPosition) {
            if (ghostRef.current) ghostRef.current.visible = false;
            viewport?.plugins?.resume?.("drag");
            return;
        }

        viewport.plugins?.pause?.("drag");

        if (!ghostRef.current) {
            const texture = PIXI.Texture.from(locationIconPath);
            const ghost   = new PIXI.Sprite(texture);
            ghost.anchor.set(0.5);
            ghost.alpha   = 0.6;
            ghost.tint    = new PIXI.Color(UI_COLORS.accent).toNumber();
            ghost.zIndex  = RENDER_LAYERS.UI || 999;
            viewport.addChild(ghost);
            ghostRef.current = ghost;
        }
        ghostRef.current.visible = true;

        const onMove = (e) => {
            const wp = viewport.toWorld(e.global.x, e.global.y);
            ghostRef.current.x = wp.x;
            ghostRef.current.y = wp.y;
        };

        const onDown = (e) => {
            if (e.button !== 0) return;
            const wp = viewport.toWorld(e.global.x, e.global.y);
            dispatch(setSelectedWorldPosition({ x: wp.x, y: wp.y }));
            dispatch(setIsSelectingPosition(false));
            dispatch(restoreDialog(DIALOG_IDS.LOCATION));
        };

        viewport.on("pointermove", onMove);
        viewport.on("pointerdown", onDown);

        return () => {
            viewport.off("pointermove", onMove);
            viewport.off("pointerdown", onDown);
            if (ghostRef.current) ghostRef.current.visible = false;
        };
    }, [viewport, isSelectingPosition]);

    return children;
}
