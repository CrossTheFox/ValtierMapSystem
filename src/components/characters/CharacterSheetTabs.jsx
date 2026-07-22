import { Box } from "@mui/material";
import BadgeIcon from "@mui/icons-material/Badge";
import ConstructionIcon from "@mui/icons-material/Construction";

import CyberTooltip from "../customs/CyberTooltip";
import { CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { CHARACTER_SHEET_TOKENS } from "../../constants/characterSheetTokens";

export const SHEET_TABS = [
    { id: "IDENTIDAD", label: "IDENTIDAD", short: "ID", Icon: BadgeIcon },
    { id: "KIT", label: "KIT", short: "KIT", Icon: ConstructionIcon },
];

/** Map legacy tab ids from previous 5-tab sheet. */
export function normalizeSheetTab(tabId) {
    if (tabId === "IDENTIDAD" || tabId === "KIT") return tabId;
    if (tabId === "SKILLS" || tabId === "SKILL_MATRIX") return "KIT";
    return "IDENTIDAD";
}

export default function CharacterSheetTabs({ value, onChange }) {
    return (
        <Box
            className="dialog-no-drag"
            sx={{
                flexShrink: 0,
                display: "flex",
                bgcolor: UI_COLORS.backgroundSecondary,
                borderBottom: `1px solid ${UI_COLORS.border}`,
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
                                flex: 1,
                                maxWidth: 160,
                                height: CHARACTER_SHEET_TOKENS.tabHeight,
                                border: "none",
                                borderBottom: active ? `2px solid ${UI_COLORS.anomaly}` : "2px solid transparent",
                                bgcolor: "transparent",
                                color: active ? UI_COLORS.anomaly : UI_COLORS.textSecondary,
                                cursor: "pointer",
                                transition: "color 0.15s, border-color 0.15s",
                                px: 0.75,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 0.4,
                                "&:hover": { color: UI_COLORS.textPrimary },
                            }}
                        >
                            <Icon sx={{ fontSize: "0.85rem", flexShrink: 0 }} />
                            <CyberText
                                sx={{
                                    fontFamily: "monospace",
                                    fontSize: "0.5rem",
                                    letterSpacing: "0.08em",
                                    display: { xs: "none", sm: "block" },
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
