import { useEffect, useCallback, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { createPortal } from "react-dom";
import { Box, Dialog, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import RemoveIcon from "@mui/icons-material/Remove";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useDispatch, useSelector } from "react-redux";
import { CyberText } from "../customs/CustomTexts";
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
    closeNeuralLabOverlay,
    setNeuralLabFocusEntity,
    openLocation,
    restoreDialog,
    showSnackbar,
} from "../../store/uiSlice";
import { DIALOG_IDS } from "../../constants/dialogIds";
import WikiSearchBar from "./WikiSearchBar";
import WikiAreaNav from "./WikiAreaNav";
import { ArchiveBrand } from "./ArchiveChrome";
import ArchiveExitMenu from "./ArchiveExitMenu";
import ArchiveLoreGear from "./ArchiveLoreGear";
import { ARCHIVE_TBG_SX, ARCHIVE_TOPNAV_SX } from "../../constants/archiveChrome";
import WikiEntityList from "./WikiEntityList";
import WikiEntityDetail from "./WikiEntityDetail";
import WikiEntityEditor from "./WikiEntityEditor";
import WikiRelationPanel from "./WikiRelationPanel";
import ArchiveDiary from "./archive-diary/ArchiveDiary";
import CampaignCodex from "./archive-codex/CampaignCodex";
import CampaignTimeline from "./archive-timeline/CampaignTimeline";
import CampaignNeuralLabOverlay from "./CampaignNeuralLabOverlay";
import WikiAiConfigDialog from "./WikiAiConfigDialog";
import SystemGlossaryDialog from "./SystemGlossaryDialog";
import { filterEntitiesByLegend } from "./WikiGraphHud";
import { confirmLeaveEditorDraft } from "../../utils/editorDraftGuard";
import { useWikiSearch } from "../../hooks/useWikiSearch";
import { WIKI_ENTITY_TYPES, compareEntitiesByArchiveOrder } from "../../constants/wikiEntityTypes";
import {
    dedupePersonajesByVttLink,
    findWikiLocacionForPin,
    wikiEntityLinksLocation,
} from "../../constants/wiki/archiveIdentity.js";
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
import { buildTimelineCustomFields } from "../../utils/wikiTimeline";
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

