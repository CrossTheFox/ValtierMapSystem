/**
 * Confirms a cascade onto Lore fichas and lore relations.
 * Threads stay on the campaign. This does not write wikiEntities.
 */

import {
    defaultStrengthForRelation,
    WIKI_RELATION_TYPES,
} from "../constants/wikiRelationTypes.js";
import { WIKI_ENTITY_TYPES } from "../constants/wikiEntityTypes.js";
import {
    enrichRelationStrengthChange,
    formatStrengthChangeLabel,
    isForbiddenLanguageRelation,
} from "./resolveRelationStrengthChange.js";
import {
    collectAffectedEntitiesFromImpact,
    createAiImpactBlock,
    withAppendedAiImpactBlock,
} from "./aiImpactBlocks.js";
import { findRelationForPair, proposeLabRelation } from "./labGraph.js";
import { replaceLoreRelation, deleteLoreRelation } from "../../firebase/services/loreRelationService.js";
import { updateLoreFicha } from "../../firebase/services/loreFichaService.js";

const MAX_OTRO_LABEL_CHARS = 80;

function entityTypeOf(entity) {
    return entity?.entityType || entity?.entity_type || "";
}

function asLoreEdge(row) {
    return {
        id: row.id,
        from_ficha_id: row.from_ficha_id || row.fromEntityId,
        to_ficha_id: row.to_ficha_id || row.toEntityId,
        relation_type: row.relation_type || row.relationType,
        strength: row.strength ?? 0,
    };
}

function impactPatch(entityType, field, newValue) {
    if (entityType === WIKI_ENTITY_TYPES.PERSONAJE && (field === "narrativeState" || field === "narrative_state")) {
        return { narrative_state: newValue };
    }
    if (entityType === WIKI_ENTITY_TYPES.ORGANIZACION && (field === "collectiveMood" || field === "collective_mood")) {
        return { collective_mood: newValue };
    }
    if (entityType === WIKI_ENTITY_TYPES.LOCACION && (field === "condicion" || field === "condicion_nota")) {
        return { [field]: newValue };
    }
    if (entityType === WIKI_ENTITY_TYPES.LOCACION && (field === "collectiveMood" || field === "collective_mood")) {
        return { collective_mood: newValue };
    }
    return null;
}

function blocksOf(entity) {
    if (Array.isArray(entity?.aiImpactBlocks)) return entity.aiImpactBlocks;
    if (Array.isArray(entity?.ai_impact_blocks)) return entity.ai_impact_blocks;
    return [];
}

/**
 * @returns {Promise<{ applied: number, skipped: number, errors: string[], details: string[] }>}
 */
