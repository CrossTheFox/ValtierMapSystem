import { Box } from "@mui/material";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import ArticleIcon from "@mui/icons-material/Article";
import BoltIcon from "@mui/icons-material/Bolt";
import HubIcon from "@mui/icons-material/Hub";
import FavoriteIcon from "@mui/icons-material/Favorite";

import CyberTooltip from "../customs/CyberTooltip";
import { CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { CHARACTER_SHEET_TOKENS } from "../../constants/characterSheetTokens";

export const SHEET_TABS = [
    { id: "STATS", label: "STATS", short: "STAT", Icon: ShowChartIcon },
    { id: "BIO", label: "BIO", short: "BIO", Icon: ArticleIcon },
    { id: "SKILLS", label: "SKILLS", short: "SKL", Icon: BoltIcon },
    { id: "SKILL_MATRIX", label: "SKILL_MATRIX", short: "MAT", Icon: HubIcon },
    { id: "BOND", label: "BOND", short: "BND", Icon: FavoriteIcon },
];

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
                                maxWidth: 120,
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
