import { useEffect, useMemo, useRef, useState } from "react";
import {
    Box, IconButton, Popover, TextField, InputAdornment, CircularProgress,
    Menu, MenuItem, ListItemIcon, ListItemText,
} from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import BoltIcon from "@mui/icons-material/Bolt";
import SearchIcon from "@mui/icons-material/Search";
import BadgeIcon from "@mui/icons-material/Badge";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import CasinoIcon from "@mui/icons-material/Casino";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import HikingIcon from "@mui/icons-material/Hiking";
import SensorsIcon from "@mui/icons-material/Sensors";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import HandshakeIcon from "@mui/icons-material/Handshake";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import HandymanIcon from "@mui/icons-material/Handyman";
import BalanceIcon from "@mui/icons-material/Balance";
import SportsMartialArtsIcon from "@mui/icons-material/SportsMartialArts";
import HealthAndSafetyIcon from "@mui/icons-material/HealthAndSafety";
import PersonOffIcon from "@mui/icons-material/PersonOff";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import CheckIcon from "@mui/icons-material/Check";
import HealingIcon from "@mui/icons-material/Healing";
import { CyberText, CyberTitle } from "../customs/CustomTexts";
import CyberTooltip from "../customs/CyberTooltip";
import { UI_COLORS } from "../../constants/uiColors";
import { cyberMenuItemSx, cyberMenuPaperSx, TYPO } from "../../constants/designSystem";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import { VTT_HUD } from "../../constants/vttHudTokens";
import { useStatSystem } from "../../hooks/useStatSystem";
import { useCharacterSessionPools } from "../../hooks/useCharacterSessionPools";
import { usePinnedCharacters } from "../../hooks/usePinnedCharacters";
import { useAssetUrl } from "../../hooks/useAssetUrl";
import { useResolvedCombatStats } from "../../hooks/useResolvedCombatStats";
import { setActiveCharacterId, persistActiveCharacter } from "../../store/playerSlice";
import { showSnackbar, openCharacterSheet } from "../../store/uiSlice";
import { canControlToken, isDmRole } from "../../utils/tokenControl";
import {
    DEFAULT_VIT,
    buildCampaignCharacterMap,
    resolveHpMax,
    resolveVit,
    resolveSessionHpMax,
    applyHpWithVitCascade,
    applyVitChange,
} from "../../utils/characterCombat";
import { normalizeTokenCrop, tokenCropCss } from "../../utils/tokenImageFit";
import { getSessionPools } from "../../utils/characterSessionPools";
import { rollStatInChat } from "../../../firebase/services/chatService";
import AbilityHotbar, { COMBAT_DOCK_MIN_HEIGHT } from "./AbilityHotbar";
import BurdenMark from "../characters/BurdenMark";
import {
    normalizeBurdens,
    formatBurdenEffectSummary,
    getActionPenance,
    effectiveActionDice,
    listActiveBurdens,
    BURDEN_EFFECT_TYPES,
} from "../../utils/characterBurdens";
import { mergeMacroBarPreferFilled } from "../../constants/macroBar";
import { HudRichTooltipTitle, hudRichTooltipSlotProps } from "./hudRichTooltip";

/** Prefer filled slots from either sheet or world doc (avoids empty sheet stub wiping world). */
function mergeBurdensPreferFilled(primary, fallback) {
    const a = normalizeBurdens(primary);
    const b = normalizeBurdens(fallback);
    return [0, 1, 2].map((i) => a[i] || b[i] || null);
}

function burdenEffectTargetLabel(effect, character) {
    if (!effect?.targetId) return "";
    if (effect.type === BURDEN_EFFECT_TYPES.ACTION_PENANCE) {
        return String(effect.targetId).toUpperCase();
    }
    if (effect.type === BURDEN_EFFECT_TYPES.BOND_NULLIFY) {
        const list = Array.isArray(character?.bondPowers) ? character.bondPowers : [];
        const bp = list.find((p, i) => {
            const id = p?.id != null && String(p.id).trim() !== ""
                ? String(p.id)
                : (p?.key != null && String(p.key).trim() !== "" ? String(p.key) : `bp_idx_${i}`);
            return id === effect.targetId;
        });
        return bp?.title || bp?.name || bp?.label || effect.targetId;
    }
    return effect.targetId;
}

/** Single “has burdens” mark — tooltip lists every active burden + effect. */
function ActiveBurdenIcons({ burdens, character }) {
    const active = listActiveBurdens(burdens);
    if (!active.length) return null;

    const tip = (
        <Box sx={{ display: "flex", flexDirection: "column", gap: "8px", textTransform: "none", maxWidth: 280 }}>
            <Box
                component="span"
                sx={{
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "0.55rem",
                    letterSpacing: "0.1em",
                    color: UI_COLORS.danger,
                    textTransform: "uppercase",
                }}
            >
                Burdens · {active.length}
            </Box>
            {active.map((b, i) => {
                const title = (b.title || "").trim() || `Burden ${i + 1}`;
                const effectLine = formatBurdenEffectSummary(b.effect, {
                    targetLabel: burdenEffectTargetLabel(b.effect, character),
                });
                const note = (b.consequence || b.text || "").trim();
                return (
                    <Box key={b.id || i} sx={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <Box
                            component="span"
                            sx={{
                                fontFamily: "Orbitron, sans-serif",
                                fontSize: "0.62rem",
                                letterSpacing: "0.06em",
                                color: UI_COLORS.textPrimary,
                                textTransform: "uppercase",
                            }}
                        >
                            {title}
                            <Box component="span" sx={{
                                ml: 0.75,
                                fontFamily: "'Fira Code', monospace",
                                fontSize: "0.5rem",
                                color: UI_COLORS.danger,
                                textTransform: "none",
                            }}>
                                {b.clockFilled}/{b.clockSize}
                            </Box>
                        </Box>
                        {effectLine ? (
                            <Box
                                component="span"
                                sx={{
                                    fontFamily: "'Fira Code', monospace",
                                    fontSize: "0.58rem",
                                    color: UI_COLORS.danger,
                                }}
                            >
                                {effectLine}
                            </Box>
                        ) : null}
                        {note ? (
                            <Box
                                component="span"
                                sx={{
                                    fontFamily: "'Fira Sans', sans-serif",
                                    fontSize: "0.7rem",
                                    color: UI_COLORS.textSecondary,
                                    lineHeight: 1.35,
                                    whiteSpace: "pre-wrap",
                                }}
                            >
                                {note}
                            </Box>
                        ) : null}
                    </Box>
                );
            })}
        </Box>
    );

    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "flex-start",
                flexShrink: 0,
                ml: 0.5,
                pt: "2px",
            }}
        >
            <CyberTooltip
                title={tip}
                placement="top"
                slotProps={{
                    tooltip: {
                        sx: {
                            maxWidth: 300,
                            textTransform: "none",
                            letterSpacing: "normal",
                        },
                    },
                }}
            >
                <BurdenMark
                    filled
                    size={22}
                    showClock={false}
                    aria-label={`Burdens activos: ${active.length}`}
                />
            </CyberTooltip>
        </Box>
    );
}

/** Icons tuned to what each ICON action *does* (not generic placeholders). */
const STAT_ICONS = {
    sneak: VisibilityOffIcon,
    traverse: HikingIcon,
    sense: SensorsIcon,
    study: AutoStoriesIcon,
    charm: HandshakeIcon,
    command: RecordVoiceOverIcon,
    tinker: HandymanIcon,
    excel: BalanceIcon,
    smash: SportsMartialArtsIcon,
    endure: HealthAndSafetyIcon,
};

const ACTION_MOD_OPTS = [
    { key: "b1", delta: 1, label: "+1", accent: "boon" },
    { key: "b2", delta: 2, label: "+2", accent: "boon" },
    { key: "c1", delta: -1, label: "−1", accent: "curse" },
    { key: "c2", delta: -2, label: "−2", accent: "curse" },
];

function TrackRow({ label, children, valueLabel }) {
    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minHeight: 22 }}>
            <CyberText
                sx={{
                    fontFamily: "monospace",
                    fontSize: "0.5rem",
                    letterSpacing: "0.1em",
                    color: UI_COLORS.textSecondary,
                    width: 42,
                    flexShrink: 0,
                }}
            >
                {label}
            </CyberText>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.3, flex: 1, minWidth: 0 }}>
                {children}
            </Box>
            {valueLabel != null && (
                <CyberText sx={{ fontFamily: "monospace", fontSize: "0.55rem", color: UI_COLORS.textSecondary }}>
                    {valueLabel}
                </CyberText>
            )}
        </Box>
    );
}

const VIT_RED = "#ff2a4a";
const VIT_RED_LOST = "#8a1020";
const VIT_RED_LOST_GLOW = "rgba(255, 42, 74, 0.35)";
const VIT_RED_GLOW = "rgba(255, 42, 74, 0.55)";

