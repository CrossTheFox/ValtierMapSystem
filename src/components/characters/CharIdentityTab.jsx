import { useState } from "react";
import { Box, Collapse, IconButton } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import StatRadarChart from "./StatRadarChart";
import CharBioTab from "./CharBioTab";
import CharBondTab from "./CharBondTab";
import { CyberText, CyberTitle } from "../customs/CustomTexts";
import CyberTooltip from "../customs/CyberTooltip";
import { UI_COLORS } from "../../constants/uiColors";

const TXT_MUTED = { color: UI_COLORS.textSecondary };

/**
 * Dense segmented bar: value / maxStat (campaign max).
 */
function StatBarRow({ label, value, maxStat }) {
    const val = Math.max(0, Number(value) || 0);
    const max = Math.max(1, maxStat);
    const filled = Math.min(val, max);
    const isMaxed = val >= max;
    const color = isMaxed ? UI_COLORS.accentStrong : UI_COLORS.accent;

    return (
        <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 0.35, gap: 0.5 }}>
                <CyberText
                    sx={{
                        fontFamily: "monospace",
                        fontSize: "0.55rem",
                        letterSpacing: "0.08em",
                        color: UI_COLORS.textSecondary,
                        textTransform: "uppercase",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {label}
                </CyberText>
                <CyberText
                    sx={{
                        fontFamily: "monospace",
                        fontSize: "0.72rem",
                        color,
                        fontWeight: 600,
                        flexShrink: 0,
                    }}
                >
                    {val}/{max}
                </CyberText>
            </Box>
            <Box sx={{ display: "flex", gap: 0.35 }}>
                {Array.from({ length: max }, (_, i) => (
                    <Box
                        key={i}
                        sx={{
                            height: 6,
                            flex: 1,
                            borderRadius: "1px",
                            bgcolor: i < filled ? color : "rgba(42,42,61,0.45)",
                            border: `1px solid ${i < filled ? color : UI_COLORS.border}`,
                            boxShadow: i < filled ? `0 0 6px ${color}44` : "none",
                        }}
                    />
                ))}
            </Box>
        </Box>
    );
}

function SectionLabel({ children }) {
    return (
        <CyberText
            sx={{
                fontFamily: "monospace",
                fontSize: "0.58rem",
                letterSpacing: "0.14em",
                color: UI_COLORS.anomaly,
                mb: 1.25,
                display: "flex",
                alignItems: "center",
                gap: 1,
                "&::after": {
                    content: '""',
                    flex: 1,
                    height: "1px",
                    bgcolor: UI_COLORS.border,
                },
            }}
        >
            {children}
        </CyberText>
    );
}

/**
 * Dossier IDENTIDAD: compact stats with max bars, collapsible radar, BIO + BOND.
 */
export default function CharIdentityTab({
    character,
    statDefinitions = [],
    maxStat = 4,
    wikiEntities = [],
}) {
    const [radarOpen, setRadarOpen] = useState(false);
    const stats = character?.stats || {};

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0, p: { xs: 1.5, sm: 2.5 } }}>
            <Box sx={{ mb: 2.5 }}>
                <SectionLabel>STATS</SectionLabel>
                {statDefinitions.length === 0 ? (
                    <CyberText sx={{ ...TXT_MUTED, fontSize: "0.85rem" }}>
                        No hay definiciones de stats en esta campaña.
                    </CyberText>
                ) : (
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                            gap: 1.25,
                            p: 1.5,
                            bgcolor: UI_COLORS.backgroundSecondary,
                            border: `1px solid ${UI_COLORS.border}`,
                            borderRadius: 1,
                        }}
                    >
                        {statDefinitions.map((stat) => (
                            <StatBarRow
                                key={stat.key}
                                label={stat.label || stat.key}
                                value={stats[stat.key] ?? 0}
                                maxStat={maxStat}
                            />
                        ))}
                    </Box>
                )}

                <Box sx={{ mt: 1, display: "flex", alignItems: "center", gap: 0.5 }}>
                    <CyberTooltip title={radarOpen ? "Ocultar radar" : "Mostrar radar"}>
                        <IconButton
                            size="small"
                            onClick={() => setRadarOpen((v) => !v)}
                            sx={{ color: radarOpen ? UI_COLORS.anomaly : UI_COLORS.textSecondary }}
                        >
                            {radarOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                        </IconButton>
                    </CyberTooltip>
                    <CyberText
                        onClick={() => setRadarOpen((v) => !v)}
                        sx={{
                            fontSize: "0.62rem",
                            letterSpacing: "0.1em",
                            color: radarOpen ? UI_COLORS.anomaly : UI_COLORS.textSecondary,
                            cursor: "pointer",
                            userSelect: "none",
                        }}
                    >
                        RADAR
                    </CyberText>
                </Box>
                <Collapse in={radarOpen}>
                    <Box sx={{ display: "flex", justifyContent: "center", py: 1.5 }}>
                        <StatRadarChart
                            statDefinitions={statDefinitions}
                            stats={stats}
                            maxStat={maxStat}
                        />
                    </Box>
                </Collapse>
            </Box>

            <Box sx={{ mb: 2.5 }}>
                <SectionLabel>BIO</SectionLabel>
                <Box
                    sx={{
                        border: `1px solid ${UI_COLORS.border}`,
                        borderRadius: 1,
                        bgcolor: UI_COLORS.backgroundSecondary,
                        overflow: "hidden",
                    }}
                >
                    <CharBioTab character={character} wikiEntities={wikiEntities} />
                </Box>
            </Box>

            <Box>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 1.25 }}>
                    <CyberTitle sx={{ fontSize: "0.58rem", letterSpacing: "0.14em", color: UI_COLORS.anomaly }}>
                        BOND
                    </CyberTitle>
                    <Box sx={{ flex: 1, height: "1px", bgcolor: UI_COLORS.border }} />
                </Box>
                <Box
                    sx={{
                        border: `1px solid ${UI_COLORS.border}`,
                        borderRadius: 1,
                        bgcolor: UI_COLORS.backgroundSecondary,
                        overflow: "hidden",
                    }}
                >
                    <CharBondTab character={character} />
                </Box>
            </Box>
        </Box>
    );
}
