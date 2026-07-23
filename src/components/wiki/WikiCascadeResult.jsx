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
 *   - Proposed event creation
 *   - Blocked suggestions
 *
 * Based on PANGeA (Buongiorno et al., 2024): the wave structure and archetype
 * badges give the DJ full trazability from "why this character reacted" to the
 * specific graph path that connects them to the anchor.
 */

import { useState, useCallback } from "react";
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
    clampRelationStrength,
    WIKI_RELATION_STRENGTH_MIN,
    WIKI_RELATION_STRENGTH_MAX,
} from "../../../firebase/services/wikiRelationService";

// ── Constants ─────────────────────────────────────────────────────────────────

const CONFIDENCE_COLORS = {
    alta:  UI_COLORS.anomaly,
    media: "#ffa726",
    baja:  UI_COLORS.accentStrong,
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
        <Tooltip title={`Arquetipo (PANGeA): ${tip}`} slotProps={tooltipSlotProps}>
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

function ChangeRow({ change, applying, onApply }) {
    const relLabel = change.relationType
        ? (WIKI_RELATION_TYPE_LABELS[change.relationType] ?? change.relationType)
        : null;
    const isRelation = change.kind === "relation_add"
        || change.kind === "relation_update"
        || change.kind === "relation_remove";
    const stateLabel = change.kind === "entity_state_update" && change.field === "narrativeState"
        ? (NARRATIVE_STATE_LABELS[change.newValue] ?? change.newValue)
        : change.newValue;

    const canApply = change.valid && change.kind !== "dm_note";

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
                                {" · "}{change.field || "(field?)"}{": "}
                            </span>
                            <strong style={{ color: UI_COLORS.anomaly }}>{stateLabel || "—"}</strong>
                        </>
                    ) : (
                        <>
                            <strong>{change.fromEntityTitle || "?"}</strong>
                            <span style={{ color: UI_COLORS.textSecondary }}>
                                {" → ["}{relLabel || change.relationType || "?"}{"] → "}
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
            {canApply && (
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
            )}
        </Box>
    );
}

function ImpactCard({ impact, applying, onApplyChange, onApplyImpact, relations = [] }) {
    const [expanded, setExpanded] = useState(false);
    const wave  = impact.wave ?? 1;
    const waveColor = WAVE_COLORS[wave] ?? UI_COLORS.textSecondary;
    const conf  = impact.confidence ?? "media";
    const enrichedChanges = (impact.resolvedChanges ?? []).map((ch) =>
        enrichRelationStrengthChange(ch, relations)
    );
    const validChanges = enrichedChanges.filter((c) => c.valid && c.kind !== "dm_note");
    const hasPersonalityShift = Boolean(impact.personalityShift?.to);
    const canApplyImpact = Boolean(impact.entityResolved)
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
            }}
        >
            {/* Header */}
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.75,
                    px: 1.25,
                    py: 0.75,
                    cursor: "pointer",
                    "&:hover": { bgcolor: `${waveColor}08` },
                }}
                onClick={() => setExpanded((v) => !v)}
            >
                <CyberTitle sx={{ fontSize: "0.78rem", color: waveColor, flex: 1, minWidth: 0 }}>
                    {impact.entityTitle}
                </CyberTitle>
                <ArchetypeBadge archetype={impact.reactionArchetype} />
                <Tooltip title={CONFIDENCE_TOOLTIPS[conf]} slotProps={tooltipSlotProps}>
                    <Chip
                        label={conf}
                        size="small"
                        sx={{
                            height: 16,
                            fontSize: "0.56rem",
                            bgcolor: `${CONFIDENCE_COLORS[conf]}22`,
                            color: CONFIDENCE_COLORS[conf],
                            border: `1px solid ${CONFIDENCE_COLORS[conf]}44`,
                            cursor: "help",
                            "& .MuiChip-label": { px: 0.6 },
                        }}
                    />
                </Tooltip>
                {validChanges.length > 0 && (
                    <Chip
                        label={`${validChanges.length} cambio${validChanges.length > 1 ? "s" : ""}`}
                        size="small"
                        sx={{
                            height: 16,
                            fontSize: "0.56rem",
                            bgcolor: `${UI_COLORS.anomaly}18`,
                            color: UI_COLORS.anomaly,
                            "& .MuiChip-label": { px: 0.6 },
                        }}
                    />
                )}
                {!impact.valid && (
                    <Tooltip title={impact.validationErrors?.join(" | ")} slotProps={tooltipSlotProps}>
                        <ErrorOutlineIcon sx={{ fontSize: "0.9rem", color: UI_COLORS.accentStrong }} />
                    </Tooltip>
                )}
                <IconButton size="small" sx={{ color: UI_COLORS.textSecondary, p: 0.25 }}>
                    {expanded ? <ExpandLessIcon sx={{ fontSize: "1rem" }} /> : <ExpandMoreIcon sx={{ fontSize: "1rem" }} />}
                </IconButton>
            </Box>

            {/* Emotional reaction — always visible */}
            <Box sx={{ px: 1.25, pb: expanded ? 0 : 0.75 }}>
                <CyberText sx={{ fontSize: "0.75rem", color: UI_COLORS.textPrimary, lineHeight: 1.5 }}>
                    {impact.emotionalReaction}
                </CyberText>
            </Box>

            {/* Expanded detail */}
            <Collapse in={expanded}>
                <Box sx={{ px: 1.25, pb: 1, pt: 0.5 }}>
                    {/* Narrative hook */}
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
                            <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.textSecondary, mb: 0.25, letterSpacing: 1 }}>
                                GANCHO NARRATIVO
                            </CyberText>
                            <CyberText sx={{ fontSize: "0.73rem", color: UI_COLORS.textPrimary }}>
                                {impact.narrativeHook}
                            </CyberText>
                        </Box>
                    )}

                    {/* Justification path */}
                    {impact.justificationPath && (
                        <CyberText sx={{ fontSize: "0.63rem", color: UI_COLORS.textSecondary, mb: 1, fontStyle: "italic" }}>
                            Ruta: {impact.justificationPath}
                        </CyberText>
                    )}

                    {/* Personality shift */}
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

                    {/* Proposed changes */}
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
                                />
                            ))}
                        </Box>
                    )}

                    {/* Apply all button (relations/state + bloque IA en ficha) */}
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
                                py: 0.25,
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
 *   result:           object,       — validateCascadeResponse output
 *   campaignId:       string,
 *   eventInstruction?: string,     — fallback si la IA no devuelve título/resumen
 *   onEntityClick?:   (id:string)=>void,
 * }} props
 */
