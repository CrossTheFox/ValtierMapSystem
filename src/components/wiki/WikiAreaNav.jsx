import { Box, IconButton } from "@mui/material";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import TimelineIcon from "@mui/icons-material/Timeline";
import HubIcon from "@mui/icons-material/Hub";
import SettingsIcon from "@mui/icons-material/Settings";
import LibraryBooksIcon from "@mui/icons-material/LibraryBooks";
import { CyberText } from "../customs/CustomTexts";
import CyberTooltip from "../customs/CyberTooltip";
import { UI_COLORS } from "../../constants/uiColors";
import {
    WIKI_ARCHIVE_AREAS,
    WIKI_AREA_IDS,
    getWikiArea,
    normalizeWikiAreaFilter,
} from "../../constants/wiki";

const AREA_VISUALS = {
    [WIKI_AREA_IDS.CODEX]: {
        Icon: MenuBookIcon,
        color: UI_COLORS.accent,
    },
    [WIKI_AREA_IDS.TIMELINE]: {
        Icon: TimelineIcon,
        color: "#00e5ff",
    },
    [WIKI_AREA_IDS.NEURAL_LAB]: {
        Icon: HubIcon,
        color: UI_COLORS.anomaly,
    },
};

function tooltipTitle(label, hint) {
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25, textAlign: "left" }}>
            <Box component="span">{label}</Box>
            {hint && (
                <Box
                    component="span"
                    sx={{
                        fontSize: "0.55rem",
                        letterSpacing: "0.04em",
                        textTransform: "none",
                        color: UI_COLORS.textSecondary,
                        fontFamily: "'Fira Sans', sans-serif",
                        lineHeight: 1.3,
                    }}
                >
                    {hint}
                </Box>
            )}
        </Box>
    );
}

/**
 * Icon-only segmented navigation for archive surfaces (CODEX / TIMELINE / NEURAL_LAB).
 */
export default function WikiAreaNav({
    areaFilter,
    onAreaFilterChange,
    showGlossaryButton = true,
    onOpenGlossary,
    showConfigButton = false,
    onOpenConfig,
    compact = false,
}) {
    const activeId = normalizeWikiAreaFilter(areaFilter);
    const activeArea = getWikiArea(activeId);
    const btnSize = compact ? 28 : 32;

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: compact ? 0 : 0.75, minWidth: 0 }}>
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    borderBottom: compact ? "none" : `1px solid ${UI_COLORS.border}`,
                    gap: compact ? 0.35 : 0,
                    flexShrink: 0,
                }}
            >
                {WIKI_ARCHIVE_AREAS.map(({ id, label }) => {
                    const area = getWikiArea(id);
                    const { Icon, color } = AREA_VISUALS[id] ?? AREA_VISUALS[WIKI_AREA_IDS.CODEX];
                    const active = activeId === id;

                    return (
                        <CyberTooltip key={id} title={tooltipTitle(label, area?.hint)} placement="bottom">
                            <Box
                                component="button"
                                type="button"
                                onClick={() => onAreaFilterChange(id)}
                                aria-label={label}
                                aria-current={active ? "page" : undefined}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: btnSize,
                                    height: btnSize,
                                    p: 0,
                                    border: `1px solid ${active ? color : UI_COLORS.border}`,
                                    borderRadius: compact ? 0.75 : 0,
                                    borderBottom: compact
                                        ? undefined
                                        : active
                                            ? `2px solid ${color}`
                                            : "2px solid transparent",
                                    bgcolor: active ? `${color}18` : "transparent",
                                    boxShadow: active ? `0 0 10px ${color}22` : "none",
                                    cursor: "pointer",
                                    transition: "background-color 0.15s, border-color 0.15s, box-shadow 0.15s",
                                    "&:hover": {
                                        bgcolor: `${color}14`,
                                        borderColor: color,
                                    },
                                }}
                            >
                                <Icon
                                    sx={{
                                        fontSize: compact ? "0.9rem" : "1rem",
                                        color: active ? color : UI_COLORS.textSecondary,
                                    }}
                                />
                            </Box>
                        </CyberTooltip>
                    );
                })}
                {showGlossaryButton && onOpenGlossary && (
                    <CyberTooltip title="Glosario del sistema — conceptos, campos e IA" placement="bottom">
                        <IconButton
                            size="small"
                            onClick={onOpenGlossary}
                            aria-label="Glosario del sistema"
                            sx={{
                                width: btnSize,
                                height: btnSize,
                                ml: compact ? 0.35 : undefined,
                                borderRadius: compact ? 0.75 : 0,
                                color: UI_COLORS.textSecondary,
                                border: `1px solid ${UI_COLORS.border}`,
                                transition: "color 0.15s, background-color 0.15s, border-color 0.15s",
                                "&:hover": {
                                    color: UI_COLORS.accent,
                                    bgcolor: `${UI_COLORS.accent}10`,
                                    borderColor: `${UI_COLORS.accent}66`,
                                },
                            }}
                        >
                            <LibraryBooksIcon sx={{ fontSize: compact ? "0.9rem" : "1.05rem" }} />
                        </IconButton>
                    </CyberTooltip>
                )}
                {showConfigButton && (
                    <CyberTooltip title="Configuración de IA narrativa" placement="bottom">
                        <IconButton
                            size="small"
                            onClick={onOpenConfig}
                            aria-label="Configuración de IA"
                            sx={{
                                width: btnSize,
                                height: btnSize,
                                ml: compact ? 0.35 : undefined,
                                borderRadius: compact ? 0.75 : 0,
                                color: UI_COLORS.textSecondary,
                                border: `1px solid ${UI_COLORS.border}`,
                                borderLeft: compact ? undefined : `1px solid ${UI_COLORS.border}`,
                                transition: "color 0.15s, background-color 0.15s, border-color 0.15s",
                                "&:hover": {
                                    color: UI_COLORS.anomaly,
                                    bgcolor: `${UI_COLORS.anomaly}10`,
                                    borderColor: `${UI_COLORS.anomaly}66`,
                                },
                            }}
                        >
                            <SettingsIcon sx={{ fontSize: compact ? "0.9rem" : "1.05rem" }} />
                        </IconButton>
                    </CyberTooltip>
                )}
            </Box>
            {!compact && (
                <CyberText
                    sx={{
                        fontSize: "0.68rem",
                        color: UI_COLORS.textSecondary,
                        lineHeight: 1.4,
                        px: 0.5,
                    }}
                >
                    {activeArea.hint}
                </CyberText>
            )}
        </Box>
    );
}
