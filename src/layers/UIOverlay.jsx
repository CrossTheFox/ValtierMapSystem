import { useSelector } from "react-redux";
import WorldDrawer from "../components/WorldDrawer";
import LocationInfoCard from "../components/LocationInfoCard";
import FloatingProfile from "../components/FloatingProfile";
import CyberSnackbar from "../components/customs/CyberSnackbar";
import LoreDialog from "../components/LoreDialog";
import { RENDER_LAYERS } from "../constants/renderLayers";

export default function UIOverlay() {
    const profile = useSelector((state) => state.player.profile);

    return (
        <div
            id="ui-overlay"
            style={{
                position: "fixed",
                inset: 0,
                pointerEvents: "none",
            }}
        >
            {/* Componentes UI */}
            <WorldDrawer />
            <LocationInfoCard />
            <LoreDialog />
            <div style={{ pointerEvents: "auto" }}> {/* Permitir clics aquí */}
                <FloatingProfile profile={profile} />
            </div>
            <CyberSnackbar />
        </div>
    );
}