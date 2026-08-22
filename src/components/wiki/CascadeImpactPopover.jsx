/**
 * DM-only cascade inspector — popover anchored to a Circuit Card.
 * Shows hook + change previews; CTA opens existing REVISAR IMPACTO dialog.
 */

import { Box, Button, Popover } from "@mui/material";
import { CyberText, CyberTitle } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { Z_INDEX, hudPopoverPaperSx } from "../../constants/designSystem";
import { NARRATIVE_STATE_LABELS } from "../../constants/wiki/entityFieldSchemas";
import {
    enrichRelationStrengthChange,
    formatStrengthChangeLabel,
} from "../../utils/resolveRelationStrengthChange";
import { normalizeCollectiveImpactForApply } from "../../utils/aiImpactBlocks";
import {
    gradeImpactSeal,
    sealGradeColor,
    sealGradeLabel,
} from "../../utils/impactSealGrade";

/**
 * Prefer stamped entityId; fall back to resolved wiki entity (legacy payloads).
 * @param {object|null|undefined} impact
 * @returns {string|null}
 */
export function impactEntityIdOf(impact) {
    if (!impact) return null;
    return impact.entityId || impact.entityResolved?.id || null;
}

/**
 * @param {object|null|undefined} result
 * @param {string|null|undefined} entityId
 */
export function findCascadeImpactByEntityId(result, entityId) {
    if (!result || !entityId) return null;
    const match = (i) => impactEntityIdOf(i) === entityId;
    const person = (result.impacts ?? []).find(match);
    if (person) return person;
    const collective = (result.collectiveImpacts ?? []).find(match);
    if (collective) return normalizeCollectiveImpactForApply(collective);
    return null;
}

/**
 * @param {{
 *   open: boolean,
 *   anchorEl: HTMLElement|null,
 *   impact: object|null,
 *   relations?: object[],
 *   onClose: () => void,
 *   onReview: (impact: object) => void,
 * }} props
 */
