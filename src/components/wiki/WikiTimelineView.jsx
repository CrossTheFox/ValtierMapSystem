import { useMemo, useState } from "react";
import { Box, Chip, IconButton, MenuItem, Select, Tooltip, FormControlLabel, Switch } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import HubIcon from "@mui/icons-material/Hub";
import TodayIcon from "@mui/icons-material/Today";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import { CyberTitle, CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import {
    buildTimelineRows,
    buildTimelineDisplayItems,
    buildCausalEdgeMap,
    formatTimelineDateLabel,
    getTimelineMeta,
    hasTimelineCoreEvent,
    TIMELINE_BRANCH,
    TIMELINE_CALENDAR,
} from "../../utils/wikiTimeline";
import {
    buildEventLinkChips,
    buildEventCausalTargets,
    buildTimelineFilterOptions,
    getTimelineFilterMatchIds,
} from "../../utils/wikiTimelineLinks";
import { resolveCampaignNarrativeDate } from "../../constants/wiki/campaignNarrativeDefaults";
import WikiCampaignNarrativeDateControl from "./WikiCampaignNarrativeDateControl";
import {
    EVENT_CERTAINTY,
    EVENT_KIND_LABELS,
} from "../../constants/wiki/entityFieldSchemas";
import WikiTimelineLinkChips from "./WikiTimelineLinkChips";

const BRANCH_COLUMNS = {
    [TIMELINE_BRANCH.LEFT]: 0,
    [TIMELINE_BRANCH.CENTER]: 1,
    [TIMELINE_BRANCH.RIGHT]: 2,
};

const CERTAINTY_STYLES = {
    [EVENT_CERTAINTY.CANON]: { borderStyle: "solid", opacity: 1 },
    [EVENT_CERTAINTY.LEGENDARIO]: { borderStyle: "dashed", opacity: 0.9 },
    [EVENT_CERTAINTY.DISPUTADO]: { borderStyle: "dotted", opacity: 0.85 },
};

const FILTER_LENSES = [
    { id: "all", label: "Todos" },
    { id: "locacion", label: "Ciudad" },
    { id: "personaje", label: "Personaje" },
    { id: "tema", label: "Tema" },
    { id: "arco", label: "Arco" },
];

/**
 * Línea temporal vertical: chips de vínculos, filtros por lente, compresión de huecos,
 * estilo por certeza, flechas causales y marcador de fecha presente de campaña.
 */
export default function WikiTimelineView({
    entities = [],
    allEntities = [],
    relations = [],
    campaignId = null,
    uid = null,
    narrativeSettings = null,
    selectedId = null,
    readOnly = false,
    onSelect,
    onEntityClick,
    onCreateCore,
    onBranch,
}) {
    const [filterLens, setFilterLens] = useState("all");
    const [filterTargetId, setFilterTargetId] = useState("");
    const [compressGaps, setCompressGaps] = useState(true);

    const narrativeConfig = useMemo(
        () => resolveCampaignNarrativeDate(campaignId, narrativeSettings),
        [campaignId, narrativeSettings]
    );
    const entityPool = allEntities.length ? allEntities : entities;

    const rows = useMemo(() => buildTimelineRows(entities), [entities]);
    const displayItems = useMemo(
        () => buildTimelineDisplayItems(rows, { compress: compressGaps }),
        [rows, compressGaps]
    );
    const causalMap = useMemo(() => buildCausalEdgeMap(relations), [relations]);
    const filterOptions = useMemo(
        () => buildTimelineFilterOptions(entities, relations, entityPool),
        [entities, relations, entityPool]
    );
    const matchIds = useMemo(
        () =>
            getTimelineFilterMatchIds(entities, relations, {
                lens: filterLens,
                targetId: filterTargetId || null,
            }),
        [entities, relations, filterLens, filterTargetId]
    );
    const hasCore = useMemo(() => hasTimelineCoreEvent(entities), [entities]);

    const presentLabel = narrativeConfig
        ? formatTimelineDateLabel(
              narrativeConfig.narrativeDate,
              narrativeConfig.calendar || TIMELINE_CALENDAR.DZ
          )
        : null;

    const handleLensChange = (lens) => {
        setFilterLens(lens);
        setFilterTargetId("");
    };

    if (!hasCore && rows.length === 0) {
        return (
            <Box
                sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    p: 4,
                    textAlign: "center",
                }}
            >
                <HubIcon sx={{ fontSize: "2.5rem", color: UI_COLORS.anomaly, mb: 2, opacity: 0.85 }} />
                <CyberTitle sx={{ color: UI_COLORS.accent, fontSize: "1rem", letterSpacing: 2, mb: 1 }}>
                    LÍNEA_TEMPORAL
                </CyberTitle>
                <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "0.85rem", maxWidth: 420, lineHeight: 1.6, mb: 3 }}>
                    Comienza con un <strong style={{ color: UI_COLORS.anomaly }}>evento núcleo</strong>: el punto de
                    partida de la historia. Los eventos se ordenan de más antiguo (arriba) a más reciente (abajo).
                </CyberText>
                {!readOnly && (
                    <Box component="button" onClick={onCreateCore} sx={createCoreBtnSx}>
                        <AddIcon sx={{ fontSize: "1rem" }} />
                        Crear evento núcleo
                    </Box>
                )}
            </Box>
        );
    }

    return (
        <Box sx={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
            <TimelineToolbar
                filterLens={filterLens}
                filterTargetId={filterTargetId}
                filterOptions={filterOptions}
                compressGaps={compressGaps}
                presentLabel={presentLabel}
                readOnly={readOnly}
                campaignId={campaignId}
                uid={uid}
                narrativeDate={narrativeConfig?.narrativeDate}
                narrativeCalendar={narrativeConfig?.calendar}
                onLensChange={handleLensChange}
                onTargetChange={setFilterTargetId}
                onCompressChange={setCompressGaps}
            />

            <Box
                sx={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    overflowX: "hidden",
                    px: { xs: 1.5, sm: 3 },
                    py: 2,
                    boxSizing: "border-box",
                    ...scrollbarSx,
                }}
            >
                <Box sx={{ maxWidth: 760, mx: "auto", position: "relative", pb: 6 }}>
                    <Box
                        sx={{
                            position: "absolute",
                            left: "50%",
                            top: 24,
                            bottom: presentLabel ? 120 : 48,
                            width: 2,
                            transform: "translateX(-50%)",
                            background: `linear-gradient(180deg, ${UI_COLORS.anomaly}88 0%, ${UI_COLORS.accent}55 50%, ${UI_COLORS.accent}22 100%)`,
                            boxShadow: `0 0 12px ${UI_COLORS.accentGlow}`,
                            borderRadius: 1,
                            zIndex: 0,
                        }}
                    />

                    <CyberText sx={{ ...stickyLabelSx, mb: 2 }}>↑ MÁS ANTIGUO</CyberText>

                    {displayItems.map((item, itemIndex) => {
                        if (item.type === "gap") {
                            return <TimelineGapBand key={`gap-${itemIndex}`} label={item.label} />;
                        }
                        return (
                            <TimelineRow
                                key={`${item.row.dateKey}-${itemIndex}`}
                                row={item.row}
                                selectedId={selectedId}
                                readOnly={readOnly}
                                isFirst={itemIndex === 0}
                                isLast={itemIndex === displayItems.length - 1}
                                matchIds={matchIds}
                                filterActive={filterLens !== "all" && !!filterTargetId}
                                relations={relations}
                                entityPool={entityPool}
                                causalMap={causalMap}
                                onSelect={onSelect}
                                onEntityClick={onEntityClick}
                                onBranch={onBranch}
                            />
                        );
                    })}

                    {presentLabel && <TimelinePresentMarker label={presentLabel} />}

                    <CyberText sx={{ textAlign: "center", fontSize: "0.6rem", letterSpacing: 3, color: UI_COLORS.textSecondary, mt: 2 }}>
                        ↓ MÁS RECIENTE
                    </CyberText>

                    {!readOnly && (
                        <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
                            <Tooltip title="Añadir evento en una fecha nueva (más reciente)">
                                <Box
                                    component="button"
                                    onClick={() => onBranch?.({ direction: "down", anchorEntity: null })}
                                    sx={addRowButtonSx}
                                >
                                    <AddIcon sx={{ fontSize: "0.95rem" }} />
                                    <CyberText sx={{ fontSize: "0.72rem", letterSpacing: 1 }}>Nuevo evento</CyberText>
                                </Box>
                            </Tooltip>
                        </Box>
                    )}
                </Box>
            </Box>
        </Box>
    );
}

