import { useApplication } from "@pixi/react";
import { Viewport } from "pixi-viewport";
import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import * as PIXI from "pixi.js";

import { ViewportContext } from "../context/ViewportContext";

import { RENDER_LAYERS } from "../constants/renderLayers";

import { loadTexture } from "../../firebase/services/assetLoader";

export default function MapViewportProvider({ children }) {
    const { app } = useApplication();
    const viewportRef = useRef(null);
    const { map, assetsStatus } = useSelector((state) => state.world);

    console.log("MapViewportProvider - map:", map);
    console.log("MapViewportProvider - assetsStatus:", assetsStatus);

    const [viewport, setViewport] = useState(null);

    useEffect(() => {
        if (!app || assetsStatus !== "succeeded" || !map) return;
        if (viewportRef.current) {
            console.warn("Viewport ya existe, no se creará uno nuevo.");
            return;
        };

        // 🔴 Asegurar EventSystem (CLAVE)
        if (!("events" in app?.renderer)) {
            app.renderer.addSystem(PIXI.EventSystem, "events");
        }

        console.log("Map: ", map);

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

        const loadMap = async () => {
            try {
                const texture = await loadTexture(map.imageUrl);

                const mapSprite = new PIXI.Sprite(texture);
                mapSprite.anchor.set(0);
                mapSprite.zIndex = RENDER_LAYERS.MAP;

                viewport.addChild(mapSprite);
            } catch (err) {
                console.error("Error cargando mapa:", err);
            }
        };

        loadMap();

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
            app.stage.removeChild(viewport.current);
            viewport.destroy({ children: true });
            viewportRef.current = null;
        };
    }, [app, map, assetsStatus]);

    if (!viewport) return null;

    return (
        <ViewportContext.Provider value={viewport}>
            {children}
        </ViewportContext.Provider>
    );
}
