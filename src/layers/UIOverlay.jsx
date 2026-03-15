import { useSelector } from "react-redux";
import WorldDrawer from "../components/WorldDrawer";
import LocationInfoCard from "../components/LocationInfoCard";
import FloatingProfile from "../components/FloatingProfile";

export default function UIOverlay() {
    const profile = useSelector((state) => state.player.profile);

    return (
        <div
            id="ui-overlay"
            style={{
                position: "fixed",
                inset: 0,
                pointerEvents: "none",
                zIndex: 100000,
            }}
        >
            {/* Componentes UI */}
            <WorldDrawer />
            <LocationInfoCard />
            <div style={{ pointerEvents: "auto" }}> {/* Permitir clics aquí */}
                <FloatingProfile profile={profile} />
            </div>
        </div>
    );
}