import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Box, IconButton, Tooltip } from "@mui/material";
import ChatIcon from "@mui/icons-material/Chat";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { UI_COLORS } from "../../constants/uiColors";
import { updateCharacterFields } from "../../../firebase/services/characterService";
import { uploadCharacterImage } from "../../../firebase/services/assetLoader";
import { callAbilityInChat } from "../../../firebase/services/chatService";
import { useAssetUrl } from "../../hooks/useAssetUrl";
import { useDossier } from "../CharactersSettingsDialog";
import MacroPinButton from "./MacroPinButton";
import BurdenClock from "./BurdenClock";
import BurdenMark from "./BurdenMark";
import BurdenViewer from "./BurdenViewer";
import BurdenEffectFields from "./BurdenEffectFields";
import { MACRO_SLOT_TYPES } from "../../constants/macroBar";
import { normalizeTokenCrop, tokenCropCss } from "../../utils/tokenImageFit";
import {
    normalizeBurdens,
    emptyBurden,
    getActionPenance,
    effectiveActionDice,
    isBondPowerNullified,
    BURDEN_EFFECT_TYPES,
    isBurdenClockCleared,
} from "../../utils/characterBurdens";
import { updateCharacterInList } from "../../store/characterSlice";
import { updateCharacterInState } from "../../store/worldSlice";
import { isDmRole } from "../../utils/tokenControl";
import { useSkillMatrixAbilities } from "../tabs/subtabs/skillMatrix/skillMatrixUtils";

/* ── colour tokens ──────────────────────────────────────────────── */
const C = {
    border:  UI_COLORS.border,
    text:    "#ffffff",
    pink:    UI_COLORS.accent,
    cyan:    UI_COLORS.anomaly,
    lb:      "#ffcc33",
    danger:  "#ff3355",
};

const SCROLL_SX = {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    "&::-webkit-scrollbar": { width: "6px" },
    "&::-webkit-scrollbar-thumb": {
        background: `rgba(0,242,234,0.25)`,
        borderRadius: "3px",
    },
    "&::-webkit-scrollbar-track": { background: "transparent" },
};

const ACTION_KEYS = ["sneak","traverse","sense","study","charm","command","tinker","excel","smash","endure"];
/** ICON narrative actions: each score caps at 4. */
const MAX_STAT = 4;

/** Stable id for list keys / edits — never use mutable `name`/`title` (breaks controlled inputs). */
function resolveBondPowerId(bp, index) {
    if (bp?.id != null && String(bp.id).trim() !== "") return String(bp.id);
    if (bp?.key != null && String(bp.key).trim() !== "") return String(bp.key);
    return `bp_idx_${index}`;
}

const tooltipSlotProps = {
    tooltip: {
        sx: {
            bgcolor: "#0a0a14",
            color: "#ffffff",
            border: `1px solid ${UI_COLORS.border}`,
            fontSize: "0.72rem",
        },
    },
};

/* ── Segmented action row (ref design) ───────────────────────────── */
function ActionSegmentRow({
    actionKey,
    value,
    effectiveValue = null,
    penance = 0,
    selected,
    editMode,
    onSelect,
    onChange,
    editorKey,
}) {
    const v = Math.max(0, Number(value) || 0);
    const eff = effectiveValue != null ? Math.max(0, Number(effectiveValue) || 0) : v;
    const over = v > MAX_STAT;
    const fill = Math.min(v, MAX_STAT);
    const hasPenance = Number(penance) > 0;
    const accent = hasPenance || over ? C.danger : C.pink;

    return (
        <Box
            className={`dossier-stat-row${selected ? " is-selected" : ""}`}
            data-dossier-editor={editorKey || undefined}
            onClick={onSelect}
            title={hasPenance ? `Base ${v} · penalty −${penance} → ${eff}` : undefined}
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                p: "4px 4px",
                borderRadius: "5px",
                border: `1px solid ${selected ? C.cyan : "transparent"}`,
                bgcolor: selected ? "rgba(0,242,234,0.06)" : "transparent",
                cursor: editMode ? "pointer" : "default",
                "&:hover": { bgcolor: "rgba(255,102,255,0.05)" },
            }}
        >
            <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 0.75 }}>
                <Box sx={{
                    fontFamily: '"Fira Code", monospace',
                    fontSize: "0.58rem",
                    color: "#ffffff",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                }}>
                    {actionKey}
                </Box>
                <Box sx={{
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "0.72rem",
                    color: accent,
                    lineHeight: 1,
                }}>
                    {hasPenance ? eff : v}
                </Box>
            </Box>
            <Box sx={{ display: "flex", gap: "3px" }}>
                {Array.from({ length: MAX_STAT }, (_, i) => {
                    const filled = i < fill;
                    return (
                        <Box
                            key={i}
                            component={editMode ? "button" : "div"}
                            type={editMode ? "button" : undefined}
                            onClick={editMode ? (e) => {
                                e.stopPropagation();
                                const next = i < fill && i === fill - 1 ? i : i + 1;
                                onChange(next);
                            } : undefined}
                            sx={{
                                flex: 1,
                                height: 10,
                                borderRadius: "2px",
                                border: `1px solid ${filled ? accent : "rgba(255,255,255,0.18)"}`,
                                bgcolor: filled ? accent : "transparent",
                                boxShadow: filled ? `0 0 6px ${accent}44` : "none",
                                p: 0,
                                cursor: editMode ? "pointer" : "default",
                                transition: "background 0.12s, border-color 0.12s",
                                "&:hover": editMode ? {
                                    borderColor: accent,
                                    bgcolor: filled ? accent : `${accent}33`,
                                } : {},
                            }}
                        />
                    );
                })}
            </Box>
        </Box>
    );
}

