import { useApplication } from "@pixi/react";
import { Viewport } from "pixi-viewport";
import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import * as PIXI from "pixi.js";

import { ViewportContext } from "../context/ViewportContext";

import { RENDER_LAYERS } from "../constants/renderLayers";

export default function MapViewportProvider({ children }) {
    const { app } = useApplication();
    const viewportRef = useRef(null);
    const { map, status } = useSelector((state) => state.world);

    const [viewport, setViewport] = useState(null);

    useEffect(() => {
        if (!app || status !== "succeeded" || !map) return;

        // 🔴 Asegurar EventSystem (CLAVE)
        if (!("events" in app?.renderer)) {
            app.renderer.addSystem(PIXI.EventSystem, "events");
        }

        const viewport = new Viewport({
            screenWidth: app.screen.width,
            screenHeight: app.screen.height,
            worldWidth: map.width,
            worldHeight: map.height,
            ticker: app.ticker,
            events: app.renderer.events,
        });

        viewport.sortableChildren = true;

        viewport
            .drag()
            .pinch()
            .wheel({ percent: 0.1 })
            .decelerate()
            .clampZoom({
                minScale: 0.1,
                maxScale: 5,
            });

        // 🔹 Cargar y agregar mapa
        PIXI.Assets.load(map.image).then((texture) => {
            const mapSprite = new PIXI.Sprite(texture);
            mapSprite.anchor.set(0);
            mapSprite.zIndex = RENDER_LAYERS.MAP;
            viewport.addChild(mapSprite);
        });

        app.stage.addChild(viewport);
        viewportRef.current = viewport;

        viewport.on("pointerdown", (event) => {
            const screenX = event.global.x;
            const screenY = event.global.y;

            // 🔥 ESTO ES LO IMPORTANTE
            const worldPos = viewport.toWorld(screenX, screenY);

            console.log("Click position:", {
                screen: { x: screenX, y: screenY },
                world: { x: worldPos.x, y: worldPos.y },
            });
        });

        setViewport(viewport);


        return () => {
            viewport.destroy({ children: true });
        };
    }, [app, map, status]);

    if (!viewport) return null;

    return (
        <ViewportContext.Provider value={viewport}>
            {children}
        </ViewportContext.Provider>
    );
}
