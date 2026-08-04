import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Box, FormControlLabel, IconButton, MenuItem, Popover, Select, Switch, TextField,
} from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import AddIcon from "@mui/icons-material/Add";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RemoveIcon from "@mui/icons-material/Remove";
import SettingsIcon from "@mui/icons-material/Settings";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import PersonIcon from "@mui/icons-material/Person";
import CenterFocusStrongIcon from "@mui/icons-material/CenterFocusStrong";
import { CyberText, CyberTitle } from "../customs/CustomTexts";
import CyberTooltip from "../customs/CyberTooltip";
import { UI_COLORS } from "../../constants/uiColors";
import { VTT_HUD } from "../../constants/vttHudTokens";
import { cyberMenuItemSx, cyberMenuPaperSx } from "../../constants/designSystem";
import { listCampaignCharacters } from "../../utils/characterCombat";
import { useAssetUrl } from "../../hooks/useAssetUrl";
import { normalizeTokenCrop, tokenCropCss } from "../../utils/tokenImageFit";
import { isDmRole } from "../../utils/tokenControl";
import { useViewport } from "../../context/ViewportContext";
import {
    normalizeInitiative,
    updateInitiative,
} from "../../../firebase/services/gameService";
import { showSnackbar, setTurnFocus } from "../../store/uiSlice";

const MAX_VISIBLE = 8;
const ACTIVE_SIZE = 72;
const QUEUE_SIZE = 48;
const AUTO_PAN_KEY = "piximap.initiative.autoPan";

function readAutoPanPref() {
    try {
        const v = localStorage.getItem(AUTO_PAN_KEY);
        if (v === null) return true;
        return v !== "0" && v !== "false";
    } catch {
        return true;
    }
}

function writeAutoPanPref(on) {
    try {
        localStorage.setItem(AUTO_PAN_KEY, on ? "1" : "0");
    } catch {
        /* ignore */
    }
}

