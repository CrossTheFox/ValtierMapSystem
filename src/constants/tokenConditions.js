/** Fixed combat conditions for VTT token badges (docs/vtt.md Priority 2). */
export const TOKEN_CONDITIONS = [
    { key: "cegado", label: "Cegado", short: "CEG" },
    { key: "inmovilizado", label: "Inmovilizado", short: "INM" },
    { key: "ralentizado", label: "Ralentizado", short: "RAL" },
    { key: "vulnerable", label: "Vulnerable", short: "VUL" },
    { key: "doblado", label: "Doblado", short: "DOB" },
];

export const TOKEN_CONDITION_KEYS = TOKEN_CONDITIONS.map((c) => c.key);

export function normalizeTokenConditions(raw) {
    if (!Array.isArray(raw)) return [];
    const allowed = new Set(TOKEN_CONDITION_KEYS);
    return [...new Set(raw.map(String).filter((k) => allowed.has(k)))];
}
