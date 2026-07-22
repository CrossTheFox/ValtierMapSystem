/** ICON level grants + narrative chips for the CP2077-style perk tree (L0–L12). */

export const CHAPTER_CAP = { 1: 4, 2: 8, 3: 12 };

export const SKILL_TREE_LAYOUT = {
    COL_W: 210,
    PAD_L: 56,
    SPINE_Y: 620,
    TALENT_DX: 78,
    TALENT_DY: 22,
    MASTERY_DX: 140,
    GAP_CHIP: 36,
    GAP_TRAIT: 56,
    GAP_MAIN: 78,
    GAP_ABILITY: 64,
    NARR_GAP: 40,
    NARR_START: 48,
};

export const NARRATIVE_BY_LEVEL = {
    0: ["CULTURE + KIN", "BOND"],
    1: ["BOND POWER", "IMPROVE ACTION"],
    2: ["BOND POWER", "IMPROVE ACTION"],
    3: ["BOND POWER"],
    4: ["IMPROVE ×2 / BOND"],
    5: ["IMPROVE ACTION"],
    6: ["BOND POWER"],
    7: ["IMPROVE ACTION"],
    8: ["IMPROVE ×2 / BOND"],
    9: ["BOND POWER"],
    10: ["IMPROVE ACTION"],
    11: ["IMPROVE ACTION"],
    12: ["BOND POWER"],
};

export const LEVEL_META = [
    { lvl: 0, ch: 1, combat: "Job + 2 abilities + traits.", narrative: "Culture + Kin · Bond." },
    { lvl: 1, ch: 1, combat: "+2 AP · Limit Break.", narrative: "Bond Power + improve action." },
    { lvl: 2, ch: 1, combat: "Sin grant extra (AP vía XP).", narrative: "Bond Power + improve action." },
    { lvl: 3, ch: 1, combat: "+1 Mastery Point · trait.", narrative: "Bond Power." },
    { lvl: 4, ch: 1, combat: "Ampliar árbol (job +2 AP) o +1 MP.", narrative: "Improve 2 actions o Bond Power." },
    { lvl: 5, ch: 2, combat: "+1 AP.", narrative: "Improve an action." },
    { lvl: 6, ch: 2, combat: "Sin grant extra.", narrative: "Bond Power." },
    { lvl: 7, ch: 2, combat: "+1 Mastery Point.", narrative: "Improve an action." },
    { lvl: 8, ch: 2, combat: "Ampliar árbol (3er job +2 AP) o +1 MP.", narrative: "Improve 2 actions o Bond Power." },
    { lvl: 9, ch: 3, combat: "Trait adicional (cap. 3).", narrative: "Bond Power." },
    { lvl: 10, ch: 3, combat: "+1 Mastery Point.", narrative: "Improve an action." },
    { lvl: 11, ch: 3, combat: "+1 AP.", narrative: "Improve an action." },
    { lvl: 12, ch: 3, combat: "+1 Mastery Point.", narrative: "Bond Power." },
];

export const BANK_GRANTS = {
    1: [{ kind: "ap", label: "+2 AP" }],
    3: [{ kind: "mp", label: "+1 MP" }],
    5: [{ kind: "ap", label: "+1 AP" }],
    7: [{ kind: "mp", label: "+1 MP" }],
    10: [{ kind: "mp", label: "+1 MP" }],
    11: [{ kind: "ap", label: "+1 AP" }],
    12: [{ kind: "mp", label: "+1 MP" }],
};

/** @param {number} level */
export function chapterFromLevel(level) {
    const n = Number(level) || 0;
    if (n >= 9) return 3;
    if (n >= 5) return 2;
    return 1;
}

/** @param {Record<string, unknown>} character */
export function resolveCharacterLevel(character) {
    const raw = character?.level ?? character?.stats?.level;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(0, Math.min(12, Math.floor(n))) : 0;
}

/** @param {Record<string, unknown>} character */
export function resolveCharacterChapter(character) {
    const raw = character?.chapter ?? character?.stats?.chapter;
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1 && n <= 3) return Math.floor(n);
    return chapterFromLevel(resolveCharacterLevel(character));
}
