/**
 * WikiCascadeResult.jsx
 *
 * Renders the result of a CASCADE (Onda catalizadora) AI generation.
 * Displays impacts grouped by wave, with:
 *   - Entity chip + archetype badge
 *   - Emotional reaction (short text)
 *   - Narrative hook (expandable)
 *   - Proposed relation changes (apply individually)
 *   - Confidence chip per impact
 *   - Blocked suggestions
 *
 * Based on PANGeA (Buongiorno et al., 2024): the wave structure and archetype
 * badges give the DJ full trazability from "why this character reacted" to the
 * specific graph path that connects them to the anchor.
 *
 * BACKLOG: re-enable proposed historical event UI (CREATE EVENTO EN TIMELINE)
 * when the timeline flow is less confusing for cascade review.
 */

import { useState, useCallback, useEffect } from "react";
import {
    Box, Button, Chip, Collapse, Dialog, DialogActions,
    DialogContent, DialogContentText, DialogTitle,
    Divider, IconButton, TextField, Tooltip, CircularProgress,
} from "@mui/material";
import ExpandMoreIcon         from "@mui/icons-material/ExpandMore";
import ExpandLessIcon         from "@mui/icons-material/ExpandLess";
import AddCircleOutlineIcon   from "@mui/icons-material/AddCircleOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import EditIcon               from "@mui/icons-material/Edit";
import StickyNote2Icon        from "@mui/icons-material/StickyNote2";
import ErrorOutlineIcon       from "@mui/icons-material/ErrorOutline";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import WavesIcon              from "@mui/icons-material/Waves";
import EventIcon              from "@mui/icons-material/Event";
import BlockIcon              from "@mui/icons-material/Block";
import { useDispatch, useSelector } from "react-redux";
import { CyberTitle, CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { Z_INDEX } from "../../constants/designSystem";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import { REACTION_ARCHETYPE_LABELS, REACTION_ARCHETYPE_TOOLTIPS } from "../../constants/wiki/entityFieldSchemas";
import { WIKI_RELATION_TYPE_LABELS } from "../../constants/wikiRelationTypes";
import { addWikiRelation, updateWikiRelation, removeWikiRelation, saveWikiEntity } from "../../store/wikiSlice";
import { showSnackbar } from "../../store/uiSlice";
import { applyProposedWikiEvent } from "../../utils/applyProposedWikiEvent";
import { applyProposedImpact } from "../../utils/applyProposedImpact";
import {
    buildAiImpactBlockBody,
    normalizeCollectiveImpactForApply,
} from "../../utils/aiImpactBlocks";
import { NARRATIVE_STATE_LABELS } from "../../constants/wiki/entityFieldSchemas";
import {
    enrichRelationStrengthChange,
    formatStrengthChangeLabel,
} from "../../utils/resolveRelationStrengthChange";
import {
    gradeImpactSeal,
    buildSealGradeFromCascadeResult,
    sealGradeColor,
    sealGradeLabel,
} from "../../utils/impactSealGrade";
import {
    clampRelationStrength,
    WIKI_RELATION_STRENGTH_MIN,
    WIKI_RELATION_STRENGTH_MAX,
} from "../../../firebase/services/wikiRelationService";
import { impactEntityIdOf } from "./CascadeImpactPopover";

/** Hidden for now — cascade review focuses on impacts/relations only. */
const SHOW_PROPOSED_HISTORICAL_EVENT = false;

// ── Constants ─────────────────────────────────────────────────────────────────

const CONFIDENCE_COLORS = {
    alta:  UI_COLORS.anomaly,
    media: "#ffa726",
    baja:  UI_COLORS.accentStrong,
};

const SEAL_COLORS = {
    ok:   "#3dd68c",
    warn: "#f5c542",
    fail: "#ff3355",
};

const SEAL_TOOLTIPS = {
    ok:   "Sello OK: impacto válido, cambios coherentes, confidence alta.",
    warn: "Sello WARN: conf media/baja, reparaciones o algún cambio inválido.",
    fail: "Sello FAIL: entidad inválida, fallecido/estructural, o cambios rechazados.",
};

const CONFIDENCE_TOOLTIPS = {
    alta:  "La IA ancló esta reacción en relaciones reales del subgrafo.",
    media: "Reacción coherente, pero con inferencias fuera del grafo.",
    baja:  "Entidades o relaciones no verificadas; revisar antes de aplicar.",
};

const WAVE_COLORS = [
    UI_COLORS.accent,     // wave 0 — anchor
    UI_COLORS.anomaly,    // wave 1
    "#ffa726",            // wave 2
    UI_COLORS.textSecondary, // wave 3
];

const ARCHETYPE_COLORS = {
    guardian:   "#4fc3f7",
    politico:   "#ce93d8",
    intimo:     "#f48fb1",
    rival:      "#ef9a9a",
    pragmatico: "#80cbc4",
};

const KIND_ICONS = {
    relation_add:         <AddCircleOutlineIcon sx={{ fontSize: "0.85rem" }} />,
    relation_remove:      <RemoveCircleOutlineIcon sx={{ fontSize: "0.85rem" }} />,
    relation_update:      <EditIcon sx={{ fontSize: "0.85rem" }} />,
    entity_state_update:  <CheckCircleOutlineIcon sx={{ fontSize: "0.85rem" }} />,
    dm_note:              <StickyNote2Icon sx={{ fontSize: "0.85rem" }} />,
};

const KIND_LABELS = {
    relation_add:         "Añadir relación",
    relation_remove:      "Eliminar relación",
    relation_update:      "Actualizar relación",
    entity_state_update:  "Actualizar estado narrativo",
    dm_note:              "Nota DM",
};

const tooltipSlotProps = {
    tooltip: {
        sx: {
            maxWidth: 260,
            fontSize: "0.7rem",
            fontFamily: "'Fira Sans', sans-serif",
            bgcolor: UI_COLORS.backgroundPrimary,
            color: UI_COLORS.textPrimary,
            border: `1px solid ${UI_COLORS.border}`,
        },
    },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function ArchetypeBadge({ archetype }) {
    if (!archetype) return null;
    const label = REACTION_ARCHETYPE_LABELS[archetype];
    if (!label) return null;
    const color = ARCHETYPE_COLORS[archetype] ?? UI_COLORS.textSecondary;
    const tip   = REACTION_ARCHETYPE_TOOLTIPS[archetype] ?? "";
    return (
        <Tooltip title={tip ? `Arquetipo: ${tip}` : "Arquetipo de reacción"} slotProps={tooltipSlotProps}>
            <Chip
                label={label}
                size="small"
                sx={{
                    height: 17,
                    fontSize: "0.58rem",
                    fontFamily: "'Fira Sans', sans-serif",
                    bgcolor: `${color}18`,
                    color,
                    border: `1px solid ${color}44`,
                    cursor: "help",
                    "& .MuiChip-label": { px: 0.75 },
                }}
            />
        </Tooltip>
    );
}

/**
 * Build editable strength rows for the review dialog (AI defaults).
 * @param {object} impact
 * @param {object[]} relations
 */
function buildStrengthDrafts(impact, relations = []) {
    const rows = [];
    (impact?.resolvedChanges ?? []).forEach((ch, index) => {
        if (!ch?.valid) return;
        if (ch.kind !== "relation_add" && ch.kind !== "relation_update") return;
        const enriched = enrichRelationStrengthChange(ch, relations);
        rows.push({
            index,
            kind: enriched.kind,
            fromTitle: enriched.fromEntityTitle ?? "?",
            toTitle: enriched.toEntityTitle ?? "?",
            relationType: enriched.relationType,
            currentStrength: enriched.currentStrength,
            proposedStrength: enriched.proposedStrength ?? 0,
            include: true,
        });
    });
    return rows;
}

/**
 * Apply DM strength edits onto a cloned impact before persist.
 * Absolute peso in the UI → strengthDelta semantics expected by enrich/apply.
 */
function impactWithStrengthDrafts(impact, strengthDrafts = []) {
    if (!impact || !strengthDrafts.length) return impact;
    const byIndex = new Map(strengthDrafts.map((d) => [d.index, d]));
    const resolvedChanges = (impact.resolvedChanges ?? []).map((ch, index) => {
        const draft = byIndex.get(index);
        if (!draft) return ch;
        if (!draft.include) {
            return { ...ch, valid: false, validationError: "Omitido por el DM en revisión" };
        }
        const peso = clampRelationStrength(draft.proposedStrength);
        if (ch.kind === "relation_add") {
            return { ...ch, strengthDelta: peso };
        }
        if (ch.kind === "relation_update") {
            const current = draft.currentStrength ?? 0;
            return { ...ch, strengthDelta: peso - current };
        }
        return ch;
    });
    return { ...impact, resolvedChanges };
}

function StrengthBadge({ change }) {
    const label = formatStrengthChangeLabel(change);
    if (!label) return null;
    const delta = change.strengthDeltaResolved;
    const noChange = delta === 0
        || (change.currentStrength != null
            && change.proposedStrength != null
            && change.currentStrength === change.proposedStrength);
    const up = typeof delta === "number" && delta > 0;
    const down = typeof delta === "number" && delta < 0;
    const color = noChange
        ? UI_COLORS.textSecondary
        : up
            ? UI_COLORS.anomaly
            : down
                ? UI_COLORS.accentStrong
                : UI_COLORS.anomaly;

    return (
        <Chip
            label={label}
            size="small"
            sx={{
                height: 18,
                mt: 0.35,
                fontSize: "0.58rem",
                fontFamily: "'Orbitron', sans-serif",
                letterSpacing: 0.4,
                bgcolor: `${color}18`,
                color,
                border: `1px solid ${color}55`,
                "& .MuiChip-label": { px: 0.75 },
            }}
        />
    );
}

function ChangeRow({ change, applying, onApply, applied = false }) {
    const relLabel = change.relationType
        ? (WIKI_RELATION_TYPE_LABELS[change.relationType] ?? change.relationType)
        : null;
    const isRelation = change.kind === "relation_add"
        || change.kind === "relation_update"
        || change.kind === "relation_remove";
    const stateLabel = change.kind === "entity_state_update" && change.field === "narrativeState"
        ? (NARRATIVE_STATE_LABELS[change.newValue] ?? change.newValue)
        : change.newValue;

    const canApply = change.valid && change.kind !== "dm_note" && !applied;

    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "flex-start",
                gap: 0.75,
                py: 0.5,
                px: 0.75,
                borderRadius: 0.5,
                bgcolor: change.valid
                    ? `${UI_COLORS.backgroundPrimary}88`
                    : `${UI_COLORS.accentStrong}0a`,
                border: `1px solid ${change.valid ? UI_COLORS.border : `${UI_COLORS.accentStrong}44`}`,
                mb: 0.5,
                opacity: applied ? 0.72 : 1,
            }}
        >
            <Box sx={{ color: change.valid ? UI_COLORS.anomaly : UI_COLORS.accentStrong, mt: 0.25 }}>
                {KIND_ICONS[change.kind] ?? <EditIcon sx={{ fontSize: "0.85rem" }} />}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <CyberText sx={{ fontSize: "0.62rem", color: UI_COLORS.textSecondary, letterSpacing: 0.6, mb: 0.15 }}>
                    {KIND_LABELS[change.kind] ?? change.kind}
                </CyberText>
                <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.textPrimary, lineHeight: 1.4 }}>
                    {change.kind === "dm_note" ? (
                        <em style={{ color: UI_COLORS.textSecondary }}>{change.noteText}</em>
                    ) : change.kind === "entity_state_update" ? (
                        <>
                            <strong>{change.fromEntityTitle}</strong>
                            <span style={{ color: UI_COLORS.textSecondary }}>
                                {" · "}{change.field || "(campo?)"}{": "}
                            </span>
                            <strong style={{ color: UI_COLORS.anomaly }}>{stateLabel || "—"}</strong>
                        </>
                    ) : (
                        <>
                            <strong>{change.fromEntityTitle || "?"}</strong>
                            <span style={{ color: UI_COLORS.textSecondary }}>
                                {" → ["}{relLabel || "sin tipo"}{"] → "}
                            </span>
                            <strong>{change.toEntityTitle || "?"}</strong>
                            {change.newLabel && (
                                <span style={{ color: UI_COLORS.textSecondary }}>
                                    {" · \"" + change.newLabel + "\""}
                                </span>
                            )}
                        </>
                    )}
                </CyberText>
                {isRelation && <StrengthBadge change={change} />}
                <CyberText sx={{ fontSize: "0.65rem", color: UI_COLORS.textSecondary, mt: 0.25 }}>
                    {change.reason}
                </CyberText>
                {change.validationError && (
                    <CyberText sx={{ fontSize: "0.65rem", color: UI_COLORS.accentStrong, mt: 0.2 }}>
                        ✗ {change.validationError}
                    </CyberText>
                )}
            </Box>
            {applied ? (
                <Chip
                    label="Aplicado"
                    size="small"
                    sx={{
                        height: 18,
                        fontSize: "0.52rem",
                        color: "#4ade80",
                        border: "1px solid rgba(74,222,128,0.45)",
                        bgcolor: "rgba(74,222,128,0.08)",
                        "& .MuiChip-label": { px: 0.6 },
                    }}
                />
            ) : canApply ? (
                <Button
                    size="small"
                    variant="outlined"
                    disabled={applying}
                    onClick={() => onApply(change)}
                    sx={{
                        fontSize: "0.55rem",
                        fontFamily: "'Orbitron', sans-serif",
                        letterSpacing: 0.5,
                        borderColor: UI_COLORS.accent,
                        color: UI_COLORS.accent,
                        py: 0.15,
                        px: 0.75,
                        minWidth: 0,
                        flexShrink: 0,
                        "&:hover": { bgcolor: `${UI_COLORS.accent}12` },
                    }}
                >
                    Aplicar
                </Button>
            ) : null}
        </Box>
    );
}