const PLAYER_HIDDEN_AREAS = [WIKI_AREA_IDS.LORE];
const PLAYER_AREAS = new Set([WIKI_AREA_IDS.CODEX, WIKI_AREA_IDS.TIMELINE, WIKI_AREA_IDS.SESSIONS, WIKI_AREA_IDS.NEURAL_LAB]);

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
    const [searchParams, setSearchParams] = useSearchParams();
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
    /** @type {[{ articleId: string, mentionOf: string }|null, Function]} */
    const [mentionFocus, setMentionFocus] = useState(null);
    const wikiOverlay = useSelector((s) => s.ui.wikiOverlay);
    const entities = useSelector((s) => s.wiki.entities);
    const wikiStatus = useSelector((s) => s.wiki.status);
    const loadedCampaignId = useSelector((s) => s.wiki.loadedCampaignId);
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const campaignName = useSelector((s) => s.world.selectedCampaignName);
    const locations = useSelector((s) => s.world.locations);
    const charactersById = useSelector((s) => s.world.charactersById);
    const syncActive = useSelector((s) => s.wiki.syncActive);
    const relations = useSelector((s) => s.wiki.relations);
    const narrativeSettings = useSelector((s) => s.wiki.narrativeSettings);
    const wikiMinimized = useSelector((s) => s.ui.minimizedDialogs[DIALOG_IDS.WIKI]);
    const profile = useSelector((s) => s.player.profile);
    const uid = profile?.uid;

    const isDm = profile?.role === ROLES.DM;
    /** DM-only preview of the player view: local state, never written, never changes the sync query. */
    const [previewPlayer, setPreviewPlayer] = useState(false);
    const [diarySessionId, setDiarySessionId] = useState(null);
    const readOnly = !isDm || previewPlayer;

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
            dispatch(startWikiSync({ campaignId, role: isDm ? "dm" : "player" }));
        } else if (wikiStatus === "idle") {
            dispatch(fetchWikiEntities({ campaignId, role: isDm ? "dm" : "player" }));
            dispatch(fetchWikiRelations(campaignId));
        }
    }, [isActive, campaignId, wikiStatus, syncActive, isDm, dispatch]);

    // Load relations for selected entity
    useEffect(() => {
        if (isActive && campaignId && entityId) {
            dispatch(fetchEntityRelations({ campaignId, entityId }));
        }
    }, [isActive, campaignId, entityId, dispatch]);

    // Handle VTT context: resolve existing linked entity without cloning a ficha.
    useEffect(() => {
        if (!isActive || !vttContext || entities.length === 0) return;
        const { linkedVttLocationId, linkedVttCharacterId } = vttContext;
        const pin = linkedVttLocationId ? locations[linkedVttLocationId] : null;

        const linked = entities.find(
            (e) =>
                (linkedVttLocationId && wikiEntityLinksLocation(e, linkedVttLocationId)) ||
                (linkedVttCharacterId && e.linkedVttCharacterId === linkedVttCharacterId)
        ) || (pin ? findWikiLocacionForPin(pin, entities) : null);

        if (linked) {
            dispatch(setWikiOverlayEntity(linked.id));
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
        if (!isActive || isDm) return;
        if (!PLAYER_AREAS.has(effectiveAreaFilter)) {
            dispatch(setWikiOverlayAreaFilter(WIKI_AREA_IDS.CODEX));
        }
    }, [isActive, isDm, effectiveAreaFilter, dispatch]);

    useEffect(() => {
        if (!isActive) setNavReturn(null);
    }, [isActive]);

    // Apply area filter after Fuse, before rendering list
    const listableEntities = useMemo(
        () => dedupePersonajesByVttLink(entities, charactersById),
        [entities, charactersById]
    );
    const { query, setQuery, results: fuseResults, typeFilter, setTypeFilter } = useWikiSearch(listableEntities);
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
            if (!confirmLeaveEditorDraft()) return;
            setNavReturn(null);
            if (id === WIKI_AREA_IDS.NEURAL_LAB) {
                dispatch(closeNeuralLabOverlay());
                dispatch(setNeuralLabFocusEntity(null));
                dispatch(setWikiOverlayEntity(null));
            }
            dispatch(setWikiOverlayAreaFilter(id));
            if (id === WIKI_AREA_IDS.TIMELINE) {
                setTypeFilter("");
            }
            if (popupMode) {
                const next = new URLSearchParams(searchParams);
                next.set("areaFilter", id);
                setSearchParams(next, { replace: true });
            }
        },
        [dispatch, setTypeFilter, popupMode, searchParams, setSearchParams]
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
            setMentionFocus(null);
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
        (mentionId, opts) => {
            const resolved = resolveMentionClick(mentionId, { entities, locations });
            if (!resolved) return;

            if (resolved.type === "vtt-location") {
                setMentionFocus(null);
                openVttLocation(resolved.locationId, 0);
                return;
            }

            if (resolved.type === "vtt-character") {
                setMentionFocus(null);
                openVttLocation(resolved.locationId, 1);
                return;
            }

            if (resolved.type === "wiki") {
                const ent = resolved.entity;
                const targetArea = getWikiAreaForEntityType(ent.entityType);
                const areaChanging = targetArea !== effectiveAreaFilter;
                const entityChanging = ent.id !== entityId;
                if (areaChanging || entityChanging) {
                    captureNavReturn();
                }
                dispatch(setWikiOverlayAreaFilter(targetArea));
                dispatch(setWikiOverlayEntity(ent.id));
                dispatch(setWikiOverlayMode("detail"));
                const highlightOf = opts?.highlightMentionOf;
                setMentionFocus(
                    highlightOf ? { articleId: ent.id, mentionOf: highlightOf } : null
                );
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

    const handleCodexSelect = useCallback((id) => {
        setMentionFocus(null);
        dispatch(setWikiOverlayEntity(id));
    }, [dispatch]);

    const handleCodexSurface = useCallback((next) => {
        if (next?.kind === "edit") {
            dispatch(setWikiOverlayEntity(next.id));
            dispatch(setWikiOverlayMode("edit"));
            return;
        }
        if (mode === "edit") dispatch(setWikiOverlayMode(entityId ? "detail" : "list"));
        else if (mode === "create") dispatch(setWikiOverlayEntity(null));
    }, [dispatch, mode, entityId]);

    if (!popupMode && !open) return null;

    if (!popupMode && wikiMinimized) return null;

    const prefillData = {};
    if (vttContext?.linkedVttLocationId) {
        prefillData.linkedVttLocationId = vttContext.linkedVttLocationId;
        prefillData.linkedVttLocationIds = [vttContext.linkedVttLocationId];
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
    const isCodexView = effectiveAreaFilter === WIKI_AREA_IDS.CODEX;
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
        !isCodexView &&
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
                {/* ── Top Bar (mock .topnav) ── */}
                <Box sx={{ ...ARCHIVE_TOPNAV_SX, gap: "14px", pr: "8px" }}>
                    <ArchiveBrand sub={campaignName} />
                    <WikiAreaNav
                        areaFilter={areaFilter}
                        onAreaFilterChange={handleAreaFilterChange}
                        hiddenAreaIds={!isDm ? PLAYER_HIDDEN_AREAS : []}
                        showGlossaryButton={isDm}
                        onOpenGlossary={() => setGlossaryOpen(true)}
                        showConfigButton={!readOnly}
                        onOpenConfig={() => setAiConfigOpen(true)}
                    />
                    {isDm && (
                        <Box sx={ARCHIVE_TBG_SX} role="group" aria-label="Rol en la vista">
                            <button type="button" aria-pressed={!previewPlayer} onClick={() => setPreviewPlayer(false)}>DM</button>
                            <CyberTooltip title="Vista previa de jugador">
                                <button type="button" aria-pressed={previewPlayer} onClick={() => setPreviewPlayer(true)}>Jugador</button>
                            </CyberTooltip>
                        </Box>
                    )}
                    {!isDm && (
                        <Box component="span" sx={{ fontFamily: TYPO.mono, fontSize: "10.5px", color: UI_COLORS.anomaly, letterSpacing: ".08em" }}>
                            LECTURA
                        </Box>
                    )}
                    <Box sx={{ flex: 1 }} />
                    {isDm && !previewPlayer && (
                        <ArchiveLoreGear campaignId={campaignId} />
                    )}
                    {popupMode && <ArchiveExitMenu />}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0 }}>
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
                        {!popupMode && (
                            <CyberTooltip title={popupMode ? "Cerrar pestaña (Esc)" : "Cerrar archivo (Esc)"}>
                                <IconButton size="small" onClick={handleClose} sx={{ ...iconBtnSx, ml: 0.25 }}>
                                    <CloseIcon />
                                </IconButton>
                            </CyberTooltip>
                        )}
                    </Box>
                </Box>

                {((!isCodexView && !isTimelineView) || navReturn) && (
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

                    {!isNeuralLabView && !isCodexView && !isTimelineView && !isSessionsView && (
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
                )}

                {/* ── Main Panel ── */}
                <Box sx={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
                    {isTimelineView && (
                        <CampaignTimeline
                            key={campaignId}
                            campaignId={campaignId}
                            campaignName={campaignName}
                            canEdit={!readOnly}
                            playerView={!isDm || previewPlayer}
                            onOpenSession={(id) => {
                                setDiarySessionId(id);
                                dispatch(setWikiOverlayAreaFilter(WIKI_AREA_IDS.SESSIONS));
                            }}
                        />
                    )}
                    {isNeuralLabView && (
                        <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", overflow: "hidden" }}>
                            <CampaignNeuralLabOverlay
                                embedded
                                seat="mesa"
                                readOnly={!isDm || previewPlayer}
                                playerEgo={!isDm || previewPlayer}
                            />
                        </Box>
                    )}
                    {isCodexView && (
                        <CampaignCodex
                            campaignId={campaignId}
                            readOnly={readOnly}
                            previewPlayer={previewPlayer}
                            editorKey={wikiEditorKey}
                            prefillData={prefillData}
                            onCreate={handleCreateEntity}
                            onSelect={handleCodexSelect}
                            onSurface={handleCodexSurface}
                            onSaved={handleSaved}
                            onNavigateEntity={handleNavigateRelationEntity}
                            onOpenVttLocation={openVttLocation}
                            onOpenDiary={(id) => {
                                setDiarySessionId(id);
                                dispatch(setWikiOverlayAreaFilter(WIKI_AREA_IDS.SESSIONS));
                            }}
                        />
                    )}
                    {/* Left: Entity list (hidden on Timeline, Diario and NEURAL_LAB visual layouts) */}
                    {!isTimelineView && !isNeuralLabView && !isCodexView && !isSessionsView && (
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
                                        veilDmOnly={previewPlayer}
                                    />
                                </>
                            )}
                        </Box>
                    )}

                    {!isNeuralLabView && !isCodexView && !isTimelineView && (
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
                        {isSessionsView && (
                            <ArchiveDiary
                                campaignId={campaignId}
                                readOnly={readOnly}
                                focusSessionId={diarySessionId}
                                uid={uid}
                                entities={entities}
                                charactersById={charactersById}
                                onOpenEntity={handleNavigateToEntity}
                            />
                        )}

                        {!isSessionsView && activeMode === "detail" && (
                            <WikiEntityDetail
                                compact={compact}
                                entity={selectedEntity}
                                entities={entities}
                                locations={locations}
                                veilDmOnly={previewPlayer}
                                highlightMentionOf={
                                    mentionFocus?.articleId === selectedEntity?.id
                                        ? mentionFocus.mentionOf
                                        : null
                                }
                                onEntityClick={handleNavigateToEntity}
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
                        {!isTimelineView && !isSessionsView && !readOnly && (activeMode === "edit" || activeMode === "create") && (
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
                        {!isTimelineView && !isSessionsView && activeMode === "list" && !selectedEntity && (
                            <Box sx={{ p: density.emptyStatePy }}>
                                <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: density.emptyStateFontSize }}>
                                    Selecciona una ficha del listado para verla aquí.
                                </CyberText>
                            </Box>
                        )}
                    </Box>
                    )} {/* end !isNeuralLabView */}

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