/** Visual VIT ring always has 4 quarters (HP = VIT × 4); maps onto vitCur/vitMax. */
const VIT_RING_SEGMENTS = 4;

function vitToFilledSegs(vitCur, vitMax) {
    const vmax = Math.max(1, Math.floor(Number(vitMax) || DEFAULT_VIT));
    const cur = Math.min(Math.max(Math.floor(Number(vitCur) || 0), 0), vmax);
    if (cur <= 0) return 0;
    if (cur >= vmax) return VIT_RING_SEGMENTS;
    return Math.max(1, Math.round((cur / vmax) * VIT_RING_SEGMENTS));
}

function segToVit(segIndex, vitMax) {
    const vmax = Math.max(1, Math.floor(Number(vitMax) || DEFAULT_VIT));
    if (segIndex < 0) return 0;
    return Math.max(
        0,
        Math.min(vmax, Math.round(((segIndex + 1) / VIT_RING_SEGMENTS) * vmax)),
    );
}

/**
 * Segmented VIT ring + portrait.
 * Ring quarters adjust VIT. Portrait opens the character picker (lista).
 * Always 4 quarters. Filled = proportion of current VIT (bright).
 * Lost quarters stay crimson (damaged). Hover brightens a segment (clickable cue).
 */
function VitRingAvatar({
    char,
    size = 46,
    vitCur = 0,
    vitMax = 4,
    onVitChange,
    onPortraitClick,
    portraitActive = false,
    dead = false,
}) {
    const vmax = Math.max(1, Math.floor(Number(vitMax) || DEFAULT_VIT));
    const cur = Math.min(Math.max(Math.floor(Number(vitCur) || 0), 0), vmax);
    const filled = vitToFilledSegs(cur, vmax);
    const [hoverSeg, setHoverSeg] = useState(null);
    const ringPad = 7;
    const outer = size + ringPad * 2;
    const cx = outer / 2;
    const cy = outer / 2;
    const r = size / 2 + 3.5;
    const stroke = 4.5;
    const gapDeg = 14;
    const sweep = (360 - gapDeg * VIT_RING_SEGMENTS) / VIT_RING_SEGMENTS;
    const startBase = -90;
    const canPick = typeof onPortraitClick === "function";

    const handleSegClick = (e, segIndex) => {
        if (typeof onVitChange !== "function") return;
        e.stopPropagation();
        if (segIndex < filled) {
            // Clicking a lit quarter: drop to that quarter's floor (or clear it if last lit).
            const next = segIndex === filled - 1
                ? segToVit(segIndex - 1, vmax)
                : segToVit(segIndex, vmax);
            onVitChange(next);
        } else {
            onVitChange(segToVit(segIndex, vmax));
        }
    };

    const polar = (deg, radius) => {
        const rad = (deg * Math.PI) / 180;
        return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)];
    };

    const arcPath = (startDeg, endDeg) => {
        const [x1, y1] = polar(startDeg, r);
        const [x2, y2] = polar(endDeg, r);
        const large = endDeg - startDeg > 180 ? 1 : 0;
        return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
    };

    const segs = [];
    for (let i = 0; i < VIT_RING_SEGMENTS; i += 1) {
        const start = startBase + i * (sweep + gapDeg) + gapDeg / 2;
        const end = start + sweep;
        segs.push({
            start,
            end,
            i,
            state: i < filled ? "alive" : "lost",
        });
    }

    return (
        <Box
            sx={{
                position: "relative",
                width: outer,
                height: outer,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: dead ? 0.72 : 1,
                filter: dead ? "grayscale(0.55)" : "none",
            }}
        >
            <CyberTooltip
                title={dead ? "BREAK · VIT 0" : "Clic en un tramo del anillo · VIT"}
                placement="top"
            >
                <Box
                    component="svg"
                    width={outer}
                    height={outer}
                    viewBox={`0 0 ${outer} ${outer}`}
                    sx={{
                        position: "absolute",
                        inset: 0,
                        filter: `drop-shadow(0 0 6px ${VIT_RED_GLOW})`,
                        pointerEvents: "none",
                        zIndex: 2,
                        overflow: "visible",
                    }}
                >
                    {segs.map((s) => {
                        const hovered = hoverSeg === s.i && Boolean(onVitChange) && !dead;
                        const baseStroke = s.state === "alive" ? VIT_RED : VIT_RED_LOST;
                        const hoverStroke = s.state === "alive" ? "#ff6b8a" : "#ff4d6a";
                        return (
                            <g key={s.i}>
                                <path
                                    d={arcPath(s.start, s.end)}
                                    fill="none"
                                    stroke="transparent"
                                    strokeWidth={stroke + 10}
                                    strokeLinecap="butt"
                                    style={{
                                        pointerEvents: "stroke",
                                        cursor: onVitChange && !dead ? "pointer" : "default",
                                    }}
                                    onClick={(e) => handleSegClick(e, s.i)}
                                    onMouseEnter={() => setHoverSeg(s.i)}
                                    onMouseLeave={() => setHoverSeg((h) => (h === s.i ? null : h))}
                                />
                                <path
                                    d={arcPath(s.start, s.end)}
                                    fill="none"
                                    stroke={hovered ? hoverStroke : baseStroke}
                                    strokeWidth={hovered ? stroke + 1.25 : stroke}
                                    strokeLinecap="butt"
                                    style={{
                                        transition: "stroke 0.15s, stroke-width 0.15s, opacity 0.15s, filter 0.15s",
                                        opacity: hovered ? 1 : s.state === "alive" ? 1 : 0.95,
                                        filter: hovered
                                            ? `drop-shadow(0 0 6px ${VIT_RED_GLOW})`
                                            : s.state === "lost"
                                                ? `drop-shadow(0 0 3px ${VIT_RED_LOST_GLOW})`
                                                : undefined,
                                        pointerEvents: "none",
                                    }}
                                />
                            </g>
                        );
                    })}
                </Box>
            </CyberTooltip>
            <Box
                sx={{
                    position: "relative",
                    zIndex: 1,
                    borderRadius: "50%",
                    ...(canPick
                        ? {
                            animation: portraitActive
                                ? "none"
                                : "portraitHintPulse 2.8s ease-in-out infinite",
                            "@keyframes portraitHintPulse": {
                                "0%, 100%": {
                                    boxShadow: `0 0 0 0 ${UI_COLORS.anomaly}00`,
                                },
                                "50%": {
                                    boxShadow: `0 0 10px 1px ${UI_COLORS.anomaly}33`,
                                },
                            },
                            "@media (prefers-reduced-motion: reduce)": {
                                animation: "none",
                            },
                        }
                        : {}),
                }}
            >
                <CharAvatarButton
                    char={char}
                    active={!dead || portraitActive}
                    size={size}
                    title={
                        dead
                            ? "BREAK · clic para cambiar personaje"
                            : "Cambiar personaje"
                    }
                    onClick={canPick
                        ? (e) => {
                            e.stopPropagation();
                            onPortraitClick(e.currentTarget);
                        }
                        : undefined}
                />
            </Box>
        </Box>
    );
}

/**
 * Fracture / structural-failure background for the character surface.
 * Sits behind content (zIndex 0). Intensity scales with missing VIT (4=none … 0=critical).
 */
