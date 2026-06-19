import { Box } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { closeDialog, setIsMinimized, setSelectedLore } from "../../store/uiSlice";
import { UI_COLORS } from "../../constants/uiColors";

/**
 * Bottom-center pill that lists every open HUD dialog.
 * Appears only when 2+ dialogs are active so users can navigate without
 * losing context. Clicking a chip for a minimized dialog restores it.
 */
export default function DialogStackBar() {
    const dispatch = useDispatch();
    const { openDialogs, selectedLocation, selectedLore, isMinimized, locationDialogOpen } = useSelector((s) => s.ui);

    const stack = [
        locationDialogOpen && selectedLocation && { id: "location", label: "LOCACIÓN", minimized: isMinimized },
        selectedLore && { id: "lore", label: "CHRONICLE", minimized: isMinimized },
        openDialogs.loreBrowser && { id: "loreBrowser", label: "LORE" },
        openDialogs.characters && { id: "characters", label: "CHARS" },
        openDialogs.sheet && { id: "sheet", label: "SHEET" },
        openDialogs.settings && { id: "settings", label: "CONFIG" },
    ].filter(Boolean);

    if (stack.length < 2) return null;

    const handleChipClick = (item) => {
        if (item.id === "location" || item.id === "lore") {
            if (item.minimized) dispatch(setIsMinimized(false));
        }
        // For other dialogs they're full-size dialogs — no minimize state needed
    };

    const handleChipClose = (e, item) => {
        e.stopPropagation();
        if (item.id === "location") {
            // Don't close from here — just un-minimize
            if (item.minimized) dispatch(setIsMinimized(false));
        } else if (item.id === "lore") {
            dispatch(setSelectedLore(null));
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
                bgcolor: "rgba(5,5,8,0.92)",
                border: "1px solid rgba(255,255,255,0.1)",
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
                        fontFamily: "'Fira Code', monospace",
                        fontSize: "0.58rem",
                        letterSpacing: "0.1em",
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
