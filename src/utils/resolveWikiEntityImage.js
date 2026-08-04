/**
 * Resuelve la ruta de imagen (Firebase Storage o HTTPS) para mostrar en una ficha wiki.
 *
 * Cadena de candidatos (en orden; el primero que cargue gana):
 *   1. wikiEntity.imageUrl
 *   2. Personaje VTT vinculado (tokenImageUrl || imageUrl)
 *   3. Personaje VTT con mismo nombre que el título wiki
 *   4. Pin de locación VTT vinculado
 *   5. Locación VTT con mismo nombre que el título wiki
 */

const TYPE_PERSONAJE = "personaje";
const TYPE_LOCACION = "locacion";

function normalizeName(value = "") {
    return String(value)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/^(el|la|los|las)\s+/i, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, " ");
}

function pushUnique(paths, path) {
    if (path && !paths.includes(path)) paths.push(path);
}

/**
 * @param {Record<string, { characters?: { id: string, imageUrl?: string, tokenImageUrl?: string }[] }>} locations
 * @param {string} characterId
 */
export function findVttCharacter(locations, characterId, charactersById = null) {
    if (!characterId) return null;
    if (charactersById) {
        const fromRoster = charactersById[characterId] || charactersById.get?.(characterId);
        if (fromRoster) return fromRoster;
    }
    if (!locations) return null;
    for (const loc of Object.values(locations)) {
        const char = loc.characters?.find((c) => c.id === characterId);
        if (char) return char;
    }
    return null;
}

/** @param {{ tokenImageUrl?: string, imageUrl?: string }|null|undefined} char */
export function characterImagePath(char) {
    if (!char) return null;
    return char.tokenImageUrl || char.imageUrl || null;
}

/**
 * @param {Record<string, object>|Map|null} charactersById
 * @param {Record<string, object>} locations
 */
function listVttCharacters(charactersById, locations) {
    if (charactersById) {
        const values = typeof charactersById.values === "function"
            ? [...charactersById.values()]
            : Object.values(charactersById);
        if (values.length) return values;
    }
    if (!locations) return [];
    return Object.values(locations).flatMap((loc) => loc.characters ?? []);
}

/**
 * Match wiki title → VTT character by normalized name (exact, then unique partial).
 * @param {string} title
 * @param {Record<string, object>} locations
 * @param {Record<string, object>|Map|null} charactersById
 */
export function findVttCharacterByTitle(title, locations = {}, charactersById = null) {
    const needle = normalizeName(title);
    if (!needle) return null;

    const candidates = listVttCharacters(charactersById, locations);
    const exact = candidates.find((c) => normalizeName(c?.name) === needle);
    if (exact) return exact;

    const partial = candidates.filter((c) => {
        const n = normalizeName(c?.name);
        if (!n || n.length < 3) return false;
        return n.includes(needle) || needle.includes(n);
    });
    return partial.length === 1 ? partial[0] : null;
}

/**
 * @param {string} title
 * @param {Record<string, object>} locations
 */
export function findVttLocationByTitle(title, locations = {}) {
    const needle = normalizeName(title);
    if (!needle || !locations) return null;

    const candidates = Object.values(locations);
    const exact = candidates.find((loc) => normalizeName(loc?.name) === needle);
    if (exact) return exact;

    const partial = candidates.filter((loc) => {
        const n = normalizeName(loc?.name);
        if (!n || n.length < 3) return false;
        return n.includes(needle) || needle.includes(n);
    });
    return partial.length === 1 ? partial[0] : null;
}

/**
 * Ordered unique image paths to try (broken wiki URLs must not block VTT fallbacks).
 * @param {object|null|undefined} entity
 * @param {Record<string, object>} [locations]
 * @param {Record<string, object>|Map|null} [charactersById]
 * @returns {string[]}
 */
export function resolveWikiEntityImageCandidates(entity, locations = {}, charactersById = null) {
    if (!entity) return [];

    const paths = [];
    pushUnique(paths, entity.imageUrl);

    if (entity.linkedVttCharacterId) {
        const char = findVttCharacter(locations, entity.linkedVttCharacterId, charactersById);
        pushUnique(paths, characterImagePath(char));
        if (char?.tokenImageUrl) pushUnique(paths, char.imageUrl);
    }

    const isPersonaje = !entity.entityType || entity.entityType === TYPE_PERSONAJE;
    if (isPersonaje && entity.title) {
        const byTitle = findVttCharacterByTitle(entity.title, locations, charactersById);
        pushUnique(paths, characterImagePath(byTitle));
        if (byTitle?.tokenImageUrl) pushUnique(paths, byTitle.imageUrl);
    }

    if (entity.linkedVttLocationId) {
        pushUnique(paths, locations[entity.linkedVttLocationId]?.imageUrl);
    }

    if (entity.entityType === TYPE_LOCACION && entity.title) {
        pushUnique(paths, findVttLocationByTitle(entity.title, locations)?.imageUrl);
    }

    return paths;
}

/**
 * @param {object|null|undefined} entity
 * @param {Record<string, object>} [locations]
 * @param {Record<string, object>|Map|null} [charactersById]
 * @returns {string|null}
 */
export function resolveWikiEntityImagePath(entity, locations = {}, charactersById = null) {
    return resolveWikiEntityImageCandidates(entity, locations, charactersById)[0] ?? null;
}

/**
 * @returns {"wiki"|"vtt_character"|"vtt_location"|null}
 */
export function resolveWikiEntityImageSource(entity, locations = {}, charactersById = null) {
    if (!entity) return null;
    if (entity.imageUrl) return "wiki";

    if (
        entity.linkedVttCharacterId
        && characterImagePath(findVttCharacter(locations, entity.linkedVttCharacterId, charactersById))
    ) {
        return "vtt_character";
    }

    const isPersonaje = !entity.entityType || entity.entityType === TYPE_PERSONAJE;
    if (
        isPersonaje
        && entity.title
        && characterImagePath(findVttCharacterByTitle(entity.title, locations, charactersById))
    ) {
        return "vtt_character";
    }

    if (entity.linkedVttLocationId && locations[entity.linkedVttLocationId]?.imageUrl) {
        return "vtt_location";
    }

    if (
        entity.entityType === TYPE_LOCACION
        && entity.title
        && findVttLocationByTitle(entity.title, locations)?.imageUrl
    ) {
        return "vtt_location";
    }

    return null;
}