function TimelineToolbar({
    filterLens,
    filterTargetId,
    filterOptions,
    compressGaps,
    presentLabel,
    readOnly,
    campaignId,
    uid,
    narrativeDate,
    narrativeCalendar,
    onLensChange,
    onTargetChange,
    onCompressChange,
}) {
    const targetOptions =
        filterLens === "locacion"
            ? filterOptions.locaciones
            : filterLens === "personaje"
                ? filterOptions.personajes
                : filterLens === "tema"
                    ? filterOptions.eventKinds
                    : filterLens === "arco"
                        ? filterOptions.narrativeArcs
                        : [];

    return (
        <Box
            sx={{
                flexShrink: 0,
                px: { xs: 1.5, sm: 2 },
                py: 1,
                borderBottom: `1px solid ${UI_COLORS.border}`,
                bgcolor: `${UI_COLORS.backgroundSecondary}cc`,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 1,
            }}
        >
            <FilterAltIcon sx={{ fontSize: "1rem", color: UI_COLORS.textSecondary }} />
            {FILTER_LENSES.map((l) => (
                <Chip
                    key={l.id}
                    size="small"
                    label={<CyberText sx={{ fontSize: "0.62rem" }}>{l.label}</CyberText>}
                    onClick={() => onLensChange(l.id)}
                    sx={{
                        height: 22,
                        bgcolor: filterLens === l.id ? `${UI_COLORS.accent}22` : "transparent",
                        border: `1px solid ${filterLens === l.id ? UI_COLORS.accent : UI_COLORS.border}`,
                        color: filterLens === l.id ? UI_COLORS.accent : UI_COLORS.textSecondary,
                        cursor: "pointer",
                    }}
                />
            ))}

            {filterLens !== "all" && targetOptions.length > 0 && (
                <Select
                    size="small"
                    displayEmpty
                    value={filterTargetId}
                    onChange={(e) => onTargetChange(e.target.value)}
                    sx={{
                        minWidth: 140,
                        maxWidth: 200,
                        height: 28,
                        fontSize: "0.72rem",
                        color: UI_COLORS.textPrimary,
                        "& .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.border },
                    }}
                >
                    <MenuItem value="">
                        <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.textSecondary }}>
                            Elegir…
                        </CyberText>
                    </MenuItem>
                    {targetOptions.map((opt) => (
                        <MenuItem key={opt.id} value={opt.id}>
                            <CyberText sx={{ fontSize: "0.72rem" }}>{opt.title}</CyberText>
                        </MenuItem>
                    ))}
                </Select>
            )}

            <Box sx={{ flex: 1 }} />

            {presentLabel && (
                readOnly ? (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <TodayIcon sx={{ fontSize: "0.9rem", color: UI_COLORS.anomaly }} />
                        <CyberText sx={{ fontSize: "0.65rem", color: UI_COLORS.anomaly, letterSpacing: 0.5 }}>
                            Ahora: {presentLabel}
                        </CyberText>
                    </Box>
                ) : (
                    <WikiCampaignNarrativeDateControl
                        campaignId={campaignId}
                        uid={uid}
                        narrativeDate={narrativeDate}
                        calendar={narrativeCalendar}
                        presentLabel={presentLabel}
                    />
                )
            )}

            <FormControlLabel
                control={
                    <Switch
                        size="small"
                        checked={compressGaps}
                        onChange={(e) => onCompressChange(e.target.checked)}
                        sx={{
                            "& .MuiSwitch-switchBase.Mui-checked": { color: UI_COLORS.accent },
                            "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                                bgcolor: `${UI_COLORS.accent}88`,
                            },
                        }}
                    />
                }
                label={<CyberText sx={{ fontSize: "0.62rem", color: UI_COLORS.textSecondary }}>Escala narrativa</CyberText>}
                sx={{ m: 0, ml: 0.5 }}
            />
        </Box>
    );
}

