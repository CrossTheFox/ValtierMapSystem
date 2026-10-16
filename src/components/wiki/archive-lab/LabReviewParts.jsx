/**
 * Pieces shared by the Neural Lab review panel and the floating card on the map.
 */

import { Box, CircularProgress } from "@mui/material";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import PsychologyIcon from "@mui/icons-material/Psychology";
import LinkIcon from "@mui/icons-material/Link";
import AddLinkIcon from "@mui/icons-material/AddLink";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import UndoIcon from "@mui/icons-material/Undo";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import CyberTooltip from "../../customs/CyberTooltip";
import { UI_COLORS } from "../../../constants/uiColors";
import { CODEX_TYPES } from "../../../constants/wiki/archiveCodex";
import {
    COLLECTIVE_ARCHETYPE_AI_DESCRIPTIONS,
    COLLECTIVE_ARCHETYPE_LABELS,
    REACTION_ARCHETYPE_AI_DESCRIPTIONS,
    REACTION_ARCHETYPE_LABELS,
} from "../../../constants/wiki/entityFieldSchemas";
import { REVIEW, REVIEW_COLOR, canFlip, effectiveItem, statusOf } from "../../../utils/labImpactReview";
import { MONO, SANS, TITLE, WAVE_TONES, rowIn } from "./labReviewTokens";

const KIND_ICON = {
    reaction: ChatBubbleOutlineIcon,
    state: PsychologyIcon,
    relation_add: AddLinkIcon,
    relation_update: LinkIcon,
    relation_remove: LinkOffIcon,
    note: InfoOutlinedIcon,
    unknown: InfoOutlinedIcon,
};

const TONE_ICON = { ok: CheckCircleOutlineIcon, warn: WarningAmberIcon, fail: ErrorOutlineIcon };
const TONE_COLOR = { ok: "#3dd68c", warn: "#f5c542", fail: "#ff3355" };

export function TypeBadge({ type, size = 32 }) {
    const meta = CODEX_TYPES[type] || { code: "·", color: "#ffffff" };
    return (
        <Box
            aria-hidden
            sx={{
                width: size,
                height: size,
                flexShrink: 0,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                border: `2px solid ${meta.color}`,
                background: "radial-gradient(circle at 35% 30%, #2e3044, #121218)",
                boxShadow: `0 0 10px ${meta.color}44`,
                fontFamily: TITLE,
                fontSize: size >= 36 ? "10px" : "8.5px",
                letterSpacing: "0.1em",
                color: meta.color,
            }}
        >
            {meta.code}
        </Box>
    );
}

export function Pill({ children, color, solid = false, title }) {
    const body = (
        <Box
            component="span"
            sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                px: "6px",
                py: "1px",
                borderRadius: "3px",
                border: `1px solid ${color}`,
                color: solid ? "#07070c" : color,
                background: solid ? color : `${color}14`,
                fontFamily: TITLE,
                fontSize: "8.5px",
                letterSpacing: "0.1em",
                whiteSpace: "nowrap",
                lineHeight: 1.6,
            }}
        >
            {children}
        </Box>
    );
    return title ? <CyberTooltip title={title}>{body}</CyberTooltip> : body;
}

export function WavePill({ wave }) {
    if (wave == null) return null;
    const color = WAVE_TONES[wave] || WAVE_TONES[3];
    return (
        <Pill color={color} title={wave === 0 ? "La ficha donde ocurrió el evento." : `A ${wave} salto${wave === 1 ? "" : "s"} del ancla en el grafo.`}>
            {wave === 0 ? "ANCLA" : `ONDA ${wave}`}
        </Pill>
    );
}

export function ArchetypePill({ archetype, collective }) {
    if (!archetype) return null;
    const label = collective ? COLLECTIVE_ARCHETYPE_LABELS[archetype] : REACTION_ARCHETYPE_LABELS[archetype];
    const ai = collective ? COLLECTIVE_ARCHETYPE_AI_DESCRIPTIONS[archetype] : REACTION_ARCHETYPE_AI_DESCRIPTIONS[archetype];
    if (!label) return null;
    return (
        <Pill color={UI_COLORS.accent} title={`La IA reaccionó como ${label}: ${ai}`}>
            {label.toUpperCase()}
        </Pill>
    );
}

