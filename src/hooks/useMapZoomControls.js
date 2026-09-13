import { useCallback, useEffect, useState } from "react";
import { useViewport } from "../context/ViewportContext";

/** Relative scale change per step (~12% per click). */
const ZOOM_STEP = 0.12;

export default function useMapZoomControls() {
    const viewport = useViewport();
    const [scalePct, setScalePct] = useState(100);

    const readScalePct = useCallback(() => {
        if (!viewport) return;
        setScalePct(Math.round((viewport.scale?.x ?? 1) * 100));
    }, [viewport]);

    useEffect(() => {
        if (!viewport) return;
        const onViewportChange = () => readScalePct();
        readScalePct();
        viewport.on("moved", onViewportChange);
        viewport.on("zoomed", onViewportChange);
        return () => {
            viewport.off("moved", onViewportChange);
            viewport.off("zoomed", onViewportChange);
        };
    }, [viewport, readScalePct]);

    const zoomIn = useCallback(() => {
        if (!viewport) return;
        viewport.zoomPercent(ZOOM_STEP, true);
        readScalePct();
    }, [viewport, readScalePct]);

    const zoomOut = useCallback(() => {
        if (!viewport) return;
        viewport.zoomPercent(-ZOOM_STEP, true);
        readScalePct();
    }, [viewport, readScalePct]);

    const fitToScreen = useCallback(() => {
        if (!viewport) return;
        viewport.fitWorld(false);
        viewport.moveCenter(viewport.worldWidth / 2, viewport.worldHeight / 2);
        readScalePct();
    }, [viewport, readScalePct]);

    const centerMap = useCallback(() => {
        if (!viewport) return;
        viewport.moveCenter(viewport.worldWidth / 2, viewport.worldHeight / 2);
        readScalePct();
    }, [viewport, readScalePct]);

    return {
        ready: Boolean(viewport),
        scalePct,
        zoomIn,
        zoomOut,
        fitToScreen,
        centerMap,
    };
}