function TimelineGapBand({ label }) {
    return (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", my: 2, position: "relative", zIndex: 1 }}>
            <Box
                sx={{
                    px: 2,
                    py: 0.5,
                    borderTop: `1px dashed ${UI_COLORS.accent}44`,
                    borderBottom: `1px dashed ${UI_COLORS.accent}44`,
                    bgcolor: `${UI_COLORS.backgroundPrimary}dd`,
                }}
            >
                <CyberText sx={{ fontSize: "0.62rem", color: UI_COLORS.textSecondary, letterSpacing: 1, fontStyle: "italic" }}>
                    ⋯ {label} ⋯
                </CyberText>
            </Box>
        </Box>
    );
}

function TimelinePresentMarker({ label }) {
    return (
        <Box sx={{ position: "relative", my: 3, zIndex: 2 }}>
            <Box
                sx={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: "72%",
                    height: 2,
                    transform: "translate(-50%, -50%)",
                    background: `repeating-linear-gradient(90deg, ${UI_COLORS.anomaly} 0 6px, transparent 6px 12px)`,
                    opacity: 0.7,
                }}
            />
            <Box sx={{ display: "flex", justifyContent: "center" }}>
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.75,
                        px: 2,
                        py: 0.6,
                        bgcolor: `${UI_COLORS.anomaly}22`,
                        border: `2px solid ${UI_COLORS.anomaly}`,
                        borderRadius: 2,
                        boxShadow: `0 0 20px ${UI_COLORS.anomaly}44`,
                    }}
                >
                    <TodayIcon sx={{ fontSize: "1rem", color: UI_COLORS.anomaly }} />
                    <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.anomaly, fontWeight: 700, letterSpacing: 1 }}>
                        PRESENTE — {label}
                    </CyberText>
                </Box>
            </Box>
        </Box>
    );
}

