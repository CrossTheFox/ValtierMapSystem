import { Box } from "@mui/material";
import { CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";

/**
 * Navegación lateral vertical para sub-secciones del admin panel.
 * @param {{ items: Array<{id:string,label:string,hint?:string}>, activeId: string, onChange: (id:string)=>void }} props
 */
export default function AdminSidebarNav({ items = [], activeId, onChange }) {
    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 0.35,
                pr: 1,
                borderRight: `1px solid ${UI_COLORS.border}`,
                minWidth: 148,
                flexShrink: 0,
            }}
        >
            {items.map(({ id, label, hint }) => {
                const active = activeId === id;
                return (
                    <Box
                        key={id}
                        component="button"
                        type="button"
                        onClick={() => onChange(id)}
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-start",
                            textAlign: "left",
                            px: 1.25,
                            py: 0.85,
                            border: `1px solid ${active ? UI_COLORS.accent : "transparent"}`,
                            borderLeft: `3px solid ${active ? UI_COLORS.accent : "transparent"}`,
                            borderRadius: 0.75,
                            bgcolor: active ? `${UI_COLORS.accent}12` : "transparent",
                            cursor: "pointer",
                            transition: "background-color 0.15s, border-color 0.15s",
                            "&:hover": {
                                bgcolor: `${UI_COLORS.accent}08`,
                                borderColor: `${UI_COLORS.accent}44`,
                            },
                        }}
                    >
                        <CyberText
                            sx={{
                                fontFamily: "'Orbitron', sans-serif",
                                fontSize: "0.62rem",
                                letterSpacing: 1.2,
                                color: active ? UI_COLORS.accent : UI_COLORS.textSecondary,
                                fontWeight: 700,
                            }}
                        >
                            {label}
                        </CyberText>
                        {hint && (
                            <CyberText sx={{ fontSize: "0.58rem", color: UI_COLORS.textSecondary, mt: 0.25, lineHeight: 1.3 }}>
                                {hint}
                            </CyberText>
                        )}
                    </Box>
                );
            })}
        </Box>
    );
}