function SurfaceCrackOverlay({ vitCur, vitMax }) {
    const vmax = Math.max(1, vitMax || DEFAULT_VIT);
    const cur = Math.min(Math.max(vitCur, 0), vmax);
    const filled = vitToFilledSegs(cur, vmax);
    // Healthy when all 4 quarters are lit.
    if (filled >= VIT_RING_SEGMENTS) return null;

    const severity = filled <= 0 ? 4 : filled === 1 ? 3 : filled === 2 ? 2 : 1;
    const stroke = severity >= 3 ? UI_COLORS.accentStrong : UI_COLORS.accent;
    const cyan = UI_COLORS.anomaly;
    const pulse = severity >= 3;

    const primaryCracks = [
        "M8 22 L36 38 L58 26 L88 52 L118 34 L152 62 L186 44 L224 78 L258 56 L292 94 L316 72",
        "M4 98 L42 78 L76 108 L112 82 L148 118 L186 90 L228 128 L268 102 L312 138",
        "M148 2 L156 28 L142 54 L168 82 L150 112 L172 138 L158 158",
        "M18 58 L48 66 L74 52 L82 84 L108 72 L124 98",
        "M248 12 L268 42 L248 68 L278 98 L258 128 L286 152",
        "M96 8 L108 36 L92 58 L118 74 L104 102",
        "M200 48 L218 68 L204 92 L230 108 L216 136",
        "M60 130 L90 118 L118 142 L146 124 L174 148",
    ];
    const branchCracks = [
        "M72 40 L86 48 L80 62",
        "M180 52 L194 46 L198 62",
        "M240 88 L255 96 L248 110",
        "M130 100 L142 112 L136 124",
        "M40 90 L52 98 L46 110",
        "M280 50 L294 58 L286 72",
        "M160 30 L172 22 L178 38",
        "M100 70 L112 78 L106 90",
    ];
    const showPrimary = primaryCracks.slice(0, severity === 1 ? 3 : severity === 2 ? 5 : 8);
    const showBranch = branchCracks.slice(0, severity === 1 ? 2 : severity === 2 ? 4 : 8);

    return (
        <Box
            aria-hidden
            sx={{
                pointerEvents: "none",
                position: "absolute",
                inset: 0,
                borderRadius: "inherit",
                overflow: "hidden",
                zIndex: 0,
                animation: pulse ? "vitCritPulse 1.15s ease-in-out infinite" : "none",
                "@keyframes vitCritPulse": {
                    "0%, 100%": { opacity: 1 },
                    "50%": { opacity: 0.78 },
                },
                "@media (prefers-reduced-motion: reduce)": { animation: "none" },
            }}
        >
            {/* Base damage wash */}
            <Box
                sx={{
                    position: "absolute",
                    inset: 0,
                    background: severity >= 3
                        ? `radial-gradient(ellipse at 18% 40%, ${VIT_RED}28 0%, transparent 55%),
                           radial-gradient(ellipse at 82% 70%, ${UI_COLORS.accent}22 0%, transparent 50%),
                           linear-gradient(135deg, ${VIT_RED}12 0%, transparent 40%, ${cyan}10 100%)`
                        : severity >= 2
                            ? `radial-gradient(ellipse at 20% 35%, ${UI_COLORS.accent}18 0%, transparent 55%),
                               linear-gradient(160deg, ${UI_COLORS.accent}10 0%, transparent 45%)`
                            : `radial-gradient(ellipse at 15% 30%, ${UI_COLORS.accent}12 0%, transparent 50%)`,
                }}
            />

            {/* Circuit / hatch lattice */}
            <Box
                component="svg"
                viewBox="0 0 320 160"
                preserveAspectRatio="none"
                sx={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    opacity: 0.22 + severity * 0.06,
                }}
            >
                {Array.from({ length: 9 }, (_, i) => (
                    <line
                        key={`h${i}`}
                        x1="0"
                        y1={12 + i * 18}
                        x2="320"
                        y2={8 + i * 18}
                        stroke={i % 2 === 0 ? cyan : stroke}
                        strokeWidth="0.35"
                        opacity={0.35}
                    />
                ))}
                {Array.from({ length: 12 }, (_, i) => (
                    <line
                        key={`v${i}`}
                        x1={14 + i * 26}
                        y1="0"
                        x2={8 + i * 26}
                        y2="160"
                        stroke={stroke}
                        strokeWidth="0.3"
                        opacity={0.28}
                    />
                ))}
                {/* Hex nodes */}
                {[
                    [48, 36], [120, 24], [200, 40], [270, 28],
                    [70, 90], [160, 80], [240, 100], [300, 70],
                    [100, 140], [190, 130], [280, 145],
                ].slice(0, 4 + severity * 2).map(([x, y], i) => (
                    <g key={`n${i}`} opacity={0.4 + severity * 0.08}>
                        <circle cx={x} cy={y} r={2.2} fill="none" stroke={i % 2 ? cyan : stroke} strokeWidth="0.7" />
                        <circle cx={x} cy={y} r={0.8} fill={i % 2 ? cyan : stroke} opacity="0.7" />
                    </g>
                ))}
            </Box>

            {/* Main fracture network */}
            <Box
                component="svg"
                viewBox="0 0 320 160"
                preserveAspectRatio="none"
                sx={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            >
                {showPrimary.map((d, i) => (
                    <path
                        key={`p${i}`}
                        d={d}
                        fill="none"
                        stroke={i % 3 === 1 ? cyan : stroke}
                        strokeWidth={severity >= 3 ? 1.75 : severity >= 2 ? 1.35 : 1.05}
                        strokeLinecap="square"
                        strokeLinejoin="miter"
                        opacity={0.42 + severity * 0.1 - i * 0.03}
                        style={{
                            filter: `drop-shadow(0 0 ${1.5 + severity}px ${i % 3 === 1 ? cyan : stroke})`,
                        }}
                    />
                ))}
                {showBranch.map((d, i) => (
                    <path
                        key={`b${i}`}
                        d={d}
                        fill="none"
                        stroke={i % 2 === 0 ? stroke : cyan}
                        strokeWidth={0.85}
                        strokeLinecap="square"
                        opacity={0.38 + severity * 0.08}
                    />
                ))}

                {/* Shatter shards */}
                {severity >= 2 && (
                    <>
                        <polygon points="22,14 40,8 36,28 18,24" fill={stroke} opacity={0.22 + severity * 0.06} />
                        <polygon points="268,98 292,90 286,118 262,112" fill={cyan} opacity={0.18 + severity * 0.06} />
                        <polygon points="112,48 128,42 124,62 108,58" fill={stroke} opacity={0.16} />
                        <polygon points="196,118 214,112 208,132 190,128" fill={cyan} opacity={0.14} />
                    </>
                )}
                {severity >= 3 && (
                    <>
                        <polygon points="132,2 152,-2 146,20 128,16" fill={VIT_RED} opacity={0.5} />
                        <polygon points="208,136 230,128 222,158 200,152" fill={VIT_RED} opacity={0.42} />
                        <polygon points="54,70 66,64 62,84 50,78" fill={VIT_RED} opacity={0.35} />
                        <polygon points="290,40 308,34 302,56 286,50" fill={UI_COLORS.accentStrong} opacity={0.3} />
                        {/* Glitch scanlines */}
                        <line x1="0" y1="42" x2="320" y2="50" stroke={cyan} strokeWidth="0.7" opacity="0.4" />
                        <line x1="0" y1="88" x2="320" y2="80" stroke={stroke} strokeWidth="0.55" opacity="0.35" />
                        <line x1="0" y1="124" x2="320" y2="132" stroke={VIT_RED} strokeWidth="0.5" opacity="0.32" />
                        {/* Broken corner brackets */}
                        <path d="M4 4 L28 4 M4 4 L4 26" stroke={stroke} strokeWidth="1.2" opacity="0.55" fill="none" />
                        <path d="M316 4 L292 4 M316 4 L316 26" stroke={cyan} strokeWidth="1.2" opacity="0.5" fill="none" />
                        <path d="M4 156 L28 156 M4 156 L4 134" stroke={cyan} strokeWidth="1.2" opacity="0.5" fill="none" />
                        <path d="M316 156 L292 156 M316 156 L316 134" stroke={VIT_RED} strokeWidth="1.2" opacity="0.55" fill="none" />
                    </>
                )}
                {severity >= 4 && (
                    <>
                        <rect x="0" y="0" width="320" height="160" fill={VIT_RED} opacity="0.08" />
                        <line x1="40" y1="0" x2="60" y2="160" stroke={VIT_RED} strokeWidth="1.1" opacity="0.35" />
                        <line x1="250" y1="0" x2="270" y2="160" stroke={stroke} strokeWidth="0.9" opacity="0.3" />
                    </>
                )}
            </Box>

            {/* Edge burn / inset glow — behind UI */}
            <Box
                sx={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "inherit",
                    boxShadow: severity >= 3
                        ? `inset 0 0 36px ${VIT_RED}50, inset 0 0 12px ${UI_COLORS.accent}40, inset 0 0 2px ${VIT_RED}66`
                        : severity >= 2
                            ? `inset 0 0 24px ${UI_COLORS.accent}38, inset 0 0 8px ${cyan}22`
                            : `inset 0 0 16px ${UI_COLORS.accent}28`,
                }}
            />
        </Box>
    );
}

