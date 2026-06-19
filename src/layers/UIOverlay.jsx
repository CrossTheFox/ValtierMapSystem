import { useSelector, useDispatch } from "react-redux";
import { closeDialog } from "../store/uiSlice";

import LocationInfoCard        from "../components/LocationInfoCard";
import LoreDialog              from "../components/LoreDialog";
import CharactersSettingsDialog from "../components/CharactersSettingsDialog";
import AdminSettingsDialog     from "../components/AdminSettingsDialog";
import CharactersGlobalDialog  from "../components/CharactersGlobalDialog";
import NarrativeWikiOverlay    from "../components/wiki/NarrativeWikiOverlay";
import CyberSnackbar           from "../components/customs/CyberSnackbar";
import MapContextMenu          from "../components/MapContextMenu";
import MeasuringHUD            from "../components/MeasuringHUD";

import TopLeftHUD              from "../components/hud/TopLeftHUD";
import TopRightHUD             from "../components/hud/TopRightHUD";
import LocationPreviewHUD      from "../components/hud/LocationPreviewHUD";
import DialogStackBar          from "../components/hud/DialogStackBar";

export default function UIOverlay() {
    const dispatch  = useDispatch();
    const profile   = useSelector((state) => state.player.profile);
    const { openDialogs } = useSelector((state) => state.ui);
    const isAuthenticated = !!profile;

    return (
        <div
            id="ui-overlay"
            style={{ position: "fixed", inset: 0, pointerEvents: "none" }}
        >
            {/* ── Dialogs (self-contained pointer events) ── */}
            <LocationInfoCard />
            <LoreDialog />
            {isAuthenticated && <NarrativeWikiOverlay />}

            <CharactersGlobalDialog
                open={openDialogs.characters}
                onClose={() => dispatch(closeDialog("characters"))}
            />

            <CharactersSettingsDialog
                open={openDialogs.sheet}
                onClose={() => dispatch(closeDialog("sheet"))}
            />

            {isAuthenticated && (
                <AdminSettingsDialog
                    open={openDialogs.settings}
                    onClose={() => dispatch(closeDialog("settings"))}
                />
            )}

            {/* ── Interactive HUD shell ── */}
            <div style={{ pointerEvents: "auto" }}>
                <TopLeftHUD />
                <TopRightHUD profile={profile} />
                <LocationPreviewHUD />
                <DialogStackBar />
                <MeasuringHUD />
                <MapContextMenu />
                <CyberSnackbar />
            </div>
        </div>
    );
}
