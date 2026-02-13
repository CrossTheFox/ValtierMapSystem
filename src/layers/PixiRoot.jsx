import { useEffect } from "react";
import { Application } from "@pixi/react";
import { useDispatch } from "react-redux";
import { loadWorld } from "../store/worldSlice";
import MapViewportProvider from "../pixi/MapViewport";
import LocationsLayer from "../pixi/LocationsLayer";

export default function PixiRoot() {
    const dispatch = useDispatch();

    useEffect(() => {
        dispatch(loadWorld("/data/campaign.json"));
    }, [dispatch]);

    return (
        <Application
            resizeTo={window}
            options={{
                backgroundColor: 0x0e0e14,
                antialias: true,
            }}
        >
            <MapViewportProvider>
                <LocationsLayer />
            </MapViewportProvider>
        </Application>
    );
}