function newEntryUid() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return `init-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function buildVisibleSlots(entries, activeIndex) {
    const n = entries.length;
    if (n <= 0) return [];
    const count = Math.min(MAX_VISIBLE, n);
    const slots = [];
    for (let i = 0; i < count; i += 1) {
        const abs = (activeIndex + i) % n;
        const prevAbs = i > 0 ? (activeIndex + i - 1) % n : null;
        const crossedRound = i > 0 && prevAbs !== null && abs < prevAbs;
        slots.push({
            entry: entries[abs],
            absoluteIndex: abs,
            isActive: i === 0,
            isRoundStart: abs === 0,
            isRoundEnd: abs === n - 1,
            roundBoundaryBefore: crossedRound,
        });
    }
    return slots;
}

function smoothCenterOnWorld(viewport, worldX, worldY, time = 480) {
    if (!viewport || viewport.destroyed) return;
    const center = viewport.center;
    const dx = worldX - center.x;
    const dy = worldY - center.y;
    if (Math.hypot(dx, dy) < 4) {
        viewport.moveCenter(worldX, worldY);
        return;
    }
    if (typeof viewport.animate === "function") {
        viewport.animate({
            position: { x: worldX, y: worldY },
            time,
            ease: "easeInOutCubic",
            removeOnInterrupt: true,
        });
    } else {
        viewport.moveCenter(worldX, worldY);
    }
}

function TurnPortrait({
    char,
    name,
    size,
    active = false,
    initValue = null,
    onClick,
    dimmed = false,
}) {
    const imagePath = char?.tokenImageUrl || char?.imageUrl || null;
    const url = useAssetUrl(imagePath);
    const cropCss = tokenCropCss(normalizeTokenCrop(char?.tokenCrop));
    const initials = (name || "?").slice(0, 2).toUpperCase();

    return (
        <CyberTooltip title={name || "—"} placement="bottom">
            <Box
                component={onClick ? "button" : "div"}
                type={onClick ? "button" : undefined}
                onClick={onClick}
                sx={{
                    position: "relative",
                    width: size,
                    height: size,
                    p: 0,
                    flexShrink: 0,
                    borderRadius: 1,
                    border: active
                        ? `2px solid ${UI_COLORS.anomaly}`
                        : `1px solid ${UI_COLORS.accent}66`,
                    bgcolor: "#050508",
                    cursor: onClick ? "pointer" : "default",
                    overflow: "hidden",
                    opacity: dimmed ? 0.5 : 1,
                    boxShadow: active
                        ? `0 0 16px ${UI_COLORS.anomaly}55, inset 0 0 12px ${UI_COLORS.anomaly}22`
                        : `0 0 8px ${UI_COLORS.accent}22`,
                    transition: "transform 0.15s, box-shadow 0.15s, border-color 0.15s, opacity 0.15s",
                    transform: active ? "scale(1.06)" : "none",
                    "&:hover": onClick ? {
                        borderColor: UI_COLORS.accent,
                        boxShadow: `0 0 14px ${UI_COLORS.accent}55`,
                        transform: active ? "scale(1.08)" : "scale(1.04)",
                    } : {},
                }}
            >
                {url ? (
                    <Box
                        component="img"
                        src={url}
                        alt={name || ""}
                        decoding="sync"
                        loading="eager"
                        sx={{ width: "100%", height: "100%", display: "block", ...cropCss }}
                    />
                ) : (
                    <Box
                        sx={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            bgcolor: "rgba(20,10,30,0.9)",
                            fontFamily: "'Orbitron', sans-serif",
                            fontSize: size > 56 ? "0.85rem" : "0.55rem",
                            color: UI_COLORS.textSecondary,
                            letterSpacing: "0.06em",
                        }}
                    >
                        {initials || <PersonIcon sx={{ fontSize: size * 0.4 }} />}
                    </Box>
                )}
                <Box
                    sx={{
                        pointerEvents: "none",
                        position: "absolute",
                        inset: 0,
                        background: active
                            ? `linear-gradient(180deg, ${UI_COLORS.anomaly}18 0%, transparent 35%, transparent 65%, ${UI_COLORS.accent}14 100%)`
                            : `linear-gradient(180deg, ${UI_COLORS.accent}10 0%, transparent 40%)`,
                    }}
                />
                {initValue != null && (
                    <Box
                        sx={{
                            position: "absolute",
                            top: 2,
                            right: 2,
                            minWidth: 16,
                            px: 0.35,
                            py: "1px",
                            borderRadius: 0.5,
                            bgcolor: "rgba(0,0,0,0.72)",
                            border: `1px solid ${active ? UI_COLORS.anomaly : UI_COLORS.border}`,
                            fontFamily: "'Fira Code', monospace",
                            fontSize: "0.55rem",
                            lineHeight: 1.2,
                            color: active ? UI_COLORS.anomaly : UI_COLORS.textSecondary,
                            textAlign: "center",
                        }}
                    >
                        {initValue}
                    </Box>
                )}
            </Box>
        </CyberTooltip>
    );
}

function RoundMarker({ kind, round }) {
    const isStart = kind === "start";
    const label = isStart ? `R${round}` : "END";
    const color = isStart ? UI_COLORS.anomaly : UI_COLORS.accentStrong;
    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                alignSelf: "stretch",
                px: 0.6,
                minWidth: 28,
                gap: 0.25,
            }}
            aria-label={isStart ? `Inicio de ronda ${round}` : "Fin de ronda"}
        >
            <Box
                sx={{
                    width: 2,
                    flex: 1,
                    minHeight: 12,
                    borderRadius: 1,
                    background: `linear-gradient(180deg, transparent, ${color}, transparent)`,
                    boxShadow: `0 0 8px ${color}88`,
                }}
            />
            <CyberTitle
                sx={{
                    fontSize: "0.5rem",
                    letterSpacing: "0.14em",
                    color,
                    lineHeight: 1,
                    textShadow: `0 0 8px ${color}99`,
                }}
            >
                {label}
            </CyberTitle>
            <Box
                sx={{
                    width: 2,
                    flex: 1,
                    minHeight: 12,
                    borderRadius: 1,
                    background: `linear-gradient(180deg, transparent, ${color}, transparent)`,
                    boxShadow: `0 0 8px ${color}88`,
                }}
            />
        </Box>
    );
}

function ConfigRowPortrait({ char, name }) {
    const imagePath = char?.tokenImageUrl || char?.imageUrl || null;
    const url = useAssetUrl(imagePath);
    const cropCss = tokenCropCss(normalizeTokenCrop(char?.tokenCrop));
    return (
        <Box
            sx={{
                width: 36,
                height: 36,
                borderRadius: 1,
                overflow: "hidden",
                flexShrink: 0,
                border: `1px solid ${UI_COLORS.border}`,
                bgcolor: "#050508",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            {url ? (
                <Box component="img" src={url} alt={name || ""} sx={{ width: "100%", height: "100%", ...cropCss }} />
            ) : (
                <PersonIcon sx={{ fontSize: "1rem", color: UI_COLORS.textSecondary }} />
            )}
        </Box>
    );
}

/**
 * Shared top turn strip (BG3-style). DM controls; players view-only + auto-pan pref.
 */
export default function InitiativeTurnBar() {
    const dispatch = useDispatch();
    const viewport = useViewport();
    const initiative = useSelector((s) => s.game.initiative);
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const role = useSelector((s) => s.player.profile?.role);
    const mapId = useSelector((s) => s.world.activeMapId ?? s.world.map?.id);
    const gameActiveMapId = useSelector((s) => s.game.activeMapId);
    const tokenPositions = useSelector((s) => s.game.tokenPositions ?? {});
    const charactersById = useSelector((s) => s.world.charactersById ?? {});
    const locations = useSelector((s) => s.world.locations);

    const isDM = isDmRole(role);
    const open = initiative?.open === true;
    const started = initiative?.started === true;
    const entries = initiative?.entries ?? [];
    const activeIndex = initiative?.activeIndex ?? 0;
    const round = initiative?.round ?? 1;

    const [pickId, setPickId] = useState("");
    const [manageAnchor, setManageAnchor] = useState(null);
    const [autoPan, setAutoPan] = useState(readAutoPanPref);
    const [busy, setBusy] = useState(false);

    const displayMapId = isDM ? mapId : (gameActiveMapId ?? mapId);

    const roster = useMemo(
        () => listCampaignCharacters(charactersById, locations),
        [charactersById, locations],
    );

    const deployed = useMemo(() => {
        const onMap = tokenPositions[displayMapId] || {};
        return roster.filter((c) => onMap[c.id]);
    }, [roster, tokenPositions, displayMapId]);

    const charById = useMemo(() => {
        const m = new Map();
        for (const c of roster) m.set(c.id, c);
        return m;
    }, [roster]);

    const slots = useMemo(
        () => buildVisibleSlots(entries, activeIndex),
        [entries, activeIndex],
    );

    const overflow = Math.max(0, entries.length - MAX_VISIBLE);
    const dimmed = !started;

    const persist = useCallback(async (patch) => {
        if (!campaignId || !isDM) return;
        const next = normalizeInitiative({
            open,
            started,
            entries,
            activeIndex,
            round,
            ...patch,
        });
        setBusy(true);
        try {
            await updateInitiative(campaignId, next);
        } catch (err) {
            console.error(err);
            dispatch(showSnackbar({ message: "No se pudo actualizar iniciativa", severity: "error" }));
        } finally {
            setBusy(false);
        }
    }, [campaignId, isDM, open, started, entries, activeIndex, round, dispatch]);

    const lastFocusKeyRef = useRef("");

    // Pan + square focus flash when the active turn changes.
    useEffect(() => {
        if (!open || !started) return;
        const entry = entries[activeIndex];
        if (!entry?.id || !displayMapId) return;
        const pos = tokenPositions[displayMapId]?.[entry.id];
        if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return;

        const focusKey = `${entry.uid || entry.id}|${activeIndex}|${round}|${started}`;
        if (lastFocusKeyRef.current === focusKey) return;
        lastFocusKeyRef.current = focusKey;

        if (autoPan && viewport) {
            smoothCenterOnWorld(viewport, pos.x, pos.y);
        }
        dispatch(setTurnFocus({
            id: `tf-${focusKey}-${Date.now()}`,
            x: pos.x,
            y: pos.y,
            mapId: displayMapId,
            createdAt: Date.now(),
        }));
    }, [
        open, started, autoPan, viewport, entries, activeIndex, round,
        displayMapId, tokenPositions, dispatch,
    ]);

    const makeSlot = (char, init = 0) => ({
        uid: newEntryUid(),
        id: char.id,
        name: char.name || char.id,
        init: Number.isFinite(init) ? init : 0,
    });

    const handleAdd = () => {
        const char = deployed.find((c) => c.id === pickId) || deployed[0];
        if (!char) return;
        persist({ entries: [...entries, makeSlot(char, 0)] });
        setPickId("");
    };

    const handleAddAll = () => {
        if (!deployed.length) return;
        const present = new Set(entries.map((e) => e.id));
        const extra = deployed.filter((c) => !present.has(c.id)).map((c) => makeSlot(c, 0));
        if (extra.length) persist({ entries: [...entries, ...extra] });
    };

    const handleAddDuplicate = (characterId) => {
        const char = charById.get(characterId) || deployed.find((c) => c.id === characterId);
        if (!char) return;
        persist({ entries: [...entries, makeSlot(char, 0)] });
    };

    const move = (index, dir) => {
        const j = index + dir;
        if (j < 0 || j >= entries.length) return;
        const next = entries.slice();
        [next[index], next[j]] = [next[j], next[index]];
        let nextActive = activeIndex;
        if (activeIndex === index) nextActive = j;
        else if (activeIndex === j) nextActive = index;
        persist({ entries: next, activeIndex: nextActive });
    };

    const setInit = (index, value) => {
        const n = Math.floor(Number(value));
        const init = Number.isFinite(n) ? n : 0;
        persist({ entries: entries.map((e, i) => (i === index ? { ...e, init } : e)) });
    };

    const bumpInit = (index, delta) => {
        const cur = entries[index]?.init ?? 0;
        setInit(index, cur + delta);
    };

    const sortByInit = () => {
        const next = [...entries].sort((a, b) => (b.init ?? 0) - (a.init ?? 0));
        persist({ entries: next, activeIndex: 0 });
    };

    const removeAt = (index) => {
        const next = entries.filter((_, i) => i !== index);
        let nextActive = activeIndex;
        if (index < activeIndex) nextActive = Math.max(0, activeIndex - 1);
        else if (index === activeIndex) nextActive = Math.min(activeIndex, Math.max(0, next.length - 1));
        persist({
            entries: next,
            activeIndex: nextActive,
            ...(next.length === 0 ? { started: false, round: 1 } : {}),
        });
    };

    const handlePlay = () => {
        if (entries.length === 0) return;
        persist({ started: true, round: Math.max(1, round), activeIndex: activeIndex || 0 });
    };

    const handleAdvance = () => {
        if (!started || entries.length === 0) return;
        const next = (activeIndex + 1) % entries.length;
        const nextRound = next === 0 ? Math.max(1, round + 1) : round;
        persist({ activeIndex: next, round: nextRound });
    };

    const handleClose = () => {
        persist({ open: false });
        setManageAnchor(null);
    };

    const handleClear = () => {
        persist({
            entries: [],
            activeIndex: 0,
            round: 1,
            started: false,
        });
    };

    const handleAutoPanToggle = (on) => {
        setAutoPan(on);
        writeAutoPanPref(on);
    };

    if (!open) return null;

    return (
        <Box
            sx={{
                position: "fixed",
                top: VTT_HUD.inset,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 1300,
                pointerEvents: "auto",
                maxWidth: "min(920px, calc(100vw - 320px))",
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    px: 1.25,
                    py: 0.85,
                    borderRadius: `${VTT_HUD.borderRadius}px`,
                    border: `1px solid ${started ? `${UI_COLORS.anomaly}55` : `${UI_COLORS.accent}44`}`,
                    bgcolor: "rgba(8, 6, 16, 0.9)",
                    backdropFilter: "blur(16px)",
                    boxShadow: started
                        ? `0 0 28px ${UI_COLORS.anomaly}28, inset 0 0 24px rgba(0,242,234,0.06)`
                        : `0 0 28px ${UI_COLORS.accent}22, inset 0 0 24px rgba(0,242,234,0.04)`,
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        px: 0.75,
                        minWidth: 52,
                        borderRight: `1px solid ${UI_COLORS.border}`,
                        pr: 1.1,
                    }}
                >
                    <CyberTitle
                        sx={{
                            fontSize: "0.45rem",
                            letterSpacing: "0.18em",
                            color: UI_COLORS.textSecondary,
                            lineHeight: 1,
                        }}
                    >
                        {started ? "RONDA" : "STANDBY"}
                    </CyberTitle>
                    <CyberTitle
                        sx={{
                            fontSize: started ? "1.15rem" : "0.7rem",
                            letterSpacing: "0.06em",
                            color: started ? UI_COLORS.anomaly : UI_COLORS.accent,
                            lineHeight: 1.1,
                            textShadow: started
                                ? `0 0 12px ${UI_COLORS.anomaly}88`
                                : `0 0 10px ${UI_COLORS.accent}66`,
                            mt: 0.25,
                        }}
                    >
                        {started ? round : "PLAY"}
                    </CyberTitle>
                </Box>

                <Box
                    sx={{
                        display: "flex",
                        alignItems: "flex-end",
                        gap: 0.65,
                        flex: 1,
                        minWidth: 0,
                        overflow: "hidden",
                        py: 0.25,
                    }}
                >
                    {entries.length === 0 ? (
                        <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "0.72rem", py: 1, px: 0.5 }}>
                            {isDM
                                ? "Sin combatientes — abre el engranaje para armar el orden."
                                : "El DM aún no ha cargado combatientes."}
                        </CyberText>
                    ) : (
                        slots.map((slot, slotIdx) => {
                            const char = charById.get(slot.entry.id);
                            const nextWraps = slots[slotIdx + 1]?.roundBoundaryBefore;
                            const showEndAfter = started && slot.isRoundEnd && !nextWraps;
                            const showStartBefore = started && slot.isActive && slot.isRoundStart && !slot.roundBoundaryBefore;
                            return (
                                <Box
                                    key={slot.entry.uid || `${slot.entry.id}-${slot.absoluteIndex}`}
                                    sx={{ display: "flex", alignItems: "flex-end", gap: 0.65 }}
                                >
                                    {started && slot.roundBoundaryBefore && (
                                        <>
                                            <RoundMarker kind="end" round={round} />
                                            <RoundMarker kind="start" round={round + 1} />
                                        </>
                                    )}
                                    {showStartBefore && <RoundMarker kind="start" round={round} />}
                                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.35 }}>
                                        {slot.isActive && started && (
                                            <CyberTitle
                                                sx={{
                                                    fontSize: "0.48rem",
                                                    letterSpacing: "0.16em",
                                                    color: UI_COLORS.anomaly,
                                                    lineHeight: 1,
                                                }}
                                            >
                                                TURNO
                                            </CyberTitle>
                                        )}
                                        <TurnPortrait
                                            char={char}
                                            name={slot.entry.name}
                                            size={slot.isActive ? ACTIVE_SIZE : QUEUE_SIZE}
                                            active={slot.isActive && started}
                                            initValue={slot.entry.init}
                                            dimmed={dimmed && !slot.isActive}
                                            onClick={isDM ? () => persist({ activeIndex: slot.absoluteIndex }) : undefined}
                                        />
                                        <CyberText
                                            sx={{
                                                maxWidth: slot.isActive ? ACTIVE_SIZE + 8 : QUEUE_SIZE,
                                                fontSize: slot.isActive ? "0.62rem" : "0.52rem",
                                                color: slot.isActive && started
                                                    ? UI_COLORS.textPrimary
                                                    : UI_COLORS.textSecondary,
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                                textAlign: "center",
                                                lineHeight: 1.15,
                                            }}
                                        >
                                            {slot.entry.name}
                                        </CyberText>
                                    </Box>
                                    {showEndAfter && <RoundMarker kind="end" round={round} />}
                                </Box>
                            );
                        })
                    )}
                    {overflow > 0 && (
                        <CyberTitle
                            sx={{
                                alignSelf: "center",
                                fontSize: "0.55rem",
                                color: UI_COLORS.textSecondary,
                                letterSpacing: "0.08em",
                                px: 0.5,
                            }}
                        >
                            +{overflow}
                        </CyberTitle>
                    )}
                </Box>

                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        pl: 0.75,
                        borderLeft: `1px solid ${UI_COLORS.border}`,
                    }}
                >
                    {isDM && !started && (
                        <CyberTooltip title="Iniciar ronda 1">
                            <span>
                                <IconButton
                                    size="small"
                                    disabled={entries.length === 0 || busy}
                                    onClick={handlePlay}
                                    sx={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 1,
                                        color: UI_COLORS.accent,
                                        border: `1px solid ${UI_COLORS.accent}77`,
                                        bgcolor: `${UI_COLORS.accent}18`,
                                        boxShadow: `0 0 14px ${UI_COLORS.accent}44`,
                                        "&:hover": {
                                            bgcolor: `${UI_COLORS.accent}30`,
                                            boxShadow: `0 0 20px ${UI_COLORS.accent}66`,
                                        },
                                        "&.Mui-disabled": {
                                            color: UI_COLORS.textSecondary,
                                            borderColor: UI_COLORS.border,
                                            bgcolor: "transparent",
                                            boxShadow: "none",
                                        },
                                    }}
                                >
                                    <PlayArrowIcon />
                                </IconButton>
                            </span>
                        </CyberTooltip>
                    )}
                    {isDM && (
                        <CyberTooltip title={started ? "Pasar turno" : "Dale a Play para empezar"}>
                            <span>
                                <IconButton
                                    size="small"
                                    disabled={!started || entries.length === 0 || busy}
                                    onClick={handleAdvance}
                                    sx={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 1,
                                        color: UI_COLORS.anomaly,
                                        border: `1px solid ${UI_COLORS.anomaly}66`,
                                        bgcolor: `${UI_COLORS.anomaly}14`,
                                        boxShadow: started ? `0 0 12px ${UI_COLORS.anomaly}33` : "none",
                                        "&:hover": {
                                            bgcolor: `${UI_COLORS.anomaly}28`,
                                            boxShadow: `0 0 18px ${UI_COLORS.anomaly}55`,
                                        },
                                        "&.Mui-disabled": {
                                            color: UI_COLORS.textSecondary,
                                            borderColor: UI_COLORS.border,
                                            bgcolor: "transparent",
                                            boxShadow: "none",
                                        },
                                    }}
                                >
                                    <SkipNextIcon />
                                </IconButton>
                            </span>
                        </CyberTooltip>
                    )}
                    <CyberTooltip title={isDM ? "Configurar iniciativa" : "Opciones de vista"}>
                        <IconButton
                            size="small"
                            onClick={(e) => setManageAnchor(e.currentTarget)}
                            sx={{
                                color: manageAnchor ? UI_COLORS.accent : UI_COLORS.textSecondary,
                                border: `1px solid ${manageAnchor ? UI_COLORS.accent : UI_COLORS.border}`,
                                borderRadius: 1,
                            }}
                        >
                            <SettingsIcon fontSize="small" />
                        </IconButton>
                    </CyberTooltip>
                    {isDM && (
                        <CyberTooltip title="Cerrar tracker (sigue visible el estado hasta limpiar)">
                            <IconButton
                                size="small"
                                onClick={handleClose}
                                disabled={busy}
                                sx={{
                                    color: UI_COLORS.textSecondary,
                                    border: `1px solid ${UI_COLORS.border}`,
                                    borderRadius: 1,
                                }}
                            >
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </CyberTooltip>
                    )}
                </Box>
            </Box>

            <Popover
                open={Boolean(manageAnchor)}
                anchorEl={manageAnchor}
                onClose={() => setManageAnchor(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                slotProps={{
                    paper: {
                        sx: {
                            mt: 1,
                            width: 400,
                            maxHeight: "min(74vh, 580px)",
                            bgcolor: "rgba(10, 8, 18, 0.97)",
                            border: `1px solid ${UI_COLORS.accent}44`,
                            borderRadius: 2,
                            boxShadow: `0 0 24px ${UI_COLORS.accent}33`,
                            overflow: "hidden",
                            display: "flex",
                            flexDirection: "column",
                        },
                    },
                }}
            >
                <Box sx={{ px: 1.5, py: 1.15, borderBottom: `1px solid ${UI_COLORS.border}` }}>
                    <CyberTitle sx={{ fontSize: "0.72rem", color: UI_COLORS.accent, letterSpacing: "0.14em" }}>
                        {isDM ? "CONFIG · INICIATIVA" : "VISTA · INICIATIVA"}
                    </CyberTitle>
                    <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.textSecondary, mt: 0.35 }}>
                        {isDM
                            ? "Arma el orden, pulsa Play para arrancar la ronda 1. Los jugadores solo ven la barra."
                            : "Puedes seguir la cámara al turno activo. El orden lo controla el DM."}
                    </CyberText>
                </Box>

                <Box
                    sx={{
                        px: 1.5,
                        py: 1.1,
                        borderBottom: `1px solid ${UI_COLORS.border}`,
                        bgcolor: "rgba(0,242,234,0.04)",
                    }}
                >
                    <FormControlLabel
                        control={(
                            <Switch
                                size="small"
                                checked={autoPan}
                                onChange={(e) => handleAutoPanToggle(e.target.checked)}
                                sx={{
                                    "& .MuiSwitch-switchBase.Mui-checked": { color: UI_COLORS.anomaly },
                                    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                                        backgroundColor: UI_COLORS.anomaly,
                                    },
                                }}
                            />
                        )}
                        label={(
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                                <CenterFocusStrongIcon sx={{ fontSize: "1rem", color: UI_COLORS.anomaly }} />
                                <Box>
                                    <CyberText sx={{ color: UI_COLORS.textPrimary, fontSize: "0.78rem", display: "block" }}>
                                        Seguir token del turno
                                    </CyberText>
                                    <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "0.62rem", display: "block" }}>
                                        Mueve la cámara cuando cambie el turno activo
                                    </CyberText>
                                </Box>
                            </Box>
                        )}
                        sx={{ m: 0, alignItems: "flex-start", gap: 0.5 }}
                    />
                </Box>

                {isDM && (
                    <>
                        <Box sx={{ px: 1.5, py: 1.1, display: "flex", flexDirection: "column", gap: 1 }}>
                            <CyberTitle sx={{ fontSize: "0.55rem", color: UI_COLORS.textSecondary, letterSpacing: "0.12em" }}>
                                AÑADIR COMBATIENTES
                            </CyberTitle>
                            <Box sx={{ display: "flex", gap: 0.75, alignItems: "center" }}>
                                <Select
                                    size="small"
                                    displayEmpty
                                    value={pickId}
                                    onChange={(e) => setPickId(e.target.value)}
                                    MenuProps={{ PaperProps: { sx: cyberMenuPaperSx } }}
                                    sx={{
                                        flex: 1,
                                        height: 36,
                                        color: UI_COLORS.textPrimary,
                                        bgcolor: "rgba(0,0,0,0.35)",
                                        "& .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.border },
                                        "& .MuiSvgIcon-root": { color: UI_COLORS.textSecondary },
                                    }}
                                >
                                    <MenuItem value="" sx={cyberMenuItemSx}>
                                        <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "0.72rem" }}>
                                            Elegir token desplegado…
                                        </CyberText>
                                    </MenuItem>
                                    {deployed.map((c) => (
                                        <MenuItem key={c.id} value={c.id} sx={cyberMenuItemSx}>
                                            <CyberText sx={{ color: UI_COLORS.textPrimary, fontSize: "0.78rem" }}>
                                                {c.name || c.id}
                                            </CyberText>
                                        </MenuItem>
                                    ))}
                                </Select>
                                <CyberTooltip title="Añadir un turno (puedes repetir el mismo personaje)">
                                    <span>
                                        <IconButton
                                            size="small"
                                            disabled={deployed.length === 0 || busy}
                                            onClick={handleAdd}
                                            sx={{
                                                width: 36,
                                                height: 36,
                                                color: UI_COLORS.accent,
                                                border: `1px solid ${UI_COLORS.accent}55`,
                                                borderRadius: 1,
                                                bgcolor: `${UI_COLORS.accent}12`,
                                            }}
                                        >
                                            <PersonAddAlt1Icon fontSize="small" />
                                        </IconButton>
                                    </span>
                                </CyberTooltip>
                            </Box>
                            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                                <Box
                                    component="button"
                                    type="button"
                                    disabled={deployed.length === 0 || busy}
                                    onClick={handleAddAll}
                                    sx={{
                                        border: `1px solid ${UI_COLORS.anomaly}55`,
                                        bgcolor: `${UI_COLORS.anomaly}12`,
                                        color: UI_COLORS.anomaly,
                                        borderRadius: 1,
                                        px: 1.1,
                                        py: 0.55,
                                        cursor: "pointer",
                                        fontFamily: "'Orbitron', sans-serif",
                                        fontSize: "0.55rem",
                                        letterSpacing: "0.1em",
                                        opacity: deployed.length === 0 ? 0.4 : 1,
                                    }}
                                >
                                    AÑADIR TODOS
                                </Box>
                                <Box
                                    component="button"
                                    type="button"
                                    disabled={entries.length < 2 || busy}
                                    onClick={sortByInit}
                                    sx={{
                                        border: `1px solid ${UI_COLORS.border}`,
                                        bgcolor: "rgba(0,0,0,0.28)",
                                        color: UI_COLORS.textSecondary,
                                        borderRadius: 1,
                                        px: 1.1,
                                        py: 0.55,
                                        cursor: "pointer",
                                        fontFamily: "'Orbitron', sans-serif",
                                        fontSize: "0.55rem",
                                        letterSpacing: "0.1em",
                                        opacity: entries.length < 2 ? 0.4 : 1,
                                    }}
                                >
                                    ORDENAR POR INIT
                                </Box>
                                {!started && entries.length > 0 && (
                                    <Box
                                        component="button"
                                        type="button"
                                        disabled={busy}
                                        onClick={handlePlay}
                                        sx={{
                                            border: `1px solid ${UI_COLORS.accent}77`,
                                            bgcolor: `${UI_COLORS.accent}18`,
                                            color: UI_COLORS.accent,
                                            borderRadius: 1,
                                            px: 1.1,
                                            py: 0.55,
                                            cursor: "pointer",
                                            fontFamily: "'Orbitron', sans-serif",
                                            fontSize: "0.55rem",
                                            letterSpacing: "0.1em",
                                            boxShadow: `0 0 12px ${UI_COLORS.accent}33`,
                                        }}
                                    >
                                        ▶ INICIAR COMBATE
                                    </Box>
                                )}
                            </Box>
                        </Box>

                        <Box
                            sx={{
                                flex: 1,
                                overflowY: "auto",
                                px: 1.25,
                                pb: 1.25,
                                display: "flex",
                                flexDirection: "column",
                                gap: 0.65,
                            }}
                        >
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 0.25 }}>
                                <CyberTitle sx={{ fontSize: "0.55rem", color: UI_COLORS.textSecondary, letterSpacing: "0.12em" }}>
                                    ORDEN DE TURNOS ({entries.length})
                                </CyberTitle>
                                {entries.length > 0 && (
                                    <Box
                                        component="button"
                                        type="button"
                                        onClick={handleClear}
                                        disabled={busy}
                                        sx={{
                                            border: "none",
                                            bgcolor: "transparent",
                                            color: UI_COLORS.accentStrong,
                                            cursor: "pointer",
                                            fontFamily: "'Fira Sans', sans-serif",
                                            fontSize: "0.68rem",
                                            p: 0,
                                        }}
                                    >
                                        Limpiar todo
                                    </Box>
                                )}
                            </Box>

                            {entries.length === 0 ? (
                                <Box
                                    sx={{
                                        py: 2.5,
                                        px: 1.5,
                                        borderRadius: 1.5,
                                        border: `1px dashed ${UI_COLORS.border}`,
                                        textAlign: "center",
                                    }}
                                >
                                    <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "0.78rem" }}>
                                        Despliega tokens en el mapa y añádelos aquí.
                                        Puedes dar varios turnos al mismo personaje.
                                    </CyberText>
                                </Box>
                            ) : (
                                entries.map((entry, index) => {
                                    const active = index === activeIndex;
                                    const char = charById.get(entry.id);
                                    return (
                                        <Box
                                            key={entry.uid || `${entry.id}-${index}`}
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 0.75,
                                                px: 0.85,
                                                py: 0.65,
                                                borderRadius: 1.5,
                                                border: `1px solid ${active ? UI_COLORS.anomaly : UI_COLORS.border}`,
                                                bgcolor: active ? `${UI_COLORS.anomaly}14` : "rgba(0,0,0,0.28)",
                                                boxShadow: active ? `0 0 12px ${UI_COLORS.anomaly}22` : "none",
                                            }}
                                        >
                                            <CyberTitle
                                                sx={{
                                                    fontSize: "0.55rem",
                                                    color: active ? UI_COLORS.anomaly : UI_COLORS.textSecondary,
                                                    width: 18,
                                                    textAlign: "center",
                                                }}
                                            >
                                                {index + 1}
                                            </CyberTitle>
                                            <ConfigRowPortrait char={char} name={entry.name} />
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <CyberText
                                                    sx={{
                                                        fontSize: "0.78rem",
                                                        color: UI_COLORS.textPrimary,
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {entry.name}
                                                </CyberText>
                                                {active && (
                                                    <CyberTitle
                                                        sx={{
                                                            fontSize: "0.45rem",
                                                            letterSpacing: "0.12em",
                                                            color: UI_COLORS.anomaly,
                                                        }}
                                                    >
                                                        {started ? "TURNO ACTIVO" : "PRIMERO AL PLAY"}
                                                    </CyberTitle>
                                                )}
                                            </Box>

                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    border: `1px solid ${UI_COLORS.border}`,
                                                    borderRadius: 1,
                                                    bgcolor: "rgba(0,0,0,0.35)",
                                                    overflow: "hidden",
                                                }}
                                            >
                                                <IconButton
                                                    size="small"
                                                    onClick={() => bumpInit(index, -1)}
                                                    sx={{ color: UI_COLORS.textSecondary, p: 0.35, borderRadius: 0 }}
                                                >
                                                    <RemoveIcon sx={{ fontSize: "0.85rem" }} />
                                                </IconButton>
                                                <TextField
                                                    size="small"
                                                    value={entry.init ?? 0}
                                                    onChange={(e) => {
                                                        const raw = e.target.value.replace(/[^\d-]/g, "");
                                                        setInit(index, raw === "" || raw === "-" ? 0 : raw);
                                                    }}
                                                    inputProps={{
                                                        style: {
                                                            width: 28,
                                                            textAlign: "center",
                                                            padding: "4px 0",
                                                            fontFamily: "Fira Code, monospace",
                                                            fontSize: "0.75rem",
                                                            color: UI_COLORS.textPrimary,
                                                        },
                                                    }}
                                                    sx={{
                                                        width: 36,
                                                        "& .MuiOutlinedInput-root": { height: 28 },
                                                        "& .MuiOutlinedInput-notchedOutline": { border: "none" },
                                                    }}
                                                />
                                                <IconButton
                                                    size="small"
                                                    onClick={() => bumpInit(index, 1)}
                                                    sx={{ color: UI_COLORS.textSecondary, p: 0.35, borderRadius: 0 }}
                                                >
                                                    <AddIcon sx={{ fontSize: "0.85rem" }} />
                                                </IconButton>
                                            </Box>

                                            <CyberTooltip title="Otro turno de este personaje">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleAddDuplicate(entry.id)}
                                                    sx={{ color: UI_COLORS.accent, p: 0.3 }}
                                                >
                                                    <PersonAddAlt1Icon sx={{ fontSize: "1rem" }} />
                                                </IconButton>
                                            </CyberTooltip>
                                            <IconButton
                                                size="small"
                                                onClick={() => move(index, -1)}
                                                disabled={index === 0}
                                                sx={{ color: UI_COLORS.textSecondary, p: 0.25 }}
                                            >
                                                <ArrowUpwardIcon sx={{ fontSize: "0.95rem" }} />
                                            </IconButton>
                                            <IconButton
                                                size="small"
                                                onClick={() => move(index, 1)}
                                                disabled={index === entries.length - 1}
                                                sx={{ color: UI_COLORS.textSecondary, p: 0.25 }}
                                            >
                                                <ArrowDownwardIcon sx={{ fontSize: "0.95rem" }} />
                                            </IconButton>
                                            <IconButton
                                                size="small"
                                                onClick={() => removeAt(index)}
                                                sx={{ color: UI_COLORS.accentStrong, p: 0.25 }}
                                            >
                                                <DeleteOutlineIcon sx={{ fontSize: "1rem" }} />
                                            </IconButton>
                                        </Box>
                                    );
                                })
                            )}
                        </Box>
                    </>
                )}
            </Popover>
        </Box>
    );
}
