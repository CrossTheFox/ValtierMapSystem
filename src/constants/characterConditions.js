/**
 * Full 25-code condition catalog — Slice 7 (`PHASE-03-GUIDE.md` §7.1). Ports
 * the mockup's `COND_DEFS` 1:1 (`docs/mockups/kit-job-header/index.html`
 * ~line 6497) across the 4 groups defined in `conditions-and-tags.md`:
 * boons (positive), ongoing, statuses (negative, ICON set), sufferings.
 *
 * `character.conditions[]` is the G12 single source of truth (dossier COND
 * drawer + `MapContextMenu` both read/write this same array; Pixi token
 * badges only read it). Each entry's `key` is the string stored in that
 * array:
 * - The 9 pre-existing ICON statuses keep their long-form legacy key
 *   (`slashed`, `weakened`, …) so no data migration is needed for characters
 *   that already carry them (see `src/constants/tokenConditions.js`).
 * - The 16 net-new codes (boons/ongoing/suffer + Blinded's alias) use the
 *   lowercase 3-letter `code` as their `key` (`for`, `bls`, `ins`, …).
 */

export const COND_GROUPS = [
    { id: "boons", label: "BOONS · POSITIVE", accent: "#5dff9a" },
    { id: "ongoing", label: "ONGOING", accent: "#00f2ea" },
    { id: "statuses", label: "STATUSES · NEGATIVE", accent: "#ff3355" },
    { id: "suffer", label: "SUFFERINGS / FX", accent: "#f5c542" },
];

export const COND_GROUP_ACCENT = Object.fromEntries(COND_GROUPS.map((g) => [g.id, g.accent]));

/**
 * @type {Array<{ code: string, key: string, group: "boons"|"ongoing"|"statuses"|"suffer",
 *   title: string, effect: string, hook: string, color: string }>}
 */
export const CHARACTER_CONDITIONS = [
    // ── Boons · positive ────────────────────────────────────────────────
    { code: "FOR", key: "for", group: "boons", title: "Fortified", color: "#5dffc8",
        effect: "Gain Armor / reduce incoming damage while active.", hook: "incomingArmorBonus" },
    { code: "BLS", key: "bls", group: "boons", title: "Blessed", color: "#5dffc8",
        effect: "Gain a boon on saves or designated checks while Blessed.", hook: "saveBoon" },
    { code: "INS", key: "ins", group: "boons", title: "Inspired", color: "#5dffc8",
        effect: "Positive combat edge (attack/check boon) while Inspired.", hook: "attackBoon" },
    { code: "CTR", key: "ctr", group: "boons", title: "Counter", color: "#5dffc8",
        effect: "When hit by an attack, retaliate once per Counter grant (as written).", hook: "onHitRetaliate" },
    { code: "DOG", key: "dog", group: "boons", title: "Dodge", color: "#5dffc8",
        effect: "Avoid one attack or force a miss; usually consumed on use.", hook: "avoidAttackOnce" },
    { code: "EVA", key: "eva", group: "boons", title: "Evasion", color: "#5dffc8",
        effect: "Harder to hit / miss chance while Evasion holds.", hook: "evasionBonus" },
    { code: "FLY", key: "fly", group: "boons", title: "Flying", color: "#5dffc8",
        effect: "Ignore ground engagement / elevation limits while Flying (as written).", hook: "flyingMovement" },
    { code: "DFI", key: "dfi", group: "boons", title: "Defiance", color: "#5dffc8",
        effect: "Survive lethal once; typically drops to 1 HP / avoids defeat once.", hook: "surviveLethalOnce" },
    { code: "REG", key: "reg", group: "boons", title: "Regeneration", color: "#5dffc8",
        effect: "Heal a fixed amount at a stated cadence (turn / trigger).", hook: "periodicHeal" },

    // ── Ongoing ─────────────────────────────────────────────────────────
    { code: "AUR", key: "aur", group: "ongoing", title: "Aura · Ward", color: "#00f2ea",
        effect: "Continuous area from origin; ends when leaving area unless stated otherwise.", hook: "auraZone" },
    { code: "STN", key: "stn", group: "ongoing", title: "Stance · Guard", color: "#00f2ea",
        effect: "One positive stance at a time; refresh rules on the stance text.", hook: "stanceExclusive" },
    { code: "MRK", key: "mrk", group: "ongoing", title: "Mark · Prey", color: "#00f2ea",
        effect: "Mark link on a target; one per ability per pair; new may replace old.", hook: "markTarget" },
    { code: "COM", key: "com", group: "ongoing", title: "Combo Token", color: "#00f2ea",
        effect: "Spend on next combo-tagged ability for upgraded line; one token max; clears end of combat.", hook: "comboToken" },
    { code: "BLN", key: "bln", group: "ongoing", title: "Blessing Token", color: "#5dffc8",
        effect: "Spend for +1 boon on a save (default); discard all at end of combat.", hook: "blessingToken" },

    // ── Statuses · negative (ICON set, 9 pre-existing legacy keys) ──────
    { code: "SLA", key: "slashed", group: "statuses", title: "Slashed", color: "#ff8a3d",
        effect: "Take damage when moving (per-turn cap as written).", hook: "onMoveDamage" },
    { code: "WEA", key: "weakened", group: "statuses", title: "Weakened", color: "#f5c542",
        effect: "Deal less damage while Weakened.", hook: "outgoingDamageMult" },
    { code: "STU", key: "stunned", group: "statuses", title: "Stunned", color: "#e8e8f0",
        effect: "Limits interrupts; next ability ends turn then clears Stunned.", hook: "interruptBlocked;endTurnAfterAbility" },
    { code: "SEA", key: "sealed", group: "statuses", title: "Sealed", color: "#00f2ea",
        effect: "Cannot inflict statuses while Sealed.", hook: "statusInflictBlocked" },
    { code: "PAC", key: "pacified", group: "statuses", title: "Pacified", color: "#5dff9a",
        effect: "Deal half damage; breaks when you damage a foe.", hook: "outgoingDamageHalf;clearOnDealDamage" },
    { code: "BLI", key: "blinded", group: "statuses", title: "Blinded", color: "#9b8cff",
        effect: "Range capped while Blinded.", hook: "rangeCap" },
    { code: "DAZ", key: "dazed", group: "statuses", title: "Dazed", color: "#a78bfa",
        effect: "Attacks suffer a curse (penalty) while Dazed.", hook: "attackCurse" },
    { code: "SHA", key: "shattered", group: "statuses", title: "Shattered", color: "#ff66ff",
        effect: "Cannot gain or benefit from Vigor while Shattered.", hook: "vigorBlocked" },
    { code: "VUL", key: "vulnerable", group: "statuses", title: "Vulnerable", color: "#ff6680",
        effect: "Take +1 damage per damage instance while Vulnerable.", hook: "incomingDamageBonus" },

    // ── Sufferings / lasting FX ─────────────────────────────────────────
    { code: "BLD", key: "bld", group: "suffer", title: "Bleeding", color: "#f5c542",
        effect: "Take damage at a stated cadence until cleared.", hook: "dotTick" },
    { code: "BRN", key: "brn", group: "suffer", title: "Burning", color: "#f5c542",
        effect: "Take fire/hazard damage over time; may interact with terrain.", hook: "dotTick;hazardTick" },
];

