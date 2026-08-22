import { WIKI_ENTITY_TYPES } from "../constants/wikiEntityTypes";

/**
 * Index wiki entities by their VTT link ids for O(1) lookup in VTT lists.
 */
export function buildWikiVttLinkIndex(wikiEntities = []) {
    const byCharacterId = new Map();
    const byLocationId = new Map();

    for (const entity of wikiEntities) {
        if (entity.linkedVttCharacterId) {
            byCharacterId.set(entity.linkedVttCharacterId, entity);
        }
        if (entity.linkedVttLocationId) {
            byLocationId.set(entity.linkedVttLocationId, entity);
        }
    }

    return { byCharacterId, byLocationId };
}

/**
 * Resolve wiki PERSONAJE for a VTT character.
 * Prefer character.narrativeEntityId when `entitiesById` is provided; else index by linkedVttCharacterId.
 *
 * @param {{ byCharacterId: Map }} index
 * @param {string} characterId
 * @param {{ narrativeEntityId?: string|null }|null} [character]
 * @param {Map<string, object>|Record<string, object>|null} [entitiesById]
 */
export function getWikiEntityForCharacter(index, characterId, character = null, entitiesById = null) {
    const narId = character?.narrativeEntityId;
    if (narId && entitiesById) {
        const fromMap = typeof entitiesById.get === "function"
            ? entitiesById.get(narId)
            : entitiesById[narId];
        if (fromMap) return fromMap;
    }
    if (!index || !characterId) return null;
    return index.byCharacterId.get(characterId) || null;
}

export function getWikiEntityForLocation(index, locationId) {
    if (!index || !locationId) return null;
    return index.byLocationId.get(locationId) || null;
}

/** Wiki entity has an active VTT annex link. */
export function hasWikiVttLink(entity) {
    return Boolean(entity?.linkedVttCharacterId || entity?.linkedVttLocationId);
}

/** @returns {"character"|"location"|null} */
export function getWikiVttLinkKind(entity) {
    if (!entity) return null;
    if (entity.entityType === WIKI_ENTITY_TYPES.PERSONAJE && entity.linkedVttCharacterId) {
        return "character";
    }
    if (entity.entityType === WIKI_ENTITY_TYPES.LOCACION && entity.linkedVttLocationId) {
        return "location";
    }
    if (entity.linkedVttCharacterId) return "character";
    if (entity.linkedVttLocationId) return "location";
    return null;
}