function TimelineRow({
    row,
    selectedId,
    readOnly,
    isFirst,
    isLast,
    matchIds,
    filterActive,
    relations,
    entityPool,
    causalMap,
    onSelect,
    onEntityClick,
    onBranch,
}) {
    const grid = [[], [], []];
    for (const node of row.nodes) {
        const col = BRANCH_COLUMNS[node.meta.branch] ?? 1;
        grid[col].push(node);
    }

    return (
        <Box sx={{ position: "relative", mb: isLast ? 0 : 3, zIndex: 1 }}>
            <Box sx={{ display: "flex", justifyContent: "center", mb: 1.5, position: "relative" }}>
                <Box
                    sx={{
                        px: 1.5,
                        py: 0.35,
                        bgcolor: UI_COLORS.backgroundPrimary,
                        border: `1px solid ${UI_COLORS.accent}55`,
                        borderRadius: 10,
                        boxShadow: `0 0 10px ${UI_COLORS.accentGlow}`,
                        zIndex: 2,
                    }}
                >
                    <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.accent, letterSpacing: 1 }}>
                        {row.dateLabel}
                    </CyberText>
                </Box>
            </Box>

            {!isFirst && (
                <Box
                    sx={{
                        position: "absolute",
                        left: "50%",
                        top: -20,
                        width: 2,
                        height: 20,
                        transform: "translateX(-50%)",
                        bgcolor: `${UI_COLORS.accent}44`,
                    }}
                />
            )}

            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1.5, alignItems: "start" }}>
                {[0, 1, 2].map((colIndex) => (
                    <Box
                        key={colIndex}
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: colIndex === 0 ? "flex-end" : colIndex === 2 ? "flex-start" : "center",
                            gap: 1,
                        }}
                    >
                        {grid[colIndex].map((node) => (
                            <TimelineNodeCard
                                key={node.entity.id}
                                node={node}
                                selected={selectedId === node.entity.id}
                                dimmed={filterActive && !matchIds.has(node.entity.id)}
                                readOnly={readOnly}
                                linkChips={buildEventLinkChips(node.entity.id, relations, entityPool)}
                                causalTargets={buildEventCausalTargets(node.entity.id, relations, entityPool)}
                                hasOutgoingCausal={(causalMap.get(node.entity.id) || []).length > 0}
                                onSelect={() => onSelect?.(node.entity)}
                                onEntityClick={onEntityClick}
                                onBranch={(direction) => onBranch?.({ direction, anchorEntity: node.entity })}
                            />
                        ))}
                    </Box>
                ))}
            </Box>

            {row.nodes.length > 1 && (
                <Box
                    sx={{
                        position: "absolute",
                        top: 52,
                        left: "18%",
                        right: "18%",
                        height: 2,
                        bgcolor: `${UI_COLORS.anomaly}33`,
                        zIndex: 0,
                        pointerEvents: "none",
                    }}
                />
            )}
        </Box>
    );
}

