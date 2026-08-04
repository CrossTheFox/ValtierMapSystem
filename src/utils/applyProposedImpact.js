/**
 * applyProposedImpact.js
 *
 * Persists validated AI-proposed impacts from CASCADE / Evento narrativo mode.
 * Handles:
 *   - relation_add                  → createWikiRelation (absolute strength)
 *   - relation_update               → updateWikiRelation (delta on existing) or create if missing
 *   - relation_remove               → removeWikiRelation by existing id
 *   - entity_state_update           → saveWikiEntity + mergeCustomFields
 *   - personalityShift              → narrativeState update
 *   - dm_note                       → skip (advisory)
 *   - aiImpactBlocks append         → short editable ficha block on ALL touched entities
 */

import {
    defaultStrengthForRelationType,
    WIKI_RELATION_TYPES,
} from "../constants/wikiRelationTypes.js";
import { mergeCustomFields } from "./wikiCustomFields.js";
import { WIKI_ENTITY_TYPES } from "../constants/wikiEntityTypes.js";
import {
    enrichRelationStrengthChange,
    formatStrengthChangeLabel,
} from "./resolveRelationStrengthChange.js";
import {
    collectAffectedEntitiesFromImpact,
    createAiImpactBlock,
    withAppendedAiImpactBlock,
} from "./aiImpactBlocks.js";

const MAX_OTRO_LABEL_CHARS = 80;

/**
 * Only persist free-text labels for type "otro". Typed relations must not store
 * AI prose in `label` (that produced entries like «padre_asesin…»).
 * @returns {string|undefined} undefined = do not patch label on update
 */
function sanitizeRelationLabel(relationType, newLabel, { forCreate = false } = {}) {
    if (relationType === WIKI_RELATION_TYPES.OTRO) {
        const s = String(newLabel ?? "").trim().slice(0, MAX_OTRO_LABEL_CHARS);
        return s;
    }
    if (forCreate) return "";
    return undefined;
}

/**
 * @returns {Promise<{
 *   applied: number,
 *   skipped: number,
 *   errors: string[],
 *   details: string[],
 * }>}
 */
