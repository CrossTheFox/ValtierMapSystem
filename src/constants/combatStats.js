/**
 * ICON tactical combat stats — job defaults + per-character overrides.
 * Dash and HP max are derived (never stored).
 */

export const COMBAT_STAT_KEYS = Object.freeze([
    "vit",
    "defense",
    "speed",
    "fray",
    "damageDie",
    "armor",
    "vigor",
]);

/** Valid damage-die faces. */
export const DAMAGE_DIE_OPTIONS = Object.freeze([4, 6, 8, 10, 12]);

/**
 * Fallback combat stats by class archetype when a job has no `combatStats`.
 * Reasonable ICON-flavoured starting numbers (editable per job in the GM editor).
 */
export const ARCHETYPE_COMBAT_DEFAULTS = Object.freeze({
    stalwart: {
        vit: 5,
        defense: 10,
        speed: 4,
        fray: 1,
        damageDie: 8,
        armor: 2,
        vigor: 0,
    },
    vagabond: {
        vit: 4,
        defense: 12,
        speed: 5,
        fray: 1,
        damageDie: 8,
        armor: 0,
        vigor: 0,
    },
    mendicant: {
        vit: 4,
        defense: 10,
        speed: 4,
        fray: 1,
        damageDie: 6,
        armor: 0,
        vigor: 0,
    },
    wright: {
        vit: 4,
        defense: 8,
        speed: 4,
        fray: 1,
        damageDie: 6,
        armor: 0,
        vigor: 0,
    },
});

export const DEFAULT_COMBAT_STATS = Object.freeze({
    ...ARCHETYPE_COMBAT_DEFAULTS.wright,
});

/** Macro token aliases → combat stat key */
export const COMBAT_MACRO_ALIASES = Object.freeze({
    vit: "vit",
    defense: "defense",
    speed: "speed",
    dash: "dash",
    fray: "fray",
    "damage-die": "damageDie",
    damagedie: "damageDie",
    armor: "armor",
    vigor: "vigor",
    hp: "hpMax",
    "hp-max": "hpMax",
    hpmax: "hpMax",
});

/**
 * @param {string} [archetype]
 * @returns {typeof DEFAULT_COMBAT_STATS}
 */
export function combatDefaultsForArchetype(archetype) {
    const a = String(archetype || "wright").toLowerCase().trim();
    return { ...(ARCHETYPE_COMBAT_DEFAULTS[a] || ARCHETYPE_COMBAT_DEFAULTS.wright) };
}

/**
 * @param {unknown} n
 * @returns {number}
 */
export function clampDamageDie(n) {
    const v = Math.floor(Number(n) || 6);
    if (DAMAGE_DIE_OPTIONS.includes(v)) return v;
    // nearest valid
    let best = 6;
    let dist = Infinity;
    for (const d of DAMAGE_DIE_OPTIONS) {
        const dd = Math.abs(d - v);
        if (dd < dist) {
            dist = dd;
            best = d;
        }
    }
    return best;
}

/**
 * Normalize a partial combatStats object (job or overrides).
 * @param {Record<string, unknown>|null|undefined} partial
 * @returns {Partial<Record<string, number>>}
 */
export function sanitizeCombatPartial(partial) {
    if (!partial || typeof partial !== "object") return {};
    const out = {};
    for (const key of COMBAT_STAT_KEYS) {
        if (partial[key] == null || partial[key] === "") continue;
        const n = Number(partial[key]);
        if (!Number.isFinite(n)) continue;
        out[key] = key === "damageDie" ? clampDamageDie(n) : Math.floor(n);
    }
    return out;
}

/** Default class resource (power track) by archetype — stored on the job doc. */
export const ARCHETYPE_CLASS_RESOURCE = Object.freeze({
    stalwart: { name: "HEROICS", min: 0, max: 6 },
    vagabond: { name: "FINESSE", min: 0, max: 6 },
    mendicant: { name: "BLESSINGS", min: 0, max: 6 },
    wright: { name: "AETHER", min: 0, max: 6 },
});

/**
 * @param {string} [archetype]
 * @returns {{ name: string, min: number, max: number|null }}
 */
export function classResourceForArchetype(archetype) {
    const a = String(archetype || "wright").toLowerCase().trim();
    return { ...(ARCHETYPE_CLASS_RESOURCE[a] || ARCHETYPE_CLASS_RESOURCE.wright) };
}

/**
 * @param {unknown} partial
 * @returns {{ name: string, min: number, max: number|null }|null}
 */
export function sanitizeClassResource(partial) {
    if (!partial || typeof partial !== "object") return null;
    const name = String(partial.name || partial.label || "").trim();
    if (!name) return null;
    const min = Number.isFinite(Number(partial.min)) ? Math.floor(Number(partial.min)) : 0;
    const maxRaw = partial.max;
    let max = null;
    if (maxRaw != null && maxRaw !== "") {
        const n = Math.floor(Number(maxRaw));
        max = Number.isFinite(n) ? n : null;
    }
    return { name, min, max };
}

/**
 * Job special mechanic (name + rules text) — stored on the job/clase doc.
 * @param {unknown} partial
 * @returns {{ name: string, text: string }|null}
 */
export function sanitizeSpecialMechanic(partial) {
    if (!partial || typeof partial !== "object") return null;
    const name = String(partial.name || partial.label || "").trim();
    const text = String(partial.text || partial.content || partial.body || "").trim();
    if (!name && !text) return null;
    return {
        name: name || "SPECIAL MECHANIC",
        text: text || "",
    };
}

/** Plain dice faces for ability text helpers. */
export const ABILITY_DICE_SNIPPETS = Object.freeze(
    [4, 6, 8, 10, 12, 20].map((faces) => ({
        id: `d${faces}`,
        label: `d${faces}`,
        title: `1d${faces}`,
        insert: `[1d${faces}]`,
    })),
);

/** Insert snippets for the ability command toolbar. */
export const ABILITY_COMMAND_SNIPPETS = Object.freeze([
    {
        id: "atk",
        label: "ATK",
        title: "Marca Attack en el editor (d20 + boons al lanzar). Inserta daño tipico.",
        insert: "[1d[@{damage-die}]+@{fray}]",
    },
    {
        id: "dmg-fray",
        label: "DMG+FRAY",
        title: "1d[damage-die]+fray",
        insert: "[1d[@{damage-die}]+@{fray}]",
    },
    {
        id: "dmg",
        label: "DMG",
        title: "1d[damage-die]",
        insert: "[1d[@{damage-die}]]",
    },
    {
        id: "fray",
        label: "FRAY",
        title: "@{fray}",
        insert: "@{fray}",
    },
    {
        id: "defense",
        label: "DEF",
        title: "@{defense}",
        insert: "@{defense}",
    },
    {
        id: "armor",
        label: "ARM",
        title: "@{armor}",
        insert: "@{armor}",
    },
    {
        id: "speed",
        label: "SPD",
        title: "@{speed}",
        insert: "@{speed}",
    },
    {
        id: "dash",
        label: "DASH",
        title: "@{dash}",
        insert: "@{dash}",
    },
    {
        id: "vit",
        label: "VIT",
        title: "@{vit}",
        insert: "@{vit}",
    },
    {
        id: "vigor",
        label: "VIG",
        title: "@{vigor}",
        insert: "@{vigor}",
    },
]);
