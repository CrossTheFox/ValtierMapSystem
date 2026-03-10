import { Box, styled } from "@mui/material";
import { UI_COLORS } from "../constants/uiColors";

export const Square = styled(Box)(({ delay, mt, ml }) => ({
    width: "10px",
    height: "10px",
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: mt,
    marginLeft: ml,
    backgroundColor: UI_COLORS.accent,
    boxShadow: `0 0 10px ${UI_COLORS.accentGlow}`,
    animation: `loader_opacity 675ms ease-in-out ${delay}ms infinite alternate`,
    "@keyframes loader_opacity": {
        "from": { opacity: 0, transform: "scale(0.8)" },
        "to": { opacity: 1, transform: "scale(1.1)" }
    }
}));