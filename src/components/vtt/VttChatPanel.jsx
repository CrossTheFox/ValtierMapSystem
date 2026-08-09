import { useState, useEffect, useRef, useMemo, memo } from "react";
import {
    Box, Paper, TextField, IconButton, Stack, Chip, Avatar, Autocomplete,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import CloseIcon from "@mui/icons-material/Close";
import ChatIcon from "@mui/icons-material/Chat";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import { useDispatch, useSelector } from "react-redux";
import { CyberTitle, CyberText } from "../customs/CustomTexts";
import CyberTooltip from "../customs/CyberTooltip";
import { UI_COLORS } from "../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import GlossaryTextRenderer from "../shared/GlossaryTextRenderer";
import {
    sendChatMessage,
    clearCampaignChat,
    CHAT_MESSAGE_TYPES,
} from "../../../firebase/services/chatService";
import { useAssetUrl } from "../../hooks/useAssetUrl";
import { buildCampaignCharacterMap } from "../../utils/characterCombat";
import { setActiveCharacterId, persistActiveCharacter } from "../../store/playerSlice";
import { INLINE_ROLL_MARKER_RE } from "../../utils/abilityRollCommands";
import { isDmRole } from "../../utils/tokenControl";
import { showSnackbar } from "../../store/uiSlice";
import ClearChatDialog from "./ClearChatDialog";

const MSG_BODY_SX = {
    fontSize: "0.8rem",
    color: UI_COLORS.textPrimary,
    lineHeight: 1.45,
};

/** Format Firestore Timestamp / Date / ms → HH:mm */
function formatChatTime(createdAt) {
    if (!createdAt) return null;
    let d = null;
    if (typeof createdAt?.toDate === "function") d = createdAt.toDate();
    else if (createdAt instanceof Date) d = createdAt;
    else if (typeof createdAt === "number") d = new Date(createdAt);
    else if (typeof createdAt?.seconds === "number") d = new Date(createdAt.seconds * 1000);
    if (!d || Number.isNaN(d.getTime())) return null;
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
}

function ChatTime({ createdAt }) {
    const t = formatChatTime(createdAt);
    if (!t) return null;
    return (
        <Box
            component="span"
            sx={{
                fontFamily: "monospace",
                fontSize: "0.52rem",
                color: UI_COLORS.textSecondary,
                ml: 0.75,
                flexShrink: 0,
            }}
        >
            {t}
        </Box>
    );
}

const fieldSx = {
    "& .MuiOutlinedInput-root": {
        color: UI_COLORS.textPrimary,
        bgcolor: "rgba(0,0,0,0.35)",
        "& fieldset": { borderColor: UI_COLORS.border },
        "&:hover fieldset": { borderColor: `${UI_COLORS.anomaly}66` },
        "&.Mui-focused fieldset": { borderColor: UI_COLORS.anomaly },
    },
    "& input": {
        fontSize: "0.8rem",
        color: UI_COLORS.textPrimary,
        "&::placeholder": { color: UI_COLORS.textSecondary, opacity: 1 },
    },
};

/** Resuelve Storage / local / https desde la caché global (precargada al iniciar). */
function ChatAvatar({ path, name, accent, size = 26 }) {
    const src = useAssetUrl(path || null);

    return (
        <Avatar
            src={src || undefined}
            alt={name}
            imgProps={{
                decoding: "sync",
                loading: "eager",
            }}
            sx={{
                width: size,
                height: size,
                mt: size >= 26 ? 0.15 : 0,
                fontSize: size >= 26 ? "0.65rem" : "0.6rem",
                bgcolor: `${accent}33`,
                border: `1px solid ${accent}66`,
                color: accent,
            }}
        >
            {(name || "?").slice(0, 1).toUpperCase()}
        </Avatar>
    );
}

/** Stable empty fallback — a fresh `[]` default param would re-break memo(MessageList) every render. */
const EMPTY_GLOSSARY = [];
const EMPTY_MESSAGES = [];

const DICE_FAIL = "#ff3355";
const DICE_CRIT = "#ffcc33";

/** Newest rows rendered on open; older ones stay one click away. */
const RENDER_WINDOW = 30;
const RENDER_WINDOW_STEP = 40;

const FONT_TITLE = "'Orbitron', sans-serif";
const FONT_MONO = "'Fira Code', monospace";
const FONT_BODY = "'Fira Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";

/**
 * One static `sx` for every dice card (emotion serializes it once) with the
 * accent injected as CSS variables. Building per-card `sx` for ~12 MUI nodes
 * was costing ~6ms per card, i.e. ~300ms every time the dock opened.
 */
const DICE_CARD_SX = {
    mb: 0.9,
    borderRadius: "6px",
    border: "1px solid var(--dice-a66)",
    background:
        "linear-gradient(135deg, var(--dice-a14) 0%, rgba(7,7,14,0.92) 42%, rgba(0,0,0,0.55) 100%)",
    boxShadow: "0 0 18px var(--dice-a22), inset 0 0 0 1px rgba(255,255,255,0.04)",
    overflow: "hidden",
    "& .dc-head": {
        display: "flex",
        alignItems: "center",
        gap: "7px",
        px: 1,
        pt: 0.7,
        pb: 0.45,
        borderBottom: "1px solid var(--dice-a33)",
    },
    "& .dc-avatar": {
        width: 24,
        height: 24,
        flexShrink: 0,
        borderRadius: "50%",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        objectFit: "cover",
        fontFamily: FONT_BODY,
        fontSize: "0.6rem",
        bgcolor: "var(--dice-a33)",
        border: "1px solid var(--dice-a66)",
        color: "var(--dice-a)",
    },
    "& .dc-who": { flex: 1, minWidth: 0 },
    "& .dc-name": {
        fontFamily: FONT_BODY,
        fontSize: "0.72rem",
        fontWeight: 700,
        letterSpacing: "0.3px",
        lineHeight: 1.2,
        color: UI_COLORS.textPrimary,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
    "& .dc-formula": {
        fontFamily: FONT_BODY,
        fontSize: "0.52rem",
        lineHeight: 1.8,
        letterSpacing: "0.8px",
        color: UI_COLORS.textSecondary,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
    "& .dc-badge": {
        flexShrink: 0,
        height: 18,
        display: "inline-flex",
        alignItems: "center",
        px: 0.75,
        borderRadius: "9px",
        fontFamily: FONT_BODY,
        fontSize: "0.5rem",
        letterSpacing: "1.2px",
        fontWeight: 700,
        bgcolor: "var(--dice-a22)",
        color: "var(--dice-a)",
        border: "1px solid var(--dice-a66)",
    },
    "& .dc-body": {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        px: 1,
        py: 0.85,
    },
    "& .dc-left": { flex: 1, minWidth: 0 },
    "& .dc-faces": {
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "3px",
        mb: 0.35,
    },
    "& .dc-face": {
        minWidth: 22,
        height: 22,
        px: 0.55,
        borderRadius: "4px",
        bgcolor: "rgba(0,0,0,0.45)",
        fontFamily: FONT_MONO,
        fontSize: "0.68rem",
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: `1px solid ${UI_COLORS.textPrimary}55`,
        color: UI_COLORS.textPrimary,
    },
    "& .dc-face.fail": {
        border: `1px solid ${DICE_FAIL}55`,
        color: DICE_FAIL,
        boxShadow: `0 0 8px ${DICE_FAIL}44`,
    },
    "& .dc-face.crit": {
        border: `1px solid ${DICE_CRIT}55`,
        color: DICE_CRIT,
        boxShadow: `0 0 8px ${DICE_CRIT}44`,
    },
    "& .dc-mod": {
        fontFamily: FONT_BODY,
        fontSize: "0.65rem",
        color: UI_COLORS.textSecondary,
        ml: 0.25,
    },
    "& .dc-label": {
        fontFamily: FONT_BODY,
        fontSize: "0.55rem",
        letterSpacing: "1px",
        color: UI_COLORS.textSecondary,
    },
    "& .dc-total": {
        fontFamily: FONT_TITLE,
        textTransform: "uppercase",
        letterSpacing: "2px",
        fontSize: "1.35rem",
        lineHeight: 1,
        minWidth: 36,
        textAlign: "right",
        color: "var(--dice-a)",
        textShadow: "0 0 14px var(--dice-a66)",
    },
};

const diceVarsCache = new Map();

/** Accent → CSS custom properties consumed by {@link DICE_CARD_SX}. */
function diceVars(accent) {
    let vars = diceVarsCache.get(accent);
    if (vars) return vars;
    vars = {
        "--dice-a": accent,
        "--dice-a66": `${accent}66`,
        "--dice-a33": `${accent}33`,
        "--dice-a22": `${accent}22`,
        "--dice-a14": `${accent}14`,
    };
    diceVarsCache.set(accent, vars);
    return vars;
}

/** Plain-DOM avatar: styling comes from the parent card class, not emotion. */
function RawAvatar({ path, name, className = "dc-avatar" }) {
    const src = useAssetUrl(path || null);
    if (src) {
        return (
            <img
                className={className}
                src={src}
                alt={name}
                decoding="sync"
                loading="eager"
            />
        );
    }
    return <span className={className}>{(name || "?").slice(0, 1).toUpperCase()}</span>;
}

function faceMode(value, sides) {
    const s = Math.max(2, Math.floor(Number(sides) || 20));
    const r = Math.floor(Number(value) || 0);
    if (r === 1) return "fail";
    if (r === s) return "crit";
    return "normal";
}

function DiceChatCard({ msg, avatarByCharacterId }) {
    const dr = msg.diceResult || {};
    const rolls = Array.isArray(dr.rolls) ? dr.rolls : [];
    const sides = Math.max(2, Math.floor(Number(dr.sides) || 20));
    const total = dr.total;
    const mode = dr.mode; // highest | lowest | null
    const isAttack = dr.kind === "attack";
    const isAction = mode === "highest" || mode === "lowest";
    const formula = msg.diceFormula || dr.formula || "";
    const name = msg.characterName || msg.senderName || "???";
    const livePath = msg.characterId ? avatarByCharacterId?.get(msg.characterId) : null;
    const avatarPath = livePath || msg.characterAvatarUrl;

    const hot =
        rolls.length === 1
            ? faceMode(rolls[0], sides)
            : rolls.some((r) => faceMode(r, sides) === "crit")
                ? "crit"
                : rolls.some((r) => faceMode(r, sides) === "fail")
                    ? "fail"
                    : "normal";

    const accent =
        hot === "fail" ? DICE_FAIL : hot === "crit" ? DICE_CRIT : UI_COLORS.anomaly;
    const badge = isAttack ? "ATK" : isAction ? "ACTION" : "DADO";
    const modeLabel =
        mode === "highest" ? "keep max" : mode === "lowest" ? "keep min" : null;

    const modDice = Array.isArray(dr.modifierDice) ? dr.modifierDice : [];

    return (
        <Box sx={DICE_CARD_SX} style={diceVars(accent)}>
            <div className="dc-head">
                <RawAvatar path={avatarPath} name={name} />
                <div className="dc-who">
                    <div className="dc-name">
                        {name}
                        <ChatTime createdAt={msg.createdAt} />
                    </div>
                    <div className="dc-formula">
                        {formula}
                        {modeLabel ? ` · ${modeLabel}` : ""}
                    </div>
                </div>
                <span className="dc-badge">{badge}</span>
            </div>

            <div className="dc-body">
                <div className="dc-left">
                    {rolls.length > 0 && (
                        <div className="dc-faces">
                            {rolls.map((face, i) => (
                                <span
                                    key={`${face}-${i}`}
                                    className={`dc-face ${faceMode(face, sides)}`}
                                >
                                    {face}
                                </span>
                            ))}
                            {isAttack && modDice.length > 0 && (
                                <>
                                    <span className="dc-mod">
                                        {dr.polarity === "curse" ? "−" : "+"}
                                    </span>
                                    {modDice.map((face, i) => (
                                        <span
                                            key={`m-${face}-${i}`}
                                            className={`dc-face ${face === dr.modifierKept ? "crit" : "normal"}`}
                                            title={face === dr.modifierKept ? "kept" : "discarded"}
                                        >
                                            {face}
                                        </span>
                                    ))}
                                </>
                            )}
                            {!isAttack && !!dr.mod && (
                                <span className="dc-mod">
                                    {dr.mod >= 0 ? `+${dr.mod}` : dr.mod}
                                </span>
                            )}
                        </div>
                    )}
                    <div className="dc-label">
                        {isAttack
                            ? (dr.polarity === "boon"
                                ? `d20 + boon → ${total}`
                                : dr.polarity === "curse"
                                    ? `d20 − curse → ${total}`
                                    : "RESULTADO")
                            : "RESULTADO"}
                    </div>
                </div>
                <div className="dc-total">{total}</div>
            </div>
        </Box>
    );
}

const ABILITY_CARD_SX = {
    mb: 0.9,
    borderRadius: "6px",
    border: "1px solid var(--ab-a66)",
    background:
        "linear-gradient(135deg, var(--ab-a14) 0%, rgba(7,7,14,0.94) 40%, rgba(0,0,0,0.6) 100%)",
    boxShadow: "0 0 18px var(--ab-a22), inset 0 0 0 1px rgba(255,255,255,0.04)",
    overflow: "hidden",
    "& .ab-head": {
        display: "flex",
        alignItems: "center",
        gap: "7px",
        px: 1,
        pt: 0.7,
        pb: 0.45,
        borderBottom: "1px solid var(--ab-a33)",
    },
    "& .ab-avatar": {
        width: 24,
        height: 24,
        flexShrink: 0,
        borderRadius: "50%",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        objectFit: "cover",
        fontFamily: FONT_BODY,
        fontSize: "0.6rem",
        bgcolor: "var(--ab-a33)",
        border: "1px solid var(--ab-a66)",
        color: "var(--ab-a)",
    },
    "& .ab-who": { flex: 1, minWidth: 0 },
    "& .ab-name": {
        fontFamily: FONT_BODY,
        fontSize: "0.72rem",
        fontWeight: 700,
        letterSpacing: "0.3px",
        lineHeight: 1.2,
        color: UI_COLORS.textPrimary,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
    "& .ab-sub": {
        fontFamily: FONT_BODY,
        fontSize: "0.52rem",
        lineHeight: 1.8,
        letterSpacing: "0.8px",
        color: UI_COLORS.textSecondary,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
    "& .ab-badge": {
        flexShrink: 0,
        height: 18,
        display: "inline-flex",
        alignItems: "center",
        px: 0.75,
        borderRadius: "9px",
        fontFamily: FONT_BODY,
        fontSize: "0.5rem",
        letterSpacing: "1.2px",
        fontWeight: 700,
        bgcolor: "var(--ab-a22)",
        color: "var(--ab-a)",
        border: "1px solid var(--ab-a66)",
    },
    "& .ab-meta": {
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "5px",
        px: 1,
        pt: 0.65,
        pb: 0.35,
    },
    "& .ab-cost": {
        fontFamily: FONT_MONO,
        fontSize: "0.58rem",
        letterSpacing: "0.04em",
        color: UI_COLORS.textPrimary,
        border: `1px solid ${UI_COLORS.accent}55`,
        bgcolor: `${UI_COLORS.accent}12`,
        px: "6px",
        py: "2px",
        borderRadius: "3px",
    },
    "& .ab-tag": {
        fontFamily: FONT_MONO,
        fontSize: "0.52rem",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: UI_COLORS.anomaly,
        border: `1px solid ${UI_COLORS.anomaly}77`,
        bgcolor: `${UI_COLORS.anomaly}18`,
        boxShadow: `0 0 8px ${UI_COLORS.anomaly}22`,
        px: "6px",
        py: "2px",
        borderRadius: "3px",
    },
    "& .ab-body": {
        px: 1.1,
        pt: 0.55,
        pb: 0.95,
        fontFamily: FONT_BODY,
        fontSize: "0.78rem",
        lineHeight: 1.55,
        color: UI_COLORS.textPrimary,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
    },
    "& .ab-roll": {
        display: "inline-flex",
        alignItems: "baseline",
        gap: "3px",
        fontFamily: FONT_MONO,
        fontWeight: 700,
        fontSize: "0.88rem",
        px: "5px",
        py: "0px",
        mx: "1px",
        borderRadius: "3px",
        border: "1px solid currentColor",
        verticalAlign: "baseline",
        cursor: "help",
    },
    "& .ab-roll.normal": {
        color: UI_COLORS.anomaly,
        bgcolor: `${UI_COLORS.anomaly}14`,
        boxShadow: `0 0 8px ${UI_COLORS.anomaly}33`,
    },
    "& .ab-roll.crit": {
        color: DICE_CRIT,
        bgcolor: `${DICE_CRIT}18`,
        boxShadow: `0 0 10px ${DICE_CRIT}44`,
    },
    "& .ab-roll.fail": {
        color: DICE_FAIL,
        bgcolor: `${DICE_FAIL}14`,
        boxShadow: `0 0 10px ${DICE_FAIL}44`,
    },
    "& .ab-roll-tip": {
        fontSize: "0.5rem",
        fontWeight: 500,
        opacity: 0.65,
        letterSpacing: "0.02em",
    },
};

const abilityVarsCache = new Map();

function abilityVars(accent) {
    let cached = abilityVarsCache.get(accent);
    if (!cached) {
        cached = {
            "--ab-a": accent,
            "--ab-a14": `${accent}14`,
            "--ab-a22": `${accent}22`,
            "--ab-a33": `${accent}33`,
            "--ab-a66": `${accent}66`,
        };
        abilityVarsCache.set(accent, cached);
    }
    return cached;
}

function AbilityInlineBody({ text, inlineRolls }) {
    const rolls = Array.isArray(inlineRolls) ? inlineRolls : [];
    const raw = String(text || "");
    if (!raw) return null;
    if (!rolls.length || !raw.includes("⟦")) {
        return <>{raw}</>;
    }

    const nodes = [];
    let last = 0;
    const re = new RegExp(INLINE_ROLL_MARKER_RE.source, "g");
    let m;
    while ((m = re.exec(raw)) !== null) {
        if (m.index > last) nodes.push(raw.slice(last, m.index));
        const idx = Number(m[1]);
        const roll = rolls[idx];
        if (roll) {
            const hot = roll.hot || "normal";
            nodes.push(
                <span
                    key={`r-${idx}-${m.index}`}
                    className={`ab-roll ${hot}`}
                    title={`${roll.formula}${roll.rolls?.length ? ` → [${roll.rolls.join(", ")}]` : ""}`}
                >
                    {roll.total}
                    <span className="ab-roll-tip">{roll.formula}</span>
                </span>,
            );
        } else {
            nodes.push(m[0]);
        }
        last = m.index + m[0].length;
    }
    if (last < raw.length) nodes.push(raw.slice(last));
    return <>{nodes}</>;
}

function AbilityChatCard({ msg, avatarByCharacterId }) {
    const isAttack = msg.abilityKind === "attack";
    const accent = isAttack ? UI_COLORS.accent : UI_COLORS.anomaly;
    const name = msg.characterName || msg.senderName || "???";
    const livePath = msg.characterId ? avatarByCharacterId?.get(msg.characterId) : null;
    const avatarPath = livePath || msg.characterAvatarUrl;
    const tags = Array.isArray(msg.abilityTags) ? msg.abilityTags : [];
    const cost = msg.abilityCost || null;

    return (
        <Box sx={ABILITY_CARD_SX} style={abilityVars(accent)}>
            <div className="ab-head">
                <RawAvatar path={avatarPath} name={name} className="ab-avatar" />
                <div className="ab-who">
                    <div className="ab-name">
                        {(msg.abilityLabel || "HABILIDAD").toUpperCase()}
                        <ChatTime createdAt={msg.createdAt} />
                    </div>
                    <div className="ab-sub">{name}</div>
                </div>
                <span className="ab-badge">{isAttack ? "ATK" : "ABILITY"}</span>
            </div>

            {(cost || tags.length > 0) && (
                <div className="ab-meta">
                    {cost ? <span className="ab-cost">{cost}</span> : null}
                    {tags.map((t) => (
                        <span key={t} className="ab-tag">{t}</span>
                    ))}
                </div>
            )}

            {msg.text ? (
                <div className="ab-body">
                    <AbilityInlineBody text={msg.text} inlineRolls={msg.abilityInlineRolls} />
                </div>
            ) : null}
        </Box>
    );
}

function ChatMessage({ msg, glossaryEntities, avatarByCharacterId }) {
    if (msg.type === CHAT_MESSAGE_TYPES.DICE) {
        return <DiceChatCard msg={msg} avatarByCharacterId={avatarByCharacterId} />;
    }

    if (msg.type === CHAT_MESSAGE_TYPES.ABILITY) {
        return <AbilityChatCard msg={msg} avatarByCharacterId={avatarByCharacterId} />;
    }

    if (msg.isOOC) {
        return (
            <Box
                sx={{
                    mb: 0.6,
                    px: 1,
                    py: 0.5,
                    borderLeft: `3px solid ${UI_COLORS.border}`,
                    bgcolor: "rgba(255,255,255,0.04)",
                    borderRadius: "0 4px 4px 0",
                }}
            >
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.25 }}>
                    <Chip
                        label="OOC"
                        size="small"
                        sx={{
                            height: 16,
                            fontSize: "0.5rem",
                            letterSpacing: 1,
                            bgcolor: `${UI_COLORS.textSecondary}22`,
                            color: UI_COLORS.textSecondary,
                        }}
                    />
                    <CyberText sx={{ fontSize: "0.6rem", color: UI_COLORS.textSecondary }}>
                        {msg.senderName}
                        <ChatTime createdAt={msg.createdAt} />
                    </CyberText>
                </Stack>
                <CyberText
                    sx={{
                        fontSize: "0.78rem",
                        color: "rgba(255,255,255,0.78)",
                        fontStyle: "italic",
                        lineHeight: 1.4,
                    }}
                >
                    {msg.text}
                </CyberText>
            </Box>
        );
    }

    const accent = UI_COLORS.anomaly;
    const displayName = msg.characterName || msg.senderName;
    const livePath = msg.characterId ? avatarByCharacterId?.get(msg.characterId) : null;
    const avatarPath = livePath || msg.characterAvatarUrl;

    return (
        <Box sx={{ mb: 0.7, display: "flex", gap: 0.75, alignItems: "flex-start" }}>
            <ChatAvatar
                path={avatarPath}
                name={displayName}
                accent={accent}
            />
            <Box
                sx={{
                    flex: 1,
                    minWidth: 0,
                    px: 1,
                    py: 0.45,
                    borderLeft: `3px solid ${accent}`,
                    bgcolor: "rgba(0,0,0,0.35)",
                    borderRadius: "0 4px 4px 0",
                }}
            >
                <CyberText
                    sx={{
                        fontSize: "0.62rem",
                        color: accent,
                        fontWeight: 700,
                        letterSpacing: 0.4,
                        mb: 0.15,
                        display: "flex",
                        alignItems: "baseline",
                        flexWrap: "wrap",
                    }}
                >
                    <span>
                        {displayName}
                        {msg.characterName && msg.senderName && msg.characterName !== msg.senderName && (
                            <span style={{ color: UI_COLORS.textSecondary, fontWeight: 400 }}>
                                {" "}· {msg.senderName}
                            </span>
                        )}
                    </span>
                    <ChatTime createdAt={msg.createdAt} />
                </CyberText>
                <GlossaryTextRenderer
                    text={msg.text}
                    entities={glossaryEntities}
                    sx={MSG_BODY_SX}
                />
            </Box>
        </Box>
    );
}

/**
 * Rows are pure: message objects keep identity across snapshots
 * (see `subscribeToChatMessages`), so a new message renders one row.
 */
const ChatRow = memo(ChatMessage);

const LIST_SX = {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    px: 1.25,
    py: 1,
    ...CYBER_SCROLL_STYLE,
};

const olderBtnSx = {
    width: "100%",
    mb: 1,
    py: 0.4,
    fontFamily: "'Orbitron', sans-serif",
    fontSize: "0.5rem",
    letterSpacing: "0.14em",
    color: UI_COLORS.textSecondary,
    border: `1px solid ${UI_COLORS.border}`,
    borderRadius: "4px",
    bgcolor: "rgba(0,0,0,0.3)",
    "&:hover": { color: UI_COLORS.accent, borderColor: UI_COLORS.accent },
};

/**
 * Isolated message list — memoized so typing in the composer (local `text`
 * state in the parent) never re-renders every chat card on each keystroke.
 * Only the newest {@link RENDER_WINDOW} rows are mounted: a full 200-card log
 * costs ~500ms of layout/paint every time the dock opens or closes.
 */
const MessageList = memo(function MessageList({
    scrollRef,
    visibleMessages,
    glossaryEntities,
    avatarByCharacterId,
}) {
    const [limit, setLimit] = useState(RENDER_WINDOW);
    const lastIdRef = useRef(null);

    const rows = useMemo(
        () => (visibleMessages.length > limit ? visibleMessages.slice(-limit) : visibleMessages),
        [visibleMessages, limit],
    );
    const hasOlder = visibleMessages.length > rows.length;

    // Stick to the bottom on mount and when a new message lands, but never
    // yank the view while the user is reading older history.
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const lastId = rows.length ? rows[rows.length - 1].id : null;
        const isNew = lastId !== lastIdRef.current;
        lastIdRef.current = lastId;
        const nearBottom =
            el.scrollHeight - el.scrollTop - el.clientHeight < 240;
        if (isNew || nearBottom) el.scrollTop = el.scrollHeight;
    }, [rows, scrollRef]);

    return (
        <Box ref={scrollRef} sx={LIST_SX}>
            {hasOlder && (
                <Box
                    component="button"
                    type="button"
                    onClick={() => setLimit((n) => n + RENDER_WINDOW_STEP)}
                    sx={olderBtnSx}
                >
                    CARGAR ANTERIORES ({visibleMessages.length - rows.length})
                </Box>
            )}
            {rows.map((m) => (
                <ChatRow
                    key={m.id}
                    msg={m}
                    glossaryEntities={glossaryEntities}
                    avatarByCharacterId={avatarByCharacterId}
                />
            ))}
        </Box>
    );
});

/**
 * Chat panel for the right dock. Visibility controlled by parent (`open`).
 */
export default function VttChatPanel({
    open = false,
    onClose,
    messages = [],
    glossaryEntities = EMPTY_GLOSSARY,
    revealedDiceIds = null,
}) {
    const dispatch = useDispatch();
    const [text, setText] = useState("");
    const [clearOpen, setClearOpen] = useState(false);
    const [clearing, setClearing] = useState(false);
    const scrollRef = useRef(null);

    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const campaignName = useSelector((s) => s.world.selectedCampaignName);
    const profile = useSelector((s) => s.player.profile);
    const locations = useSelector((s) => s.world.locations);
    const charactersById = useSelector((s) => s.world.charactersById ?? {});
    const sheetCharacters = useSelector((s) => s.characters.list);
    const isDM = isDmRole(profile?.role);

    const allCharactersById = useMemo(
        () => buildCampaignCharacterMap(charactersById, locations, sheetCharacters, campaignId),
        [charactersById, locations, sheetCharacters, campaignId],
    );

    const avatarByCharacterId = useMemo(() => {
        const map = new Map();
        allCharactersById.forEach((c, id) => {
            const path = c.tokenImageUrl || c.imageUrl;
            if (path) map.set(id, path);
        });
        return map;
    }, [allCharactersById]);

    const myCharacters = useMemo(() => {
        const all = [...allCharactersById.values()];
        const ownedIds = new Set(profile?.characterIds || []);
        const owned = all.filter(
            (c) => ownedIds.has(c.id) || c.ownerPlayerId === profile?.uid,
        );
        if (owned.length) {
            return owned.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        }
        // Fallback: non-NPC roster if ownership links are missing
        return all
            .filter((c) => !c.isNpc && !c.isEnemy)
            .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }, [allCharactersById, profile]);

    const activeCharacter = useMemo(() => {
        const id = profile?.activeCharacterId;
        if (!id) return myCharacters[0] || null;
        return myCharacters.find((c) => c.id === id) || myCharacters[0] || null;
    }, [profile?.activeCharacterId, myCharacters]);

    const visibleMessages = useMemo(() => {
        if (!open) return EMPTY_MESSAGES;
        if (!revealedDiceIds) return messages;
        return messages.filter((m) => {
            if (m?.type !== CHAT_MESSAGE_TYPES.DICE) return true;
            return revealedDiceIds.has(m.id);
        });
    }, [open, messages, revealedDiceIds]);

    const handleSelectCharacter = (char) => {
        if (!char?.id) return;
        dispatch(setActiveCharacterId(char.id));
        if (profile?.uid) {
            dispatch(persistActiveCharacter({ uid: profile.uid, characterId: char.id }));
        }
    };

    const handleSend = async () => {
        const raw = text.trim();
        if (!raw || !campaignId) return;

        const isOOC = raw.startsWith("/");
        const body = isOOC ? raw.replace(/^\/\s*/, "").trim() : raw;
        if (!body) return;

        if (isOOC) {
            await sendChatMessage(campaignId, {
                type: CHAT_MESSAGE_TYPES.TEXT,
                text: body,
                senderId: profile?.uid,
                senderName: profile?.nickname ?? "Jugador",
                isOOC: true,
            });
        } else {
            await sendChatMessage(campaignId, {
                type: CHAT_MESSAGE_TYPES.TEXT,
                text: body,
                senderId: profile?.uid,
                senderName: profile?.nickname ?? "Jugador",
                characterId: activeCharacter?.id ?? null,
                characterName: activeCharacter?.name ?? null,
                characterAvatarUrl: activeCharacter?.tokenImageUrl || activeCharacter?.imageUrl || null,
                isOOC: false,
            });
        }
        setText("");
    };

    const handleClearChat = async ({ withBackup }) => {
        if (!campaignId || !isDM || clearing) return;
        setClearing(true);
        try {
            const result = await clearCampaignChat(campaignId, {
                withBackup,
                campaignName: campaignName || undefined,
            });
            setClearOpen(false);
            dispatch(showSnackbar({
                message: result.backedUp
                    ? `Chat limpiado (${result.deleted} msgs) · respaldo descargado`
                    : `Chat limpiado (${result.deleted} msgs)`,
                severity: "success",
            }));
        } catch (err) {
            console.error("[VttChatPanel] clear chat:", err);
            dispatch(showSnackbar({
                message: "No se pudo limpiar el chat",
                severity: "error",
            }));
        } finally {
            setClearing(false);
        }
    };

    const placeholder = activeCharacter
        ? `Como ${activeCharacter.name}… (/ para OOC)`
        : "Mensaje… (/ para OOC)";

    return (
        <Paper
            elevation={0}
            data-no-token-drop
            aria-hidden={!open}
            sx={{
                flex: open ? 1 : "0 0 0",
                minHeight: open ? 0 : 0,
                width: "100%",
                bgcolor: `${UI_COLORS.backgroundSecondary}f2`,
                border: `1px solid ${UI_COLORS.border}`,
                borderRadius: 1,
                display: open ? "flex" : "none",
                flexDirection: "column",
                overflow: "hidden",
                pointerEvents: open ? "auto" : "none",
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    px: 1.25,
                    py: 0.6,
                    borderBottom: `1px solid ${UI_COLORS.border}`,
                    flexShrink: 0,
                }}
            >
                <ChatIcon sx={{ fontSize: "1rem", color: UI_COLORS.anomaly }} />
                <CyberTitle sx={{ fontSize: "0.68rem", color: UI_COLORS.anomaly, letterSpacing: 2, flex: 1 }}>
                    CHAT
                </CyberTitle>
                <IconButton
                    size="small"
                    onClick={onClose}
                    sx={{ color: UI_COLORS.textSecondary, p: 0.25 }}
                    aria-label="Cerrar chat"
                >
                    <CloseIcon sx={{ fontSize: "1rem" }} />
                </IconButton>
            </Box>

            {/* Mounting the log while the dock is hidden still costs a full
                React render on every incoming message — keep it unmounted. */}
            {open ? (
                <MessageList
                    scrollRef={scrollRef}
                    visibleMessages={visibleMessages}
                    glossaryEntities={glossaryEntities}
                    avatarByCharacterId={avatarByCharacterId}
                />
            ) : (
                <Box sx={{ flex: 1, minHeight: 0 }} />
            )}

            <Box
                sx={{
                    px: 1,
                    py: 0.65,
                    borderTop: `1px solid ${UI_COLORS.border}`,
                    bgcolor: "rgba(0,0,0,0.25)",
                    flexShrink: 0,
                }}
            >
                <CyberText sx={{ fontSize: "0.52rem", color: UI_COLORS.textSecondary, mb: 0.4, letterSpacing: 0.6 }}>
                    HABLANDO COMO
                </CyberText>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
                    <Autocomplete
                        size="small"
                        options={myCharacters}
                        value={activeCharacter}
                        onChange={(_, char) => handleSelectCharacter(char)}
                        getOptionLabel={(c) => c?.name || c?.id || ""}
                        isOptionEqualToValue={(a, b) => a?.id === b?.id}
                        disableClearable
                        noOptionsText="Sin personajes"
                        sx={{ flex: 1, minWidth: 0 }}
                        slotProps={{
                            paper: {
                                sx: {
                                    bgcolor: UI_COLORS.backgroundSecondary,
                                    border: `1px solid ${UI_COLORS.border}`,
                                    "& .MuiAutocomplete-option": {
                                        fontSize: "0.78rem",
                                        color: UI_COLORS.textPrimary,
                                    },
                                },
                            },
                        }}
                        renderOption={(props, option) => (
                            <Box component="li" {...props} key={option.id} sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                                <ChatAvatar
                                    path={option.tokenImageUrl || option.imageUrl}
                                    name={option.name}
                                    accent={UI_COLORS.anomaly}
                                    size={22}
                                />
                                <span>{option.name}</span>
                            </Box>
                        )}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                placeholder="Buscar personaje…"
                                sx={{
                                    ...fieldSx,
                                    "& input": { ...fieldSx["& input"], fontSize: "0.75rem", py: 0.5 },
                                }}
                            />
                        )}
                    />
                    {isDM && (
                        <CyberTooltip title="Limpiar chat (DJ)" placement="top">
                            <IconButton
                                size="small"
                                onClick={() => setClearOpen(true)}
                                aria-label="Limpiar chat"
                                sx={{
                                    flexShrink: 0,
                                    color: UI_COLORS.textSecondary,
                                    p: 0.55,
                                    borderRadius: 0.75,
                                    border: `1px solid ${UI_COLORS.border}`,
                                    bgcolor: "rgba(0,0,0,0.35)",
                                    "&:hover": {
                                        color: UI_COLORS.accentStrong,
                                        borderColor: `${UI_COLORS.accentStrong}88`,
                                        bgcolor: `${UI_COLORS.accentStrong}14`,
                                    },
                                }}
                            >
                                <DeleteSweepIcon sx={{ fontSize: "1.05rem" }} />
                            </IconButton>
                        </CyberTooltip>
                    )}
                </Box>
            </Box>

            <Stack direction="row" spacing={0.5} sx={{ px: 1, py: 1, flexShrink: 0 }}>
                <TextField
                    size="small"
                    fullWidth
                    placeholder={placeholder}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    sx={fieldSx}
                />
                <IconButton
                    size="small"
                    onClick={handleSend}
                    disabled={!text.trim()}
                    sx={{ color: UI_COLORS.accent }}
                >
                    <SendIcon fontSize="small" />
                </IconButton>
            </Stack>

            {isDM && (
                <ClearChatDialog
                    open={clearOpen}
                    onClose={() => { if (!clearing) setClearOpen(false); }}
                    onConfirm={handleClearChat}
                    clearing={clearing}
                    messageCount={messages?.length || 0}
                />
            )}
        </Paper>
    );
}