export function SealPill({ seal }) {
    return <Pill color={seal.color} solid>{seal.label}</Pill>;
}

export function SealReasons({ seal, dense = false }) {
    return (
        <Box
            sx={{
                mt: 0.75,
                p: dense ? "6px 8px" : "8px 10px",
                borderRadius: "5px",
                border: `1px solid ${seal.color}44`,
                background: `${seal.color}0d`,
            }}
        >
            <Box sx={{ fontFamily: SANS, fontSize: dense ? "11.5px" : "12px", color: "#ffffff", mb: 0.5 }}>
                <Box component="span" sx={{ fontFamily: TITLE, fontSize: "8.5px", letterSpacing: "0.12em", color: seal.color, mr: 0.75 }}>
                    POR QUÉ {seal.label}
                </Box>
                {seal.headline}
            </Box>
            {seal.reasons.map((reason, index) => {
                const Icon = TONE_ICON[reason.tone] || InfoOutlinedIcon;
                return (
                    <Box key={`${index}-${reason.text}`} sx={{ display: "flex", gap: 0.6, alignItems: "flex-start", mt: 0.35 }}>
                        <Icon sx={{ fontSize: 13, mt: "2px", color: TONE_COLOR[reason.tone] || UI_COLORS.textSecondary, flexShrink: 0 }} />
                        <Box sx={{ fontFamily: SANS, fontSize: dense ? "11px" : "11.5px", color: "#dddddd", lineHeight: 1.45 }}>
                            {reason.text}
                        </Box>
                    </Box>
                );
            })}
        </Box>
    );
}

function ActBtn({ icon, label, color, onClick, disabled, filled = false }) {
    const Icon = icon;
    return (
        <Box
            component="button"
            type="button"
            disabled={disabled}
            onClick={(event) => {
                event.stopPropagation();
                onClick?.();
            }}
            aria-label={label}
            sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
                px: "7px",
                py: "3px",
                borderRadius: "4px",
                cursor: disabled ? "default" : "pointer",
                border: `1px solid ${color}`,
                color: filled ? "#07070c" : color,
                background: filled ? color : "transparent",
                fontFamily: TITLE,
                fontSize: "8.5px",
                letterSpacing: "0.08em",
                opacity: disabled ? 0.4 : 1,
                transition: "background-color .15s, color .15s, box-shadow .15s",
                "&:hover:not(:disabled)": { background: color, color: "#07070c", boxShadow: `0 0 10px ${color}66` },
                "&:focus-visible": { outline: `2px solid ${UI_COLORS.anomaly}`, outlineOffset: "1px" },
            }}
        >
            <Icon sx={{ fontSize: 12 }} />
            {label}
        </Box>
    );
}

/**
 * One reviewable change with its accept / reject controls.
 */
