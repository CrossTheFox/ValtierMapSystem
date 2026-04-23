import { useEffect, useState } from "react";
import { Application } from "@pixi/react";
import { useDispatch, useSelector } from "react-redux";
import { loadWorld, preloadWorldAssets } from "../store/worldSlice";
import { ViewportContext } from "../context/ViewportContext";
import MapViewportProvider from "../pixi/MapViewport";
import LocationsLayer from "../pixi/LocationsLayer";
import DistanceMeasureLayer from "../pixi/DistanceMeasureLayer";
import PartyLayer from "../pixi/PartyLayer";
import MapControls from "../components/MapControls";

export default function PixiRoot() {
    const dispatch = useDispatch();
    const { worldStatus, selectedCampaignId } = useSelector((state) => state.world);
    const [viewport, setViewport] = useState(null);

    useEffect(() => {
        const init = async () => {
            if (!selectedCampaignId) {
                console.warn("No campaign selected. Skipping world initialization.");
                return;
            }

            try {
                // Cargamos datos y luego assets
                const world = await dispatch(loadWorld(selectedCampaignId)).unwrap();
                await dispatch(preloadWorldAssets(world)).unwrap();
            } catch (error) {
                console.error("Error inicializando el mundo:", error);
            }
        };

        if (worldStatus === "idle" && selectedCampaignId) {
            init();
        }
    }, [dispatch, worldStatus, selectedCampaignId]);

    return (
        <ViewportContext.Provider value={viewport}>
            <>
                <Application
                    resizeTo={window}
                    options={{
                        backgroundColor: 0x0e0e14,
                        antialias: true,
                        resolution: window.devicePixelRatio || 1,
                    }}
                >
                    <MapViewportProvider onViewportReady={setViewport}>
                        <LocationsLayer />
                        <DistanceMeasureLayer />
                        <PartyLayer />
                    </MapViewportProvider>
                </Application>
                <MapControls />
            </>
        </ViewportContext.Provider>
    );
}