/**
 * NAR RED — Circuit Sync-Axis map (Option 8) + floating Personalidad / Hechos / Lab IA.
 * Replaces Pixi WikiGraphCanvas in the dossier RED tab only.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useSelector } from "react-redux";

import { CyberText, CyberTitle } from "../customs/CustomTexts";
import CyberTooltip from "../customs/CyberTooltip";
import { UI_COLORS } from "../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import {
    buildDirectCircuitNeighbors,
    buildSecondaryCircuitNodes,
    EGO_CIRCUIT_HOPS,
} from "../../utils/buildEgoCircuitInputs";
import { resolveWikiEntityImagePath } from "../../utils/resolveWikiEntityImage";
import { buildCircuitLayout } from "../../utils/circuitLayout";
import { WIKI_ENTITY_TYPES } from "../../constants/wikiEntityTypes";
import WikiAiLabPanel from "../wiki/WikiAiLabPanel";
import CascadeImpactPopover, {
    findCascadeImpactByEntityId,
} from "../wiki/CascadeImpactPopover";
import { buildSealGradeFromCascadeResult } from "../../utils/impactSealGrade";
import DossierPersonalityPanel from "./DossierPersonalityPanel";
import DossierStructuralFacts from "./DossierStructuralFacts";
import DossierCircuitMap from "./circuit/DossierCircuitMap";

const NAR_ACCENT = UI_COLORS.accentStrong;
const EGO_HOPS = EGO_CIRCUIT_HOPS;
const MODE_ANIM_MS = 220;
const MODE_ENTER_MS = 260;

/**
 * @param {{
 *   anchorEntity: object|null,
 *   entities?: object[],
 *   relations?: object[],
 *   graphLoading?: boolean,
 *   campaignId?: string,
 *   narrativeSettings?: object,
 *   showLab?: boolean,
 *   ficha?: object,
 *   patchFicha?: (p: object) => void,
 *   addTrait?: (t: string) => void,
 *   removeTrait?: (i: number) => void,
 *   flushSave?: () => void,
 *   canEditStructural?: boolean,
 * }} props
 */
