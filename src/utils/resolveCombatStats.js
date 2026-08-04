import {
    COMBAT_STAT_KEYS,
    clampDamageDie,
    combatDefaultsForArchetype,
    sanitizeCombatPartial,
} from "../constants/combatStats.js";

/**
 * Resolve sheet combat stats: archetype defaults ← job.combatStats ← character.combatOverrides.
 * Legacy `character.vit` is treated as a soft override when `combatOverrides.vit` is absent.
 *
 * @param {Record<string, unknown>|null|undefined} character
 * @param {Record<string, unknown>|null|undefined} claseDoc — primary/active job doc
 * @returns {{
 *   vit: number,
 *   defense: number,
 *   speed: number,
 *   fray: number,
 *   damageDie: number,
 *   armor: number,
 *   vigor: number,
 *   vigorMax: number,
 *   hpMax: number,
 *   dash: number,
 *   sources: { archetype: string, jobId: string|null }
 * }}
 */
export function resolveCombatStats(character = null, claseDoc = null) {
    const archetype = String(
        claseDoc?.classArchetype || character?.classArchetype || "wright",
    )
        .toLowerCase()
        .trim();

    const merged = combatDefaultsForArchetype(archetype);
    const fromJob = sanitizeCombatPartial(claseDoc?.combatStats);
    Object.assign(merged, fromJob);

    const overrides = sanitizeCombatPartial(character?.combatOverrides);
    Object.assign(merged, overrides);

    // Legacy sheet vit (pre-combatOverrides) when no explicit override
    if (overrides.vit == null) {
        const legacy = Number(character?.vit);
        if (Number.isFinite(legacy) && legacy > 0) {
            merged.vit = Math.floor(legacy);
        }
    }

    const vit = Math.max(1, Math.floor(Number(merged.vit) || 4));
    const speed = Math.max(0, Math.floor(Number(merged.speed) || 0));
    const vigor = Math.max(0, Math.floor(Number(merged.vigor) || 0));
    const damageDie = clampDamageDie(merged.damageDie);

    return {
        vit,
        defense: Math.max(0, Math.floor(Number(merged.defense) || 0)),
        speed,
        fray: Math.max(0, Math.floor(Number(merged.fray) || 0)),
        damageDie,
        armor: Math.max(0, Math.floor(Number(merged.armor) || 0)),
        vigor,
        vigorMax: vigor,
        hpMax: vit * 4,
        dash: Math.floor(speed / 2),
        sources: {
            archetype,
            jobId: typeof claseDoc?.id === "string" ? claseDoc.id : null,
        },
    };
}

/**
 * Empty / sparse overrides object for forms (null = inherit from job).
 * @param {Record<string, unknown>|null|undefined} overrides
 * @returns {Record<string, number|"">}
 */
export function combatOverridesForForm(overrides) {
    const src = sanitizeCombatPartial(overrides);
    const out = {};
    for (const key of COMBAT_STAT_KEYS) {
        out[key] = src[key] != null ? src[key] : "";
    }
    return out;
}
