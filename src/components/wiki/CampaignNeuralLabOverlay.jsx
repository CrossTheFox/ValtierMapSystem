/**
 * Campaign Neural Lab — circuit overview (all characters) + ego focus on click.
 * DM can drag overview cards from the top handle; positions persist on the campaign.
 * Reuses DossierCircuitMap / buildCircuitLayout / WikiAiLabPanel.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Box, Dialog, DialogContent, IconButton, CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import HubIcon from "@mui/icons-material/Hub";
import { useDispatch, useSelector } from "react-redux";

import { CyberText, CyberTitle } from "../customs/CustomTexts";
import CyberTooltip from "../customs/CyberTooltip";
import { UI_COLORS } from "../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import { Z_INDEX } from "../../constants/designSystem";
import {
    closeNeuralLabOverlay,
    setNeuralLabFocusEntity,
} from "../../store/uiSlice";
import { fetchWikiEntities, fetchWikiRelations } from "../../store/wikiSlice";
import { isDmRole } from "../../utils/tokenControl";
import { buildCircuitLayout } from "../../utils/circuitLayout";
import { buildCampaignCharacterOverviewLayout } from "../../utils/campaignCircuitOverviewLayout";
import {
    buildDirectCircuitNeighbors,
    buildSecondaryCircuitNodes,
} from "../../utils/buildEgoCircuitInputs";
import { resolveWikiEntityImagePath } from "../../utils/resolveWikiEntityImage";
import {
    subscribeNeuralLabLayout,
    updateNeuralLabNodePosition,
} from "../../../firebase/services/neuralLabLayoutService";
import DossierCircuitMap from "../characters/circuit/DossierCircuitMap";
import WikiAiLabPanel from "./WikiAiLabPanel";

const ACCENT = UI_COLORS.anomaly;

export default function CampaignNeuralLabOverlay() {
    const dispatch = useDispatch();
    const open = useSelector((s) => !!s.ui.neuralLabOverlay?.open);
    const focusEntityId = useSelector((s) => s.ui.neuralLabOverlay?.focusEntityId || null);
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const charactersById = useSelector((s) => s.world.charactersById || {});
    const locations = useSelector((s) => s.world.locations || {});
    const entities = useSelector((s) => s.wiki.entities || []);
    const relations = useSelector((s) => s.wiki.relations || []);
    const wikiStatus = useSelector((s) => s.wiki.status);
    const narrativeSettings = useSelector((s) => s.wiki?.aiConfig || s.wiki?.narrativeSettings);
    const profile = useSelector((s) => s.player.profile);
    const uid = profile?.uid || null;
    const isDM = isDmRole(profile?.role);

    const [selectedId, setSelectedId] = useState(null);
    const [labOpen, setLabOpen] = useState(true);
    const [relationMode, setRelationMode] = useState("affinity");
    const [layoutMode, setLayoutMode] = useState("affinity");
    const [scope, setScope] = useState("direct");
    const [propagationState, setPropagationState] = useState(null);
    const [travelTargetId, setTravelTargetId] = useState(null);
    const [focusTravelRequest, setFocusTravelRequest] = useState(null);
    const [savedPositions, setSavedPositions] = useState({});

    useEffect(() => {
        if (!open || !campaignId) return;
        dispatch(fetchWikiEntities({ campaignId, role: "dm" }));
        dispatch(fetchWikiRelations(campaignId));
    }, [open, campaignId, dispatch]);

    useEffect(() => {
        if (!open || !campaignId) {
            setSavedPositions({});
            return undefined;
        }
        return subscribeNeuralLabLayout(campaignId, (layout) => {
            setSavedPositions(layout?.positions || {});
        });
    }, [open, campaignId]);

    useEffect(() => {
        if (!open) {
            setSelectedId(null);
            setPropagationState(null);
            setRelationMode("affinity");
            setLayoutMode("affinity");
            setScope("direct");
            setTravelTargetId(null);
            setFocusTravelRequest(null);
        }
    }, [open]);

    useEffect(() => {
        if (focusEntityId) setSelectedId(focusEntityId);
    }, [focusEntityId]);

    const graphLoading = wikiStatus === "loading" || wikiStatus === "pending";

    const entityById = useMemo(() => {
        const m = new Map();
        for (const e of entities) {
            if (e?.id) m.set(e.id, e);
        }
        return m;
    }, [entities]);

    const hubEntity = focusEntityId ? entityById.get(focusEntityId) || null : null;

    const imagePathFor = useCallback(
        (entity) => resolveWikiEntityImagePath(entity, locations, charactersById),
        [locations, charactersById],
    );

    const overviewLayout = useMemo(
        () => buildCampaignCharacterOverviewLayout({
            entities,
            charactersById,
            imagePathFor,
            positions: savedPositions,
        }),
        [entities, charactersById, imagePathFor, savedPositions],
    );

    const directNeighbors = useMemo(
        () => buildDirectCircuitNeighbors({
            hubId: focusEntityId,
            hubEntity,
            relations,
            entityById,
            charactersById,
            locations,
        }),
        [focusEntityId, hubEntity, relations, entityById, charactersById, locations],
    );

    const secondaryNodes = useMemo(() => {
        if (!focusEntityId || layoutMode === "structural" || scope === "direct") return [];
        return buildSecondaryCircuitNodes({
            hubId: focusEntityId,
            entities,
            relations,
            entityById,
            directNeighbors,
            charactersById,
            locations,
            scope,
        });
    }, [
        focusEntityId, layoutMode, scope, entities, relations,
        entityById, directNeighbors, charactersById, locations,
    ]);

    const focusedLayout = useMemo(() => {
        if (!focusEntityId || !hubEntity) {
            return { nodes: [], edges: [], hubId: null };
        }
        const structuralOnly = layoutMode === "structural";
        const raw = buildCircuitLayout({
            hub: { id: focusEntityId, title: hubEntity.title || "—" },
            affinityNodes: structuralOnly ? [] : directNeighbors.affinity,
            structuralNodes: structuralOnly ? directNeighbors.structural : [],
            secondaryNodes: structuralOnly ? [] : secondaryNodes,
            expandedClusterId: null,
            showStructuralBus: false,
        });
        const linkedChar = hubEntity.linkedVttCharacterId
            ? (charactersById[hubEntity.linkedVttCharacterId] || null)
            : null;
        const imagePath = resolveWikiEntityImagePath(hubEntity, locations, charactersById);
        return {
            ...raw,
            nodes: (raw.nodes || []).map((n) => {
                if (n.kind !== "hub") return n;
                return {
                    ...n,
                    imagePath,
                    avatarStatus: linkedChar?.status || "alive",
                    avatarCrop: linkedChar?.tokenCrop || null,
                };
            }),
        };
    }, [
        focusEntityId, hubEntity, layoutMode, directNeighbors,
        secondaryNodes, charactersById, locations,
    ]);

    const layout = focusEntityId ? focusedLayout : overviewLayout;
    const canDragNodes = Boolean(isDM && !focusEntityId);

    const handleClose = () => dispatch(closeNeuralLabOverlay());

    const handleSelectNode = useCallback((node) => {
        if (!node?.entityId && !node?.id) {
            setSelectedId(null);
            return;
        }
        const id = node.entityId || node.id;
        setSelectedId(id);
        if (!focusEntityId) {
            dispatch(setNeuralLabFocusEntity(id));
            return;
        }
        if (id !== focusEntityId && node.kind !== "hub") {
            setTravelTargetId(id);
            setFocusTravelRequest({ entityId: id, nonce: Date.now() });
        }
    }, [dispatch, focusEntityId]);

    const handleFocusTravelComplete = useCallback(() => {
        if (travelTargetId) {
            dispatch(setNeuralLabFocusEntity(travelTargetId));
        }
        setTravelTargetId(null);
        setFocusTravelRequest(null);
    }, [dispatch, travelTargetId]);

    const clearFocus = useCallback(() => {
        dispatch(setNeuralLabFocusEntity(null));
        setSelectedId(null);
        setPropagationState(null);
        setScope("direct");
        setLayoutMode("affinity");
        setRelationMode("affinity");
    }, [dispatch]);

    const toggleStruct = useCallback(() => {
        const next = relationMode === "affinity" ? "structural" : "affinity";
        setRelationMode(next);
        setLayoutMode(next);
        if (next === "structural") setScope("direct");
    }, [relationMode]);

    const handleNodePositionPreview = useCallback((entityId, pos) => {
        if (!entityId || !pos) return;
        setSavedPositions((prev) => ({
            ...prev,
            [entityId]: { x: pos.x, y: pos.y },
        }));
    }, []);

    const handleNodePositionCommit = useCallback(async (entityId, pos) => {
        if (!entityId || !pos || !campaignId) return;
        setSavedPositions((prev) => ({
            ...prev,
            [entityId]: { x: pos.x, y: pos.y },
        }));
        try {
            await updateNeuralLabNodePosition(campaignId, entityId, pos, uid);
        } catch (err) {
            console.warn("[NeuralLab] failed to persist card position", err);
        }
    }, [campaignId, uid]);

    if (!open) return null;

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            fullScreen
            maxWidth={false}
            slotProps={{
                paper: {
                    sx: {
                        bgcolor: UI_COLORS.backgroundPrimary,
                        backgroundImage: "none",
                        m: 0,
                        borderRadius: 0,
                    },
                },
            }}
            sx={{ zIndex: Z_INDEX.wikiOverlay }}
        >
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    px: 1.5,
                    py: 0.85,
                    borderBottom: `1px solid ${UI_COLORS.border}`,
                    bgcolor: "rgba(10,10,16,0.95)",
                }}
            >
                <HubIcon sx={{ fontSize: "1.1rem", color: ACCENT }} />
                <CyberTitle sx={{ fontSize: "0.72rem", letterSpacing: "0.16em", color: ACCENT, flex: 1 }}>
                    NEURAL_LAB
                </CyberTitle>
                <CyberText sx={{ fontSize: "0.58rem", color: UI_COLORS.textSecondary, mr: 1 }}>
                    {focusEntityId
                        ? `Foco · ${(hubEntity?.title || focusEntityId).toUpperCase()}`
                        : `Overview · ${overviewLayout.nodes.length} personajes`}
                </CyberText>
                {focusEntityId && (
                    <CyberTooltip title="Volver al overview">
                        <Box
                            component="button"
                            type="button"
                            onClick={clearFocus}
                            sx={{
                                border: `1px solid ${UI_COLORS.border}`,
                                bgcolor: "transparent",
                                color: UI_COLORS.textSecondary,
                                fontFamily: '"Orbitron", sans-serif',
                                fontSize: "0.48rem",
                                letterSpacing: "0.1em",
                                px: 1,
                                py: 0.45,
                                borderRadius: "4px",
                                cursor: "pointer",
                                "&:hover": { borderColor: ACCENT, color: ACCENT },
                            }}
                        >
                            OVERVIEW
                        </Box>
                    </CyberTooltip>
                )}
                <CyberTooltip title={labOpen ? "Ocultar LAB_IA" : "Mostrar LAB_IA"}>
                    <Box
                        component="button"
                        type="button"
                        onClick={() => setLabOpen((v) => !v)}
                        sx={{
                            border: `1px solid ${labOpen ? `${ACCENT}66` : UI_COLORS.border}`,
                            bgcolor: labOpen ? `${ACCENT}14` : "transparent",
                            color: labOpen ? ACCENT : UI_COLORS.textSecondary,
                            fontFamily: '"Orbitron", sans-serif',
                            fontSize: "0.48rem",
                            letterSpacing: "0.1em",
                            px: 1,
                            py: 0.45,
                            borderRadius: "4px",
                            cursor: "pointer",
                        }}
                    >
                        LAB_IA
                    </Box>
                </CyberTooltip>
                <IconButton size="small" onClick={handleClose} sx={{ color: UI_COLORS.textSecondary }}>
                    <CloseIcon sx={{ fontSize: "1.15rem" }} />
                </IconButton>
            </Box>

            <DialogContent
                sx={{
                    p: 0,
                    display: "flex",
                    flexDirection: "row",
                    height: "calc(100vh - 48px)",
                    overflow: "hidden",
                    bgcolor: UI_COLORS.backgroundPrimary,
                }}
            >
                <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, position: "relative" }}>
                    {graphLoading && entities.length === 0 ? (
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                            <CircularProgress size={28} sx={{ color: ACCENT }} />
                        </Box>
                    ) : (
                        <DossierCircuitMap
                            layout={layout}
                            selectedId={selectedId}
                            onSelectNode={handleSelectNode}
                            propagationState={propagationState}
                            recenterKey={focusEntityId || "overview"}
                            graphLoading={graphLoading}
                            canFocusTravel={Boolean(focusEntityId)}
                            canToggleStruct={Boolean(focusEntityId)}
                            relationMode={relationMode}
                            travelTargetId={travelTargetId}
                            focusTravelRequest={focusTravelRequest}
                            onFocusTravelComplete={handleFocusTravelComplete}
                            canDragNodes={canDragNodes}
                            onNodePositionPreview={canDragNodes ? handleNodePositionPreview : undefined}
                            onNodePositionCommit={canDragNodes ? handleNodePositionCommit : undefined}
                            onFocusEntity={(id) => {
                                if (!id) return;
                                if (!focusEntityId) {
                                    dispatch(setNeuralLabFocusEntity(id));
                                    return;
                                }
                                setTravelTargetId(id);
                                setFocusTravelRequest({ entityId: id, nonce: Date.now() });
                            }}
                            onToggleStruct={toggleStruct}
                            topLeftSlot={
                                focusEntityId ? (
                                    <Box sx={{ display: "flex", gap: 0.5 }}>
                                        {["direct", "ego"].map((s) => (
                                            <Box
                                                key={s}
                                                component="button"
                                                type="button"
                                                onClick={() => setScope(s)}
                                                sx={{
                                                    border: `1px solid ${scope === s ? ACCENT : UI_COLORS.border}`,
                                                    bgcolor: scope === s ? `${ACCENT}18` : "rgba(10,10,20,0.85)",
                                                    color: scope === s ? ACCENT : UI_COLORS.textSecondary,
                                                    fontFamily: '"Fira Code", monospace',
                                                    fontSize: "0.5rem",
                                                    px: 0.75,
                                                    py: 0.35,
                                                    borderRadius: "3px",
                                                    cursor: "pointer",
                                                }}
                                            >
                                                {s.toUpperCase()}
                                            </Box>
                                        ))}
                                    </Box>
                                ) : (
                                    <CyberText sx={{ fontSize: "0.58rem", color: UI_COLORS.textSecondary }}>
                                        {isDM
                                            ? "Arrastra desde la cabecera del card · click para centrar"
                                            : "Click un personaje para centrar el circuito"}
                                    </CyberText>
                                )
                            }
                        />
                    )}
                </Box>

                {labOpen && (
                    <Box
                        sx={{
                            width: 380,
                            flexShrink: 0,
                            borderLeft: `1px solid ${UI_COLORS.border}`,
                            bgcolor: "rgba(8,8,14,0.96)",
                            overflow: "auto",
                            ...CYBER_SCROLL_STYLE,
                        }}
                    >
                        <WikiAiLabPanel
                            campaignId={campaignId}
                            selectedEntity={hubEntity || (selectedId ? entityById.get(selectedId) : null)}
                            entities={entities}
                            relations={relations}
                            narrativeSettings={narrativeSettings}
                            onPropagationStart={(state) => setPropagationState(state)}
                            onPropagationEnd={() => setPropagationState(null)}
                            cascadePresentation="queue"
                        />
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
}