function CharAvatarButton({
    char,
    active,
    onClick,
    onContextMenu,
    size = 44,
    pinned = false,
    title,
}) {
    const initials = (char.name || "?").slice(0, 2).toUpperCase();
    const crop = normalizeTokenCrop(char.tokenCrop);
    const imagePath = char.tokenImageUrl || char.imageUrl || "";
    const url = useAssetUrl(imagePath || null);
    const hasImg = Boolean(url);
    const cropCss = tokenCropCss(crop);
    const tip = title
        ?? (onClick
            ? `${char.name || "—"} · clic activar · menú contextual`
            : (char.name || "—"));

    return (
        <CyberTooltip title={tip} placement="top">
            <Box
                component={onClick || onContextMenu ? "button" : "div"}
                type={onClick || onContextMenu ? "button" : undefined}
                onClick={onClick}
                onContextMenu={(e) => {
                    if (!onContextMenu) return;
                    e.preventDefault();
                    e.stopPropagation();
                    onContextMenu(e);
                }}
                sx={{
                    position: "relative",
                    width: size,
                    height: size,
                    borderRadius: "50%",
                    border: `2px solid ${active ? UI_COLORS.anomaly : pinned ? UI_COLORS.accent : UI_COLORS.border}`,
                    bgcolor: active ? `${UI_COLORS.anomaly}22` : "rgba(0,0,0,0.35)",
                    color: active ? UI_COLORS.anomaly : UI_COLORS.textSecondary,
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: size > 36 ? "0.65rem" : "0.5rem",
                    letterSpacing: "0.04em",
                    cursor: onClick || onContextMenu ? "pointer" : "default",
                    p: 0,
                    boxShadow: active ? `0 0 10px ${UI_COLORS.anomaly}44` : "none",
                    overflow: "hidden",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "border-color 0.15s, box-shadow 0.15s, transform 0.12s",
                    "&:hover": onClick ? {
                        borderColor: UI_COLORS.accent,
                        transform: "scale(1.04)",
                        boxShadow: `0 0 12px ${UI_COLORS.accent}44`,
                    } : {},
                }}
            >
                {hasImg ? (
                    <Box
                        component="img"
                        src={url}
                        alt={char.name || ""}
                        decoding="sync"
                        loading="eager"
                        sx={{
                            width: "100%",
                            height: "100%",
                            ...cropCss,
                        }}
                    />
                ) : (
                    initials
                )}
            </Box>
        </CyberTooltip>
    );
}

function MiniHpBar({ pct }) {
    const color = pct <= 25 ? "#ff3355" : pct <= 50 ? "#f97316" : UI_COLORS.anomaly;
    return (
        <Box
            sx={{
                mt: 0.35,
                width: "100%",
                height: 3,
                borderRadius: 1,
                bgcolor: "rgba(255,255,255,0.08)",
                overflow: "hidden",
            }}
        >
            <Box sx={{ height: "100%", width: `${pct}%`, bgcolor: color }} />
        </Box>
    );
}

function ActivateCharacterButton({
    roster,
    selectedId,
    onSelect,
    pinnedIds,
    onTogglePin,
    anchorEl,
    onOpen,
    onClose,
    hideTrigger = false,
}) {
    const [query, setQuery] = useState("");

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return roster;
        return roster.filter((c) => (c.name || c.id || "").toLowerCase().includes(q));
    }, [roster, query]);

    const open = Boolean(anchorEl);
    const hasRoster = roster.length > 0;

    const handleClose = () => {
        onClose?.();
        setQuery("");
    };

    return (
        <>
            {!hideTrigger && (
                <CyberTooltip title="Activar personaje" placement="top">
                    <Box
                        component="button"
                        type="button"
                        disabled={!hasRoster}
                        onClick={(e) => onOpen?.(e.currentTarget)}
                        sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 0.55,
                            px: 1,
                            py: 0.4,
                            borderRadius: 1,
                            border: `1px solid ${open ? UI_COLORS.anomaly : UI_COLORS.accent}66`,
                            bgcolor: open ? `${UI_COLORS.anomaly}14` : "rgba(0,0,0,0.45)",
                            color: open ? UI_COLORS.anomaly : UI_COLORS.accent,
                            cursor: hasRoster ? "pointer" : "default",
                            fontFamily: "'Orbitron', sans-serif",
                            fontSize: "0.52rem",
                            letterSpacing: "0.14em",
                            boxShadow: open ? `0 0 12px ${UI_COLORS.anomaly}33` : "none",
                            opacity: hasRoster ? 1 : 0.45,
                            transition: "border-color 0.15s, box-shadow 0.15s, background-color 0.15s",
                            "&:hover": hasRoster ? {
                                borderColor: UI_COLORS.accent,
                                boxShadow: `0 0 12px ${UI_COLORS.accent}44`,
                            } : {},
                        }}
                    >
                        <BadgeIcon sx={{ fontSize: "0.95rem" }} />
                        ACTIVAR
                    </Box>
                </CyberTooltip>
            )}
            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{ vertical: "top", horizontal: "left" }}
                transformOrigin={{ vertical: "bottom", horizontal: "left" }}
                slotProps={{
                    paper: {
                        sx: {
                            mb: 1,
                            p: 1,
                            width: 260,
                            bgcolor: UI_COLORS.backgroundSecondary,
                            border: `1px solid ${UI_COLORS.border}`,
                            boxShadow: `0 0 18px ${UI_COLORS.accentGlow}`,
                            color: UI_COLORS.textPrimary,
                        },
                    },
                }}
            >
                <CyberText sx={{ fontSize: "0.5rem", letterSpacing: 1, color: UI_COLORS.textSecondary, mb: 0.75, px: 0.25 }}>
                    ACTIVAR PERSONAJE
                </CyberText>
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 0.5,
                        maxHeight: 220,
                        overflowY: "auto",
                        mb: 1,
                        pr: 0.25,
                        ...CYBER_SCROLL_STYLE,
                    }}
                >
                    {filtered.map((c) => {
                        const isPinned = pinnedIds.includes(c.id);
                        const isActive = c.id === selectedId;
                        return (
                            <Box
                                key={c.id}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 0.75,
                                    px: 0.5,
                                    py: 0.35,
                                    borderRadius: 1,
                                    border: `1px solid ${isActive ? UI_COLORS.anomaly : "transparent"}`,
                                    bgcolor: isActive ? `${UI_COLORS.anomaly}12` : "transparent",
                                }}
                            >
                                <CharAvatarButton
                                    char={c}
                                    active={isActive}
                                    pinned={isPinned}
                                    size={36}
                                    title={`${c.name || "—"} · activar`}
                                    onClick={() => {
                                        onSelect(c.id);
                                        handleClose();
                                    }}
                                />
                                <CyberText
                                    sx={{
                                        flex: 1,
                                        minWidth: 0,
                                        fontSize: "0.62rem",
                                        color: UI_COLORS.textPrimary,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        cursor: "pointer",
                                    }}
                                    onClick={() => {
                                        onSelect(c.id);
                                        handleClose();
                                    }}
                                >
                                    {c.name || "—"}
                                </CyberText>
                                <CyberTooltip title={isPinned ? "Quitar pin" : "Pin en HUD"}>
                                    <IconButton
                                        size="small"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onTogglePin(c.id);
                                        }}
                                        sx={{
                                            color: isPinned ? UI_COLORS.accent : UI_COLORS.textSecondary,
                                            p: 0.35,
                                        }}
                                    >
                                        <PushPinIcon sx={{ fontSize: "0.85rem" }} />
                                    </IconButton>
                                </CyberTooltip>
                            </Box>
                        );
                    })}
                    {filtered.length === 0 && (
                        <CyberText sx={{ fontSize: "0.62rem", color: UI_COLORS.textSecondary, py: 1 }}>
                            Sin coincidencias
                        </CyberText>
                    )}
                </Box>
                <TextField
                    size="small"
                    fullWidth
                    placeholder="Buscar…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon sx={{ fontSize: "0.95rem", color: UI_COLORS.textSecondary }} />
                            </InputAdornment>
                        ),
                    }}
                    sx={{
                        "& .MuiInputBase-input": {
                            color: UI_COLORS.textPrimary,
                            fontFamily: "'Fira Code', monospace",
                            fontSize: "0.68rem",
                            py: 0.65,
                        },
                        "& .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.border },
                        "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.accent },
                        "& .Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.anomaly },
                    }}
                />
            </Popover>
        </>
    );
}

