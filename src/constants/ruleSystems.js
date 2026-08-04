/** Supported TTRPG rule systems for tags / combat templates. */
export const RULE_SYSTEMS = Object.freeze({
    ICON: "icon",
});

export const DEFAULT_RULE_SYSTEM = RULE_SYSTEMS.ICON;

/** @param {unknown} raw */
export function normalizeRulesSystem(raw) {
    const s = String(raw || "").trim().toLowerCase();
    if (s === RULE_SYSTEMS.ICON) return RULE_SYSTEMS.ICON;
    return DEFAULT_RULE_SYSTEM;
}