function QueueImpactRow({
    impact,
    applied = false,
    selected = false,
    onFocus,
}) {
    const seal = gradeImpactSeal(impact);
    const sealColor = sealGradeColor(seal);
    const reaction = impact.emotionalReaction || impact.collectiveReaction || "—";
    const failHint = seal === "fail"
        ? (impact.validationErrors?.[0]
            || impact.resolvedChanges?.find((c) => !c.valid)?.validationError
            || null)
        : null;

    return (
        <Box
            role="button"
            tabIndex={0}
            onClick={() => onFocus?.(impact)}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onFocus?.(impact);
                }
            }}
            sx={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 0.45,
                alignItems: "center",
                px: 0.85,
                py: 0.7,
                mb: 0.4,
                borderRadius: "6px",
                border: selected
                    ? `1px solid ${UI_COLORS.accentStrong}66`
                    : "1px solid transparent",
                bgcolor: selected ? `${UI_COLORS.accentStrong}14` : "transparent",
                cursor: "pointer",
                opacity: applied ? 0.65 : 1,
                "&:hover": {
                    borderColor: `${UI_COLORS.accentStrong}55`,
                    bgcolor: `${UI_COLORS.accentStrong}10`,
                },
            }}
        >
            <Box sx={{ minWidth: 0 }}>
                <CyberTitle
                    sx={{
                        fontSize: "0.68rem",
                        color: UI_COLORS.textPrimary,
                        letterSpacing: 0.3,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {impact.entityTitle || "—"}
                </CyberTitle>
                <CyberText
                    sx={{
                        fontSize: "0.62rem",
                        color: UI_COLORS.textSecondary,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        mt: 0.15,
                    }}
                >
                    {reaction}
                </CyberText>
                {failHint ? (
                    <CyberText
                        sx={{
                            fontSize: "0.52rem",
                            color: sealColor,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            mt: 0.2,
                        }}
                        title={failHint}
                    >
                        {failHint}
                    </CyberText>
                ) : null}
            </Box>
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.35 }}>
                <Chip
                    label={sealGradeLabel(seal)}
                    size="small"
                    sx={{
                        height: 16,
                        fontSize: "0.45rem",
                        fontFamily: "'Orbitron', sans-serif",
                        letterSpacing: "0.06em",
                        color: sealColor,
                        border: `1px solid ${sealColor}88`,
                        bgcolor: `${sealColor}18`,
                        "& .MuiChip-label": { px: 0.5 },
                    }}
                />
                {applied ? (
                    <CyberText sx={{ fontSize: "0.5rem", color: UI_COLORS.boon, fontFamily: "'Orbitron', sans-serif" }}>
                        APLICADO
                    </CyberText>
                ) : (
                    <CyberText sx={{ fontSize: "0.5rem", color: UI_COLORS.textSecondary, fontFamily: "'Orbitron', sans-serif" }}>
                        PENDIENTE
                    </CyberText>
                )}
            </Box>
        </Box>
    );
}

