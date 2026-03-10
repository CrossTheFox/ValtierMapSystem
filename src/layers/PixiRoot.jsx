import { useEffect } from "react";
import { Application } from "@pixi/react";
import { useDispatch, useSelector } from "react-redux";
import { loadWorld, preloadWorldAssets } from "../store/worldSlice";
import MapViewportProvider from "../pixi/MapViewport";
import LocationsLayer from "../pixi/LocationsLayer";

export default function PixiRoot() {
    const dispatch = useDispatch();
    const { worldStatus } = useSelector((state) => state.world);

    useEffect(() => {
        const init = async () => {
            try {
                // Cargamos datos y luego assets
                const world = await dispatch(loadWorld("RfY23gcG7No5HcGddo1j")).unwrap();
                await dispatch(preloadWorldAssets(world)).unwrap();
            } catch (error) {
                console.error("Error inicializando el mundo:", error);
            }
        };

        if (worldStatus === "idle") {
            init();
        }
    }, [dispatch, worldStatus]);

    return (
        <Application
            resizeTo={window}
            options={{ 
                backgroundColor: 0x0e0e14, 
                antialias: true,
                resolution: window.devicePixelRatio || 1
            }}
        >
            <MapViewportProvider>
                <LocationsLayer />
            </MapViewportProvider>
        </Application>
    );
}