function CharHudContextMenu({
    anchorEl,
    char,
    isActive,
    isPinned,
    isBroken = false,
    onClose,
    onActivate,
    onDeactivate,
    onTogglePin,
    onChangeCharacter,
    onCureBreak,
}) {
    const open = Boolean(anchorEl && char);
    const name = (char?.name || "PERSONAJE").toUpperCase();

    return (
        <Menu
            open={open}
            anchorEl={anchorEl}
            onClose={onClose}
            anchorOrigin={{ vertical: "top", horizontal: "center" }}
            transformOrigin={{ vertical: "bottom", horizontal: "center" }}
            slotProps={{
                paper: {
                    sx: {
                        ...cyberMenuPaperSx,
                        mb: 0.75,
                        minWidth: 200,
                        boxShadow: `0 0 18px ${UI_COLORS.accentGlow}`,
                    },
                },
            }}
        >
            <Box sx={{ px: 1.25, py: 0.65, borderBottom: `1px solid ${UI_COLORS.border}` }}>
                <CyberText sx={{ fontSize: "0.5rem", color: UI_COLORS.textSecondary, letterSpacing: 1 }}>
                    {name}
                </CyberText>
            </Box>
            {!isActive && (
                <MenuItem
                    onClick={() => {
                        onActivate?.(char.id);
                        onClose();
                    }}
                    sx={{ ...cyberMenuItemSx, fontSize: "0.72rem", gap: 1, py: 0.85 }}
                >
                    <ListItemIcon sx={{ minWidth: 28, color: UI_COLORS.anomaly }}>
                        <CheckIcon sx={{ fontSize: "1rem" }} />
                    </ListItemIcon>
                    <ListItemText
                        primary="Activar"
                        primaryTypographyProps={{
                            sx: { color: UI_COLORS.textPrimary, fontFamily: "'Fira Code', monospace", fontSize: "0.72rem" },
                        }}
                    />
                </MenuItem>
            )}
            {isActive && (
                <MenuItem
                    onClick={() => {
                        onDeactivate?.();
                        onClose();
                    }}
                    sx={{ ...cyberMenuItemSx, fontSize: "0.72rem", gap: 1, py: 0.85 }}
                >
                    <ListItemIcon sx={{ minWidth: 28, color: UI_COLORS.accentStrong }}>
                        <PersonOffIcon sx={{ fontSize: "1rem" }} />
                    </ListItemIcon>
                    <ListItemText
                        primary="Desactivar"
                        primaryTypographyProps={{
                            sx: { color: UI_COLORS.textPrimary, fontFamily: "'Fira Code', monospace", fontSize: "0.72rem" },
                        }}
                    />
                </MenuItem>
            )}
            {isActive && (
                <MenuItem
                    onClick={() => {
                        onClose();
                        onChangeCharacter?.();
                    }}
                    sx={{ ...cyberMenuItemSx, fontSize: "0.72rem", gap: 1, py: 0.85 }}
                >
                    <ListItemIcon sx={{ minWidth: 28, color: UI_COLORS.accent }}>
                        <SwapHorizIcon sx={{ fontSize: "1rem" }} />
                    </ListItemIcon>
                    <ListItemText
                        primary="Cambiar personaje"
                        primaryTypographyProps={{
                            sx: { color: UI_COLORS.textPrimary, fontFamily: "'Fira Code', monospace", fontSize: "0.72rem" },
                        }}
                    />
                </MenuItem>
            )}
            {isActive && isBroken && (
                <MenuItem
                    onClick={() => {
                        onCureBreak?.();
                        onClose();
                    }}
                    sx={{ ...cyberMenuItemSx, fontSize: "0.72rem", gap: 1, py: 0.85 }}
                >
                    <ListItemIcon sx={{ minWidth: 28, color: UI_COLORS.anomaly }}>
                        <HealingIcon sx={{ fontSize: "1rem" }} />
                    </ListItemIcon>
                    <ListItemText
                        primary="Curar Break"
                        primaryTypographyProps={{
                            sx: { color: UI_COLORS.textPrimary, fontFamily: "'Fira Code', monospace", fontSize: "0.72rem" },
                        }}
                    />
                </MenuItem>
            )}
            <MenuItem
                onClick={() => {
                    onTogglePin?.(char.id);
                    onClose();
                }}
                sx={{ ...cyberMenuItemSx, fontSize: "0.72rem", gap: 1, py: 0.85 }}
            >
                <ListItemIcon sx={{ minWidth: 28, color: isPinned ? UI_COLORS.accent : UI_COLORS.textSecondary }}>
                    {isPinned
                        ? <PushPinIcon sx={{ fontSize: "1rem" }} />
                        : <PushPinOutlinedIcon sx={{ fontSize: "1rem" }} />}
                </ListItemIcon>
                <ListItemText
                    primary={isPinned ? "Quitar pin" : "Fijar en HUD"}
                    primaryTypographyProps={{
                        sx: { color: UI_COLORS.textPrimary, fontFamily: "'Fira Code', monospace", fontSize: "0.72rem" },
                    }}
                />
            </MenuItem>
        </Menu>
    );
}

function EffortBar({ current, max, onSet }) {
    const color = "#f97316";
    return (
        <Box
            sx={{
                flex: 1,
                display: "flex",
                gap: 0.4,
                height: 10,
                minWidth: 0,
            }}
        >
            {Array.from({ length: max }, (_, i) => {
                const filled = i < current;
                return (
                    <CyberTooltip key={i} title={`Effort ${i + 1}${filled ? " (gastado)" : ""}`} placement="top">
                        <Box
                            component="button"
                            type="button"
                            onClick={() => onSet(i < current ? i : i + 1)}
                            sx={{
                                flex: 1,
                                height: "100%",
                                p: 0,
                                borderRadius: 0.5,
                                border: `1px solid ${filled ? color : "rgba(255,255,255,0.14)"}`,
                                bgcolor: filled ? color : "rgba(255,255,255,0.05)",
                                boxShadow: filled ? `0 0 8px ${color}55` : "none",
                                cursor: "pointer",
                                transition: "background-color 0.12s, transform 0.12s",
                                "&:hover": { transform: "scaleY(1.12)" },
                            }}
                        />
                    </CyberTooltip>
                );
            })}
        </Box>
    );
}

const glassBtnSx = (active) => ({
    width: 36,
    height: 36,
    borderRadius: 1,
    border: `1px solid ${active ? UI_COLORS.anomaly : VTT_HUD.glassBorder}`,
    bgcolor: VTT_HUD.glassBg,
    backdropFilter: "blur(14px)",
    color: active ? UI_COLORS.anomaly : UI_COLORS.accent,
    boxShadow: active
        ? `0 0 12px ${UI_COLORS.anomaly}44`
        : "0 0 12px rgba(255,102,255,0.06)",
    flexShrink: 0,
    transition: "border-color 0.15s, box-shadow 0.15s, color 0.15s",
    "&:hover": {
        borderColor: UI_COLORS.accent,
        bgcolor: `${UI_COLORS.accent}14`,
    },
});

function ActionModChip({ label, active, accent, onClick }) {
    return (
        <Box
            component="button"
            type="button"
            onClick={onClick}
            aria-pressed={active}
            sx={{
                minWidth: 28,
                height: 22,
                px: 0.45,
                borderRadius: "3px",
                border: `1px solid ${active ? accent : UI_COLORS.border}`,
                bgcolor: active ? `${accent}22` : "transparent",
                color: active ? UI_COLORS.textPrimary : UI_COLORS.textSecondary,
                fontFamily: TYPO.mono,
                fontSize: "0.62rem",
                lineHeight: 1,
                cursor: "pointer",
                transition: "border-color 0.12s, background-color 0.12s, color 0.12s",
                "&:hover": {
                    borderColor: accent,
                    color: UI_COLORS.textPrimary,
                },
            }}
        >
            {label}
        </Box>
    );
}

/** Compact Boon / Curse strip + live pool preview for the Actions dock. */
function ActionModsToolbar({ delta, onDelta, poolPreview }) {
    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.65,
                minWidth: 0,
                flexWrap: "wrap",
                justifyContent: "flex-end",
            }}
        >
            <CyberText
                sx={{
                    fontFamily: TYPO.mono,
                    fontSize: "0.52rem",
                    color: poolPreview?.isLowest ? UI_COLORS.danger : UI_COLORS.anomaly,
                    letterSpacing: "0.02em",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                }}
            >
                {poolPreview?.summary || "—"}
            </CyberText>
            <Box
                role="group"
                aria-label="Boon o Curse"
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                }}
            >
                <CyberText
                    sx={{
                        fontFamily: TYPO.mono,
                        fontSize: "0.4rem",
                        letterSpacing: "0.1em",
                        color: UI_COLORS.boon,
                        userSelect: "none",
                    }}
                >
                    BOON
                </CyberText>
                {ACTION_MOD_OPTS.slice(0, 2).map((opt) => (
                    <ActionModChip
                        key={opt.key}
                        label={opt.label}
                        active={delta === opt.delta}
                        accent={UI_COLORS.boon}
                        onClick={() => onDelta(opt.delta)}
                    />
                ))}
                <CyberText
                    sx={{
                        fontFamily: TYPO.mono,
                        fontSize: "0.42rem",
                        color: UI_COLORS.textSecondary,
                        px: 0.25,
                        userSelect: "none",
                    }}
                >
                    |
                </CyberText>
                <CyberText
                    sx={{
                        fontFamily: TYPO.mono,
                        fontSize: "0.4rem",
                        letterSpacing: "0.1em",
                        color: UI_COLORS.danger,
                        userSelect: "none",
                    }}
                >
                    CURSE
                </CyberText>
                {ACTION_MOD_OPTS.slice(2).map((opt) => (
                    <ActionModChip
                        key={opt.key}
                        label={opt.label}
                        active={delta === opt.delta}
                        accent={UI_COLORS.danger}
                        onClick={() => onDelta(opt.delta)}
                    />
                ))}
            </Box>
        </Box>
    );
}

/**
 * Larger action tile: icon + short name + rating.
 * Click rolls with the dock's current Boon/Curse.
 */
