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
 * Sheet / full HP max at full VIT (VIT_max × 4).
 * @param {{ vit?: unknown }|null|undefined} character
 * @returns {number}
 */
export function resolveHpMax(character) {
    return resolveVit(character) * 4;
}

/**
 * Session HP ceiling from current VIT.
 * Each lost VIT drops max HP by 1/4 of the full pool → HP_max = VIT_current × 4.
 * @param {number} vitCurrent
 * @returns {number}
 */
export function resolveSessionHpMax(vitCurrent) {
    const v = Math.max(0, Math.floor(Number(vitCurrent) || 0));
    return v * 4;
}

/**
 * Apply HP set with ICON VIT cascade:
 * - HP > 0: clamp to session max from current VIT
 * - HP ≤ 0 and VIT > 1: lose 1 VIT, refill HP to the new max
 * - HP ≤ 0 and VIT ≤ 1: VIT 0 / HP 0 (dead)
 *
 * @param {{ vit?: { current?: number }, hp?: { current?: number } }} pools
 * @param {number} vitMax
 * @param {number} nextHp
 * @returns {{ vit: { current: number }, hp: { current: number }, died: boolean }}
 */
export function applyHpWithVitCascade(pools, vitMax, nextHp) {
    const vmax = Math.max(1, Math.floor(Number(vitMax) || DEFAULT_VIT));
    let vitCur = Math.min(
        Math.max(Math.floor(Number(pools?.vit?.current ?? vmax) || 0), 0),
        vmax,
    );
    let hp = Math.floor(Number(nextHp) || 0);

    if (hp > 0) {
        const cap = resolveSessionHpMax(vitCur);
        return {
            vit: { ...(pools?.vit || {}), current: vitCur },
            hp: { ...(pools?.hp || {}), current: Math.min(hp, cap) },
            died: false,
        };
    }

    // HP depleted → burn a VIT (or die at last VIT).
    if (vitCur <= 1) {
        return {
            vit: { ...(pools?.vit || {}), current: 0 },
            hp: { ...(pools?.hp || {}), current: 0 },
            died: true,
        };
    }

    vitCur -= 1;
    const refill = resolveSessionHpMax(vitCur);
    return {
        vit: { ...(pools?.vit || {}), current: vitCur },
        hp: { ...(pools?.hp || {}), current: refill },
        died: false,
    };
}

/**
 * When VIT current is edited directly, retarget HP max (keep ratio when possible).
 * @param {{ vit?: { current?: number }, hp?: { current?: number } }} pools
 * @param {number} vitMax
 * @param {number} nextVit
 */
export function applyVitChange(pools, vitMax, nextVit) {
    const vmax = Math.max(1, Math.floor(Number(vitMax) || DEFAULT_VIT));
    const vitCur = Math.min(Math.max(Math.floor(Number(nextVit) || 0), 0), vmax);
    const prevVit = Math.min(
        Math.max(Math.floor(Number(pools?.vit?.current ?? vmax) || 0), 0),
        vmax,
    );
    const prevMax = resolveSessionHpMax(prevVit) || 1;
    const prevHp = Math.min(
        Math.max(Math.floor(Number(pools?.hp?.current ?? prevMax) || 0), 0),
        prevMax,
    );
    const nextMax = resolveSessionHpMax(vitCur);
    const ratio = prevMax > 0 ? prevHp / prevMax : 1;
    const nextHp = vitCur <= 0 ? 0 : Math.min(nextMax, Math.max(0, Math.round(ratio * nextMax)));
    return {
        vit: { ...(pools?.vit || {}), current: vitCur },
        hp: { ...(pools?.hp || {}), current: nextHp },
        died: vitCur <= 0,
    };
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