function TimelineNodeCard({
    node,
    selected,
    dimmed,
    readOnly,
    linkChips,
    causalTargets,
    hasOutgoingCausal,
    onSelect,
    onEntityClick,
    onBranch,
}) {
    const { entity, meta } = node;
    const isCore = meta.isCore;
    const branch = meta.branch;
    const certainty = meta.certainty || EVENT_CERTAINTY.CANON;
    const certStyle = CERTAINTY_STYLES[certainty] || CERTAINTY_STYLES[EVENT_CERTAINTY.CANON];
    const dateLabel = formatTimelineDateLabel(meta.date, meta.calendar);
    const kindLabel = EVENT_KIND_LABELS[meta.eventKind];

    const accent = isCore ? UI_COLORS.anomaly : UI_COLORS.accent;

    return (
        <Box
            onClick={onSelect}
            sx={{
                position: "relative",
                width: "100%",
                maxWidth: branch === TIMELINE_BRANCH.CENTER ? 240 : 210,
                p: 1.25,
                cursor: "pointer",
                opacity: dimmed ? 0.28 : certStyle.opacity,
                bgcolor: selected ? `${accent}18` : UI_COLORS.backgroundPrimary,
                border: `1px ${certStyle.borderStyle} ${selected ? accent : `${accent}44`}`,
                borderRadius: 1.5,
                boxShadow: selected ? `0 0 18px ${accent}44` : hasOutgoingCausal ? `0 0 8px ${UI_COLORS.anomaly}22` : "none",
                transition: "border-color 0.2s, box-shadow 0.2s, background-color 0.2s, opacity 0.2s",
                "&:hover": {
                    borderColor: accent,
                    boxShadow: `0 0 14px ${accent}33`,
                    opacity: dimmed ? 0.45 : 1,
                },
            }}
        >
            {isCore && (
                <Box sx={{ position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)", px: 0.75, py: 0.15, bgcolor: UI_COLORS.anomaly, borderRadius: 0.5 }}>
                    <CyberText sx={{ fontSize: "0.55rem", color: UI_COLORS.backgroundPrimary, letterSpacing: 1, fontWeight: 700 }}>
                        NÚCLEO
                    </CyberText>
                </Box>
            )}

            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.35, mb: 0.25 }}>
                {meta.narrativeArc && (
                    <CyberText sx={{ fontSize: "0.52rem", color: UI_COLORS.anomaly, letterSpacing: 0.5 }}>
                        ◆ {meta.narrativeArc.toUpperCase()}
                    </CyberText>
                )}
                {kindLabel && meta.eventKind !== "otro" && (
                    <CyberText sx={{ fontSize: "0.52rem", color: UI_COLORS.textSecondary, letterSpacing: 0.5 }}>
                        {kindLabel.toUpperCase()}
                        {certainty === EVENT_CERTAINTY.LEGENDARIO ? " · LEYENDA" : certainty === EVENT_CERTAINTY.DISPUTADO ? " · DISPUTADO" : ""}
                    </CyberText>
                )}
            </Box>

            <CyberText sx={{ fontSize: "0.8rem", color: accent, fontWeight: 600, lineHeight: 1.3, mb: 0.35, mt: isCore ? 0.5 : 0 }}>
                {entity.title || "Sin título"}
            </CyberText>
            <CyberText sx={{ fontSize: "0.65rem", color: UI_COLORS.textSecondary }}>{dateLabel}</CyberText>

            {entity.summary && (
                <CyberText
                    sx={{
                        fontSize: "0.68rem",
                        color: UI_COLORS.textPrimary,
                        mt: 0.5,
                        lineHeight: 1.4,
                        opacity: 0.85,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                    }}
                >
                    {entity.summary.replace(/@\[([^\]]+)\]\([^)]+\)/g, "$1")}
                </CyberText>
            )}

            <WikiTimelineLinkChips chips={linkChips} onChipClick={onEntityClick} />

            {causalTargets.length > 0 && (
                <Box sx={{ mt: 0.5 }} onClick={(e) => e.stopPropagation()}>
                    {causalTargets.map((t) => (
                        <CyberText
                            key={t.targetId}
                            component="span"
                            onClick={() => onEntityClick?.(t.targetId)}
                            sx={{
                                display: "block",
                                fontSize: "0.58rem",
                                color: UI_COLORS.anomaly,
                                cursor: onEntityClick ? "pointer" : "default",
                                "&:hover": onEntityClick ? { textDecoration: "underline" } : {},
                            }}
                        >
                            ↳ desencadenó {t.title}
                        </CyberText>
                    ))}
                </Box>
            )}

            {!readOnly && (
                <Box
                    sx={{ display: "flex", justifyContent: "center", gap: 0.25, mt: 1, pt: 0.75, borderTop: `1px solid ${UI_COLORS.border}` }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <Tooltip title="Evento paralelo (izquierda)">
                        <IconButton size="small" onClick={() => onBranch("left")} sx={branchBtnSx}>
                            <ArrowBackIcon sx={{ fontSize: "0.85rem" }} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Evento posterior (abajo)">
                        <IconButton size="small" onClick={() => onBranch("down")} sx={branchBtnSx}>
                            <ArrowDownwardIcon sx={{ fontSize: "0.85rem" }} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Evento paralelo (derecha)">
                        <IconButton size="small" onClick={() => onBranch("right")} sx={branchBtnSx}>
                            <ArrowForwardIcon sx={{ fontSize: "0.85rem" }} />
                        </IconButton>
                    </Tooltip>
                </Box>
            )}
        </Box>
    );
}

