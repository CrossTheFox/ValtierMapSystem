/** Density tokens for the player character sheet dialog. */
export const CHARACTER_SHEET_TOKENS = {
    avatarSize: { dialog: 40, popup: 44 },
    tabHeight: 26,
    radarSize: "clamp(200px, 28vw, 360px)",
    chromeMaxRatio: 0.08,
};

export function formatClassLabel(classId, characterName) {
    if (!classId || typeof classId !== "string") return "???";

    let slug = classId.toLowerCase().replace(/^class_/, "").replace(/_primary$/, "");

    // Strip character-name prefix from per-character class slugs (e.g. oni_wright → wright)
    if (characterName) {
        const first = characterName.trim().split(/\s+/)[0]?.toLowerCase();
        if (first && slug.startsWith(`${first}_`)) {
            slug = slug.slice(first.length + 1);
        }
    }

    slug = slug.replace(/_/g, " ").trim();
    if (!slug) return "???";

    return slug.toUpperCase();
}
