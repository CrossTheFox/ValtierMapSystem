import { Box } from "@mui/material";
import { CyberTitle, CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { wikiEditorPanelShellSx } from "../../constants/wikiEditorStyles";

/** Panel con título, hint opcional y borde cyber (estilo wiki editor). */
export default function AdminSectionShell({ title, hint, children, sx = {} }) {
    return (
        <Box sx={{ ...wikiEditorPanelShellSx, ...sx }}>
            {title && (
                <CyberTitle
                    variant="caption"
                    sx={{ color: UI_COLORS.accent, letterSpacing: 2, fontSize: "0.68rem" }}
                >
                    {title}
                </CyberTitle>
            )}
            {hint && (
                <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.textSecondary, lineHeight: 1.45, mt: -0.5 }}>
                    {hint}
                </CyberText>
            )}
            {children}
        </Box>
    );
}
