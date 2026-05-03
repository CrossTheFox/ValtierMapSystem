import { Typography } from "@mui/material";
import { useDialogFontSize } from "../../contexts/DialogFontSizeContext";

const BASE_CYBER_TEXT_SIZE = 0.85; // rem
const FONT_SIZE_STEP_REM = 0.18;   // added rem per step

// Títulos: Orbitron (HUD original). Cuerpo: Fira Sans (legibilidad).
const FONT_TITLE = "'Orbitron', sans-serif";
const FONT_BODY = "'Fira Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";

export const CyberTitle = ({ children, sx = {}, ...props }) => (
    <Typography
        {...props}
        sx={{
            fontFamily: FONT_TITLE,
            textTransform: "uppercase",
            letterSpacing: "2px",
            ...sx,
        }}
    >
        {children}
    </Typography>
);

export const CyberText = ({ children, sx = {}, ...props }) => {
    const step = useDialogFontSize();
    const scaledSize = `${(BASE_CYBER_TEXT_SIZE + step * FONT_SIZE_STEP_REM).toFixed(2)}rem`;
    return (
        <Typography
            {...props}
            sx={{
                fontFamily: FONT_BODY,
                fontSize: scaledSize,
                lineHeight: 1.8,
                WebkitFontSmoothing: "antialiased",
                ...sx,
            }}
        >
            {children}
        </Typography>
    );
};