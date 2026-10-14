import { Box, IconButton } from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import LibraryBooksIcon from "@mui/icons-material/LibraryBooks";
import CyberTooltip from "../customs/CyberTooltip";
import { UI_COLORS } from "../../constants/uiColors";
import { TYPO } from "../../constants/designSystem";
import { ARCHIVE_BORDER, ARCHIVE_BORDER_2 } from "../../constants/archiveChrome";
import {
    WIKI_ARCHIVE_AREAS,
    WIKI_AREA_IDS,
    normalizeWikiAreaFilter,
} from "../../constants/wiki";

const tabSx = (active) => ({
    height: "100%",
    display: "inline-flex",
    alignItems: "center",
    px: "14px",
    border: "none",
    borderBottom: `2px solid ${active ? UI_COLORS.accentStrong : "transparent"}`,
    background: "transparent",
    color: active ? UI_COLORS.textPrimary : UI_COLORS.textSecondary,
    fontFamily: TYPO.title,
    fontSize: "9.5px",
    letterSpacing: ".16em",
    whiteSpace: "nowrap",
    cursor: "pointer",
    "&:hover": { color: UI_COLORS.textPrimary },
    "&:focus-visible": { outline: `2px solid ${UI_COLORS.anomaly}`, outlineOffset: "1px" },
});

const toolBtnSx = {
    width: 24,
    height: 24,
    ml: "4px",
    borderRadius: "4px",
    color: UI_COLORS.textSecondary,
    border: `1px solid ${ARCHIVE_BORDER}`,
    "&:hover": { color: UI_COLORS.textPrimary, borderColor: ARCHIVE_BORDER_2, bgcolor: "rgba(255, 255, 255, .04)" },
    "&:focus-visible": { outline: `2px solid ${UI_COLORS.anomaly}`, outlineOffset: "1px" },
};

/**
 * Archive tabs (mock `.tabs`): CODEX / TIMELINE / DIARIO / NEURAL LAB.
 * With `onOpenNeuralLab`, the NEURAL LAB tab opens the Lab surface instead of switching area.
 */
export default function WikiAreaNav({
    areaFilter,
    onAreaFilterChange,
    onOpenNeuralLab,
    hiddenAreaIds = [],
    showGlossaryButton = true,
    onOpenGlossary,
    showConfigButton = false,
    onOpenConfig,
}) {
    const activeId = normalizeWikiAreaFilter(areaFilter);
    const labIsArea = !onOpenNeuralLab;
    const currentId = areaFilter === WIKI_AREA_IDS.NEURAL_LAB && labIsArea ? WIKI_AREA_IDS.NEURAL_LAB : activeId;
    const areas = WIKI_ARCHIVE_AREAS.filter((a) => !hiddenAreaIds.includes(a.id));

    return (
        <Box sx={{ display: "flex", alignItems: "center", height: "100%", minWidth: 0 }}>
            <Box component="nav" aria-label="Áreas del archivo" sx={{ display: "flex", gap: "2px", height: "100%" }}>
                {areas.map(({ id, label }) => {
                    const isLabDoor = id === WIKI_AREA_IDS.NEURAL_LAB && !labIsArea;
                    const active = !isLabDoor && currentId === id;
                    return (
                        <Box
                            key={id}
                            component="button"
                            type="button"
                            onClick={() => (isLabDoor ? onOpenNeuralLab() : onAreaFilterChange(id))}
                            aria-current={active ? "page" : undefined}
                            sx={tabSx(active)}
                        >
                            {label}
                        </Box>
                    );
                })}
            </Box>
            {showGlossaryButton && onOpenGlossary && (
                <CyberTooltip title="Glosario del sistema — conceptos, campos e IA" placement="bottom">
                    <IconButton size="small" onClick={onOpenGlossary} aria-label="Glosario del sistema" sx={{ ...toolBtnSx, ml: "8px" }}>
                        <LibraryBooksIcon sx={{ fontSize: "0.85rem" }} />
                    </IconButton>
                </CyberTooltip>
            )}
            {showConfigButton && onOpenConfig && (
                <CyberTooltip title="Configuración de IA narrativa" placement="bottom">
                    <IconButton size="small" onClick={onOpenConfig} aria-label="Configuración de IA" sx={toolBtnSx}>
                        <SettingsIcon sx={{ fontSize: "0.85rem" }} />
                    </IconButton>
                </CyberTooltip>
            )}
        </Box>
    );
}