export async function applyProposedImpact({
    impact,
    dispatch,
    saveWikiEntity,
    addWikiRelation,
    updateWikiRelation,
    removeWikiRelation,
    campaignId,
    uid,
    entities = [],
    relations = [],
    eventMeta = {},
    /** Optional DM-edited body for the primary entity's AI impact block. */
    blockBodyOverride = null,
}) {
    let applied = 0;
    let skipped = 0;
    const errors = [];
    const details = [];
    // Local copies so successive changes in the same impact see prior updates
    let liveRelations = [...relations];
    let liveEntities = [...entities];

    const personalityShift = impact.personalityShift;
    if (personalityShift?.to && impact.entityResolved) {
        try {
            await _applyStateUpdate({
                entity: impact.entityResolved,
                field: "narrativeState",
                newValue: personalityShift.to,
                dispatch, saveWikiEntity, campaignId, uid,
                entities: liveEntities,
            });
            applied++;
            details.push(
                `estado ${impact.entityTitle ?? impact.entityResolved.title}: → ${personalityShift.to}`
            );
        } catch (e) {
            errors.push(`personalityShift: ${e.message}`);
        }
    }

    for (const rawCh of impact.resolvedChanges ?? []) {
        if (!rawCh.valid) {
            skipped++;
            details.push(`omitido (inválido): ${rawCh.validationError || rawCh.kind}`);
            continue;
        }

        const ch = enrichRelationStrengthChange(rawCh, liveRelations);

        try {
            if (ch.kind === "relation_add" || ch.kind === "relation_update") {
                const relType = ch.relationType;
                if (!relType) {
                    skipped++;
                    details.push("omitido: falta relationType");
                    continue;
                }
                const fromEntityId = ch.resolvedEndpoints?.fromEntityId ?? ch.fromEntity?.id;
                const toEntityId = ch.resolvedEndpoints?.toEntityId ?? ch.toEntity?.id;
                if (!fromEntityId || !toEntityId) {
                    skipped++;
                    details.push("omitido: endpoints incompletos");
                    continue;
                }

                const strengthLabel = formatStrengthChangeLabel(ch)
                    ?? `peso ${ch.proposedStrength ?? 0}`;
                const labelForCreate = sanitizeRelationLabel(relType, ch.newLabel, { forCreate: true });
                const labelForUpdate = sanitizeRelationLabel(relType, ch.newLabel, { forCreate: false });

                if (ch.existingRelationId && updateWikiRelation) {
                    const patch = {
                        strength: ch.proposedStrength ?? defaultStrengthForRelationType(relType),
                    };
                    if (labelForUpdate !== undefined) {
                        patch.label = labelForUpdate;
                    }
                    const updated = await dispatch(updateWikiRelation({
                        campaignId,
                        relationId: ch.existingRelationId,
                        data: patch,
                    })).unwrap();
                    liveRelations = liveRelations.map((r) =>
                        r.id === ch.existingRelationId ? { ...r, ...updated } : r
                    );
                    applied++;
                    const reverseNote = ch.matchedReversed ? " (dirección canónica del grafo)" : "";
                    details.push(
                        `relación ${ch.fromEntityTitle} → ${ch.toEntityTitle}: ${strengthLabel}${reverseNote}`
                    );
                } else {
                    const created = await dispatch(addWikiRelation({
                        campaignId,
                        uid,
                        data: {
                            fromEntityId,
                            toEntityId,
                            relationType: relType,
                            label: labelForCreate ?? "",
                            strength: ch.proposedStrength ?? defaultStrengthForRelationType(relType),
                        },
                    })).unwrap();
                    liveRelations = [...liveRelations, created];
                    applied++;
                    details.push(
                        `relación nueva ${ch.fromEntityTitle} → ${ch.toEntityTitle}: ${strengthLabel}`
                    );
                }
            } else if (ch.kind === "relation_remove") {
                const relId = ch.existingRelationId;
                if (!relId) {
                    skipped++;
                    details.push(
                        `omitido: no existe relación ${ch.fromEntityTitle} → ${ch.toEntityTitle}`
                    );
                    continue;
                }
                await dispatch(removeWikiRelation({ campaignId, relationId: relId })).unwrap();
                liveRelations = liveRelations.filter((r) => r.id !== relId);
                applied++;
                details.push(
                    `relación eliminada ${ch.fromEntityTitle} → ${ch.toEntityTitle}`
                );
            } else if (ch.kind === "entity_state_update") {
                const targetEntity = ch.fromEntity ?? impact.entityResolved;
                if (!targetEntity || !ch.field || !ch.newValue) {
                    skipped++;
                    details.push("omitido: state_update incompleto");
                    continue;
                }
                await _applyStateUpdate({
                    entity: targetEntity,
                    field: ch.field,
                    newValue: ch.newValue,
                    dispatch, saveWikiEntity, campaignId, uid,
                    entities: liveEntities,
                });
                applied++;
                details.push(
                    `estado ${ch.fromEntityTitle ?? targetEntity.title}: ${ch.field} → ${ch.newValue}`
                );
            } else if (ch.kind === "dm_note") {
                skipped++;
                details.push("omitido: dm_note (solo consultivo)");
            } else {
                skipped++;
                details.push(`omitido: kind desconocido "${ch.kind}"`);
            }
        } catch (e) {
            errors.push(`${ch.kind}: ${e.message}`);
            skipped++;
            details.push(`error ${ch.kind}: ${e.message}`);
        }
    }

    // Append short AI narrative blocks on EVERY touched entity ficha (primary + partners).
    // Explicit empty override from DM review = skip all text blocks (relations/state already applied).
    const skipAllBlocks = typeof blockBodyOverride === "string" && !blockBodyOverride.trim();
    if (!skipAllBlocks) {
        const primaryId = impact?.entityResolved?.id ?? null;
        const affected = collectAffectedEntitiesFromImpact(impact, liveEntities);
        for (const target of affected) {
            try {
                const latest = liveEntities.find((e) => e.id === target.id) ?? target;
                const isPrimary = primaryId && latest.id === primaryId;
                const block = createAiImpactBlock(impact, eventMeta, {
                    forEntity: latest,
                    entities: liveEntities,
                    bodyOverride: isPrimary && typeof blockBodyOverride === "string"
                        ? blockBodyOverride
                        : null,
                });
                if (!block) continue;
                const patch = withAppendedAiImpactBlock(latest, block);
                await dispatch(saveWikiEntity({
                    campaignId,
                    entityId: latest.id,
                    uid,
                    data: patch,
                })).unwrap();
                liveEntities = liveEntities.map((e) =>
                    e.id === latest.id ? { ...e, ...patch } : e
                );
                applied++;
                details.push(`bloque IA en ficha: ${latest.title ?? latest.id}`);
            } catch (e) {
                errors.push(`aiImpactBlock(${target.title || target.id}): ${e.message}`);
                details.push(`error bloque IA (${target.title || target.id}): ${e.message}`);
            }
        }
    } else {
        details.push("bloques IA omitidos (texto vacío en revisión)");
    }

    return { applied, skipped, errors, details };
}

async function _applyStateUpdate({ entity, field, newValue, dispatch, saveWikiEntity, campaignId, uid, entities }) {
    const T = WIKI_ENTITY_TYPES;
    const et = entity.entityType;

    let namespace = null;
    if (et === T.PERSONAJE) namespace = "personaje";
    else if (et === T.LOCACION) namespace = "locacion";
    else if (et === T.ORGANIZACION) namespace = "organizacion";
    else throw new Error(`entity_state_update no soportado para tipo "${et}".`);

    const latest = entities.find((e) => e.id === entity.id) ?? entity;
    const currentCf = latest.customFields ?? {};
    const updatedCf = mergeCustomFields(currentCf, et, { [field]: newValue });

    await dispatch(saveWikiEntity({
        campaignId,
        entityId: entity.id,
        uid,
        data: {
            ...latest,
            customFields: updatedCf,
        },
    })).unwrap();
}