export default function DossierNeuralMap({
    anchorEntity,
    entities = [],
    relations = [],
    graphLoading = false,
    campaignId,
    narrativeSettings,
    showLab = false,
    ficha,
    patchFicha,
    addTrait,
    removeTrait,
    flushSave,
    canEditStructural = false,
}) {
    const anchorId = anchorEntity?.id || null;
    const charactersById = useSelector((s) => s.world.charactersById || {});
    const locations = useSelector((s) => s.world?.locations || {});

    const [selectedId, setSelectedId] = useState(anchorId);
    const [labOpen, setLabOpen] = useState(false);
    const [personalityOpen, setPersonalityOpen] = useState(false);
    const [hechosOpen, setHechosOpen] = useState(false);
    const [scope, setScope] = useState("direct"); // direct | ego | full — players stay direct
    const [expandedClusterId, setExpandedClusterId] = useState(null);
    const [propagationState, setPropagationState] = useState(null);
    /** DM temporary hub in RED (null = dossier anchor). */
    const [focusEntityId, setFocusEntityId] = useState(null);
    const [relationMode, setRelationMode] = useState("affinity"); // affinity | structural
    /** During mode switch: keep previous mode for exit anim, then flip. */
    const [layoutMode, setLayoutMode] = useState("affinity");
    const [animPhase, setAnimPhase] = useState(null); // 'out' | 'in' | null
    /** DM focus travel: pan camera to node before swapping hub. */
    const [travelTargetId, setTravelTargetId] = useState(null);
    const [focusTravelRequest, setFocusTravelRequest] = useState(null);
    const pendingFocusIdRef = useRef(null);
    const mapHostRef = useRef(null);
    /** Full cascade payload for Option 1 popover (DM RED only). */
    const [cascadeResult, setCascadeResult] = useState(null);
    const [impactPopover, setImpactPopover] = useState({
        entityId: null,
        anchorEl: null,
    });
    const [pendingReviewEntityId, setPendingReviewEntityId] = useState(null);
    const [pendingReviewNonce, setPendingReviewNonce] = useState(null);

    const viewHubId = (showLab && focusEntityId) ? focusEntityId : anchorId;

    const entityById = useMemo(() => {
        const m = new Map();
        for (const e of entities || []) {
            if (e?.id) m.set(e.id, e);
        }
        if (anchorEntity?.id) m.set(anchorEntity.id, anchorEntity);
        return m;
    }, [entities, anchorEntity]);

    const viewHubEntity = useMemo(() => {
        if (!viewHubId) return null;
        if (viewHubId === anchorId) return anchorEntity;
        return entityById.get(viewHubId) || anchorEntity;
    }, [viewHubId, anchorId, anchorEntity, entityById]);

    useEffect(() => {
        setSelectedId(anchorId);
        setPropagationState(null);
        setCascadeResult(null);
        setImpactPopover({ entityId: null, anchorEl: null });
        setPendingReviewEntityId(null);
        setPendingReviewNonce(null);
        setExpandedClusterId(null);
        setFocusEntityId(null);
        setRelationMode("affinity");
        setLayoutMode("affinity");
        setAnimPhase(null);
        setTravelTargetId(null);
        setFocusTravelRequest(null);
        pendingFocusIdRef.current = null;
    }, [anchorId]);

    useEffect(() => {
        if (!viewHubId) return;
        setSelectedId(viewHubId);
        setExpandedClusterId(null);
        setPropagationState(null);
    }, [viewHubId]);

    const directNeighbors = useMemo(
        () => buildDirectCircuitNeighbors({
            hubId: viewHubId,
            hubEntity: viewHubEntity,
            relations,
            entityById,
            charactersById,
            locations,
        }),
        [viewHubId, viewHubEntity, relations, entityById, charactersById, locations],
    );

    const secondaryNodes = useMemo(() => {
        if (!showLab || scope === "direct" || !viewHubId || layoutMode === "structural") return [];
        return buildSecondaryCircuitNodes({
            hubId: viewHubId,
            entities,
            relations,
            entityById,
            directNeighbors,
            charactersById,
            locations,
            scope,
        });
    }, [
        showLab,
        scope,
        viewHubId,
        layoutMode,
        entities,
        relations,
        directNeighbors,
        entityById,
        charactersById,
        locations,
    ]);

    const layout = useMemo(() => {
        if (!viewHubId) {
            return { nodes: [], edges: [], hubId: "" };
        }
        const structuralOnly = layoutMode === "structural";
        return buildCircuitLayout({
            hub: { id: viewHubId, title: viewHubEntity?.title || "—" },
            affinityNodes: structuralOnly ? [] : directNeighbors.affinity,
            structuralNodes: structuralOnly ? directNeighbors.structural : [],
            secondaryNodes: structuralOnly ? [] : (showLab ? secondaryNodes : []),
            expandedClusterId,
            showStructuralBus: false,
        });
    }, [
        viewHubId,
        viewHubEntity,
        directNeighbors,
        secondaryNodes,
        expandedClusterId,
        showLab,
        layoutMode,
    ]);

    // Hub node needs avatar from focused entity
    const layoutWithHubAvatar = useMemo(() => {
        if (!layout.nodes?.length) return layout;
        const hubEnt = viewHubEntity;
        const linkedChar = hubEnt?.linkedVttCharacterId
            ? (charactersById[hubEnt.linkedVttCharacterId] || null)
            : null;
        const imagePath = resolveWikiEntityImagePath(hubEnt, locations, charactersById);
        return {
            ...layout,
            nodes: layout.nodes.map((n) => {
                if (n.kind === "hub") {
                    return {
                        ...n,
                        entityType: hubEnt?.entityType || WIKI_ENTITY_TYPES.PERSONAJE,
                        imagePath,
                        avatarStatus: linkedChar?.status || "alive",
                        avatarCrop: linkedChar?.tokenCrop || null,
                    };
                }
                if (n.entityType) return n;
                const ent = entityById.get(n.entityId || n.id);
                return ent ? { ...n, entityType: ent.entityType } : n;
            }),
        };
    }, [layout, viewHubEntity, charactersById, locations, entityById]);

    const resolveNodeAnchorEl = useCallback((entityId) => {
        if (!entityId || !mapHostRef.current) return null;
        try {
            return mapHostRef.current.querySelector(
                `[data-ckt-eid="${CSS.escape(entityId)}"]`,
            );
        } catch {
            return mapHostRef.current.querySelector(`[data-ckt-eid="${entityId}"]`);
        }
    }, []);

    const openImpactInspector = useCallback((entityId) => {
        if (!showLab || !entityId || !cascadeResult) return;
        const impact = findCascadeImpactByEntityId(cascadeResult, entityId);
        if (!impact) {
            setImpactPopover({ entityId: null, anchorEl: null });
            return;
        }
        const node = layoutWithHubAvatar.nodes.find(
            (n) => n.entityId === entityId || n.id === entityId,
        );
        if (node) setSelectedId(node.id);
        // Keep hub selected when impact is off-map (e.g. onda 2+) so LAB anchor stays stable.
        // Anchor after paint — node may just have been selected / un-dimmed.
        requestAnimationFrame(() => {
            const nodeEl = resolveNodeAnchorEl(entityId);
            const anchorEl = nodeEl || mapHostRef.current;
            setImpactPopover({ entityId, anchorEl });
        });
    }, [showLab, cascadeResult, layoutWithHubAvatar.nodes, resolveNodeAnchorEl]);

    const closeImpactInspector = useCallback(() => {
        setImpactPopover({ entityId: null, anchorEl: null });
    }, []);

    const handleFocusImpactFromQueue = useCallback((entityId) => {
        if (!labOpen) setLabOpen(true);
        openImpactInspector(entityId);
    }, [labOpen, openImpactInspector]);

    const handleRequestImpactReview = useCallback((impact) => {
        const entityId = impact?.entityId || impact?.entityResolved?.id;
        if (!entityId) return;
        if (!labOpen) setLabOpen(true);
        setPendingReviewEntityId(entityId);
        setPendingReviewNonce(Date.now());
        closeImpactInspector();
    }, [labOpen, closeImpactInspector]);

    const handleSelectNode = useCallback((node) => {
        if (!node) {
            setSelectedId(viewHubId);
            closeImpactInspector();
            return;
        }
        if (node.kind === "cluster") {
            setExpandedClusterId((prev) => (prev === node.id ? null : node.id));
            setSelectedId(viewHubId);
            closeImpactInspector();
            return;
        }
        setSelectedId(node.id);
        const eid = node.entityId || node.id;
        if (showLab && cascadeResult) {
            const impact = findCascadeImpactByEntityId(cascadeResult, eid);
            if (impact) {
                const anchorEl = resolveNodeAnchorEl(eid) || mapHostRef.current;
                setImpactPopover({ entityId: eid, anchorEl });
                return;
            }
        }
        closeImpactInspector();
    }, [
        viewHubId,
        showLab,
        cascadeResult,
        resolveNodeAnchorEl,
        closeImpactInspector,
    ]);

    const commitFocusHub = useCallback((entityId) => {
        setFocusEntityId(entityId && entityId !== anchorId ? entityId : null);
        setRelationMode("affinity");
        setLayoutMode("affinity");
        setTravelTargetId(null);
        setFocusTravelRequest(null);
        pendingFocusIdRef.current = null;
        setAnimPhase("in");
        window.setTimeout(() => setAnimPhase(null), MODE_ENTER_MS);
    }, [anchorId]);

    const handleFocusTravelComplete = useCallback(() => {
        const id = pendingFocusIdRef.current;
        if (!id) {
            setAnimPhase(null);
            setTravelTargetId(null);
            setFocusTravelRequest(null);
            return;
        }
        commitFocusHub(id);
    }, [commitFocusHub]);

    const handleFocusEntity = useCallback((entityId) => {
        if (!showLab || !entityId || entityId === viewHubId || animPhase || focusTravelRequest) return;
        pendingFocusIdRef.current = entityId;
        setTravelTargetId(entityId);
        setAnimPhase("out");
        setFocusTravelRequest({ entityId, nonce: Date.now() });
    }, [showLab, viewHubId, animPhase, focusTravelRequest]);

    const handleClearFocus = useCallback(() => {
        if (!showLab || animPhase || focusTravelRequest) return;
        if (!focusEntityId || !anchorId) return;
        pendingFocusIdRef.current = anchorId;
        setTravelTargetId(anchorId);
        setAnimPhase("out");
        setFocusTravelRequest({ entityId: anchorId, nonce: Date.now() });
    }, [showLab, animPhase, focusTravelRequest, focusEntityId, anchorId]);

    const handleToggleStruct = useCallback(() => {
        if (!showLab || animPhase || focusTravelRequest) return;
        const next = relationMode === "affinity" ? "structural" : "affinity";
        setAnimPhase("out");
        window.setTimeout(() => {
            setRelationMode(next);
            setLayoutMode(next);
            if (next === "structural") setScope("direct");
            setAnimPhase("in");
            window.setTimeout(() => setAnimPhase(null), MODE_ENTER_MS);
        }, MODE_ANIM_MS);
    }, [showLab, animPhase, focusTravelRequest, relationMode]);

    const handlePropagationStart = useCallback((waves, opts = {}) => {
        if (!waves?.length) return;
        const litNodeIds = [...new Set(waves[0]?.nodeIds ?? [])];
        const wavesKey = waves
            .map((w) => `${w.wave ?? ""}:${(w.nodeIds ?? []).join(",")}`)
            .join("|");

        if (opts?.preview) {
            setPropagationState((prev) => {
                // Keep seal-grade result chrome while DM inspects / edits instruction.
                if (prev?.mode === "result") return prev;
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
            setCascadeResult(null);
            setImpactPopover({ entityId: null, anchorEl: null });
            setPropagationState({
                mode: "live",
                active: true,
                currentWave: 0,
                waves,
                litNodeIds,
            });
        }
    }, []);

    const handlePropagationEnd = useCallback(() => {
        setPropagationState(null);
        setCascadeResult(null);
        setImpactPopover({ entityId: null, anchorEl: null });
    }, []);

    const handlePropagationResult = useCallback((validated) => {
        if (!validated) {
            setCascadeResult(null);
            setImpactPopover({ entityId: null, anchorEl: null });
            setPropagationState((prev) => {
                if (prev?.mode === "result") return null;
                return prev;
            });
            return;
        }
        setCascadeResult(validated);
        const seal = buildSealGradeFromCascadeResult(validated);
        setPropagationState((prev) => ({
            mode: "result",
            active: false,
            waves: prev?.waves ?? [],
            litNodeIds: [],
            seal,
            sealNonce: Date.now(),
        }));
    }, []);

    const labAnchor = viewHubEntity;

    const overlayBtnSx = (active, accent = NAR_ACCENT) => ({
        border: active ? `1px solid ${accent}` : `1px solid ${UI_COLORS.border}`,
        bgcolor: active ? `${accent}22` : "rgba(10,10,20,0.88)",
        color: active ? UI_COLORS.textPrimary : UI_COLORS.textSecondary,
        fontFamily: '"Orbitron", sans-serif',
        fontSize: "0.45rem",
        letterSpacing: "0.1em",
        px: 1,
        py: 0.7,
        borderRadius: "4px",
        cursor: "pointer",
        backdropFilter: "blur(10px)",
        "&:hover": {
            borderColor: accent,
            color: UI_COLORS.textPrimary,
        },
    });

    const floatingPanelSx = (accent) => ({
        position: "absolute",
        top: 52,
        left: 12,
        zIndex: 20,
        width: { xs: "min(360px, calc(100% - 24px))", sm: 360 },
        maxHeight: "min(520px, calc(100% - 72px))",
        display: "flex",
        flexDirection: "column",
        bgcolor: "rgba(10,10,20,0.94)",
        border: `1px solid ${accent}66`,
        borderRadius: "8px",
        boxShadow: `0 0 28px ${accent}33, 0 16px 40px rgba(0,0,0,0.55)`,
        backdropFilter: "blur(16px)",
        overflow: "hidden",
    });

    useEffect(() => {
        if (!personalityOpen && !hechosOpen && !labOpen) return undefined;
        const onKey = (e) => {
            if (e.key === "Escape") {
                setPersonalityOpen(false);
                setHechosOpen(false);
                setLabOpen(false);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [personalityOpen, hechosOpen, labOpen]);

    return (
        <Box
            ref={mapHostRef}
            sx={{
                height: "100%",
                minHeight: { xs: 420, md: 0 },
                position: "relative",
                border: `1px solid ${UI_COLORS.anomaly}44`,
                borderRadius: "6px",
                overflow: "hidden",
                bgcolor: "#07070c",
            }}
        >
            <DossierCircuitMap
                layout={layoutWithHubAvatar}
                selectedId={selectedId || viewHubId}
                onSelectNode={handleSelectNode}
                propagationState={propagationState}
                showStructuralBus={false}
                recenterKey={viewHubId}
                graphLoading={graphLoading}
                canFocusTravel={Boolean(showLab)}
                canToggleStruct={Boolean(showLab)}
                relationMode={relationMode}
                animPhase={animPhase}
                travelTargetId={travelTargetId}
                focusTravelRequest={focusTravelRequest}
                onFocusTravelComplete={handleFocusTravelComplete}
                onFocusEntity={handleFocusEntity}
                onToggleStruct={handleToggleStruct}
                topLeftSlot={(
                    <Box sx={{ display: "flex", gap: 0.6, flexWrap: "wrap", alignItems: "center" }}>
                        <Box
                            component="button"
                            type="button"
                            onClick={() => {
                                setPersonalityOpen((v) => !v);
                                if (!personalityOpen) setHechosOpen(false);
                            }}
                            sx={overlayBtnSx(personalityOpen, NAR_ACCENT)}
                        >
                            PERSONALIDAD
                        </Box>
                        <Box
                            component="button"
                            type="button"
                            onClick={() => {
                                setHechosOpen((v) => !v);
                                if (!hechosOpen) setPersonalityOpen(false);
                            }}
                            sx={overlayBtnSx(hechosOpen, UI_COLORS.anomaly)}
                        >
                            HECHOS
                        </Box>
                        {showLab && focusEntityId && (
                            <>
                                <Box
                                    sx={{
                                        fontFamily: '"Orbitron", sans-serif',
                                        fontSize: "0.42rem",
                                        letterSpacing: "0.08em",
                                        color: UI_COLORS.anomaly,
                                        border: `1px solid ${UI_COLORS.anomaly}66`,
                                        bgcolor: "rgba(10,10,20,0.88)",
                                        px: 0.85,
                                        py: 0.55,
                                        borderRadius: "3px",
                                    }}
                                >
                                    FOCO · {(viewHubEntity?.title || "—").toUpperCase()}
                                </Box>
                                <Box
                                    component="button"
                                    type="button"
                                    onClick={handleClearFocus}
                                    sx={overlayBtnSx(false, UI_COLORS.anomaly)}
                                >
                                    VOLVER
                                </Box>
                            </>
                        )}
                    </Box>
                )}
                topRightSlot={showLab ? (
                    <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                        {[
                            { id: "direct", label: "DIRECTA" },
                            { id: "ego", label: `ÓRBITA ${EGO_HOPS}` },
                            { id: "full", label: "COMPLETA" },
                        ].map((chip) => {
                            const on = scope === chip.id;
                            const structBlocksOrbit = relationMode === "structural" && chip.id !== "direct";
                            return (
                                <CyberTooltip
                                    key={chip.id}
                                    title={structBlocksOrbit
                                        ? "Órbitas solo usan afinidad. Los hechos estructurales no cuentan para la profundidad."
                                        : chip.id === "ego"
                                            ? "Órbita por afinidad (sin hechos estructurales)"
                                            : chip.id === "full"
                                                ? "Grafo completo por afinidad (sin hechos estructurales)"
                                                : "Solo vecinos directos"}
                                >
                                    <Box
                                        component="button"
                                        type="button"
                                        disabled={structBlocksOrbit}
                                        onClick={() => {
                                            if (structBlocksOrbit) return;
                                            setScope(chip.id);
                                        }}
                                        sx={{
                                            border: on
                                                ? `1px solid ${UI_COLORS.anomaly}99`
                                                : `1px solid ${UI_COLORS.border}`,
                                            bgcolor: on ? `${UI_COLORS.anomaly}18` : "rgba(10,10,20,0.88)",
                                            color: structBlocksOrbit
                                                ? `${UI_COLORS.textSecondary}66`
                                                : on ? UI_COLORS.textPrimary : UI_COLORS.textSecondary,
                                            fontFamily: '"Orbitron", sans-serif',
                                            fontSize: "0.42rem",
                                            letterSpacing: "0.08em",
                                            px: 0.7,
                                            py: 0.55,
                                            borderRadius: "3px",
                                            cursor: structBlocksOrbit ? "not-allowed" : "pointer",
                                            opacity: structBlocksOrbit ? 0.45 : 1,
                                        }}
                                    >
                                        {chip.label}
                                    </Box>
                                </CyberTooltip>
                            );
                        })}
                        {relationMode === "structural" && (
                            <CyberTooltip title="Hechos estructurales: no generan impactos de IA ni profundizan órbitas.">
                                <Box
                                    sx={{
                                        fontFamily: '"Share Tech Mono", monospace',
                                        fontSize: "0.42rem",
                                        letterSpacing: "0.04em",
                                        color: "#ffaa00",
                                        border: "1px solid rgba(255,170,0,0.55)",
                                        bgcolor: "rgba(255,170,0,0.1)",
                                        px: 0.75,
                                        py: 0.5,
                                        borderRadius: "3px",
                                        textTransform: "uppercase",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    sin impacto · sin órbita
                                </Box>
                            </CyberTooltip>
                        )}
                        <CyberTooltip title={labOpen ? "Cerrar LAB IA" : "Abrir LAB IA"}>
                            <Box
                                component="button"
                                type="button"
                                onClick={() => setLabOpen((v) => !v)}
                                sx={overlayBtnSx(labOpen, NAR_ACCENT)}
                            >
                                LAB IA
                            </Box>
                        </CyberTooltip>
                    </Box>
                ) : null}
            />

            {/* Backdrop for floating panels */}
            {(personalityOpen || hechosOpen) && (
                <Box
                    data-ckt-overlay
                    onClick={() => {
                        setPersonalityOpen(false);
                        setHechosOpen(false);
                    }}
                    sx={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 18,
                        bgcolor: "rgba(0,0,0,0.35)",
                    }}
                />
            )}

            {personalityOpen && ficha && patchFicha && (
                <Box data-ckt-overlay sx={floatingPanelSx(NAR_ACCENT)}>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            px: 1.25,
                            py: 0.75,
                            borderBottom: `1px solid ${NAR_ACCENT}44`,
                            flexShrink: 0,
                        }}
                    >
                        <CyberTitle sx={{ fontSize: "0.58rem", letterSpacing: "0.14em", color: NAR_ACCENT }}>
                            PERSONALIDAD IA
                        </CyberTitle>
                        <IconButton
                            size="small"
                            onClick={() => setPersonalityOpen(false)}
                            sx={{ color: UI_COLORS.textSecondary }}
                        >
                            <CloseIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                    </Box>
                    <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", p: 1.25, ...CYBER_SCROLL_STYLE }}>
                        <DossierPersonalityPanel
                            ficha={ficha}
                            patchFicha={patchFicha}
                            addTrait={addTrait}
                            removeTrait={removeTrait}
                            flushSave={flushSave}
                        />
                    </Box>
                </Box>
            )}

            {hechosOpen && anchorId && (
                <Box data-ckt-overlay sx={floatingPanelSx(UI_COLORS.anomaly)}>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            px: 1.25,
                            py: 0.75,
                            borderBottom: `1px solid ${UI_COLORS.anomaly}44`,
                            flexShrink: 0,
                        }}
                    >
                        <CyberTitle sx={{ fontSize: "0.58rem", letterSpacing: "0.14em", color: UI_COLORS.anomaly }}>
                            HECHOS ESTRUCTURALES
                        </CyberTitle>
                        <IconButton
                            size="small"
                            onClick={() => setHechosOpen(false)}
                            sx={{ color: UI_COLORS.textSecondary }}
                        >
                            <CloseIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                    </Box>
                    <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", p: 1.25, ...CYBER_SCROLL_STYLE }}>
                        <DossierStructuralFacts
                            entityId={anchorId}
                            campaignId={campaignId}
                            canEdit={canEditStructural}
                        />
                    </Box>
                </Box>
            )}

            {/* Lab IA overlay — above viewport, does not shrink map */}
            {showLab && labOpen && (
                <Box
                    data-ckt-overlay
                    sx={{
                        position: "absolute",
                        top: 48,
                        right: 12,
                        bottom: 12,
                        zIndex: 22,
                        width: { xs: "min(100% - 24px, 420px)", md: "min(420px, 42%)" },
                        display: "flex",
                        flexDirection: "column",
                        bgcolor: "rgba(8,8,14,0.96)",
                        border: `1px solid ${NAR_ACCENT}66`,
                        borderRadius: "8px",
                        boxShadow: `0 0 32px ${NAR_ACCENT}28, 0 20px 48px rgba(0,0,0,0.6)`,
                        backdropFilter: "blur(16px)",
                        overflow: "hidden",
                    }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            px: 1.25,
                            py: 0.75,
                            borderBottom: `1px solid ${UI_COLORS.border}`,
                            flexShrink: 0,
                        }}
                    >
                        <CyberTitle sx={{ fontSize: "0.58rem", letterSpacing: "0.12em", color: NAR_ACCENT }}>
                            LAB IA · {labAnchor?.title || "—"}
                        </CyberTitle>
                        <IconButton
                            size="small"
                            onClick={() => setLabOpen(false)}
                            sx={{ color: UI_COLORS.textSecondary }}
                        >
                            <CloseIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                    </Box>
                    <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", ...CYBER_SCROLL_STYLE }}>
                        <WikiAiLabPanel
                            selectedEntity={labAnchor}
                            entities={entities}
                            relations={relations}
                            campaignId={campaignId}
                            narrativeSettings={narrativeSettings}
                            onPropagationStart={handlePropagationStart}
                            onPropagationEnd={handlePropagationEnd}
                            onPropagationResult={handlePropagationResult}
                            cascadePresentation="queue"
                            onFocusImpact={handleFocusImpactFromQueue}
                            focusedImpactEntityId={impactPopover.entityId}
                            pendingReviewEntityId={pendingReviewEntityId}
                            pendingReviewNonce={pendingReviewNonce}
                        />
                    </Box>
                </Box>
            )}

            {showLab && (
                <CascadeImpactPopover
                    open={Boolean(impactPopover.entityId && impactPopover.anchorEl)}
                    anchorEl={impactPopover.anchorEl}
                    impact={findCascadeImpactByEntityId(cascadeResult, impactPopover.entityId)}
                    relations={relations}
                    onClose={closeImpactInspector}
                    onReview={handleRequestImpactReview}
                />
            )}

            {!anchorId && (
                <Box
                    sx={{
                        position: "absolute",
                        inset: 0,
                        display: "grid",
                        placeItems: "center",
                        bgcolor: "rgba(7,7,12,0.85)",
                        zIndex: 5,
                    }}
                >
                    <CyberText sx={{ color: UI_COLORS.textSecondary }}>Sin entidad narrativa</CyberText>
                </Box>
            )}
        </Box>
    );
}
