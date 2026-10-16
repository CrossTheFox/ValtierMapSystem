/**
 * Neural Lab — the Lore graph on a Pixi viewport, same camera as the solar.
 * Cards are personaje, lugar and organización. Edges keep the memoria verbs.
 * A group is a reading of those verbs (miembros, vive_en, sede, perteneciente_a).
 * Card positions are layout_lab_x/y. A player sees the published ego, read only.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, CircularProgress, Menu, MenuItem } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";

import { CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import { Z_INDEX, cyberMenuPaperSx, cyberMenuItemSx } from "../../constants/designSystem";
import { WIKI_ENTITY_TYPES } from "../../constants/wikiEntityTypes";
import { isDmRole } from "../../utils/tokenControl";
import { useLoreLabSource } from "../../hooks/useLoreLabSource";
import {
    findRelationForPair,
    linkVerbChoices,
    proposeLabRelation,
} from "../../utils/labGraph";
import {
    WIKI_RELATION_TYPE_OPTIONS,
    defaultStrengthForRelation,
} from "../../constants/wikiRelationTypes";
import { updateCharacterFields } from "../../../firebase/services/characterService";
import { updateCharacterInState } from "../../store/worldSlice";
import { classifyWikiPersonajeKind } from "../../utils/campaignCircuitOverviewLayout";
import { createLabEngine } from "./archive-lab/labEngine";
import ArchiveIcon from "./archive-codex/ArchiveIcon";
import { CODEX_TYPES } from "../../constants/wiki/archiveCodex";
import {
    LAB_BOARD_TYPES,
    LAB_GROUP_MODES,
    groupOffers,
    packGroupPositions,
} from "../../utils/labContainment";
import WikiAiLabPanel from "./WikiAiLabPanel";
import LabImpactReview from "./archive-lab/LabImpactReview";
import LabReviewCard from "./archive-lab/LabReviewCard";
import LabFichaEditor from "./archive-lab/LabFichaEditor";
import { useLabImpactReview } from "../../hooks/useLabImpactReview";
import { reviewMapChrome, syncBlockInto } from "../../utils/labImpactReview";
import { mesaWikiTwin } from "../../utils/labMesaTwin";
import { addWikiRelation, saveWikiEntity, updateWikiRelation } from "../../store/wikiSlice";

const ACCENT = UI_COLORS.anomaly;
const KIND_FILTERS = [
    { id: "all", label: "TODOS" },
    { id: "pj", label: "PJ" },
    { id: "npc", label: "NPC" },
    ...LAB_BOARD_TYPES.filter((id) => id !== "personaje").map((id) => ({
        id,
        label: CODEX_TYPES[id]?.code || id,
    })),
];
const CREATE_TYPES = LAB_BOARD_TYPES.map((type) => [
    type,
    `Crear ${CODEX_TYPES[type]?.label || type}`,
]);
const RELATION_LABEL = Object.fromEntries(
    WIKI_RELATION_TYPE_OPTIONS.map((opt) => [opt.value, opt.label || opt.value]),
);

function snap(value) {
    return 16 + Math.round((Number(value) - 16) / 16) * 16;
}

export default function CampaignNeuralLabOverlay({
    embedded = false,
    readOnly = false,
    loreId: loreIdProp = null,
    seat = "mesa",
    playerEgo = false,
    externalFocusId = null,
}) {
    const dispatch = useDispatch();
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const charactersById = useSelector((s) => s.world.charactersById || {});
    const narrativeSettings = useSelector((s) => s.wiki?.aiConfig || s.wiki?.narrativeSettings);
    const wikiEntities = useSelector((s) => s.wiki?.entities || []);
    const wikiRelations = useSelector((s) => s.wiki?.relations || []);
    const worldLocations = useSelector((s) => s.world.locations);
    const profile = useSelector((s) => s.player.profile);
    const uid = profile?.uid || null;
    const isDM = isDmRole(profile?.role);
    const characters = useMemo(
        () => Object.values(charactersById).filter((row) => !campaignId || row?.campaignId === campaignId),
        [charactersById, campaignId],
    );

    const [pickedIds, setPickedIds] = useState(() => (externalFocusId ? [externalFocusId] : []));
    const [labOpen, setLabOpen] = useState(true);
    const [positionDraft, setPositionDraft] = useState({});
    const [searchQuery, setSearchQuery] = useState("");
    const [kindFilter, setKindFilter] = useState("all");
    const [groupMode, setGroupMode] = useState("libre");
    const [labDepth, setLabDepth] = useState(3);
    const [egoPick, setEgoPick] = useState(null);
    const [cardMenu, setCardMenu] = useState(null);
    const [verbMenu, setVerbMenu] = useState(null);
    const [linkInverted, setLinkInverted] = useState(false);
    const [propWaves, setPropWaves] = useState([]);
    const [cascadeResult, setCascadeResult] = useState(null);
    const [labPhase, setLabPhase] = useState("idle");
    const [reviewCardOff, setReviewCardOff] = useState("");
    const strengthWait = useRef(new Map());
    const mirrorCache = useRef(new Map());

    const ownedForEgo = useMemo(
        () => characters.filter((row) => row?.ficha_id && (isDM || row.ownerPlayerId === uid)),
        [characters, isDM, uid],
    );
    const egoCharacterId = egoPick || ownedForEgo[0]?.id || null;
    const active = embedded;
    const localEgo = Boolean(playerEgo && isDM);
    const source = useLoreLabSource({
        loreId: loreIdProp,
        campaignId: seat === "library" ? null : campaignId,
        active,
        playerEgo,
        localEgo,
        uid,
        characters,
        egoCharacterId,
        publishViews: seat === "mesa" && isDM && !playerEgo,
    });

    const entities = source.entities;
    const relations = source.relations;
    const savedPositions = useMemo(
        () => ({ ...source.positions, ...positionDraft }),
        [source.positions, positionDraft],
    );
    const canEditGraph = Boolean(!readOnly && !playerEgo && source.loreId && (seat === "library" || isDM));
    const canWriteImpact = Boolean(canEditGraph && source.loreId);
    const selectedId = pickedIds.length === 1 ? pickedIds[0] : null;

    const board = useMemo(
        () => entities.map((entity) => ({
            ...entity,
            boardKind: entity.entityType === WIKI_ENTITY_TYPES.PERSONAJE
                ? classifyWikiPersonajeKind(entity, charactersById)
                : entity.entityType,
        })),
        [entities, charactersById],
    );
    const entityById = useMemo(() => {
        const map = new Map();
        for (const entity of board) {
            if (entity?.id) map.set(entity.id, entity);
        }
        return map;
    }, [board]);

    const hostRef = useRef(null);
    const engineRef = useRef(null);
    const actionsRef = useRef({});
    const resultRef = useRef(null);
    const generatingRef = useRef(false);
    const [impactAnchors, setImpactAnchors] = useState([]);
    const snapshotRef = useRef({ relations, entities });
    useEffect(() => {
        snapshotRef.current = { relations, entities };
    }, [relations, entities]);

    const mirrorToMesa = useCallback(async (entityId, blockId, block, applied) => {
        if (seat !== "mesa" || !campaignId || !isDM) return null;
        const twinCtx = { wikiEntities, characters, locations: worldLocations };
        const twinOf = (id) => {
            const lab = entityById.get(id);
            return lab ? mesaWikiTwin(lab, twinCtx) : null;
        };
        if (applied?.fromId && applied?.toId && applied?.relationType) {
            const fromWiki = twinOf(applied.fromId);
            const toWiki = twinOf(applied.toId);
            if (fromWiki && toWiki) {
                const existing = wikiRelations.find((row) => {
                    const ends = [row.fromEntityId, row.toEntityId];
                    return ends.includes(fromWiki.id) && ends.includes(toWiki.id);
                });
                const strength = Number.isFinite(Number(applied.after)) ? Number(applied.after) : 0;
                const data = {
                    relationType: applied.relationType,
                    strength,
                    fromEntityType: fromWiki.entityType,
                    toEntityType: toWiki.entityType,
                };
                if (existing) {
                    await dispatch(updateWikiRelation({ campaignId, relationId: existing.id, data })).unwrap();
                } else {
                    await dispatch(addWikiRelation({
                        campaignId,
                        uid,
                        data: { ...data, fromEntityId: fromWiki.id, toEntityId: toWiki.id, label: "" },
                    })).unwrap();
                }
            }
        }
        const twin = twinOf(entityId);
        if (!twin) return null;
        const cached = mirrorCache.current.get(twin.id);
        const current = cached && Date.now() - cached.at < 4000 ? cached.blocks : (twin.aiImpactBlocks || []);
        const blocks = syncBlockInto(current, blockId, block ? { ...block, loreFichaId: entityId } : null);
        mirrorCache.current.set(twin.id, { blocks, at: Date.now() });
        await dispatch(saveWikiEntity({ campaignId, entityId: twin.id, uid, data: { aiImpactBlocks: blocks } })).unwrap();
        return twin.title || null;
    }, [seat, campaignId, isDM, entityById, wikiEntities, wikiRelations, characters, worldLocations, dispatch, uid]);

    const review = useLabImpactReview({
        result: cascadeResult,
        loreId: source.loreId,
        entities,
        relations,
        canWrite: canWriteImpact,
        onMirror: mirrorToMesa,
    });
    const impactChrome = useMemo(
        () => reviewMapChrome(review.review, review.decisions),
        [review.review, review.decisions],
    );
    const pinToCard = useCallback((el, id) => engineRef.current?.pin(el, id) || (() => {}), []);

    const handleMove = useCallback(async (moves) => {
        if (!moves?.length) return;
        setPositionDraft((prev) => {
            const next = { ...prev };
            moves.forEach((move) => {
                next[move.id] = { x: move.x, y: move.y };
            });
            return next;
        });
        await Promise.all(moves.map((move) => source.persistPosition(move.id, move)));
    }, [source]);

    useEffect(() => { actionsRef.current = {
        onSelect: setPickedIds,
        onMove: (moves) => {
            handleMove(moves).catch((err) => console.warn("[NeuralLab] no se guardó el lugar", err));
        },
        onMenu: (menu) => {
            if (!canEditGraph) return;
            setCardMenu(menu);
        },
        onLink: ({ fromId, toId, clientX, clientY }) => {
            setLinkInverted(false);
            setVerbMenu({ fromId, toId, mouseX: clientX, mouseY: clientY });
            engineRef.current?.disarm();
        },
        onStrength: (row) => {
            const key = row.id || `${row.fromId}|${row.toId}|${row.relationType}`;
            const pending = strengthWait.current.get(key);
            if (pending) clearTimeout(pending);
            strengthWait.current.set(key, setTimeout(() => {
                strengthWait.current.delete(key);
                const fail = (err) => {
                    engineRef.current?.dropPending?.(`${row.fromId}|${row.toId}`);
                    console.warn("[NeuralLab] no se guardó la fuerza", err);
                };
                if (row.id) {
                    source.patchRelationStrength(row.id, row.strength).catch(fail);
                    return;
                }
                const fromEntity = entityById.get(row.fromId);
                const toEntity = entityById.get(row.toId);
                const proposed = proposeLabRelation({
                    fromId: row.fromId,
                    toId: row.toId,
                    fromType: fromEntity?.entityType,
                    toType: toEntity?.entityType,
                    relationType: row.relationType,
                    strength: row.strength,
                    existing: findRelationForPair(source.relaciones, row.fromId, row.toId),
                });
                if (!proposed.ok) {
                    engineRef.current?.dropPending?.(`${row.fromId}|${row.toId}`);
                    return;
                }
                source.commitRelation({ ...proposed.row, replaceId: proposed.replaceId }).catch(fail);
            }, 160));
        },
    }; }, [handleMove, canEditGraph, entityById, source]);

    useEffect(() => {
        const host = hostRef.current;
        if (!host) return undefined;
        const engine = createLabEngine(host, {
            onSelect: (ids) => actionsRef.current.onSelect(ids),
            onMove: (moves) => actionsRef.current.onMove(moves),
            onMenu: (menu) => actionsRef.current.onMenu(menu),
            onLink: (link) => actionsRef.current.onLink(link),
            onStrength: (row) => actionsRef.current.onStrength(row),
        });
        engineRef.current = engine;
        return () => {
            engine.destroy();
            engineRef.current = null;
        };
    }, [active]);

    useEffect(() => {
        engineRef.current?.setGutter?.({ right: canWriteImpact && labOpen ? 320 : 8 });
    }, [canWriteImpact, labOpen, active]);

    useEffect(() => {
        engineRef.current?.setState({
            entities: board,
            relations,
            positions: savedPositions,
            selectedIds: pickedIds,
            query: searchQuery,
            kindFilter,
            groupMode,
            readOnly: !canEditGraph,
            focusId: externalFocusId || "",
            waves: propWaves,
            impactMarks: impactChrome.marks,
            edgeDeltas: impactChrome.edgeDeltas,
            ghosts: impactChrome.ghosts,
            anchorIds: impactAnchors,
            phase: labPhase,
        });
    }, [
        board, relations, savedPositions, pickedIds, searchQuery,
        kindFilter, groupMode, canEditGraph, externalFocusId, propWaves, impactChrome, labPhase, impactAnchors,
    ]);

    useEffect(() => {
        if (!import.meta.env.DEV || !active) return undefined;
        window.__neuralLab = {
            select: (ids) => engineRef.current?.select(Array.isArray(ids) ? ids : [ids]),
            frame: (ids) => engineRef.current?.frame(Array.isArray(ids) ? ids : [ids]),
            find: (title) => board.filter((row) => String(row.title || "").toLowerCase().includes(String(title).toLowerCase()))
                .map((row) => ({ id: row.id, title: row.title, type: row.entityType })),
            phase: () => labPhase,
            review: () => review.review,
        };
        return () => {
            delete window.__neuralLab;
        };
    }, [active, board, labPhase, review.review]);

    const createAt = useCallback((entityType, world) => {
        const pos = world ? { x: snap(world.worldX), y: snap(world.worldY) } : null;
        source.createCard(entityType, pos).catch((err) => console.warn("[NeuralLab] no se creó la ficha", err));
    }, [source]);

    const removeIds = useCallback(async (ids) => {
        const unique = [...new Set(ids.filter(Boolean))];
        if (!unique.length) return;
        const titles = unique.map((id) => entityById.get(id)?.title || "ficha");
        const question = unique.length === 1
            ? `¿Eliminar «${titles[0]}»? Caen sus vínculos.`
            : `¿Eliminar ${unique.length} fichas? Caen sus vínculos.`;
        if (!window.confirm(question)) return;
        const set = new Set(unique);
        const relationIds = (source.relaciones || [])
            .filter((row) => set.has(row.from_ficha_id) || set.has(row.to_ficha_id))
            .map((row) => row.id);
        try {
            await source.deleteCards(unique, relationIds);
            setPickedIds((prev) => prev.filter((id) => !set.has(id)));
        } catch (err) {
            console.warn("[NeuralLab] no se eliminó la ficha", err);
        }
    }, [entityById, source]);

    const applyOffer = useCallback(async (offer) => {
        for (const childId of offer.childIds) {
            const fromEntity = entityById.get(childId);
            const toEntity = entityById.get(offer.parentId);
            const existing = findRelationForPair(source.relaciones, childId, offer.parentId);
            const proposed = proposeLabRelation({
                fromId: childId,
                toId: offer.parentId,
                fromType: fromEntity?.entityType,
                toType: toEntity?.entityType,
                relationType: offer.relation,
                existing,
            });
            if (!proposed.ok) continue;
            await source.commitRelation({ ...proposed.row, replaceId: proposed.replaceId });
        }
        setGroupMode(offer.relation.startsWith("miembro") ? "organizacion" : "lugar");
    }, [entityById, source]);

    const showPropagation = useCallback((waves, meta) => {
        if (meta?.preview && (resultRef.current || generatingRef.current)) return;
        const list = Array.isArray(waves) ? waves : [];
        setPropWaves(list);
        if (meta?.preview) {
            setLabPhase(list.length ? "preview" : "idle");
            return;
        }
        resultRef.current = null;
        generatingRef.current = true;
        setImpactAnchors(list[0]?.nodeIds || []);
        setCascadeResult(null);
        setLabPhase("generating");
    }, []);
    const takeCascadeResult = useCallback((validated) => {
        const next = validated
            ? { ...validated, labRunId: Date.now().toString(36), labSnapshot: snapshotRef.current }
            : null;
        generatingRef.current = false;
        resultRef.current = next;
        setCascadeResult(next);
        setReviewCardOff("");
        if (next) setPropWaves([]);
        setLabPhase(next ? "result" : "idle");
    }, []);
    const hidePropagation = useCallback(() => {
        generatingRef.current = false;
        setPropWaves([]);
        setLabPhase((phase) => (phase === "result" ? phase : "idle"));
    }, []);
    const pack = useCallback(async () => {
        const changed = packGroupPositions(board, relations, savedPositions, groupMode);
        const entries = Object.entries(changed);
        if (!entries.length) return;
        setPositionDraft((prev) => ({ ...prev, ...changed }));
        try {
            await Promise.all(entries.map(([id, pos]) => source.persistPosition(id, pos)));
        } catch (err) {
            console.warn("[NeuralLab] no se acomodó el grupo", err);
        }
    }, [board, relations, savedPositions, groupMode, source]);

    if (!active) return null;

    const ownedLinks = characters.filter((row) => row?.ficha_id && (isDM || row.ownerPlayerId === uid));
    const playerHasLink = ownedLinks.length > 0;
    const emptyTitle = source.missingLore
        ? "Esta mesa no tiene un Lore enlazado."
        : playerEgo && !playerHasLink
            ? "Tu personaje no está unido a una ficha del Lore."
            : playerEgo
                ? "Tu circuito todavía no está publicado."
                : "Todavía no hay personajes, lugares ni organizaciones.";
    const emptyBody = source.missingLore
        ? "Enlaza un Lore con el engranaje del Archive. El Lab dibuja esas fichas."
        : playerEgo && !playerHasLink
            ? "Cuando un DM una tu personaje con una ficha, vas a ver aquí sus relaciones con quien la mesa ya puede ver."
            : playerEgo
                ? "El DM publica el ego al guardar el grafo, la visibilidad o el enlace."
                : "Clic derecho crea la ficha donde estás. Arrastra para ordenar. El botón derecho mueve el mapa.";
    const showEmpty = !source.loading && board.length === 0;
    const selectedGroup = selectedId ? review.review.groups.find((group) => group.entityId === selectedId) : null;
    const menuEntity = cardMenu?.ids?.length === 1 ? entityById.get(cardMenu.ids[0]) : null;
    const menuOffers = cardMenu?.mode === "multi"
        ? groupOffers(cardMenu.ids.map((id) => entityById.get(id)).filter(Boolean))
        : [];

    return (
        <Box sx={{ display: "flex", flexDirection: "column", flex: 1, width: "100%", minWidth: 0, height: "100%", minHeight: 0, bgcolor: UI_COLORS.backgroundPrimary }}>
            <Box sx={{ display: "flex", flex: 1, width: "100%", minWidth: 0, minHeight: 0, overflow: "hidden" }}>
                <Box
                    onContextMenu={(event) => {
                        const tag = event.target?.tagName;
                        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
                        event.preventDefault();
                        event.returnValue = false;
                    }}
                    sx={{ flex: 1, minWidth: 0, minHeight: 0, position: "relative" }}
                >
                    <LabTools
                        searchQuery={searchQuery}
                        onSearch={setSearchQuery}
                        kindFilter={kindFilter}
                        onKind={setKindFilter}
                        groupMode={groupMode}
                        onGroup={setGroupMode}
                        onPack={canEditGraph ? pack : null}
                        caption={groupMode === "libre"
                            ? `${board.length} fichas`
                            : LAB_GROUP_MODES.find((mode) => mode.id === groupMode)?.label || ""}
                        onToggleAi={canWriteImpact ? () => {
                            if (labOpen) hidePropagation();
                            setLabOpen((value) => !value);
                        } : null}
                        aiOpen={labOpen}
                        readOnly={readOnly || playerEgo}
                        characters={playerEgo ? ownedLinks : []}
                        egoCharacterId={egoCharacterId}
                        onPickCharacter={setEgoPick}
                    />
                    <Box ref={hostRef} sx={{ position: "absolute", inset: 0 }} />
                    {source.loading && board.length === 0 && (
                        <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}>
                            <CircularProgress size={28} sx={{ color: ACCENT }} />
                        </Box>
                    )}
                    {showEmpty && (
                        <Box sx={{ position: "absolute", left: 28, top: 64, maxWidth: 460, pointerEvents: "none", display: "flex", flexDirection: "column", gap: 1 }}>
                            <CyberText sx={{ color: UI_COLORS.textPrimary, fontSize: "0.95rem" }}>{emptyTitle}</CyberText>
                            <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "0.82rem" }}>{emptyBody}</CyberText>
                        </Box>
                    )}
                    {canEditGraph && selectedId && entityById.get(selectedId) && (
                        <LabFichaEditor
                            key={selectedId}
                            entity={entityById.get(selectedId)}
                            relations={relations}
                            entityById={entityById}
                            visible={source.visibilityByFicha[selectedId] === "players"}
                            showVisibility={seat === "mesa" && isDM}
                            onPatch={(patch) => source.patchImpact(selectedId, patch)}
                            onVisibility={(next) => source.markVisibility(selectedId, next)}
                            onBlocksChange={async (blocks, blockId, block) => {
                                await source.patchImpact(selectedId, { ai_impact_blocks: blocks });
                                if (!String(blockId).startsWith("nl-")) return;
                                await mirrorToMesa(selectedId, blockId, block).catch((err) => {
                                    console.warn("[NeuralLab] no se espejó en el Codex de la mesa", err);
                                });
                            }}
                            pin={pinToCard}
                        />
                    )}
                    {canWriteImpact && selectedGroup && reviewCardOff !== selectedId && (
                        <LabReviewCard
                            key={`${review.runId}-${selectedGroup.key}`}
                            group={selectedGroup}
                            decisions={review.decisions}
                            onDecide={review.decide}
                            onAcceptGroup={review.acceptGroup}
                            onRejectGroup={review.rejectGroup}
                            canWrite={canWriteImpact}
                            pin={pinToCard}
                            onClose={() => setReviewCardOff(selectedId)}
                        />
                    )}
                    <LabPhaseHud phase={labPhase} waves={propWaves} counts={review.counts} />
                    {board.length > 0 && <LabLegend phase={labPhase} />}
                    {canWriteImpact && labOpen && (
                        <Box
                            onPointerDown={(event) => event.stopPropagation()}
                            sx={{
                                position: "absolute",
                                top: 52,
                                right: 10,
                                zIndex: 8,
                                width: 300,
                                maxHeight: "calc(100% - 64px)",
                                overflow: "auto",
                                borderRadius: "8px",
                                border: `1px solid ${UI_COLORS.border}`,
                                bgcolor: "rgba(8,8,14,0.96)",
                                backdropFilter: "blur(10px)",
                                boxShadow: "0 18px 40px rgba(0,0,0,0.55)",
                                ...CYBER_SCROLL_STYLE,
                            }}
                        >
                        <WikiAiLabPanel
                            compact
                            campaignId={campaignId}
                            loreId={source.loreId}
                            selectedEntity={selectedId ? entityById.get(selectedId) : null}
                            entities={entities}
                            relations={relations}
                            narrativeSettings={narrativeSettings}
                            onPropagationStart={showPropagation}
                            onPropagationEnd={hidePropagation}
                            onPropagationResult={takeCascadeResult}
                            onFocusImpact={(id) => {
                                if (!id) return;
                                setPickedIds([id]);
                                engineRef.current?.frame([id]);
                            }}
                            focusedImpactEntityId={selectedId}
                            cascadePresentation="queue"
                            propagationDepth={labDepth}
                            onPropagationDepthChange={setLabDepth}
                            renderCascadeResult={({ eventInstruction, onDiscard }) => (cascadeResult ? (
                                <LabImpactReview
                                    result={cascadeResult}
                                    eventInstruction={eventInstruction}
                                    review={review.review}
                                    decisions={review.decisions}
                                    counts={review.counts}
                                    canWrite={canWriteImpact}
                                    onDecide={review.decide}
                                    onAcceptGroup={review.acceptGroup}
                                    onRejectGroup={review.rejectGroup}
                                    onAcceptAll={review.acceptAll}
                                    onRejectAll={review.rejectAll}
                                    focusedEntityId={selectedId}
                                    onFocus={(id) => {
                                        setReviewCardOff("");
                                        setPickedIds([id]);
                                        engineRef.current?.frame([id]);
                                    }}
                                    onDiscard={onDiscard}
                                />
                            ) : null)}
                        />
                        </Box>
                    )}
                </Box>
            </Box>
            <Menu
                open={Boolean(cardMenu)}
                onClose={() => setCardMenu(null)}
                anchorReference="anchorPosition"
                anchorPosition={cardMenu ? { top: cardMenu.clientY, left: cardMenu.clientX } : undefined}
                sx={{ zIndex: Z_INDEX.wikiLabMenu }}
                slotProps={{ paper: { sx: { ...cyberMenuPaperSx, maxHeight: 480, minWidth: 240 } } }}
            >
                {cardMenu?.mode === "empty" && (
                    <Box sx={{ px: 1.25, pt: 1.25, pb: 0.75 }}>
                        <CyberText sx={{ fontSize: "0.62rem", letterSpacing: "0.16em", color: UI_COLORS.textSecondary }}>
                            VER
                        </CyberText>
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: "4px", mt: 0.75 }}>
                            {KIND_FILTERS.map((item) => {
                                const on = kindFilter === item.id;
                                const icon = item.id === "pj" || item.id === "npc" ? "personaje" : item.id === "all" ? "all" : item.id;
                                const color = CODEX_TYPES[item.id]?.color || (on ? UI_COLORS.anomaly : "#ffffff");
                                return (
                                    <Box
                                        key={item.id}
                                        component="button"
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() => setKindFilter(item.id)}
                                        sx={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "4px",
                                            color: on ? "#07070c" : "#ffffff",
                                            background: on ? color : "transparent",
                                            border: `1px solid ${on ? color : "rgba(255,255,255,0.18)"}`,
                                            borderRadius: "99px",
                                            px: "7px",
                                            py: "3px",
                                            cursor: "pointer",
                                            fontFamily: '"Fira Code", monospace',
                                            fontSize: "10px",
                                            letterSpacing: "0.06em",
                                        }}
                                    >
                                        <TypeMark name={icon} color={on ? "#07070c" : color} />
                                        {item.label}
                                    </Box>
                                );
                            })}
                        </Box>
                    </Box>
                )}
                {cardMenu?.mode === "empty" && (
                    <CyberText sx={{ display: "block", px: 1.5, pt: 0.75, pb: 0.25, fontSize: "0.62rem", letterSpacing: "0.16em", color: UI_COLORS.textSecondary }}>
                        CREAR
                    </CyberText>
                )}
                {cardMenu?.mode === "empty" && CREATE_TYPES.map(([type, label]) => (
                    <MenuItem
                        key={type}
                        sx={{ ...cyberMenuItemSx, display: "flex", alignItems: "center", gap: 1 }}
                        onClick={() => {
                            createAt(type, cardMenu);
                            setCardMenu(null);
                        }}
                    >
                        <TypeMark name={type} color={CODEX_TYPES[type]?.color || "#ffffff"} />
                        {label}
                    </MenuItem>
                ))}
                {cardMenu?.mode === "node" && menuEntity && (
                    <Box sx={{ px: 1.5, py: 1.25, display: "flex", alignItems: "center", gap: 1, borderBottom: `1px solid ${UI_COLORS.border}` }}>
                        <TypeMark name={menuEntity.entityType} color={CODEX_TYPES[menuEntity.entityType]?.color || "#ffffff"} />
                        <Box sx={{ minWidth: 0 }}>
                            <CyberText sx={{ fontSize: "0.9rem", color: "#ffffff", lineHeight: 1.2 }}>
                                {menuEntity.title || "Sin título"}
                            </CyberText>
                            <CyberText sx={{ fontSize: "0.68rem", letterSpacing: "0.08em", color: CODEX_TYPES[menuEntity.entityType]?.color || UI_COLORS.textSecondary }}>
                                {CODEX_TYPES[menuEntity.entityType]?.label || menuEntity.entityType}
                            </CyberText>
                        </Box>
                    </Box>
                )}
                {cardMenu?.mode === "node" && (
                    <MenuItem
                        sx={cyberMenuItemSx}
                        onClick={() => {
                            engineRef.current?.armLink(cardMenu.ids[0]);
                            setCardMenu(null);
                        }}
                    >
                        Enlazar
                    </MenuItem>
                )}
                {cardMenu?.mode === "multi" && menuOffers.map((offer) => (
                    <MenuItem
                        key={offer.id}
                        sx={cyberMenuItemSx}
                        onClick={() => {
                            applyOffer(offer).catch((err) => console.warn("[NeuralLab] no se agrupó", err));
                            setCardMenu(null);
                        }}
                    >
                        {offer.label}
                    </MenuItem>
                ))}
                {(cardMenu?.mode === "node" || cardMenu?.mode === "multi") && (
                    <MenuItem
                        sx={cyberMenuItemSx}
                        onClick={() => {
                            const ids = cardMenu.ids || [];
                            setCardMenu(null);
                            removeIds(ids);
                        }}
                    >
                        {cardMenu.mode === "multi" ? "Eliminar todo" : "Eliminar"}
                    </MenuItem>
                )}
                {cardMenu?.mode === "node" && seat === "mesa" && isDM && (
                    <MenuItem
                        sx={cyberMenuItemSx}
                        onClick={() => {
                            const visible = source.visibilityByFicha[cardMenu.ids[0]] === "players";
                            source.markVisibility(cardMenu.ids[0], visible ? "dm_only" : "players");
                            setCardMenu(null);
                        }}
                    >
                        {source.visibilityByFicha[cardMenu.ids[0]] === "players" ? "Ocultar a la mesa" : "Visible para la mesa"}
                    </MenuItem>
                )}
                {cardMenu?.mode === "node" && seat === "mesa" && isDM && menuEntity?.entityType === WIKI_ENTITY_TYPES.PERSONAJE && (
                    <MenuItem
                        sx={cyberMenuItemSx}
                        onClick={() => linkCharacter(cardMenu.ids[0], null, characters, dispatch).then(() => setCardMenu(null))}
                    >
                        Quitar unión de mesa
                    </MenuItem>
                )}
                {cardMenu?.mode === "node" && seat === "mesa" && isDM && menuEntity?.entityType === WIKI_ENTITY_TYPES.PERSONAJE && characters.map((character) => (
                    <MenuItem
                        key={character.id}
                        sx={cyberMenuItemSx}
                        onClick={() => linkCharacter(cardMenu.ids[0], character.id, characters, dispatch).then(() => setCardMenu(null))}
                    >
                        Unir a {character.name || "personaje"}{character.ficha_id === cardMenu.ids[0] ? " · actual" : ""}
                    </MenuItem>
                ))}
            </Menu>
            <LabVerbMenu
                menu={verbMenu}
                inverted={linkInverted}
                entityById={entityById}
                onInvert={() => setLinkInverted((value) => !value)}
                onClose={() => setVerbMenu(null)}
                onCommit={async (relationType, strength) => {
                    const origin = linkInverted ? verbMenu.toId : verbMenu.fromId;
                    const dest = linkInverted ? verbMenu.fromId : verbMenu.toId;
                    const fromEntity = entityById.get(origin);
                    const toEntity = entityById.get(dest);
                    const existing = findRelationForPair(source.relaciones, origin, dest);
                    const proposed = proposeLabRelation({
                        fromId: origin,
                        toId: dest,
                        fromType: fromEntity?.entityType,
                        toType: toEntity?.entityType,
                        relationType,
                        strength,
                        existing,
                    });
                    if (!proposed.ok) return;
                    try {
                        await source.commitRelation({ ...proposed.row, replaceId: proposed.replaceId });
                        setVerbMenu(null);
                    } catch (err) {
                        console.warn("[NeuralLab] no se guardó el enlace", err);
                    }
                }}
            />
        </Box>
    );
}

async function linkCharacter(fichaId, characterId, characters, dispatch) {
    const pointing = characters.filter((row) => row.ficha_id === fichaId && row.id !== characterId);
    await Promise.all(pointing.map((row) => updateCharacterFields(row.id, { ficha_id: null })));
    pointing.forEach((row) => {
        dispatch(updateCharacterInState({ id: row.id, data: { ficha_id: null } }));
    });
    if (characterId) {
        await updateCharacterFields(characterId, { ficha_id: fichaId });
        dispatch(updateCharacterInState({ id: characterId, data: { ficha_id: fichaId } }));
    }
}

const PHASE_COPY = {
    preview: { kicker: "VISTA PREVIA", color: "#9aa8b6" },
    generating: { kicker: "GENERANDO", color: UI_COLORS.anomaly },
    result: { kicker: "IMPACTO", color: UI_COLORS.accent },
};

function LabPhaseHud({ phase, waves, counts }) {
    const copy = PHASE_COPY[phase];
    if (!copy) return null;
    const nodes = new Set((waves || []).flatMap((wave) => wave.nodeIds || [])).size;
    const depth = Math.max(0, (waves || []).length - 1);
    const line = phase === "preview"
        ? `${nodes} fichas en ${depth} onda${depth === 1 ? "" : "s"} recibirían el evento`
        : phase === "generating"
            ? `La IA recorre ${nodes} fichas en ${depth} onda${depth === 1 ? "" : "s"} y valida cada cambio`
            : (counts.total || counts.blocked)
                ? `${counts.accepted} aceptados · ${counts.rejected} rechazados · ${counts.pending} por decidir${counts.blocked ? ` · ${counts.blocked} bloqueados` : ""}`
                : "Sin cambios aplicables";
    return (
        <Box
            role="status"
            aria-live="polite"
            data-testid="lab-phase-hud"
            sx={{
                position: "absolute",
                left: 14,
                top: 12,
                zIndex: 7,
                pointerEvents: "none",
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1.25,
                py: 0.75,
                borderRadius: "6px",
                border: `1px solid ${copy.color}66`,
                background: "rgba(8,8,14,0.9)",
                backdropFilter: "blur(8px)",
                boxShadow: phase === "generating" ? `0 0 18px ${copy.color}44` : "none",
                "@keyframes labHudIn": { from: { opacity: 0, transform: "translateY(-6px)" }, to: { opacity: 1, transform: "none" } },
                animation: "labHudIn .24s ease-out both",
            }}
        >
            {phase === "generating" ? (
                <Box
                    aria-hidden
                    sx={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        border: `2px solid ${copy.color}33`,
                        borderTopColor: copy.color,
                        "@keyframes labSpin": { to: { transform: "rotate(360deg)" } },
                        animation: "labSpin .8s linear infinite",
                    }}
                />
            ) : (
                <Box
                    aria-hidden
                    sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: copy.color,
                        boxShadow: `0 0 8px ${copy.color}`,
                        "@keyframes labBreath": { "0%,100%": { opacity: 0.45 }, "50%": { opacity: 1 } },
                        animation: phase === "preview" ? "labBreath 2.4s ease-in-out infinite" : "none",
                    }}
                />
            )}
            <Box>
                <Box sx={{ fontFamily: '"Orbitron", sans-serif', fontSize: "9px", letterSpacing: "0.18em", color: copy.color }}>
                    {copy.kicker}
                </Box>
                <Box sx={{ fontFamily: '"Fira Sans", sans-serif', fontSize: "12px", color: "#ffffff", mt: "1px" }}>{line}</Box>
            </Box>
        </Box>
    );
}

function LabLegend({ phase }) {
    const [open, setOpen] = useState(false);
    return (
        <Box sx={{ position: "absolute", right: 12, bottom: 12, zIndex: 7, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.75 }}>
            {open && (
                <Box
                    role="note"
                    sx={{
                        width: 270,
                        p: 1.25,
                        borderRadius: "6px",
                        border: `1px solid ${UI_COLORS.border}`,
                        background: "rgba(8,8,14,0.95)",
                        color: "#ffffff",
                        fontFamily: '"Fira Sans", sans-serif',
                        fontSize: "12px",
                        lineHeight: 1.45,
                        display: "grid",
                        gap: 0.9,
                    }}
                >
                    <LegendRow mark={<LegendSvg kind="circle" />} title="Vínculo con fuerza">
                        Va de −10 a +10. Los triángulos de arriba y abajo la suben o bajan de a 1.
                    </LegendRow>
                    <LegendRow mark={<LegendSvg kind="lock" />} title="Vínculo estructural">
                        Pertenencia, parentesco o lugar (miembro de, vive en, participó…). No tiene fuerza: solo cambia su tipo.
                    </LegendRow>
                    {phase === "result" && (
                        <>
                            <LegendRow mark={<LegendSvg kind="ghost" />} title="Vínculo nuevo propuesto">
                                La IA propone crearlo; aparece al aceptarlo.
                            </LegendRow>
                            <LegendRow mark={<Box component="span" sx={{ color: "#f5c542", fontFamily: '"Fira Code", monospace' }}>+3</Box>} title="Delta">
                                Cambio propuesto sobre la fuerza actual. ✓ aceptado, ✕ rechazado.
                            </LegendRow>
                        </>
                    )}
                </Box>
            )}
            <Box
                component="button"
                type="button"
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
                sx={{ ...labToolBtnSx(open), width: "auto", px: 1, gap: 0.6, display: "flex", fontFamily: '"Orbitron", sans-serif', fontSize: "9px", letterSpacing: "0.1em" }}
            >
                <LegendSvg kind="lock" />
                LEYENDA
            </Box>
        </Box>
    );
}

function LegendRow({ mark, title, children }) {
    return (
        <Box sx={{ display: "grid", gridTemplateColumns: "28px 1fr", gap: 0.75, alignItems: "start" }}>
            <Box sx={{ display: "grid", placeItems: "center", pt: "2px" }}>{mark}</Box>
            <Box>
                <Box sx={{ fontWeight: 600 }}>{title}</Box>
                <Box sx={{ color: "#cfcfd8" }}>{children}</Box>
            </Box>
        </Box>
    );
}

function LegendSvg({ kind }) {
    if (kind === "lock") {
        return (
            <svg width="20" height="20" viewBox="-12 -12 24 24" aria-hidden>
                <polygon points="0,-11 11,0 0,11 -11,0" fill="#120d02" stroke="#ffaa00" strokeWidth="1.4" />
                <path d="M -3 -1 V -3.2 A 3 3 0 0 1 3 -3.2 V -1" fill="none" stroke="#ffcc66" strokeWidth="1.3" />
                <rect x="-4.2" y="-1" width="8.4" height="6" rx="1" fill="#ffcc66" />
            </svg>
        );
    }
    if (kind === "ghost") {
        return (
            <svg width="26" height="10" viewBox="0 0 26 10" aria-hidden>
                <path d="M1 5 H25" stroke="#00f2ea" strokeWidth="2" strokeDasharray="3 4" strokeLinecap="round" />
            </svg>
        );
    }
    return (
        <svg width="24" height="28" viewBox="-12 -14 24 28" aria-hidden>
            <polygon points="-5,-9 5,-9 0,-14" fill="#a8ffe0" />
            <circle r="7" fill="#07070c" stroke="#3dd68c" strokeWidth="1.4" />
            <text y="2.6" textAnchor="middle" fontSize="7" fill="#fff" fontFamily="Fira Code, monospace">+4</text>
            <polygon points="-5,9 5,9 0,14" fill="#a8ffe0" />
        </svg>
    );
}

function ToolGlyph({ d }) {
    return (
        <Box component="svg" viewBox="0 0 24 24" aria-hidden sx={{ width: 16, height: 16, display: "block" }}>
            <path d={d} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </Box>
    );
}

const LAB_ICO = {
    search: "M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14ZM20 20l-3.5-3.5",
    filter: "M4 5h16l-6 7v6l-4 2v-8L4 5Z",
    pack: "M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5",
};

const labToolBtnSx = (on) => ({
    width: 32,
    height: 32,
    p: 0,
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    color: on ? UI_COLORS.anomaly : "#ffffff",
    background: "rgba(8, 8, 14, .9)",
    border: `1px solid ${on ? UI_COLORS.anomaly : UI_COLORS.border}`,
    borderRadius: "4px",
    boxShadow: on ? "0 0 12px rgba(0, 242, 234, .4)" : "none",
    backdropFilter: "blur(10px)",
    "&:hover, &:focus-visible": { borderColor: "#ffffff", outline: "none" },
});

function LabTools({
    searchQuery, onSearch, kindFilter, onKind, groupMode, onGroup, onPack, caption,
    onToggleAi, aiOpen, readOnly, characters, egoCharacterId, onPickCharacter,
}) {
    const [searchOpen, setSearchOpen] = useState(false);
    const [pop, setPop] = useState(false);
    const searchRef = useRef(null);
    useEffect(() => {
        if (searchOpen) searchRef.current?.focus();
    }, [searchOpen]);
    useEffect(() => {
        if (!pop) return undefined;
        const close = (event) => {
            if (event.target.closest?.("[data-lab-tools]")) return;
            setPop(false);
        };
        document.addEventListener("pointerdown", close, true);
        return () => document.removeEventListener("pointerdown", close, true);
    }, [pop]);
    const filtered = kindFilter !== "all" || groupMode !== "libre";
    return (
        <Box
            data-lab-tools
            role="toolbar"
            aria-label="Herramientas del lab"
            title={caption}
            sx={{
                position: "absolute",
                top: 10,
                right: 10,
                zIndex: 8,
                display: "flex",
                alignItems: "center",
                gap: "6px",
                pointerEvents: "auto",
            }}
        >
            {characters.length > 0 && (
                <Box sx={{ display: "flex", gap: "6px", mr: 0.5 }}>
                    {characters.map((character) => (
                        <Box
                            key={character.id}
                            component="button"
                            type="button"
                            onClick={() => onPickCharacter(character.id)}
                            sx={{
                                ...labToolBtnSx(egoCharacterId === character.id),
                                width: "auto",
                                px: 1,
                                fontFamily: '"Fira Sans", sans-serif',
                                fontSize: "12px",
                            }}
                        >
                            {(character.name || "Personaje").slice(0, 16)}
                        </Box>
                    ))}
                </Box>
            )}
            {readOnly && (
                <Box sx={{ fontFamily: '"Fira Code", monospace', fontSize: "10px", letterSpacing: "0.12em", color: UI_COLORS.anomaly }}>
                    LECTURA
                </Box>
            )}
            <Box sx={{ display: "flex", alignItems: "center", gap: "6px" }}>
                {searchOpen && (
                    <Box
                        component="input"
                        ref={searchRef}
                        type="search"
                        placeholder="Buscar…"
                        aria-label="Buscar en el grafo"
                        value={searchQuery}
                        onChange={(event) => onSearch(event.target.value)}
                        sx={{
                            width: 168,
                            color: "#fff",
                            background: "rgba(8, 8, 14, .55)",
                            border: `1px solid ${UI_COLORS.border}`,
                            borderRadius: "4px",
                            p: "6px 8px",
                            fontFamily: '"Fira Sans", sans-serif',
                            fontSize: "13px",
                            outline: "none",
                            "&:focus": { borderColor: UI_COLORS.accent },
                            "&::placeholder": { color: UI_COLORS.textSecondary },
                        }}
                    />
                )}
                <Box
                    component="button"
                    type="button"
                    aria-label="Buscar"
                    aria-pressed={searchOpen}
                    onClick={() => setSearchOpen((open) => !open)}
                    sx={labToolBtnSx(searchOpen || Boolean(searchQuery))}
                >
                    <ToolGlyph d={LAB_ICO.search} />
                </Box>
            </Box>
            <Box sx={{ position: "relative" }}>
                <Box
                    component="button"
                    type="button"
                    aria-label="Filtrar y agrupar"
                    aria-pressed={filtered}
                    aria-expanded={pop}
                    onClick={() => setPop((open) => !open)}
                    sx={labToolBtnSx(filtered || pop)}
                >
                    <ToolGlyph d={LAB_ICO.filter} />
                </Box>
                {pop && (
                    <Box
                        role="menu"
                        sx={{
                            position: "absolute",
                            top: 38,
                            right: 0,
                            zIndex: 2,
                            minWidth: 180,
                            maxHeight: 360,
                            overflow: "auto",
                            p: "4px",
                            borderRadius: "6px",
                            color: "#ffffff",
                            background: "rgba(10, 10, 16, .96)",
                            border: `1px solid ${UI_COLORS.border}`,
                            boxShadow: "0 14px 36px rgba(0, 0, 0, .55)",
                            ...CYBER_SCROLL_STYLE,
                        }}
                    >
                        {KIND_FILTERS.map((item) => (
                            <Box
                                key={item.id}
                                component="button"
                                type="button"
                                role="menuitemradio"
                                aria-pressed={kindFilter === item.id}
                                onClick={() => onKind(item.id)}
                                sx={menuRowSx(kindFilter === item.id)}
                            >
                                {item.label}
                            </Box>
                        ))}
                        <Box sx={{ px: 1.25, pt: 1, pb: 0.5, fontFamily: '"Fira Code", monospace', fontSize: "10px", letterSpacing: "0.14em", color: UI_COLORS.anomaly }}>
                            AGRUPAR
                        </Box>
                        {LAB_GROUP_MODES.map((mode) => (
                            <Box
                                key={mode.id}
                                component="button"
                                type="button"
                                role="menuitemradio"
                                aria-pressed={groupMode === mode.id}
                                onClick={() => onGroup(mode.id)}
                                sx={menuRowSx(groupMode === mode.id)}
                            >
                                {mode.label}
                            </Box>
                        ))}
                    </Box>
                )}
            </Box>
            {onPack && groupMode !== "libre" && (
                <Box
                    component="button"
                    type="button"
                    aria-label="Acomodar el grupo"
                    onClick={onPack}
                    sx={labToolBtnSx(false)}
                >
                    <ToolGlyph d={LAB_ICO.pack} />
                </Box>
            )}
            {onToggleAi && (
                <Box
                    component="button"
                    type="button"
                    aria-label={aiOpen ? "Ocultar laboratorio de IA" : "Mostrar laboratorio de IA"}
                    aria-pressed={aiOpen}
                    onClick={onToggleAi}
                    sx={{ ...labToolBtnSx(aiOpen), width: "auto", px: 1, fontFamily: '"Orbitron", sans-serif', fontSize: "9px", letterSpacing: "0.08em" }}
                >
                    IA
                </Box>
            )}
        </Box>
    );
}

function menuRowSx(on) {
    return {
        display: "block",
        width: "100%",
        textAlign: "left",
        color: on ? UI_COLORS.anomaly : "#ffffff",
        background: "transparent",
        border: 0,
        borderRadius: "4px",
        p: "7px 10px",
        fontFamily: '"Fira Sans", sans-serif',
        fontSize: "13px",
        cursor: "pointer",
        boxShadow: on ? `inset 2px 0 0 ${UI_COLORS.anomaly}` : "none",
        "&:hover": { background: `${UI_COLORS.accent}18` },
    };
}

function TypeMark({ name, color = "#ffffff" }) {
    return (
        <Box
            sx={{
                width: 16,
                height: 16,
                flexShrink: 0,
                color,
                display: "inline-flex",
                "& .svg": { display: "flex", width: 16, height: 16 },
                "& svg": { width: 16, height: 16, fill: "none", stroke: "currentColor", strokeWidth: 1.6 },
            }}
        >
            <ArchiveIcon name={name} />
        </Box>
    );
}

function LabVerbMenu({ menu, inverted, entityById, onInvert, onClose, onCommit }) {
    const originId = menu ? (inverted ? menu.toId : menu.fromId) : null;
    const destId = menu ? (inverted ? menu.fromId : menu.toId) : null;
    const origin = entityById.get(originId);
    const dest = entityById.get(destId);
    const fromType = origin?.entityType;
    const toType = dest?.entityType;
    const choices = fromType && toType ? linkVerbChoices(fromType, toType) : { direct: [], reverse: [] };
    const verbs = choices.direct;
    const canInvert = choices.reverse.length > 0;
    return (
        <Menu
            open={Boolean(menu)}
            onClose={onClose}
            anchorReference="anchorPosition"
            anchorPosition={menu ? { top: menu.mouseY, left: menu.mouseX } : undefined}
            sx={{ zIndex: Z_INDEX.wikiLabMenu }}
            slotProps={{ paper: { sx: { ...cyberMenuPaperSx, maxHeight: 460, minWidth: 280 } } }}
        >
            <Box sx={{ px: 1.5, pt: 1.25, pb: 1, borderBottom: `1px solid ${UI_COLORS.border}` }}>
                <CyberText sx={{ fontSize: "0.62rem", letterSpacing: "0.16em", color: UI_COLORS.textSecondary }}>
                    ENLACE
                </CyberText>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.75 }}>
                    <TypeMark name={fromType} color={CODEX_TYPES[fromType]?.color || "#ffffff"} />
                    <CyberText sx={{ fontSize: "0.86rem", color: "#ffffff" }}>{origin?.title || "Origen"}</CyberText>
                </Box>
                <CyberText sx={{ my: 0.35, pl: 3, fontSize: "0.72rem", color: UI_COLORS.anomaly }}>→</CyberText>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    <TypeMark name={toType} color={CODEX_TYPES[toType]?.color || "#ffffff"} />
                    <CyberText sx={{ fontSize: "0.86rem", color: "#ffffff" }}>{dest?.title || "Destino"}</CyberText>
                </Box>
                {canInvert && (
                    <Box
                        component="button"
                        type="button"
                        onClick={onInvert}
                        sx={{
                            mt: 1,
                            color: inverted ? "#07070c" : "#ffffff",
                            background: inverted ? UI_COLORS.anomaly : "transparent",
                            border: `1px solid ${UI_COLORS.anomaly}`,
                            borderRadius: "99px",
                            px: 1,
                            py: 0.35,
                            cursor: "pointer",
                            fontFamily: '"Fira Sans", sans-serif',
                            fontSize: "0.72rem",
                        }}
                    >
                        {inverted ? "Dirección invertida" : "Invertir dirección"}
                    </Box>
                )}
            </Box>
            {verbs.map((verb) => {
                const label = RELATION_LABEL[verb] || verb;
                const weight = defaultStrengthForRelation(verb, fromType, toType);
                return (
                    <MenuItem
                        key={verb}
                        sx={{ ...cyberMenuItemSx, display: "flex", alignItems: "flex-start", flexDirection: "column", py: 0.85 }}
                        onClick={() => onCommit(verb, weight)}
                    >
                        <Box component="span" sx={{ color: "#ffffff", fontSize: "0.86rem" }}>{label}</Box>
                        <Box component="span" sx={{ color: UI_COLORS.textSecondary, fontSize: "0.72rem", whiteSpace: "normal" }}>
                            {origin?.title || "Origen"} {label.toLowerCase()} {dest?.title || "destino"}
                            {weight ? ` · ${weight > 0 ? `+${weight}` : weight}` : ""}
                        </Box>
                    </MenuItem>
                );
            })}
            {verbs.length === 0 && (
                <MenuItem sx={cyberMenuItemSx} disabled>Este par no tiene un verbo</MenuItem>
            )}
        </Menu>
    );
}
