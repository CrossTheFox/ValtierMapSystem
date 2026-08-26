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
import { VTT_GRID, VTT_HUD, vttGapCss, vttSpanWidthCss } from "../../constants/vttHudTokens";
import { useStatSystem } from "../../hooks/useStatSystem";
import { usePinnedCharacters } from "../../hooks/usePinnedCharacters";
import { useAssetUrl } from "../../hooks/useAssetUrl";
import { useResolvedCombatStats } from "../../hooks/useResolvedCombatStats";
import { setActiveCharacterId, persistActiveCharacter } from "../../store/playerSlice";
import { showSnackbar, openCharacterSheet } from "../../store/uiSlice";
import { usePersistedCharacterVitals, mergeHudCharacter } from "../../hooks/usePersistedCharacterVitals";
import { canControlToken, isDmRole } from "../../utils/tokenControl";
import {
    DEFAULT_VIT,
    buildCampaignCharacterMap,
} from "../../utils/characterCombat";
import {
    applyHpWithVitCascadeOnCharacter,
    applyVitChangeOnCharacter,
    normalizeCharacterVitals,
    normalizeTurn,
    resolveCharacterHpMax,
    resolveCharacterVit,
    resolveHpBrokenAfterChange,
} from "../../utils/characterVitals";
import { computeBarPercents, vigorGainBlocked } from "../../utils/seamVitals";
import {
    effortBladeCommit,
    hpFromBarRatio,
    nextPrincipalAfterEject,
    shouldShowPrincipalPlus,
    toggleTurn,
} from "../../utils/hudF4";
import { activeCharacterConditions } from "../../constants/characterConditions";
import { normalizeTokenCrop, tokenCropCss } from "../../utils/tokenImageFit";
import { rollStatInChat } from "../../../firebase/services/chatService";
import AbilityHotbar from "./AbilityHotbar";
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
const F4_AMBER = "#ffb020";
const F4_MACROS = "#e879f9";
const F4_CYAN = UI_COLORS.anomaly;
const F4_VIGOR = UI_COLORS.vigor;
const F4_PINK = UI_COLORS.accent;

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
    const ringPad = 12;
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
                    active={!dead}
                    size={size}
                    title={dead ? "BREAK · abrir dossier" : "Abrir dossier"}
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

function F4PlusIcon() {
    return (
        <Box
            component="svg"
            viewBox="0 0 24 24"
            sx={{ width: 13, height: 13, display: "block", pointerEvents: "none" }}
        >
            <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
        </Box>
    );
}

function F4EjectIcon() {
    return (
        <Box
            component="svg"
            viewBox="0 0 24 24"
            sx={{ width: 9, height: 9, display: "block", pointerEvents: "none" }}
        >
            <path
                fill="currentColor"
                d="M18.3 5.71 12 12.01 5.7 5.7 4.29 7.11 10.59 13.4 4.29 19.7 5.7 21.11 12 14.82l6.3 6.29 1.41-1.41-6.29-6.3 6.29-6.29z"
            />
        </Box>
    );
}

function F4BurdenIcon() {
    return (
        <Box
            component="svg"
            viewBox="0 0 24 24"
            sx={{ width: 15, height: 15, display: "block", pointerEvents: "none" }}
        >
            <rect x="10" y="2.5" width="4" height="3.5" rx="0.4" fill="currentColor" />
            <path d="M12 6 L12 8.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path
                d="M6.5 9.2 H17.5 L16.2 20.5 H7.8 Z"
                fill="currentColor"
                fillOpacity="0.55"
                stroke="currentColor"
                strokeWidth="1.4"
            />
            <path d="M12 10.2 L12 18.8" fill="none" stroke="#fff" strokeWidth="1.1" opacity="0.7" />
        </Box>
    );
}

function F4MoveGlyph() {
    return (
        <Box
            component="svg"
            viewBox="0 0 24 12"
            sx={{ width: 12, height: 7, justifySelf: "end" }}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
        >
            <path d="M2 6h14M13 2l7 4-7 4" />
        </Box>
    );
}

function f4VitFx(vitCur) {
    const v = Math.min(Math.max(Math.floor(Number(vitCur) || 0), 0), 4);
    const table = {
        4: { veins: 0.12, circuit: 0.08, pulse: 0, pulseB: 0, bleed: 0, bleedH: "0%" },
        3: { veins: 0.45, circuit: 0.25, pulse: 0.55, pulseB: 0, bleed: 0.35, bleedH: "8%" },
        2: { veins: 0.7, circuit: 0.45, pulse: 0.85, pulseB: 0.5, bleed: 0.55, bleedH: "16%" },
        1: { veins: 0.9, circuit: 0.7, pulse: 1, pulseB: 0.85, bleed: 0.75, bleedH: "28%" },
        0: { veins: 1, circuit: 0.9, pulse: 1, pulseB: 0.9, bleed: 1, bleedH: "45%" },
    };
    return { v, ...table[v] };
}

