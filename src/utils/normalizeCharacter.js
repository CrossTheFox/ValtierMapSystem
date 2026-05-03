import {
    DEFAULT_STAT_SYSTEM,
    defaultStatsFromDefinitions,
    emptyBond,
} from "../constants/statSystem";

/**
 * Ensures a Firestore character document has the same baseline fields the GM
 * editor and player sheet expect (stats keys, bond shape, arrays).
 *
 * @param {Record<string, unknown>} char
 * @returns {Record<string, unknown>}
 */
export function normalizeCharacterDoc(char) {
    if (!char || typeof char !== "object") return char;
    const rawAll = Array.isArray(char.allAbilities) ? char.allAbilities : [];
    const rawUnl = Array.isArray(char.unlockedAbilities) ? char.unlockedAbilities : [];
    const allAbilities = rawAll.length > 0 ? rawAll : rawUnl.length > 0 ? [...rawUnl] : [];
    return {
        ...char,
        stats: {
            ...defaultStatsFromDefinitions(DEFAULT_STAT_SYSTEM),
            ...(char.stats && typeof char.stats === "object" ? char.stats : {}),
        },
        bond:
            char.bond && typeof char.bond === "object"
                ? { ...emptyBond(), ...char.bond }
                : { ...emptyBond() },
        bondPowers: Array.isArray(char.bondPowers) ? char.bondPowers : [],
        relations: char.relations && typeof char.relations === "object" ? char.relations : {},
        unlockedAbilities: rawUnl,
        allAbilities,
    };
}
