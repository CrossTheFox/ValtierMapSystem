/**
 * Resolve current / proposed strength for AI-proposed relation changes.
 *
 * Semantics:
 *   relation_add    → strengthDelta is the absolute proposed strength (or default if omitted)
 *   relation_update → strengthDelta is an additive delta on the existing edge
 *
 * Structural edges never carry affinity: proposedStrength is always 0 and strengthDelta is ignored.
 */

import {
    defaultStrengthForRelation,
    isAffinityRelation,
    isStructuralRelation,
    resolveRelationStrength,
    WIKI_RELATION_TYPES,
} from "../constants/wikiRelationTypes.js";

/**
 * Find an existing campaign relation matching endpoints + type.
 * Also matches the reverse direction of the same type (avoids inverted duplicates
 * when the model flips from/to on directed kinship edges like descendiente_de).
 *
 * @returns {{ relation: object, reversed: boolean } | null}
 */
export function findMatchingRelation(relations = [], fromEntityId, toEntityId, relationType) {
    if (!fromEntityId || !toEntityId || !relationType) return null;
    const exact = relations.find(
        (r) =>
            r.fromEntityId === fromEntityId
            && r.toEntityId === toEntityId
            && r.relationType === relationType
    );
    if (exact) return { relation: exact, reversed: false };

    const reverse = relations.find(
        (r) =>
            r.fromEntityId === toEntityId
            && r.toEntityId === fromEntityId
            && r.relationType === relationType
    );
    if (reverse) return { relation: reverse, reversed: true };

    return null;
}

function entityTypesFromChange(change) {
    return {
        fromEntityType: change.fromEntity?.entityType ?? null,
        toEntityType: change.toEntity?.entityType ?? null,
    };
}

/**
 * Enrich a validated change with strength visualization fields.
 *
 * @returns {object} change + {
 *   existingRelationId, currentStrength, proposedStrength, strengthDeltaResolved,
 *   matchedReversed, resolvedEndpoints (canonicalized to existing edge when matched)
 * }
 */
export function enrichRelationStrengthChange(change, relations = []) {
    if (
        !change
        || (change.kind !== "relation_add"
            && change.kind !== "relation_update"
            && change.kind !== "relation_remove")
    ) {
        return change;
    }

    const fromId = change.resolvedEndpoints?.fromEntityId ?? change.fromEntity?.id;
    const toId = change.resolvedEndpoints?.toEntityId ?? change.toEntity?.id;
    const relType = change.relationType;
    const { fromEntityType, toEntityType } = entityTypesFromChange(change);
    const match = findMatchingRelation(relations, fromId, toId, relType);
    const existing = match?.relation ?? null;
    const matchedReversed = Boolean(match?.reversed);
    const currentStrength = existing != null ? Number(existing.strength ?? 0) : null;
    const rawDelta = change.strengthDelta;
    const structural = isStructuralRelation({
        relationType: relType,
        fromEntityType,
        toEntityType,
    });

    let proposedStrength = null;
    let strengthDeltaResolved = null;

    if (change.kind === "relation_remove") {
        proposedStrength = null;
    } else if (structural) {
        proposedStrength = 0;
        strengthDeltaResolved = currentStrength != null ? -currentStrength : 0;
    } else if (change.kind === "relation_update") {
        const base = currentStrength ?? defaultStrengthForRelation(relType, fromEntityType, toEntityType);
        const delta = rawDelta != null && !Number.isNaN(Number(rawDelta)) ? Number(rawDelta) : 0;
        strengthDeltaResolved = delta;
        proposedStrength = resolveRelationStrength({
            relationType: relType,
            fromEntityType,
            toEntityType,
            strength: base + delta,
        });
    } else {
        // relation_add: absolute strength (delta field misnamed historically).
        const absolute = rawDelta != null && !Number.isNaN(Number(rawDelta))
            ? Number(rawDelta)
            : defaultStrengthForRelation(relType, fromEntityType, toEntityType);
        strengthDeltaResolved = absolute - (currentStrength ?? 0);
        proposedStrength = resolveRelationStrength({
            relationType: relType,
            fromEntityType,
            toEntityType,
            strength: absolute,
        });
    }

    const canonicalEndpoints = existing
        ? { fromEntityId: existing.fromEntityId, toEntityId: existing.toEntityId }
        : (change.resolvedEndpoints
            ?? (fromId && toId ? { fromEntityId: fromId, toEntityId: toId } : null));

    return {
        ...change,
        existingRelationId: existing?.id ?? null,
        currentStrength,
        proposedStrength,
        strengthDeltaResolved,
        matchedReversed,
        isAffinity: isAffinityRelation({ relationType: relType, fromEntityType, toEntityType }),
        isStructural: structural,
        resolvedEndpoints: canonicalEndpoints ?? change.resolvedEndpoints,
    };
}

/**
 * Build a short human label: "7 → 4 (−3)" / "nueva · 5" / "sin cambio de peso (7)".
 */
export function formatStrengthChangeLabel({
    kind,
    currentStrength,
    proposedStrength,
    strengthDeltaResolved,
    existingRelationId,
    isStructural,
}) {
    if (kind === "relation_remove") {
        if (currentStrength == null) return "eliminar";
        return `elimina (peso ${currentStrength})`;
    }
    if (isStructural) {
        return kind === "relation_add" && !existingRelationId ? "hecho estructural" : "hecho (sin afinidad)";
    }
    if (kind === "relation_add" && !existingRelationId && currentStrength == null) {
        return `nueva · peso ${proposedStrength ?? 0}`;
    }
    if (currentStrength != null && proposedStrength != null) {
        const delta = strengthDeltaResolved ?? (proposedStrength - currentStrength);
        if (delta === 0) return `sin cambio de peso (${currentStrength})`;
        const sign = delta > 0 ? "+" : "";
        return `${currentStrength} → ${proposedStrength} (${sign}${delta})`;
    }
    if (proposedStrength != null) return `peso ${proposedStrength}`;
    return null;
}

/** Reject AI proposals that touch idioma / habla. */
export function isForbiddenLanguageRelation(relationType) {
    return relationType === WIKI_RELATION_TYPES.HABLA;
}
