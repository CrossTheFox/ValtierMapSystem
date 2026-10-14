/**
 * Neural Lab side panel: the DM accepts or rejects every change of a cascade.
 * Accepting writes at once and adds the change to the ficha's Neural Lab block.
 */

import { useEffect, useRef, useState } from "react";
import { Box, Collapse } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CenterFocusStrongIcon from "@mui/icons-material/CenterFocusStrong";
import CloseIcon from "@mui/icons-material/Close";
import { UI_COLORS } from "../../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../../constants/cyberScrollStyle";
import { reviewCounts } from "../../../utils/labImpactReview";
import { explainOverallSeal } from "../../../utils/impactSealGrade";
import {
    ArchetypePill,
    GroupActions,
    ProgressBar,
    ReviewItemRow,
    SealPill,
    SealReasons,
    TypeBadge,
    WavePill,
} from "./LabReviewParts";
import { MONO, SANS, TITLE, rowIn } from "./labReviewTokens";

function Kicker({ children, color = UI_COLORS.textSecondary, sx }) {
    return (
        <Box sx={{ fontFamily: TITLE, fontSize: "8.5px", letterSpacing: "0.16em", color, textTransform: "uppercase", ...sx }}>
            {children}
        </Box>
    );
}

function WhyToggle({ open, onToggle, color, label }) {
    return (
        <Box
            component="button"
            type="button"
            onClick={(event) => {
                event.stopPropagation();
                onToggle();
            }}
            aria-expanded={open}
            sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: "2px",
                p: 0,
                border: 0,
                background: "none",
                cursor: "pointer",
                color,
                fontFamily: SANS,
                fontSize: "11.5px",
                textDecoration: "underline dotted",
                textUnderlineOffset: "3px",
                "&:focus-visible": { outline: `2px solid ${UI_COLORS.anomaly}`, outlineOffset: "2px" },
            }}
        >
            {label}
            <ExpandMoreIcon sx={{ fontSize: 14, transition: "transform .2s", transform: open ? "rotate(180deg)" : "none" }} />
        </Box>
    );
}

