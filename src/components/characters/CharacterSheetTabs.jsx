import { Box } from "@mui/material";
import BadgeIcon from "@mui/icons-material/Badge";
import ConstructionIcon from "@mui/icons-material/Construction";
import HubIcon from "@mui/icons-material/Hub";

import CyberTooltip from "../customs/CyberTooltip";
import { CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { CHARACTER_SHEET_TOKENS } from "../../constants/characterSheetTokens";

export const SHEET_TABS = [
    { id: "IDENTIDAD", label: "IDENTIDAD", short: "ID",   Icon: BadgeIcon },
    { id: "KIT",       label: "KIT",       short: "KIT",  Icon: ConstructionIcon },
    { id: "MESH",      label: "MESH",      short: "MESH", Icon: HubIcon },
];

/** Map legacy tab ids from previous 5-tab sheet. */
export function normalizeSheetTab(tabId) {
    if (tabId === "IDENTIDAD" || tabId === "KIT" || tabId === "MESH") return tabId;
    if (tabId === "SKILLS" || tabId === "SKILL_MATRIX") return "KIT";
    return "IDENTIDAD";
}

export default function CharacterSheetTabs({ value, onChange, overlay = false }) {
    return (
        <Box
            className="dialog-no-drag"
            sx={{
                flexShrink: 0,
                display: "flex",
                justifyContent: "flex-end",
                gap: 0.25,
                ...(overlay
                    ? {
                          borderRadius: 1,
                          bgcolor: "rgba(10, 10, 20, 0.78)",
                          backdropFilter: "blur(12px)",
                          border: `1px solid ${UI_COLORS.border}`,
                          boxShadow: "0 2px 14px rgba(0,0,0,0.4)",
                          overflow: "hidden",
                          mr: 0.75,
                          mt: 0.25,
                      }
                    : {
                          bgcolor: "rgba(18, 18, 28, 0.72)",
                          borderBottom: `1px solid ${UI_COLORS.border}`,
                          minHeight: CHARACTER_SHEET_TOKENS.tabHeight,
                          width: "100%",
                      }),
            }}
        >
            {SHEET_TABS.map((tab) => {
                const active = value === tab.id;
                const Icon = tab.Icon;
                return (
                    <CyberTooltip key={tab.id} title={tab.label} placement="bottom">
                        <Box
                            component="button"
                            type="button"
                            onClick={() => onChange(tab.id)}
                            sx={{
                                flex: "0 0 auto",
                                minWidth: overlay ? 64 : 72,
                                height: CHARACTER_SHEET_TOKENS.tabHeight,
                                border: "none",
                                borderBottom: overlay
                                    ? "none"
                                    : active
                                      ? `2px solid ${UI_COLORS.anomaly}`
                                      : "2px solid transparent",
                                bgcolor: active && overlay ? `${UI_COLORS.anomaly}18` : "transparent",
                                color: active ? UI_COLORS.anomaly : UI_COLORS.textSecondary,
                                cursor: "pointer",
                                transition: "color 0.15s, background 0.15s",
                                px: 1.1,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 0.4,
                                "&:hover": { color: UI_COLORS.textPrimary },
                            }}
                        >
                            <Icon sx={{ fontSize: "0.8rem", flexShrink: 0 }} />
                            <CyberText
                                sx={{
                                    fontFamily: "monospace",
                                    fontSize: "0.5rem",
                                    letterSpacing: "0.08em",
                                    color: "inherit",
                                }}
                            >
                                {tab.short}
                            </CyberText>
                        </Box>
                    </CyberTooltip>
                );
            })}
        </Box>
    );
}
