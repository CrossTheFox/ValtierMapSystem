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
    setMeasurePointB,
    clearMeasureTool,
} from "../store/uiSlice";
import { DIALOG_IDS } from "../constants/dialogIds";
import locationIconPath from "../assets/LocationNode.svg";
import { UI_COLORS } from "../constants/uiColors";
import { resolveCellSize, snapToGridCenter } from "../utils/gridMath";

const RIGHT_CLICK_DRAG_THRESHOLD = 5; // px — below this → treat as click, not drag

export default function MapViewportProvider({ children, onViewportReady }) {
    const { app } = useApplication();
    const dispatch = useDispatch();

    const { map, assetsStatus, gridConfig } = useSelector((state) => state.world);
    const { isSelectingPosition, measureTool } = useSelector((state) => state.ui);
    const gridConfigRef = useRef(gridConfig);
    const mapRef = useRef(map);
    useEffect(() => { gridConfigRef.current = gridConfig; }, [gridConfig]);
    useEffect(() => { mapRef.current = map; }, [map]);

    const [viewport, setViewport] = useState(null);
    const viewportRef = useRef(null);
    const ghostRef    = useRef(null);

    // Keep latest measure/selecting state readable inside non-resubscribing effects
    const measureToolRef         = useRef(measureTool);
    const isSelectingRef         = useRef(isSelectingPosition);
    useEffect(() => { measureToolRef.current = measureTool; },         [measureTool]);
    useEffect(() => { isSelectingRef.current = isSelectingPosition; }, [isSelectingPosition]);

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

        const vp = new Viewport({
            screenWidth:  app.screen.width,
            screenHeight: app.screen.height,
            worldWidth:   map.width,
            worldHeight:  map.height,
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
        let mapLoadCancelled = false;

        // Load map image
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
            }
        })();

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

    // ── Right-click: drag vs context-menu vs cancel-measure ──────
    // Right-click + drag  → pixi-viewport handles panning (drag plugin active)
    // Right-click + no drag (< threshold) → open context menu  OR  cancel measure
    useEffect(() => {
        if (!viewport) return;

        let rightStart = null;  // { x, y } at pointerdown

        const onDown = (e) => {
            if (e.button === 2) rightStart = { x: e.global.x, y: e.global.y };
        };

        // drag-start fires when pixi-viewport actually begins panning
        const onDragStart = () => {
            rightStart = null;          // it's a drag, not a click
            dispatch(closeContextMenu());
        };

        const onUp = (e) => {
            if (e.button !== 2 || !rightStart) return;
            const dist = Math.hypot(e.global.x - rightStart.x, e.global.y - rightStart.y);
            rightStart = null;
            if (dist >= RIGHT_CLICK_DRAG_THRESHOLD) return; // was a drag

            const isMeasuring =
                !!measureToolRef.current.pointA && !measureToolRef.current.pointB;

            if (isMeasuring) {
                // Cancel the measure tool instead of opening context menu
                dispatch(clearMeasureTool());
            } else {
                const worldPos = viewport.toWorld(e.global.x, e.global.y);
                dispatch(openContextMenu({
                    screenX: e.global.x,
                    screenY: e.global.y,
                    worldX:  worldPos.x,
                    worldY:  worldPos.y,
                    type:     "map",
                    location: null,
                }));
            }
        };

        viewport.on("pointerdown", onDown);
        viewport.on("pointerup",   onUp);
        viewport.on("drag-start",  onDragStart);

        return () => {
            viewport.off("pointerdown", onDown);
            viewport.off("pointerup",   onUp);
            viewport.off("drag-start",  onDragStart);
        };
    }, [viewport, dispatch]);

    // ── Measuring-mode: left-click sets endpoint ──────────────────
    const isMeasuringMode = !!measureTool.pointA && !measureTool.pointB;

    useEffect(() => {
        if (!viewport) return;

        if (!isMeasuringMode) {
            // Resume drag whenever we leave measuring mode
            viewport.plugins?.resume?.("drag");
            return;
        }

        // While measuring, suspend drag so a left-click doesn't pan
        viewport.plugins?.pause?.("drag");

        const onDown = (e) => {
            if (e.button !== 0) return;
            // Don't interfere if position-selection mode is also active
            if (isSelectingRef.current) return;
            let worldPos = viewport.toWorld(e.global.x, e.global.y);
            const gc = gridConfigRef.current;
            if (gc?.snap !== false) {
                worldPos = snapToGridCenter(
                    worldPos.x,
                    worldPos.y,
                    resolveCellSize(mapRef.current, gc),
                );
            }
            dispatch(setMeasurePointB({
                x:     worldPos.x,
                y:     worldPos.y,
                label: `(${Math.round(worldPos.x)}, ${Math.round(worldPos.y)})`,
            }));
        };

        viewport.on("pointerdown", onDown);

        return () => {
            viewport.off("pointerdown", onDown);
            viewport.plugins?.resume?.("drag");
        };
    }, [viewport, isMeasuringMode, dispatch]);

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
