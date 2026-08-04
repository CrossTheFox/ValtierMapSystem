/**
 * Hotbar / call-from-map: only tactical abilities (not traits, upgrades, masteries, LB, class roots).
 * @param {{ type?: string }|null|undefined} ability
 */
export function isCallableAbility(ability) {
    return ability?.type === "ability";
}

/**
 * @param {Array<{ type?: string }>|null|undefined} abilities
 */
export function filterCallableAbilities(abilities) {
    if (!Array.isArray(abilities)) return [];
    return abilities.filter(isCallableAbility);
}
