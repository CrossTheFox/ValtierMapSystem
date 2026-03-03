import WorldDrawer from "../components/WorldDrawer";
import LocationInfoCard from "../components/LocationInfoCard";

export default function UIOverlay() {
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
        </div>
    );
}