export function ReviewItemRow({ item: raw, decisions, onDecide, canWrite, dense = false, index = 0 }) {
    const item = effectiveItem(raw, decisions);
    const Icon = KIND_ICON[item.kind] || InfoOutlinedIcon;
    const decision = decisions[item.key] || {};
    const status = statusOf(decisions, item.key);
    const busy = Boolean(decision.busy);
    const blocked = !item.valid && !item.advisory;
    const tone = blocked ? "#ff3355"
        : item.advisory ? UI_COLORS.textSecondary
            : status === REVIEW.ACCEPTED ? REVIEW_COLOR.accepted
                : status === REVIEW.REJECTED ? REVIEW_COLOR.rejected
                    : item.kind === "reaction" ? UI_COLORS.anomaly
                        : item.deltaColor || UI_COLORS.loot;
    return (
        <Box
            sx={{
                ...rowIn,
                animationDelay: `${Math.min(index, 8) * 35}ms`,
                display: "grid",
                gridTemplateColumns: "18px 1fr",
                gap: 0.75,
                py: dense ? 0.6 : 0.8,
                px: dense ? 0.75 : 1,
                borderRadius: "5px",
                borderLeft: `2px solid ${tone}`,
                background: status === REVIEW.ACCEPTED ? `${REVIEW_COLOR.accepted}0f` : "rgba(255,255,255,0.02)",
                opacity: status === REVIEW.REJECTED ? 0.62 : 1,
                transition: "background-color .2s, opacity .2s",
                "& + &": { mt: 0.5 },
            }}
        >
            <Icon sx={{ fontSize: 16, color: tone, mt: "1px" }} />
            <Box sx={{ minWidth: 0 }}>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, flexWrap: "wrap" }}>
                    <Box sx={{ fontFamily: TITLE, fontSize: "8.5px", letterSpacing: "0.12em", color: tone, textTransform: "uppercase" }}>
                        {item.title}
                    </Box>
                    {item.fromTitle && (
                        <Box sx={{ fontFamily: SANS, fontSize: "11.5px", color: UI_COLORS.textSecondary }}>
                            {item.fromTitle} → {item.toTitle}
                        </Box>
                    )}
                    {item.kind === "state" && item.targetTitle && (
                        <Box sx={{ fontFamily: SANS, fontSize: "11.5px", color: UI_COLORS.textSecondary }}>{item.targetTitle}</Box>
                    )}
                </Box>
                <Box
                    sx={{
                        mt: 0.25,
                        fontFamily: item.kind === "reaction" || item.advisory ? SANS : MONO,
                        fontSize: item.kind === "reaction" ? "12.5px" : "12px",
                        color: "#ffffff",
                        lineHeight: 1.45,
                        textDecoration: status === REVIEW.REJECTED ? "line-through" : "none",
                        textDecorationColor: `${REVIEW_COLOR.rejected}`,
                        whiteSpace: "pre-wrap",
                    }}
                >
                    {item.detail}
                </Box>
                {item.hook && (
                    <Box sx={{ mt: 0.35, fontFamily: SANS, fontSize: "12px", color: "#dddddd", lineHeight: 1.45 }}>
                        <Box component="span" sx={{ color: UI_COLORS.accent, fontFamily: TITLE, fontSize: "8px", letterSpacing: "0.1em", mr: 0.5 }}>GANCHO</Box>
                        {item.hook}
                    </Box>
                )}
                {item.reason && (
                    <Box sx={{ mt: 0.35, fontFamily: SANS, fontSize: "11.5px", color: UI_COLORS.textSecondary, fontStyle: "italic", lineHeight: 1.4 }}>
                        Por qué: {item.reason}
                    </Box>
                )}
                {!blocked && (item.warnings || []).map((text) => (
                    <Box key={text} sx={{ mt: 0.45, display: "flex", gap: 0.5, alignItems: "flex-start", color: "#f5c542", fontFamily: SANS, fontSize: "11.5px", lineHeight: 1.4 }}>
                        <WarningAmberIcon sx={{ fontSize: 13, mt: "2px", flexShrink: 0 }} />
                        <span>{text}</span>
                    </Box>
                ))}
                {blocked && (
                    <Box sx={{ mt: 0.5, display: "flex", gap: 0.5, alignItems: "flex-start", color: "#ff8095", fontFamily: SANS, fontSize: "11.5px", lineHeight: 1.4 }}>
                        <LockOutlinedIcon sx={{ fontSize: 13, mt: "2px" }} />
                        <span>Bloqueado: {item.error || "no pasó la validación."}</span>
                    </Box>
                )}
                {item.advisory && (
                    <Box sx={{ mt: 0.35, fontFamily: SANS, fontSize: "11px", color: UI_COLORS.textSecondary }}>
                        {item.note || "Solo consultiva: no cambia la ficha."}
                    </Box>
                )}
                {decision.error && (
                    <Box sx={{ mt: 0.4, fontFamily: SANS, fontSize: "11.5px", color: "#ff8095" }}>{decision.error}</Box>
                )}
                {!blocked && !item.advisory && (
                    <Box sx={{ mt: 0.6, display: "flex", alignItems: "center", gap: 0.6, flexWrap: "wrap" }}>
                        {busy && <CircularProgress size={12} sx={{ color: UI_COLORS.anomaly }} />}
                        {status === REVIEW.PENDING && (
                            <>
                                <ActBtn icon={CheckIcon} label="Aceptar" color={REVIEW_COLOR.accepted} disabled={busy || !canWrite} onClick={() => onDecide(item.key, "accept")} />
                                <ActBtn icon={CloseIcon} label="Rechazar" color="#ff8095" disabled={busy} onClick={() => onDecide(item.key, "reject")} />
                                {canFlip(raw) && (
                                    <CyberTooltip title={item.flipped ? "Volver al signo que propuso la IA." : "Aplica el mismo ajuste con el signo contrario."}>
                                        <span>
                                            <ActBtn
                                                icon={SwapVertIcon}
                                                label={item.flipped ? "Signo de la IA" : "Invertir signo"}
                                                color={UI_COLORS.loot}
                                                filled={Boolean(item.flipped)}
                                                disabled={busy}
                                                onClick={() => onDecide(item.key, "flip")}
                                            />
                                        </span>
                                    </CyberTooltip>
                                )}
                                {!item.isStructural && (item.kind === "relation_add" || item.kind === "relation_update") && item.after != null && (
                                    <Box
                                        component="label"
                                        sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: "#ffffff", fontFamily: SANS, fontSize: "11px" }}
                                    >
                                        Fuerza
                                        <Box
                                            component="input"
                                            type="number"
                                            min={-10}
                                            max={10}
                                            aria-label={`Fuerza de ${item.fromTitle} hacia ${item.toTitle}`}
                                            value={item.after}
                                            onChange={(event) => onDecide(item.key, "strength", event.target.value)}
                                            sx={{
                                                width: 52,
                                                px: 0.5,
                                                py: 0.15,
                                                bgcolor: "rgba(0,0,0,0.45)",
                                                color: "#ffffff",
                                                border: `1px solid ${UI_COLORS.border}`,
                                                borderRadius: "3px",
                                                fontFamily: MONO,
                                                fontSize: "12px",
                                            }}
                                        />
                                    </Box>
                                )}
                            </>
                        )}
                        {item.flipped && status !== REVIEW.REJECTED && (
                            <Pill color={UI_COLORS.loot}>SIGNO CORREGIDO POR EL DM</Pill>
                        )}
                        {status === REVIEW.ACCEPTED && (
                            <>
                                <Pill color={REVIEW_COLOR.accepted}>✓ EN LA FICHA</Pill>
                                <ActBtn icon={UndoIcon} label="Deshacer" color={UI_COLORS.textSecondary} disabled={busy} onClick={() => onDecide(item.key, "undo")} />
                            </>
                        )}
                        {status === REVIEW.REJECTED && (
                            <>
                                <Pill color={REVIEW_COLOR.rejected}>✕ RECHAZADO</Pill>
                                <ActBtn icon={UndoIcon} label="Reconsiderar" color={UI_COLORS.textSecondary} onClick={() => onDecide(item.key, "reset")} />
                            </>
                        )}
                    </Box>
                )}
                {status === REVIEW.ACCEPTED && decision.mirroredTo && !dense && (
                    <Box sx={{ mt: 0.35, fontFamily: SANS, fontSize: "11px", color: UI_COLORS.textSecondary }}>
                        También en el Codex de la mesa: {decision.mirroredTo}
                    </Box>
                )}
            </Box>
        </Box>
    );
}

export function GroupActions({ counts, onAccept, onReject, canWrite }) {
    if (!counts.pending) return null;
    return (
        <Box sx={{ display: "flex", gap: 0.6, flexWrap: "wrap" }}>
            <ActBtn icon={CheckIcon} label={`Aceptar todo (${counts.pending})`} color={REVIEW_COLOR.accepted} disabled={!canWrite} onClick={onAccept} />
            <ActBtn icon={CloseIcon} label="Rechazar todo" color="#ff8095" onClick={onReject} />
        </Box>
    );
}

export function ProgressBar({ counts }) {
    const total = Math.max(1, counts.total);
    const seg = (n, color) => (n > 0 ? <Box sx={{ width: `${(n / total) * 100}%`, background: color, transition: "width .3s" }} /> : null);
    return (
        <Box sx={{ display: "flex", height: 5, borderRadius: "3px", overflow: "hidden", background: "rgba(255,255,255,0.08)" }}>
            {seg(counts.accepted, REVIEW_COLOR.accepted)}
            {seg(counts.rejected, REVIEW_COLOR.rejected)}
        </Box>
    );
}
