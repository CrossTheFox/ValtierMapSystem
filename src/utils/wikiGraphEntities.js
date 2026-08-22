/**
 * Entidades excluidas del grafo NEURAL_LAB (no seleccionables, no en la matriz).
 * Idioma: solo nutre fichas de personaje vía refs, no participa en propagación narrativa.
 */
import { WIKI_ENTITY_TYPES } from "../constants/wikiEntityTypes.js";

const GRAPH_EXCLUDED_TYPES = new Set([WIKI_ENTITY_TYPES.IDIOMA]);

export function isGraphExcludedEntity(entity) {
    return Boolean(entity && GRAPH_EXCLUDED_TYPES.has(entity.entityType));
}

export function isGraphSelectableEntity(entity) {
    return Boolean(entity && !GRAPH_EXCLUDED_TYPES.has(entity.entityType));
}

/** @param {object[]} entities */
export function filterGraphEntities(entities = []) {
    return entities.filter((e) => !GRAPH_EXCLUDED_TYPES.has(e.entityType));
}

/** @param {object[]} relations @param {Set<string>|string[]} entityIds */
export function filterGraphRelations(relations = [], entityIds) {
    const ids = entityIds instanceof Set ? entityIds : new Set(entityIds);
    return relations.filter((r) => ids.has(r.fromEntityId) && ids.has(r.toEntityId));
}

/** Grafo listo para NEURAL_LAB: entidades + relaciones entre ellas. */
export function buildGraphDataset(entities = [], relations = []) {
    const graphEntities = filterGraphEntities(entities);
    const graphEntityIds = new Set(graphEntities.map((e) => e.id));
    const graphRelations = filterGraphRelations(relations, graphEntityIds);
    return { graphEntities, graphRelations, graphEntityIds };
}

/**
 * Subgrafo ego-céntrico: seed + vecinos hasta `maxHops` (BFS no dirigido).
 * Si el seed no está en el grafo filtrado, se incluye desde `entities` si existe.
 * @param {object[]} entities
 * @param {object[]} relations
 * @param {string} seedId
 * @param {number} [maxHops=2]
 */
export function buildEgoGraphDataset(entities = [], relations = [], seedId, maxHops = 2) {
    const full = buildGraphDataset(entities, relations);
    if (!seedId) return full;

    const hops = Math.max(0, Math.floor(Number(maxHops) || 0));
    const adj = new Map();
    for (const r of full.graphRelations) {
        const a = r.fromEntityId;
        const b = r.toEntityId;
        if (!adj.has(a)) adj.set(a, []);
        if (!adj.has(b)) adj.set(b, []);
        adj.get(a).push(b);
        adj.get(b).push(a);
    }

    const dist = new Map();
    const queue = [];
    if (full.graphEntityIds.has(seedId) || entities.some((e) => e?.id === seedId)) {
        dist.set(seedId, 0);
        queue.push(seedId);
    }

    for (let i = 0; i < queue.length; i++) {
        const id = queue[i];
        const d = dist.get(id) ?? 0;
        if (d >= hops) continue;
        for (const next of adj.get(id) || []) {
            if (dist.has(next)) continue;
            dist.set(next, d + 1);
            queue.push(next);
        }
    }

    if (!dist.size) {
        const seed = entities.find((e) => e?.id === seedId);
        if (seed && isGraphSelectableEntity(seed)) {
            return {
                graphEntities: [seed],
                graphRelations: [],
                graphEntityIds: new Set([seedId]),
            };
        }
        return { graphEntities: [], graphRelations: [], graphEntityIds: new Set() };
    }

    const graphEntityIds = new Set(dist.keys());
    let graphEntities = full.graphEntities.filter((e) => graphEntityIds.has(e.id));
    if (!graphEntities.some((e) => e.id === seedId)) {
        const seed = entities.find((e) => e?.id === seedId);
        if (seed && isGraphSelectableEntity(seed)) {
            graphEntities = [seed, ...graphEntities];
        }
    }
    const graphRelations = filterGraphRelations(full.graphRelations, graphEntityIds);
    return { graphEntities, graphRelations, graphEntityIds };
}
