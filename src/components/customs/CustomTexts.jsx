import { Typography } from "@mui/material";

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

// Tipografía para Cuerpo y Datos (Michroma)
export const CyberText = ({ children, sx = {}, ...props }) => (
    <Typography
        {...props}
        sx={{
            fontFamily: "'Michroma', sans-serif",
            fontSize: "0.85rem", // Michroma suele ser grande, bajamos un poco el scale
            lineHeight: 1.8,
            WebkitFontSmoothing: "antialiased",
            ...sx,
        }}
    >
        {children}
    </Typography>
);