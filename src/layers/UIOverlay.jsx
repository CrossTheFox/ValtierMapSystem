import { useSelector } from "react-redux";
import WorldDrawer from "../components/WorldDrawer";
import LocationInfoCard from "../components/LocationInfoCard";
import FloatingProfile from "../components/FloatingProfile";
import CyberSnackbar from "../components/customs/CyberSnackbar";
import MapContextMenu from "../components/MapContextMenu";
import MeasuringHUD from "../components/MeasuringHUD";
import LoreDialog from "../components/LoreDialog";

export default function UIOverlay() {
    const profile = useSelector((state) => state.player.profile);

    return (
        <div
            id="ui-overlay"
            style={{ position: "fixed", inset: 0, pointerEvents: "none" }}
        >
            <WorldDrawer />
            <LocationInfoCard />
            <LoreDialog />

            {/* Every interactive DOM overlay must live in a pointerEvents:auto wrapper */}
            <div style={{ pointerEvents: "auto" }}>
                <FloatingProfile profile={profile} />
                <MeasuringHUD />
                <MapContextMenu />
                <CyberSnackbar />
            </div>
        </div>
    );
}