export default function CascadeImpactPopover({
    open,
    anchorEl,
    impact,
    relations = [],
    onClose,
    onReview,
}) {
    if (!impact) return null;

    const seal = gradeImpactSeal(impact);
    const sealColor = sealGradeColor(seal);
    const reaction = impact.emotionalReaction || impact.collectiveReaction || "";
    const enriched = (impact.resolvedChanges ?? []).map((ch) =>
        enrichRelationStrengthChange(ch, relations)
    );
    const previewChanges = enriched.filter((c) => c.valid !== false).slice(0, 4);
    const shift = impact.personalityShift;

    return (
        <Popover
            open={open && Boolean(anchorEl)}
            anchorEl={anchorEl}
            onClose={onClose}
            anchorOrigin={{ vertical: "center", horizontal: "right" }}
            transformOrigin={{ vertical: "center", horizontal: "left" }}
            slotProps={{
                // Above CharactersSettingsDialog / nested dossier chrome (default Modal is ~1300).
                root: { sx: { zIndex: Math.max(Z_INDEX.wikiLabMenu, 12000) } },
                paper: {
                    sx: {
                        ...hudPopoverPaperSx,
                        width: 300,
                        maxWidth: "min(300px, 92vw)",
                        p: 1.25,
                        border: `1px solid ${UI_COLORS.accentStrong}66`,
                        boxShadow: `0 16px 40px rgba(0,0,0,0.55), 0 0 24px ${UI_COLORS.accentStrong}22`,
                        color: UI_COLORS.textPrimary,
                    },
                },
            }}
            disableScrollLock
        >
            <CyberTitle
                sx={{
                    fontSize: "0.48rem",
                    letterSpacing: "0.14em",
                    color: UI_COLORS.accentStrong,
                    mb: 0.4,
                }}
            >
                INSPECTOR
            </CyberTitle>

            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.75 }}>
                <CyberText
                    sx={{
                        fontSize: "0.92rem",
                        fontWeight: 600,
                        color: UI_COLORS.textPrimary,
                        flex: 1,
                        minWidth: 0,
                        lineHeight: 1.25,
                    }}
                >
                    {impact.entityTitle || "—"}
                </CyberText>
                <Box
                    component="span"
                    sx={{
                        fontFamily: '"Orbitron", sans-serif',
                        fontSize: "0.4rem",
                        letterSpacing: "0.08em",
                        px: 0.5,
                        py: 0.2,
                        borderRadius: "3px",
                        border: `1px solid ${sealColor}`,
                        color: sealColor,
                        bgcolor: `${sealColor}18`,
                        flexShrink: 0,
                    }}
                >
                    {sealGradeLabel(seal)}
                </Box>
            </Box>

            {reaction ? (
                <CyberText
                    sx={{
                        fontSize: "0.72rem",
                        color: UI_COLORS.textSecondary,
                        lineHeight: 1.35,
                        mb: 0.85,
                    }}
                >
                    {reaction}
                </CyberText>
            ) : null}

            {impact.narrativeHook ? (
                <Box
                    sx={{
                        mb: 0.85,
                        p: 0.75,
                        bgcolor: `${UI_COLORS.anomaly}0a`,
                        borderLeft: `2px solid ${UI_COLORS.anomaly}`,
                        borderRadius: "0 4px 4px 0",
                    }}
                >
                    <CyberText
                        sx={{
                            fontSize: "0.55rem",
                            letterSpacing: "0.1em",
                            color: UI_COLORS.anomaly,
                            mb: 0.3,
                            fontFamily: '"Orbitron", sans-serif',
                        }}
                    >
                        GANCHO
                    </CyberText>
                    <CyberText sx={{ fontSize: "0.7rem", color: UI_COLORS.textPrimary, lineHeight: 1.4 }}>
                        {impact.narrativeHook}
                    </CyberText>
                </Box>
            ) : null}

            {shift?.to ? (
                <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.textSecondary, mb: 0.75 }}>
                    Estado:{" "}
                    <span style={{ color: UI_COLORS.textSecondary }}>
                        {NARRATIVE_STATE_LABELS[shift.from] ?? shift.from ?? "—"}
                    </span>
                    {" → "}
                    <span style={{ color: UI_COLORS.anomaly }}>
                        {NARRATIVE_STATE_LABELS[shift.to] ?? shift.to}
                    </span>
                </CyberText>
            ) : null}

            {previewChanges.length > 0 && (
                <Box sx={{ mb: 1 }}>
                    <CyberText
                        sx={{
                            fontSize: "0.55rem",
                            letterSpacing: "0.1em",
                            color: UI_COLORS.textSecondary,
                            mb: 0.35,
                            fontFamily: '"Orbitron", sans-serif',
                        }}
                    >
                        CAMBIOS
                    </CyberText>
                    {previewChanges.map((ch, i) => {
                        const strength = formatStrengthChangeLabel(ch);
                        return (
                            <CyberText
                                key={i}
                                sx={{
                                    fontSize: "0.68rem",
                                    color: UI_COLORS.textPrimary,
                                    py: 0.35,
                                    borderTop: i === 0 ? "none" : `1px solid ${UI_COLORS.border}`,
                                    fontFamily: strength ? '"Fira Code", monospace' : undefined,
                                }}
                            >
                                {ch.kind === "entity_state_update"
                                    ? `${ch.fromEntityTitle || "?"} · ${ch.field} → ${NARRATIVE_STATE_LABELS[ch.newValue] ?? ch.newValue}`
                                    : ch.kind === "dm_note"
                                        ? `Nota DM: ${(ch.noteText || "").slice(0, 80)}`
                                        : `${ch.fromEntityTitle || "?"} ↔ ${ch.toEntityTitle || "?"}${strength ? ` · ${strength}` : ""}`}
                            </CyberText>
                        );
                    })}
                </Box>
            )}

            <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
                <Button
                    size="small"
                    onClick={onClose}
                    sx={{
                        fontFamily: '"Orbitron", sans-serif',
                        fontSize: "0.42rem",
                        letterSpacing: "0.1em",
                        color: UI_COLORS.textSecondary,
                        border: `1px solid ${UI_COLORS.border}`,
                        minWidth: 0,
                        px: 1,
                    }}
                >
                    CERRAR
                </Button>
                <Button
                    size="small"
                    variant="outlined"
                    onClick={() => onReview?.(impact)}
                    sx={{
                        fontFamily: '"Orbitron", sans-serif',
                        fontSize: "0.42rem",
                        letterSpacing: "0.1em",
                        color: UI_COLORS.textPrimary,
                        borderColor: UI_COLORS.accentStrong,
                        bgcolor: `${UI_COLORS.accentStrong}18`,
                        minWidth: 0,
                        px: 1.1,
                        "&:hover": { bgcolor: `${UI_COLORS.accentStrong}28` },
                    }}
                >
                    REVISAR
                </Button>
            </Box>
        </Popover>
    );
}
