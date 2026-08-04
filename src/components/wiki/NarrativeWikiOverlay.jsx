import { useEffect, useCallback, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Box, Dialog, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import RemoveIcon from "@mui/icons-material/Remove";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useDispatch, useSelector } from "react-redux";
import { CyberTitle, CyberText } from "../customs/CustomTexts";
import CyberTooltip from "../customs/CyberTooltip";
import { UI_COLORS, TYPO, Z_INDEX } from "../../constants/designSystem";
import { RENDER_LAYERS } from "../../constants/renderLayers";
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
    setDialogMinimized,
    openWikiOverlay,
    openLocation,
    restoreDialog,
    showSnackbar,
} from "../../store/uiSlice";
import { DIALOG_IDS } from "../../constants/dialogIds";
import WikiSearchBar from "./WikiSearchBar";
import WikiAreaNav from "./WikiAreaNav";
import WikiEntityAutocomplete from "./WikiEntityAutocomplete";
import WikiEntityList from "./WikiEntityList";
import WikiEntityDetail from "./WikiEntityDetail";
import WikiEntityEditor from "./WikiEntityEditor";
import WikiRelationPanel from "./WikiRelationPanel";
import WikiTimelineView from "./WikiTimelineView";
import WikiAiLabPanel from "./WikiAiLabPanel";
import WikiSessionLogPanel from "./WikiSessionLogPanel";
import WikiAiConfigDialog from "./WikiAiConfigDialog";
import SystemGlossaryDialog from "./SystemGlossaryDialog";
import WikiGraphCanvas from "../../pixi/wikiGraph/WikiGraphCanvas";
import { filterEntitiesByLegend } from "./WikiGraphHud";
import { useWikiSearch } from "../../hooks/useWikiSearch";
import { WIKI_ENTITY_TYPES, compareEntitiesByArchiveOrder } from "../../constants/wikiEntityTypes";
import {
    filterEntitiesByWikiArea,
    getWikiArea,
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

/** Dialog sizing — near full-bleed (no 1400px cap that left huge margins on 1440p+). */
const DIALOG_PAPER_SX = {
    width: { xs: "100%", sm: "min(97vw, 100%)" },
    height: { xs: "92dvh", sm: "min(92vh, 100%)" },
    maxWidth: "none",
    maxHeight: { xs: "92dvh", sm: "min(92vh, 100%)" },
    borderRadius: { xs: "10px 10px 0 0", sm: 2 },
};

const FULLSCREEN_PAPER_SX = {
    width: { xs: "calc(100vw - 8px)", sm: "min(98vw, 100%)" },
    height: { xs: "calc(100dvh - 16px)", sm: "min(96vh, 100%)" },
    maxWidth: "none",
    maxHeight: "none",
    borderRadius: { xs: 1.5, sm: 2 },
};

const POPUP_PAPER_SX = {
    width: "100vw",
    height: "100dvh",
    borderRadius: 0,
};

const NEURAL_LAB_FICHA_DIALOG_PAPER_SX = {
    width: "calc(100% - 48px)",
    height: "calc(100% - 48px)",
    maxHeight: "calc(100dvh - 48px)",
    maxWidth: "none",
    m: 0,
    bgcolor: UI_COLORS.backgroundSecondary,
    border: `1px solid ${UI_COLORS.border}`,
    borderRadius: 2,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
};

const NEURAL_LAB_PANEL_TOGGLE_SX = {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 6,
    width: 28,
    height: 36,
    borderRadius: 1,
    bgcolor: `${UI_COLORS.backgroundSecondary}ee`,
    border: `1px solid ${UI_COLORS.border}`,
    color: UI_COLORS.textSecondary,
    "&:hover": { color: UI_COLORS.accent, bgcolor: `${UI_COLORS.accent}12` },
};

export default function NarrativeWikiOverlay({ popupMode = false }) {
    const dispatch = useDispatch();
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [neuralLabRightOpen, setNeuralLabRightOpen] = useState(true);
    const [fichaDialogOpen, setFichaDialogOpen] = useState(false);
    const [labHiddenTypes, setLabHiddenTypes] = useState(() => new Set());
    const [labSoloType, setLabSoloType] = useState(null);
    const [aiConfigOpen, setAiConfigOpen] = useState(false);
    const [glossaryOpen, setGlossaryOpen] = useState(false);
    const [propagationState, setPropagationState] = useState(null);
    /** Bumps when starting a fresh create form so WikiEntityEditor remounts. */
    const [createEditorNonce, setCreateEditorNonce] = useState(0);
    /** Snapshot for «Volver» after cross-area / cross-entity jumps (mentions, Ir a CODEX, etc.). */
    const [navReturn, setNavReturn] = useState(null);
    const wikiOverlay = useSelector((s) => s.ui.wikiOverlay);
    const entities = useSelector((s) => s.wiki.entities);
    const wikiStatus = useSelector((s) => s.wiki.status);
    const loadedCampaignId = useSelector((s) => s.wiki.loadedCampaignId);
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const locations = useSelector((s) => s.world.locations);
    const syncActive = useSelector((s) => s.wiki.syncActive);
    const relations = useSelector((s) => s.wiki.relations);
    const narrativeSettings = useSelector((s) => s.wiki.narrativeSettings);
    const wikiMinimized = useSelector((s) => s.ui.minimizedDialogs[DIALOG_IDS.WIKI]);
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

    useEffect(() => {
        if (!isActive) setNavReturn(null);
    }, [isActive]);

    // Apply area filter after Fuse, before rendering list
    const { query, setQuery, results: fuseResults, typeFilter, setTypeFilter } = useWikiSearch(entities);
    const areaFilteredResults = filterEntitiesByWikiArea(fuseResults, effectiveAreaFilter);
    const results = useMemo(() => {
        const base = [...areaFilteredResults];
        if (query.trim().length >= 2) return base;
        return base.sort(compareEntitiesByArchiveOrder);
    }, [areaFilteredResults, query]);
    const groupListByType = !query.trim() && !typeFilter;

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
            setFichaDialogOpen(false);
            setPropagationState(null);
        }
    }, [effectiveAreaFilter]);

    useEffect(() => {
        if (!selectedEntity) setFichaDialogOpen(false);
    }, [selectedEntity]);

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
     * Guards against identical preview updates to avoid render loops when the Lab
     * panel recomputes waves with a new array reference but the same content.
     */
    const handlePropagationStart = useCallback((waves, opts = {}) => {
        if (!waves?.length) return;
        const litNodeIds = [...new Set(waves[0]?.nodeIds ?? [])];
        const wavesKey = waves
            .map((w) => `${w.wave ?? ""}:${(w.nodeIds ?? []).join(",")}`)
            .join("|");

        if (opts?.preview) {
            setPropagationState((prev) => {
                if (
                    prev?.mode === "preview"
                    && prev.maxWave === waves.length - 1
                    && prev.waves
                    && prev.waves.map((w) => `${w.wave ?? ""}:${(w.nodeIds ?? []).join(",")}`).join("|") === wavesKey
                ) {
                    return prev;
                }
                return {
                    mode: "preview",
                    active: false,
                    currentWave: waves.length - 1,
                    waves,
                    litNodeIds: [],
                    maxWave: waves.length - 1,
                };
            });
        } else {
            setPropagationState({ mode: "live", active: true, currentWave: 0, waves, litNodeIds });
        }
    }, []);

    const handlePropagationEnd = useCallback(() => {
        setPropagationState((prev) => (prev == null ? prev : null));
    }, []);

    const buildNavSnapshot = useCallback(() => {
        const area = getWikiArea(effectiveAreaFilter);
        const entity = entities.find((e) => e.id === entityId);
        const label = entity?.title ? `${area.label} — ${entity.title}` : area.label;
        return {
            areaFilter: effectiveAreaFilter,
            entityId: entityId ?? null,
            mode,
            label,
        };
    }, [effectiveAreaFilter, entityId, mode, entities]);

    const captureNavReturn = useCallback(() => {
        setNavReturn(buildNavSnapshot());
    }, [buildNavSnapshot]);

    const handleNavBack = useCallback(() => {
        if (!navReturn) return;
        const snap = navReturn;
        setNavReturn(null);
        dispatch(setWikiOverlayAreaFilter(snap.areaFilter));
        if (snap.entityId) {
            dispatch(setWikiOverlayEntity(snap.entityId));
            if (snap.mode === "edit" || snap.mode === "create") {
                dispatch(setWikiOverlayMode(snap.mode));
            }
        } else {
            dispatch(setWikiOverlayEntity(null));
            if (snap.mode === "create") {
                dispatch(setWikiOverlayMode("create"));
            }
        }
    }, [navReturn, dispatch]);

    const handleAreaFilterChange = useCallback(
        (id) => {
            setNavReturn(null);
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
            dispatch(restoreDialog(DIALOG_IDS.LOCATION));
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

    const visibleGraphEntities = useMemo(
        () => filterEntitiesByLegend(graphEntities, labHiddenTypes, labSoloType),
        [graphEntities, labHiddenTypes, labSoloType]
    );

    const visibleGraphRelations = useMemo(() => {
        const ids = new Set(visibleGraphEntities.map((e) => e.id));
        return graphRelations.filter(
            (r) => ids.has(r.fromEntityId) && ids.has(r.toEntityId)
        );
    }, [graphRelations, visibleGraphEntities]);

    const handleToggleLabType = useCallback((type) => {
        setLabSoloType(null);
        setLabHiddenTypes((prev) => {
            const next = new Set(prev);
            if (next.has(type)) next.delete(type);
            else next.add(type);
            return next;
        });
    }, []);

    const handleSoloLabType = useCallback((type) => {
        setLabSoloType((prev) => (prev === type ? null : type));
        setLabHiddenTypes(new Set());
    }, []);

    const handleClearLabSolo = useCallback(() => {
        setLabSoloType(null);
        setLabHiddenTypes(new Set());
    }, []);

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
            captureNavReturn();
            dispatch(setWikiOverlayAreaFilter(WIKI_AREA_IDS.NEURAL_LAB));
            dispatch(setWikiOverlayEntity(entity.id));
            setFichaDialogOpen(true);
        },
        [dispatch, captureNavReturn]
    );

    // NEURAL_LAB: explicit "go to the entity's native area page" action
    const handleGoToEntityPage = useCallback(
        (entity) => {
            if (!entity) return;
            captureNavReturn();
            syncAreaForEntity(entity);
            dispatch(setWikiOverlayEntity(entity.id));
            dispatch(setWikiOverlayMode("detail"));
        },
        [dispatch, syncAreaForEntity, captureNavReturn]
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

                const targetArea = getWikiAreaForEntityType(ent.entityType);
                const areaChanging = targetArea !== effectiveAreaFilter;
                const entityChanging = ent.id !== entityId;
                if (areaChanging || entityChanging) {
                    captureNavReturn();
                }
                dispatch(setWikiOverlayAreaFilter(targetArea));
                dispatch(setWikiOverlayEntity(ent.id));
            }
        },
        [dispatch, entities, locations, openVttLocation, effectiveAreaFilter, entityId, captureNavReturn]
    );

    /** Relation panel: always stay in Archive on the wiki ficha (never jump to VTT). */
    const handleNavigateRelationEntity = useCallback(
        (targetId) => {
            if (!targetId) return;
            const ent = entities.find((e) => e.id === targetId);
            if (!ent) return;
            const targetArea = getWikiAreaForEntityType(ent.entityType);
            const areaChanging = targetArea !== effectiveAreaFilter;
            const entityChanging = ent.id !== entityId;
            if (areaChanging || entityChanging) {
                captureNavReturn();
            }
            dispatch(setWikiOverlayAreaFilter(targetArea));
            dispatch(setWikiOverlayEntity(ent.id));
            dispatch(setWikiOverlayMode("detail"));
        },
        [dispatch, entities, effectiveAreaFilter, entityId, captureNavReturn]
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
            dispatch(setDialogMinimized({ id: DIALOG_IDS.WIKI, value: true }));
        },
        [dispatch]
    );

    const handleCreateEntity = useCallback(() => {
        if (mode === "edit" || mode === "create") {
            const editingLabel = selectedEntity?.title
                ? `«${selectedEntity.title}»`
                : "la ficha actual";
            const message =
                mode === "edit"
                    ? `Estás editando ${editingLabel}. Si abres una ficha nueva, perderás los cambios no guardados. ¿Continuar?`
                    : "Tienes una ficha nueva sin guardar. Si continúas, perderás el borrador. ¿Crear otra ficha desde cero?";
            if (!window.confirm(message)) return;
        }

        setCreateEditorNonce((n) => n + 1);
        dispatch(
            openWikiOverlay({
                mode: "create",
                entityId: null,
                vttContext: null,
                areaFilter: areaFilter ?? effectiveAreaFilter,
            })
        );
    }, [dispatch, areaFilter, effectiveAreaFilter, mode, selectedEntity?.title]);

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

    if (!popupMode && wikiMinimized) return null;

    const prefillData = {};
    if (vttContext?.linkedVttLocationId) {
        prefillData.linkedVttLocationId = vttContext.linkedVttLocationId;
        const vttLoc = locations[vttContext.linkedVttLocationId];
        if (vttLoc?.name && !prefillData.title) prefillData.title = vttLoc.name;
    }
    if (vttContext?.linkedVttCharacterId) {
        prefillData.linkedVttCharacterId = vttContext.linkedVttCharacterId;
        const vttChar = Object.values(locations)
            .flatMap((loc) => loc.characters || [])
            .find((c) => c.id === vttContext.linkedVttCharacterId);
        if (vttChar?.name && !prefillData.title) prefillData.title = vttChar.name;
    }
    if (vttContext?.prefillType) prefillData.entityType = vttContext.prefillType;
    if (vttContext?.timelinePrefill) {
        prefillData.entityType = WIKI_ENTITY_TYPES.EVENTO_HISTORICO;
        prefillData.customFields = buildTimelineCustomFields(vttContext.timelinePrefill);
    }

    const isTimelineView = effectiveAreaFilter === WIKI_AREA_IDS.TIMELINE;
    const isNeuralLabView = effectiveAreaFilter === WIKI_AREA_IDS.NEURAL_LAB;
    const isSessionsView = effectiveAreaFilter === WIKI_AREA_IDS.SESSIONS;
    const timelineEditing = isTimelineView && (mode === "edit" || mode === "create");
    // Players can only be in list/detail modes
    const activeMode = readOnly && (mode === "edit" || mode === "create") ? "list" : mode;
    const wikiEditorKey =
        activeMode === "edit" && entityId
            ? `edit-${entityId}`
            : `create-${createEditorNonce}`;
    // Keep relation panel visible in standard detail views only.
    const showRelationPanel =
        !isNeuralLabView &&
        !isTimelineView &&
        !isSessionsView &&
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
                                showGlossaryButton
                                onOpenGlossary={() => setGlossaryOpen(true)}
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

                            {!readOnly && isTimelineView && (
                                <CyberTooltip title="Nuevo evento histórico">
                                    <IconButton
                                        size="small"
                                        onClick={() => handleCreateTimelineEvent({ direction: "down", anchorEntity: null })}
                                        sx={{ ...iconBtnSx, color: UI_COLORS.accent, "&:hover": { bgcolor: `${UI_COLORS.accent}18`, color: UI_COLORS.accent } }}
                                    >
                                        <AddIcon />
                                    </IconButton>
                                </CyberTooltip>
                            )}


                            {!popupMode && (
                                <CyberTooltip title="Minimizar">
                                    <IconButton
                                        size="small"
                                        onClick={() => dispatch(setDialogMinimized({ id: DIALOG_IDS.WIKI, value: true }))}
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

                    {navReturn && (
                        <Box
                            component="button"
                            type="button"
                            onClick={handleNavBack}
                            sx={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 0.5,
                                alignSelf: "flex-start",
                                px: 1,
                                py: 0.35,
                                bgcolor: `${UI_COLORS.anomaly}10`,
                                border: `1px solid ${UI_COLORS.anomaly}44`,
                                borderRadius: 1,
                                color: UI_COLORS.anomaly,
                                cursor: "pointer",
                                fontFamily: TYPO.body,
                                transition: "background-color 0.15s, border-color 0.15s",
                                "&:hover": {
                                    bgcolor: `${UI_COLORS.anomaly}18`,
                                    borderColor: UI_COLORS.anomaly,
                                },
                            }}
                        >
                            <ArrowBackIcon sx={{ fontSize: "0.85rem" }} />
                            <CyberText sx={{ fontSize: compact ? "0.65rem" : "0.72rem", color: "inherit", lineHeight: 1.2 }}>
                                Volver a {navReturn.label}
                            </CyberText>
                        </Box>
                    )}

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
                                <>
                                    {!readOnly && (
                                        <Box
                                            sx={{
                                                px: compact ? 0.75 : 1,
                                                py: compact ? 0.5 : 0.75,
                                                borderBottom: `1px solid ${UI_COLORS.border}`,
                                                flexShrink: 0,
                                            }}
                                        >
                                            <Box
                                                component="button"
                                                type="button"
                                                onClick={handleCreateEntity}
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 0.5,
                                                    width: "100%",
                                                    px: 1,
                                                    py: 0.45,
                                                    bgcolor: `${UI_COLORS.accent}10`,
                                                    border: `1px solid ${UI_COLORS.accent}44`,
                                                    borderRadius: 1,
                                                    color: UI_COLORS.accent,
                                                    cursor: "pointer",
                                                    fontFamily: TYPO.body,
                                                    transition: "background-color 0.15s, border-color 0.15s",
                                                    "&:hover": {
                                                        bgcolor: `${UI_COLORS.accent}18`,
                                                        borderColor: UI_COLORS.accent,
                                                    },
                                                }}
                                            >
                                                <AddIcon sx={{ fontSize: "0.85rem" }} />
                                                <CyberText sx={{ fontSize: compact ? "0.68rem" : "0.75rem" }}>
                                                    Nueva ficha
                                                </CyberText>
                                            </Box>
                                        </Box>
                                    )}
                                    <WikiEntityList
                                        compact={compact}
                                        entities={results}
                                        selectedId={entityId}
                                        onSelect={handleSelectEntity}
                                        groupByType={groupListByType}
                                    />
                                </>
                            )}
                        </Box>
                    )}

                    {/* NEURAL_LAB: graph center | LAB_IA right; ficha via Dialog */}
                    {isNeuralLabView && (
                        <>
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
                                    entities={visibleGraphEntities}
                                    onSelect={handleSelectEntityNeuralLab}
                                    compact={compact}
                                    placeholder="Buscar nodo visible…"
                                />

                                {!readOnly && (
                                    <CyberTooltip title={neuralLabRightOpen ? "Ocultar LAB_IA" : "Mostrar LAB_IA"}>
                                        <IconButton
                                            size="small"
                                            onClick={() => setNeuralLabRightOpen((v) => !v)}
                                            sx={NEURAL_LAB_PANEL_TOGGLE_SX}
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
                                    entities={visibleGraphEntities}
                                    relations={visibleGraphRelations}
                                    legendEntities={graphEntities}
                                    selectedEntityId={entityId}
                                    selectedEntity={selectedEntity}
                                    onSelectEntity={handleSelectEntityNeuralLab}
                                    onClearSelection={() => dispatch(setWikiOverlayEntity(null))}
                                    onOpenEntityDetail={() => {
                                        if (selectedEntity) setFichaDialogOpen(true);
                                    }}
                                    detailPanelOpen={false}
                                    labPanelOpen={neuralLabRightOpen}
                                    propagationState={propagationState}
                                    hiddenTypes={labHiddenTypes}
                                    soloType={labSoloType}
                                    onToggleType={handleToggleLabType}
                                    onSoloType={handleSoloLabType}
                                    onClearSolo={handleClearLabSolo}
                                />
                            </Box>

                            {!readOnly && (
                                <Box
                                    sx={{
                                        width: neuralLabRightOpen ? density.panelLab : 0,
                                        flexShrink: 0,
                                        minHeight: 0,
                                        height: "100%",
                                        alignSelf: "stretch",
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

                            <Dialog
                                open={fichaDialogOpen && !!selectedEntity}
                                onClose={() => setFichaDialogOpen(false)}
                                fullWidth
                                maxWidth={false}
                                sx={{ zIndex: Z_INDEX.wikiDialog }}
                                slotProps={{
                                    paper: { sx: NEURAL_LAB_FICHA_DIALOG_PAPER_SX },
                                }}
                            >
                                {selectedEntity && (
                                    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "flex-end",
                                                px: 1,
                                                py: 0.5,
                                                borderBottom: `1px solid ${UI_COLORS.border}`,
                                                flexShrink: 0,
                                            }}
                                        >
                                            <IconButton
                                                size="small"
                                                onClick={() => setFichaDialogOpen(false)}
                                                sx={{ color: UI_COLORS.textSecondary }}
                                            >
                                                <CloseIcon fontSize="small" />
                                            </IconButton>
                                        </Box>
                                        <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
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
                                        </Box>
                                    </Box>
                                )}
                            </Dialog>
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

                        {isSessionsView && (
                            <WikiSessionLogPanel campaignId={campaignId} readOnly={readOnly} />
                        )}

                        {isTimelineView && timelineEditing && !readOnly && (
                            <WikiEntityEditor
                                key={wikiEditorKey}
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
                                    !readOnly && selectedEntity
                                        ? () => handleOpenInNeuralLab(selectedEntity)
                                        : undefined
                                }
                                onEdit={
                                    !readOnly && selectedEntity
                                        ? () => dispatch(setWikiOverlayMode("edit"))
                                        : undefined
                                }
                                onDelete={!readOnly && selectedEntity ? handleDelete : undefined}
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
                                key={wikiEditorKey}
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
                                onNavigate={handleNavigateRelationEntity}
                                readOnly={readOnly}
                            />
                        </Box>
                    )}
                </Box>
            </Box>
            <SystemGlossaryDialog
                open={glossaryOpen}
                onClose={() => setGlossaryOpen(false)}
            />
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

    return createPortal(
        <Box
            onMouseDown={handleBackdropClick}
            sx={{
                position: "fixed",
                inset: 0,
                zIndex: RENDER_LAYERS.WIKI_OVERLAY,
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
        </Box>,
        document.body
    );
}
