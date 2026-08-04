/** Ability combat kind (orthogonal to Firestore `type`: ability/trait/…). */
export const ABILITY_KINDS = Object.freeze({
    STANDARD: "standard",
    ATTACK: "attack",
});

export const TAG_CATEGORIES = Object.freeze({
    ATTACK: "attack",
    STATUS: "status",
    EFFECT: "effect",
    TRAIT: "trait",
    OTHER: "other",
});

export const TAG_CATEGORY_LIST = Object.freeze(Object.values(TAG_CATEGORIES));

/**
 * Job trait taxonomy (type === "trait").
 * Groups traits in dossier / VTT Configs editors.
 */
export const TRAIT_CATEGORIES = Object.freeze({
    STATUSES: "statuses",
    POSITIVE_EFFECTS: "positive_effects",
    SIMPLE: "simple",
});

export const TRAIT_CATEGORY_LIST = Object.freeze([
    TRAIT_CATEGORIES.STATUSES,
    TRAIT_CATEGORIES.POSITIVE_EFFECTS,
    TRAIT_CATEGORIES.SIMPLE,
]);

export const TRAIT_CATEGORY_LABELS = Object.freeze({
    [TRAIT_CATEGORIES.STATUSES]: "Statuses",
    [TRAIT_CATEGORIES.POSITIVE_EFFECTS]: "Positive effects",
    [TRAIT_CATEGORIES.SIMPLE]: "Simple",
});

/** @param {unknown} raw */
export function normalizeAbilityKind(raw) {
    const s = String(raw || "").trim().toLowerCase();
    if (s === ABILITY_KINDS.ATTACK) return ABILITY_KINDS.ATTACK;
    return ABILITY_KINDS.STANDARD;
}

/** @param {unknown} raw */
export function normalizeTraitCategory(raw) {
    const s = String(raw || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_");
    if (s === "statuses" || s === "status") return TRAIT_CATEGORIES.STATUSES;
    if (
        s === "positive_effects"
        || s === "positive"
        || s === "positiveeffects"
        || s === "buff"
        || s === "boon"
    ) {
        return TRAIT_CATEGORIES.POSITIVE_EFFECTS;
    }
    if (s === "simple" || s === "other" || s === "") return TRAIT_CATEGORIES.SIMPLE;
    if (TRAIT_CATEGORY_LIST.includes(s)) return s;
    return TRAIT_CATEGORIES.SIMPLE;
}

/** @param {unknown} raw */
export function sanitizeTagKeys(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    const seen = new Set();
    for (const item of raw) {
        const key = String(item || "")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, "-")
            .replace(/^-|-$/g, "");
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(key);
    }
    return out;
}

/** Default content when creating a new Attack ability. */
export const DEFAULT_ATTACK_CONTENT = "Ataque. [1d[@{damage-die}]+@{fray}]";