function F4FxLayer({ vitCur }) {
    const fx = f4VitFx(vitCur);
    const dead = fx.v === 0;
    return (
        <Box
            aria-hidden
            className="fx-layer"
            sx={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                zIndex: 4,
                overflow: "hidden",
                clipPath: "inherit",
            }}
        >
            <Box
                sx={{
                    position: "absolute",
                    inset: 0,
                    opacity: dead ? 1 : 0,
                    transition: "opacity 0.4s",
                    background: dead
                        ? "radial-gradient(ellipse at 30% 40%, rgba(40,8,12,0.5), transparent 55%), radial-gradient(ellipse at 80% 70%, rgba(20,20,24,0.6), transparent 50%), linear-gradient(135deg, rgba(18,18,22,0.55), rgba(8,8,10,0.35))"
                        : "none",
                }}
            />
            <Box
                sx={{
                    position: "absolute",
                    inset: 0,
                    opacity: fx.circuit,
                    transition: "opacity 0.35s",
                    background: dead
                        ? "repeating-linear-gradient(90deg, transparent 0 16px, rgba(255,42,74,0.14) 16px 17px), repeating-linear-gradient(0deg, transparent 0 12px, rgba(80,80,85,0.2) 12px 13px)"
                        : "repeating-linear-gradient(90deg, transparent 0 18px, rgba(255,42,74,0.07) 18px 19px), repeating-linear-gradient(0deg, transparent 0 14px, rgba(255,42,74,0.05) 14px 15px)",
                    maskImage: "linear-gradient(90deg, #000 0%, transparent 35%, transparent 70%, #000 100%)",
                    WebkitMaskImage: "linear-gradient(90deg, #000 0%, transparent 35%, transparent 70%, #000 100%)",
                    animation: dead ? "f4CircuitFlicker 0.8s steps(2) infinite" : "none",
                    "@keyframes f4CircuitFlicker": {
                        "0%, 100%": { opacity: 0.9 },
                        "50%": { opacity: 0.45 },
                    },
                    "@media (prefers-reduced-motion: reduce)": { animation: "none" },
                }}
            />
            <Box
                sx={{
                    position: "absolute",
                    inset: 0,
                    opacity: fx.veins,
                    transition: "opacity 0.35s",
                    background: dead
                        ? "linear-gradient(90deg, rgba(255,42,74,0.7) 0%, transparent 14%), linear-gradient(270deg, rgba(120,20,30,0.5) 0%, transparent 12%), linear-gradient(180deg, transparent 40%, rgba(255,42,74,0.35) 100%)"
                        : "linear-gradient(90deg, rgba(255,42,74,0.55) 0%, transparent 10%), linear-gradient(270deg, rgba(255,42,74,0.28) 0%, transparent 8%), linear-gradient(180deg, transparent 55%, rgba(255,42,74,0.22) 100%)",
                    boxShadow: "inset 0 0 28px rgba(255,42,74,0.12)",
                }}
            />
            <Box
                sx={{
                    position: "absolute",
                    inset: "auto 0 0 0",
                    height: fx.bleedH,
                    opacity: fx.bleed,
                    transition: "height 0.4s, opacity 0.35s",
                    background: "linear-gradient(0deg, rgba(255,42,74,0.45), transparent)",
                }}
            />
            <Box
                sx={{
                    position: "absolute",
                    left: fx.v <= 1 ? "1px" : 0,
                    top: "18%",
                    width: fx.v === 0 ? 5 : fx.v === 1 ? 4 : 3,
                    height: "42%",
                    background: dead
                        ? "linear-gradient(180deg, transparent, #ff2a4a, #8a1020, transparent)"
                        : `linear-gradient(180deg, transparent, ${VIT_RED}, transparent)`,
                    boxShadow: `0 0 ${dead ? 20 : 14}px ${VIT_RED_GLOW}`,
                    opacity: fx.pulse,
                    animation: fx.pulse
                        ? `f4PulseVein ${fx.v <= 1 ? (dead ? 0.55 : 0.9) : 1.4}s ease-in-out infinite`
                        : "none",
                    "@keyframes f4PulseVein": {
                        "0%, 100%": { opacity: 0.35 },
                        "50%": { opacity: 1 },
                    },
                    "@media (prefers-reduced-motion: reduce)": { animation: "none" },
                }}
            />
            <Box
                sx={{
                    position: "absolute",
                    right: 0,
                    bottom: "12%",
                    width: 3,
                    height: "28%",
                    background: `linear-gradient(180deg, transparent, ${VIT_RED}, transparent)`,
                    boxShadow: `0 0 14px ${VIT_RED_GLOW}`,
                    opacity: fx.pulseB,
                    animation: fx.pulseB ? "f4PulseVein 1.4s ease-in-out 0.45s infinite" : "none",
                    "@media (prefers-reduced-motion: reduce)": { animation: "none" },
                }}
            />
        </Box>
    );
}

