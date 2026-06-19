import { Box } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { openLocation } from "../../store/uiSlice";
import { UI_COLORS } from "../../constants/uiColors";
import { VTT_HUD } from "../../constants/vttHudTokens";

export default function LocationPreviewHUD() {
    const dispatch = useDispatch();
    const previewId = useSelector((s) => s.ui.previewLocation?.id);
    const locations = useSelector((s) => s.world.locations);
    const previewLocation = previewId ? locations[previewId] : null;

    if (!previewLocation) return null;

    const charCount = previewLocation.characters?.length ?? 0;
    const name = previewLocation.name ?? "LOCATION";
    const missionCount = Array.isArray(previewLocation.missions)
        ? previewLocation.missions.filter((m) => m.status === "active" && m.visibility !== "dm_only").length
        : 0;

    const metaParts = [
        "Ubicación",
        charCount > 0 ? `${charCount} personaje${charCount !== 1 ? "s" : ""}` : "sin personajes",
    ];
    if (missionCount > 0) {
        metaParts.push(`${missionCount} misión${missionCount !== 1 ? "es" : ""} activa${missionCount !== 1 ? "s" : ""}`);
    }

    const handleOpenFicha = () => {
        dispatch(openLocation(previewLocation));
    };

    return (
        <Box
            sx={{
                position: "fixed",
                bottom: VTT_HUD.inset,
                left: VTT_HUD.inset,
                zIndex: 1200,
                pointerEvents: "auto",
                maxWidth: VTT_HUD.previewMaxWidth,
                p: "12px 14px",
                borderRadius: `${VTT_HUD.borderRadius}px`,
                border: `1px solid ${VTT_HUD.glassBorder}`,
                bgcolor: VTT_HUD.glassBg,
                backdropFilter: "blur(14px)",
                boxShadow: "0 0 20px rgba(255,102,255,0.06)",
                animation: "slideUp 0.22s ease-out",
                "@keyframes slideUp": {
                    from: { opacity: 0, transform: "translateY(10px)" },
                    to: { opacity: 1, transform: "translateY(0)" },
                },
            }}
        >
            <Box
                sx={{
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: VTT_HUD.previewNameFontSize,
                    fontWeight: 600,
                    color: "#fff",
                    letterSpacing: "0.06em",
                    mb: 0.5,
                    textTransform: "uppercase",
                }}
            >
                {name}
            </Box>

            <Box
                sx={{
                    fontFamily: "'Fira Sans', sans-serif",
                    fontSize: VTT_HUD.previewMetaFontSize,
                    color: "rgba(255,255,255,0.45)",
                    letterSpacing: "0.02em",
                    mb: 1,
                }}
            >
                {metaParts.join(" · ")}
            </Box>

            <Box
                component="button"
                onClick={handleOpenFicha}
                sx={{
                    fontFamily: "'Fira Code', monospace",
                    fontSize: "9px",
                    letterSpacing: VTT_HUD.chipLetterSpacing,
                    textTransform: "uppercase",
                    px: "10px",
                    py: "6px",
                    borderRadius: 0.75,
                    border: `1px solid ${UI_COLORS.accent}55`,
                    bgcolor: `${UI_COLORS.accent}0f`,
                    color: UI_COLORS.accent,
                    cursor: "pointer",
                    transition: "border-color 0.18s, box-shadow 0.18s",
                    "&:hover": {
                        borderColor: UI_COLORS.accent,
                        boxShadow: `0 0 10px ${UI_COLORS.accent}33`,
                    },
                }}
            >
                ABRIR FICHA COMPLETA
            </Box>
        </Box>
    );
}