function ImpactCard({
    impact,
    applying,
    onApplyChange,
    onApplyImpact,
    relations = [],
    applied = false,
    appliedChangeKeys = new Set(),
    changeKeyFn,
}) {
    const [expanded, setExpanded] = useState(false);
    const wave  = impact.wave ?? 1;
    const waveColor = WAVE_COLORS[wave] ?? UI_COLORS.textSecondary;
    const conf  = impact.confidence ?? "media";
    const seal  = gradeImpactSeal(impact);
    const sealColor = sealGradeColor(seal);
    const enrichedChanges = (impact.resolvedChanges ?? []).map((ch) =>
        enrichRelationStrengthChange(ch, relations)
    );
    const validChanges = enrichedChanges.filter((c) => c.valid && c.kind !== "dm_note");
    const hasPersonalityShift = Boolean(impact.personalityShift?.to);
    const canApplyImpact = !applied
        && Boolean(impact.entityResolved)
        && (validChanges.length > 0
            || hasPersonalityShift
            || Boolean(impact.emotionalReaction?.trim())
            || Boolean(impact.collectiveReaction?.trim()));

    return (
        <Box
            sx={{
                border: `1px solid ${UI_COLORS.border}`,
                borderLeft: `3px solid ${waveColor}`,
                borderRadius: 1,
                mb: 1,
                bgcolor: `${UI_COLORS.backgroundPrimary}bb`,
                overflow: "hidden",
                opacity: applied ? 0.85 : 1,
            }}
        >
            {/* Compact queue row */}
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 0.5,
                    alignItems: "center",
                    px: 1.1,
                    py: 0.85,
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        minWidth: 0,
                        cursor: "pointer",
                    }}
                    onClick={() => setExpanded((v) => !v)}
                >
                    <CyberTitle
                        sx={{
                            fontSize: "0.7rem",
                            color: waveColor,
                            letterSpacing: 0.4,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            flex: 1,
                            minWidth: 0,
                        }}
                    >
                        {impact.entityTitle}
                    </CyberTitle>
                    {!impact.valid && (
                        <Tooltip title={impact.validationErrors?.join(" | ")} slotProps={tooltipSlotProps}>
                            <ErrorOutlineIcon sx={{ fontSize: "0.9rem", color: UI_COLORS.accentStrong, flexShrink: 0 }} />
                        </Tooltip>
                    )}
                    <Tooltip title={SEAL_TOOLTIPS[seal]} slotProps={tooltipSlotProps}>
                        <Chip
                            label={sealGradeLabel(seal)}
                            size="small"
                            sx={{
                                height: 18,
                                fontSize: "0.5rem",
                                fontFamily: "'Orbitron', sans-serif",
                                letterSpacing: "0.08em",
                                color: sealColor,
                                border: `1px solid ${sealColor}88`,
                                bgcolor: `${sealColor}18`,
                                flexShrink: 0,
                                "& .MuiChip-label": { px: 0.55 },
                            }}
                        />
                    </Tooltip>
                    <IconButton size="small" sx={{ color: UI_COLORS.textSecondary, p: 0.2, flexShrink: 0 }}>
                        {expanded
                            ? <ExpandLessIcon sx={{ fontSize: "1rem" }} />
                            : <ExpandMoreIcon sx={{ fontSize: "1rem" }} />}
                    </IconButton>
                </Box>
                <Box sx={{ display: "flex", gap: 0.4, flexShrink: 0 }}>
                    {applied ? (
                        <Chip
                            label="Aplicado"
                            size="small"
                            sx={{
                                height: 20,
                                fontSize: "0.52rem",
                                color: "#4ade80",
                                border: "1px solid rgba(74,222,128,0.45)",
                                bgcolor: "rgba(74,222,128,0.08)",
                                "& .MuiChip-label": { px: 0.6 },
                            }}
                        />
                    ) : (
                        <Button
                            size="small"
                            variant="outlined"
                            disabled={applying || !canApplyImpact}
                            onClick={(e) => {
                                e.stopPropagation();
                                onApplyImpact?.(impact);
                            }}
                            sx={{
                                fontSize: "0.52rem",
                                fontFamily: "'Orbitron', sans-serif",
                                letterSpacing: 0.4,
                                borderColor: UI_COLORS.accent,
                                color: UI_COLORS.accent,
                                py: 0.2,
                                px: 0.85,
                                minWidth: 0,
                                bgcolor: `${UI_COLORS.accent}10`,
                                "&:hover": { bgcolor: `${UI_COLORS.accent}18` },
                                "&:disabled": { borderColor: UI_COLORS.border, color: UI_COLORS.textSecondary },
                            }}
                        >
                            Aplicar
                        </Button>
                    )}
                </Box>

                <CyberText
                    sx={{
                        gridColumn: "1 / -1",
                        fontSize: "0.72rem",
                        color: UI_COLORS.textSecondary,
                        lineHeight: 1.35,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {impact.emotionalReaction || "—"}
                </CyberText>

                <Box sx={{ gridColumn: "1 / -1", display: "flex", gap: 0.4, flexWrap: "wrap", alignItems: "center" }}>
                    <ArchetypeBadge archetype={impact.reactionArchetype} />
                    <Tooltip title={CONFIDENCE_TOOLTIPS[conf]} slotProps={tooltipSlotProps}>
                        <Chip
                            label={conf}
                            size="small"
                            sx={{
                                height: 16,
                                fontSize: "0.52rem",
                                bgcolor: `${CONFIDENCE_COLORS[conf]}22`,
                                color: CONFIDENCE_COLORS[conf],
                                border: `1px solid ${CONFIDENCE_COLORS[conf]}44`,
                                cursor: "help",
                                "& .MuiChip-label": { px: 0.55 },
                            }}
                        />
                    </Tooltip>
                    {validChanges.length > 0 && (
                        <Chip
                            label={`${validChanges.length} cambio${validChanges.length > 1 ? "s" : ""}`}
                            size="small"
                            sx={{
                                height: 16,
                                fontSize: "0.52rem",
                                bgcolor: `${UI_COLORS.anomaly}18`,
                                color: UI_COLORS.anomaly,
                                "& .MuiChip-label": { px: 0.55 },
                            }}
                        />
                    )}
                </Box>
            </Box>

            <Collapse in={expanded}>
                <Box sx={{ px: 1.1, pb: 1, pt: 0.25, borderTop: `1px solid ${UI_COLORS.border}` }}>
                    {impact.narrativeHook && (
                        <Box
                            sx={{
                                mb: 1,
                                p: 0.75,
                                bgcolor: `${waveColor}0a`,
                                border: `1px solid ${waveColor}22`,
                                borderRadius: 0.75,
                            }}
                        >
                            <CyberText sx={{ fontSize: "0.65rem", color: UI_COLORS.textSecondary, mb: 0.25, letterSpacing: 1 }}>
                                GANCHO NARRATIVO
                            </CyberText>
                            <CyberText sx={{ fontSize: "0.73rem", color: UI_COLORS.textPrimary }}>
                                {impact.narrativeHook}
                            </CyberText>
                        </Box>
                    )}

                    {impact.justificationPath && (
                        <CyberText sx={{ fontSize: "0.63rem", color: UI_COLORS.textSecondary, mb: 1, fontStyle: "italic" }}>
                            Ruta: {impact.justificationPath}
                        </CyberText>
                    )}

                    {hasPersonalityShift && (
                        <Box
                            sx={{
                                mb: 1,
                                p: 0.75,
                                bgcolor: `${UI_COLORS.anomaly}0a`,
                                border: `1px solid ${UI_COLORS.anomaly}22`,
                                borderRadius: 0.75,
                            }}
                        >
                            <CyberText sx={{ fontSize: "0.65rem", color: UI_COLORS.textSecondary, mb: 0.25, letterSpacing: 1 }}>
                                CAMBIO DE ESTADO NARRATIVO
                            </CyberText>
                            <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.textPrimary }}>
                                <span style={{ color: UI_COLORS.textSecondary }}>
                                    {NARRATIVE_STATE_LABELS[impact.personalityShift.from] ?? impact.personalityShift.from}
                                </span>
                                {" → "}
                                <strong style={{ color: UI_COLORS.anomaly }}>
                                    {NARRATIVE_STATE_LABELS[impact.personalityShift.to] ?? impact.personalityShift.to}
                                </strong>
                            </CyberText>
                            <CyberText sx={{ fontSize: "0.65rem", color: UI_COLORS.textSecondary, mt: 0.25 }}>
                                {impact.personalityShift.reason}
                            </CyberText>
                        </Box>
                    )}

                    {enrichedChanges.length > 0 && (
                        <Box>
                            <CyberText sx={{ fontSize: "0.65rem", color: UI_COLORS.textSecondary, mb: 0.5, letterSpacing: 1 }}>
                                CAMBIOS PROPUESTOS ({enrichedChanges.length})
                            </CyberText>
                            {enrichedChanges.map((ch, i) => (
                                <ChangeRow
                                    key={i}
                                    change={ch}
                                    applying={applying}
                                    onApply={onApplyChange}
                                    applied={appliedChangeKeys.has(changeKeyFn?.(ch) ?? `${i}`)}
                                />
                            ))}
                        </Box>
                    )}

                    {canApplyImpact && (
                        <Button
                            size="small"
                            variant="outlined"
                            disabled={applying}
                            fullWidth
                            onClick={() => onApplyImpact?.(impact)}
                            sx={{
                                mt: 0.75,
                                fontSize: "0.6rem",
                                fontFamily: "'Orbitron', sans-serif",
                                letterSpacing: 0.5,
                                borderColor: `${UI_COLORS.anomaly}88`,
                                color: UI_COLORS.anomaly,
                                py: 0.35,
                                "&:hover": { bgcolor: `${UI_COLORS.anomaly}12` },
                            }}
                        >
                            Revisar y aplicar
                        </Button>
                    )}
                </Box>
            </Collapse>
        </Box>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * @param {{
 *   result:           object,
 *   campaignId:       string,
 *   eventInstruction?: string,
 *   onEntityClick?:   (id:string)=>void,
 *   presentation?:    "inline"|"queue",
 *   onFocusImpact?:   (entityId: string, impact: object) => void,
 *   focusedImpactEntityId?: string|null,
 *   pendingReviewEntityId?: string|null,
 *   pendingReviewNonce?: number|null,
 * }} props
 */