function F4StackRow({
    char,
    isPrincipal,
    isActiveTurn,
    hpCur,
    hpMax,
    vitCur,
    vitMax,
    onSelect,
    onEject,
}) {
    const pct = hpMax > 0 ? Math.round((hpCur / hpMax) * 100) : 0;
    const fillTone = pct <= 33 ? "low" : pct <= 66 ? "mid" : "ok";
    const fillBg = fillTone === "low"
        ? "repeating-linear-gradient(-45deg, #ff4d6a 0 3px, #c01030 3px 6px)"
        : fillTone === "mid"
            ? "repeating-linear-gradient(-45deg, #ffb020 0 3px, #c87800 3px 6px)"
            : "repeating-linear-gradient(-45deg, #00f2ea 0 3px, #00c4bd 3px 6px)";
    return (
        <Box
            onClick={() => onSelect?.(char.id)}
            sx={{
                display: "grid",
                gridTemplateColumns: "36px minmax(0, 1fr) 52px",
                gap: "8px",
                alignItems: "center",
                width: "100%",
                p: "5px 8px 5px 6px",
                bgcolor: isPrincipal ? "rgba(0,24,28,0.7)" : "rgba(0,0,0,0.55)",
                border: `1px solid ${
                    isActiveTurn
                        ? "rgba(255,176,32,0.65)"
                        : isPrincipal
                            ? "rgba(0,242,234,0.55)"
                            : "rgba(255,255,255,0.1)"
                }`,
                boxShadow: isActiveTurn
                    ? "0 0 12px rgba(255,176,32,0.2)"
                    : isPrincipal
                        ? "0 0 10px rgba(0,242,234,0.15)"
                        : "none",
                cursor: "pointer",
                position: "relative",
                overflow: "visible",
                "&::after": {
                    content: '""',
                    position: "absolute",
                    top: 0,
                    right: 0,
                    width: 8,
                    height: 8,
                    background: "linear-gradient(135deg, transparent 48%, rgba(0,0,0,0.9) 50%)",
                    pointerEvents: "none",
                },
                "&:hover": {
                    borderColor: "rgba(0,242,234,0.4)",
                    bgcolor: "rgba(0,20,24,0.65)",
                },
            }}
        >
            <Box
                component="button"
                type="button"
                title="Quitar de la lista"
                aria-label={`Quitar ${char.name || ""}`}
                onClick={(e) => {
                    e.stopPropagation();
                    onEject?.(char.id);
                }}
                sx={{
                    position: "absolute",
                    top: "-7px",
                    left: "-7px",
                    zIndex: 5,
                    width: 16,
                    height: 16,
                    p: 0,
                    border: "1px solid rgba(255,42,74,0.65)",
                    bgcolor: "rgba(12,4,8,0.96)",
                    color: "rgba(255,90,110,0.95)",
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                    borderRadius: "1px",
                    boxShadow: "0 0 0 1px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.45), 0 0 8px rgba(255,42,74,0.25)",
                    "&:hover": {
                        borderColor: "#fff",
                        color: "#fff",
                        bgcolor: "rgba(255,42,74,0.55)",
                        transform: "scale(1.08)",
                    },
                }}
            >
                <F4EjectIcon />
            </Box>
            {isPrincipal && (
                <Box
                    sx={{
                        position: "absolute",
                        left: 14,
                        top: "-7px",
                        zIndex: 2,
                        pointerEvents: "none",
                        fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.34rem",
                        letterSpacing: "0.1em",
                        color: F4_CYAN,
                        bgcolor: "rgba(0,0,0,0.9)",
                        px: "5px",
                        py: "1px",
                        border: "1px solid rgba(0,242,234,0.45)",
                    }}
                >
                    PRINCIPAL
                </Box>
            )}
            {isActiveTurn && (
                <Box
                    sx={{
                        position: "absolute",
                        right: 6,
                        top: "-7px",
                        zIndex: 2,
                        pointerEvents: "none",
                        fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.34rem",
                        letterSpacing: "0.1em",
                        color: F4_AMBER,
                        bgcolor: "rgba(0,0,0,0.9)",
                        px: "5px",
                        py: "1px",
                        border: "1px solid rgba(255,176,32,0.5)",
                    }}
                >
                    ACTIVE
                </Box>
            )}
            <CharAvatarButton char={char} active={isPrincipal} size={32} title={char.name || "—"} />
            <Box sx={{ minWidth: 0 }}>
                <Box
                    sx={{
                        fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.48rem",
                        letterSpacing: "0.1em",
                        mb: "3px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        color: UI_COLORS.textPrimary,
                    }}
                >
                    {(char.name || "—").toUpperCase()}
                </Box>
                <Box
                    sx={{
                        position: "relative",
                        height: 7,
                        bgcolor: "#041016",
                        boxShadow: "inset 0 0 0 1px rgba(0,242,234,0.35)",
                        overflow: "hidden",
                    }}
                >
                    <Box
                        sx={{
                            position: "absolute",
                            inset: "0 auto 0 0",
                            width: `${pct}%`,
                            background: fillBg,
                            boxShadow: fillTone === "ok" ? `0 0 6px ${F4_CYAN}80` : "none",
                        }}
                    />
                </Box>
            </Box>
            <Box
                sx={{
                    fontFamily: '"Fira Code", monospace',
                    fontSize: "0.5rem",
                    color: UI_COLORS.textSecondary,
                    textAlign: "right",
                    lineHeight: 1.2,
                }}
            >
                <Box component="span" sx={{ color: F4_CYAN, display: "block" }}>
                    {hpCur}/{hpMax}
                </Box>
                <Box component="span" sx={{ color: "rgba(255,42,74,0.85)", fontSize: "0.42rem" }}>
                    VIT {vitCur}/{vitMax}
                </Box>
            </Box>
        </Box>
    );
}

