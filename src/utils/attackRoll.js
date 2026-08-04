/**
 * ICON attack d20 with Boons / Curses.
 * Boon N (1–2): roll N d6, keep highest, add to d20.
 * Curse N (1–2): roll N d6, keep highest, subtract from d20.
 * Boons and curses are mutually exclusive.
 */

function clampCount(n) {
    const v = Math.floor(Number(n) || 0);
    if (v <= 0) return 0;
    return Math.min(2, v);
}

function rollD6() {
    return Math.floor(Math.random() * 6) + 1;
}

function rollD20() {
    return Math.floor(Math.random() * 20) + 1;
}

/**
 * @param {{ boons?: number, curses?: number }} [mods]
 * @returns {{
 *   kind: "attack",
 *   d20: number,
 *   polarity: "boon"|"curse"|"none",
 *   modifierDice: number[],
 *   modifierKept: number|null,
 *   rolls: number[],
 *   mod: number,
 *   total: number,
 *   formula: string,
 *   sides: number,
 *   diceCount: number,
 *   mode: null,
 * }}
 */
export function rollAttackD20({ boons = 0, curses = 0 } = {}) {
    let b = clampCount(boons);
    let c = clampCount(curses);
    if (b > 0 && c > 0) {
        // Prefer boons if both somehow set
        c = 0;
    }

    const d20 = rollD20();
    let polarity = "none";
    let modifierDice = [];
    let modifierKept = null;
    let mod = 0;
    let formula = "ATK 1d20";

    if (b > 0) {
        polarity = "boon";
        modifierDice = Array.from({ length: b }, () => rollD6());
        modifierKept = Math.max(...modifierDice);
        mod = modifierKept;
        formula = b === 1 ? "ATK 1d20 +1 boon" : `ATK 1d20 +${b} boon`;
    } else if (c > 0) {
        polarity = "curse";
        modifierDice = Array.from({ length: c }, () => rollD6());
        modifierKept = Math.max(...modifierDice);
        mod = -modifierKept;
        formula = c === 1 ? "ATK 1d20 −1 curse" : `ATK 1d20 −${c} curse`;
    }

    const total = d20 + mod;
    return {
        kind: "attack",
        d20,
        polarity,
        modifierDice,
        modifierKept,
        rolls: [d20],
        mod,
        total,
        formula,
        sides: 20,
        diceCount: 1,
        mode: null,
    };
}
