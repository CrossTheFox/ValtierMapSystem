/**
 * Entidades excluidas del grafo NEURAL_LAB (no seleccionables, no en la matriz).
 * Idioma: solo nutre fichas de personaje vía refs, no participa en propagación narrativa.
 */
import { WIKI_ENTITY_TYPES } from "../constants/wikiEntityTypes";

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
