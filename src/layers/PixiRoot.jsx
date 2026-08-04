import { useEffect } from "react";
import { Application } from "@pixi/react";
import { useDispatch, useSelector } from "react-redux";
import { loadWorld, preloadWorldAssets } from "../store/worldSlice";
import MapViewportProvider from "../pixi/MapViewport";
import LocationsLayer from "../pixi/LocationsLayer";
import RulersLayer from "../pixi/RulersLayer";
import PingLayer from "../pixi/PingLayer";
import TurnFocusLayer from "../pixi/TurnFocusLayer";
import GridLayer from "../pixi/GridLayer";
import TokenLayer from "../pixi/TokenLayer";
import TokenSpeechLayer from "../pixi/TokenSpeechLayer";
import MapControls from "../components/MapControls";

/**
 * @param {{ onViewportReady?: (vp: import("pixi-viewport").Viewport | null) => void }} props
 */
export default function PixiRoot({ onViewportReady }) {
    const dispatch = useDispatch();
    const { worldStatus, selectedCampaignId } = useSelector((state) => state.world);

    useEffect(() => {
        const init = async () => {
            if (!selectedCampaignId) {
                console.warn("No campaign selected. Skipping world initialization.");
                return;
            }

            try {
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
        <>
            <Application
                resizeTo={window}
                options={{
                    backgroundColor: 0x0e0e14,
                    antialias: true,
                    resolution: window.devicePixelRatio || 1,
                }}
            >
                <MapViewportProvider onViewportReady={onViewportReady}>
                    <GridLayer />
                    <LocationsLayer />
                    <RulersLayer />
                    <PingLayer />
                    <TurnFocusLayer />
                    <TokenLayer />
                    <TokenSpeechLayer />
                </MapViewportProvider>
            </Application>
            <MapControls />
        </>
    );
}
