import * as PIXI from "pixi.js";
import { useApplication } from "@pixi/react";
import { Viewport } from "pixi-viewport";
import { useEffect, useRef, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { ViewportContext } from "../context/ViewportContext";
import { RENDER_LAYERS } from "../constants/renderLayers";
import { loadTexture } from "../../firebase/services/assetLoader";
import { setIsSelectingPosition, toggleIsMinimized, setSelectedWorldPosition } from "../store/uiSlice";
import locationIconPath from "../assets/LocationNode.svg";
import { UI_COLORS } from "../constants/uiColors";

export default function MapViewportProvider({ children }) {
    const { app } = useApplication();

    const dispatch = useDispatch();
    const { map, assetsStatus } = useSelector((state) => state.world);
    const { isSelectingPosition } = useSelector((state) => state.ui);

    const [viewport, setViewport] = useState(null);

    const viewportRef = useRef(null);
    const ghostRef = useRef(null);

    useEffect(() => {
        if (!app || assetsStatus !== "succeeded" || !map) return;
        if (viewportRef.current) return;

        const canvas = app.canvas;
        const handleContextMenu = (e) => e.preventDefault();
        canvas.addEventListener("contextmenu", handleContextMenu);

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
            .drag({ mouseButtons: "right" }) // Solo arrastrar con el botón izquierdo
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
            event.preventDefault(); // Evitar comportamientos por defecto del navegador
            event.stopPropagation(); // Evitar que otros listeners globales interfieran
            const screenX = event.global.x;
            const screenY = event.global.y;

            const worldPos = viewport.toWorld(screenX, screenY);

            if (isSelectingPosition) {
                dispatch(setSelectedWorldPosition({ x: worldPos.x, y: worldPos.y }));
                dispatch(toggleIsMinimized());
                dispatch(setIsSelectingPosition(false));
            }
        });

        setViewport(viewport);


        return () => {
            app.stage.removeChild(viewport.current);
            viewport.destroy({ children: true });
            viewportRef.current = null;
            canvas.removeEventListener("contextmenu", handleContextMenu);
        };
    }, [app, map, assetsStatus]);

    useEffect(() => {
        if (!viewport || !isSelectingPosition) {
            if (ghostRef.current) ghostRef.current.visible = false;
            return;
        }

        // Crear el sprite fantasma si no existe
        if (!ghostRef.current) {
            const texture = PIXI.Texture.from(locationIconPath);
            const ghost = new PIXI.Sprite(texture);
            ghost.anchor.set(0.5);
            ghost.alpha = 0.6;
            ghost.tint = new PIXI.Color(UI_COLORS.accent).toNumber();
            ghost.zIndex = RENDER_LAYERS.FOREGROUND || 999;
            viewport.addChild(ghost);
            ghostRef.current = ghost;
        }

        ghostRef.current.visible = true;

        const onMove = (e) => {
            const worldPos = viewport.toWorld(e.global.x, e.global.y);
            ghostRef.current.x = worldPos.x;
            ghostRef.current.y = worldPos.y;
        };

        const onClick = (e) => {
            if (e.data.originalEvent.button !== 0) return; // Solo con botón izquierdo
            // Obtenemos la posición del mundo
            const worldPos = viewport.toWorld(e.global.x, e.global.y);
            
            // 1. Despachar la posición a Redux (ESTO FALTABA)
            dispatch(setSelectedWorldPosition({ x: worldPos.x, y: worldPos.y }));
            
            // 2. Cerrar el estado de selección
            dispatch(setIsSelectingPosition(false));
            
            // 3. Opcional: Volver a mostrar el diálogo si estaba minimizado
            dispatch(toggleIsMinimized()); 

            console.log("Position dispatched to Redux:", worldPos);
        };

        viewport.on("pointermove", onMove);
        viewport.on("pointerdown", onClick);

        return () => {
            viewport.off("pointermove", onMove);
            viewport.off("pointerdown", onClick);
            if (ghostRef.current) ghostRef.current.visible = false;
        };
    }, [viewport, isSelectingPosition]);

    if (!viewport) return null;

    return (
        <ViewportContext.Provider value={viewport}>
            {children}
        </ViewportContext.Provider>
    );
}
