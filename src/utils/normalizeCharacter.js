import {
    DEFAULT_STAT_SYSTEM,
    defaultStatsFromDefinitions,
    emptyBond,
} from "../constants/statSystem";
import { normalizeMacroBar } from "../constants/macroBar";
import { normalizeTokenCrop } from "./tokenImageFit";
import { normalizeBurdens } from "./characterBurdens";
import { resolveCharacterTypeTag } from "./characterRosterKind";
import { normalizeBriefcase } from "./briefcaseGrid";
import {
    DEFAULT_TURN,
    normalizeCharacterVitals,
    normalizeConditions,
    normalizeEffort,
    normalizeTurn,
} from "./characterVitals";

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

    const vitRaw = Number(char.vit);
    const vit = Number.isFinite(vitRaw) && vitRaw > 0 ? Math.floor(vitRaw) : 4;
    const levelRaw = Number(char.level ?? char.stats?.level);
    const level = Number.isFinite(levelRaw) ? Math.max(0, Math.min(12, Math.floor(levelRaw))) : 0;
    const apRaw = Number(char.ap ?? char.abilityPoints ?? char.stats?.ap);
    const ap = Number.isFinite(apRaw) ? Math.max(0, Math.floor(apRaw)) : 0;
    const combatOverrides =
        char.combatOverrides && typeof char.combatOverrides === "object"
            ? { ...char.combatOverrides }
            : {};

    const vitals = normalizeCharacterVitals({ ...char, vit });
    const effort = normalizeEffort(char.effort);
    const turn = char.turn != null ? normalizeTurn(char.turn) : { ...DEFAULT_TURN };
    const conditions = normalizeConditions(char.conditions);
    const hpBroken = typeof char.hpBroken === "boolean" ? char.hpBroken : vitals.hpBroken;

    return {
        ...char,
        assignedClassIds,
        activeClassId,
        vit,
        level,
        ap,
        combatOverrides,
        hpCur: vitals.hpCur,
        vigor: vitals.vigor,
        effort,
        turn,
        conditions,
        hpBroken,
        tokenCrop: normalizeTokenCrop(char.tokenCrop),
        stats: {
            ...defaultStatsFromDefinitions(DEFAULT_STAT_SYSTEM),
            ...(char.stats && typeof char.stats === "object" ? char.stats : {}),
        },
        bond:
            char.bond && typeof char.bond === "object"
                ? { ...emptyBond(), ...char.bond }
                : { ...emptyBond() },
        bondPowers: Array.isArray(char.bondPowers) ? char.bondPowers : [],
        burdens: normalizeBurdens(char.burdens),
        briefcase: normalizeBriefcase(char.briefcase),
        relations: char.relations && typeof char.relations === "object" ? char.relations : {},
        speciesEntityId: typeof char.speciesEntityId === "string" && char.speciesEntityId ? char.speciesEntityId : null,
        /** 1:1 FK to campaigns/{id}/wikiEntities PERSONAJE (narrative facet). */
        narrativeEntityId:
            typeof char.narrativeEntityId === "string" && char.narrativeEntityId
                ? char.narrativeEntityId
                : null,
        organizationMemberships: Array.isArray(char.organizationMemberships) ? char.organizationMemberships : [],
        unlockedAbilities: rawUnl,
        allAbilities,
        macroBar: normalizeMacroBar(char.macroBar),
        // Persistable roster tag from canonical PJ list + explicit type.
        type: resolveCharacterTypeTag(char),
    };
}
