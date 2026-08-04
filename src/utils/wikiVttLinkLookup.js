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

export function getWikiEntityForCharacter(index, characterId) {
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
