import { WIKI_ENTITY_TYPES } from "../constants/wikiEntityTypes";
import { getWikiArea, getWikiAreaForEntityType } from "../constants/wiki";

export const VTT_MENTION_PREFIX = {
    LOCATION: "vtt-location:",
    CHARACTER: "vtt-character:",
};

export function isVttMentionId(entityId) {
    return (
        typeof entityId === "string" &&
        (entityId.startsWith(VTT_MENTION_PREFIX.LOCATION) ||
            entityId.startsWith(VTT_MENTION_PREFIX.CHARACTER))
    );
}

export function buildVttLocationMentionId(locationId) {
    return `${VTT_MENTION_PREFIX.LOCATION}${locationId}`;
}

export function buildVttCharacterMentionId(characterId) {
    return `${VTT_MENTION_PREFIX.CHARACTER}${characterId}`;
}

/**
 * Find a character across all campaign locations.
 * @returns {{ character: object, location: object } | null}
 */
export function findCharacterInLocations(characterId, locations = {}) {
    for (const location of Object.values(locations)) {
        const character = location?.characters?.find((c) => c.id === characterId);
        if (character) return { character, location };
    }
    return null;
}

/**
 * Build mention picker items: wiki entities + map tokens (locations/characters).
 * @param {object[]} wikiEntities
 * @param {Record<string, object>} locations
 * @param {string} [excludeEntityId]
 */
export function buildMentionCandidates(wikiEntities = [], locations = {}, excludeEntityId = null) {
    const items = [];
    const seen = new Set();

    for (const ent of wikiEntities) {
        if (ent.id === excludeEntityId) continue;
        items.push({
            id: ent.id,
            title: ent.title,
            entityType: ent.entityType,
            mentionKind: "wiki",
        });
        seen.add(ent.id);
    }

    for (const loc of Object.values(locations)) {
        if (!loc?.id) continue;
        const locMentionId = buildVttLocationMentionId(loc.id);
        if (!seen.has(locMentionId)) {
            items.push({
                id: locMentionId,
                title: loc.name || "Ubicación",
                entityType: WIKI_ENTITY_TYPES.LOCACION,
                mentionKind: "vtt-location",
                vttLocationId: loc.id,
            });
            seen.add(locMentionId);
        }

        for (const char of loc.characters || []) {
            const charMentionId = buildVttCharacterMentionId(char.id);
            if (seen.has(charMentionId)) continue;
            items.push({
                id: charMentionId,
                title: char.name || "Personaje",
                entityType: WIKI_ENTITY_TYPES.PERSONAJE,
                mentionKind: "vtt-character",
                vttCharacterId: char.id,
                vttLocationId: loc.id,
            });
            seen.add(charMentionId);
        }
    }

    return items;
}

/**
 * Resolve a mention click: returns action type for the caller to dispatch.
 * @returns {"wiki" | "vtt-location" | "vtt-character" | null}
 */
export function resolveMentionClick(entityId, { entities = [], locations = {} }) {
    if (!entityId) return null;

    if (entityId.startsWith(VTT_MENTION_PREFIX.LOCATION)) {
        const locationId = entityId.slice(VTT_MENTION_PREFIX.LOCATION.length);
        return locations[locationId] ? { type: "vtt-location", locationId } : null;
    }

    if (entityId.startsWith(VTT_MENTION_PREFIX.CHARACTER)) {
        const characterId = entityId.slice(VTT_MENTION_PREFIX.CHARACTER.length);
        const found = findCharacterInLocations(characterId, locations);
        return found
            ? { type: "vtt-character", characterId, locationId: found.location.id }
            : null;
    }

    const wikiEntity = entities.find((e) => e.id === entityId);
    return wikiEntity ? { type: "wiki", entityId, entity: wikiEntity } : null;
}

/**
 * Tooltip / aria label for a mention link hover.
 * @param {string} entityId
 * @param {{ entities?: object[], locations?: Record<string, object> }} ctx
 * @returns {string}
 */
export function getMentionNavigationHint(entityId, { entities = [], locations = {} } = {}) {
    const resolved = resolveMentionClick(entityId, { entities, locations });
    if (!resolved) return "Ficha no disponible";

    if (resolved.type === "vtt-location") {
        return "Abrir ubicación en el mapa (VTT)";
    }
    if (resolved.type === "vtt-character") {
        return "Abrir personaje en el mapa (VTT)";
    }

    const area = getWikiArea(getWikiAreaForEntityType(resolved.entity.entityType));
    const title = resolved.entity.title || "Sin título";
    return `Ir a ${area.label} — ${title}`;
}
