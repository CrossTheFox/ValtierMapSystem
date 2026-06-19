/**
 * applyProposedImpact.js
 *
 * Persists validated AI-proposed impacts from CASCADE / Evento narrativo mode.
 * Handles three change kinds:
 *   - relation_add / relation_update → dispatch(addWikiRelation)
 *   - relation_remove               → dispatch(removeWikiRelation)
 *   - entity_state_update           → dispatch(saveWikiEntity) + mergeCustomFields
 *
 * collectiveImpacts use the same logic but target locacion / organizacion entities.
 */

import {
    defaultStrengthForRelationType,
} from "../constants/wikiRelationTypes.js";
import { mergeCustomFields, getEntityMeta } from "./wikiCustomFields.js";
import { WIKI_ENTITY_TYPES } from "../constants/wikiEntityTypes.js";

/**
 * Apply a single validated impact (one character or collective entity).
 *
 * @param {object} params
 * @param {object}   params.impact         — validated impact from validateCascadeResponse
 * @param {Function} params.dispatch        — Redux dispatch
 * @param {Function} params.saveWikiEntity  — wikiSlice thunk
 * @param {Function} params.addWikiRelation  — wikiSlice thunk
 * @param {Function} params.removeWikiRelation — wikiSlice thunk
 * @param {string}   params.campaignId
 * @param {string}   params.uid
 * @param {object[]} params.entities        — full entity list (for re-fetching current customFields)
 * @returns {Promise<{ applied: number, skipped: number, errors: string[] }>}
 */
export async function applyProposedImpact({
    impact,
    dispatch,
    saveWikiEntity,
    addWikiRelation,
    removeWikiRelation,
    campaignId,
    uid,
    entities = [],
}) {
    let applied = 0;
    let skipped = 0;
    const errors = [];

    // Apply personalityShift as entity_state_update if present
    const personalityShift = impact.personalityShift;
    if (personalityShift?.to && impact.entityResolved) {
        try {
            await _applyStateUpdate({
                entity: impact.entityResolved,
                field: "narrativeState",
                newValue: personalityShift.to,
                dispatch, saveWikiEntity, campaignId, uid, entities,
            });
            applied++;
        } catch (e) {
            errors.push(`personalityShift: ${e.message}`);
        }
    }

    for (const ch of impact.resolvedChanges ?? []) {
        if (!ch.valid) {
            skipped++;
            continue;
        }
        try {
            if (ch.kind === "relation_add" || ch.kind === "relation_update") {
                const relType = ch.relationType;
                const strength = ch.strengthDelta !== undefined
                    ? ch.strengthDelta
                    : defaultStrengthForRelationType(relType);
                await dispatch(addWikiRelation({
                    campaignId,
                    uid,
                    data: {
                        fromEntityId: ch.resolvedEndpoints?.fromEntityId ?? ch.fromEntity?.id,
                        toEntityId:   ch.resolvedEndpoints?.toEntityId   ?? ch.toEntity?.id,
                        relationType: relType,
                        label:        ch.newLabel ?? "",
                        strength,
                    },
                })).unwrap();
                applied++;
            } else if (ch.kind === "relation_remove") {
                await dispatch(removeWikiRelation({
                    campaignId,
                    uid,
                    fromEntityId: ch.resolvedEndpoints?.fromEntityId ?? ch.fromEntity?.id,
                    toEntityId:   ch.resolvedEndpoints?.toEntityId   ?? ch.toEntity?.id,
                    relationType: ch.relationType,
                })).unwrap();
                applied++;
            } else if (ch.kind === "entity_state_update") {
                const targetEntity = ch.fromEntity ?? impact.entityResolved;
                if (!targetEntity || !ch.field || !ch.newValue) {
                    skipped++;
                    continue;
                }
                await _applyStateUpdate({
                    entity: targetEntity,
                    field: ch.field,
                    newValue: ch.newValue,
                    dispatch, saveWikiEntity, campaignId, uid, entities,
                });
                applied++;
            } else if (ch.kind === "dm_note") {
                // dm_note changes are advisory — they don't persist automatically
                skipped++;
            }
        } catch (e) {
            errors.push(`${ch.kind}: ${e.message}`);
            skipped++;
        }
    }

    return { applied, skipped, errors };
}

/**
 * Apply a single entity_state_update to a wiki entity's customFields.
 *
 * Supported fields:
 *   - "narrativeState"      → customFields.personaje.narrativeState
 *   - "collectiveMood"      → customFields.locacion/organizacion.collectiveMood
 *   - "collectiveArchetype" → customFields.locacion/organizacion.collectiveArchetype
 *
 * @private
 */
async function _applyStateUpdate({ entity, field, newValue, dispatch, saveWikiEntity, campaignId, uid, entities }) {
    const T = WIKI_ENTITY_TYPES;
    const et = entity.entityType;

    let namespace = null;
    if (et === T.PERSONAJE) namespace = "personaje";
    else if (et === T.LOCACION) namespace = "locacion";
    else if (et === T.ORGANIZACION) namespace = "organizacion";
    else throw new Error(`entity_state_update no soportado para tipo "${et}".`);

    // Get latest customFields from full entity list (more up-to-date than snapshot)
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
