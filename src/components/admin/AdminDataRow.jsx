import { Box } from "@mui/material";
import { CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { wikiEditorListRowSx } from "../../constants/wikiEditorStyles";

/** Fila de lista admin con slot de acciones a la derecha. */
export default function AdminDataRow({ primary, secondary, meta, actions, children }) {
    return (
        <Box sx={{ ...wikiEditorListRowSx, flexWrap: "wrap", gap: 0.75, py: 1 }}>
            <Box sx={{ flex: 1, minWidth: 140 }}>
                {primary && (
                    <CyberText sx={{ fontSize: "0.82rem", fontWeight: 600, color: UI_COLORS.textPrimary }}>
                        {primary}
                    </CyberText>
                )}
                {secondary && (
                    <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.textSecondary, mt: 0.25 }}>
                        {secondary}
                    </CyberText>
                )}
                {children}
            </Box>
            {meta ? (
                <Box sx={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
                    {typeof meta === "string" || typeof meta === "number" ? (
                        <CyberText sx={{ fontSize: "0.62rem", color: UI_COLORS.anomaly }}>
                            {meta}
                        </CyberText>
                    ) : (
                        meta
                    )}
                </Box>
            ) : null}
            {actions && (
                <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", flexShrink: 0 }}>
                    {actions}
                </Box>
            )}
        </Box>
    );
}