function F4BurdenRail({ burdens, character }) {
    const slots = normalizeBurdens(burdens);
    const active = listActiveBurdens(burdens);
    return (
        <Box
            role="group"
            aria-label="Burdens"
            sx={{
                position: "absolute",
                left: "-34px",
                top: "50%",
                transform: "translateY(-50%)",
                display: "flex",
                flexDirection: "column",
                gap: "5px",
                zIndex: 8,
                p: "7px 5px",
                bgcolor: "rgba(8,4,10,0.94)",
                border: "1px solid rgba(255,42,74,0.4)",
                clipPath: "polygon(0 0, 100% 5px, 100% calc(100% - 5px), 0 100%)",
                boxShadow: "-6px 0 18px rgba(255,42,74,0.15)",
            }}
        >
            {slots.map((b, i) => {
                const on = Boolean(b);
                const effectLine = b
                    ? formatBurdenEffectSummary(b.effect, {
                        targetLabel: burdenEffectTargetLabel(b.effect, character),
                    })
                    : "";
                const note = (b?.consequence || b?.text || "").trim();
                return (
                    <Box
                        key={b?.id || `empty-${i}`}
                        component="button"
                        type="button"
                        aria-label={on ? (b.title || `Burden ${i + 1}`) : "Slot vacío"}
                        title={on ? undefined : "Slot vacío"}
                        sx={{
                            position: "relative",
                            width: 24,
                            height: 24,
                            p: 0,
                            border: `1px solid ${on ? VIT_RED : "rgba(255,42,74,0.28)"}`,
                            bgcolor: on ? "rgba(255,42,74,0.18)" : "rgba(0,0,0,0.45)",
                            color: VIT_RED,
                            cursor: "default",
                            display: "grid",
                            placeItems: "center",
                            opacity: on ? 1 : 0.32,
                            boxShadow: on ? "0 0 10px rgba(255,42,74,0.35)" : "none",
                            "&:hover .f4-burden-tip": on ? { opacity: 1 } : {},
                        }}
                    >
                        <F4BurdenIcon />
                        {on && (
                            <Box
                                className="f4-burden-tip"
                                sx={{
                                    position: "absolute",
                                    left: "calc(100% + 10px)",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    width: 240,
                                    p: "10px 12px",
                                    bgcolor: "rgba(8,6,12,0.97)",
                                    border: "1px solid rgba(255,42,74,0.45)",
                                    boxShadow: "0 12px 28px rgba(0,0,0,0.55), 0 0 16px rgba(255,42,74,0.15)",
                                    clipPath: "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
                                    opacity: 0,
                                    pointerEvents: "none",
                                    transition: "opacity 0.12s",
                                    zIndex: 20,
                                    textAlign: "left",
                                }}
                            >
                                <Box
                                    sx={{
                                        fontFamily: "Orbitron, sans-serif",
                                        fontSize: "0.5rem",
                                        letterSpacing: "0.1em",
                                        color: VIT_RED,
                                        textTransform: "uppercase",
                                        mb: "6px",
                                    }}
                                >
                                    {active.length > 1 ? `Burdens · ${active.length}` : `Burden ${i + 1}`}
                                </Box>
                                <Box
                                    sx={{
                                        fontFamily: "Orbitron, sans-serif",
                                        fontSize: "0.62rem",
                                        letterSpacing: "0.06em",
                                        color: "#fff",
                                        textTransform: "uppercase",
                                        mb: "2px",
                                    }}
                                >
                                    {(b.title || "").trim() || `Burden ${i + 1}`}
                                    <Box
                                        component="span"
                                        sx={{
                                            fontFamily: '"Fira Code", monospace',
                                            fontSize: "0.5rem",
                                            color: VIT_RED,
                                            ml: "6px",
                                        }}
                                    >
                                        {b.clockFilled}/{b.clockSize}
                                    </Box>
                                </Box>
                                {effectLine && (
                                    <Box
                                        sx={{
                                            fontFamily: '"Fira Code", monospace',
                                            fontSize: "0.56rem",
                                            color: VIT_RED,
                                            my: "4px",
                                        }}
                                    >
                                        {effectLine}
                                    </Box>
                                )}
                                {note && (
                                    <Box sx={{ fontSize: "0.7rem", color: UI_COLORS.textSecondary, lineHeight: 1.35 }}>
                                        {note}
                                    </Box>
                                )}
                            </Box>
                        )}
                    </Box>
                );
            })}
        </Box>
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
        return mergeHudCharacter(base, sheet, {
            burdens: mergeBurdensPreferFilled(sheet.burdens, base.burdens),
            macroBar: mergeMacroBarPreferFilled(sheet.macroBar, base.macroBar),
        });
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

    /** Session stack: principal first (column-reverse → nearest the HUD), then added/pinned. */
    const stripChars = useMemo(() => {
        const order = [];
        const seen = new Set();
        const push = (id) => {
            if (!id || seen.has(id)) return;
            const c = roster.find((x) => x.id === id);
            if (!c) return;
            seen.add(id);
            order.push(c);
        };
        if (selectedId) push(selectedId);
        activatedIds.forEach(push);
        pinnedIds.forEach(push);
        return order;
    }, [activatedIds, pinnedIds, roster, selectedId]);

    const showStack = stripChars.length > 1 || stripChars.some((c) => c.id !== selectedId);

    const assignedIds = useMemo(() => {
        if (Array.isArray(profile?.characterIds) && profile.characterIds.length) {
            return profile.characterIds.filter((id) => roster.some((c) => c.id === id));
        }
        return roster.map((c) => c.id);
    }, [profile?.characterIds, roster]);

    const assignedCount = isDM ? roster.length : assignedIds.length;
    const showPlus = shouldShowPrincipalPlus({ assignedCount, isDm: isDM });
    const activeTurnId = activeInitEntry?.id || null;

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
    const vitMax = selected ? combatStats.vit : DEFAULT_VIT;
    const sheetHpMax = selected ? combatStats.hpMax : 16;

    const effortMax = useMemo(() => {
        const effortBase = (resourceTracks || []).find((t) => t.key === "effort");
        return Math.max(1, Math.floor(Number(effortBase?.maxDefault) || 3));
    }, [resourceTracks]);

    const { vitals, persistVitals } = usePersistedCharacterVitals(selected, { effortMax });

    const vitCur = selected
        ? Math.min(Math.max(Math.floor(Number(selected.vit ?? vitMax) || 0), 0), vitMax)
        : 0;
    const hpCur = vitals?.hpCur ?? 0;
    const vigor = vitals?.vigor ?? 0;
    const { hpPct, vigPct } = computeBarPercents(sheetHpMax, hpCur, vigor);
    const effortCur = vitals?.effort?.current ?? 0;
    const turn = normalizeTurn(vitals?.turn);
    const shaBlocked = vigorGainBlocked(vitals?.conditions || selected?.conditions);
    const condChips = useMemo(() => {
        const all = activeCharacterConditions(selected?.conditions);
        const rank = (c) => (c.key === "shattered" ? 0 : c.group === "statuses" ? 1 : 2);
        return [...all].sort((a, b) => rank(a) - rank(b)).slice(0, 4);
    }, [selected?.conditions]);
    const isBroken = Boolean(selected && vitals?.hpBroken);
    const isExhausted = Boolean(selected && vitals?.effort?.exhausted);
    const isDead = Boolean(selected && vitCur <= 0);

    const resolvePinHp = (char) => {
        const hpMax = resolveCharacterHpMax(char);
        const normalized = normalizeCharacterVitals(char);
        const vmax = resolveCharacterVit(char);
        const vcur = Math.min(Math.max(Math.floor(Number(char?.vit ?? vmax) || 0), 0), vmax);
        const cur = Math.min(Math.max(normalized.hpCur, 0), hpMax || 1);
        return { cur, max: hpMax, vitCur: vcur, vitMax: vmax };
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

    const handleEject = (charId) => {
        const result = nextPrincipalAfterEject({
            ejectedId: charId,
            principalId: selectedId,
            assignedIds: isDM ? roster.map((c) => c.id) : assignedIds,
            stackIds: stripChars.map((c) => c.id),
        });
        setActivatedIds((prev) => prev.filter((id) => id !== charId));
        if (pinnedIds.includes(charId)) togglePin(charId);
        if (result.nextPrincipalId && result.nextPrincipalId !== selectedId) {
            handleSelect(result.nextPrincipalId);
        } else if (!result.nextPrincipalId && selectedId === charId) {
            handleDeactivate();
        }
    };

    const handleOpenDossier = () => {
        dispatch(openCharacterSheet({ tab: "IDENTIDAD" }));
    };

    const handleVitChange = (nextVit) => {
        if (!selected || !vitals) return;
        const prevHp = hpCur;
        const result = applyVitChangeOnCharacter(
            { ...selected, hpCur, vit: vitCur, hpBroken: vitals.hpBroken },
            nextVit,
            null,
            hpCur,
        );
        persistVitals({
            vit: result.vit,
            hpCur: result.hpCur,
            hpBroken: resolveHpBrokenAfterChange(vitals.hpBroken, prevHp, result.hpCur),
        });
    };

    const handleHpBarClick = (e) => {
        if (!selected || !vitals || sheetHpMax <= 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
        const nextHp = hpFromBarRatio(ratio, sheetHpMax);
        const prevHp = hpCur;
        const result = applyHpWithVitCascadeOnCharacter(
            { ...selected, hpCur, vit: vitCur, hpBroken: vitals.hpBroken },
            nextHp,
            null,
            hpCur,
        );
        persistVitals({
            vit: result.vit,
            hpCur: result.hpCur,
            hpBroken: resolveHpBrokenAfterChange(vitals.hpBroken, prevHp, result.hpCur),
        });
    };

    const handleCureBreak = () => {
        if (!selected) return;
        persistVitals({ hpBroken: false });
    };

    const handleEffortBlade = (index) => {
        persistVitals(effortBladeCommit(index, effortCur, effortMax));
    };

    const handleTurnToggle = (key) => {
        persistVitals({ turn: toggleTurn(turn, key) });
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
            data-vtt-span={VTT_GRID.combatSpan}
            sx={{
                position: "fixed",
                bottom: VTT_HUD.inset,
                left: VTT_HUD.inset,
                zIndex: 1200,
                pointerEvents: "auto",
                display: "flex",
                alignItems: "flex-end",
                width: vttSpanWidthCss(VTT_GRID.combatSpan),
                boxSizing: "border-box",
                pl: "34px",
                mr: vttGapCss(),
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
                {(showStack || !selected) && (
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column-reverse",
                        gap: "8px",
                        width: "100%",
                        maxWidth: "100%",
                        mb: selected ? "10px" : 0,
                        borderLeft: `2px solid rgba(0,242,234,0.22)`,
                        position: "relative",
                        "&::before": showStack ? {
                            content: '"SESSION · ADDED"',
                            position: "absolute",
                            left: 10,
                            top: "-16px",
                            fontFamily: "Orbitron, sans-serif",
                            fontSize: "0.38rem",
                            letterSpacing: "0.14em",
                            color: "rgba(0,242,234,0.5)",
                        } : undefined,
                    }}
                >
                    {showStack && stripChars.map((c) => {
                        const hp = resolvePinHp(c);
                        return (
                            <F4StackRow
                                key={c.id}
                                char={c}
                                isPrincipal={c.id === selectedId}
                                isActiveTurn={c.id === activeTurnId}
                                hpCur={hp.cur}
                                hpMax={hp.max}
                                vitCur={hp.vitCur}
                                vitMax={hp.vitMax}
                                onSelect={handleSelect}
                                onEject={handleEject}
                            />
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
                    className="hud-wrap"
                    sx={{ position: "relative", width: "100%", maxWidth: "100%" }}
                >
                    <F4BurdenRail burdens={selected.burdens} character={selected} />
                    <Box
                        ref={surfaceRef}
                        data-vit={String(vitCur)}
                        onContextMenu={(e) => openCharMenu(e, selected)}
                        sx={{
                            position: "relative",
                            display: "grid",
                            gridTemplateColumns: "auto minmax(0, 1fr) 26px 28px 32px",
                            columnGap: 0,
                            alignItems: "center",
                            width: "100%",
                            p: "12px 12px 12px 16px",
                            minHeight: 92,
                            overflow: "visible",
                            zIndex: 2,
                            clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))",
                            border: `1px solid ${
                                vitCur <= 0
                                    ? "rgba(255,42,74,0.85)"
                                    : vitCur <= 1
                                        ? "rgba(255,42,74,0.7)"
                                        : "rgba(255,42,74,0.34)"
                            }`,
                            bgcolor: vitCur <= 0
                                ? undefined
                                : "rgba(0,0,0,0.78)",
                            background: vitCur <= 0
                                ? "radial-gradient(ellipse at 15% 50%, rgba(80,10,18,0.35), transparent 50%), linear-gradient(145deg, #0c0c0e 0%, #161618 45%, #0a0a0c 100%)"
                                : "radial-gradient(ellipse at 18% 50%, rgba(255,42,74,0.08), transparent 52%), rgba(0,0,0,0.78)",
                            boxShadow: vitCur <= 0
                                ? "0 0 36px rgba(255,42,74,0.35), inset 0 0 50px rgba(0,0,0,0.65), inset 0 -20px 40px rgba(255,42,74,0.12)"
                                : vitCur === 1
                                    ? "0 0 28px rgba(255,42,74,0.28), inset 0 0 36px rgba(255,42,74,0.12)"
                                    : vitCur === 2
                                        ? "0 12px 32px rgba(0,0,0,0.45), 0 0 18px rgba(255,42,74,0.12), inset 0 0 28px rgba(255,42,74,0.06)"
                                        : "0 12px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)",
                            filter: vitCur <= 0 ? "saturate(0.55) contrast(1.08)" : "none",
                            transition: "border-color 0.35s, box-shadow 0.35s, background 0.35s, filter 0.35s",
                            "&::before": {
                                content: '""',
                                position: "absolute",
                                top: 0,
                                right: 0,
                                width: 14,
                                height: 14,
                                background: "linear-gradient(135deg, transparent 48%, rgba(255,42,74,0.4) 50%)",
                                pointerEvents: "none",
                                zIndex: 5,
                            },
                        }}
                    >
                        <Box
                            sx={{
                                position: "absolute",
                                left: 14,
                                top: "-11px",
                                fontFamily: "Orbitron, sans-serif",
                                fontSize: "0.36rem",
                                letterSpacing: "0.14em",
                                color: vitCur <= 0 ? "#ff4d6a" : F4_CYAN,
                                bgcolor: "rgba(0,0,0,0.92)",
                                px: "7px",
                                py: "2px",
                                border: `1px solid ${vitCur <= 0 ? "rgba(255,42,74,0.5)" : "rgba(0,242,234,0.4)"}`,
                                zIndex: 6,
                            }}
                        >
                            PRINCIPAL
                            {activeTurnId && activeTurnId !== selectedId && (
                                <>
                                    <Box component="span" sx={{ color: "rgba(255,255,255,0.25)", mx: "4px" }}>·</Box>
                                    <Box component="span" sx={{ color: F4_AMBER }}>
                                        ACTIVE: {(roster.find((c) => c.id === activeTurnId)?.name || "—").toUpperCase()}
                                    </Box>
                                </>
                            )}
                        </Box>

                        <F4FxLayer vitCur={vitCur} />
                        {isDead && (
                            <Box
                                sx={{
                                    position: "absolute",
                                    right: 44,
                                    top: "50%",
                                    transform: "translateY(-50%) rotate(-12deg)",
                                    fontFamily: "Orbitron, sans-serif",
                                    fontSize: "0.72rem",
                                    letterSpacing: "0.28em",
                                    color: "rgba(255,42,74,0.55)",
                                    border: "2px solid rgba(255,42,74,0.45)",
                                    px: "10px",
                                    py: "4px",
                                    pointerEvents: "none",
                                    textShadow: "0 0 12px rgba(255,42,74,0.4)",
                                    zIndex: 6,
                                }}
                            >
                                VIT · 0
                            </Box>
                        )}

                        <Box
                            sx={{
                                position: "relative",
                                width: 72,
                                height: 72,
                                flexShrink: 0,
                                zIndex: 3,
                                mx: "4px 12px 0 4px",
                                margin: "0 12px 0 4px",
                            }}
                        >
                            {showPlus && (
                                <CyberTooltip title="Elegir personaje PRINCIPAL" placement="top">
                                    <Box
                                        component="button"
                                        type="button"
                                        aria-label="Elegir principal"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleActivatePicker(e.currentTarget);
                                        }}
                                        sx={{
                                            position: "absolute",
                                            top: "-10px",
                                            left: "-14px",
                                            zIndex: 5,
                                            width: 26,
                                            height: 26,
                                            borderRadius: "50%",
                                            border: "1.5px solid rgba(0,242,234,0.55)",
                                            bgcolor: "rgba(6,18,20,0.96)",
                                            color: F4_CYAN,
                                            boxShadow: "0 0 0 2px rgba(0,0,0,0.55), 0 0 12px rgba(0,242,234,0.25)",
                                            cursor: "pointer",
                                            p: 0,
                                            display: "grid",
                                            placeItems: "center",
                                            "&:hover": {
                                                transform: "scale(1.06)",
                                                color: "#fff",
                                                borderColor: F4_CYAN,
                                            },
                                        }}
                                    >
                                        <F4PlusIcon />
                                    </Box>
                                </CyberTooltip>
                            )}
                            <VitRingAvatar
                                char={selected}
                                size={48}
                                vitCur={vitCur}
                                vitMax={vitMax}
                                onVitChange={handleVitChange}
                                onPortraitClick={handleOpenDossier}
                                portraitActive={sheetOpen}
                                dead={isDead}
                            />
                        </Box>

                        <Box
                            sx={{
                                minWidth: 0,
                                display: "flex",
                                flexDirection: "column",
                                gap: "5px",
                                zIndex: 2,
                                pr: "10px",
                            }}
                        >
                            <Box sx={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0, minHeight: 18 }}>
                                <Box
                                    sx={{
                                        fontFamily: "Orbitron, sans-serif",
                                        fontSize: "0.66rem",
                                        letterSpacing: "0.12em",
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        flex: 1,
                                        minWidth: 0,
                                        color: isDead ? "#c8c8c8" : isBroken ? VIT_RED : "#fff",
                                        textShadow: vitCur <= 1 ? "0 0 10px rgba(255,42,74,0.35)" : "none",
                                    }}
                                >
                                    {(selected.name || "—").toUpperCase()}
                                </Box>
                                <Box sx={{ display: "flex", gap: "3px", flexShrink: 0, flexWrap: "wrap" }}>
                                    {isBroken && (
                                        <Box sx={{
                                            fontFamily: '"Fira Code", monospace',
                                            fontSize: "0.48rem",
                                            letterSpacing: "0.04em",
                                            px: "5px",
                                            py: "2px",
                                            borderRadius: "2px",
                                            border: `1px solid ${VIT_RED}88`,
                                            color: VIT_RED,
                                            bgcolor: `${VIT_RED}18`,
                                            textTransform: "uppercase",
                                        }}
                                        >
                                            BREAK
                                        </Box>
                                    )}
                                    {isExhausted && (
                                        <Box sx={{
                                            fontFamily: '"Fira Code", monospace',
                                            fontSize: "0.48rem",
                                            letterSpacing: "0.04em",
                                            px: "5px",
                                            py: "2px",
                                            borderRadius: "2px",
                                            border: "1px solid rgba(249,115,22,0.7)",
                                            color: "#f97316",
                                            bgcolor: "rgba(249,115,22,0.14)",
                                            textTransform: "uppercase",
                                        }}
                                        >
                                            EXHAUSTED
                                        </Box>
                                    )}
                                    {condChips.map((c) => (
                                        <Box
                                            key={c.key}
                                            title={c.title}
                                            sx={{
                                                fontFamily: '"Fira Code", monospace',
                                                fontSize: "0.48rem",
                                                letterSpacing: "0.04em",
                                                px: "5px",
                                                py: "2px",
                                                borderRadius: "2px",
                                                border: `1px solid ${c.color}88`,
                                                color: c.color,
                                                bgcolor: `${c.color}1f`,
                                                textTransform: "uppercase",
                                            }}
                                        >
                                            {c.code}
                                        </Box>
                                    ))}
                                </Box>
                            </Box>

                            <Box
                                onClick={handleHpBarClick}
                                sx={{
                                    position: "relative",
                                    height: 11,
                                    bgcolor: isDead ? "#0a0a0c" : "#041016",
                                    boxShadow: isDead
                                        ? "inset 0 0 0 1px rgba(255,42,74,0.45)"
                                        : "inset 0 0 0 1px rgba(0,242,234,0.4)",
                                    overflow: "hidden",
                                    cursor: "pointer",
                                    "&:hover .f4-hp-hover": { opacity: 1, transform: "translateY(0)" },
                                    "&:hover .f4-hp-fill, &:hover .f4-vig-fill": {
                                        filter: "brightness(0.45) saturate(0.7)",
                                    },
                                }}
                            >
                                <Box
                                    className="f4-hp-fill"
                                    sx={{
                                        position: "absolute",
                                        inset: "0 auto 0 0",
                                        width: `${hpPct}%`,
                                        background: isDead
                                            ? "repeating-linear-gradient(-45deg, #5a5a5e 0 4px, #3a3a3e 4px 8px)"
                                            : "repeating-linear-gradient(-45deg, #00f2ea 0 4px, #00c4bd 4px 8px)",
                                        boxShadow: isDead ? "none" : `0 0 10px ${F4_CYAN}80`,
                                        zIndex: 1,
                                        transition: "width 0.2s, filter 0.15s",
                                        opacity: isDead ? 0.55 : 1,
                                    }}
                                />
                                {vigor > 0 && (
                                    <Box
                                        className="f4-vig-fill"
                                        sx={{
                                            position: "absolute",
                                            top: 0,
                                            bottom: 0,
                                            left: `${hpPct}%`,
                                            width: `${vigPct}%`,
                                            background: shaBlocked || isDead
                                                ? "linear-gradient(90deg, #4a1018, #8a1020)"
                                                : `linear-gradient(90deg, #8fd92a, ${F4_VIGOR})`,
                                            zIndex: 1,
                                            transition: "left 0.2s, width 0.2s",
                                            opacity: isDead ? 0.7 : 1,
                                        }}
                                    />
                                )}
                                <Box sx={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none" }}>
                                    {[25, 50, 75].map((tick) => (
                                        <Box
                                            key={tick}
                                            sx={{
                                                position: "absolute",
                                                top: "-1px",
                                                bottom: "-1px",
                                                left: `${tick}%`,
                                                width: "1px",
                                                background: isDead ? "rgba(255,42,74,0.4)" : "rgba(0,242,234,0.55)",
                                            }}
                                        />
                                    ))}
                                </Box>
                                <Box
                                    className="f4-hp-hover"
                                    sx={{
                                        position: "absolute",
                                        inset: 0,
                                        zIndex: 4,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "8px",
                                        fontFamily: '"Fira Code", monospace',
                                        fontSize: "0.62rem",
                                        fontWeight: 500,
                                        letterSpacing: "0.06em",
                                        color: "#fff",
                                        background: isDead
                                            ? "linear-gradient(90deg, rgba(8,8,10,0.95), rgba(30,8,12,0.92))"
                                            : "linear-gradient(90deg, rgba(0,10,14,0.92), rgba(0,30,36,0.88))",
                                        textShadow: "0 0 8px rgba(0,242,234,0.9), 0 1px 2px #000",
                                        opacity: 0,
                                        transform: "translateY(2px)",
                                        transition: "opacity 0.14s, transform 0.14s",
                                        pointerEvents: "none",
                                        border: `1px solid ${isDead ? "rgba(255,42,74,0.55)" : "rgba(0,242,234,0.55)"}`,
                                    }}
                                >
                                    <span>{hpCur}/{sheetHpMax}</span>
                                    <Box component="span" sx={{ color: "rgba(0,242,234,0.5)" }}>·</Box>
                                    <Box
                                        component="span"
                                        sx={{
                                            color: shaBlocked ? UI_COLORS.danger : F4_VIGOR,
                                            textDecoration: shaBlocked ? "line-through" : "none",
                                            textDecorationThickness: shaBlocked ? "1.5px" : undefined,
                                            textShadow: shaBlocked
                                                ? `0 0 8px ${UI_COLORS.dangerGlow}`
                                                : "0 0 8px rgba(184,255,60,0.7), 0 1px 2px #000",
                                        }}
                                    >
                                        VIG {vigor}
                                    </Box>
                                </Box>
                            </Box>

                            <Box
                                sx={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr 1fr auto",
                                    gap: "5px",
                                    alignItems: "center",
                                    minHeight: 14,
                                }}
                            >
                                {["act1", "act2"].map((key) => {
                                    const on = Boolean(turn[key]);
                                    return (
                                        <Box
                                            key={key}
                                            component="button"
                                            type="button"
                                            aria-pressed={on}
                                            aria-label={key === "act1" ? "Action 1" : "Action 2"}
                                            onClick={() => handleTurnToggle(key)}
                                            sx={{
                                                height: 10,
                                                p: 0,
                                                border: `1px solid ${on ? "rgba(255,42,74,0.65)" : "rgba(255,42,74,0.28)"}`,
                                                background: on
                                                    ? "linear-gradient(90deg, #ff4d6a, #c01030)"
                                                    : "#2a0a12",
                                                boxShadow: on ? "0 0 8px rgba(255,42,74,0.4)" : "none",
                                                cursor: "pointer",
                                                position: "relative",
                                                overflow: "hidden",
                                                alignSelf: "center",
                                                opacity: on ? 1 : 0.35,
                                                filter: on ? "none" : "grayscale(0.5)",
                                                "&::before": on ? {
                                                    content: '""',
                                                    position: "absolute",
                                                    inset: 0,
                                                    background: "linear-gradient(90deg, transparent 30%, rgba(255,255,255,0.28), transparent 70%)",
                                                    animation: "f4ApScan 1.8s linear infinite",
                                                } : {},
                                                "@keyframes f4ApScan": {
                                                    from: { transform: "translateX(-100%)" },
                                                    to: { transform: "translateX(200%)" },
                                                },
                                                "@media (prefers-reduced-motion: reduce)": {
                                                    "&::before": { animation: "none" },
                                                },
                                            }}
                                        />
                                    );
                                })}
                                <Box
                                    component="button"
                                    type="button"
                                    aria-pressed={Boolean(turn.move)}
                                    aria-label="Move"
                                    onClick={() => handleTurnToggle("move")}
                                    sx={{
                                        width: 54,
                                        height: 14,
                                        border: `2px solid ${turn.move ? "rgba(0,242,234,0.9)" : "rgba(0,242,234,0.3)"}`,
                                        background: turn.move
                                            ? "linear-gradient(90deg, rgba(0,242,234,0.32), rgba(0,242,234,0.1) 55%, rgba(0,28,32,0.65)), repeating-linear-gradient(-45deg, transparent 0 2px, rgba(0,242,234,0.12) 2px 4px)"
                                            : "rgba(0,16,20,0.75)",
                                        color: turn.move ? F4_CYAN : "rgba(0,242,234,0.45)",
                                        display: "grid",
                                        gridTemplateColumns: "auto 1fr",
                                        alignItems: "center",
                                        gap: "3px",
                                        px: "5px 4px",
                                        py: 0,
                                        cursor: "pointer",
                                        clipPath: "polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)",
                                        boxShadow: turn.move
                                            ? "0 0 0 1px rgba(0,0,0,0.75), 0 0 10px rgba(0,242,234,0.3), inset 0 1px 0 rgba(255,255,255,0.22)"
                                            : "none",
                                        opacity: turn.move ? 1 : 0.4,
                                        filter: turn.move ? "none" : "grayscale(0.7)",
                                        "&:hover": { borderColor: "#fff", color: "#fff" },
                                    }}
                                >
                                    <Box
                                        component="span"
                                        sx={{
                                            fontFamily: "Orbitron, sans-serif",
                                            fontSize: "0.36rem",
                                            letterSpacing: "0.1em",
                                            lineHeight: 1,
                                            fontWeight: 700,
                                        }}
                                    >
                                        MOVE
                                    </Box>
                                    <F4MoveGlyph />
                                </Box>
                            </Box>
                        </Box>

                        <Box
                            role="group"
                            aria-label="Effort"
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "flex-end",
                                gap: "3px",
                                height: 54,
                                width: 24,
                                zIndex: 2,
                                justifySelf: "center",
                            }}
                        >
                            <Box
                                sx={{
                                    fontFamily: "Orbitron, sans-serif",
                                    fontSize: "0.32rem",
                                    letterSpacing: "0.1em",
                                    color: UI_COLORS.textSecondary,
                                    order: -1,
                                }}
                            >
                                EFF
                            </Box>
                            {Array.from({ length: effortMax }, (_, i) => {
                                const unit = effortMax - i;
                                const idx = unit - 1;
                                const lit = idx < effortCur;
                                return (
                                    <CyberTooltip
                                        key={unit}
                                        title={`Effort ${unit}${lit ? " (gastado)" : ""}`}
                                        placement="top"
                                    >
                                        <Box
                                            component="button"
                                            type="button"
                                            aria-label={`Effort ${unit}${lit ? " (gastado)" : ""}`}
                                            onClick={() => handleEffortBlade(idx)}
                                            sx={{
                                                width: 18,
                                                height: 14,
                                                p: 0,
                                                border: `1.5px solid ${
                                                    isDead
                                                        ? (lit ? "#888" : "rgba(120,120,128,0.45)")
                                                        : (lit ? F4_PINK : "rgba(255,102,255,0.55)")
                                                }`,
                                                background: lit
                                                    ? (isDead
                                                        ? "linear-gradient(180deg, #6a6a70, #3a3a40)"
                                                        : "linear-gradient(180deg, #ff99ff, #ff66ff 55%, #aa2288)")
                                                    : (isDead ? "rgba(20,20,24,0.8)" : "rgba(0,0,0,0.45)"),
                                                borderRadius: "1px",
                                                cursor: "pointer",
                                                boxShadow: lit && !isDead
                                                    ? `0 0 10px ${UI_COLORS.accentGlow}, inset 0 1px 0 rgba(255,255,255,0.25)`
                                                    : "none",
                                                filter: isDead && lit ? "grayscale(1)" : "none",
                                            }}
                                        />
                                    </CyberTooltip>
                                );
                            })}
                        </Box>

                        <Box
                            aria-hidden
                            title="Separador EFF ↔ tools"
                            sx={{
                                width: "1px",
                                justifySelf: "center",
                                alignSelf: "stretch",
                                my: "6px",
                                background: "repeating-linear-gradient(180deg, rgba(255,102,255,0.6) 0 3px, transparent 3px 6px)",
                                boxShadow: "0 0 6px rgba(255,102,255,0.3)",
                                zIndex: 3,
                            }}
                        />

                        <Box
                            role="toolbar"
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "space-between",
                                alignItems: "center",
                                alignSelf: "stretch",
                                gap: "4px",
                                zIndex: 3,
                                py: "2px",
                                justifySelf: "end",
                            }}
                        >
                            {hasStats && (
                                <CyberTooltip
                                    title={statsOpen ? "Ocultar actions" : "Actions"}
                                    placement="right"
                                >
                                    <IconButton
                                        size="small"
                                        onClick={() => setStatsOpen((v) => !v)}
                                        aria-pressed={statsOpen}
                                        aria-label="Panel de actions"
                                        sx={{
                                            width: 30,
                                            height: 30,
                                            borderRadius: "4px",
                                            border: `1px solid ${statsOpen ? F4_AMBER : "rgba(255,176,32,0.5)"}`,
                                            bgcolor: statsOpen ? "rgba(255,176,32,0.12)" : "rgba(8,6,14,0.92)",
                                            color: F4_AMBER,
                                            p: 0,
                                            "&:hover": { color: "#ffd280", filter: "drop-shadow(0 0 8px rgba(255,176,32,0.55))" },
                                        }}
                                    >
                                        <QueryStatsIcon sx={{ fontSize: "0.95rem" }} />
                                    </IconButton>
                                </CyberTooltip>
                            )}
                            {canToggleAbilities && (
                                <CyberTooltip
                                    title={abilityBarOpen ? "Cerrar macros" : "Macros"}
                                    placement="right"
                                >
                                    <IconButton
                                        size="small"
                                        onClick={onToggleAbilityBar}
                                        aria-pressed={abilityBarOpen}
                                        aria-label="Barra de macros y habilidades"
                                        sx={{
                                            width: 30,
                                            height: 30,
                                            borderRadius: "4px",
                                            border: `1px solid ${abilityBarOpen ? F4_MACROS : "rgba(232,121,249,0.5)"}`,
                                            bgcolor: abilityBarOpen ? "rgba(232,121,249,0.12)" : "rgba(8,6,14,0.92)",
                                            color: F4_MACROS,
                                            p: 0,
                                            "&:hover": { color: "#f0abfc", filter: "drop-shadow(0 0 8px rgba(232,121,249,0.5))" },
                                        }}
                                    >
                                        <BoltIcon sx={{ fontSize: "0.95rem" }} />
                                    </IconButton>
                                </CyberTooltip>
                            )}
                        </Box>
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