export default function WikiCascadeResult({
    result,
    campaignId,
    eventInstruction,
    onEntityClick,
    presentation = "inline",
    onFocusImpact,
    focusedImpactEntityId = null,
    pendingReviewEntityId = null,
    pendingReviewNonce = null,
}) {
    const dispatch  = useDispatch();
    const uid       = useSelector((s) => s.player.profile?.uid);
    const relations = useSelector((s) => s.wiki.relations ?? []);
    const entities  = useSelector((s) => s.wiki.entities ?? []);
    const narrativeSettings = useSelector((s) => s.wiki.narrativeSettings ?? {});

    const [applying, setApplying] = useState(false);
    const [confirmChange, setConfirmChange] = useState(null);
    const [confirmCreateEvent, setConfirmCreateEvent] = useState(false);
    const [creatingEvent, setCreatingEvent] = useState(false);
    /** @type {[{ impact: object, draftBody: string }|null, Function]} */
    const [impactReview, setImpactReview] = useState(null);
    const [appliedImpactKeys, setAppliedImpactKeys] = useState(() => new Set());
    const [appliedChangeKeys, setAppliedChangeKeys] = useState(() => new Set());

    const changeKeyOf = useCallback((change) => {
        return [
            change?.kind ?? "?",
            change?.fromEntityTitle ?? "",
            change?.toEntityTitle ?? "",
            change?.relationType ?? change?.field ?? "",
            change?.newValue ?? "",
            change?.noteText ?? "",
        ].join("|");
    }, []);

    const impactKeyOf = useCallback((impact) => {
        return `${impact?.entityId ?? ""}::${impact?.entityTitle ?? ""}::${impact?.wave ?? 0}`;
    }, []);

    useEffect(() => {
        setAppliedImpactKeys(new Set());
        setAppliedChangeKeys(new Set());
    }, [result?.eventTitle, result?.summary, result?.impacts?.length]);

    const handleApplyChange = useCallback(async (change) => {
        if (!change.valid || !campaignId) return;
        setApplying(true);
        try {
            const enriched = enrichRelationStrengthChange(change, relations);
            if (enriched.kind === "relation_add" || enriched.kind === "relation_update") {
                if (!enriched.relationType) {
                    dispatch(showSnackbar({
                        message: "No se puede aplicar: falta el tipo de relación.",
                        severity: "warning",
                    }));
                    return;
                }
                const fromEntityId = enriched.resolvedEndpoints?.fromEntityId ?? enriched.fromEntity?.id;
                const toEntityId = enriched.resolvedEndpoints?.toEntityId ?? enriched.toEntity?.id;
                const strengthLabel = formatStrengthChangeLabel(enriched) ?? "";
                if (enriched.existingRelationId) {
                    await dispatch(updateWikiRelation({
                        campaignId,
                        relationId: enriched.existingRelationId,
                        data: {
                            strength: enriched.proposedStrength,
                            ...(enriched.newLabel != null ? { label: enriched.newLabel } : {}),
                        },
                    })).unwrap();
                } else {
                    await dispatch(addWikiRelation({
                        campaignId,
                        uid,
                        data: {
                            fromEntityId,
                            toEntityId,
                            relationType: enriched.relationType,
                            label: enriched.newLabel ?? "",
                            strength: enriched.proposedStrength,
                        },
                    })).unwrap();
                }
                dispatch(showSnackbar({
                    message: `Relación: ${enriched.fromEntityTitle} → ${enriched.toEntityTitle} · ${strengthLabel}`,
                    severity: "success",
                }));
                setAppliedChangeKeys((prev) => new Set(prev).add(changeKeyOf(enriched)));
            } else if (enriched.kind === "relation_remove") {
                if (!enriched.existingRelationId) {
                    dispatch(showSnackbar({ message: "Relación no encontrada en el wiki.", severity: "warning" }));
                } else {
                    await dispatch(removeWikiRelation({
                        campaignId,
                        relationId: enriched.existingRelationId,
                    })).unwrap();
                    dispatch(showSnackbar({
                        message: `Relación eliminada: ${enriched.fromEntityTitle} → ${enriched.toEntityTitle}`,
                        severity: "success",
                    }));
                    setAppliedChangeKeys((prev) => new Set(prev).add(changeKeyOf(enriched)));
                }
            } else if (enriched.kind === "entity_state_update") {
                const targetEntity = enriched.fromEntity ?? entities.find((e) => e.title === enriched.fromEntityTitle);
                if (!targetEntity) {
                    dispatch(showSnackbar({ message: `Entidad "${enriched.fromEntityTitle}" no encontrada.`, severity: "warning" }));
                    return;
                }
                const { mergeCustomFields } = await import("../../utils/wikiCustomFields.js");
                const updatedCf = mergeCustomFields(targetEntity.customFields ?? {}, targetEntity.entityType, {
                    [enriched.field]: enriched.newValue,
                });
                await dispatch(saveWikiEntity({
                    campaignId, entityId: targetEntity.id, uid,
                    data: { ...targetEntity, customFields: updatedCf },
                })).unwrap();
                const label = NARRATIVE_STATE_LABELS[enriched.newValue] ?? enriched.newValue;
                dispatch(showSnackbar({ message: `Estado de ${enriched.fromEntityTitle} → ${label}`, severity: "success" }));
                setAppliedChangeKeys((prev) => new Set(prev).add(changeKeyOf(enriched)));
            }
        } catch (err) {
            dispatch(showSnackbar({ message: `Error: ${err.message}`, severity: "error" }));
        } finally {
            setApplying(false);
            setConfirmChange(null);
        }
    }, [campaignId, uid, relations, entities, dispatch, changeKeyOf]);

    const openImpactReview = useCallback((impact) => {
        if (!impact) return;
        const draftBody = buildAiImpactBlockBody(impact);
        const strengthDrafts = buildStrengthDrafts(impact, relations);
        setImpactReview({ impact, draftBody, strengthDrafts });
    }, [relations]);

    // External review request (popover REVISAR from RED map).
    useEffect(() => {
        if (!pendingReviewNonce || !pendingReviewEntityId || !result) return;
        const match = (i) => impactEntityIdOf(i) === pendingReviewEntityId;
        const person = (result.impacts ?? []).find(match);
        if (person) {
            openImpactReview(person);
            return;
        }
        const collective = (result.collectiveImpacts ?? []).find(match);
        if (collective) {
            openImpactReview(normalizeCollectiveImpactForApply(collective));
        }
    }, [pendingReviewNonce, pendingReviewEntityId, result, openImpactReview]);

    const handleApplyImpact = useCallback(async (impact, blockBodyOverride = null, strengthDrafts = null) => {
        if (!campaignId) return;
        setApplying(true);
        try {
            const patched = strengthDrafts?.length
                ? impactWithStrengthDrafts(impact, strengthDrafts)
                : impact;
            const { applied, skipped, errors: applyErrors, details = [] } = await applyProposedImpact({
                impact: patched,
                dispatch,
                saveWikiEntity,
                addWikiRelation,
                updateWikiRelation,
                removeWikiRelation,
                campaignId,
                uid,
                entities,
                relations,
                eventMeta: { eventTitle: result?.eventTitle || "" },
                blockBodyOverride,
            });
            const head = applied === 0 && skipped > 0
                ? `Sin cambios aplicados (${skipped} omitido${skipped !== 1 ? "s" : ""})`
                : `Impacto: ${applied} aplicado${applied !== 1 ? "s" : ""}${skipped ? ` · ${skipped} omitido${skipped !== 1 ? "s" : ""}` : ""}`;
            const detailLine = details.length
                ? ` — ${details.slice(0, 4).join("; ")}${details.length > 4 ? "…" : ""}`
                : "";
            const errLine = applyErrors.length ? ` · errores: ${applyErrors.join("; ")}` : "";
            dispatch(showSnackbar({
                message: `${head}${detailLine}${errLine}`,
                severity: applyErrors.length || applied === 0 ? "warning" : "success",
            }));
            if (applied > 0) {
                setAppliedImpactKeys((prev) => new Set(prev).add(impactKeyOf(impact)));
            }
        } catch (err) {
            dispatch(showSnackbar({ message: `Error al aplicar impacto: ${err.message}`, severity: "error" }));
        } finally {
            setApplying(false);
            setImpactReview(null);
        }
    }, [campaignId, uid, entities, relations, dispatch, result?.eventTitle, impactKeyOf]);

    const handleApplyCollectiveImpact = useCallback((collective) => {
        if (!campaignId || !collective) return;
        openImpactReview(normalizeCollectiveImpactForApply(collective));
    }, [campaignId, openImpactReview]);

    const canCreateEvent = Boolean(
        result?.proposedEvent?.shouldCreate && result.proposedEvent.title?.trim()
    );

    const handleCreateEvent = useCallback(async () => {
        if (!canCreateEvent || !campaignId) return;
        setCreatingEvent(true);
        try {
            const { entityId, relationsCreated, unresolvedParticipants } = await applyProposedWikiEvent({
                dispatch,
                saveWikiEntity,
                addWikiRelation,
                campaignId,
                uid,
                proposedEvent: result.proposedEvent,
                fallbackEventKind: result.eventKind,
                entities,
                narrativeSettings,
            });
            let message = `Evento creado: ${result.proposedEvent.title}`;
            if (relationsCreated > 0) {
                message += ` (${relationsCreated} participante${relationsCreated > 1 ? "s" : ""})`;
            }
            if (unresolvedParticipants.length > 0) {
                message += `. Sin resolver: ${unresolvedParticipants.join(", ")}`;
            }
            dispatch(showSnackbar({ message, severity: unresolvedParticipants.length ? "warning" : "success" }));
            onEntityClick?.(entityId);
        } catch (err) {
            dispatch(showSnackbar({ message: `Error al crear evento: ${err.message}`, severity: "error" }));
        } finally {
            setCreatingEvent(false);
            setConfirmCreateEvent(false);
        }
    }, [
        canCreateEvent, campaignId, dispatch, uid, result, entities,
        narrativeSettings, onEntityClick,
    ]);

    if (!result) return null;

    // Group impacts by wave
    const byWave = new Map();
    for (const imp of result.impacts ?? []) {
        const w = imp.wave ?? 1;
        if (!byWave.has(w)) byWave.set(w, []);
        byWave.get(w).push(imp);
    }
    const waveNums = [...byWave.keys()].sort((a, b) => a - b);
    const impactCount = result.impacts?.length ?? 0;
    const changeCount = (result.impacts ?? []).reduce(
        (n, imp) => n + (imp.resolvedChanges ?? []).filter((c) => c.valid && c.kind !== "dm_note").length,
        0,
    );
    const warnCount = (result.missingImpacts?.length ?? 0) + (result.errors?.length ?? 0);
    const pendingImpacts = [
        ...(result.impacts ?? []).filter((imp) => !appliedImpactKeys.has(impactKeyOf(imp))),
        ...(result.collectiveImpacts ?? [])
            .map((ci) => normalizeCollectiveImpactForApply(ci))
            .filter((imp) => !appliedImpactKeys.has(impactKeyOf(imp))),
    ];
    const isQueue = presentation === "queue";
    const eventTitle = result.eventTitle?.trim()
        || eventInstruction?.trim().slice(0, 120)
        || "Evento catalizador";
    const eventSummary = result.eventSummary?.trim() || eventInstruction?.trim() || "";
    const overallSeal = buildSealGradeFromCascadeResult(result);
    const overallSealColor = sealGradeColor(overallSeal.grade);

    return (
        <Box sx={{ position: "relative", pb: pendingImpacts.length > 0 ? 7 : 0 }}>
            <Divider sx={{ bgcolor: UI_COLORS.border, mb: 1.5 }} />

            {/* F1 Seal Grade summary */}
            <Box
                sx={{
                    mb: 1.25,
                    p: 1.1,
                    borderRadius: 1,
                    border: `1px solid ${overallSealColor}66`,
                    bgcolor: `${overallSealColor}12`,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    flexWrap: "wrap",
                }}
            >
                <Chip
                    label={overallSeal.label}
                    size="small"
                    sx={{
                        height: 22,
                        fontSize: "0.55rem",
                        fontFamily: "'Orbitron', sans-serif",
                        letterSpacing: "0.1em",
                        color: overallSealColor,
                        border: `1px solid ${overallSealColor}`,
                        bgcolor: "rgba(8,8,14,0.65)",
                        "& .MuiChip-label": { px: 0.85 },
                    }}
                />
                <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.textPrimary, fontFamily: "'Fira Code', monospace" }}>
                    cobertura {overallSeal.pct}% · confidence {overallSeal.conf}
                </CyberText>
                <CyberText sx={{ fontSize: "0.62rem", color: UI_COLORS.textSecondary, width: "100%" }}>
                    {isQueue
                        ? "Sellos también en las cards del mapa. Click una fila para inspeccionar."
                        : "Cada impacto lleva sello OK / WARN / FAIL (muertos y hechos estructurales = FAIL)."}
                </CyberText>
            </Box>

            {/* Validation / parse errors */}
            {result.errors?.length > 0 && (
                <Box
                    sx={{
                        p: 1,
                        mb: 1,
                        bgcolor: `${UI_COLORS.accentStrong}14`,
                        border: `1px solid ${UI_COLORS.accentStrong}44`,
                        borderRadius: 1,
                    }}
                >
                    {result.errors.map((err, i) => (
                        <CyberText key={i} sx={{ fontSize: "0.7rem", color: UI_COLORS.accentStrong, mb: i < result.errors.length - 1 ? 0.35 : 0 }}>
                            ⚠ {err}
                        </CyberText>
                    ))}
                </Box>
            )}

            {/* Missing required impacts */}
            {result.missingImpacts?.length > 0 && (
                <Box
                    sx={{
                        p: 1,
                        mb: 1,
                        bgcolor: "#ffa72614",
                        border: "1px solid #ffa72644",
                        borderRadius: 1,
                    }}
                >
                    <CyberTitle sx={{ fontSize: "0.62rem", color: "#ffa726", letterSpacing: 2, mb: 0.35 }}>
                        REACCIONES FALTANTES ({result.missingImpacts.length})
                    </CyberTitle>
                    <CyberText sx={{ fontSize: "0.7rem", color: UI_COLORS.textPrimary }}>
                        Sin reacción para: {result.missingImpacts.join(", ")}. Regenera o completa a mano.
                    </CyberText>
                </Box>
            )}

            {/* Wave mismatches (warning only) */}
            {result.waveMismatches?.length > 0 && (
                <Box
                    sx={{
                        p: 0.85,
                        mb: 1,
                        bgcolor: `${UI_COLORS.backgroundPrimary}cc`,
                        border: `1px solid ${UI_COLORS.border}`,
                        borderRadius: 1,
                    }}
                >
                    {result.waveMismatches.map((wm, i) => (
                        <CyberText key={i} sx={{ fontSize: "0.65rem", color: UI_COLORS.textSecondary }}>
                            Onda: {wm.title} — esperada {wm.expected}, recibida {wm.got}
                        </CyberText>
                    ))}
                </Box>
            )}

            {/* Event header — compact */}
            <Box
                sx={{
                    p: 1.1,
                    mb: 1,
                    bgcolor: `${UI_COLORS.backgroundPrimary}cc`,
                    border: `1px solid ${UI_COLORS.border}`,
                    borderLeft: `3px solid ${UI_COLORS.accent}`,
                    borderRadius: 1,
                }}
            >
                <CyberTitle sx={{ fontSize: "0.76rem", color: UI_COLORS.accent, mb: eventSummary ? 0.35 : 0 }}>
                    {eventTitle}
                </CyberTitle>
                {eventSummary && (
                    <CyberText
                        sx={{
                            fontSize: "0.72rem",
                            color: UI_COLORS.textSecondary,
                            lineHeight: 1.35,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                        }}
                    >
                        {eventSummary}
                    </CyberText>
                )}
            </Box>

            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 1.25, px: 0.25 }}>
                <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.textSecondary }}>
                    <strong style={{ color: UI_COLORS.textPrimary }}>{impactCount}</strong> reacciones
                </CyberText>
                <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.textSecondary }}>
                    <strong style={{ color: UI_COLORS.textPrimary }}>{changeCount}</strong> cambios
                </CyberText>
                <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.textSecondary }}>
                    <strong style={{ color: UI_COLORS.textPrimary }}>{warnCount}</strong> avisos
                </CyberText>
            </Box>

            {impactCount === 0 && (
                <Box
                    sx={{
                        p: 1.1,
                        mb: 1.25,
                        bgcolor: `${UI_COLORS.backgroundPrimary}cc`,
                        border: `1px solid ${UI_COLORS.border}`,
                        borderRadius: 1,
                    }}
                >
                    <CyberText sx={{ fontSize: "0.74rem", color: UI_COLORS.textSecondary }}>
                        No hay reacciones por personaje. Reintenta con un evento más concreto o revisa
                        que el ancla tenga vecinos en el grafo.
                    </CyberText>
                </Box>
            )}

            {/* Impacts — queue (RED) or full cards (inline wiki lab) */}
            {presentation === "queue" ? (
                <Box sx={{ mb: 1.25 }}>
                    <CyberTitle
                        sx={{
                            fontSize: "0.55rem",
                            letterSpacing: "0.12em",
                            color: UI_COLORS.textSecondary,
                            mb: 0.55,
                        }}
                    >
                        COLA · CLICK PARA INSPECCIONAR EN EL MAPA
                    </CyberTitle>
                    {(result.impacts ?? []).map((imp, i) => {
                        const eid = impactEntityIdOf(imp);
                        return (
                        <QueueImpactRow
                            key={`q-${eid || i}`}
                            impact={imp}
                            applied={appliedImpactKeys.has(impactKeyOf(imp))}
                            selected={Boolean(
                                focusedImpactEntityId
                                && eid === focusedImpactEntityId,
                            )}
                            onFocus={(impact) => {
                                const id = impactEntityIdOf(impact);
                                if (id) {
                                    onFocusImpact?.(id, impact);
                                    onEntityClick?.(id);
                                }
                            }}
                        />
                        );
                    })}
                    {(result.collectiveImpacts ?? []).map((ci, i) => {
                        const norm = normalizeCollectiveImpactForApply(ci);
                        const eid = impactEntityIdOf(norm);
                        return (
                            <QueueImpactRow
                                key={`qc-${eid || i}`}
                                impact={norm}
                                applied={appliedImpactKeys.has(impactKeyOf(norm))}
                                selected={Boolean(
                                    focusedImpactEntityId
                                    && eid === focusedImpactEntityId,
                                )}
                                onFocus={(impact) => {
                                    const id = impactEntityIdOf(impact);
                                    if (id) {
                                        onFocusImpact?.(id, impact);
                                        onEntityClick?.(id);
                                    }
                                }}
                            />
                        );
                    })}
                </Box>
            ) : (
                <>
                    {waveNums.map((wave) => {
                        const waveColor = WAVE_COLORS[wave] ?? UI_COLORS.textSecondary;
                        const waveLabel = wave === 0 ? "ANCLA" : `ONDA ${wave}`;
                        const impactsInWave = byWave.get(wave);
                        return (
                            <Box key={wave} sx={{ mb: 1.25 }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.6 }}>
                                    <WavesIcon sx={{ fontSize: "0.85rem", color: waveColor }} />
                                    <CyberTitle sx={{ fontSize: "0.62rem", color: waveColor, letterSpacing: 2 }}>
                                        {waveLabel} — {impactsInWave.length}
                                    </CyberTitle>
                                </Box>
                                {impactsInWave.map((imp, i) => (
                                    <ImpactCard
                                        key={i}
                                        impact={imp}
                                        applying={applying}
                                        relations={relations}
                                        applied={appliedImpactKeys.has(impactKeyOf(imp))}
                                        appliedChangeKeys={appliedChangeKeys}
                                        changeKeyFn={changeKeyOf}
                                        onApplyChange={(ch) => setConfirmChange(ch)}
                                        onApplyImpact={openImpactReview}
                                    />
                                ))}
                            </Box>
                        );
                    })}

                    {(result.collectiveImpacts ?? []).length > 0 && (
                        <Box sx={{ mb: 1.5 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.75 }}>
                                <WavesIcon sx={{ fontSize: "0.85rem", color: "#ffa726" }} />
                                <CyberTitle sx={{ fontSize: "0.68rem", color: "#ffa726", letterSpacing: 2 }}>
                                    REACCIONES COLECTIVAS — {result.collectiveImpacts.length}
                                </CyberTitle>
                            </Box>
                            {result.collectiveImpacts.map((ci, i) => {
                                const ciChanges = (ci.resolvedChanges ?? []).map((ch) =>
                                    enrichRelationStrengthChange(ch, relations)
                                );
                                const ciValid = ciChanges.filter((c) => c.valid && c.kind !== "dm_note");
                                const ciSeal = gradeImpactSeal(ci);
                                const ciSealColor = sealGradeColor(ciSeal);
                                const canApplyCollective = Boolean(ci.entityResolved)
                                    && (ciValid.length > 0
                                        || Boolean(ci.collectiveReaction?.trim())
                                        || Boolean(ci.narrativeHook?.trim()));
                                return (
                                    <Box
                                        key={i}
                                        sx={{
                                            border: `1px solid ${UI_COLORS.border}`,
                                            borderLeft: "3px solid #ffa726",
                                            borderRadius: 1,
                                            mb: 1,
                                            p: 1.25,
                                            bgcolor: `${UI_COLORS.backgroundPrimary}bb`,
                                        }}
                                    >
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.5 }}>
                                            <CyberTitle sx={{ fontSize: "0.76rem", color: "#ffa726", flex: 1 }}>
                                                {ci.entityTitle}
                                            </CyberTitle>
                                            <Chip
                                                label={sealGradeLabel(ciSeal)}
                                                size="small"
                                                sx={{
                                                    height: 16,
                                                    fontSize: "0.5rem",
                                                    fontFamily: "'Orbitron', sans-serif",
                                                    letterSpacing: "0.06em",
                                                    bgcolor: `${ciSealColor}18`,
                                                    color: ciSealColor,
                                                    border: `1px solid ${ciSealColor}66`,
                                                    "& .MuiChip-label": { px: 0.55 },
                                                }}
                                            />
                                            <Chip
                                                label={ci.entityKind}
                                                size="small"
                                                sx={{ height: 16, fontSize: "0.54rem", bgcolor: "#ffa72618", color: "#ffa726", "& .MuiChip-label": { px: 0.6 } }}
                                            />
                                            <Chip
                                                label={ci.confidence ?? "media"}
                                                size="small"
                                                sx={{ height: 16, fontSize: "0.54rem", bgcolor: `${CONFIDENCE_COLORS[ci.confidence ?? "media"]}22`, color: CONFIDENCE_COLORS[ci.confidence ?? "media"], "& .MuiChip-label": { px: 0.6 } }}
                                            />
                                        </Box>
                                        <CyberText sx={{ fontSize: "0.73rem", color: UI_COLORS.textPrimary, mb: 0.5 }}>
                                            {ci.collectiveReaction}
                                        </CyberText>
                                        {ci.narrativeHook && (
                                            <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.textSecondary, fontStyle: "italic", mb: 0.5 }}>
                                                {ci.narrativeHook}
                                            </CyberText>
                                        )}
                                        {ciChanges.map((ch, j) => (
                                            <ChangeRow
                                                key={j}
                                                change={ch}
                                                applying={applying}
                                                onApply={(row) => setConfirmChange(row)}
                                            />
                                        ))}
                                        {canApplyCollective && (
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                disabled={applying}
                                                fullWidth
                                                onClick={() => handleApplyCollectiveImpact(ci)}
                                                sx={{
                                                    mt: 0.75,
                                                    fontSize: "0.6rem",
                                                    fontFamily: "'Orbitron', sans-serif",
                                                    letterSpacing: 0.5,
                                                    borderColor: "#ffa72688",
                                                    color: "#ffa726",
                                                    py: 0.25,
                                                    "&:hover": { bgcolor: "#ffa72612" },
                                                }}
                                            >
                                                Revisar y aplicar
                                            </Button>
                                        )}
                                    </Box>
                                );
                            })}
                        </Box>
                    )}
                </>
            )}

            {/* Proposed event creation — deferred (confusing in cascade review). */}
            {SHOW_PROPOSED_HISTORICAL_EVENT && result.proposedEvent?.shouldCreate && (
                <Box
                    sx={{
                        mb: 1.5,
                        p: 1.25,
                        bgcolor: `${UI_COLORS.anomaly}0a`,
                        border: `1px solid ${UI_COLORS.anomaly}33`,
                        borderRadius: 1,
                    }}
                >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.5 }}>
                        <EventIcon sx={{ fontSize: "0.9rem", color: UI_COLORS.anomaly }} />
                        <CyberTitle sx={{ fontSize: "0.68rem", color: UI_COLORS.anomaly, letterSpacing: 2 }}>
                            EVENTO HISTÓRICO PROPUESTO
                        </CyberTitle>
                    </Box>
                    <CyberText sx={{ fontSize: "0.78rem", color: UI_COLORS.textPrimary, mb: 0.25 }}>
                        {result.proposedEvent.title}
                    </CyberText>
                    <CyberText sx={{ fontSize: "0.7rem", color: UI_COLORS.textSecondary, mb: 0.5 }}>
                        {result.proposedEvent.summary}
                    </CyberText>
                    {result.proposedEvent.participants?.length > 0 && (
                        <CyberText sx={{ fontSize: "0.65rem", color: UI_COLORS.textSecondary }}>
                            Participantes: {result.proposedEvent.participants.join(", ")}
                        </CyberText>
                    )}
                    {canCreateEvent && (
                        <Button
                            size="small"
                            variant="outlined"
                            disabled={creatingEvent}
                            onClick={() => setConfirmCreateEvent(true)}
                            startIcon={creatingEvent ? <CircularProgress size={14} /> : <EventIcon />}
                            sx={{
                                mt: 1,
                                fontSize: "0.6rem",
                                fontFamily: "'Orbitron', sans-serif",
                                letterSpacing: 1,
                                borderColor: UI_COLORS.anomaly,
                                color: UI_COLORS.anomaly,
                                "&:hover": { bgcolor: `${UI_COLORS.anomaly}12` },
                            }}
                        >
                            Crear evento en TIMELINE
                        </Button>
                    )}
                </Box>
            )}

            {/* Blocked suggestions */}
            {result.blockedSuggestions?.length > 0 && (
                <Box sx={{ mb: 1.5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.75 }}>
                        <BlockIcon sx={{ fontSize: "0.85rem", color: UI_COLORS.accentStrong }} />
                        <CyberTitle sx={{ fontSize: "0.65rem", color: UI_COLORS.accentStrong, letterSpacing: 2 }}>
                            REQUIEREN ACCIÓN MANUAL ({result.blockedSuggestions.length})
                        </CyberTitle>
                    </Box>
                    {result.blockedSuggestions.map((b, i) => (
                        <Box
                            key={i}
                            sx={{
                                p: 0.75,
                                mb: 0.5,
                                bgcolor: `${UI_COLORS.backgroundPrimary}cc`,
                                border: `1px solid ${UI_COLORS.accentStrong}33`,
                                borderRadius: 0.75,
                            }}
                        >
                            <CyberText sx={{ fontSize: "0.74rem", color: UI_COLORS.textPrimary, mb: 0.2 }}>
                                🚫 {b.description}
                            </CyberText>
                            <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.textSecondary }}>
                                {b.reason}
                            </CyberText>
                        </Box>
                    ))}
                </Box>
            )}

            {/* DM notes */}
            {result.dmNotes && (
                <Box
                    sx={{
                        p: 1,
                        bgcolor: `${UI_COLORS.accentStrong}0a`,
                        border: `1px solid ${UI_COLORS.accentStrong}22`,
                        borderRadius: 1,
                    }}
                >
                    <CyberText sx={{ fontSize: "0.65rem", color: UI_COLORS.textSecondary, mb: 0.25 }}>
                        NOTAS DM
                    </CyberText>
                    <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.textPrimary }}>
                        {result.dmNotes}
                    </CyberText>
                </Box>
            )}

            {pendingImpacts.length > 0 && (
                <Box
                    sx={{
                        position: "sticky",
                        bottom: 0,
                        zIndex: 2,
                        mt: 1.5,
                        mx: -0.5,
                        px: 1.25,
                        py: 1,
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        bgcolor: "rgba(8,8,16,0.96)",
                        borderTop: `1px solid ${UI_COLORS.border}`,
                        backdropFilter: "blur(8px)",
                    }}
                >
                    <CyberText sx={{ fontSize: "0.7rem", color: UI_COLORS.textSecondary, flex: 1 }}>
                        {pendingImpacts.length} pendiente{pendingImpacts.length !== 1 ? "s" : ""} de aplicar
                    </CyberText>
                    <Button
                        size="small"
                        variant="outlined"
                        disabled={applying}
                        onClick={() => openImpactReview(pendingImpacts[0])}
                        sx={{
                            fontSize: "0.55rem",
                            fontFamily: "'Orbitron', sans-serif",
                            letterSpacing: 0.6,
                            borderColor: UI_COLORS.accent,
                            color: UI_COLORS.accent,
                            bgcolor: `${UI_COLORS.accent}12`,
                            py: 0.5,
                            px: 1.25,
                            "&:hover": { bgcolor: `${UI_COLORS.accent}1c` },
                        }}
                    >
                        Revisar siguiente
                    </Button>
                </Box>
            )}

            {/* Confirm apply dialog */}
            <Dialog
                open={Boolean(confirmChange)}
                onClose={() => setConfirmChange(null)}
                sx={{ zIndex: Z_INDEX.wikiDialog }}
                PaperProps={{
                    sx: { bgcolor: UI_COLORS.backgroundSecondary, border: `1px solid ${UI_COLORS.border}`, minWidth: 320 },
                }}
            >
                <DialogTitle sx={{ color: UI_COLORS.accent, fontFamily: "'Orbitron', sans-serif", fontSize: "0.85rem", letterSpacing: 2 }}>
                    CONFIRMAR CAMBIO
                </DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ color: UI_COLORS.textPrimary, fontFamily: "'Fira Sans', sans-serif", fontSize: "0.82rem" }}>
                        {confirmChange && (
                            <>
                                <strong>{KIND_LABELS[confirmChange.kind] ?? confirmChange.kind}</strong>
                                <br /><br />
                                {confirmChange.kind === "entity_state_update" ? (
                                    <>
                                        <strong>{confirmChange.fromEntityTitle}</strong>
                                        <span style={{ color: UI_COLORS.textSecondary }}>
                                            {" · "}{confirmChange.field}{" → "}
                                        </span>
                                        <strong>
                                            {NARRATIVE_STATE_LABELS[confirmChange.newValue] ?? confirmChange.newValue}
                                        </strong>
                                    </>
                                ) : (
                                    <>
                                        <strong>{confirmChange.fromEntityTitle}</strong>
                                        {confirmChange.relationType && (
                                            <span style={{ color: UI_COLORS.textSecondary }}>
                                                {" → [" + (WIKI_RELATION_TYPE_LABELS[confirmChange.relationType] ?? confirmChange.relationType) + "] → "}
                                            </span>
                                        )}
                                        <strong>{confirmChange.toEntityTitle}</strong>
                                        {formatStrengthChangeLabel(confirmChange) && (
                                            <>
                                                <br />
                                                <span style={{ color: UI_COLORS.anomaly, fontFamily: "'Orbitron', sans-serif", fontSize: "0.74rem" }}>
                                                    {formatStrengthChangeLabel(confirmChange)}
                                                </span>
                                            </>
                                        )}
                                    </>
                                )}
                                <br /><br />
                                <span style={{ color: UI_COLORS.textSecondary, fontSize: "0.74rem" }}>
                                    {confirmChange.reason}
                                </span>
                            </>
                        )}
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ px: 2.5, pb: 2 }}>
                    <Button
                        onClick={() => setConfirmChange(null)}
                        sx={{ color: UI_COLORS.textSecondary, fontFamily: "'Fira Sans', sans-serif", fontSize: "0.78rem" }}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={() => confirmChange && handleApplyChange(confirmChange)}
                        disabled={applying}
                        variant="contained"
                        sx={{ bgcolor: UI_COLORS.accent, color: "#000", fontFamily: "'Orbitron', sans-serif", fontSize: "0.72rem" }}
                    >
                        {applying ? <CircularProgress size={13} /> : "Aplicar"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Edit impact block body + relation strengths before apply */}
            <Dialog
                open={Boolean(impactReview)}
                onClose={() => !applying && setImpactReview(null)}
                sx={{ zIndex: Z_INDEX.wikiDialog }}
                PaperProps={{
                    sx: {
                        bgcolor: UI_COLORS.backgroundSecondary,
                        border: `1px solid ${UI_COLORS.border}`,
                        minWidth: 380,
                        maxWidth: 520,
                    },
                }}
            >
                <DialogTitle sx={{ color: UI_COLORS.anomaly, fontFamily: "'Orbitron', sans-serif", fontSize: "0.85rem", letterSpacing: 2 }}>
                    REVISAR IMPACTO
                </DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ color: UI_COLORS.textSecondary, fontFamily: "'Fira Sans', sans-serif", fontSize: "0.75rem", mb: 1.5 }}>
                        Revisa el impacto sobre{" "}
                        <strong style={{ color: UI_COLORS.textPrimary }}>
                            {impactReview?.impact?.entityTitle ?? "la entidad"}
                        </strong>
                        . El peso de relaciones se ajusta aparte; el texto de abajo es solo prosa
                        (reacción / gancho), sin Sync. Texto vacío = sin bloque narrativo
                        (sí se aplican relaciones/estado).
                    </DialogContentText>

                    {(impactReview?.strengthDrafts?.length ?? 0) > 0 && (
                        <Box sx={{ mb: 1.75 }}>
                            <CyberTitle sx={{ fontSize: "0.65rem", color: UI_COLORS.textSecondary, letterSpacing: 1.5, mb: 0.75 }}>
                                PESO DE RELACIONES
                            </CyberTitle>
                            {impactReview.strengthDrafts.map((draft, i) => {
                                const relLabel = draft.relationType
                                    ? (WIKI_RELATION_TYPE_LABELS[draft.relationType] ?? draft.relationType)
                                    : "relación";
                                const fromVal = draft.currentStrength;
                                const delta = fromVal != null
                                    ? Number(draft.proposedStrength) - Number(fromVal)
                                    : null;
                                return (
                                    <Box
                                        key={`${draft.index}-${i}`}
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1,
                                            mb: 0.75,
                                            p: 0.75,
                                            borderRadius: 0.5,
                                            border: `1px solid ${UI_COLORS.border}`,
                                            bgcolor: `${UI_COLORS.backgroundPrimary}cc`,
                                            opacity: draft.include ? 1 : 0.45,
                                        }}
                                    >
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.textPrimary }}>
                                                {draft.fromTitle}
                                                <Box component="span" sx={{ color: UI_COLORS.textSecondary }}> → </Box>
                                                {draft.toTitle}
                                            </CyberText>
                                            <CyberText sx={{ fontSize: "0.62rem", color: UI_COLORS.textSecondary }}>
                                                {relLabel}
                                                {fromVal != null && (
                                                    <> · actual {fromVal}{delta != null && delta !== 0 ? ` (${delta > 0 ? "+" : ""}${delta})` : ""}</>
                                                )}
                                                {fromVal == null && " · nueva"}
                                            </CyberText>
                                        </Box>
                                        <TextField
                                            type="number"
                                            size="small"
                                            label="Peso"
                                            disabled={!draft.include || applying}
                                            value={draft.proposedStrength}
                                            inputProps={{
                                                min: WIKI_RELATION_STRENGTH_MIN,
                                                max: WIKI_RELATION_STRENGTH_MAX,
                                                step: 1,
                                            }}
                                            onChange={(e) => {
                                                const raw = e.target.value;
                                                const next = raw === "" || raw === "-"
                                                    ? raw
                                                    : clampRelationStrength(raw);
                                                setImpactReview((prev) => {
                                                    if (!prev) return prev;
                                                    const strengthDrafts = prev.strengthDrafts.map((row, idx) => (
                                                        idx === i
                                                            ? { ...row, proposedStrength: next === "" || next === "-" ? next : next }
                                                            : row
                                                    ));
                                                    return { ...prev, strengthDrafts };
                                                });
                                            }}
                                            onBlur={() => {
                                                setImpactReview((prev) => {
                                                    if (!prev) return prev;
                                                    const strengthDrafts = prev.strengthDrafts.map((row, idx) => (
                                                        idx === i
                                                            ? { ...row, proposedStrength: clampRelationStrength(row.proposedStrength) }
                                                            : row
                                                    ));
                                                    return { ...prev, strengthDrafts };
                                                });
                                            }}
                                            sx={{
                                                width: 88,
                                                "& .MuiInputLabel-root": { color: UI_COLORS.textSecondary, fontSize: "0.7rem" },
                                                "& .MuiOutlinedInput-root": {
                                                    color: UI_COLORS.textPrimary,
                                                    fontFamily: "'Orbitron', sans-serif",
                                                    fontSize: "0.8rem",
                                                    bgcolor: UI_COLORS.backgroundPrimary,
                                                    "& fieldset": { borderColor: UI_COLORS.border },
                                                    "&:hover fieldset": { borderColor: UI_COLORS.anomaly },
                                                    "&.Mui-focused fieldset": { borderColor: UI_COLORS.anomaly },
                                                },
                                                "& input": { color: UI_COLORS.textPrimary, py: 0.75 },
                                            }}
                                        />
                                        <Button
                                            size="small"
                                            disabled={applying}
                                            onClick={() => {
                                                setImpactReview((prev) => {
                                                    if (!prev) return prev;
                                                    const strengthDrafts = prev.strengthDrafts.map((row, idx) => (
                                                        idx === i ? { ...row, include: !row.include } : row
                                                    ));
                                                    return { ...prev, strengthDrafts };
                                                });
                                            }}
                                            sx={{
                                                minWidth: 0,
                                                px: 0.75,
                                                fontSize: "0.58rem",
                                                color: draft.include ? UI_COLORS.accentStrong : UI_COLORS.anomaly,
                                                border: `1px solid ${draft.include ? UI_COLORS.accentStrong : UI_COLORS.anomaly}66`,
                                            }}
                                        >
                                            {draft.include ? "Omitir" : "Incluir"}
                                        </Button>
                                    </Box>
                                );
                            })}
                        </Box>
                    )}

                    <CyberTitle sx={{ fontSize: "0.65rem", color: UI_COLORS.textSecondary, letterSpacing: 1.5, mb: 0.75 }}>
                        TEXTO NARRATIVO
                    </CyberTitle>
                    <TextField
                        multiline
                        minRows={3}
                        fullWidth
                        value={impactReview?.draftBody ?? ""}
                        onChange={(e) => setImpactReview((prev) => (
                            prev ? { ...prev, draftBody: e.target.value } : prev
                        ))}
                        helperText="Solo reacción / gancho. Los Sync viven en «Peso de relaciones»."
                        FormHelperTextProps={{ sx: { color: UI_COLORS.textSecondary, fontSize: "0.62rem" } }}
                        sx={{
                            "& .MuiOutlinedInput-root": {
                                color: UI_COLORS.textPrimary,
                                fontFamily: "'Fira Sans', sans-serif",
                                fontSize: "0.8rem",
                                bgcolor: UI_COLORS.backgroundPrimary,
                                "& fieldset": { borderColor: UI_COLORS.border },
                                "&:hover fieldset": { borderColor: UI_COLORS.anomaly },
                                "&.Mui-focused fieldset": { borderColor: UI_COLORS.anomaly },
                            },
                        }}
                    />
                </DialogContent>
                <DialogActions sx={{ px: 2.5, pb: 2 }}>
                    <Button
                        onClick={() => setImpactReview(null)}
                        disabled={applying}
                        sx={{ color: UI_COLORS.textSecondary, fontFamily: "'Fira Sans', sans-serif", fontSize: "0.78rem" }}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={() => {
                            if (!impactReview?.impact) return;
                            const drafts = (impactReview.strengthDrafts ?? []).map((d) => ({
                                ...d,
                                proposedStrength: clampRelationStrength(d.proposedStrength),
                            }));
                            handleApplyImpact(
                                impactReview.impact,
                                impactReview.draftBody ?? "",
                                drafts,
                            );
                        }}
                        disabled={applying}
                        variant="contained"
                        sx={{ bgcolor: UI_COLORS.anomaly, color: "#000", fontFamily: "'Orbitron', sans-serif", fontSize: "0.72rem" }}
                    >
                        {applying ? <CircularProgress size={13} /> : "Aplicar"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Confirm create event dialog — gated with SHOW_PROPOSED_HISTORICAL_EVENT */}
            <Dialog
                open={SHOW_PROPOSED_HISTORICAL_EVENT && confirmCreateEvent}
                onClose={() => !creatingEvent && setConfirmCreateEvent(false)}
                sx={{ zIndex: Z_INDEX.wikiDialog }}
                PaperProps={{
                    sx: { bgcolor: UI_COLORS.backgroundSecondary, border: `1px solid ${UI_COLORS.border}`, minWidth: 340 },
                }}
            >
                <DialogTitle sx={{ color: UI_COLORS.anomaly, fontFamily: "'Orbitron', sans-serif", fontSize: "0.85rem", letterSpacing: 2 }}>
                    CREAR EVENTO HISTÓRICO
                </DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ color: UI_COLORS.textPrimary, fontFamily: "'Fira Sans', sans-serif", fontSize: "0.82rem" }}>
                        Se creará <strong>{result.proposedEvent?.title}</strong> en el wiki
                        con fecha narrativa presente de la campaña.
                        {result.proposedEvent?.participants?.length > 0 && (
                            <>
                                <br /><br />
                                Participantes a vincular: {result.proposedEvent.participants.join(", ")}.
                                Los no resueltos se omitirán con aviso.
                            </>
                        )}
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ px: 2.5, pb: 2 }}>
                    <Button
                        onClick={() => setConfirmCreateEvent(false)}
                        disabled={creatingEvent}
                        sx={{ color: UI_COLORS.textSecondary, fontFamily: "'Fira Sans', sans-serif", fontSize: "0.78rem" }}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleCreateEvent}
                        disabled={creatingEvent}
                        variant="contained"
                        sx={{ bgcolor: UI_COLORS.anomaly, color: "#000", fontFamily: "'Orbitron', sans-serif", fontSize: "0.72rem" }}
                    >
                        {creatingEvent ? <CircularProgress size={13} /> : "Crear evento"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
