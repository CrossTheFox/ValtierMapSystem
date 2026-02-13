import { useEffect } from "react";
import * as PIXI from "pixi.js";
import { useSelector, useDispatch } from "react-redux";

import { openLocation } from "../store/uiSlice";

import { useViewport } from "../context/ViewportContext";

import { createPixiTooltip } from "../components/PixiTooltip";

import { lerpColor } from "../helpers/colors";
import { RENDER_LAYERS } from "../constants/renderLayers";

import gsap from "gsap";

const NORMAL_TINT = 0xffc0cb; // fucsia suave
const HOVER_TINT = 0xff1493;  // fucsia intenso

export default function LocationsLayer() {
    const viewport = useViewport();
    const locations = useSelector((s) => s.world.locations);
    const dispatch = useDispatch();

    useEffect(() => {
        if (!viewport || !locations) return;

        const layerContainer = new PIXI.Container();
        layerContainer.name = "LocationsLayer";
        layerContainer.zIndex = RENDER_LAYERS.LOCATIONS;

        viewport.addChild(layerContainer);

        let destroyed = false;

        PIXI.Assets.load("/svgs/sharped_star.svg").then((texture) => {
            if (destroyed) return;

            Object.values(locations).forEach((loc) => {
                // ---- Location Container ----
                const locationContainer = new PIXI.Container();
                locationContainer.x = loc.position.x;
                locationContainer.y = loc.position.y;
                locationContainer.eventMode = "static";
                locationContainer.cursor = "pointer";

                // ---- Icon ----
                const icon = new PIXI.Sprite(texture);
                icon.anchor.set(0.5);
                icon.scale.set(0.15);
                icon.tint = NORMAL_TINT;

                // ---- Tooltip ----
                const tooltip = createPixiTooltip({
                    text: loc.description || loc.name,
                });

                // ---- Hover Effects ----
                const colorProxy = { t: 0 };

                locationContainer.on("pointerover", () => {
                    // Color del icono
                    gsap.killTweensOf(colorProxy);
                    gsap.to(colorProxy, {
                        t: 1,
                        duration: 0.4,
                        ease: "power2.out",
                        onUpdate: () => {
                            icon.tint = lerpColor(
                                NORMAL_TINT,
                                HOVER_TINT,
                                colorProxy.t
                            );
                        },
                    });

                    tooltip.show();
                });

                locationContainer.on("pointerout", () => {
                    // Color del icono
                    gsap.killTweensOf(colorProxy);
                    gsap.to(colorProxy, {
                        t: 0,
                        duration: 0.4,
                        ease: "power2.out",
                        onUpdate: () => {
                            icon.tint = lerpColor(
                                NORMAL_TINT,
                                HOVER_TINT,
                                colorProxy.t
                            );
                        },
                    });

                    tooltip.hide();
                });

                // ---- Click Event ----
                locationContainer.on("pointerdown", () => {
                    console.log("Location clicked:", loc);
                    dispatch(openLocation(loc));
                    tooltip.hide();
                });

                // ---- Build Tree ----
                locationContainer.addChild(tooltip.container, icon);
                layerContainer.addChild(locationContainer);
            });
        });

        return () => {
            destroyed = true;
            layerContainer.destroy({ children: true });
        };
    }, [viewport, locations]);

    return null;
}
