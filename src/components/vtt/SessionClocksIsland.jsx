import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, IconButton } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import HistoryIcon from "@mui/icons-material/History";
import { useDispatch, useSelector } from "react-redux";
import { CyberText, CyberTitle } from "../customs/CustomTexts";
import CyberTooltip from "../customs/CyberTooltip";
import ClockDial from "./ClockDial";
import SessionClockZoomEditor from "./SessionClockZoomEditor";
import SessionClockHistoryDialog from "./SessionClockHistoryDialog";
import SessionClockResolvePopover from "./SessionClockResolvePopover";
import { HUD_SURFACE, TYPO } from "../../constants/designSystem";
import { UI_COLORS } from "../../constants/uiColors";
import { VTT_HUD, VTT_TOP_CENTER_ISLAND_WIDTH } from "../../constants/vttHudTokens";
import { useSessionClocks } from "../../hooks/useSessionClocks";
import { useStatSystem } from "../../hooks/useStatSystem";
import { canAttemptResolve, canViewClock, visibleUserIdsForRoll, withConsumedGrant } from "../../utils/clockAcl";
import {
    CLOCK_RESOLVE_MODES,
    CLOCK_SCOPES,
    cycleClockSize,
    sizeTheme,
} from "../../utils/clockInstance";
import { applyAdvance, jumpToHalfSteps, resolveClockRoll, rollD6Pool } from "../../utils/clockResolver";
import { listCampaignCharacters } from "../../utils/characterCombat";
import { isDmRole } from "../../utils/tokenControl";
import { rollIconActionDice } from "../../utils/actionDiceRoll";
import { sendChatMessage, CHAT_MESSAGE_TYPES } from "../../../firebase/services/chatService";
import { subscribePlayersByCampaign } from "../../../firebase/services/playerAdminService";
import { showSnackbar } from "../../store/uiSlice";

const EMPTY_CLOCKS = Object.freeze([]);

function buildRoster(characters, playersByUid) {
    const pcs = characters.filter((c) => {
        const t = String(c.type || c.kind || "").toLowerCase();
        return Boolean(c.ownerPlayerId) || t === "pc" || t === "player";
    });
    const source = pcs.length ? pcs : characters;
    return [...source]
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
        .map((c) => ({
            id: c.id,
            name: c.name || "PJ",
            img: c.tokenImageUrl || c.imageUrl || null,
            playerId: c.ownerPlayerId || "",
            playerName: (c.ownerPlayerId && playersByUid[c.ownerPlayerId]?.nickname) || "—",
            color: UI_COLORS.anomaly,
        }));
}

