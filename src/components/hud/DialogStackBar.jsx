import { Box } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import {
    closeDialog,
    closeWikiOverlay,
    restoreDialog,
    setSelectedLore,
} from "../../store/uiSlice";
import { DIALOG_IDS } from "../../constants/dialogIds";
import { UI_COLORS, PANEL, TYPO, SIZE } from "../../constants/designSystem";

/**
 * Bottom-center pill listing minimized HUD dialogs.
 * Visible whenever at least one open dialog is minimized.
 */
export default function DialogStackBar() {
    const dispatch = useDispatch();
    const {
        openDialogs,
        selectedLocation,
        selectedLore,
        minimizedDialogs,
        locationDialogOpen,
        wikiOverlay,
    } = useSelector((s) => s.ui);

    const stack = [
        locationDialogOpen && selectedLocation && {
            id: DIALOG_IDS.LOCATION,
            label: "LOCACIÓN",
            minimized: minimizedDialogs[DIALOG_IDS.LOCATION],
        },
        selectedLore && {
            id: DIALOG_IDS.LORE,
            label: "CHRONICLE",
            minimized: minimizedDialogs[DIALOG_IDS.LORE],
        },
        openDialogs.loreBrowser && {
            id: DIALOG_IDS.LORE_BROWSER,
            label: "LORE",
            minimized: minimizedDialogs[DIALOG_IDS.LORE_BROWSER],
        },
        openDialogs.characters && {
            id: DIALOG_IDS.CHARACTERS,
            label: "CHARS",
            minimized: minimizedDialogs[DIALOG_IDS.CHARACTERS],
        },
        openDialogs.sheet && {
            id: DIALOG_IDS.SHEET,
            label: "DOSSIER",
            minimized: minimizedDialogs[DIALOG_IDS.SHEET],
        },
        openDialogs.settings && {
            id: DIALOG_IDS.SETTINGS,
            label: "CONFIG",
            minimized: minimizedDialogs[DIALOG_IDS.SETTINGS],
        },
        wikiOverlay.open && {
            id: DIALOG_IDS.WIKI,
            label: "ARCHIVE",
            minimized: minimizedDialogs[DIALOG_IDS.WIKI],
        },
    ].filter(Boolean);

    if (!stack.some((item) => item.minimized)) return null;

    const handleChipClick = (item) => {
        if (item.minimized) dispatch(restoreDialog(item.id));
    };

    const handleChipClose = (e, item) => {
        e.stopPropagation();
        if (item.id === DIALOG_IDS.LOCATION) {
            if (item.minimized) dispatch(restoreDialog(item.id));
        } else if (item.id === DIALOG_IDS.LORE) {
            dispatch(setSelectedLore(null));
        } else if (item.id === DIALOG_IDS.WIKI) {
            dispatch(closeWikiOverlay());
        } else {
            dispatch(closeDialog(item.id));
        }
    };

    return (
        <Box
            sx={{
                position: "fixed",
                bottom: 16,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 1300,
                pointerEvents: "auto",
                display: "flex",
                gap: 0.75,
                px: 1.5,
                py: 0.75,
                bgcolor: PANEL.glassBg,
                border: `1px solid ${PANEL.glassBorder}`,
                borderRadius: "99px",
                backdropFilter: "blur(12px)",
                animation: "fadeIn 0.2s ease-out",
                "@keyframes fadeIn": {
                    from: { opacity: 0, transform: "translateX(-50%) translateY(8px)" },
                    to: { opacity: 1, transform: "translateX(-50%) translateY(0)" },
                },
            }}
        >
            {stack.map((item) => (
                <Box
                    key={item.id}
                    onClick={() => handleChipClick(item)}
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        px: 1.25,
                        py: 0.4,
                        borderRadius: "99px",
                        border: `1px solid ${item.minimized ? UI_COLORS.accent + "88" : "rgba(255,255,255,0.15)"}`,
                        bgcolor: item.minimized ? `${UI_COLORS.accent}15` : "transparent",
                        color: item.minimized ? UI_COLORS.accent : "rgba(255,255,255,0.55)",
                        fontFamily: TYPO.mono,
                        fontSize: SIZE.chipFont,
                        letterSpacing: SIZE.chipLetterSpacing,
                        cursor: item.minimized ? "pointer" : "default",
                        transition: "border-color 0.15s, color 0.15s",
                    }}
                >
                    {item.label}
                    <Box
                        component="button"
                        onClick={(e) => handleChipClose(e, item)}
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 14,
                            height: 14,
                            borderRadius: "50%",
                            border: "none",
                            bgcolor: "transparent",
                            color: "rgba(255,255,255,0.35)",
                            cursor: "pointer",
                            fontSize: "0.6rem",
                            p: 0,
                            "&:hover": { color: "#ff4d4d" },
                        }}
                    >
                        ✕
                    </Box>
                </Box>
            ))}
        </Box>
    );
}