export const CONDITION_BY_KEY = new Map(CHARACTER_CONDITIONS.map((c) => [c.key, c]));
export const CONDITION_BY_CODE = new Map(CHARACTER_CONDITIONS.map((c) => [c.code, c]));
export const CHARACTER_CONDITION_KEYS = CHARACTER_CONDITIONS.map((c) => c.key);

/** Dedup + drop anything outside the 25-code allow-list. Canonical shape of `character.conditions[]`. */
export function normalizeCharacterConditions(raw) {
    if (!Array.isArray(raw)) return [];
    const allowed = new Set(CHARACTER_CONDITION_KEYS);
    return [...new Set(raw.map((v) => String(v).trim()).filter((k) => allowed.has(k)))];
}

/** Resolved catalog rows for every `on` condition, in catalog order. */
export function activeCharacterConditions(raw) {
    const keys = new Set(normalizeCharacterConditions(raw));
    return CHARACTER_CONDITIONS.filter((c) => keys.has(c.key));
}

/** Mirrors the mockup's `has-neg` seam-button rule (statuses + suffer = negative). */
export function hasNegConditions(raw) {
    return activeCharacterConditions(raw).some((c) => c.group === "statuses" || c.group === "suffer");
}

/** Mirrors the mockup's `has-pos` seam-button rule (boons + ongoing = positive, neg wins visually). */
export function hasPosConditions(raw) {
    return activeCharacterConditions(raw).some((c) => c.group === "boons" || c.group === "ongoing");
}

/** `{ boons: 2, ongoing: 0, statuses: 1, suffer: 0 }` — drawer group-header counts. */
export function conditionGroupCounts(raw) {
    const active = activeCharacterConditions(raw);
    return Object.fromEntries(COND_GROUPS.map((g) => [g.id, active.filter((c) => c.group === g.id).length]));
}

/** Filter the full 25-code catalog by search query (code / key / title) — used by `MapContextMenu`. */
export function filterCharacterConditions(query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return CHARACTER_CONDITIONS;
    return CHARACTER_CONDITIONS.filter((c) =>
        c.key.includes(q) || c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q));
}