function GroupCard({ group, decisions, onDecide, onAcceptGroup, onRejectGroup, onFocus, focused, canWrite, index }) {
    const counts = reviewCounts(group.items, decisions);
    const [whyOpen, setWhyOpen] = useState(group.seal.grade !== "ok");
    const [open, setOpen] = useState(true);
    const ref = useRef(null);
    useEffect(() => {
        if (focused) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, [focused]);
    const done = counts.total > 0 && counts.pending === 0;
    return (
        <Box
            ref={ref}
            sx={{
                ...rowIn,
                animationDelay: `${Math.min(index, 6) * 50}ms`,
                mb: 1,
                borderRadius: "7px",
                border: `1px solid ${focused ? UI_COLORS.anomaly : "rgba(255,255,255,0.1)"}`,
                borderLeft: `3px solid ${group.seal.color}`,
                background: focused ? "rgba(0,242,234,0.05)" : "rgba(10,10,16,0.72)",
                boxShadow: focused ? "0 0 0 1px rgba(0,242,234,0.25), 0 0 18px rgba(0,242,234,0.12)" : "none",
                transition: "border-color .2s, background-color .2s, box-shadow .2s",
            }}
        >
            <Box
                role="button"
                tabIndex={0}
                onClick={() => group.entityId && onFocus?.(group.entityId)}
                onKeyDown={(event) => {
                    if ((event.key === "Enter" || event.key === " ") && group.entityId) {
                        event.preventDefault();
                        onFocus?.(group.entityId);
                    }
                }}
                sx={{
                    display: "flex",
                    gap: 1,
                    alignItems: "center",
                    p: "9px 10px 6px",
                    cursor: group.entityId ? "pointer" : "default",
                    "&:focus-visible": { outline: `2px solid ${UI_COLORS.anomaly}`, outlineOffset: "-2px" },
                }}
            >
                <TypeBadge type={group.entityType} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Box sx={{ fontFamily: TITLE, fontSize: "11px", letterSpacing: "0.04em", color: "#ffffff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {group.entityTitle}
                    </Box>
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.4 }}>
                        <SealPill seal={group.seal} />
                        <WavePill wave={group.wave} />
                        <ArchetypePill archetype={group.archetype} collective={group.collective} />
                        {done && (
                            <Box component="span" sx={{ fontFamily: MONO, fontSize: "10.5px", color: counts.accepted ? "#3dd68c" : "#778899" }}>
                                {counts.accepted ? `✓ ${counts.accepted}/${counts.total}` : "✕ rechazado"}
                            </Box>
                        )}
                    </Box>
                </Box>
                {group.entityId && (
                    <CenterFocusStrongIcon titleAccess="Ver en el mapa" sx={{ fontSize: 16, color: focused ? UI_COLORS.anomaly : UI_COLORS.textSecondary }} />
                )}
                <Box
                    component="button"
                    type="button"
                    aria-label={open ? "Plegar" : "Desplegar"}
                    aria-expanded={open}
                    onClick={(event) => {
                        event.stopPropagation();
                        setOpen((v) => !v);
                    }}
                    sx={{ p: 0.25, border: 0, background: "none", cursor: "pointer", color: UI_COLORS.textSecondary, display: "grid" }}
                >
                    <ExpandMoreIcon sx={{ fontSize: 18, transition: "transform .2s", transform: open ? "rotate(180deg)" : "none" }} />
                </Box>
            </Box>
            <Collapse in={open} timeout={180} unmountOnExit>
                <Box sx={{ px: 1.25, pb: 1.1 }}>
                    <WhyToggle open={whyOpen} onToggle={() => setWhyOpen((v) => !v)} color={group.seal.color} label={`¿Por qué ${group.seal.label}?`} />
                    <Collapse in={whyOpen} timeout={160}>
                        <SealReasons seal={group.seal} />
                    </Collapse>
                    <Box sx={{ mt: 0.9 }}>
                        {group.items.map((item, i) => (
                            <ReviewItemRow
                                key={item.key}
                                item={item}
                                index={i}
                                decisions={decisions}
                                onDecide={onDecide}
                                canWrite={canWrite}
                            />
                        ))}
                        {!group.items.length && (
                            <Box sx={{ fontFamily: SANS, fontSize: "12px", color: UI_COLORS.textSecondary }}>Sin cambios propuestos.</Box>
                        )}
                    </Box>
                    <Box sx={{ mt: 0.9 }}>
                        <GroupActions counts={counts} canWrite={canWrite} onAccept={() => onAcceptGroup(group.key)} onReject={() => onRejectGroup(group.key)} />
                    </Box>
                </Box>
            </Collapse>
        </Box>
    );
}

/**
 * @param {{
 *   result: object,
 *   eventInstruction?: string,
 *   review: { groups: object[], items: object[] },
 *   decisions: Record<string, object>,
 *   counts: { total: number, pending: number, accepted: number, rejected: number, blocked: number },
 *   canWrite: boolean,
 *   onDecide: (key: string, action: string) => void,
 *   onAcceptGroup: (groupKey: string) => void,
 *   onRejectGroup: (groupKey: string) => void,
 *   onAcceptAll: () => void,
 *   onRejectAll: () => void,
 *   onFocus?: (entityId: string) => void,
 *   focusedEntityId?: string|null,
 *   onDiscard: () => void,
 * }} props
 */
export default function LabImpactReview({
    result,
    eventInstruction = "",
    review,
    decisions,
    counts,
    canWrite,
    onDecide,
    onAcceptGroup,
    onRejectGroup,
    onAcceptAll,
    onRejectAll,
    onFocus,
    focusedEntityId,
    onDiscard,
}) {
    const overall = explainOverallSeal(result);
    const [whyOpen, setWhyOpen] = useState(overall.grade !== "ok");
    const eventTitle = result.eventTitle?.trim() || eventInstruction.trim().slice(0, 120) || "Evento de mesa";
    const eventSummary = result.eventSummary?.trim() || eventInstruction.trim();
    const errors = result.errors || [];
    const missing = result.missingImpacts || [];

    return (
        <Box sx={{ ...CYBER_SCROLL_STYLE, color: "#ffffff" }} data-testid="lab-impact-review">
            <Box
                sx={{
                    ...rowIn,
                    p: "10px 12px",
                    mb: 1,
                    borderRadius: "7px",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderLeft: `3px solid ${UI_COLORS.accent}`,
                    background: "rgba(10,10,16,0.78)",
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                    <Kicker color={UI_COLORS.accent}>Evento de mesa</Kicker>
                    <Box
                        component="button"
                        type="button"
                        onClick={onDiscard}
                        disabled={counts.accepted > 0 && Object.values(decisions).some((d) => d.busy)}
                        sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                            px: "6px",
                            py: "2px",
                            border: "1px solid rgba(255,255,255,0.18)",
                            borderRadius: "4px",
                            background: "none",
                            color: UI_COLORS.textSecondary,
                            cursor: "pointer",
                            fontFamily: TITLE,
                            fontSize: "8.5px",
                            letterSpacing: "0.08em",
                            "&:hover": { color: "#ffffff", borderColor: "#ffffff" },
                        }}
                    >
                        <CloseIcon sx={{ fontSize: 12 }} />
                        {counts.accepted ? "Cerrar" : "Descartar"}
                    </Box>
                </Box>
                <Box sx={{ mt: 0.5, fontFamily: TITLE, fontSize: "12.5px", letterSpacing: "0.03em", color: "#ffffff", lineHeight: 1.35 }}>
                    {eventTitle}
                </Box>
                {eventSummary && eventSummary !== eventTitle && (
                    <Box sx={{ mt: 0.4, fontFamily: SANS, fontSize: "12px", color: "#cfcfd8", lineHeight: 1.45 }}>{eventSummary}</Box>
                )}
            </Box>

            <Box sx={{ ...rowIn, animationDelay: "40ms", p: "10px 12px", mb: 1, borderRadius: "7px", border: `1px solid ${overall.color}55`, background: `${overall.color}0f` }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
                    <SealPill seal={overall} />
                    <Box sx={{ fontFamily: MONO, fontSize: "11px", color: "#ffffff" }}>
                        cobertura {overall.pct}% · confianza {overall.conf}
                    </Box>
                </Box>
                <Box sx={{ mt: 0.6 }}>
                    <WhyToggle open={whyOpen} onToggle={() => setWhyOpen((v) => !v)} color={overall.color} label={`¿Por qué ${overall.label.replace("GRADE ", "")}?`} />
                </Box>
                <Collapse in={whyOpen} timeout={160}>
                    <SealReasons seal={overall} />
                    <Box sx={{ mt: 0.6, fontFamily: SANS, fontSize: "11px", color: UI_COLORS.textSecondary, lineHeight: 1.45 }}>
                        Cada ficha lleva su propio sello: OK si existe y todos sus cambios pasan; WARN si hay cambios bloqueados, reparados o confianza media; FAIL si la ficha no existe o nada pasó.
                    </Box>
                </Collapse>
                {errors.length > 0 && (
                    <Box sx={{ mt: 0.75 }}>
                        {errors.slice(0, 4).map((err, i) => (
                            <Box key={i} sx={{ fontFamily: SANS, fontSize: "11.5px", color: "#ff8095", lineHeight: 1.4 }}>⚠ {err}</Box>
                        ))}
                    </Box>
                )}
                {missing.length > 0 && (
                    <Box sx={{ mt: 0.5, fontFamily: SANS, fontSize: "11.5px", color: "#f5c542", lineHeight: 1.4 }}>
                        Sin reacción para: {missing.join(", ")}.
                    </Box>
                )}
            </Box>

            <Box sx={{ ...rowIn, animationDelay: "80ms", p: "10px 12px", mb: 1.25, borderRadius: "7px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(10,10,16,0.72)" }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 0.6 }}>
                    <Kicker>Revisión del DM</Kicker>
                    <Box sx={{ fontFamily: MONO, fontSize: "11px", color: "#ffffff" }}>
                        <Box component="span" sx={{ color: "#3dd68c" }}>{counts.accepted}✓</Box>
                        {" · "}
                        <Box component="span" sx={{ color: "#9aa8b6" }}>{counts.rejected}✕</Box>
                        {" · "}
                        {counts.pending} por decidir
                        {counts.blocked ? ` · ${counts.blocked} bloq.` : ""}
                    </Box>
                </Box>
                <ProgressBar counts={counts} />
                <Box sx={{ mt: 0.9, display: "flex", gap: 0.6, flexWrap: "wrap" }}>
                    <GroupActions
                        counts={counts}
                        canWrite={canWrite}
                        onAccept={onAcceptAll}
                        onReject={onRejectAll}
                    />
                </Box>
                <Box sx={{ mt: 0.75, fontFamily: SANS, fontSize: "11px", color: UI_COLORS.textSecondary, lineHeight: 1.45 }}>
                    {canWrite
                        ? "Aceptar escribe al instante y suma el cambio al bloque Neural Lab de la ficha (visible en el Codex). Puedes deshacerlo mientras este resultado siga abierto; después, edítalo o bórralo desde la ficha."
                        : "Vista de solo lectura: solo el DM con el Lore enlazado aplica cambios."}
                </Box>
                <Box sx={{ mt: 0.75, display: "flex", gap: 1.25, flexWrap: "wrap", fontFamily: SANS, fontSize: "10.5px", color: UI_COLORS.textSecondary }}>
                    <span><b style={{ color: "#f5c542" }}>+3</b> delta del vínculo</span>
                    <span><b style={{ color: UI_COLORS.anomaly }}>╌╌</b> vínculo nuevo propuesto</span>
                    <span><b style={{ color: "#3dd68c" }}>✓</b> aceptado</span>
                    <span><b style={{ color: "#9aa8b6" }}>✕</b> rechazado</span>
                </Box>
            </Box>

            {review.groups.length === 0 && (
                <Box sx={{ p: 1.25, borderRadius: "7px", border: "1px solid rgba(255,255,255,0.1)", fontFamily: SANS, fontSize: "12px", color: UI_COLORS.textSecondary }}>
                    No hay reacciones. Reintenta con un evento más concreto o revisa que el ancla tenga vecinos.
                </Box>
            )}
            {[...review.groups].sort((a, b) => {
                const blocked = (group) => group.items.some((item) => !item.valid && !item.advisory);
                return Number(blocked(b)) - Number(blocked(a));
            }).map((group, index) => (
                <GroupCard
                    key={group.key}
                    index={index}
                    group={group}
                    decisions={decisions}
                    onDecide={onDecide}
                    onAcceptGroup={onAcceptGroup}
                    onRejectGroup={onRejectGroup}
                    onFocus={onFocus}
                    focused={Boolean(group.entityId) && group.entityId === focusedEntityId}
                    canWrite={canWrite}
                />
            ))}
        </Box>
    );
}