export async function applyLoreProposedImpact({
    impact,
    loreId,
    entities = [],
    relations = [],
    eventMeta = {},
    blockBodyOverride = null,
}) {
    let applied = 0;
    let skipped = 0;
    const errors = [];
    const details = [];
    let liveRelations = (relations || []).map(asLoreEdge);
    let liveEntities = [...entities];

    const writeState = async (entity, field, newValue) => {
        const patch = impactPatch(entityTypeOf(entity), field, newValue);
        if (!patch) throw new Error(`impacto no aplica a ${entityTypeOf(entity)} (${field})`);
        await updateLoreFicha(loreId, entity.id, patch);
        liveEntities = liveEntities.map((row) => (
            row.id === entity.id ? { ...row, ...patch, customFields: { ...(row.customFields || {}), [field]: newValue } } : row
        ));
    };

    const personalityShift = impact.personalityShift;
    if (personalityShift?.to && impact.entityResolved) {
        try {
            await writeState(impact.entityResolved, "narrativeState", personalityShift.to);
            applied++;
            details.push(`estado ${impact.entityTitle ?? impact.entityResolved.title}: → ${personalityShift.to}`);
        } catch (err) {
            errors.push(`personalityShift: ${err.message}`);
        }
    }

    for (const rawCh of impact.resolvedChanges ?? []) {
        if (!rawCh.valid) {
            skipped++;
            details.push(`omitido (inválido): ${rawCh.validationError || rawCh.kind}`);
            continue;
        }
        const ch = enrichRelationStrengthChange(rawCh, liveRelations.map((row) => ({
            ...row,
            fromEntityId: row.from_ficha_id,
            toEntityId: row.to_ficha_id,
            relationType: row.relation_type,
        })));
        try {
            if (ch.kind === "relation_add" || ch.kind === "relation_update") {
                const relType = ch.relationType;
                if (!relType || isForbiddenLanguageRelation(relType)) {
                    skipped++;
                    details.push(relType ? "omitido: relaciones de idioma (habla) no se proponen" : "omitido: falta relationType");
                    continue;
                }
                const fromId = ch.resolvedEndpoints?.fromEntityId ?? ch.fromEntity?.id;
                const toId = ch.resolvedEndpoints?.toEntityId ?? ch.toEntity?.id;
                if (!fromId || !toId) {
                    skipped++;
                    details.push("omitido: endpoints incompletos");
                    continue;
                }
                const fromType = ch.fromEntity?.entityType ?? null;
                const toType = ch.toEntity?.entityType ?? null;
                const strengthValue = ch.proposedStrength
                    ?? defaultStrengthForRelation(relType, fromType, toType);
                const label = relType === WIKI_RELATION_TYPES.OTRO
                    ? String(ch.newLabel ?? "").trim().slice(0, MAX_OTRO_LABEL_CHARS)
                    : "";
                const existing = findRelationForPair(liveRelations, fromId, toId);
                const proposed = proposeLabRelation({
                    fromId,
                    toId,
                    fromType,
                    toType,
                    relationType: relType,
                    strength: strengthValue,
                    label,
                    existing,
                });
                if (!proposed.ok) {
                    skipped++;
                    details.push(`omitido: ${proposed.error}`);
                    continue;
                }
                const id = await replaceLoreRelation(loreId, { ...proposed.row, replaceId: proposed.replaceId });
                liveRelations = liveRelations.filter((row) => row.id !== proposed.replaceId);
                liveRelations.push({ id, ...proposed.row });
                applied++;
                details.push(
                    `relación ${ch.fromEntityTitle} → ${ch.toEntityTitle}: ${formatStrengthChangeLabel(ch) ?? `peso ${proposed.row.strength}`}`
                );
            } else if (ch.kind === "relation_remove") {
                const fromId = ch.resolvedEndpoints?.fromEntityId ?? ch.fromEntity?.id;
                const toId = ch.resolvedEndpoints?.toEntityId ?? ch.toEntity?.id;
                const existing = ch.existingRelationId
                    ? liveRelations.find((row) => row.id === ch.existingRelationId)
                    : findRelationForPair(liveRelations, fromId, toId);
                if (!existing?.id) {
                    skipped++;
                    details.push(`omitido: no existe relación ${ch.fromEntityTitle} → ${ch.toEntityTitle}`);
                    continue;
                }
                await deleteLoreRelation(loreId, existing.id);
                liveRelations = liveRelations.filter((row) => row.id !== existing.id);
                applied++;
                details.push(`relación eliminada ${ch.fromEntityTitle} → ${ch.toEntityTitle}`);
            } else if (ch.kind === "entity_state_update") {
                const target = ch.fromEntity ?? impact.entityResolved;
                if (!target || !ch.field || !ch.newValue) {
                    skipped++;
                    details.push("omitido: state_update incompleto");
                    continue;
                }
                await writeState(target, ch.field, ch.newValue);
                applied++;
                details.push(`estado ${ch.fromEntityTitle ?? target.title}: ${ch.field} → ${ch.newValue}`);
            } else if (ch.kind === "dm_note") {
                skipped++;
                details.push("omitido: dm_note (solo consultivo)");
            } else {
                skipped++;
                details.push(`omitido: kind desconocido "${ch.kind}"`);
            }
        } catch (err) {
            errors.push(`${ch.kind}: ${err.message}`);
            skipped++;
            details.push(`error ${ch.kind}: ${err.message}`);
        }
    }

    const skipAllBlocks = typeof blockBodyOverride === "string" && !blockBodyOverride.trim();
    if (!skipAllBlocks) {
        const primaryId = impact?.entityResolved?.id ?? null;
        const affected = collectAffectedEntitiesFromImpact(impact, liveEntities);
        for (const target of affected) {
            try {
                const latest = liveEntities.find((row) => row.id === target.id) ?? target;
                const view = { ...latest, aiImpactBlocks: blocksOf(latest) };
                const block = createAiImpactBlock(impact, eventMeta, {
                    forEntity: view,
                    entities: liveEntities,
                    bodyOverride: primaryId && latest.id === primaryId && typeof blockBodyOverride === "string"
                        ? blockBodyOverride
                        : null,
                });
                if (!block) continue;
                const patch = withAppendedAiImpactBlock(view, block);
                await updateLoreFicha(loreId, latest.id, { ai_impact_blocks: patch.aiImpactBlocks });
                applied++;
                details.push(`bloque IA en ficha: ${latest.title ?? latest.id}`);
            } catch (err) {
                errors.push(`aiImpactBlock(${target.title || target.id}): ${err.message}`);
            }
        }
    }

    return { applied, skipped, errors, details };
}