function ActionTile({ statDef, value, penance = 0, busy, onRoll }) {
    const Icon = STAT_ICONS[statDef.key] || CasinoIcon;
    const base = Math.max(0, Math.floor(Number(value) || 0));
    const pen = Math.max(0, Math.floor(Number(penance) || 0));
    const n = effectiveActionDice(base, pen);
    const label = String(statDef.label || statDef.key || "?").toUpperCase();
    const purpose = (statDef.description || "").trim();
    const tipBody = pen > 0
        ? `${purpose || label}\n\nAction Penalty −${pen} (base ${base} → ${n})`.trim()
        : purpose;

    return (
        <CyberTooltip
            title={
                tipBody
                    ? <HudRichTooltipTitle body={tipBody} />
                    : <HudRichTooltipTitle title={label} />
            }
            placement="top"
            slotProps={hudRichTooltipSlotProps}
        >
            <Box
                component="button"
                type="button"
                disabled={busy}
                onClick={() => onRoll?.(statDef)}
                aria-label={`Tirar ${label}`}
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 0.25,
                    minWidth: 0,
                    width: "100%",
                    height: 62,
                    px: 0.35,
                    py: 0.4,
                    borderRadius: "4px",
                    border: `1px solid ${UI_COLORS.border}`,
                    bgcolor: "rgba(0,0,0,0.28)",
                    color: UI_COLORS.textSecondary,
                    cursor: busy ? "default" : "pointer",
                    opacity: busy ? 0.55 : 1,
                    transition: "border-color 0.12s, background-color 0.12s, color 0.12s, box-shadow 0.12s",
                    "&:hover": busy ? {} : {
                        color: UI_COLORS.textPrimary,
                        borderColor: UI_COLORS.accent,
                        bgcolor: `${UI_COLORS.accent}14`,
                        boxShadow: `0 0 10px ${UI_COLORS.accent}33`,
                    },
                    "&:focus-visible": {
                        outline: `1px solid ${UI_COLORS.anomaly}`,
                        outlineOffset: 1,
                    },
                }}
            >
                <Box sx={{ position: "relative", lineHeight: 0 }}>
                    {busy ? (
                        <CircularProgress size={18} sx={{ color: UI_COLORS.anomaly }} />
                    ) : (
                        <Icon sx={{ fontSize: "1.35rem", color: "inherit" }} />
                    )}
                    <Box
                        component="span"
                        sx={{
                            position: "absolute",
                            top: -7,
                            right: -10,
                            minWidth: 15,
                            height: 15,
                            px: "3px",
                            borderRadius: "8px",
                            bgcolor: (n <= 0 || pen > 0) ? UI_COLORS.danger : UI_COLORS.anomaly,
                            color: "#0a0a12",
                            fontFamily: TYPO.mono,
                            fontSize: "0.52rem",
                            fontWeight: 700,
                            lineHeight: "15px",
                            textAlign: "center",
                            border: `1px solid ${UI_COLORS.backgroundSecondary}`,
                        }}
                    >
                        {n}
                    </Box>
                </Box>
                <CyberText
                    sx={{
                        fontFamily: TYPO.title,
                        fontSize: "0.42rem",
                        letterSpacing: "0.06em",
                        color: "inherit",
                        lineHeight: 1.1,
                        maxWidth: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {label}
                </CyberText>
            </Box>
        </CyberTooltip>
    );
}

