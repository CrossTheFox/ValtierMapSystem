/**
 * Archive identity contract (unified persona / place — no duplicate fichas).
 *
 * PERSONAJE — 1:1
 *   characters/{id}     = token, HP, jobs, KIT
 *   wikiEntities PERSONAJE = article, PANGeA, aiImpactBlocks, graph node
 *   FKs: character.narrativeEntityId ↔ entity.linkedVttCharacterId
 *   Cascade apply writes wiki only (never characters/{id}).
 *
 * LOCACION — 1:N
 *   wikiEntities LOCACION = the place (article + graph)
 *   locations/{id}        = map instance (mapId, x/y, pin image, wikiEntityId)
 *   Canonical instance→place FK is on the pin: location.wikiEntityId
 *   Inverse on wiki: linkedVttLocationIds[] (linkedVttLocationId = first, legacy)
 *
 * Cascade source of truth: wikiEntities + entityRelations. Do not rewrite schemas.
 */

import { WIKI_ENTITY_TYPES } from "../wikiEntityTypes.js";

export const ARCHIVE_CASCADE_WRITES = Object.freeze({
    wikiEntities: true,
    entityRelations: true,
    characters: false,
    locations: false,
});

/**
 * Unique pin ids attached to a wiki LOCACION (legacy scalar + array).
 * @param {object|null|undefined} entity
 * @returns {string[]}
 */
export function linkedLocationIdsOf(entity) {
    const fromArray = Array.isArray(entity?.linkedVttLocationIds)
        ? entity.linkedVttLocationIds.filter((id) => typeof id === "string" && id)
        : [];
    const legacy = typeof entity?.linkedVttLocationId === "string" && entity.linkedVttLocationId
        ? entity.linkedVttLocationId
        : null;
    const ids = [...fromArray];
    if (legacy && !ids.includes(legacy)) ids.unshift(legacy);
    return ids;
}

/**
 * Payload to persist inverse pin links on a wiki locacion.
 * @param {string[]} ids
 */
export function locationLinkPatch(ids) {
    const unique = [...new Set((ids || []).filter((id) => typeof id === "string" && id))];
    return {
        linkedVttLocationIds: unique,
        linkedVttLocationId: unique[0] || null,
    };
}

/** @param {{ wikiEntityId?: string|null }|null|undefined} location */
export function wikiEntityIdOfLocation(location) {
    const id = location?.wikiEntityId;
    return typeof id === "string" && id ? id : null;
}

/**
 * @param {object|null|undefined} location  VTT pin
 * @param {object|null|undefined} entity    wiki LOCACION
 */
export function locationMatchesWikiEntity(location, entity) {
    if (!location?.id || !entity) return false;
    if (wikiEntityIdOfLocation(location) === entity.id) return true;
    return linkedLocationIdsOf(entity).includes(location.id);
}

/**
 * @param {object|null|undefined} location
 * @param {object[]} wikiEntities
 * @returns {object|null}
 */
export function findWikiLocacionForPin(location, wikiEntities = []) {
    if (!location) return null;
    const list = Array.isArray(wikiEntities) ? wikiEntities : [];
    const byFk = wikiEntityIdOfLocation(location);
    if (byFk) {
        const hit = list.find((e) => e.id === byFk);
        if (hit) return hit;
    }
    return list.find(
        (e) => e.entityType === WIKI_ENTITY_TYPES.LOCACION && linkedLocationIdsOf(e).includes(location.id)
    ) || null;
}

/**
 * Pins in the current world that instantiate this wiki place.
 * @param {object|null|undefined} entity
 * @param {Record<string, object>|object[]} locations
 * @returns {object[]}
 */
export function collectPinsForWikiLocation(entity, locations = {}) {
    const locList = Array.isArray(locations)
        ? locations
        : Object.values(locations || {});
    if (!entity?.id) return [];
    return locList.filter((loc) => locationMatchesWikiEntity(loc, entity));
}

/**
 * @param {object|null|undefined} entity
 * @param {string} locationId
 */
export function wikiEntityLinksLocation(entity, locationId) {
    if (!entity || !locationId) return false;
    return linkedLocationIdsOf(entity).includes(locationId);
}

/**
 * Prefer character.narrativeEntityId, else linkedVttCharacterId index.
 * @param {{ narrativeEntityId?: string|null }|null} character
 * @param {string} characterId
 * @param {object[]} wikiEntities
 */
function createdAtMs(entity) {
    const t = Date.parse(entity?.createdAt ?? "");
    return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

/**
 * Keep one PERSONAJE per linked VTT character: the one the token points at,
 * else the oldest. Other entity types pass through untouched.
 * @param {object[]} wikiEntities
 * @param {Record<string, { narrativeEntityId?: string|null }>} charactersById
 */
export function dedupePersonajesByVttLink(wikiEntities = [], charactersById = {}) {
    const list = Array.isArray(wikiEntities) ? wikiEntities : [];
    const keepByCharacter = new Map();
    for (const e of list) {
        const charId = e.entityType === WIKI_ENTITY_TYPES.PERSONAJE ? e.linkedVttCharacterId : null;
        if (!charId) continue;
        const current = keepByCharacter.get(charId);
        const canonicalId = charactersById?.[charId]?.narrativeEntityId;
        if (!current || e.id === canonicalId) {
            keepByCharacter.set(charId, e);
        } else if (current.id !== canonicalId && createdAtMs(e) < createdAtMs(current)) {
            keepByCharacter.set(charId, e);
        }
    }
    if (!keepByCharacter.size) return list;
    return list.filter((e) => {
        const charId = e.entityType === WIKI_ENTITY_TYPES.PERSONAJE ? e.linkedVttCharacterId : null;
        return !charId || keepByCharacter.get(charId)?.id === e.id;
    });
}

export function findWikiPersonajeForCharacter(character, characterId, wikiEntities = []) {
    const list = Array.isArray(wikiEntities) ? wikiEntities : [];
    const narId = character?.narrativeEntityId;
    if (narId) {
        const byId = list.find((e) => e.id === narId);
        if (byId) return byId;
    }
    if (!characterId) return null;
    return list.find(
        (e) => e.entityType === WIKI_ENTITY_TYPES.PERSONAJE && e.linkedVttCharacterId === characterId
    ) || null;
}
