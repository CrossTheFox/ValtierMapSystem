import { useEffect, useCallback, useState, useRef, useMemo } from "react";
import { Box, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import RemoveIcon from "@mui/icons-material/Remove";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import HubIcon from "@mui/icons-material/Hub";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useDispatch, useSelector } from "react-redux";
import { CyberTitle, CyberText } from "../customs/CustomTexts";
import CyberTooltip from "../customs/CyberTooltip";
import { UI_COLORS } from "../../constants/uiColors";
import { ROLES } from "../../constants/roles";
import {
    fetchWikiEntities,
    fetchWikiRelations,
    fetchEntityRelations,
    removeWikiEntity,
    resetWiki,
    startWikiSync,
} from "../../store/wikiSlice";
import {
    closeWikiOverlay,
    setWikiOverlayMode,
    setWikiOverlayEntity,
    setWikiOverlayAreaFilter,
    setWikiOverlayMinimized,
    openWikiOverlay,
    openLocation,
    setIsMinimized,
    showSnackbar,
} from "../../store/uiSlice";
import WikiSearchBar from "./WikiSearchBar";
import WikiAreaNav from "./WikiAreaNav";
import WikiEntityAutocomplete from "./WikiEntityAutocomplete";
import WikiEntityList from "./WikiEntityList";
import WikiEntityDetail from "./WikiEntityDetail";
import WikiEntityEditor from "./WikiEntityEditor";
import WikiRelationPanel from "./WikiRelationPanel";
import WikiTimelineView from "./WikiTimelineView";
import WikiAiLabPanel from "./WikiAiLabPanel";
import WikiAiConfigDialog from "./WikiAiConfigDialog";
import WikiGraphCanvas from "../../pixi/wikiGraph/WikiGraphCanvas";
import { useWikiSearch } from "../../hooks/useWikiSearch";
import { WIKI_ENTITY_TYPES } from "../../constants/wikiEntityTypes";
import {
    filterEntitiesByWikiArea,
    getWikiAreaForEntityType,
    WIKI_AREA_IDS,
    WIKI_AREA_ENTITY_TYPES,
    DEFAULT_ARCHIVE_AREA,
    normalizeWikiAreaFilter,
} from "../../constants/wiki";
import { resolveMentionClick } from "../../utils/wikiNavigation";
import {
    buildTimelineCustomFields,
    buildTimelineRows,
    getTimelineMeta,
    suggestTimelineDateBelow,
    TIMELINE_BRANCH,
    TIMELINE_CALENDAR,
} from "../../utils/wikiTimeline";
import { buildGraphDataset, isGraphSelectableEntity } from "../../utils/wikiGraphEntities";
import { openArchiveTab } from "../../utils/openArchiveTab";
import { getWikiOverlayDensity } from "../../constants/wikiOverlayTokens";

/** Dialog sizing — maximize content area while keeping HUD chrome compact */
const DIALOG_PAPER_SX = {
    height: { xs: "92dvh", sm: "90dvh" },
    width: { xs: "100%", sm: "96vw", md: "min(96vw, 1400px)" },
    maxHeight: { xs: "92dvh", sm: "90dvh" },
    borderRadius: { xs: "10px 10px 0 0", sm: 2 },
};

const FULLSCREEN_PAPER_SX = {
    width: { xs: "calc(100vw - 8px)", sm: "96vw" },
    height: { xs: "calc(100dvh - 16px)", sm: "calc(100dvh - 32px)" },
    borderRadius: { xs: 1.5, sm: 2 },
};

const POPUP_PAPER_SX = {
    width: "100vw",
    height: "100dvh",
    borderRadius: 0,
};

const NEURAL_LAB_PANEL_TOGGLE_SX = {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    zIndex: 2,
    width: 22,
    height: 48,
    borderRadius: 1,
    bgcolor: `${UI_COLORS.backgroundSecondary}ee`,
    border: `1px solid ${UI_COLORS.border}`,
    color: UI_COLORS.textSecondary,
    "&:hover": { color: UI_COLORS.accent, bgcolor: `${UI_COLORS.accent}12` },
};