/* ── NarrCard ─────────────────────────────────────────────────────── */
function NarrCard({
    tag,
    tagColor,
    title,
    text,
    frequency = null,
    selKey,
    selected,
    onSelect,
    editMode,
    onSave,
    onSaveTitle,
    onSaveFrequency,
    onSendToChat,
    onDelete,
    compact = false,
    character = null,
    macroEntry = null,
    burdenDisabled = false,
    burdenDisabledLabel = "NULLIFIED",
}) {
    const { spawnPing } = useDossier();
    const isSelected = selected === selKey;
    const isBond = selKey?.startsWith("bond:");
    const editing = Boolean(editMode && isSelected);
    const canEditTitle = editing && typeof onSaveTitle === "function";
    const canEditFrequency = editing && typeof onSaveFrequency === "function";

    const handleClick = (e) => {
        if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT" || e.target.closest?.("button")) return;
        onSelect(selKey);
        spawnPing(e.clientX, e.clientY);
    };

    const metaInputSx = {
        fontFamily: "Orbitron, sans-serif",
        fontSize: "0.82rem",
        letterSpacing: "0.1em",
        color: "#ffffff",
        bgcolor: "rgba(0,0,0,0.45)",
        border: `1px solid rgba(255,102,255,0.35)`,
        borderRadius: "4px",
        outline: "none",
        px: "8px",
        py: "4px",
        minWidth: 0,
        "&::placeholder": { color: "rgba(255,255,255,0.35)", opacity: 1 },
        "&:focus": { borderColor: C.cyan, boxShadow: `0 0 10px ${C.cyan}33` },
    };

    return (
        <Box
            className={`dossier-narr-card${isSelected ? " is-selected" : ""}`}
            data-dossier-editor={selKey}
            onClick={handleClick}
            sx={{
                position: "relative",
                mb: compact ? 0 : "10px",
                p: "12px 14px",
                border: `1px solid ${burdenDisabled ? `${C.danger}88` : isSelected ? C.cyan : C.border}`,
                borderRadius: "8px",
                bgcolor: burdenDisabled ? "rgba(255,51,85,0.06)" : "rgba(0,0,0,0.28)",
                cursor: "pointer",
                flex: compact ? 1 : undefined,
                minWidth: 0,
                opacity: burdenDisabled ? 0.72 : 1,
                boxShadow: isSelected ? `0 0 18px rgba(0,242,234,0.12)` : "none",
                transition: "border-color 0.18s, box-shadow 0.18s, transform 0.15s",
                "&:hover": { borderColor: burdenDisabled ? C.danger : "rgba(255,102,255,0.4)", transform: "translateY(-1px)" },
                ...(burdenDisabled ? {
                    "&::after": {
                        content: '""',
                        position: "absolute",
                        left: 12,
                        right: 12,
                        top: "50%",
                        height: "1px",
                        bgcolor: `${C.danger}66`,
                        pointerEvents: "none",
                        zIndex: 1,
                    },
                } : {}),
            }}
        >
            <div className="dossier-brackets" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                <span className="tl" /><span className="tr" /><span className="bl" /><span className="br" />
            </div>

            <Box sx={{ display: "flex", alignItems: "center", gap: "8px", mb: "6px", flexWrap: "wrap" }}>
                <Box component="span" sx={{
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "0.62rem",
                    letterSpacing: "0.1em",
                    color: "#ffffff",
                    border: `1px solid ${tagColor ? tagColor + "88" : "rgba(255,204,51,0.55)"}`,
                    px: "6px", py: "2px", borderRadius: "3px",
                    flexShrink: 0,
                }}>
                    {tag}
                </Box>
                {burdenDisabled && (
                    <Box component="span" sx={{
                        fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.48rem",
                        letterSpacing: "0.1em",
                        color: C.danger,
                        border: `1px solid ${C.danger}88`,
                        px: "5px", py: "1px", borderRadius: "2px",
                        flexShrink: 0,
                    }}>
                        {burdenDisabledLabel}
                    </Box>
                )}
                {canEditTitle ? (
                    <Box
                        component="input"
                        value={title || ""}
                        placeholder="TÍTULO"
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => onSaveTitle(e.target.value)}
                        sx={{ ...metaInputSx, flex: "1 1 140px", maxWidth: "100%" }}
                    />
                ) : (
                    <Box component="span" sx={{
                        fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.82rem",
                        letterSpacing: "0.1em",
                        color: "#ffffff",
                        flex: 1,
                        minWidth: 0,
                    }}>
                        {title}
                    </Box>
                )}
                {(canEditFrequency || (frequency != null && String(frequency).trim() !== "")) && (
                    canEditFrequency ? (
                        <Box
                            component="input"
                            value={frequency || ""}
                            placeholder="FRECUENCIA · ej. 1/sesión"
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => onSaveFrequency(e.target.value)}
                            sx={{
                                ...metaInputSx,
                                flex: "0 1 200px",
                                fontSize: "0.62rem",
                                letterSpacing: "0.08em",
                                color: C.cyan,
                                borderColor: "rgba(0,242,234,0.35)",
                            }}
                        />
                    ) : (
                        <Box component="span" sx={{
                            fontFamily: "Orbitron, sans-serif",
                            fontSize: "0.58rem",
                            letterSpacing: "0.08em",
                            color: C.cyan,
                            border: `1px solid ${C.cyan}55`,
                            px: "6px",
                            py: "2px",
                            borderRadius: "3px",
                            flexShrink: 0,
                            maxWidth: "46%",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}>
                            {frequency}
                        </Box>
                    )
                )}
                <Box sx={{ display: "flex", gap: 0.25, flexShrink: 0, ml: "auto" }} onClick={(e) => e.stopPropagation()}>
                    {typeof onDelete === "function" && editMode && (
                        <Tooltip title="Eliminar bond power" slotProps={tooltipSlotProps}>
                            <IconButton
                                size="small"
                                aria-label="Eliminar bond power"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete();
                                }}
                                sx={{
                                    color: "#ffffff",
                                    border: `1px solid ${C.border}`,
                                    width: 28,
                                    height: 28,
                                    "&:hover": { borderColor: C.danger, bgcolor: `${C.danger}22`, color: C.danger },
                                }}
                            >
                                <DeleteOutlineIcon sx={{ fontSize: "0.95rem" }} />
                            </IconButton>
                        </Tooltip>
                    )}
                    {macroEntry && character && (
                        <MacroPinButton character={character} entry={macroEntry} size="tiny" />
                    )}
                    {typeof onSendToChat === "function" && (
                        <Tooltip title={burdenDisabled ? "Deshabilitado por Burden" : "Lanzar en chat"} slotProps={tooltipSlotProps}>
                            <span>
                                <IconButton
                                    size="small"
                                    aria-label="Lanzar en chat"
                                    disabled={burdenDisabled}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (burdenDisabled) return;
                                        onSendToChat();
                                    }}
                                    sx={{
                                        color: burdenDisabled ? "rgba(255,255,255,0.32)" : "#ffffff",
                                        border: `1px solid ${C.border}`,
                                        width: 28,
                                        height: 28,
                                        "&.Mui-disabled": { color: "rgba(255,255,255,0.32)" },
                                        "&:hover": { borderColor: C.pink, bgcolor: `${C.pink}18` },
                                    }}
                                >
                                    <ChatIcon sx={{ fontSize: "0.95rem" }} />
                                </IconButton>
                            </span>
                        </Tooltip>
                    )}
                </Box>
            </Box>

            {editing ? (
                <textarea
                    value={text || ""}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onSave && onSave(e.target.value)}
                    style={{
                        width: "100%",
                        minHeight: isBond ? "110px" : "72px",
                        marginTop: "4px",
                        resize: "vertical",
                        background: "rgba(0,0,0,0.45)",
                        border: `1px solid rgba(255,102,255,0.35)`,
                        color: "#ffffff",
                        fontFamily: '"Fira Sans", sans-serif',
                        fontSize: "0.9rem",
                        padding: "8px",
                        borderRadius: "4px",
                    }}
                />
            ) : (
                <Box component="p" sx={{
                    m: 0,
                    fontSize: "0.9rem",
                    color: "#ffffff",
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                }}>
                    {text || <em style={{ opacity: 0.45 }}>Sin texto</em>}
                </Box>
            )}
        </Box>
    );
}

