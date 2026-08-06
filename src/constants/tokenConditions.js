import { TAG_CATEGORIES } from "./abilityKinds.js";
import { ICON_TAGS_SEED } from "./iconTagsSeed.js";

/** Spanish UI labels for ICON status keys (token menu + badges). */
const STATUS_LABEL_ES = {
    slashed: "Hendido",
    weakened: "Debilitado",
    stunned: "Aturdido",
    sealed: "Sellado",
    pacified: "Pacificado",
    blinded: "Cegado",
    dazed: "Atontado",
    shattered: "Destrozado",
    vulnerable: "Vulnerable",
};

const STATUS_SHORT = {
    slashed: "SLA",
    weakened: "WEA",
    stunned: "STU",
    sealed: "SEA",
    pacified: "PAC",
    blinded: "CEG",
    dazed: "DAZ",
    shattered: "SHA",
    vulnerable: "VUL",
};

/**
 * Fixed combat conditions for VTT token badges — ICON STATUS tags only.
 * @type {{ key: string, label: string, short: string, aliases: string[] }[]}
 */
export const TOKEN_CONDITIONS = ICON_TAGS_SEED
    .filter((t) => t.category === TAG_CATEGORIES.STATUS)
    .map((t) => ({
        key: t.key,
        label: STATUS_LABEL_ES[t.key] || t.label,
        short: STATUS_SHORT[t.key] || String(t.label || t.key).slice(0, 3).toUpperCase(),
        aliases: Array.isArray(t.aliases) ? t.aliases : [],
    }));

export const TOKEN_CONDITION_KEYS = TOKEN_CONDITIONS.map((c) => c.key);

export function normalizeTokenConditions(raw) {
    if (!Array.isArray(raw)) return [];
    const allowed = new Set(TOKEN_CONDITION_KEYS);
    return [...new Set(raw.map(String).filter((k) => allowed.has(k)))];
}

/** Filter conditions by search query (label / key / aliases). */
export function filterTokenConditions(query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return TOKEN_CONDITIONS;
    return TOKEN_CONDITIONS.filter((c) => {
        if (c.key.includes(q) || c.label.toLowerCase().includes(q)) return true;
        return (c.aliases || []).some((a) => String(a).toLowerCase().includes(q));
    });
}
