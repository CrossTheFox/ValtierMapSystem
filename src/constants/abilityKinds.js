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
 * Trait activation mode (Eje A) — primary taxonomy for kit UI / future wire.
 *
 * ICON Jobs: traits are “unique passive or active abilities” from class + job.
 * In practice kits also use triggered riders and Interrupts (glossary).
 *
 * Planned field (not wired to Firestore UI yet): `traitMode` on type === "trait".
 * Orthogonal to {@link TRAIT_CATEGORIES} (effect-flavor filter).
 *
 * | Mode        | Behavior                         | Play/call | Examples              |
 * |-------------|----------------------------------|-----------|-----------------------|
 * | passive     | Always-on rule / keyword         | no        | Armor 2, Dodge, Slip  |
 * | active      | Costs actions (mini-ability)     | yes       | Prowl, Diaga, Bless   |
 * | trigger     | When X / 1-per-round riders      | optional  | Chain Reaction, Cheap Trick |
 * | interrupt   | Off-turn; interrupts action flow | yes       | tagged Interrupt      |
 *
 * Vigilance spends are reactive “like triggered” but are not Interrupts
 * (glossary) — map those to `trigger`, not `interrupt`.
 */
export const TRAIT_MODES = Object.freeze({
    PASSIVE: "passive",
    ACTIVE: "active",
    TRIGGER: "trigger",
    INTERRUPT: "interrupt",
});

export const TRAIT_MODE_LIST = Object.freeze([
    TRAIT_MODES.PASSIVE,
    TRAIT_MODES.ACTIVE,
    TRAIT_MODES.TRIGGER,
    TRAIT_MODES.INTERRUPT,
]);

export const TRAIT_MODE_LABELS = Object.freeze({
    [TRAIT_MODES.PASSIVE]: "Passive",
    [TRAIT_MODES.ACTIVE]: "Active",
    [TRAIT_MODES.TRIGGER]: "Trigger",
    [TRAIT_MODES.INTERRUPT]: "Interrupt",
});

/** Kit chrome accents for Category Rail (mockup + future dossier). */
export const TRAIT_MODE_COLORS = Object.freeze({
    [TRAIT_MODES.PASSIVE]: "#7dd3fc",
    [TRAIT_MODES.ACTIVE]: "#ff8a3d",
    [TRAIT_MODES.TRIGGER]: "#ff66ff",
    [TRAIT_MODES.INTERRUPT]: "#ff3355",
});

/**
 * Optional effect-flavor filter (legacy dossier grouping).
 * Prefer {@link TRAIT_MODES} for activation / play-button behavior.
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

/**
 * @param {unknown} raw
 * @returns {typeof TRAIT_MODES[keyof typeof TRAIT_MODES]}
 */
export function normalizeTraitMode(raw) {
    const s = String(raw || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_");
    if (s === "passive" || s === "pass") return TRAIT_MODES.PASSIVE;
    if (s === "active" || s === "action" || s === "activable") return TRAIT_MODES.ACTIVE;
    if (s === "trigger" || s === "triggered" || s === "reactive") return TRAIT_MODES.TRIGGER;
    if (s === "interrupt" || s === "int") return TRAIT_MODES.INTERRUPT;
    if (TRAIT_MODE_LIST.includes(s)) return s;
    return TRAIT_MODES.PASSIVE;
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

const HIDDEN_TAG_KEYS = new Set(["homebrew"]);

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
        if (!key || seen.has(key) || HIDDEN_TAG_KEYS.has(key)) continue;
        seen.add(key);
        out.push(key);
    }
    return out;
}

/** Default content when creating a new Attack ability. */
export const DEFAULT_ATTACK_CONTENT = "Ataque. [1d[@{damage-die}]+@{fray}]";
