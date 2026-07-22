/** Default VIT when a character has none set (HP = VIT × 4). */
export const DEFAULT_VIT = 4;

/** Default actions available per turn in the combat HUD. */
export const DEFAULT_ACTIONS_MAX = 3;

/**
 * @param {{ vit?: unknown }|null|undefined} character
 * @returns {number}
 */
export function resolveVit(character) {
    const raw = Number(character?.vit);
    if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
    return DEFAULT_VIT;
}

/**
 * @param {{ vit?: unknown }|null|undefined} character
 * @returns {number}
 */
export function resolveHpMax(character) {
    return resolveVit(character) * 4;
}

/**
 * True for player characters (PCs).
 * @param {Record<string, unknown>|null|undefined} char
 */
export function isPlayerFacingCharacter(char) {
    if (!char) return false;
    if (char.isNpc || char.isEnemy || char.type === "npc") return false;
    const t = String(char.type || "").toLowerCase();
    return Boolean(t === "player" || t === "pc" || char.ownerPlayerId);
}

/**
 * Campaign roster: prefer `charactersById`, merge nested location copies as fallback.
 * @param {Record<string, object>|null|undefined} charactersById
 * @param {Record<string, { characters?: object[] }>|null|undefined} locations
 * @returns {object[]}
 */
export function listCampaignCharacters(charactersById, locations) {
    const byId = new Map();
    Object.values(charactersById || {}).forEach((c) => {
        if (c?.id) byId.set(c.id, c);
    });
    Object.values(locations || {}).forEach((loc) => {
        (loc.characters || []).forEach((c) => {
            if (c?.id && !byId.has(c.id)) byId.set(c.id, c);
        });
    });
    return [...byId.values()];
}

/**
 * Roster rows enriched with location labels for global character browsers.
 * @param {Record<string, object>|null|undefined} charactersById
 * @param {Record<string, { id?: string, name?: string, characters?: object[] }>|null|undefined} locations
 */
export function listCampaignCharactersWithLocation(charactersById, locations) {
    return listCampaignCharacters(charactersById, locations).map((c) => {
        const loc = c.locationId ? locations?.[c.locationId] : null;
        return {
            ...c,
            _locationId: c.locationId || null,
            _locationName: loc?.name || null,
        };
    });
}