export default function WikiCascadeResult({ result, campaignId, eventInstruction, onEntityClick }) {
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

    const handleApplyChange = useCallback(async (change) => {
        if (!change.valid || !campaignId) return;
        setApplying(true);
        try {
            const enriched = enrichRelationStrengthChange(change, relations);
            if (enriched.kind === "relation_add" || enriched.kind === "relation_update") {
                if (!enriched.relationType) {
                    dispatch(showSnackbar({
                        message: "No se puede aplicar: falta relationType.",
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
            }
        } catch (err) {
            dispatch(showSnackbar({ message: `Error: ${err.message}`, severity: "error" }));
        } finally {
            setApplying(false);
            setConfirmChange(null);
        }
    }, [campaignId, uid, relations, entities, dispatch]);

    const openImpactReview = useCallback((impact) => {
        if (!impact) return;
        const draftBody = buildAiImpactBlockBody(impact);
        const strengthDrafts = buildStrengthDrafts(impact, relations);
        setImpactReview({ impact, draftBody, strengthDrafts });
    }, [relations]);

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
        } catch (err) {
            dispatch(showSnackbar({ message: `Error al aplicar impacto: ${err.message}`, severity: "error" }));
        } finally {
            setApplying(false);
            setImpactReview(null);
        }
    }, [campaignId, uid, entities, relations, dispatch, result?.eventTitle]);

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
    const eventTitle = result.eventTitle?.trim()
        || eventInstruction?.trim().slice(0, 120)
        || "Evento catalizador";
    const eventSummary = result.eventSummary?.trim() || eventInstruction?.trim() || "";

    return (
        <Box>
            <Divider sx={{ bgcolor: UI_COLORS.border, mb: 1.5 }} />

            {/* Validation / parse errors */}
            {result.errors?.length > 0 && (
                <Box
                    sx={{
                        p: 1.25,
                        mb: 1.5,
                        bgcolor: `${UI_COLORS.accentStrong}14`,
                        border: `1px solid ${UI_COLORS.accentStrong}44`,
                        borderRadius: 1,
                    }}
                >
                    {result.errors.map((err, i) => (
                        <CyberText key={i} sx={{ fontSize: "0.74rem", color: UI_COLORS.accentStrong, mb: i < result.errors.length - 1 ? 0.5 : 0 }}>
                            ⚠ {err}
                        </CyberText>
                    ))}
                </Box>
            )}

            {/* Missing required impacts */}
            {result.missingImpacts?.length > 0 && (
                <Box
                    sx={{
                        p: 1.25,
                        mb: 1.5,
                        bgcolor: "#ffa72614",
                        border: "1px solid #ffa72644",
                        borderRadius: 1,
                    }}
                >
                    <CyberTitle sx={{ fontSize: "0.65rem", color: "#ffa726", letterSpacing: 2, mb: 0.5 }}>
                        IMPACTS FALTANTES ({result.missingImpacts.length})
                    </CyberTitle>
                    <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.textPrimary, mb: 0.5 }}>
                        La IA no generó reacción para: {result.missingImpacts.join(", ")}.
                    </CyberText>
                    <CyberText sx={{ fontSize: "0.65rem", color: UI_COLORS.textSecondary }}>
                        Regenera o completa manualmente las reacciones de estos personajes.
                    </CyberText>
                </Box>
            )}

            {/* Wave mismatches (warning only) */}
            {result.waveMismatches?.length > 0 && (
                <Box
                    sx={{
                        p: 1,
                        mb: 1.5,
                        bgcolor: `${UI_COLORS.backgroundPrimary}cc`,
                        border: `1px solid ${UI_COLORS.border}`,
                        borderRadius: 1,
                    }}
                >
                    {result.waveMismatches.map((wm, i) => (
                        <CyberText key={i} sx={{ fontSize: "0.68rem", color: UI_COLORS.textSecondary }}>
                            Onda: {wm.title} — esperada {wm.expected}, recibida {wm.got}
                        </CyberText>
                    ))}
                </Box>
            )}

            {/* Event header */}
            <Box
                sx={{
                    p: 1.25,
                    mb: 1.5,
                    bgcolor: `${UI_COLORS.backgroundPrimary}cc`,
                    border: `1px solid ${UI_COLORS.border}`,
                    borderLeft: `3px solid ${UI_COLORS.accent}`,
                    borderRadius: 1,
                }}
            >
                <CyberTitle sx={{ fontSize: "0.82rem", color: UI_COLORS.accent, mb: eventSummary ? 0.5 : 0 }}>
                    {eventTitle}
                </CyberTitle>
                {eventSummary && (
                    <CyberText sx={{ fontSize: "0.76rem", color: UI_COLORS.textPrimary }}>
                        {eventSummary}
                    </CyberText>
                )}
            </Box>

            {impactCount === 0 && (
                <Box
                    sx={{
                        p: 1.25,
                        mb: 1.5,
                        bgcolor: `${UI_COLORS.backgroundPrimary}cc`,
                        border: `1px solid ${UI_COLORS.border}`,
                        borderRadius: 1,
                    }}
                >
                    <CyberText sx={{ fontSize: "0.76rem", color: UI_COLORS.textSecondary }}>
                        La IA no generó impactos por personaje. Suele deberse a JSON truncado, subgrafo sin
                        personajes en ondas 1–3, o un evento demasiado vago. Reintenta con un texto más
                        concreto o revisa que el ancla tenga vecinos personaje en el grafo.
                    </CyberText>
                </Box>
            )}

            {/* Impacts by wave */}
            {waveNums.map((wave) => {
                const waveColor = WAVE_COLORS[wave] ?? UI_COLORS.textSecondary;
                const waveLabel = wave === 0 ? "ANCLA" : `ONDA ${wave}`;
                const impactsInWave = byWave.get(wave);
                return (
                    <Box key={wave} sx={{ mb: 1.5 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.75 }}>
                            <WavesIcon sx={{ fontSize: "0.85rem", color: waveColor }} />
                            <CyberTitle sx={{ fontSize: "0.68rem", color: waveColor, letterSpacing: 2 }}>
                                {waveLabel} — {impactsInWave.length} entidad{impactsInWave.length > 1 ? "es" : ""}
                            </CyberTitle>
                        </Box>
                        {impactsInWave.map((imp, i) => (
                            <ImpactCard
                                key={i}
                                impact={imp}
                                applying={applying}
                                relations={relations}
                                onApplyChange={(ch) => setConfirmChange(ch)}
                                onApplyImpact={openImpactReview}
                            />
                        ))}
                    </Box>
                );
            })}

            {/* Collective impacts (locaciones / organizaciones) */}
            {(result.collectiveImpacts ?? []).length > 0 && (
                <Box sx={{ mb: 1.5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.75 }}>
                        <WavesIcon sx={{ fontSize: "0.85rem", color: "#ffa726" }} />
                        <CyberTitle sx={{ fontSize: "0.68rem", color: "#ffa726", letterSpacing: 2 }}>
                            IMPACTOS COLECTIVOS — {result.collectiveImpacts.length} entidad{result.collectiveImpacts.length > 1 ? "es" : ""}
                        </CyberTitle>
                    </Box>
                    {result.collectiveImpacts.map((ci, i) => {
                        const ciChanges = (ci.resolvedChanges ?? []).map((ch) =>
                            enrichRelationStrengthChange(ch, relations)
                        );
                        const ciValid = ciChanges.filter((c) => c.valid && c.kind !== "dm_note");
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

            {/* Proposed event creation */}
            {result.proposedEvent?.shouldCreate && (
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
                        . Puedes ajustar el peso de cada relación (−10…+10) y el texto del bloque IA.
                        Texto vacío = sin bloque (sí se aplican relaciones/estado).
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
                        TEXTO DEL BLOQUE IA
                    </CyberTitle>
                    <TextField
                        multiline
                        minRows={3}
                        fullWidth
                        value={impactReview?.draftBody ?? ""}
                        onChange={(e) => setImpactReview((prev) => (
                            prev ? { ...prev, draftBody: e.target.value } : prev
                        ))}
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

            {/* Confirm create event dialog */}
            <Dialog
                open={confirmCreateEvent}
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
