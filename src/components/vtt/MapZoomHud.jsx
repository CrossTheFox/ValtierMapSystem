import { useState } from "react";
import { useSelector } from "react-redux";
import { Box, IconButton, Menu, MenuItem, ListItemIcon, ListItemText } from "@mui/material";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import FitScreenIcon from "@mui/icons-material/FitScreen";
import FilterCenterFocusIcon from "@mui/icons-material/FilterCenterFocus";

import useMapZoomControls from "../../hooks/useMapZoomControls";
import { UI_COLORS } from "../../constants/uiColors";
import { VTT_HUD } from "../../constants/vttHudTokens";
import { cyberMenuItemSx, cyberMenuPaperSx } from "../../constants/designSystem";
import CyberTooltip from "../customs/CyberTooltip";

const HUD_BTN_RADIUS = "3px";

const zoomBtnSx = {
    width: 28,
    height: 28,
    borderRadius: HUD_BTN_RADIUS,
    color: UI_COLORS.anomaly,
    border: `1px solid ${UI_COLORS.anomaly}55`,
    bgcolor: "rgba(0,0,0,0.28)",
    p: 0,
    flexShrink: 0,
    "&:hover": {
        borderColor: UI_COLORS.accent,
        bgcolor: `${UI_COLORS.accent}14`,
        color: UI_COLORS.accent,
    },
};

/**
 * Vertical zoom strip — sits beside MapSelectorHUD, same height as the map card.
 */
export default function MapZoomHud() {
    const wikiOverlayOpen = useSelector((s) => s.ui.wikiOverlay.open);
    const { ready, scalePct, zoomIn, zoomOut, fitToScreen, centerMap } = useMapZoomControls();
    const [menuAnchor, setMenuAnchor] = useState(null);
    const menuOpen = Boolean(menuAnchor);

    if (!ready || wikiOverlayOpen) return null;

    return (
        <Box
            data-no-token-drop
            sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "space-between",
                width: VTT_HUD.topIslandZoomWidth,
                height: VTT_HUD.topIslandHeight,
                boxSizing: "border-box",
                px: 0.4,
                py: 0.65,
                borderRadius: `${VTT_HUD.borderRadius}px`,
                border: `1px solid ${VTT_HUD.glassBorder}`,
                bgcolor: VTT_HUD.glassBg,
                backdropFilter: "blur(14px)",
                boxShadow: "0 0 22px rgba(255,102,255,0.08)",
            }}
        >
            <CyberTooltip title="Acercar" placement="right">
                <IconButton size="small" onClick={zoomIn} aria-label="Zoom in" sx={zoomBtnSx}>
                    <ZoomInIcon sx={{ fontSize: "0.95rem" }} />
                </IconButton>
            </CyberTooltip>

            <CyberTooltip title="Ajustar / centrar mapa" placement="right">
                <Box
                    component="button"
                    type="button"
                    onClick={(e) => setMenuAnchor(e.currentTarget)}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen ? "true" : undefined}
                    aria-label={`Zoom ${scalePct} por ciento`}
                    sx={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: 0,
                        width: "100%",
                        my: 0.35,
                        px: 0.25,
                        border: `1px solid ${UI_COLORS.anomaly}44`,
                        borderRadius: HUD_BTN_RADIUS,
                        bgcolor: "rgba(0,0,0,0.35)",
                        color: UI_COLORS.anomaly,
                        cursor: "pointer",
                        textShadow: `0 0 8px ${UI_COLORS.anomaly}55`,
                        "&:hover": {
                            borderColor: UI_COLORS.accent,
                            color: UI_COLORS.accent,
                            bgcolor: `${UI_COLORS.accent}10`,
                            textShadow: `0 0 10px ${UI_COLORS.accent}66`,
                        },
                    }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            lineHeight: 1,
                            userSelect: "none",
                        }}
                    >
                        <Box
                            component="span"
                            sx={{
                                fontFamily: "'Orbitron', sans-serif",
                                fontSize: "11px",
                                fontWeight: 700,
                                fontVariantNumeric: "tabular-nums",
                                letterSpacing: "0.02em",
                            }}
                        >
                            {scalePct}
                        </Box>
                        <Box
                            component="span"
                            sx={{
                                fontFamily: "'Orbitron', sans-serif",
                                fontSize: "7px",
                                fontWeight: 500,
                                letterSpacing: "0.14em",
                                opacity: 0.9,
                                mt: 0.2,
                            }}
                        >
                            %
                        </Box>
                    </Box>
                </Box>
            </CyberTooltip>

            <CyberTooltip title="Alejar" placement="right">
                <IconButton size="small" onClick={zoomOut} aria-label="Zoom out" sx={zoomBtnSx}>
                    <ZoomOutIcon sx={{ fontSize: "0.95rem" }} />
                </IconButton>
            </CyberTooltip>

            <Menu
                anchorEl={menuAnchor}
                open={menuOpen}
                onClose={() => setMenuAnchor(null)}
                anchorOrigin={{ vertical: "center", horizontal: "right" }}
                transformOrigin={{ vertical: "center", horizontal: "left" }}
                slotProps={{
                    paper: {
                        sx: { ...cyberMenuPaperSx, ml: 0.75, minWidth: 168 },
                    },
                }}
            >
                <MenuItem
                    onClick={() => { setMenuAnchor(null); fitToScreen(); }}
                    sx={cyberMenuItemSx}
                >
                    <ListItemIcon sx={{ color: UI_COLORS.anomaly, minWidth: 30 }}>
                        <FitScreenIcon sx={{ fontSize: "1rem" }} />
                    </ListItemIcon>
                    <ListItemText
                        primary="Ajustar al mapa"
                        primaryTypographyProps={{
                            sx: { color: UI_COLORS.textPrimary, fontSize: "0.72rem" },
                        }}
                    />
                </MenuItem>
                <MenuItem
                    onClick={() => { setMenuAnchor(null); centerMap(); }}
                    sx={cyberMenuItemSx}
                >
                    <ListItemIcon sx={{ color: UI_COLORS.anomaly, minWidth: 30 }}>
                        <FilterCenterFocusIcon sx={{ fontSize: "1rem" }} />
                    </ListItemIcon>
                    <ListItemText
                        primary="Centrar mapa"
                        primaryTypographyProps={{
                            sx: { color: UI_COLORS.textPrimary, fontSize: "0.72rem" },
                        }}
                    />
                </MenuItem>
            </Menu>
        </Box>
    );
}
