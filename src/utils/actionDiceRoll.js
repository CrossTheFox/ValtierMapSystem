/**
 * ICON narrative / action pool (skill rolls).
 * Base N from the stat → Nd6 keep highest.
 * Boon adds dice; Curse removes dice (net = base + boons − curses).
 * Pool ≤ 0 → 2d6 keep lowest.
 */

function rollD6() {
    return Math.floor(Math.random() * 6) + 1;
}

function clampMod(n) {
    const v = Math.floor(Number(n) || 0);
    return Math.max(0, Math.min(2, v));
}

/**
 * @param {number} statValue
 * @param {string} [statLabel]
 * @param {{ boons?: number, curses?: number }} [mods]
 */
export function resolveActionDicePool(statValue, mods = {}) {
    const base = Math.max(0, Math.floor(Number(statValue) || 0));
    const boons = clampMod(mods.boons);
    const curses = clampMod(mods.curses);
    const net = base + boons - curses;
    return { base, boons, curses, net, isLowest: net <= 0, diceCount: net <= 0 ? 2 : net };
}

/**
 * @param {number} statValue
 * @param {string} [statLabel]
 * @param {{ boons?: number, curses?: number }} [mods]
 */
export function rollIconActionDice(statValue, statLabel = "Stat", mods = {}) {
    const pool = resolveActionDicePool(statValue, mods);
    const { base, boons, curses, net, isLowest, diceCount } = pool;

    const rolls = Array.from({ length: diceCount }, () => rollD6());
    const total = isLowest ? Math.min(...rolls) : Math.max(...rolls);

    const modBits = [];
    if (boons) modBits.push(`+${boons} boon`);
    if (curses) modBits.push(`−${curses} curse`);
    const modSuffix = modBits.length ? ` (${modBits.join(", ")})` : "";

    let formula;
    if (isLowest) {
        formula = `${statLabel} ${base}${modSuffix} → 2d6 (mín)`;
    } else {
        formula = `${statLabel} ${base}${modSuffix} → ${diceCount}d6 (máx)`;
    }

    return {
        rolls,
        mod: 0,
        total,
        mode: isLowest ? "lowest" : "highest",
        formula,
        diceCount,
        sides: 6,
        base,
        boons,
        curses,
        net,
    };
}

/**
 * Human-readable preview before rolling (no RNG).
 * @param {number} statValue
 * @param {{ boons?: number, curses?: number }} [mods]
 */
export function describeActionDicePool(statValue, mods = {}) {
    const { base, boons, curses, net, isLowest, diceCount } = resolveActionDicePool(statValue, mods);
    if (isLowest) {
        return {
            base,
            boons,
            curses,
            net,
            isLowest: true,
            summary: "2d6 · keep lowest",
            detail: net < 0
                ? `Pool ${base}+${boons}−${curses} = ${net} → floor at 0`
                : `Pool ${base}+${boons}−${curses} = 0`,
        };
    }
    return {
        base,
        boons,
        curses,
        net,
        isLowest: false,
        summary: `${diceCount}d6 · keep highest`,
        detail: `Pool ${base}+${boons}−${curses} = ${net}`,
    };
}