function SessionClocksIsland() {
    const dispatch = useDispatch();
    const profile = useSelector((s) => s.player.profile);
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const initiativeOpen = useSelector((s) => s.game.initiative?.open === true);
    const charactersById = useSelector((s) => s.world.charactersById ?? {});
    const locations = useSelector((s) => s.world.locations);
    const isDM = isDmRole(profile?.role);

    const {
        clocks, clockHistory, sessionOpen, addClock, patchClock,
        setFilledHalfSteps, archiveOrComplete, logEvent, upsertClock,
    } = useSessionClocks();
    const { stats } = useStatSystem(campaignId);

    const [editorId, setEditorId] = useState(null);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [rollClockId, setRollClockId] = useState(null);
    const [rollAnchor, setRollAnchor] = useState(null);
    const [pjOffset, setPjOffset] = useState(0);
    const [players, setPlayers] = useState([]);
    const [flashId, setFlashId] = useState(null);
    const stackRef = useRef(null);

    useEffect(() => {
        if (!campaignId) return undefined;
        return subscribePlayersByCampaign(campaignId, setPlayers);
    }, [campaignId]);

    const playersByUid = useMemo(() => {
        const m = {};
        for (const p of players) m[p.uid || p.id] = p;
        return m;
    }, [players]);

    const roster = useMemo(() => {
        const chars = listCampaignCharacters(charactersById, locations);
        return buildRoster(chars, playersByUid);
    }, [charactersById, locations, playersByUid]);

    const viewer = useMemo(() => ({
        isDM,
        userId: profile?.uid || null,
        characterId: profile?.activeCharacterId || null,
        characterIds: profile?.characterIds || [],
    }), [isDM, profile]);

    const visibleClocks = useMemo(
        () => (clocks || EMPTY_CLOCKS).filter((c) => canViewClock(c, viewer)),
        [clocks, viewer],
    );

    const showIsland = isDM ? sessionOpen : visibleClocks.length > 0;

    const editorClock = useMemo(
        () => (editorId ? clocks.find((c) => c.id === editorId) : null),
        [clocks, editorId],
    );

    const rollClock = useMemo(
        () => (rollClockId ? clocks.find((c) => c.id === rollClockId) : null),
        [clocks, rollClockId],
    );

    const closeEditor = useCallback(() => {
        setEditorId(null);
        setPjOffset(0);
    }, []);

    useEffect(() => {
        if (!editorId) return undefined;
        const onDown = (e) => {
            if (stackRef.current?.contains(e.target)) return;
            closeEditor();
        };
        document.addEventListener("pointerdown", onDown);
        return () => document.removeEventListener("pointerdown", onDown);
    }, [editorId, closeEditor]);

    const openEditor = useCallback((clock) => {
        if (!isDM) return;
        if (clock && editorId === clock.id) {
            closeEditor();
            return;
        }
        setEditorId(clock?.id || null);
        setPjOffset(0);
    }, [isDM, editorId, closeEditor]);

    const handleAdd = useCallback(() => {
        const created = addClock({ name: "Clock" });
        if (created) {
            setEditorId(created.id);
            setPjOffset(0);
        }
    }, [addClock]);

    const maybeComplete = useCallback((clock, method, detail) => {
        if (!clock) return false;
        if (clock.filledHalfSteps < clock.sizeTicks * 2) return false;
        setFlashId(clock.id);
        window.setTimeout(() => {
            archiveOrComplete(clock.id, {
                result: "Completado",
                method,
                detail,
            });
            dispatch(showSnackbar({ message: `${clock.name} completado`, severity: "success" }));
            closeEditor();
            setFlashId(null);
        }, 320);
        return true;
    }, [archiveOrComplete, closeEditor, dispatch]);

    const jumpFill = useCallback((id, target) => {
        const current = clocks.find((c) => c.id === id);
        if (!current) return;
        const nextFill = jumpToHalfSteps(target, current.sizeTicks);
        const updated = setFilledHalfSteps(id, nextFill, { immediate: true });
        logEvent({
            clockInstanceId: id,
            method: "manual",
            deltaHalfSteps: nextFill - current.filledHalfSteps,
            filledHalfStepsAfter: nextFill,
            actorUserId: profile?.uid,
            rollScope: current.visibility?.rollScope,
        });
        if (updated) maybeComplete({ ...updated, filledHalfSteps: nextFill }, "manual", "Avance manual hasta llenar");
    }, [clocks, setFilledHalfSteps, logEvent, profile?.uid, maybeComplete]);

    const handleResolveConfirm = useCallback(async (payload, setPreview) => {
        const clock = rollClock;
        if (!clock || !canAttemptResolve(clock, viewer)) return;
        if (clock.resolveMode === CLOCK_RESOLVE_MODES.ACTIONS && !payload.actionId) {
            dispatch(showSnackbar({ message: "Elige una Action", severity: "warning" }));
            return;
        }

        let dice;
        let method;
        let selectionMode = "keep_highest";
        const actionDef = stats.find((s) => (s.key || s.id) === payload.actionId);
        const actorChar = viewer.characterId
            ? listCampaignCharacters(charactersById, locations).find((c) => c.id === viewer.characterId)
            : null;

        if (payload.kind === "actions" && actionDef && actorChar) {
            const rolled = rollIconActionDice(actorChar.stats?.[actionDef.key], actionDef.label || actionDef.key);
            dice = rolled.rolls;
            selectionMode = rolled.mode === "lowest" ? "keep_lowest" : "keep_highest";
            method = actionDef.label || actionDef.key;
        } else {
            const n = payload.diceCount || clock.diceCount || 2;
            dice = rollD6Pool(n);
            method = `${n}d6`;
            if (payload.kind === "actions" && actionDef) method = actionDef.label || actionDef.key;
        }

        const result = resolveClockRoll(dice, { selectionMode });
        setPreview?.({ dice, breakdown: result.breakdown });

        const applied = applyAdvance(clock, result.advanceHalfSteps);
        const granted = withConsumedGrant({ ...clock, filledHalfSteps: applied.filledHalfSteps }, viewer);
        upsertClock(granted, { immediate: true });

        const vis = visibleUserIdsForRoll(clock, profile?.uid);
        try {
            await sendChatMessage(campaignId, {
                type: CHAT_MESSAGE_TYPES.DICE,
                text: `${clock.name} · ${result.breakdown}`,
                senderId: profile?.uid,
                senderName: profile?.nickname ?? "Jugador",
                characterId: actorChar?.id ?? null,
                characterName: actorChar?.name ?? null,
                characterAvatarUrl: actorChar?.tokenImageUrl || actorChar?.imageUrl || null,
                diceResult: {
                    rolls: dice,
                    sides: 6,
                    total: result.effectiveDie,
                    mode: selectionMode === "keep_lowest" ? "lowest" : "highest",
                    formula: `${clock.name} · ${method}`,
                    kind: "clock",
                },
                diceFormula: `${clock.name} · ${method}`,
                clockInstanceId: clock.id,
                clockLabel: clock.name,
                rollScope: clock.visibility?.rollScope || "public",
                visibleToUserIds: vis,
            });
        } catch (err) {
            console.error(err);
        }

        logEvent({
            clockInstanceId: clock.id,
            method: "dice",
            deltaHalfSteps: result.advanceHalfSteps,
            filledHalfStepsAfter: applied.filledHalfSteps,
            actorUserId: profile?.uid,
            actorCharacterId: actorChar?.id ?? null,
            roll: { dice, selectionMode, effectiveDie: result.effectiveDie },
            rollScope: clock.visibility?.rollScope,
            visibleToUserIds: vis,
            breakdown: result.breakdown,
        });

        if (!maybeComplete({ ...granted, filledHalfSteps: applied.filledHalfSteps }, method, result.breakdown)) {
            setFlashId(clock.id);
            window.setTimeout(() => setFlashId(null), 700);
        }
    }, [
        rollClock, viewer, stats, charactersById, locations, upsertClock, campaignId,
        profile, dispatch, logEvent, maybeComplete,
    ]);

    const top = initiativeOpen
        ? VTT_HUD.inset + VTT_HUD.topIslandHeight + 8
        : VTT_HUD.inset;

    if (!showIsland) return null;

    return (
        <Box
            ref={stackRef}
            sx={{
                position: "fixed",
                top,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 1300,
                pointerEvents: "auto",
                width: VTT_TOP_CENTER_ISLAND_WIDTH,
            }}
        >
            <Box
                sx={{
                    ...HUD_SURFACE,
                    width: "100%",
                    height: VTT_HUD.topIslandHeight,
                    boxSizing: "border-box",
                    display: "flex",
                    alignItems: "stretch",
                    gap: 1,
                    px: 1.25,
                    py: 0.75,
                }}
            >
                <Box sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 64,
                    pr: 1.25,
                    borderRight: `1px solid ${UI_COLORS.border}`,
                    gap: 0.4,
                }}>
                    <CyberTitle sx={{ fontSize: "9px", letterSpacing: "2px", color: UI_COLORS.accent }}>
                        CLOCKS
                    </CyberTitle>
                    <CyberText sx={{ fontSize: "8px", letterSpacing: "1px", color: UI_COLORS.anomaly, fontFamily: TYPO.mono }}>
                        {visibleClocks.length} activos
                    </CyberText>
                </Box>

                <Box sx={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 0.75,
                    overflowX: "hidden",
                    overflowY: "visible",
                }}>
                    {visibleClocks.length === 0 && (
                        <CyberText sx={{ fontSize: "9px", letterSpacing: "0.08em", color: UI_COLORS.textSecondary, pl: 1, fontFamily: TYPO.mono }}>
                            SIN CLOCKS VISIBLES
                        </CyberText>
                    )}
                    {visibleClocks.map((c) => {
                        const theme = sizeTheme(c.sizeTicks);
                        const selected = editorId === c.id;
                        const secret = c.visibility.clockScope === CLOCK_SCOPES.DM_ONLY;
                        const canRoll = canAttemptResolve(c, viewer);
                        return (
                            <Box
                                key={c.id}
                                onClick={() => openEditor(c)}
                                sx={{
                                    position: "relative",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "2px",
                                    flexShrink: 0,
                                    width: 72,
                                    cursor: isDM ? "pointer" : "default",
                                    borderRadius: "5px",
                                    boxShadow: selected ? `0 0 0 1.5px ${theme.hex}` : "none",
                                    filter: flashId === c.id ? `drop-shadow(0 0 10px ${UI_COLORS.anomaly})` : "none",
                                    transition: "filter 0.18s ease, box-shadow 0.18s ease",
                                }}
                            >
                                <Box sx={{ width: 56, height: 56 }}>
                                    <ClockDial
                                        variant="island"
                                        sizeTicks={c.sizeTicks}
                                        filledHalfSteps={c.filledHalfSteps}
                                        allowResolve={canRoll}
                                        secret={secret}
                                        theme={theme}
                                        onResolve={(e) => {
                                            setRollClockId(c.id);
                                            setRollAnchor(e.currentTarget);
                                        }}
                                        ariaLabel={c.name}
                                    />
                                </Box>
                                <CyberTitle sx={{
                                    fontSize: "8px",
                                    letterSpacing: "0.06em",
                                    color: secret ? UI_COLORS.accent : UI_COLORS.textPrimary,
                                    maxWidth: 68,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    lineHeight: 1.1,
                                }}>
                                    {c.name || "Clock"}
                                </CyberTitle>
                            </Box>
                        );
                    })}
                </Box>

                {isDM && (
                    <Box sx={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        gap: 0.5,
                        pl: 0.75,
                        borderLeft: `1px solid ${UI_COLORS.border}`,
                    }}>
                        <CyberTooltip title="Nuevo clock">
                            <IconButton
                                size="small"
                                onClick={handleAdd}
                                sx={{
                                    width: 28,
                                    height: 22,
                                    borderRadius: "3px",
                                    border: `1px dashed ${UI_COLORS.accent}88`,
                                    color: UI_COLORS.accent,
                                }}
                            >
                                <AddIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                        </CyberTooltip>
                        <CyberTooltip title="Historial">
                            <IconButton
                                size="small"
                                onClick={() => setHistoryOpen(true)}
                                sx={{
                                    width: 28,
                                    height: 22,
                                    borderRadius: "3px",
                                    border: `1px solid ${UI_COLORS.border}`,
                                    color: UI_COLORS.textSecondary,
                                }}
                            >
                                <HistoryIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                        </CyberTooltip>
                    </Box>
                )}
            </Box>

            {isDM && editorClock && (
                <SessionClockZoomEditor
                    clock={editorClock}
                    isNew={editorClock.filledHalfSteps === 0 && editorClock.name === "Clock"}
                    roster={roster}
                    pjOffset={pjOffset}
                    onPjOffset={(dir) => {
                        const n = roster.length;
                        if (n <= 5) return;
                        setPjOffset((o) => (o + dir + n) % n);
                    }}
                    actionDefs={stats}
                    onPatch={(patch) => patchClock(editorClock.id, patch)}
                    onJumpFill={(target) => jumpFill(editorClock.id, target)}
                    onCycleSize={() => {
                        const next = cycleClockSize(editorClock.sizeTicks);
                        patchClock(editorClock.id, {
                            sizeTicks: next,
                            filledHalfSteps: jumpToHalfSteps(editorClock.filledHalfSteps, next),
                        });
                    }}
                    onDelete={() => {
                        archiveOrComplete(editorClock.id, {
                            result: "Archivado",
                            method: "archivado",
                            detail: "Eliminado sin completar",
                        });
                        closeEditor();
                    }}
                />
            )}

            <SessionClockHistoryDialog
                open={historyOpen}
                onClose={() => setHistoryOpen(false)}
                history={clockHistory}
            />

            <SessionClockResolvePopover
                open={Boolean(rollClock && rollAnchor)}
                anchorEl={rollAnchor}
                onClose={() => {
                    setRollClockId(null);
                    setRollAnchor(null);
                }}
                clock={rollClock}
                actionDefs={stats}
                onConfirm={handleResolveConfirm}
            />
        </Box>
    );
}

export default memo(SessionClocksIsland);
