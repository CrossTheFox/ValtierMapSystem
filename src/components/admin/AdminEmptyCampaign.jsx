import { Box } from "@mui/material";
import { CyberTitle, CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";

export default function AdminEmptyCampaign() {
    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                minHeight: 280,
                px: 3,
                textAlign: "center",
                gap: 1,
            }}
        >
            <CyberTitle sx={{ fontSize: "0.85rem", color: UI_COLORS.accent, letterSpacing: 2 }}>
                SIN CAMPAÑA ACTIVA
            </CyberTitle>
            <CyberText sx={{ fontSize: "0.8rem", color: UI_COLORS.textSecondary, maxWidth: 360, lineHeight: 1.5 }}>
                Selecciona una campaña desde el selector de misiones antes de administrar accesos, mapas o contenido VTT.
            </CyberText>
        </Box>
    );
}