const createCoreBtnSx = {
    display: "flex",
    alignItems: "center",
    gap: 1,
    px: 2.5,
    py: 1.25,
    bgcolor: `${UI_COLORS.anomaly}18`,
    border: `1px solid ${UI_COLORS.anomaly}`,
    borderRadius: 1,
    color: UI_COLORS.anomaly,
    cursor: "pointer",
    fontFamily: "'Fira Sans', sans-serif",
    fontSize: "0.82rem",
    letterSpacing: 1,
    boxShadow: `0 0 16px ${UI_COLORS.anomaly}33`,
    "&:hover": { bgcolor: `${UI_COLORS.anomaly}28` },
};

const branchBtnSx = {
    color: UI_COLORS.textSecondary,
    p: 0.35,
    "&:hover": { color: UI_COLORS.accent, bgcolor: `${UI_COLORS.accent}15` },
};

const addRowButtonSx = {
    display: "flex",
    alignItems: "center",
    gap: 0.75,
    px: 2,
    py: 0.85,
    bgcolor: `${UI_COLORS.accent}12`,
    border: `1px dashed ${UI_COLORS.accent}66`,
    borderRadius: 1,
    color: UI_COLORS.accent,
    cursor: "pointer",
    "&:hover": { bgcolor: `${UI_COLORS.accent}22`, borderStyle: "solid" },
};

const stickyLabelSx = {
    position: "sticky",
    top: 0,
    zIndex: 2,
    textAlign: "center",
    fontSize: "0.6rem",
    letterSpacing: 3,
    color: UI_COLORS.textSecondary,
    py: 0.5,
    bgcolor: `${UI_COLORS.backgroundSecondary}ee`,
};

const scrollbarSx = {
    "&::-webkit-scrollbar": { width: "6px" },
    "&::-webkit-scrollbar-thumb": { backgroundColor: `${UI_COLORS.accent}55`, borderRadius: "3px" },
};