/** Bottom-left: session life sheet + pin rail + dossier/actions/macros column. */
export default function CharacterCombatHud({ abilityBarOpen = false, onToggleAbilityBar }) {
    const dispatch = useDispatch();
    const profile = useSelector((s) => s.player.profile);
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const locations = useSelector((s) => s.world.locations);
    const charactersById = useSelector((s) => s.world.charactersById ?? {});
    const sheetCharacters = useSelector((s) => s.characters.list);
    const remotePools = useSelector((s) => s.game.sessionPools ?? {});
    const initiative = useSelector((s) => s.game.initiative);
    const sheetOpen = useSelector((s) => !!s.ui.openDialogs?.sheet);
    const { resourceTracks, stats: statDefs } = useStatSystem(campaignId);

    const isDM = isDmRole(profile?.role);
    const [statsOpen, setStatsOpen] = useState(false);
    const [activateAnchor, setActivateAnchor] = useState(null);
    const [charMenu, setCharMenu] = useState(null); // { anchorEl, char }
    /** Exclusive action mod: 0 | +1 | +2 | −1 | −2 */
    const [actionDelta, setActionDelta] = useState(0);
    const [statRolling, setStatRolling] = useState(false);
    const surfaceRef = useRef(null);
    // Ref lock — avoid setState flash on every icon while a roll is in flight.
    const rollingRef = useRef(null);

    const roster = useMemo(() => {
        const byId = buildCampaignCharacterMap(
            charactersById,
            locations,
            sheetCharacters,
            campaignId,
        );
        const all = [...byId.values()];
        const visible = isDM ? all : all.filter((c) => canControlToken(c, profile));
        return visible.sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));
    }, [charactersById, locations, sheetCharacters, campaignId, isDM, profile]);

    const selectedId = profile?.activeCharacterId && roster.some((c) => c.id === profile.activeCharacterId)
        ? profile.activeCharacterId
        : null;

    const selected = useMemo(() => {
        const base = roster.find((c) => c.id === selectedId) || null;
        if (!base) return null;
        const sheet = (sheetCharacters || []).find((c) => c.id === base.id);
        if (!sheet) return { ...base, burdens: normalizeBurdens(base.burdens) };
        return {
            ...base,
            ...sheet,
            // Don't let a sparse sheet stub wipe map/HUD token media.
            imageUrl: sheet.imageUrl || base.imageUrl || null,
            tokenImageUrl: sheet.tokenImageUrl || base.tokenImageUrl || null,
            tokenCrop: sheet.tokenCrop || base.tokenCrop || null,
            burdens: mergeBurdensPreferFilled(sheet.burdens, base.burdens),
            macroBar: mergeMacroBarPreferFilled(sheet.macroBar, base.macroBar),
        };
    }, [roster, selectedId, sheetCharacters]);

    const activeInitEntry = useMemo(() => {
        if (!initiative?.started || !initiative?.open) return null;
        const entries = initiative.entries ?? [];
        if (!entries.length) return null;
        const idx = initiative.activeIndex ?? 0;
        return entries[idx] || null;
    }, [initiative]);

    const isMyTurn = useMemo(() => {
        if (!activeInitEntry?.id) return false;
        const turnChar = charactersById[activeInitEntry.id]
            || roster.find((c) => c.id === activeInitEntry.id)
            || null;
        if (!turnChar || !canControlToken(turnChar, profile)) return false;
        // DM controls everyone — only highlight when that token is the HUD selection.
        if (isDM) return selectedId === turnChar.id;
        return true;
    }, [activeInitEntry, charactersById, roster, profile, isDM, selectedId]);

    const { pinnedIds, togglePin } = usePinnedCharacters(profile?.uid, campaignId);

    /**
     * Session-activated characters (≠ pins). Stay visible above the HUD when
     * another character is active so switching never "eats" the rest.
     */
    const [activatedIds, setActivatedIds] = useState([]);

    useEffect(() => {
        if (!selectedId) return;
        setActivatedIds((prev) => (prev.includes(selectedId) ? prev : [...prev, selectedId]));
    }, [selectedId]);

    /** Above the surface: activated and/or pinned, excluding the one in the main HUD. */
    const stripChars = useMemo(() => {
        const order = [];
        const seen = new Set();
        const push = (id) => {
            if (!id || id === selectedId || seen.has(id)) return;
            const c = roster.find((x) => x.id === id);
            if (!c) return;
            seen.add(id);
            order.push(c);
        };
        activatedIds.forEach(push);
        pinnedIds.forEach(push);
        return order;
    }, [activatedIds, pinnedIds, roster, selectedId]);

    const openCharMenu = (e, char) => {
        if (!char) return;
        e.preventDefault();
        e.stopPropagation();
        setCharMenu({ anchorEl: e.currentTarget, char });
    };

    const closeCharMenu = () => setCharMenu(null);

    const openActivatePicker = (anchor) => {
        setActivateAnchor(anchor || surfaceRef.current);
    };

    const toggleActivatePicker = (anchor) => {
        setActivateAnchor((prev) => (prev ? null : (anchor || surfaceRef.current)));
    };

    const { combatStats } = useResolvedCombatStats(selected);
    const vitMax = selected ? combatStats.vit : 4;
    const sheetHpMax = selected ? combatStats.hpMax : 16;

    const combatTracks = useMemo(() => {
        if (!selected) return [];
        const effortBase = (resourceTracks || []).find((t) => t.key === "effort")
            || { key: "effort", label: "Effort", maxDefault: 3, stateKey: "exhausted", stateLabel: "Exhausted" };
        const effortMaxDefault = Math.max(1, Math.floor(Number(effortBase.maxDefault) || 3));
        return [
            { ...effortBase, key: "effort", maxDefault: effortMaxDefault, stateKey: "exhausted", stateLabel: "Exhausted" },
            { key: "vit", label: "VIT", maxDefault: vitMax, defaultFull: true },
            { key: "hp", label: "HP", maxDefault: sheetHpMax, defaultFull: true, stateKey: "broken", stateLabel: "Break" },
        ];
    }, [resourceTracks, vitMax, sheetHpMax, selected]);

    const effortMax = useMemo(() => {
        const t = combatTracks.find((x) => x.key === "effort");
        return Math.max(1, Math.floor(Number(t?.maxDefault) || 3));
    }, [combatTracks]);

    const { pools, setTrack, persist } = useCharacterSessionPools(selected?.id, combatTracks, { campaignId });

    const vitCur = selected
        ? Math.min(Math.max(pools.vit?.current ?? vitMax, 0), vitMax)
        : 0;
    const sessionHpMax = selected ? resolveSessionHpMax(vitCur) : 0;
    const hpCur = selected
        ? Math.min(Math.max(pools.hp?.current ?? sessionHpMax, 0), sessionHpMax || 0)
        : 0;
    const hpPct = sessionHpMax > 0 ? (hpCur / sessionHpMax) * 100 : 0;
    const effortCur = selected
        ? Math.min(Math.max(pools.effort?.current ?? 0, 0), effortMax)
        : 0;
    const isBroken = Boolean(selected && pools.hp?.broken);
    const isExhausted = Boolean(selected && (effortCur >= effortMax || pools.effort?.exhausted));
    const isDead = Boolean(selected && vitCur <= 0);

    const resolvePinHp = (char) => {
        const vmax = resolveVit(char);
        const tracks = [
            { key: "vit", label: "VIT", maxDefault: vmax, defaultFull: true },
            { key: "hp", label: "HP", maxDefault: resolveHpMax(char), defaultFull: true },
        ];
        const remote = remotePools?.[char.id];
        const local = getSessionPools(char.id, tracks);
        const vCur = Math.min(
            Math.max(Number(remote?.vit?.current ?? local?.vit?.current ?? vmax) || 0, 0),
            vmax,
        );
        const max = resolveSessionHpMax(vCur);
        const current = remote?.hp?.current ?? local?.hp?.current ?? max;
        const cur = Math.min(Math.max(Number(current) || 0, 0), max || 1);
        return { cur, max, pct: max > 0 ? (cur / max) * 100 : 0 };
    };

    const handleSelect = (charId) => {
        if (!profile?.uid || !charId) return;
        dispatch(setActiveCharacterId(charId));
        dispatch(persistActiveCharacter({ uid: profile.uid, characterId: charId }));
        setActivatedIds((prev) => (prev.includes(charId) ? prev : [...prev, charId]));
    };

    const handleDeactivate = () => {
        if (!profile?.uid) return;
        dispatch(setActiveCharacterId(null));
        dispatch(persistActiveCharacter({ uid: profile.uid, characterId: null }));
        setStatsOpen(false);
    };

    const handleVitChange = (nextVit) => {
        if (!selected) return;
        const prevHp = hpCur;
        const result = applyVitChange(pools, vitMax, nextVit);
        // Break only when current HP crosses to 0 — not merely from losing VIT.
        const broken = prevHp > 0 && result.hp.current <= 0
            ? true
            : Boolean(pools.hp?.broken);
        persist({
            ...pools,
            vit: result.vit,
            hp: { ...result.hp, broken },
        });
    };

    const handleHpBarClick = (e) => {
        if (!selected || sessionHpMax <= 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
        const nextHp = Math.round(ratio * sessionHpMax);
        // Break arms when HP is driven to 0 (once), even if ICON VIT-cascade refills the bar.
        const hitZero = nextHp <= 0;
        const result = applyHpWithVitCascade(pools, vitMax, nextHp);
        const broken = hitZero || result.hp.current <= 0
            ? true
            : Boolean(pools.hp?.broken);
        persist({
            ...pools,
            vit: result.vit,
            hp: { ...result.hp, broken },
        });
    };

    const handleCureBreak = () => {
        if (!selected) return;
        // Clear Break only — do not require / imply full VIT recovery.
        persist({
            ...pools,
            hp: { ...(pools.hp || {}), current: hpCur, broken: false },
        });
    };

    const handleEffortSet = (v) => {
        const next = Math.min(Math.max(Math.floor(Number(v) || 0), 0), effortMax);
        setTrack("effort", { current: next, exhausted: next >= effortMax });
    };

    const handleActionDelta = (next) => {
        setActionDelta((prev) => (prev === next ? 0 : next));
    };

    const handleActionRoll = async (statDef) => {
        if (!campaignId || !selected || !statDef?.key || rollingRef.current) return;
        const base = selected.stats?.[statDef.key] ?? 0;
        const penance = getActionPenance(selected.burdens, statDef.key);
        const value = effectiveActionDice(base, penance);
        const boons = actionDelta > 0 ? actionDelta : 0;
        const curses = actionDelta < 0 ? -actionDelta : 0;
        rollingRef.current = statDef.key;
        setStatRolling(true);
        try {
            await rollStatInChat(campaignId, profile, selected, statDef, value, { boons, curses });
        } catch (err) {
            console.error(err);
            dispatch(showSnackbar({ message: "No se pudo publicar la tirada", severity: "error" }));
        } finally {
            rollingRef.current = null;
            setStatRolling(false);
        }
    };

    const actionModsPreview = useMemo(() => {
        if (actionDelta === 0) return { summary: "base", isLowest: false };
        if (actionDelta > 0) return { summary: `+${actionDelta} boon`, isLowest: false };
        return { summary: `${actionDelta} curse`, isLowest: true };
    }, [actionDelta]);

    if (!profile || roster.length === 0) return null;

    const canToggleAbilities = typeof onToggleAbilityBar === "function";
    const hasStats = (statDefs || []).length > 0;

    return (
        <>
        <Box
            data-no-token-drop
            sx={{
                position: "fixed",
                bottom: VTT_HUD.inset,
                left: VTT_HUD.inset,
                zIndex: 1200,
                pointerEvents: "auto",
                display: "flex",
                alignItems: "flex-end",
                gap: 0.55,
                maxWidth: "calc(100vw - 32px)",
            }}
        >
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, minWidth: 0 }}>
                {isMyTurn && (
                    <Box
                        sx={{
                            alignSelf: "flex-start",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 0.75,
                            px: 1.15,
                            py: 0.45,
                            borderRadius: 1,
                            border: `1px solid ${UI_COLORS.anomaly}`,
                            bgcolor: "rgba(0, 18, 22, 0.88)",
                            boxShadow: `0 0 18px ${UI_COLORS.anomaly}44, inset 0 0 12px ${UI_COLORS.anomaly}18`,
                            animation: "initTurnPulse 1.6s ease-in-out infinite",
                            "@keyframes initTurnPulse": {
                                "0%, 100%": { boxShadow: `0 0 14px ${UI_COLORS.anomaly}33, inset 0 0 10px ${UI_COLORS.anomaly}14` },
                                "50%": { boxShadow: `0 0 22px ${UI_COLORS.anomaly}66, inset 0 0 14px ${UI_COLORS.anomaly}28` },
                            },
                            "@media (prefers-reduced-motion: reduce)": {
                                animation: "none",
                            },
                        }}
                    >
                        <Box
                            sx={{
                                width: 7,
                                height: 7,
                                borderRadius: "50%",
                                bgcolor: UI_COLORS.anomaly,
                                boxShadow: `0 0 8px ${UI_COLORS.anomaly}`,
                            }}
                        />
                        <CyberTitle
                            sx={{
                                fontSize: "0.62rem",
                                letterSpacing: "0.22em",
                                color: UI_COLORS.anomaly,
                                lineHeight: 1,
                                textShadow: `0 0 10px ${UI_COLORS.anomaly}99`,
                            }}
                        >
                            TU TURNO
                        </CyberTitle>
                    </Box>
                )}
                {(stripChars.length > 0 || !selected) && (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "flex-end",
                        gap: 0.65,
                        px: 0.25,
                        maxWidth: 340,
                        flexWrap: "wrap",
                    }}
                >
                    {stripChars.map((c) => {
                        const hp = resolvePinHp(c);
                        const isPinned = pinnedIds.includes(c.id);
                        return (
                            <Box
                                key={c.id}
                                sx={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    width: 40,
                                    flexShrink: 0,
                                }}
                            >
                                <CharAvatarButton
                                    char={c}
                                    active={false}
                                    pinned={isPinned}
                                    size={34}
                                    title={`${c.name || "—"} · clic activar · menú contextual`}
                                    onClick={() => handleSelect(c.id)}
                                    onContextMenu={(e) => openCharMenu(e, c)}
                                />
                                <MiniHpBar pct={hp.pct} />
                            </Box>
                        );
                    })}
                    {!selected && (
                        <ActivateCharacterButton
                            roster={roster}
                            selectedId={selectedId}
                            onSelect={handleSelect}
                            pinnedIds={pinnedIds}
                            onTogglePin={togglePin}
                            anchorEl={activateAnchor}
                            onOpen={(el) => setActivateAnchor(el)}
                            onClose={() => setActivateAnchor(null)}
                        />
                    )}
                </Box>
                )}

                {/* Hidden popover host when active — opened via context menu "Cambiar personaje" */}
                {selected && (
                    <ActivateCharacterButton
                        roster={roster}
                        selectedId={selectedId}
                        onSelect={handleSelect}
                        pinnedIds={pinnedIds}
                        onTogglePin={togglePin}
                        hideTrigger
                        anchorEl={activateAnchor}
                        onOpen={(el) => setActivateAnchor(el)}
                        onClose={() => setActivateAnchor(null)}
                    />
                )}

                {selected && (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "stretch",
                        gap: 0.55,
                        minWidth: 0,
                    }}
                >
                <Box
                    ref={surfaceRef}
                    onContextMenu={(e) => openCharMenu(e, selected)}
                    sx={{
                        position: "relative",
                        minWidth: 280,
                        maxWidth: 340,
                        minHeight: COMBAT_DOCK_MIN_HEIGHT,
                        p: "12px 14px",
                        borderRadius: `${VTT_HUD.borderRadius}px`,
                        border: `1px solid ${isBroken ? VIT_RED : vitCur <= 1 ? UI_COLORS.accentStrong : VTT_HUD.glassBorder}`,
                        bgcolor: VTT_HUD.glassBg,
                        backdropFilter: "blur(14px)",
                        boxShadow: isBroken
                            ? `0 0 22px ${VIT_RED}44`
                            : vitCur <= 2
                                ? `0 0 20px ${UI_COLORS.accent}33`
                                : "0 0 20px rgba(255,102,255,0.06)",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        gap: 1,
                        flexShrink: 0,
                        overflow: "hidden",
                        boxSizing: "border-box",
                    }}
                >
                    <SurfaceCrackOverlay vitCur={vitCur} vitMax={vitMax} />
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, position: "relative", zIndex: 1 }}>
                        <VitRingAvatar
                            char={selected}
                            size={50}
                            vitCur={vitCur}
                            vitMax={vitMax}
                            onVitChange={handleVitChange}
                            onPortraitClick={toggleActivatePicker}
                            portraitActive={Boolean(activateAnchor)}
                            dead={isDead}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <CyberTitle
                                sx={{
                                    fontSize: "0.72rem",
                                    letterSpacing: "0.08em",
                                    color: isBroken ? VIT_RED : "#fff",
                                    lineHeight: 1.2,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {selected.name || "—"}
                            </CyberTitle>
                            {(isBroken || isExhausted) && (
                                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.45, mt: 0.25 }}>
                                    {isBroken && (
                                        <CyberText
                                            sx={{
                                                fontFamily: "Orbitron, sans-serif",
                                                fontSize: "0.42rem",
                                                letterSpacing: "0.12em",
                                                color: VIT_RED,
                                                border: `1px solid ${VIT_RED}88`,
                                                bgcolor: `${VIT_RED}18`,
                                                px: 0.55,
                                                py: "1px",
                                                borderRadius: 0.5,
                                            }}
                                        >
                                            BREAK
                                        </CyberText>
                                    )}
                                    {isExhausted && (
                                        <CyberText
                                            sx={{
                                                fontFamily: "Orbitron, sans-serif",
                                                fontSize: "0.42rem",
                                                letterSpacing: "0.12em",
                                                color: "#f97316",
                                                border: "1px solid rgba(249,115,22,0.7)",
                                                bgcolor: "rgba(249,115,22,0.14)",
                                                px: 0.55,
                                                py: "1px",
                                                borderRadius: 0.5,
                                            }}
                                        >
                                            EXHAUSTED
                                        </CyberText>
                                    )}
                                </Box>
                            )}
                        </Box>
                        <ActiveBurdenIcons burdens={selected.burdens} character={selected} />
                    </Box>

                    <Box sx={{ position: "relative", zIndex: 1 }}>
                    <TrackRow label="HP" valueLabel={`${hpCur}/${sessionHpMax}`}>
                        <Box
                            sx={{
                                flex: 1,
                                height: 10,
                                borderRadius: 0.5,
                                bgcolor: "rgba(255,255,255,0.06)",
                                overflow: "hidden",
                                cursor: "pointer",
                                border: `1px solid ${UI_COLORS.border}`,
                            }}
                            onClick={handleHpBarClick}
                        >
                            <Box
                                sx={{
                                    height: "100%",
                                    width: `${hpPct}%`,
                                    bgcolor: hpPct <= 25 ? "#ff3355" : hpPct <= 50 ? "#f97316" : UI_COLORS.anomaly,
                                    boxShadow: `0 0 8px ${UI_COLORS.anomaly}33`,
                                    transition: "width 0.15s, background-color 0.15s",
                                }}
                            />
                        </Box>
                    </TrackRow>

                    <TrackRow label="EFFORT" valueLabel={`${effortCur}/${effortMax}`}>
                        <EffortBar
                            current={effortCur}
                            max={effortMax}
                            onSet={handleEffortSet}
                        />
                    </TrackRow>
                    </Box>
                </Box>

                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        alignItems: "center",
                        alignSelf: "stretch",
                        flexShrink: 0,
                        py: "2px",
                    }}
                >
                    <CyberTooltip title="Abrir dossier" placement="right">
                        <IconButton
                            size="small"
                            onClick={() => dispatch(openCharacterSheet({ tab: "IDENTIDAD" }))}
                            aria-pressed={sheetOpen}
                            aria-label="Abrir dossier"
                            sx={glassBtnSx(sheetOpen)}
                        >
                            <BadgeIcon sx={{ fontSize: "1.1rem" }} />
                        </IconButton>
                    </CyberTooltip>
                    {hasStats && (
                        <CyberTooltip
                            title={statsOpen ? "Ocultar actions" : "Actions (tiradas)"}
                            placement="right"
                        >
                            <IconButton
                                size="small"
                                onClick={() => setStatsOpen((v) => !v)}
                                aria-pressed={statsOpen}
                                aria-label="Panel de actions"
                                sx={glassBtnSx(statsOpen)}
                            >
                                <QueryStatsIcon sx={{ fontSize: "1.15rem" }} />
                            </IconButton>
                        </CyberTooltip>
                    )}
                    {canToggleAbilities && (
                        <CyberTooltip
                            title={abilityBarOpen ? "Cerrar macros" : "Macros / habilidades"}
                            placement="right"
                        >
                            <IconButton
                                size="small"
                                onClick={onToggleAbilityBar}
                                aria-pressed={abilityBarOpen}
                                aria-label="Barra de macros y habilidades"
                                sx={glassBtnSx(abilityBarOpen)}
                            >
                                <BoltIcon sx={{ fontSize: "1.15rem" }} />
                            </IconButton>
                        </CyberTooltip>
                    )}
                </Box>
                </Box>
                )}

                <CharHudContextMenu
                    anchorEl={charMenu?.anchorEl}
                    char={charMenu?.char}
                    isActive={charMenu?.char?.id === selectedId}
                    isPinned={charMenu?.char ? pinnedIds.includes(charMenu.char.id) : false}
                    isBroken={charMenu?.char?.id === selectedId ? isBroken : false}
                    onClose={closeCharMenu}
                    onActivate={handleSelect}
                    onDeactivate={handleDeactivate}
                    onTogglePin={togglePin}
                    onChangeCharacter={() => openActivatePicker(surfaceRef.current)}
                    onCureBreak={handleCureBreak}
                />
            </Box>
        </Box>

        {selected && (abilityBarOpen || statsOpen) && (
            <AbilityHotbar
                open={abilityBarOpen}
                character={selected}
                actionsToolbar={
                    statsOpen && hasStats ? (
                        <ActionModsToolbar
                            delta={actionDelta}
                            onDelta={handleActionDelta}
                            poolPreview={actionModsPreview}
                        />
                    ) : null
                }
                actionsSlot={
                    statsOpen && hasStats ? (
                            <Box
                                sx={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(10, minmax(0, 1fr))",
                                    gap: 0.55,
                                    width: "100%",
                                }}
                            >
                            {(statDefs || []).map((def) => (
                                <ActionTile
                                    key={def.key}
                                    statDef={def}
                                    value={selected.stats?.[def.key] ?? 0}
                                    penance={getActionPenance(selected.burdens, def.key)}
                                    busy={statRolling && rollingRef.current === def.key}
                                    onRoll={handleActionRoll}
                                />
                            ))}
                        </Box>
                    ) : null
                }
            />
        )}
        </>
    );
}