/* ── RadarSVG ─────────────────────────────────────────────────────── */
function RadarSvg({ stats, maxStat }) {
    const gradId = `radar-fill-${useId().replace(/:/g, "")}`;
    const n = ACTION_KEYS.length;
    const size = 220;
    const cx = size / 2;
    const cy = size / 2;
    const R = 78;
    const labelR = R + 20;

    const angleAt = (i) => (-Math.PI / 2) + (i * 2 * Math.PI) / n;
    const xy = (i, r) => [cx + Math.cos(angleAt(i)) * r, cy + Math.sin(angleAt(i)) * r];
    const polyFor = (radius) => ACTION_KEYS.map((_, i) => xy(i, radius).join(",")).join(" ");

    const values = ACTION_KEYS.map((k) => Math.min(maxStat, Math.max(0, Number(stats[k]) || 0)));
    const dataPts = values.map((v, i) => xy(i, (v / maxStat) * R));
    const dataPoly = dataPts.map((p) => p.join(",")).join(" ");

    return (
        <svg viewBox={`0 0 ${size} ${size}`} style={{ width: "100%", maxWidth: 220, display: "block" }} aria-hidden>
            <defs>
                <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={C.pink} stopOpacity="0.55" />
                    <stop offset="100%" stopColor={C.cyan} stopOpacity="0.28" />
                </linearGradient>
                <filter id={`${gradId}-glow`} x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="2.2" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {/* Scale rings (1 … maxStat) */}
            {Array.from({ length: maxStat }, (_, ring) => {
                const level = ring + 1;
                const r = (level / maxStat) * R;
                const isOuter = level === maxStat;
                return (
                    <polygon
                        key={`ring-${level}`}
                        points={polyFor(r)}
                        fill={isOuter ? "rgba(0,242,234,0.03)" : "none"}
                        stroke={isOuter ? "rgba(0,242,234,0.35)" : "rgba(42,42,61,0.95)"}
                        strokeWidth={isOuter ? 1.4 : 1}
                        strokeDasharray={isOuter ? undefined : "3 4"}
                    />
                );
            })}

            {/* Axes + labels */}
            {ACTION_KEYS.map((key, i) => {
                const [x2, y2] = xy(i, R);
                const [lx, ly] = xy(i, labelR);
                const val = values[i];
                const active = val > 0;
                return (
                    <g key={key}>
                        <line
                            x1={cx} y1={cy} x2={x2} y2={y2}
                            stroke={active ? "rgba(255,102,255,0.35)" : "rgba(42,42,61,0.85)"}
                            strokeWidth={active ? 1.25 : 1}
                        />
                        <text
                            x={lx} y={ly}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill={active ? "#ffffff" : "rgba(255,255,255,0.55)"}
                            style={{
                                fontSize: "9px",
                                fontFamily: "Orbitron, sans-serif",
                                letterSpacing: "0.08em",
                                fontWeight: active ? 600 : 400,
                            }}
                        >
                            {key.slice(0, 3).toUpperCase()}
                        </text>
                    </g>
                );
            })}

            {/* Data shape */}
            <polygon
                points={dataPoly}
                fill={`url(#${gradId})`}
                stroke={C.pink}
                strokeWidth="2"
                strokeLinejoin="round"
                filter={`url(#${gradId}-glow)`}
            />

            {/* Vertex dots + value ticks */}
            {dataPts.map(([x, y], i) => {
                const val = values[i];
                if (val <= 0) return null;
                return (
                    <g key={`v-${ACTION_KEYS[i]}`}>
                        <circle cx={x} cy={y} r={4.5} fill={C.pink} stroke="#ffffff" strokeWidth="1.25" />
                        <text
                            x={x}
                            y={y - 9}
                            textAnchor="middle"
                            dominantBaseline="auto"
                            fill={C.cyan}
                            style={{
                                fontSize: "8px",
                                fontFamily: "Fira Code, monospace",
                                fontWeight: 600,
                            }}
                        >
                            {val}
                        </text>
                    </g>
                );
            })}

            {/* Center hub */}
            <circle cx={cx} cy={cy} r={3} fill="rgba(0,242,234,0.5)" stroke={C.cyan} strokeWidth="1" />
        </svg>
    );
}

/* ── SectionLabel ─────────────────────────────────────────────────── */
function SectionLabel({ children, limit }) {
    return (
        <Box sx={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            mb: "10px",
            mt: "18px",
            fontFamily: "Orbitron, sans-serif",
            fontSize: "0.58rem",
            letterSpacing: "0.14em",
            color: "#ffffff",
            "&::after": {
                content: '""',
                flex: 1,
                height: "1px",
                background: `linear-gradient(90deg, ${C.cyan}66, transparent)`,
            },
        }}>
            {children}
            {limit && (
                <Box component="span" sx={{ fontSize: "0.52rem", color: "rgba(255,255,255,0.75)", ml: 0.5 }}>
                    {limit}
                </Box>
            )}
        </Box>
    );
}

