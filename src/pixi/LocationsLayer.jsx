import { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";
import { useSelector, useDispatch } from "react-redux";
import {
    openLocation,
    selectLocationPreview,
    openContextMenu,
    setMeasurePointB,
    clearMeasureTool,
} from "../store/uiSlice";
import { useViewport } from "../context/ViewportContext";
import { createPixiTooltip } from "./PixiTooltip";
import { lerpColor } from "../helpers/colors";
import { RENDER_LAYERS } from "../constants/renderLayers";
import { UI_COLORS } from "../constants/uiColors";
import gsap from "gsap";

import locationIconPath from "../assets/LocationNode.svg";

const RIGHT_CLICK_DRAG_THRESHOLD = 5;

const getHex = (color) => {
    if (typeof color === "number") return color;
    return new PIXI.Color(color).toNumber();
};

const NORMAL_TINT = getHex(UI_COLORS.accent       || "#ff66ff");
const HOVER_TINT  = getHex(UI_COLORS.accentStrong || "#ff1493");

export default function LocationsLayer() {
    const viewport  = useViewport();
    const locations = useSelector((s) => s.world.locations);
    const dispatch  = useDispatch();

    const { measureTool } = useSelector((s) => s.ui);

    // Ref so the PIXI event handlers always read the latest measure state
    // without needing to rebuild the whole layer on every measure step
    const measureRef = useRef(measureTool);
    useEffect(() => { measureRef.current = measureTool; }, [measureTool]);

    useEffect(() => {
        if (!viewport || !locations) return;

        const layerContainer = new PIXI.Container();
        layerContainer.name    = "LocationsLayer";
        layerContainer.zIndex  = RENDER_LAYERS.LOCATIONS;
        viewport.addChild(layerContainer);

        let destroyed = false;

        PIXI.Assets.load(locationIconPath).then((texture) => {
            if (destroyed) return;

            Object.values(locations).forEach((loc) => {
                const locationContainer = new PIXI.Container();
                locationContainer.x         = loc.position.x;
                locationContainer.y         = loc.position.y;
                locationContainer.eventMode = "static";
                locationContainer.cursor    = "pointer";
                locationContainer.hitArea   = new PIXI.Circle(0, 0, 40);

                const icon = new PIXI.Sprite(texture);
                icon.anchor.set(0.5);
                const BASE_SCALE = 1;
                icon.scale.set(BASE_SCALE);
                icon.tint = NORMAL_TINT;

                // Pulse animation
                gsap.to(icon.scale, {
                    x: BASE_SCALE + 0.05,
                    y: BASE_SCALE + 0.05,
                    duration: 2 + Math.random(),
                    repeat: -1,
                    yoyo: true,
                    ease: "sine.inOut",
                });

                // Slow rotation
                gsap.to(icon, {
                    rotation: Math.PI * 2,
                    duration: 20 + Math.random() * 10,
                    repeat: -1,
                    ease: "none",
                });

                const tooltip    = createPixiTooltip({ text: loc.name });
                const colorState = { t: 0 };

                locationContainer.on("pointerover", () => {
                    gsap.killTweensOf(colorState);
                    gsap.to(colorState, {
                        t: 1, duration: 0.3, ease: "power2.out",
                        onUpdate: () => { icon.tint = lerpColor(NORMAL_TINT, HOVER_TINT, colorState.t); },
                    });
                    tooltip.show();
                });

                locationContainer.on("pointerout", () => {
                    gsap.killTweensOf(colorState);
                    gsap.to(colorState, {
                        t: 0, duration: 0.3, ease: "power2.out",
                        onUpdate: () => { icon.tint = lerpColor(NORMAL_TINT, HOVER_TINT, colorState.t); },
                    });
                    tooltip.hide();
                });

                // ── Right-click detection (down → up distance) ──────────
                let rightStart = null;

                locationContainer.on("pointerdown", (event) => {
                    event.stopPropagation();

                    const isMeasuring =
                        !!measureRef.current.pointA && !measureRef.current.pointB;

                    if (event.button === 2) {
                        if (isMeasuring) {
                            // Right-click while measuring → cancel
                            dispatch(clearMeasureTool());
                        } else {
                            rightStart = { x: event.global.x, y: event.global.y };
                        }
                        return;
                    }

                    if (event.button !== 0) return;

                    if (isMeasuring) {
                        // Left-click while measuring → set this location as endpoint
                        dispatch(setMeasurePointB({
                            x:     loc.position.x,
                            y:     loc.position.y,
                            label: loc.name.toUpperCase(),
                        }));
                        return;
                    }

                    // Normal left-click → preview HUD only (full dialog via ABRIR FICHA COMPLETA)
                    dispatch(selectLocationPreview(loc));
                    tooltip.hide();
                });

                locationContainer.on("pointerup", (event) => {
                    event.stopPropagation();
                    if (event.button !== 2 || !rightStart) return;
                    const dist = Math.hypot(
                        event.global.x - rightStart.x,
                        event.global.y - rightStart.y,
                    );
                    rightStart = null;
                    if (dist >= RIGHT_CLICK_DRAG_THRESHOLD) return;

                    // Short right-click on a location → location context menu
                    dispatch(openContextMenu({
                        screenX:  event.global.x,
                        screenY:  event.global.y,
                        worldX:   loc.position.x,
                        worldY:   loc.position.y,
                        type:     "location",
                        location: loc,
                    }));
                });

                // Also reset rightStart if pointer leaves the hitArea
                locationContainer.on("pointerupoutside", () => { rightStart = null; });

                locationContainer.addChild(tooltip.container, icon);
                layerContainer.addChild(locationContainer);
            });
        });

        return () => {
            destroyed = true;
            layerContainer.destroy({ children: true });
        };
    }, [viewport, locations, dispatch]);

    return null;
}
