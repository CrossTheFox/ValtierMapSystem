import {
    DEFAULT_STAT_SYSTEM,
    defaultStatsFromDefinitions,
    emptyBond,
} from "../constants/statSystem";

/**
 * Convierte Timestamp de Firestore (SDK web u objeto {seconds,nanoseconds}) a ISO string
 * para que Redux Toolkit no reciba valores no serializables.
 *
 * @param {Record<string, unknown>} obj
 */
function shallowSerializeFirestoreTimestamps(obj) {
    const out = { ...obj };
    for (const key of Object.keys(out)) {
        const v = out[key];
        if (v == null || typeof v !== "object") continue;
        if (typeof v.toDate === "function") {
            try {
                out[key] = v.toDate().toISOString();
            } catch {
                delete out[key];
            }
        }
    }
    return out;
}

/**
 * Ensures a Firestore character document has the same baseline fields the GM
 * editor and player sheet expect (stats keys, bond shape, arrays).
 *
 * @param {Record<string, unknown>} char
 * @returns {Record<string, unknown>}
 */
export function normalizeCharacterDoc(char) {
    if (!char || typeof char !== "object") return char;
    char = shallowSerializeFirestoreTimestamps(char);
    const rawAll = Array.isArray(char.allAbilities) ? char.allAbilities : [];
    const rawUnl = Array.isArray(char.unlockedAbilities) ? char.unlockedAbilities : [];
    const allAbilities = rawAll.length > 0 ? rawAll : rawUnl.length > 0 ? [...rawUnl] : [];
    const assignedClassIds = Array.isArray(char.assignedClassIds) ? char.assignedClassIds : [];
    let activeClassId = typeof char.activeClassId === "string" && char.activeClassId ? char.activeClassId : null;
    if (assignedClassIds.length) {
        if (!activeClassId || !assignedClassIds.includes(activeClassId)) {
            activeClassId = assignedClassIds[0];
        }
    } else {
        activeClassId = null;
    }

    return {
        ...char,
        assignedClassIds,
        activeClassId,
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
        speciesEntityId: typeof char.speciesEntityId === "string" && char.speciesEntityId ? char.speciesEntityId : null,
        organizationMemberships: Array.isArray(char.organizationMemberships) ? char.organizationMemberships : [],
        unlockedAbilities: rawUnl,
        allAbilities,
    };
}
