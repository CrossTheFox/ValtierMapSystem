import { Box, Tooltip } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { openDialog, openWikiOverlay, setWikiOverlayMinimized } from "../../store/uiSlice";
import { VTT_HUD } from "../../constants/vttHudTokens";

const chipSx = (active) => ({
    fontFamily: "'Fira Code', monospace",
    fontSize: VTT_HUD.chipFontSize,
    letterSpacing: VTT_HUD.chipLetterSpacing,
    px: 1,
    py: 0.5,
    borderRadius: 0.75,
    border: "1px solid",
    borderColor: active ? "rgba(0,242,234,0.5)" : "rgba(255,255,255,0.12)",
    bgcolor: active ? "rgba(0,242,234,0.1)" : "transparent",
    color: active ? "#00f2ea" : "rgba(255,255,255,0.55)",
    cursor: "pointer",
    userSelect: "none",
    transition: "border-color 0.18s, color 0.18s, background-color 0.18s, box-shadow 0.18s",
    "&:hover": {
        borderColor: "#ff66ff",
        color: "#ff66ff",
        bgcolor: "rgba(255,102,255,0.08)",
        boxShadow: "0 0 10px rgba(255,102,255,0.2)",
    },
});

export default function TopLeftHUD() {
    const dispatch = useDispatch();
    const { openDialogs, wikiOverlay } = useSelector((s) => s.ui);
    const campaignName = useSelector((s) => s.world.selectedCampaignName);

    const campaignLabel = campaignName
        ? campaignName.toUpperCase()
        : "VALT6-01";

    return (
        <Box
            sx={{
                position: "fixed",
                top: VTT_HUD.inset,
                left: VTT_HUD.inset,
                zIndex: 1200,
                pointerEvents: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 0.75,
                p: "8px 12px",
                borderRadius: `${VTT_HUD.borderRadius}px`,
                border: `1px solid ${VTT_HUD.glassBorder}`,
                bgcolor: VTT_HUD.glassBg,
                backdropFilter: "blur(14px)",
                boxShadow: "0 0 20px rgba(255,102,255,0.06)",
            }}
        >
            <Box
                sx={{
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: VTT_HUD.titleFontSize,
                    letterSpacing: VTT_HUD.titleLetterSpacing,
                    color: "#ff66ff",
                    mb: 0.25,
                }}
            >
                {campaignLabel}
            </Box>

            {/* Action chips */}
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                <Tooltip title="Personajes globales" placement="bottom">
                    <Box
                        component="button"
                        onClick={() => dispatch(openDialog("characters"))}
                        sx={chipSx(openDialogs.characters)}
                    >
                        CHARS
                    </Box>
                </Tooltip>

                <Tooltip title="Archivos narrativos / Lore" placement="bottom">
                    <Box
                        component="button"
                        onClick={() => dispatch(openDialog("loreBrowser"))}
                        sx={chipSx(openDialogs.loreBrowser)}
                    >
                        LORE
                    </Box>
                </Tooltip>

                <Tooltip title="Wiki / Narrative Archive" placement="bottom">
                    <Box
                        component="button"
                        onClick={() => {
                            dispatch(setWikiOverlayMinimized(false));
                            dispatch(openWikiOverlay({ mode: "list" }));
                        }}
                        sx={chipSx(wikiOverlay.open)}
                    >
                        ARCHIVE
                    </Box>
                </Tooltip>
            </Box>
        </Box>
    );
}
