import { Typography } from "@mui/material";
import { useDialogFontSize } from "../../contexts/DialogFontSizeContext";

const BASE_CYBER_TEXT_SIZE = 0.85; // rem
const FONT_SIZE_STEP_REM = 0.18;   // added rem per step

// Tipografía para Títulos (Orbitron)
export const CyberTitle = ({ children, sx = {}, ...props }) => (
    <Typography
        {...props}
        sx={{
            fontFamily: "'Orbitron', sans-serif",
            textTransform: "uppercase",
            letterSpacing: "2px",
            ...sx,
        }}
    >
        {children}
    </Typography>
);

// Tipografía para Cuerpo y Datos — scales with DialogFontSizeContext
export const CyberText = ({ children, sx = {}, ...props }) => {
    const step = useDialogFontSize();
    const scaledSize = `${(BASE_CYBER_TEXT_SIZE + step * FONT_SIZE_STEP_REM).toFixed(2)}rem`;
    return (
        <Typography
            {...props}
            sx={{
                fontFamily: "'Orbitron', sans-serif",
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