import { WIKI_ENTITY_TYPES } from "../constants/wikiEntityTypes.js";
import {
    linkedLocationIdsOf,
    findWikiLocacionForPin,
    findWikiPersonajeForCharacter,
} from "../constants/wiki/archiveIdentity.js";

/**
 * Index wiki entities by their VTT link ids for O(1) lookup in VTT lists.
 * Location index includes every pin in linkedVttLocationIds (1:N).
 */
export function buildWikiVttLinkIndex(wikiEntities = []) {
    const byCharacterId = new Map();
    const byLocationId = new Map();

    for (const entity of wikiEntities) {
        if (entity.linkedVttCharacterId) {
            byCharacterId.set(entity.linkedVttCharacterId, entity);
        }
        for (const locId of linkedLocationIdsOf(entity)) {
            byLocationId.set(locId, entity);
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

/**
 * @param {{ byLocationId: Map }} index
 * @param {string} locationId
 * @param {{ wikiEntityId?: string|null }|null} [location]
 * @param {object[]} [wikiEntities]
 */
export function getWikiEntityForLocation(index, locationId, location = null, wikiEntities = null) {
    if (location && Array.isArray(wikiEntities)) {
        const fromPin = findWikiLocacionForPin(location, wikiEntities);
        if (fromPin) return fromPin;
    }
    if (!index || !locationId) return null;
    return index.byLocationId.get(locationId) || null;
}

/** Wiki entity has an active VTT annex link. */
export function hasWikiVttLink(entity) {
    return Boolean(entity?.linkedVttCharacterId || linkedLocationIdsOf(entity).length);
}

/** @returns {"character"|"location"|null} */
export function getWikiVttLinkKind(entity) {
    if (!entity) return null;
    if (entity.entityType === WIKI_ENTITY_TYPES.PERSONAJE && entity.linkedVttCharacterId) {
        return "character";
    }
    if (entity.entityType === WIKI_ENTITY_TYPES.LOCACION && linkedLocationIdsOf(entity).length) {
        return "location";
    }
    if (entity.linkedVttCharacterId) return "character";
    if (linkedLocationIdsOf(entity).length) return "location";
    return null;
}

export { findWikiPersonajeForCharacter, findWikiLocacionForPin };
