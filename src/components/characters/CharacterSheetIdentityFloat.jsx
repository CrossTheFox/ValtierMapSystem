import { Box } from "@mui/material";

import CharAvatar from "./CharAvatar";
import { CyberText, CyberTitle } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";

/**
 * Floating identity chip for the dossier — context only (no character picker).
 * Active character is chosen from the VTT combat HUD.
 */
export default function CharacterSheetIdentityFloat({ character, size = 44 }) {
    if (!character) return null;

    return (
        <Box
            className="dialog-no-drag"
            sx={{
                position: "absolute",
                top: 8,
                left: 10,
                zIndex: 24,
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1,
                py: 0.55,
                maxWidth: "min(320px, 52%)",
                borderRadius: 1.5,
                bgcolor: "rgba(10, 10, 20, 0.82)",
                backdropFilter: "blur(14px)",
                border: `1px solid ${UI_COLORS.accent}44`,
                boxShadow: `0 4px 22px rgba(0,0,0,0.45), 0 0 18px ${UI_COLORS.accentGlow || "rgba(255,102,255,0.18)"}`,
                pointerEvents: "none",
            }}
        >
            <Box
                sx={{
                    borderRadius: "50%",
                    border: `2px solid ${UI_COLORS.accent}`,
                    boxShadow: `0 0 10px ${UI_COLORS.accentGlow || "rgba(255,102,255,0.2)"}`,
                    bgcolor: "#0d0d14",
                    p: 0.15,
                    flexShrink: 0,
                }}
            >
                <CharAvatar
                    imagePath={character.imageUrl || character.tokenImageUrl}
                    name={character.name}
                    size={size}
                    status={character.status || "alive"}
                    crop={character.tokenCrop}
                />
            </Box>
            <Box sx={{ minWidth: 0 }}>
                <CyberTitle
                    sx={{
                        fontSize: "clamp(0.62rem, 0.95vw, 0.82rem)",
                        color: UI_COLORS.accent,
                        letterSpacing: "0.1em",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        lineHeight: 1.2,
                    }}
                >
                    {character.name?.toUpperCase() || "???"}
                </CyberTitle>
                <CyberText
                    sx={{
                        fontFamily: "monospace",
                        fontSize: "0.45rem",
                        letterSpacing: "0.12em",
                        color: UI_COLORS.textSecondary,
                        mt: 0.15,
                    }}
                >
                    DOSSIER · ACTIVO EN HUD
                </CyberText>
            </Box>
        </Box>
    );
}
