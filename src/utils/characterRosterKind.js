/**
 * Campaign roster kind: player characters (PJ) vs NPCs.
 * Canonical PCs for Valt6-01 — everyone else is NPC unless type is explicitly "pc".
 */

export const PLAYER_CHARACTER_NAMES = Object.freeze([
    "Nyssara",
    "Caelum",
    "Judeth",
    "Mixi",
    "Zymthe",
    "Krell",
]);

const PLAYER_NAME_SET = new Set(
    PLAYER_CHARACTER_NAMES.map((n) => String(n).trim().toLowerCase()),
);

export function normalizeCharacterNameKey(name) {
    return String(name || "").trim().toLowerCase();
}

/**
 * Matches canonical short names against full sheet names
 * ("Judeth Kalain", "Luminous Mixi", "Krell de Rokk").
 * Does not match possessives like "Zymthe's Bike".
 */
export function isKnownPlayerCharacterName(name) {
    const key = normalizeCharacterNameKey(name);
    if (!key) return false;
    if (PLAYER_NAME_SET.has(key)) return true;
    const tokens = key.split(/[\s\-]+/).filter(Boolean);
    for (const known of PLAYER_NAME_SET) {
        if (key.startsWith(`${known} `)) return true;
        if (tokens.includes(known)) return true;
    }
    return false;
}

/**
 * @param {Record<string, unknown>|null|undefined} char
 * @returns {"pc"|"npc"}
 */
export function characterRosterKind(char) {
    if (!char) return "npc";
    // Campaign PCs win over a wrong Firestore type tag.
    if (isKnownPlayerCharacterName(char.name)) return "pc";
    const t = String(char.type || "").toLowerCase();
    if (t === "npc" || t === "deity" || char.isNpc || char.isEnemy) return "npc";
    if (t === "pc" || t === "player") return "pc";
    return "npc";
}

export function isPlayerCharacter(char) {
    return characterRosterKind(char) === "pc";
}

/** Persistable type tag for Firestore / editors. */
export function resolveCharacterTypeTag(char) {
    return characterRosterKind(char) === "pc" ? "pc" : "npc";
}
