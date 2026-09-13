import { useCallback, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Box, MenuItem, ListItemIcon, ListItemText } from "@mui/material";
import TheatersIcon from "@mui/icons-material/Theaters";
import { showSnackbar } from "../../store/uiSlice";
import { cyberMenuItemSx } from "../../constants/designSystem";
import { UI_COLORS } from "../../constants/uiColors";
import { VTT_HUD } from "../../constants/vttHudTokens";
import { isDmRole } from "../../utils/tokenControl";
import { publishCharacterSpotlightForCharacter } from "../../utils/publishCharacterSpotlightForCharacter";

/**
 * DM-only: trigger Roll20-style character spotlight for all players.
 * @param {{ character: object, onDone?: () => void, variant?: "menu"|"button" }} props
 */
export function useShowCharacterToTable(character, { onDone } = {}) {
    const dispatch = useDispatch();
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const profile = useSelector((s) => s.player.profile);
    const [busy, setBusy] = useState(false);

    const showToTable = useCallback(async () => {
        if (busy) return;
        setBusy(true);
        try {
            const result = await publishCharacterSpotlightForCharacter(character, campaignId, profile);
            if (result.ok) {
                onDone?.();
            } else {
                dispatch(showSnackbar({
                    message: result.message || "No se pudo mostrar",
                    severity: "warning",
                }));
            }
        } finally {
            setBusy(false);
        }
    }, [busy, character, campaignId, profile, dispatch, onDone]);

    return { showToTable, busy, canShow: isDmRole(profile?.role) && Boolean(character?.id) };
}

/** Menu row for MUI Menu / context menus. */
export function ShowCharacterToTableMenuItem({ character, onDone, sx }) {
    const { showToTable, busy, canShow } = useShowCharacterToTable(character, { onDone });
    if (!canShow) return null;
    return (
        <MenuItem
            onClick={() => { if (!busy) showToTable(); }}
            disabled={busy}
            sx={{ ...cyberMenuItemSx, fontSize: "0.72rem", gap: 1, py: 0.85, ...sx }}
        >
            <ListItemIcon sx={{ minWidth: 28, color: UI_COLORS.accent }}>
                <TheatersIcon sx={{ fontSize: "1rem" }} />
            </ListItemIcon>
            <ListItemText
                primary="Mostrar a la mesa"
                primaryTypographyProps={{
                    sx: { color: UI_COLORS.textPrimary, fontFamily: "'Fira Code', monospace", fontSize: "0.72rem" },
                }}
            />
        </MenuItem>
    );
}

/** Glass button for dossier / HUD surfaces. */
export function ShowCharacterToTableButton({ character, onDone, sx }) {
    const { showToTable, busy, canShow } = useShowCharacterToTable(character, { onDone });
    if (!canShow) return null;
    return (
        <Box
            component="button"
            type="button"
            disabled={busy}
            onClick={showToTable}
            sx={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 0.75,
                width: "100%",
                px: 1.25,
                py: 0.65,
                border: `1px solid ${VTT_HUD.glassBorder}`,
                borderRadius: 1,
                bgcolor: "rgba(0,0,0,0.45)",
                color: UI_COLORS.accent,
                fontFamily: "'Orbitron', sans-serif",
                fontSize: "0.48rem",
                letterSpacing: "0.14em",
                cursor: busy ? "default" : "pointer",
                opacity: busy ? 0.6 : 1,
                transition: "border-color 0.15s, box-shadow 0.15s, color 0.15s",
                "&:hover:not(:disabled)": {
                    borderColor: UI_COLORS.accent,
                    boxShadow: `0 0 12px ${UI_COLORS.accentGlow}`,
                    color: UI_COLORS.textPrimary,
                },
                ...sx,
            }}
        >
            <TheatersIcon sx={{ fontSize: "0.9rem" }} />
            MOSTRAR A LA MESA
        </Box>
    );
}

/** Context-menu row (MapContextMenu style). */
export function ShowCharacterToTableContextRow({ character, onDone, hudBtnSx }) {
    const { showToTable, busy, canShow } = useShowCharacterToTable(character, { onDone });
    if (!canShow) return null;
    return (
        <Box
            component="button"
            type="button"
            disabled={busy}
            onClick={showToTable}
            sx={{
                ...hudBtnSx,
                borderBottom: `1px solid ${VTT_HUD.glassBorder}`,
                opacity: busy ? 0.6 : 1,
            }}
        >
            <TheatersIcon sx={{ fontSize: "1rem", color: UI_COLORS.accent }} />
            MOSTRAR A LA MESA
        </Box>
    );
}
