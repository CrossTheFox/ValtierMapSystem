import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useDispatch } from "react-redux";
import { Box } from "@mui/material";

import AdminSettingsDialog from "../components/AdminSettingsDialog";
import LocationInfoCard from "../components/LocationInfoCard";
import LoreDialog from "../components/LoreDialog";
import CharactersSettingsDialog from "../components/CharactersSettingsDialog";

import { openLocation, setSelectedLore } from "../store/uiSlice";
import { STORAGE_KEY } from "../hooks/usePopout";

/**
 * Rendered inside a detached popup window (opened via window.open).
 * Reads ?dialog=xxx from the URL, restores any serialized payload from
 * localStorage, then renders the matching dialog in popup mode (fullscreen,
 * no minimize/popout controls).
 */
export default function PopupDialogPage() {
    const [searchParams] = useSearchParams();
    const dialog = searchParams.get("dialog");
    const dispatch = useDispatch();

    // Restore Redux state from the payload the main window stored
    useEffect(() => {
        if (!dialog) return;
        const raw = localStorage.getItem(STORAGE_KEY(dialog));
        if (!raw) return;
        try {
            const payload = JSON.parse(raw);
            if (dialog === "lore")     dispatch(setSelectedLore(payload));
            if (dialog === "location") dispatch(openLocation(payload));
        } catch (_) { /* malformed payload — ignore */ }
    }, [dialog, dispatch]);

    // Give the popup window a descriptive title
    useEffect(() => {
        document.title = `◈ ${(dialog || "POPUP").toUpperCase().replace(/-/g, " ")} — DETACHED`;
    }, [dialog]);

    return (
        <Box sx={{ bgcolor: "#0d0d14", color: "#fff", width: "100vw", height: "100vh" }}>
            {dialog === "admin"      && <AdminSettingsDialog open popupMode onClose={() => window.close()} />}
            {dialog === "location"   && <LocationInfoCard popupMode />}
            {dialog === "lore"       && <LoreDialog popupMode />}
            {dialog === "characters" && <CharactersSettingsDialog open popupMode onClose={() => window.close()} />}
        </Box>
    );
}
