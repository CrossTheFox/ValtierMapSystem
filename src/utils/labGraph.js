/**
 * Pure graph rules for the Lore Neural Lab.
 * One edge per unordered pair. The new gesture replaces the previous one.
 * A player's ego keeps their own ficha and neighbors the table can already see.
 */

import {
    getAllowedRelationTypes,
    resolveRelationStrength,
} from "../constants/wikiRelationTypes.js";

/** @param {string} a @param {string} b */
export function labPairKey(a, b) {
    const left = String(a || "");
    const right = String(b || "");
    return left < right ? `${left}|${right}` : `${right}|${left}`;
}

/**
 * @param {Array<{ id?: string, from_ficha_id?: string, to_ficha_id?: string }>} relations
 * @param {string} a
 * @param {string} b
 */
export function findRelationForPair(relations, a, b) {
    const key = labPairKey(a, b);
    return (relations || []).find((row) => labPairKey(row?.from_ficha_id, row?.to_ficha_id) === key) || null;
}

/**
 * Verbs the link menu can offer. `direct` keeps the gesture's origin.
 * `reverse` is the other direction, when that pair has verbs.
 * @param {string} fromType
 * @param {string} toType
 */
export function linkVerbChoices(fromType, toType) {
    const direct = getAllowedRelationTypes(fromType, toType);
    const reverse = getAllowedRelationTypes(toType, fromType);
    return { direct, reverse };
}

/**
 * @param {{
 *   fromId: string,
 *   toId: string,
 *   fromType: string,
 *   toType: string,
 *   relationType: string,
 *   strength?: number,
 *   label?: string,
 *   existing?: { id?: string }|null,
 * }} args
 * @returns {{ ok: true, replaceId: string|null, row: object }|{ ok: false, error: string }}
 */
export function proposeLabRelation({
    fromId,
    toId,
    fromType,
    toType,
    relationType,
    strength,
    label = "",
    existing = null,
}) {
    if (!fromId || !toId || fromId === toId) {
        return { ok: false, error: "El enlace necesita dos fichas distintas." };
    }
    const allowed = getAllowedRelationTypes(fromType, toType);
    if (!allowed.includes(relationType)) {
        return { ok: false, error: "Ese verbo no vale para este par." };
    }
    const resolved = resolveRelationStrength({
        relationType,
        fromEntityType: fromType,
        toEntityType: toType,
        strength,
    });
    return {
        ok: true,
        replaceId: existing?.id || null,
        row: {
            from_ficha_id: fromId,
            to_ficha_id: toId,
            relation_type: relationType,
            label: String(label || ""),
            strength: resolved,
        },
    };
}

/**
 * Ego for one player character.
 * The focus ficha is always included. A neighbor is included when the table
 * marked it `players`, or when it belongs to another character of the same player.
 * A hidden ficha is omitted entirely.
 *
 * @param {{
 *   fichas: object[],
 *   relations: object[],
 *   focusFichaId: string,
 *   visibleFichaIds: Set<string>|string[],
 *   ownFichaIds: Set<string>|string[],
 * }} args
 */
export function buildPlayerEgo({
    fichas = [],
    relations = [],
    focusFichaId,
    visibleFichaIds = [],
    ownFichaIds = [],
}) {
    const visible = visibleFichaIds instanceof Set ? visibleFichaIds : new Set(visibleFichaIds);
    const own = ownFichaIds instanceof Set ? ownFichaIds : new Set(ownFichaIds);
    const self = (fichas || []).find((row) => row?.id === focusFichaId) || null;
    if (!self) return { nodes: [], edges: [] };

    const allowed = new Set([focusFichaId]);
    const edges = [];
    for (const row of relations || []) {
        const from = row?.from_ficha_id;
        const to = row?.to_ficha_id;
        if (from !== focusFichaId && to !== focusFichaId) continue;
        const other = from === focusFichaId ? to : from;
        if (!other || other === focusFichaId) continue;
        if (!visible.has(other) && !own.has(other)) continue;
        allowed.add(other);
        edges.push(row);
    }
    const nodes = (fichas || []).filter((row) => row?.id && allowed.has(row.id));
    return { nodes, edges };
}
