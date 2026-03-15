import { useEffect } from "react";
import * as PIXI from "pixi.js";
import { useSelector, useDispatch } from "react-redux";
import { openLocation } from "../store/uiSlice";
import { useViewport } from "../context/ViewportContext";
import { createPixiTooltip } from "./PixiTooltip";
import { lerpColor } from "../helpers/colors";
import { RENDER_LAYERS } from "../constants/renderLayers";
import { UI_COLORS } from "../constants/uiColors"; 
import gsap from "gsap";

import locationIconPath from "../assets/LocationNode.svg";

const getHex = (color) => {
    if (typeof color === 'number') return color;
    return new PIXI.Color(color).toNumber();
};

const NORMAL_TINT = getHex(UI_COLORS.accent || "#ff66ff");
const HOVER_TINT = getHex(UI_COLORS.accentStrong || "#ff1493");

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

        PIXI.Assets.load(locationIconPath).then((texture) => {
            if (destroyed) return;

            Object.values(locations).forEach((loc) => {
                const locationContainer = new PIXI.Container();
                locationContainer.x = loc.position.x;
                locationContainer.y = loc.position.y;
                locationContainer.eventMode = "static";
                locationContainer.cursor = "pointer";

                // Hit area circular para capturar eventos de forma consistente
                locationContainer.hitArea = new PIXI.Circle(0, 0, 40);

                const icon = new PIXI.Sprite(texture);
                icon.anchor.set(0.5);
                const BASE_SCALE = 1;
                icon.scale.set(BASE_SCALE); 
                icon.tint = NORMAL_TINT;

                // ---- Animación de Pulso Constante (Nunca se detiene) ----
                gsap.to(icon.scale, {
                    x: BASE_SCALE + 0.05,
                    y: BASE_SCALE + 0.05,
                    duration: 2 + Math.random(),
                    repeat: -1,
                    yoyo: true,
                    ease: "sine.inOut"
                });

                // Rotación constante
                gsap.to(icon, {
                    rotation: Math.PI * 2,
                    duration: 20 + Math.random() * 10,
                    repeat: -1,
                    ease: "none"
                });

                const tooltip = createPixiTooltip({ text: loc.name });

                // ---- Lógica de Color (Proxy para lerpColor) ----
                const colorState = { t: 0 };

                locationContainer.on("pointerover", () => {
                    gsap.killTweensOf(colorState);
                    gsap.to(colorState, {
                        t: 1,
                        duration: 0.3,
                        ease: "power2.out",
                        onUpdate: () => {
                            icon.tint = lerpColor(NORMAL_TINT, HOVER_TINT, colorState.t);
                        },
                    });
                    tooltip.show();
                });

                locationContainer.on("pointerout", () => {
                    gsap.killTweensOf(colorState);
                    gsap.to(colorState, {
                        t: 0,
                        duration: 0.3,
                        ease: "power2.out",
                        onUpdate: () => {
                            icon.tint = lerpColor(NORMAL_TINT, HOVER_TINT, colorState.t);
                        },
                    });
                    tooltip.hide();
                });

                locationContainer.on("pointerdown", (event) => {
                    event.stopPropagation();

                    console.log("Location clicked:", loc.name);
                    
                    dispatch(openLocation(loc));
                    tooltip.hide();
                });

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