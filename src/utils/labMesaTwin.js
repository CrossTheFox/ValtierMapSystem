/**
 * The campaign wiki ficha that stands for a Lore ficha at the mesa.
 * `mesa_source` comes from seedCampaignIntoLore; a ficha born in the Lab
 * falls back to same type and same title.
 */

import { findWikiLocacionForPin, findWikiPersonajeForCharacter } from "../constants/wiki/archiveIdentity.js";

function fold(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/**
 * @param {object} labEntity  Lore ficha as the Lab reads it (`mesaSource`, `entityType`, `title`)
 * @param {{ wikiEntities?: object[], characters?: object[], locations?: Record<string, object>|object[] }} ctx
 * @returns {object|null}
 */
export function mesaWikiTwin(labEntity, { wikiEntities = [], characters = [], locations = {} } = {}) {
    if (!labEntity?.id) return null;
    const wiki = Array.isArray(wikiEntities) ? wikiEntities : [];
    const [kind, sourceId] = String(labEntity.mesaSource || "").split(":");
    if (kind === "organizacion" && sourceId) {
        const hit = wiki.find((e) => e.id === sourceId);
        if (hit) return hit;
    }
    if (labEntity.entityType === "personaje") {
        const character = (kind === "character" && characters.find((c) => c.id === sourceId))
            || characters.find((c) => c.ficha_id === labEntity.id)
            || null;
        if (character) {
            const hit = findWikiPersonajeForCharacter(character, character.id, wiki);
            if (hit) return hit;
        }
    }
    if (kind === "location" && sourceId) {
        const list = Array.isArray(locations) ? locations : Object.values(locations || {});
        const location = list.find((loc) => loc?.id === sourceId) || { id: sourceId };
        const hit = findWikiLocacionForPin(location, wiki);
        if (hit) return hit;
    }
    const title = fold(labEntity.title);
    if (!title) return null;
    return wiki.find((e) => e.entityType === labEntity.entityType && fold(e.title) === title) || null;
}