/* ── Main component ───────────────────────────────────────────────── */
export default function DossierIdView({ character }) {
    const dispatch = useDispatch();
    const { editMode, spawnPing, patchDraft, flushSave, dirty } = useDossier();
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const profile = useSelector((s) => s.player.profile);

    const [selected, setSelected] = useState(null);
    const [burdensAsideOpen, setBurdensAsideOpen] = useState(false);
    const [activeBurdenIndex, setActiveBurdenIndex] = useState(null);
    const bannerInputRef = useRef(null);
    const tokenInputRef  = useRef(null);
    const rootRef = useRef(null);
    const selectedRef = useRef(null);
    const dirtyRef = useRef(false);
    const [uploading, setUploading] = useState(false);

    selectedRef.current = selected;
    dirtyRef.current = dirty;

    const commitSelection = useCallback(async () => {
        if (dirtyRef.current && typeof flushSave === "function") {
            await flushSave();
        }
    }, [flushSave]);

    const selectEditor = useCallback(async (key) => {
        if (selectedRef.current === key) return;
        await commitSelection();
        setSelected(key);
    }, [commitSelection]);

    const clearSelection = useCallback(() => {
        if (selectedRef.current == null) return;
        if (dirtyRef.current && typeof flushSave === "function") {
            flushSave();
        }
        setSelected(null);
    }, [flushSave]);

    /* Click outside active editor → autosave + deselect */
    useEffect(() => {
        const onPointerDown = (e) => {
            const cur = selectedRef.current;
            if (!cur) return;
            const root = rootRef.current;
            if (!root || !root.contains(e.target)) return;
            if (e.target.closest?.("[data-burden-rail]")) return;
            const editorEl = e.target.closest?.("[data-dossier-editor]");
            const editorKey = editorEl?.getAttribute?.("data-dossier-editor");
            if (editorKey === cur) return;
            // Switching to another editor is handled by selectEditor on that control.
            if (editorKey) return;
            clearSelection();
        };
        document.addEventListener("pointerdown", onPointerDown, true);
        return () => document.removeEventListener("pointerdown", onPointerDown, true);
    }, [clearSelection]);

    const syncCharacterMedia = useCallback(async (partial) => {
        if (!character?.id || !partial) return;
        // Preview + persist media immediately (also mirrored in draft for UI).
        patchDraft(partial);
        try {
            await updateCharacterFields(character.id, partial);
            dispatch(updateCharacterInList({ id: character.id, data: partial }));
            dispatch(updateCharacterInState({
                id: character.id,
                locationId: character.locationId,
                data: partial,
            }));
        } catch (err) {
            console.error("[DossierIdView] persist media:", err);
        }
    }, [character?.id, character?.locationId, dispatch, patchDraft]);

    const bond = character?.bond || {};
    const rawStats = character?.stats || {};
    const stats = Object.fromEntries(
        ACTION_KEYS.map((k) => [k, Math.min(MAX_STAT, Math.max(0, Number(rawStats[k]) || 0))]),
    );
    const bondPowers = Array.isArray(character?.bondPowers) ? character.bondPowers : [];
    const burdens = normalizeBurdens(character?.burdens);
    const isDM = isDmRole(profile?.role);
    const { allAbilities: kitAbilities } = useSkillMatrixAbilities(character);

    const bondOptions = useMemo(
        () => bondPowers.map((bp, i) => ({
            id: resolveBondPowerId(bp, i),
            label: bp.title || bp.name || bp.label || `Bond ${i + 1}`,
        })),
        [bondPowers],
    );
    const abilityOptions = useMemo(
        () => (kitAbilities || [])
            .filter((a) => a.type === "ability")
            .map((a) => ({ id: a.key || a.id, label: a.label || a.key || a.id })),
        [kitAbilities],
    );
    const traitOptions = useMemo(
        () => (kitAbilities || [])
            .filter((a) => a.type === "trait")
            .map((a) => ({ id: a.key || a.id, label: a.label || a.key || a.id })),
        [kitAbilities],
    );

    const effectLabelFor = useCallback((effect) => {
        if (!effect?.targetId) return "";
        if (effect.type === BURDEN_EFFECT_TYPES.ACTION_PENANCE) {
            return String(effect.targetId).toUpperCase();
        }
        if (effect.type === BURDEN_EFFECT_TYPES.BOND_NULLIFY) {
            return bondOptions.find((o) => o.id === effect.targetId)?.label || effect.targetId;
        }
        if (effect.type === BURDEN_EFFECT_TYPES.CUTTED_ABILITY) {
            return abilityOptions.find((o) => o.id === effect.targetId)?.label || effect.targetId;
        }
        if (effect.type === BURDEN_EFFECT_TYPES.TRAIT_TORN) {
            return traitOptions.find((o) => o.id === effect.targetId)?.label || effect.targetId;
        }
        return effect.targetId;
    }, [bondOptions, abilityOptions, traitOptions]);

    /** Persist clamp for legacy >4 values (outside draft). */
    useEffect(() => {
        if (!character?.id || !character?.stats || editMode) return;
        const patch = {};
        let needsClamp = false;
        for (const key of ACTION_KEYS) {
            const n = Number(character.stats[key]);
            if (Number.isFinite(n) && n > MAX_STAT) {
                patch[`stats.${key}`] = MAX_STAT;
                needsClamp = true;
            }
        }
        if (needsClamp) updateCharacterFields(character.id, patch).catch(console.error);
    }, [character?.id, character?.stats, editMode]);

    const setStat = useCallback((key, value) => {
        const next = Math.min(MAX_STAT, Math.max(0, Number(value) || 0));
        patchDraft({ stats: { [key]: next } });
    }, [patchDraft]);

    const saveBondField = useCallback((field, value) => {
        patchDraft({ bond: { [field]: value } });
    }, [patchDraft]);

    const saveBondPower = useCallback((powerId, partial) => {
        const updated = bondPowers.map((bp, i) => {
            if (resolveBondPowerId(bp, i) !== powerId) return bp;
            const next = { ...bp, ...partial };
            // Keep the same resolved id so React key / selection don't remount mid-keystroke.
            if (!next.id && !next.key) next.id = powerId;
            return next;
        });
        patchDraft({ bondPowers: updated });
    }, [bondPowers, patchDraft]);

    const removeBondPower = useCallback(async (powerId) => {
        const updated = bondPowers.filter((bp, i) => resolveBondPowerId(bp, i) !== powerId);
        patchDraft({ bondPowers: updated });
        setSelected(null);
        if (!character?.id) return;
        try {
            await updateCharacterFields(character.id, { bondPowers: updated });
            dispatch(updateCharacterInList({ id: character.id, data: { bondPowers: updated } }));
            dispatch(updateCharacterInState({
                id: character.id,
                locationId: character.locationId,
                data: { bondPowers: updated },
            }));
        } catch (err) {
            console.error("[DossierIdView] delete bond power:", err);
        }
    }, [bondPowers, patchDraft, character?.id, character?.locationId, dispatch]);

    const saveIdeal = useCallback((idx, value) => {
        const next = [...(bond.ideals || [])];
        while (next.length < 3) next.push("");
        next[idx] = value;
        patchDraft({ bond: { ideals: next } });
    }, [bond.ideals, patchDraft]);

    const patchBurden = useCallback((index, partial) => {
        const next = normalizeBurdens(burdens);
        if (!next[index]) next[index] = emptyBurden(index);
        next[index] = { ...next[index], ...partial };
        if (partial.clockSize != null) {
            const size = partial.clockSize === 6 || partial.clockSize === 8 ? partial.clockSize : 4;
            next[index].clockSize = size;
            next[index].clockFilled = Math.min(next[index].clockFilled || 0, size);
        }
        patchDraft({ burdens: next });
    }, [burdens, patchDraft]);

    const clearBurdenSlot = useCallback(async (index) => {
        const next = normalizeBurdens(burdens);
        next[index] = null;
        patchDraft({ burdens: next });
        setActiveBurdenIndex(null);
        setSelected(null);
        setBurdensAsideOpen(true);
        if (!character?.id) return;
        try {
            await updateCharacterFields(character.id, { burdens: next });
            dispatch(updateCharacterInList({ id: character.id, data: { burdens: next } }));
            dispatch(updateCharacterInState({
                id: character.id,
                locationId: character.locationId,
                data: { burdens: next },
            }));
        } catch (err) {
            console.error("[DossierIdView] clear burden:", err);
        }
    }, [burdens, patchDraft, character?.id, character?.locationId, dispatch]);

    const openBurden = useCallback(async (index) => {
        await commitSelection();
        const next = normalizeBurdens(burdens);
        if (!next[index]) {
            next[index] = emptyBurden(index);
            patchDraft({ burdens: next });
            if (character?.id) {
                try {
                    await updateCharacterFields(character.id, { burdens: next });
                    dispatch(updateCharacterInList({ id: character.id, data: { burdens: next } }));
                    dispatch(updateCharacterInState({
                        id: character.id,
                        locationId: character.locationId,
                        data: { burdens: next },
                    }));
                } catch (err) {
                    console.error("[DossierIdView] create burden:", err);
                }
            }
        }
        setBurdensAsideOpen(true);
        setActiveBurdenIndex(index);
        setSelected(`burden:${index}`);
    }, [burdens, commitSelection, patchDraft, character?.id, character?.locationId, dispatch]);

    const backToBurdenViewer = useCallback(async () => {
        await commitSelection();
        setActiveBurdenIndex(null);
        setSelected(null);
        setBurdensAsideOpen(true);
    }, [commitSelection]);

    const closeBurdenAside = useCallback(async () => {
        await commitSelection();
        setActiveBurdenIndex(null);
        setSelected(null);
        setBurdensAsideOpen(false);
    }, [commitSelection]);

    const toggleBurdenAside = useCallback(async () => {
        if (burdensAsideOpen) {
            await closeBurdenAside();
            return;
        }
        await commitSelection();
        setActiveBurdenIndex(null);
        setSelected(null);
        setBurdensAsideOpen(true);
    }, [burdensAsideOpen, closeBurdenAside, commitSelection]);

    const handleBurdenClockFilled = useCallback(async (index, clockFilled) => {
        const slot = normalizeBurdens(burdens)[index] || emptyBurden(index);
        const size = slot.clockSize === 6 || slot.clockSize === 8 ? slot.clockSize : 4;
        if (clockFilled >= size || isBurdenClockCleared({ ...slot, clockFilled })) {
            await clearBurdenSlot(index);
            return;
        }
        patchBurden(index, { clockFilled });
    }, [burdens, clearBurdenSlot, patchBurden]);

    const sendNarrativeToChat = useCallback(async ({ kind, title, text, id }) => {
        if (!campaignId || !character) return;
        try {
            await callAbilityInChat(
                campaignId,
                profile,
                {
                    id: id || `narrative:${kind}`,
                    label: `${kind} · ${title}`,
                    content: text || "",
                    characterId: character.id,
                    characterName: character.name,
                    characterAvatarUrl: character.tokenImageUrl || character.imageUrl || null,
                },
                { character },
            );
        } catch (err) {
            console.error("[DossierIdView] chat:", err);
        }
    }, [campaignId, profile, character]);

    const handleSelect = (key) => { selectEditor(key); };

    const handleBannerClick = (e) => {
        if (!editMode) return;
        spawnPing(e.clientX, e.clientY);
        bannerInputRef.current?.click();
    };
    const handleBannerFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !character?.id) return;
        setUploading(true);
        try {
            // Persist Storage path (not download URL): tokens expire when the object is replaced.
            const { path } = await uploadCharacterImage(character.id, file);
            await syncCharacterMedia({ bannerUrl: path });
        } catch (err) {
            console.error("[DossierIdView] banner upload:", err);
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    };

    const handleTokenClick = (e) => {
        if (!editMode) return;
        spawnPing(e.clientX, e.clientY);
        tokenInputRef.current?.click();
    };
    const handleTokenFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !character?.id) return;
        setUploading(true);
        try {
            const { path } = await uploadCharacterImage(character.id, file);
            // Token del mapa / HUD (CharacterCombatHud avatar) lee tokenImageUrl primero.
            // Persist Storage path so useAssetUrl can always mint a fresh download URL.
            await syncCharacterMedia({ imageUrl: path, tokenImageUrl: path });
        } catch (err) {
            console.error("[DossierIdView] token upload:", err);
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    };

    const handleStatClick = useCallback((e, key) => {
        const row = e.currentTarget;
        selectEditor(`action:${key}`);
        row.classList.remove("glitch-snap");
        void row.offsetWidth;
        row.classList.add("glitch-snap");
        spawnPing(e.clientX, e.clientY);
        setTimeout(() => row.classList.remove("glitch-snap"), 600);
    }, [spawnPing, selectEditor]);

    const handleAddBond = () => {
        if (!editMode) return;
        const id = `bp_${Date.now()}`;
        const next = [...bondPowers, { id, title: "NEW BOND", frequency: "", description: "" }];
        patchDraft({ bondPowers: next });
        selectEditor(`bond:${id}`);
    };

    const bannerPath = character?.bannerUrl || null;
    const tokenPath = character?.tokenImageUrl || character?.imageUrl || null;
    const displayBannerPath = bannerPath || tokenPath;
    const resolvedBannerUrl = useAssetUrl(displayBannerPath);
    const resolvedTokenUrl = useAssetUrl(tokenPath);
    const cropCss = tokenCropCss(normalizeTokenCrop(character?.tokenCrop));
    const hasBanner = Boolean(resolvedBannerUrl);
    const hasToken = Boolean(resolvedTokenUrl);
    const showingEditor = activeBurdenIndex != null && activeBurdenIndex >= 0 && activeBurdenIndex < 3;
    const showingViewer = burdensAsideOpen && !showingEditor;
    const activeBurden = showingEditor
        ? (burdens[activeBurdenIndex] || emptyBurden(activeBurdenIndex))
        : null;
    const activeBurdenCount = burdens.filter(Boolean).length;
    const targetLocked = Boolean(
        activeBurden?.effect?.targetId && !isDM,
    );

    return (
        <Box
            ref={rootRef}
            sx={{
                flex: 1,
                minHeight: 0,
                minWidth: 0,
                display: "grid",
                // minmax(0, …) prevents banner/token intrinsic size from crushing the console column
                gridTemplateColumns: "minmax(0, 30%) minmax(0, 1fr)",
                overflow: "hidden",
                "@media (max-width: 900px)": {
                    gridTemplateColumns: "1fr",
                    overflow: "auto",
                },
            }}
        >
            {/* ─────────────────────────── CENTER · MEDIA + BURDENS ─── */}
            <Box
                component="aside"
                sx={{
                    minWidth: 0,
                    maxWidth: "100%",
                    borderRight: `1px solid ${C.border}`,
                    background: [
                        `radial-gradient(circle at 50% 28%, rgba(0,242,234,0.1), transparent 42%)`,
                        `linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.55))`,
                    ].join(","),
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "stretch",
                    minHeight: 0,
                    ...SCROLL_SX,
                    overflowY: "auto",
                }}
            >
                <Box sx={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    p: "16px 10px 18px",
                    gap: "12px",
                }}>
                    {showingEditor ? (
                        <Box
                            data-dossier-editor={`burden:${activeBurdenIndex}`}
                            sx={{ width: "100%", maxWidth: 280, display: "flex", flexDirection: "column", gap: 1.35 }}
                        >
                            <Box sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                pb: 0.5,
                                borderBottom: `1px solid rgba(255,51,85,0.28)`,
                            }}>
                                <IconButton
                                    size="small"
                                    aria-label="Volver al listado"
                                    onClick={() => backToBurdenViewer()}
                                    sx={{
                                        color: C.cyan,
                                        border: `1px solid ${C.border}`,
                                        borderRadius: "3px",
                                        width: 28, height: 28,
                                        "&:hover": { borderColor: C.cyan, bgcolor: `${C.cyan}18` },
                                    }}
                                >
                                    <ArrowBackIcon sx={{ fontSize: "0.95rem" }} />
                                </IconButton>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Box sx={{
                                        fontFamily: "Orbitron, sans-serif",
                                        fontSize: "0.58rem",
                                        letterSpacing: "0.14em",
                                        color: C.danger,
                                    }}>
                                        BURDEN 0{activeBurdenIndex + 1}
                                    </Box>
                                    <Box sx={{
                                        fontFamily: "'Fira Code', monospace",
                                        fontSize: "0.45rem",
                                        letterSpacing: "0.06em",
                                        color: C.muted,
                                    }}>
                                        EDITOR
                                    </Box>
                                </Box>
                                <Tooltip title="Eliminar burden" slotProps={tooltipSlotProps}>
                                    <IconButton
                                        size="small"
                                        aria-label="Eliminar burden"
                                        onClick={() => clearBurdenSlot(activeBurdenIndex)}
                                        sx={{
                                            color: "#ffffff",
                                            border: `1px solid ${C.border}`,
                                            borderRadius: "3px",
                                            width: 28, height: 28,
                                            "&:hover": { borderColor: C.danger, color: C.danger, bgcolor: `${C.danger}22` },
                                        }}
                                    >
                                        <DeleteOutlineIcon sx={{ fontSize: "0.95rem" }} />
                                    </IconButton>
                                </Tooltip>
                            </Box>

                            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.85 }}>
                                <Box
                                    component="input"
                                    value={activeBurden.title || ""}
                                    placeholder="TÍTULO DEL TRAUMA"
                                    onChange={(e) => patchBurden(activeBurdenIndex, { title: e.target.value })}
                                    sx={{
                                        width: "100%",
                                        fontFamily: "Orbitron, sans-serif",
                                        fontSize: "0.72rem",
                                        letterSpacing: "0.08em",
                                        color: "#ffffff",
                                        bgcolor: "rgba(0,0,0,0.5)",
                                        border: `1px solid rgba(255,51,85,0.45)`,
                                        borderRadius: "3px",
                                        outline: "none",
                                        px: "10px",
                                        py: "8px",
                                        "&::placeholder": { color: "rgba(255,255,255,0.35)" },
                                        "&:focus": { borderColor: C.cyan },
                                    }}
                                />

                                <Box
                                    component="textarea"
                                    value={activeBurden.text || ""}
                                    placeholder="Descripción: daño físico/mental, extremidad, trauma…"
                                    onChange={(e) => patchBurden(activeBurdenIndex, { text: e.target.value })}
                                    sx={{
                                        width: "100%",
                                        minHeight: 72,
                                        resize: "vertical",
                                        fontFamily: '"Fira Sans", sans-serif',
                                        fontSize: "0.85rem",
                                        color: "#ffffff",
                                        bgcolor: "rgba(0,0,0,0.5)",
                                        border: `1px solid rgba(255,51,85,0.32)`,
                                        borderRadius: "3px",
                                        outline: "none",
                                        p: "10px",
                                        lineHeight: 1.4,
                                        "&::placeholder": { color: "rgba(255,255,255,0.35)" },
                                        "&:focus": { borderColor: C.cyan },
                                    }}
                                />
                            </Box>

                            <Box sx={{
                                p: "10px",
                                borderRadius: "4px",
                                border: `1px solid rgba(255,51,85,0.28)`,
                                bgcolor: "rgba(0,0,0,0.28)",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 0.75,
                            }}>
                                <Box sx={{
                                    alignSelf: "stretch",
                                    fontFamily: "Orbitron, sans-serif",
                                    fontSize: "0.5rem",
                                    letterSpacing: "0.14em",
                                    color: C.danger,
                                }}>
                                    CLOCK · LIMPIEZA
                                </Box>
                                <BurdenClock
                                    size={activeBurden.clockSize}
                                    filled={activeBurden.clockFilled}
                                    editable={editMode}
                                    onChangeSize={(clockSize) => patchBurden(activeBurdenIndex, { clockSize })}
                                    onChangeFilled={(clockFilled) => handleBurdenClockFilled(activeBurdenIndex, clockFilled)}
                                />
                            </Box>

                            <BurdenEffectFields
                                effect={activeBurden.effect}
                                burdens={burdens}
                                slotIndex={activeBurdenIndex}
                                editMode={editMode}
                                targetLocked={targetLocked}
                                actionKeys={ACTION_KEYS}
                                bondOptions={bondOptions}
                                abilityOptions={abilityOptions}
                                traitOptions={traitOptions}
                                onChange={(effect) => {
                                    // Persist partial draft; normalizeBurdenEffect drops incomplete targets.
                                    const next = normalizeBurdens(burdens);
                                    if (!next[activeBurdenIndex]) next[activeBurdenIndex] = emptyBurden(activeBurdenIndex);
                                    next[activeBurdenIndex] = {
                                        ...next[activeBurdenIndex],
                                        effect: effect && effect.type
                                            ? {
                                                type: effect.type,
                                                targetId: effect.targetId || "",
                                                ...(effect.type === BURDEN_EFFECT_TYPES.ACTION_PENANCE
                                                    ? { amount: effect.amount === 2 ? 2 : 1 }
                                                    : {}),
                                            }
                                            : null,
                                    };
                                    patchDraft({ burdens: next });
                                }}
                            />

                            <Box sx={{
                                p: "10px",
                                borderRadius: "4px",
                                border: `1px solid ${C.border}`,
                                bgcolor: "rgba(0,0,0,0.22)",
                                display: "flex",
                                flexDirection: "column",
                                gap: 0.75,
                            }}>
                                <Box sx={{
                                    fontFamily: "Orbitron, sans-serif",
                                    fontSize: "0.5rem",
                                    letterSpacing: "0.14em",
                                    color: "rgba(255,255,255,0.55)",
                                }}>
                                    NOTA / CONSECUENCIA
                                </Box>
                                <Box
                                    component="textarea"
                                    value={activeBurden.consequence || ""}
                                    placeholder="Nota narrativa opcional…"
                                    onChange={(e) => patchBurden(activeBurdenIndex, { consequence: e.target.value })}
                                    sx={{
                                        width: "100%",
                                        minHeight: 52,
                                        resize: "vertical",
                                        fontFamily: '"Fira Sans", sans-serif',
                                        fontSize: "0.85rem",
                                        color: "#ffffff",
                                        bgcolor: "rgba(0,0,0,0.45)",
                                        border: `1px solid rgba(255,255,255,0.12)`,
                                        borderRadius: "3px",
                                        outline: "none",
                                        p: "8px 10px",
                                        lineHeight: 1.4,
                                        "&::placeholder": { color: "rgba(255,255,255,0.35)" },
                                        "&:focus": { borderColor: C.cyan },
                                    }}
                                />
                            </Box>
                        </Box>
                    ) : showingViewer ? (
                        <BurdenViewer
                            burdens={burdens}
                            editMode={editMode}
                            effectLabelFor={effectLabelFor}
                            onSelectIndex={(i) => openBurden(i)}
                            onCreate={(i) => openBurden(i)}
                        />
                    ) : (
                        <>
                            <Box sx={{ width: "min(240px, 92%)", maxWidth: "100%", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                                <Box
                                    onClick={handleBannerClick}
                                    title={editMode ? "Cambiar banner" : "Banner"}
                                    sx={{
                                        position: "relative",
                                        width: "100%",
                                        minWidth: 0,
                                        aspectRatio: "1",
                                        borderRadius: "8px",
                                        overflow: "hidden",
                                        border: `2px solid ${C.pink}`,
                                        boxShadow: `0 0 22px rgba(255,102,255,0.22)`,
                                        cursor: editMode ? "pointer" : "default",
                                        bgcolor: "#0a0a14",
                                        opacity: uploading ? 0.7 : 1,
                                        "&:hover .banner-cue": { opacity: editMode ? 1 : 0 },
                                        "&:hover": editMode ? { borderColor: C.cyan } : {},
                                    }}
                                >
                                    {hasBanner ? (
                                        <Box
                                            component="img"
                                            src={resolvedBannerUrl}
                                            alt="Banner"
                                            sx={{
                                                width: "100%",
                                                height: "100%",
                                                maxWidth: "100%",
                                                objectFit: "cover",
                                                objectPosition: "center",
                                                display: "block",
                                                transform: !bannerPath && tokenPath ? "scale(1.15)" : "none",
                                            }}
                                        />
                                    ) : (
                                        <Box sx={{
                                            width: "100%", height: "100%",
                                            display: "grid", placeItems: "center",
                                            fontFamily: "Orbitron, sans-serif", fontSize: "0.7rem",
                                            color: "rgba(255,255,255,0.18)", letterSpacing: "0.18em",
                                        }}>
                                            BANNER
                                        </Box>
                                    )}
                                    {editMode && (
                                        <Box
                                            className="banner-cue"
                                            sx={{
                                                position: "absolute", inset: 0,
                                                opacity: 0,
                                                transition: "opacity 0.2s",
                                                background: "rgba(0,0,0,0.55)",
                                                display: "grid", placeItems: "center",
                                                fontFamily: "Orbitron, sans-serif", fontSize: "0.5rem",
                                                color: C.cyan, letterSpacing: "0.12em",
                                                pointerEvents: "none",
                                            }}
                                        >
                                            CLICK · CAMBIAR / BORRAR
                                        </Box>
                                    )}
                                </Box>
                                <input ref={bannerInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleBannerFile} />

                                <Box
                                    sx={{
                                        width: "100%", minWidth: 0, display: "flex", alignItems: "center",
                                        gap: "10px", p: "8px 10px", borderRadius: "8px",
                                        border: `1px solid rgba(42,42,61,0.95)`,
                                        bgcolor: "rgba(0,0,0,0.28)",
                                    }}
                                >
                                    <Box
                                        onClick={handleTokenClick}
                                        title={editMode ? "Cambiar token" : "Token"}
                                        sx={{
                                            flexShrink: 0,
                                            width: 44, height: 44, borderRadius: "50%",
                                            border: `2px solid ${hasToken || tokenPath ? C.cyan : C.border}`,
                                            boxShadow: hasToken || tokenPath ? `0 0 10px rgba(0,242,234,0.3)` : "none",
                                            overflow: "hidden",
                                            cursor: editMode ? "pointer" : "default",
                                            bgcolor: "#0a0a14",
                                            display: "grid", placeItems: "center",
                                            "&:hover": editMode ? { borderColor: C.pink } : {},
                                        }}
                                    >
                                        {hasToken ? (
                                            <Box
                                                component="img"
                                                src={resolvedTokenUrl}
                                                alt="Token"
                                                sx={{ width: "100%", height: "100%", maxWidth: "100%", ...cropCss }}
                                            />
                                        ) : (
                                            <Box sx={{ fontFamily: "Orbitron, sans-serif", fontSize: "0.45rem", color: "rgba(255,255,255,0.25)" }}>TK</Box>
                                        )}
                                    </Box>
                                    <input ref={tokenInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleTokenFile} />

                                    <Box sx={{ minWidth: 0, flex: 1 }}>
                                        <Box sx={{ fontFamily: "Orbitron, sans-serif", fontSize: "0.55rem", letterSpacing: "0.1em", color: "#ffffff", mb: "2px" }}>TOKEN · MAPA</Box>
                                        <Box sx={{ fontSize: "0.72rem", color: "#ffffff", fontFamily: '"Fira Code", monospace' }}>
                                            {tokenPath ? "Token propio · PNG mapa" : bannerPath ? "Sin token → usa banner" : "Sube banner o token"}
                                        </Box>
                                    </Box>
                                </Box>
                            </Box>

                            <Box sx={{ width: "100%", maxWidth: 220, minWidth: 0 }}>
                                <RadarSvg stats={stats} maxStat={MAX_STAT} />
                            </Box>
                        </>
                    )}
                </Box>

                {/* Burden rail — single toggle */}
                <Box
                    data-burden-rail
                    sx={{
                        flexShrink: 0,
                        width: 44,
                        borderLeft: `1px solid ${C.border}`,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "10px",
                        py: "16px",
                        bgcolor: "rgba(0,0,0,0.25)",
                    }}
                >
                    <Box sx={{
                        fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.4rem",
                        letterSpacing: "0.1em",
                        color: C.danger,
                        writingMode: "vertical-rl",
                        transform: "rotate(180deg)",
                        mb: 0.5,
                    }}>
                        BURDENS
                    </Box>
                    <BurdenMark
                        component="button"
                        size={28}
                        filled={activeBurdenCount > 0}
                        active={burdensAsideOpen}
                        showClock={false}
                        title={burdensAsideOpen ? "Cerrar burdens" : "Ver burdens"}
                        aria-label={burdensAsideOpen ? "Cerrar burdens" : "Ver burdens"}
                        aria-pressed={burdensAsideOpen}
                        onClick={() => toggleBurdenAside()}
                    />
                    {activeBurdenCount > 0 && (
                        <Box sx={{
                            fontFamily: "'Fira Code', monospace",
                            fontSize: "0.45rem",
                            color: C.danger,
                        }}>
                            {activeBurdenCount}/3
                        </Box>
                    )}
                </Box>
            </Box>

            {/* ─────────────────────────── RIGHT · CONSOLE ──────────── */}
            <Box
                component="section"
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 0,
                    minWidth: 0,
                    bgcolor: "rgba(8,8,14,0.55)",
                }}
            >
                <div className="dossier-trail" style={{ margin: "0 18px 0" }} />

                <Box sx={{ ...SCROLL_SX, px: "18px", pb: "72px" }}>
                    {/* ACTIONS (6/12) | IDEALS (6/12) */}
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                            columnGap: "18px",
                            rowGap: "8px",
                            alignItems: "start",
                            mb: "4px",
                            "@media (max-width: 900px)": {
                                gridTemplateColumns: "1fr",
                            },
                        }}
                    >
                        <Box sx={{ minWidth: 0 }}>
                            <SectionLabel limit="máx 4">ACTIONS</SectionLabel>
                            <Box sx={{
                                display: "grid",
                                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                                columnGap: "16px",
                                rowGap: "6px",
                                width: "100%",
                            }}>
                                {ACTION_KEYS.map((key) => {
                                    const base = stats[key] || 0;
                                    const penance = getActionPenance(burdens, key);
                                    const eff = effectiveActionDice(base, penance);
                                    return (
                                    <ActionSegmentRow
                                        key={key}
                                        actionKey={key}
                                        value={base}
                                        effectiveValue={eff}
                                        penance={penance}
                                        selected={selected === `action:${key}`}
                                        editorKey={`action:${key}`}
                                        editMode={editMode}
                                        onSelect={(e) => handleStatClick(e, key)}
                                        onChange={async (v) => {
                                            await selectEditor(`action:${key}`);
                                            setStat(key, v);
                                        }}
                                    />
                                    );
                                })}
                            </Box>
                        </Box>

                        <Box sx={{ minWidth: 0 }}>
                            <SectionLabel limit="3 frases">IDEALS</SectionLabel>
                            <Box sx={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                {(bond.ideals?.length ? bond.ideals : ["", "", ""]).slice(0, 3).map((text, i) => {
                                    const idealKey = `ideal:${i}`;
                                    const isEditingIdeal = selected === idealKey;
                                    return (
                                        <Box
                                            key={i}
                                            data-dossier-editor={idealKey}
                                            onClick={() => selectEditor(idealKey)}
                                            sx={{
                                                display: "flex", gap: "10px", alignItems: "flex-start",
                                                p: "8px 10px", borderRadius: "6px",
                                                border: `1px solid ${isEditingIdeal ? C.cyan : C.border}`,
                                                bgcolor: isEditingIdeal ? "rgba(0,242,234,0.06)" : "rgba(0,0,0,0.25)",
                                                fontSize: "0.95rem", color: "#ffffff",
                                                minWidth: 0,
                                                cursor: "pointer",
                                            }}
                                        >
                                            <Box component="span" sx={{
                                                fontFamily: "Orbitron, sans-serif", fontSize: "0.58rem",
                                                color: "#ffffff", flexShrink: 0, mt: "2px",
                                            }}>
                                                {`0${i + 1}`}
                                            </Box>
                                            {isEditingIdeal ? (
                                                <Box
                                                    component="input"
                                                    value={text || ""}
                                                    maxLength={80}
                                                    autoFocus
                                                    onChange={(e) => saveIdeal(i, e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    sx={{
                                                        flex: 1, minWidth: 0, border: "none", background: "transparent",
                                                        color: "#ffffff", fontFamily: '"Fira Sans", sans-serif',
                                                        fontSize: "0.95rem", outline: "none",
                                                        borderBottom: `1px solid ${C.border}`,
                                                    }}
                                                />
                                            ) : (
                                                <Box component="span" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
                                                    {text || <em style={{ opacity: 0.45 }}>—</em>}
                                                </Box>
                                            )}
                                        </Box>
                                    );
                                })}
                            </Box>
                        </Box>
                    </Box>

                    <SectionLabel>NARRATIVE</SectionLabel>
                    <Box sx={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "12px",
                        mb: "10px",
                        "@media (max-width: 900px)": { gridTemplateColumns: "1fr" },
                    }}>
                        <NarrCard
                            compact
                            tag="NARRATIVE" title="SECOND WIND"
                            text={bond.secondWind || ""}
                            selKey="sw" selected={selected} onSelect={handleSelect}
                            editMode={editMode}
                            character={character}
                            macroEntry={{
                                type: MACRO_SLOT_TYPES.SHORTCUT,
                                id: "sw",
                                label: "SECOND WIND",
                                blurb: bond.secondWind || "",
                            }}
                            onSave={(v) => saveBondField("secondWind", v)}
                            onSendToChat={() => sendNarrativeToChat({
                                kind: "SECOND WIND",
                                title: "SECOND WIND",
                                text: bond.secondWind || "",
                                id: "narrative:sw",
                            })}
                        />
                        <NarrCard
                            compact
                            tag="NARRATIVE" title="SPECIAL ABILITY"
                            text={bond.specialAbility || bond.description || ""}
                            selKey="sa" selected={selected} onSelect={handleSelect}
                            editMode={editMode}
                            character={character}
                            macroEntry={{
                                type: MACRO_SLOT_TYPES.SHORTCUT,
                                id: "sa",
                                label: "SPECIAL ABILITY",
                                blurb: bond.specialAbility || bond.description || "",
                            }}
                            onSave={(v) => saveBondField("specialAbility", v)}
                            onSendToChat={() => sendNarrativeToChat({
                                kind: "SPECIAL ABILITY",
                                title: "SPECIAL ABILITY",
                                text: bond.specialAbility || bond.description || "",
                                id: "narrative:sa",
                            })}
                        />
                    </Box>

                    <SectionLabel limit={`${bondPowers.length} powers`}>BOND POWERS</SectionLabel>
                    {bondPowers.map((bp, index) => {
                        const id = resolveBondPowerId(bp, index);
                        const title = bp.title || bp.name || bp.label || "BOND";
                        const text = bp.description || bp.content || bp.text || "";
                        const frequency = bp.frequency || "";
                        const scKey = `bond:${id}`;
                        const nullified = isBondPowerNullified(burdens, id);
                        return (
                            <NarrCard
                                key={id}
                                tag="BOND"
                                tagColor={C.cyan}
                                title={title}
                                frequency={frequency}
                                text={text}
                                selKey={scKey}
                                selected={selected}
                                onSelect={handleSelect}
                                editMode={editMode}
                                character={character}
                                burdenDisabled={nullified}
                                burdenDisabledLabel="NULLIFIED"
                                macroEntry={{
                                    type: MACRO_SLOT_TYPES.SHORTCUT,
                                    id: scKey,
                                    label: title,
                                    blurb: text,
                                }}
                                onSave={(v) => saveBondPower(id, { description: v })}
                                onSaveTitle={(v) => saveBondPower(id, { title: v, name: v })}
                                onSaveFrequency={(v) => saveBondPower(id, { frequency: v })}
                                onDelete={() => removeBondPower(id)}
                                onSendToChat={() => sendNarrativeToChat({
                                    kind: "BOND",
                                    title: frequency ? `${title} · ${frequency}` : title,
                                    text,
                                    id: `narrative:${scKey}`,
                                })}
                            />
                        );
                    })}

                    {editMode && (
                        <Box
                            component="button"
                            type="button"
                            onClick={handleAddBond}
                            sx={{
                                width: "100%", mb: "18px",
                                fontFamily: "Orbitron, sans-serif", fontSize: "0.5rem", letterSpacing: "0.1em",
                                p: "10px", borderRadius: "6px", cursor: "pointer",
                                border: `1px dashed rgba(0,242,234,0.35)`,
                                bgcolor: "rgba(0,242,234,0.04)", color: C.cyan,
                                "&:hover": { bgcolor: "rgba(0,242,234,0.1)" },
                            }}
                        >
                            + AÑADIR BOND POWER
                        </Box>
                    )}
                </Box>
            </Box>
        </Box>
    );
}