export default function NarrativeWikiOverlay({ popupMode = false }) {
    const dispatch = useDispatch();
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [neuralLabLeftOpen, setNeuralLabLeftOpen] = useState(false);
    const [neuralLabRightOpen, setNeuralLabRightOpen] = useState(true);
    const [aiConfigOpen, setAiConfigOpen] = useState(false);
    const [propagationState, setPropagationState] = useState(null);
    const wikiOverlay = useSelector((s) => s.ui.wikiOverlay);
    const entities = useSelector((s) => s.wiki.entities);
    const wikiStatus = useSelector((s) => s.wiki.status);
    const loadedCampaignId = useSelector((s) => s.wiki.loadedCampaignId);
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const locations = useSelector((s) => s.world.locations);
    const syncActive = useSelector((s) => s.wiki.syncActive);
    const relations = useSelector((s) => s.wiki.relations);
    const narrativeSettings = useSelector((s) => s.wiki.narrativeSettings);
    const wikiOverlayMinimized = useSelector((s) => s.ui.wikiOverlayMinimized);
    const profile = useSelector((s) => s.player.profile);
    const uid = profile?.uid;

    const readOnly = profile?.role !== ROLES.DM;

    const { open, mode, entityId, vttContext, areaFilter } = wikiOverlay;
    const effectiveAreaFilter = normalizeWikiAreaFilter(areaFilter);
    const isActive = popupMode || open;

    const selectedEntity = entities.find((e) => e.id === entityId) || null;

    const handleClose = useCallback(() => {
        if (popupMode) {
            window.close();
            // Tabs opened manually (bookmark) cannot be closed by script — return to map.
            setTimeout(() => {
                if (!window.closed) window.location.href = "/map";
            }, 150);
            return;
        }
        dispatch(closeWikiOverlay());
    }, [popupMode, dispatch]);

    const handlePopout = useCallback(() => {
        if (!campaignId) {
            dispatch(showSnackbar({
                message: "Selecciona una campaña antes de abrir el archivo en pestaña.",
                severity: "warning",
            }));
            return;
        }
        const tab = openArchiveTab({
            campaignId,
            entityId: entityId ?? undefined,
            areaFilter: areaFilter ?? undefined,
            mode: mode !== "list" ? mode : undefined,
        });
        if (!tab) {
            dispatch(showSnackbar({
                message: "No se pudo abrir la pestaña. Comprueba que el navegador no bloquee ventanas nuevas.",
                severity: "warning",
            }));
        }
    }, [campaignId, entityId, areaFilter, mode, dispatch]);

    // Clear stale data when switching campaigns
    useEffect(() => {
        if (isActive && campaignId && loadedCampaignId && loadedCampaignId !== campaignId) {
            dispatch(resetWiki());
        }
    }, [isActive, campaignId, loadedCampaignId, dispatch]);

    // Start realtime sync when overlay opens; fall back to one-shot fetch if sync already active
    useEffect(() => {
        if (!isActive || !campaignId) return;
        if (wikiStatus === "failed") {
            dispatch(resetWiki());
            return;
        }
        if (wikiStatus === "idle" && !syncActive) {
            dispatch(startWikiSync({ campaignId, role: readOnly ? "player" : "dm" }));
        } else if (wikiStatus === "idle") {
            dispatch(fetchWikiEntities({ campaignId, role: readOnly ? "player" : "dm" }));
            dispatch(fetchWikiRelations(campaignId));
        }
    }, [isActive, campaignId, wikiStatus, syncActive, readOnly, dispatch]);

    // Load relations for selected entity
    useEffect(() => {
        if (isActive && campaignId && entityId) {
            dispatch(fetchEntityRelations({ campaignId, entityId }));
        }
    }, [isActive, campaignId, entityId, dispatch]);

    // Handle VTT context: try to find existing linked entity
    useEffect(() => {
        if (!isActive || !vttContext || entities.length === 0) return;
        const { linkedVttLocationId, linkedVttCharacterId } = vttContext;

        const linked = entities.find(
            (e) =>
                (linkedVttLocationId && e.linkedVttLocationId === linkedVttLocationId) ||
                (linkedVttCharacterId && e.linkedVttCharacterId === linkedVttCharacterId)
        );
        if (linked) {
            dispatch(setWikiOverlayEntity(linked.id));
        } else if (!readOnly && mode !== "create") {
            dispatch(setWikiOverlayMode("create"));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entities.length]);

    // Esc key closes overlay / popup window
    useEffect(() => {
        if (!isActive) return;
        const handler = (e) => {
            if (e.key === "Escape") handleClose();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [isActive, handleClose]);

    // Default archive surface to CODEX when no area is set
    useEffect(() => {
        if (!isActive || areaFilter) return;
        dispatch(setWikiOverlayAreaFilter(DEFAULT_ARCHIVE_AREA));
    }, [isActive, areaFilter, dispatch]);

    // Apply area filter after Fuse, before rendering list
    const { query, setQuery, results: fuseResults, typeFilter, setTypeFilter } = useWikiSearch(entities);
    const results = filterEntitiesByWikiArea(fuseResults, effectiveAreaFilter);

    // Drop selection when switching to an area that doesn't include that entity
    useEffect(() => {
        if (!isActive || !entityId || wikiStatus === "loading") return;
        if (effectiveAreaFilter === WIKI_AREA_IDS.NEURAL_LAB) return;
        const ent = entities.find((e) => e.id === entityId);
        const allowed = WIKI_AREA_ENTITY_TYPES[effectiveAreaFilter];
        if (!ent || (allowed && !allowed.includes(ent.entityType))) {
            dispatch(setWikiOverlayEntity(null));
        }
    }, [isActive, effectiveAreaFilter, entityId, entities, wikiStatus, dispatch]);

    useEffect(() => {
        if (effectiveAreaFilter === WIKI_AREA_IDS.TIMELINE && typeFilter) {
            setTypeFilter("");
        }
    }, [effectiveAreaFilter, typeFilter, setTypeFilter]);

    useEffect(() => {
        if (effectiveAreaFilter !== WIKI_AREA_IDS.NEURAL_LAB) {
            setNeuralLabLeftOpen(false);
            setPropagationState(null);
        }
    }, [effectiveAreaFilter]);

    useEffect(() => {
        if (effectiveAreaFilter !== WIKI_AREA_IDS.NEURAL_LAB || !entityId) return;
        const ent = entities.find((e) => e.id === entityId);
        if (ent && !isGraphSelectableEntity(ent)) {
            dispatch(setWikiOverlayEntity(null));
        }
    }, [effectiveAreaFilter, entityId, entities, dispatch]);

    /**
     * Called by WikiAiLabPanel:
     *   - With no options (or opts.preview = false): starts live animation (pulse + particles).
     *   - With opts.preview = true: sets a static preview halo (no timer, no particles).
     */
    const handlePropagationStart = useCallback((waves, opts = {}) => {
        if (!waves?.length) return;
        const litNodeIds = [...new Set(waves[0]?.nodeIds ?? [])];

        if (opts?.preview) {
            setPropagationState({
                mode: "preview",
                active: false,
                currentWave: waves.length - 1,
                waves,
                litNodeIds: [],
                maxWave: waves.length - 1,
            });
        } else {
            // Live animation: Pixi ticker advances waves (no React setInterval)
            setPropagationState({ mode: "live", active: true, currentWave: 0, waves, litNodeIds });
        }
    }, []);

    const handlePropagationEnd = useCallback(() => {
        setPropagationState(null);
    }, []);

    const handleAreaFilterChange = useCallback(
        (id) => {
            dispatch(setWikiOverlayAreaFilter(id));
            if (id === WIKI_AREA_IDS.TIMELINE) {
                setTypeFilter("");
            }
        },
        [dispatch, setTypeFilter]
    );

    const syncAreaForEntity = useCallback(
        (entity) => {
            if (entity?.entityType) {
                dispatch(setWikiOverlayAreaFilter(getWikiAreaForEntityType(entity.entityType)));
            }
        },
        [dispatch]
    );

    const openVttLocation = useCallback(
        (locationId, initialTab = 0) => {
            const location = locations[locationId];
            if (!location) return;
            dispatch(openLocation({ location, initialTab }));
            dispatch(setIsMinimized(false));
        },
        [dispatch, locations]
    );

    const handleSelectEntity = useCallback(
        (entity) => {
            dispatch(setWikiOverlayEntity(entity.id));
            syncAreaForEntity(entity);
        },
        [dispatch, syncAreaForEntity]
    );

    const { graphEntities, graphRelations } = useMemo(
        () => buildGraphDataset(entities, relations),
        [entities, relations]
    );

    // NEURAL_LAB: selecting a node sets entity; panel open/closed state is preserved
    const handleSelectEntityNeuralLab = useCallback(
        (entity) => {
            if (!isGraphSelectableEntity(entity)) return;
            dispatch(setWikiOverlayEntity(entity.id));
        },
        [dispatch]
    );

    const handleOpenInNeuralLab = useCallback(
        (entity) => {
            if (!entity) return;
            dispatch(setWikiOverlayAreaFilter(WIKI_AREA_IDS.NEURAL_LAB));
            dispatch(setWikiOverlayEntity(entity.id));
            setNeuralLabLeftOpen(true);
        },
        [dispatch]
    );

    // NEURAL_LAB: explicit "go to the entity's native area page" action
    const handleGoToEntityPage = useCallback(
        (entity) => {
            syncAreaForEntity(entity);
            dispatch(setWikiOverlayMode("detail"));
        },
        [dispatch, syncAreaForEntity]
    );

    const handleNavigateToEntity = useCallback(
        (mentionId) => {
            const resolved = resolveMentionClick(mentionId, { entities, locations });
            if (!resolved) return;

            if (resolved.type === "vtt-location") {
                openVttLocation(resolved.locationId, 0);
                return;
            }

            if (resolved.type === "vtt-character") {
                openVttLocation(resolved.locationId, 1);
                return;
            }

            if (resolved.type === "wiki") {
                const ent = resolved.entity;

                if (ent.entityType === WIKI_ENTITY_TYPES.LOCACION && ent.linkedVttLocationId && locations[ent.linkedVttLocationId]) {
                    openVttLocation(ent.linkedVttLocationId, 0);
                    return;
                }

                if (ent.entityType === WIKI_ENTITY_TYPES.PERSONAJE && ent.linkedVttCharacterId) {
                    const locId = Object.values(locations).find((loc) =>
                        loc.characters?.some((c) => c.id === ent.linkedVttCharacterId)
                    )?.id;
                    if (locId) {
                        openVttLocation(locId, 1);
                        return;
                    }
                }

                dispatch(setWikiOverlayAreaFilter(getWikiAreaForEntityType(ent.entityType)));
                dispatch(setWikiOverlayEntity(ent.id));
            }
        },
        [dispatch, entities, locations, openVttLocation]
    );

    const handleCreateTimelineEvent = useCallback(
        ({ direction, anchorEntity, isCore = false }) => {
            let branch = TIMELINE_BRANCH.CENTER;
            let date = "";
            let anchorId = null;

            if (isCore) {
                branch = TIMELINE_BRANCH.CENTER;
            } else if (!anchorEntity) {
                const timelineEvents = entities.filter(
                    (e) => e.entityType === WIKI_ENTITY_TYPES.EVENTO_HISTORICO
                );
                const rows = buildTimelineRows(timelineEvents);
                const lastNode = rows[rows.length - 1]?.nodes?.[0];
                date = suggestTimelineDateBelow(lastNode ? getTimelineMeta(lastNode.entity).date : "");
            } else {
                const meta = getTimelineMeta(anchorEntity);
                anchorId = anchorEntity.id;
                date = meta.date;
                if (direction === "down") {
                    date = suggestTimelineDateBelow(meta.date);
                    branch = TIMELINE_BRANCH.CENTER;
                } else if (direction === "left") {
                    branch = TIMELINE_BRANCH.LEFT;
                } else if (direction === "right") {
                    branch = TIMELINE_BRANCH.RIGHT;
                }
            }

            dispatch(
                openWikiOverlay({
                    mode: "create",
                    entityId: null,
                    areaFilter: WIKI_AREA_IDS.TIMELINE,
                    vttContext: {
                        timelinePrefill: {
                            calendar: TIMELINE_CALENDAR.DZ,
                            date,
                            branch,
                            isCore,
                            anchorId,
                        },
                    },
                })
            );
        },
        [dispatch, entities]
    );

    const handleBackdropClick = useCallback(
        (e) => {
            if (e.target !== e.currentTarget) return;
            dispatch(setWikiOverlayMinimized(true));
            dispatch(setIsMinimized(true));
        },
        [dispatch]
    );

    const handleDelete = useCallback(async () => {
        if (!selectedEntity || !campaignId) return;
        if (!window.confirm(`¿Eliminar la ficha «${selectedEntity.title}»? Esta acción no se puede deshacer.`)) return;
        await dispatch(removeWikiEntity({ campaignId, entityId: selectedEntity.id }));
        dispatch(setWikiOverlayEntity(null));
        dispatch(showSnackbar({ message: "Ficha eliminada.", severity: "success" }));
    }, [selectedEntity, campaignId, dispatch]);

    const handleSaved = useCallback(
        (saved) => {
            dispatch(setWikiOverlayEntity(saved.id));
            syncAreaForEntity(saved);
            dispatch(showSnackbar({ message: "Ficha guardada.", severity: "success" }));
            dispatch(fetchEntityRelations({ campaignId, entityId: saved.id }));
        },
        [dispatch, campaignId, syncAreaForEntity]
    );

    if (!popupMode && !open) return null;

    if (!popupMode && wikiOverlayMinimized) {
        return (
            <Box
                onClick={() => dispatch(setWikiOverlayMinimized(false))}
                sx={{
                    position: "fixed",
                    bottom: { xs: 82, sm: 24 },
                    right: { xs: 8, sm: 24 },
                    zIndex: 1400,
                    pointerEvents: "auto",
                    px: 1.25,
                    py: 0.75,
                    bgcolor: UI_COLORS.backgroundSecondary,
                    border: `1px solid ${UI_COLORS.accent}`,
                    borderRadius: 1.5,
                    boxShadow: `0 0 16px ${UI_COLORS.accentGlow}`,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 0.75,
                    transition: "border-color 0.18s, box-shadow 0.18s",
                    "&:hover": {
                        boxShadow: `0 0 22px ${UI_COLORS.accentGlow}`,
                        borderColor: UI_COLORS.accentStrong,
                    },
                }}
            >
                <AutoStoriesIcon sx={{ color: UI_COLORS.accent, fontSize: "0.9rem" }} />
                <CyberTitle sx={{ color: UI_COLORS.accent, fontSize: "0.68rem", letterSpacing: 1.5 }}>
                    ARCHIVE
                </CyberTitle>
                <CyberText sx={{ fontSize: "0.58rem", color: UI_COLORS.textSecondary }}>restaurar</CyberText>
            </Box>
        );
    }

    const prefillData = {};
    if (vttContext?.linkedVttLocationId) {
        prefillData.linkedVttLocationId = vttContext.linkedVttLocationId;
        const vttLoc = locations[vttContext.linkedVttLocationId];
        if (vttLoc?.name && !prefillData.title) prefillData.title = vttLoc.name;
    }
    if (vttContext?.linkedVttCharacterId) prefillData.linkedVttCharacterId = vttContext.linkedVttCharacterId;
    if (vttContext?.prefillType) prefillData.entityType = vttContext.prefillType;
    if (vttContext?.timelinePrefill) {
        prefillData.entityType = WIKI_ENTITY_TYPES.EVENTO_HISTORICO;
        prefillData.customFields = buildTimelineCustomFields(vttContext.timelinePrefill);
    }

    const isTimelineView = effectiveAreaFilter === WIKI_AREA_IDS.TIMELINE;
    const isNeuralLabView = effectiveAreaFilter === WIKI_AREA_IDS.NEURAL_LAB;
    const timelineEditing = isTimelineView && (mode === "edit" || mode === "create");
    // Players can only be in list/detail modes
    const activeMode = readOnly && (mode === "edit" || mode === "create") ? "list" : mode;
    // Keep relation panel visible in standard detail views only.
    const showRelationPanel =
        !isNeuralLabView &&
        !isTimelineView &&
        activeMode === "detail" &&
        !!selectedEntity;

    const paperSx = popupMode
        ? POPUP_PAPER_SX
        : isFullscreen
            ? FULLSCREEN_PAPER_SX
            : DIALOG_PAPER_SX;

    const compact = !popupMode && !isFullscreen;
    const density = getWikiOverlayDensity(compact);
    const iconBtnSx = {
        color: UI_COLORS.textSecondary,
        "&:hover": { color: UI_COLORS.accent },
        ...density.iconBtnSx,
    };

    const archiveContent = (
        <>
            <Box
                onMouseDown={popupMode ? undefined : (e) => e.stopPropagation()}
                sx={{
                    ...paperSx,
                    display: "flex",
                    flexDirection: "column",
                    bgcolor: UI_COLORS.backgroundSecondary,
                    border: popupMode ? "none" : `1px solid ${UI_COLORS.border}`,
                    boxShadow: popupMode ? "none" : "0 0 35px rgba(0,0,0,0.5)",
                    overflow: "hidden",
                    flexShrink: 0,
                }}
            >
                {/* ── Top Bar ── */}
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 0.375,
                        px: density.headerPx,
                        py: density.headerPy,
                        bgcolor: UI_COLORS.backgroundSecondary,
                        borderBottom: `1px solid ${UI_COLORS.border}`,
                        flexShrink: 0,
                    }}
                >
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: "1fr auto 1fr",
                            alignItems: "center",
                            gap: 0.75,
                            minHeight: 30,
                        }}
                    >
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-start" }}>
                            <WikiAreaNav
                                compact
                                areaFilter={areaFilter}
                                onAreaFilterChange={handleAreaFilterChange}
                                showConfigButton={!readOnly}
                                onOpenConfig={() => setAiConfigOpen(true)}
                            />
                        </Box>

                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                <AutoStoriesIcon sx={{ color: UI_COLORS.accent, fontSize: compact ? "0.9rem" : "1rem" }} />
                                <CyberTitle
                                    sx={{
                                        color: UI_COLORS.accent,
                                        fontSize: density.titleFontSize,
                                        letterSpacing: density.titleLetterSpacing,
                                        lineHeight: 1.1,
                                    }}
                                >
                                    {compact ? "ARCHIVE" : "NARRATIVE_ARCHIVE"}
                                </CyberTitle>
                            </Box>
                            {readOnly && (
                                <CyberText sx={{ fontSize: "0.52rem", color: UI_COLORS.anomaly, letterSpacing: 0.8, lineHeight: 1.2 }}>
                                    LECTURA
                                </CyberText>
                            )}
                        </Box>

                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0 }}>
                            {!readOnly && !isNeuralLabView && selectedEntity && activeMode === "detail" && (
                                <CyberTooltip title="Explorar en NEURAL_LAB">
                                    <IconButton
                                        size="small"
                                        onClick={() => handleOpenInNeuralLab(selectedEntity)}
                                        sx={{ ...iconBtnSx, color: UI_COLORS.anomaly, "&:hover": { bgcolor: `${UI_COLORS.anomaly}18`, color: UI_COLORS.anomaly } }}
                                    >
                                        <HubIcon />
                                    </IconButton>
                                </CyberTooltip>
                            )}

                            {!popupMode && (
                                <CyberTooltip title="Abrir en pestaña (segundo monitor)">
                                    <IconButton size="small" onClick={handlePopout} sx={iconBtnSx}>
                                        <OpenInNewIcon />
                                    </IconButton>
                                </CyberTooltip>
                            )}

                            {!popupMode && (
                                <CyberTooltip title={isFullscreen ? "Vista normal" : "Pantalla completa"}>
                                    <IconButton size="small" onClick={() => setIsFullscreen((v) => !v)} sx={iconBtnSx}>
                                        {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                                    </IconButton>
                                </CyberTooltip>
                            )}

                            {!readOnly && !isNeuralLabView && (
                                <CyberTooltip title={isTimelineView ? "Nuevo evento histórico" : "Nueva ficha"}>
                                    <IconButton
                                        size="small"
                                        onClick={() => {
                                            if (isTimelineView) {
                                                handleCreateTimelineEvent({ direction: "down", anchorEntity: null });
                                            } else {
                                                dispatch(openWikiOverlay({ mode: "create", areaFilter }));
                                            }
                                        }}
                                        sx={{ ...iconBtnSx, color: UI_COLORS.accent, "&:hover": { bgcolor: `${UI_COLORS.accent}18`, color: UI_COLORS.accent } }}
                                    >
                                        <AddIcon />
                                    </IconButton>
                                </CyberTooltip>
                            )}

                            {!readOnly && selectedEntity && activeMode === "detail" && (
                                <>
                                    <CyberTooltip title="Editar">
                                        <IconButton
                                            size="small"
                                            onClick={() => dispatch(setWikiOverlayMode("edit"))}
                                            sx={{ ...iconBtnSx, color: UI_COLORS.accent, "&:hover": { bgcolor: `${UI_COLORS.accent}18`, color: UI_COLORS.accent } }}
                                        >
                                            <EditIcon />
                                        </IconButton>
                                    </CyberTooltip>
                                    <CyberTooltip title="Eliminar ficha">
                                        <IconButton
                                            size="small"
                                            onClick={handleDelete}
                                            sx={{ ...iconBtnSx, color: UI_COLORS.accentStrong, "&:hover": { bgcolor: `${UI_COLORS.accentStrong}18`, color: UI_COLORS.accentStrong } }}
                                        >
                                            <DeleteIcon />
                                        </IconButton>
                                    </CyberTooltip>
                                </>
                            )}

                            {!readOnly && (activeMode === "edit" || activeMode === "create") && (
                                <CyberTooltip title="Volver">
                                    <IconButton
                                        size="small"
                                        onClick={() =>
                                            selectedEntity
                                                ? dispatch(setWikiOverlayMode("detail"))
                                                : dispatch(setWikiOverlayEntity(null))
                                        }
                                        sx={iconBtnSx}
                                    >
                                        <ArrowBackIcon />
                                    </IconButton>
                                </CyberTooltip>
                            )}

                            {!popupMode && (
                                <CyberTooltip title="Minimizar">
                                    <IconButton
                                        size="small"
                                        onClick={() => dispatch(setWikiOverlayMinimized(true))}
                                        sx={iconBtnSx}
                                    >
                                        <RemoveIcon />
                                    </IconButton>
                                </CyberTooltip>
                            )}
                            <CyberTooltip title={popupMode ? "Cerrar pestaña (Esc)" : "Cerrar archivo (Esc)"}>
                                <IconButton size="small" onClick={handleClose} sx={{ ...iconBtnSx, ml: 0.25 }}>
                                    <CloseIcon />
                                </IconButton>
                            </CyberTooltip>
                        </Box>
                    </Box>

                    {!isNeuralLabView && (
                        <WikiSearchBar
                            compact={compact}
                            hideAreaNav
                            query={query}
                            onQueryChange={setQuery}
                            typeFilter={typeFilter}
                            onTypeFilterChange={setTypeFilter}
                            areaFilter={areaFilter}
                            onAreaFilterChange={handleAreaFilterChange}
                            showConfigButton={false}
                            onOpenConfig={() => setAiConfigOpen(true)}
                        />
                    )}
                </Box>

                {/* ── Main Panel ── */}
                <Box sx={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
                    {/* Left: Entity list (hidden on Timeline and NEURAL_LAB visual layouts) */}
                    {!isTimelineView && !isNeuralLabView && (
                        <Box
                            sx={{
                                width: density.panelLeft,
                                flexShrink: 0,
                                borderRight: `1px solid ${UI_COLORS.border}`,
                                overflow: "hidden",
                                display: "flex",
                                flexDirection: "column",
                                minHeight: 0,
                            }}
                        >
                            {wikiStatus === "loading" ? (
                                <CyberText sx={{ color: UI_COLORS.textSecondary, p: 2, fontSize: "0.8rem" }}>
                                    Cargando archivo...
                                </CyberText>
                            ) : (
                                <WikiEntityList
                                    compact={compact}
                                    entities={results}
                                    selectedId={entityId}
                                    onSelect={handleSelectEntity}
                                />
                            )}
                        </Box>
                    )}

                    {/* NEURAL_LAB: entity detail left | graph | LAB_IA right */}
                    {isNeuralLabView && (
                        <>
                            <Box
                                sx={{
                                    width: neuralLabLeftOpen && selectedEntity ? density.panelDetail : 0,
                                    flexShrink: 0,
                                    borderRight:
                                        neuralLabLeftOpen && selectedEntity
                                            ? `1px solid ${UI_COLORS.border}`
                                            : "none",
                                    overflow: "hidden",
                                    display: "flex",
                                    flexDirection: "column",
                                    minHeight: 0,
                                    transition: "width 0.25s ease",
                                }}
                            >
                                {neuralLabLeftOpen && selectedEntity && (
                                    <WikiEntityDetail
                                        compact={compact}
                                        entity={selectedEntity}
                                        entities={entities}
                                        locations={locations}
                                        onEntityClick={handleNavigateToEntity}
                                        onGoToPage={() => handleGoToEntityPage(selectedEntity)}
                                        onOpenVttLocation={(id) => openVttLocation(id, 0)}
                                        onOpenVttCharacter={(characterId) => {
                                            const locId = Object.values(locations).find((loc) =>
                                                loc.characters?.some((c) => c.id === characterId)
                                            )?.id;
                                            if (locId) openVttLocation(locId, 1);
                                        }}
                                    />
                                )}
                            </Box>

                            <Box
                                sx={{
                                    flex: 1,
                                    minWidth: 0,
                                    minHeight: 0,
                                    overflow: "hidden",
                                    borderRight: !readOnly && neuralLabRightOpen
                                        ? `1px solid ${UI_COLORS.border}`
                                        : "none",
                                    display: "flex",
                                    flexDirection: "column",
                                    position: "relative",
                                    alignSelf: "stretch",
                                }}
                            >
                                <WikiEntityAutocomplete
                                    entities={graphEntities}
                                    onSelect={handleSelectEntityNeuralLab}
                                    compact={compact}
                                />

                                {selectedEntity && (
                                    <CyberTooltip
                                        title={
                                            neuralLabLeftOpen ? "Ocultar ficha" : "Mostrar ficha seleccionada"
                                        }
                                    >
                                        <IconButton
                                            size="small"
                                            onClick={() => setNeuralLabLeftOpen((v) => !v)}
                                            sx={{
                                                ...NEURAL_LAB_PANEL_TOGGLE_SX,
                                                left: 6,
                                            }}
                                        >
                                            {neuralLabLeftOpen ? (
                                                <ChevronLeftIcon sx={{ fontSize: "1.1rem" }} />
                                            ) : (
                                                <ChevronRightIcon sx={{ fontSize: "1.1rem" }} />
                                            )}
                                        </IconButton>
                                    </CyberTooltip>
                                )}

                                {!readOnly && (
                                    <CyberTooltip title={neuralLabRightOpen ? "Ocultar LAB_IA" : "Mostrar LAB_IA"}>
                                        <IconButton
                                            size="small"
                                            onClick={() => setNeuralLabRightOpen((v) => !v)}
                                            sx={{
                                                ...NEURAL_LAB_PANEL_TOGGLE_SX,
                                                right: 6,
                                                left: "auto",
                                            }}
                                        >
                                            {neuralLabRightOpen ? (
                                                <ChevronRightIcon sx={{ fontSize: "1.1rem" }} />
                                            ) : (
                                                <ChevronLeftIcon sx={{ fontSize: "1.1rem" }} />
                                            )}
                                        </IconButton>
                                    </CyberTooltip>
                                )}

                                <WikiGraphCanvas
                                    entities={graphEntities}
                                    relations={graphRelations}
                                    selectedEntityId={entityId}
                                    onSelectEntity={handleSelectEntityNeuralLab}
                                    detailPanelOpen={neuralLabLeftOpen && !!selectedEntity}
                                    labPanelOpen={neuralLabRightOpen}
                                    propagationState={propagationState}
                                />
                            </Box>

                            {!readOnly && (
                                <Box
                                    sx={{
                                        width: neuralLabRightOpen ? density.panelLab : 0,
                                        flexShrink: 0,
                                        minHeight: 0,
                                        overflow: "hidden",
                                        display: "flex",
                                        flexDirection: "column",
                                        position: "relative",
                                        zIndex: 10,
                                        transition: "width 0.25s ease",
                                        borderLeft: neuralLabRightOpen ? `1px solid ${UI_COLORS.border}` : "none",
                                    }}
                                >
                                    {neuralLabRightOpen && (
                                        <WikiAiLabPanel
                                            selectedEntity={selectedEntity}
                                            entities={graphEntities}
                                            relations={graphRelations}
                                            campaignId={campaignId}
                                            narrativeSettings={narrativeSettings}
                                            onPropagationStart={handlePropagationStart}
                                            onPropagationEnd={handlePropagationEnd}
                                        />
                                    )}
                                </Box>
                            )}
                        </>
                    )}

                    {/* Center (standard/timeline views) */}
                    {!isNeuralLabView && (
                    <Box
                        sx={{
                            flex: 1,
                            minWidth: 0,
                            minHeight: 0,
                            overflow: "hidden",
                            borderRight: showRelationPanel ? `1px solid ${UI_COLORS.border}` : "none",
                            display: "flex",
                            flexDirection: "column",
                        }}
                    >
                        {isTimelineView && !timelineEditing && (
                            wikiStatus === "loading" ? (
                                <CyberText sx={{ color: UI_COLORS.textSecondary, p: 3, fontSize: "0.85rem" }}>
                                    Cargando línea temporal...
                                </CyberText>
                            ) : (
                                <WikiTimelineView
                                    entities={results}
                                    allEntities={entities}
                                    relations={relations}
                                    campaignId={campaignId}
                                    uid={uid}
                                    narrativeSettings={narrativeSettings}
                                    selectedId={entityId}
                                    readOnly={readOnly}
                                    onSelect={handleSelectEntity}
                                    onEntityClick={handleNavigateToEntity}
                                    onCreateCore={() => handleCreateTimelineEvent({ isCore: true })}
                                    onBranch={handleCreateTimelineEvent}
                                />
                            )
                        )}

                        {isTimelineView && timelineEditing && !readOnly && (
                            <WikiEntityEditor
                                entity={activeMode === "edit" ? selectedEntity : null}
                                campaignId={campaignId}
                                prefillData={prefillData}
                                onSaved={handleSaved}
                                onCancel={() =>
                                    selectedEntity
                                        ? dispatch(setWikiOverlayMode("detail"))
                                        : dispatch(setWikiOverlayEntity(null))
                                }
                            />
                        )}

                        {!isTimelineView && activeMode === "detail" && (
                            <WikiEntityDetail
                                compact={compact}
                                entity={selectedEntity}
                                entities={entities}
                                locations={locations}
                                onEntityClick={handleNavigateToEntity}
                                onOpenInNeuralLab={
                                    !readOnly ? () => handleOpenInNeuralLab(selectedEntity) : undefined
                                }
                                onOpenVttLocation={(id) => openVttLocation(id, 0)}
                                onOpenVttCharacter={(characterId) => {
                                    const locId = Object.values(locations).find((loc) =>
                                        loc.characters?.some((c) => c.id === characterId)
                                    )?.id;
                                    if (locId) openVttLocation(locId, 1);
                                }}
                            />
                        )}
                        {!isTimelineView && !readOnly && (activeMode === "edit" || activeMode === "create") && (
                            <WikiEntityEditor
                                entity={activeMode === "edit" ? selectedEntity : null}
                                campaignId={campaignId}
                                prefillData={prefillData}
                                onSaved={handleSaved}
                                onCancel={() =>
                                    selectedEntity
                                        ? dispatch(setWikiOverlayMode("detail"))
                                        : dispatch(setWikiOverlayEntity(null))
                                }
                            />
                        )}
                        {!isTimelineView && activeMode === "list" && !selectedEntity && (
                            <Box sx={{ p: density.emptyStatePy }}>
                                <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: density.emptyStateFontSize }}>
                                    Selecciona una ficha del listado para verla aquí.
                                </CyberText>
                            </Box>
                        )}
                    </Box>
                    )} {/* end !isNeuralLabView */}

                    {/* Right: detail (timeline) or relations */}
                    {isTimelineView && activeMode === "detail" && selectedEntity && (
                        <Box
                            sx={{
                                width: { xs: "100%", sm: compact ? 248 : 300 },
                                maxWidth: compact ? 260 : 340,
                                flexShrink: 0,
                                minHeight: 0,
                                overflow: "hidden",
                                borderLeft: { xs: "none", sm: `1px solid ${UI_COLORS.border}` },
                            }}
                        >
                            <WikiEntityDetail
                                compact={compact}
                                entity={selectedEntity}
                                entities={entities}
                                locations={locations}
                                onEntityClick={handleNavigateToEntity}
                                onOpenVttLocation={(id) => openVttLocation(id, 0)}
                                onOpenVttCharacter={(characterId) => {
                                    const locId = Object.values(locations).find((loc) =>
                                        loc.characters?.some((c) => c.id === characterId)
                                    )?.id;
                                    if (locId) openVttLocation(locId, 1);
                                }}
                            />
                        </Box>
                    )}

                    {showRelationPanel && (
                        <Box sx={{ width: density.panelRight, flexShrink: 0, minHeight: 0, overflow: "hidden" }}>
                            <WikiRelationPanel
                                entity={selectedEntity}
                                campaignId={campaignId}
                                onNavigate={handleNavigateToEntity}
                                readOnly={readOnly}
                            />
                        </Box>
                    )}
                </Box>
            </Box>
            <WikiAiConfigDialog
                open={aiConfigOpen}
                onClose={() => setAiConfigOpen(false)}
                narrativeSettings={narrativeSettings}
                campaignId={campaignId}
                uid={uid}
            />
        </>
    );

    if (popupMode) {
        return (
            <Box
                sx={{
                    width: "100vw",
                    height: "100dvh",
                    bgcolor: UI_COLORS.backgroundSecondary,
                    overflow: "hidden",
                    pointerEvents: "auto",
                }}
            >
                {archiveContent}
            </Box>
        );
    }

    return (
        <Box
            onMouseDown={handleBackdropClick}
            sx={{
                position: "fixed",
                inset: 0,
                zIndex: 1400,
                bgcolor: `${UI_COLORS.backgroundPrimary}f2`,
                backdropFilter: "blur(4px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                p: isFullscreen ? { xs: 0.5, sm: 1 } : { xs: 0, sm: 0.5 },
                pointerEvents: "auto",
            }}
        >
            {archiveContent}
        </Box>
    );
}
