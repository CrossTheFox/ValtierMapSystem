import { Box } from "@mui/material";

import StatRadarChart from "./StatRadarChart";
import { CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
const TXT_MUTED = { color: "rgba(255,255,255,0.55)" };

export default function CharStatsTab({ character, statDefinitions = [], maxStat = 6 }) {
    const stats = character?.stats || {};

    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "flex-start",
                gap: 4,
                p: { xs: 2, sm: 3.5 },
                minHeight: "min-content",
            }}
        >
            <StatRadarChart statDefinitions={statDefinitions} stats={stats} maxStat={maxStat} />
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 1.25, minWidth: 240 }}>
                {statDefinitions.map((stat) => {
                    const val = stats[stat.key] ?? 0;
                    const pct = Math.min((val / maxStat) * 100, 100);
                    return (
                        <Box
                            key={stat.key}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1.5,
                                p: 1.25,
                                bgcolor: UI_COLORS.backgroundSecondary,
                                border: `1px solid ${UI_COLORS.border}`,
                                borderRadius: 1,
                                "&:hover": { borderColor: `${UI_COLORS.anomaly}44` },
                            }}
                        >
                            <CyberText
                                sx={{
                                    fontFamily: "monospace",
                                    fontSize: "0.62rem",
                                    color: UI_COLORS.textSecondary,
                                    width: 88,
                                    flexShrink: 0,
                                    letterSpacing: "0.06em",
                                }}
                            >
                                {(stat.label || stat.key).toUpperCase()}
                            </CyberText>
                            <Box sx={{ flex: 1, height: 6, bgcolor: "rgba(255,255,255,0.06)", borderRadius: 0.5, overflow: "hidden" }}>
                                <Box
                                    sx={{
                                        height: "100%",
                                        width: `${pct}%`,
                                        borderRadius: 0.5,
                                        background: `linear-gradient(90deg, ${UI_COLORS.anomaly}, ${UI_COLORS.accent})`,
                                    }}
                                />
                            </Box>
                            <CyberText
                                sx={{
                                    fontFamily: "monospace",
                                    fontSize: "0.85rem",
                                    color: UI_COLORS.anomaly,
                                    fontWeight: 600,
                                    minWidth: 24,
                                    textAlign: "center",
                                }}
                            >
                                {val}
                            </CyberText>
                        </Box>
                    );
                })}
                {statDefinitions.length === 0 && (
                    <CyberText sx={{ ...TXT_MUTED, fontSize: "0.85rem" }}>No stat definitions for this campaign.</CyberText>
                )}
            </Box>
        </Box>
    );
}
