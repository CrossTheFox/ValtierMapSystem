/**
 * ICON damage-dice (D) helpers for A+ attack packets.
 * Light ≈ 1D, Heavy ≈ 2D, Crit = 2× max(D_light, D_heavy).
 */

/**
 * Count damage dice (D) in an A+ formula string.
 * Supports `Nd[damageDie]`, `N[damageDie]`, bare `[damageDie]` (=1D).
 * @param {string|null|undefined} formula
 * @returns {number}
 */
export function countDamageDice(formula) {
    if (!formula) return 0;
    const s = String(formula).replace(/\s+/g, "");
    const dice = s.match(/^(\d*)d\[damageDie\]/i);
    if (dice) return dice[1] ? parseInt(dice[1], 10) : 1;
    const shorthand = s.match(/^(\d+)\[damageDie\]/i);
    if (shorthand) return parseInt(shorthand[1], 10);
    if (/\[damageDie\]/i.test(s)) return 1;
    return 0;
}

/**
 * Extract trailing modifiers after the dice portion (e.g. `+[fray]`).
 * @param {string|null|undefined} formula
 * @returns {string}
 */
export function suffixAfterDice(formula) {
    if (!formula) return "";
    const s = String(formula).replace(/\s+/g, "");
    const dice = s.match(/^(\d*)d\[damageDie\](.*)$/i);
    if (dice) return dice[2] || "";
    const shorthand = s.match(/^(\d+)\[damageDie\](.*)$/i);
    if (shorthand) return shorthand[2] || "";
    const bare = s.match(/^\[damageDie\](.*)$/i);
    if (bare) return bare[1] || "";
    return "";
}

/**
 * Build an A+ formula from a dice count and optional suffix.
 * @param {number} diceCount
 * @param {{ suffix?: string, useExplicitCount?: boolean }} [opts]
 * @returns {string}
 */
export function formulaFromDiceCount(diceCount, opts = {}) {
    const n = Math.max(0, Math.floor(Number(diceCount) || 0));
    const suffix = opts.suffix ?? "";
    if (n <= 0) return suffix.replace(/^\++/, "") || "";
    if (n === 1 && !opts.useExplicitCount) return `[damageDie]${suffix}`;
    return `${n}d[damageDie]${suffix}`;
}

/**
 * Double dice count in a formula, preserving suffix mods.
 * @param {string|null|undefined} formula
 * @returns {string|null}
 */
export function doubleDiceInFormula(formula) {
    if (!formula) return null;
    const d = countDamageDice(formula);
    if (d <= 0) return null;
    return formulaFromDiceCount(d * 2, { suffix: suffixAfterDice(formula), useExplicitCount: true });
}

/**
 * CRIT = 2× max(D_light, D_heavy), preserving suffix from the higher-D packet.
 * @param {string|null|undefined} lightFormula
 * @param {string|null|undefined} heavyFormula
 * @returns {string}
 */
export function deriveCritFormula(lightFormula, heavyFormula) {
    const dLight = countDamageDice(lightFormula);
    const dHeavy = countDamageDice(heavyFormula);
    const maxD = Math.max(dLight, dHeavy, 1);
    const critD = maxD * 2;
    const source = dHeavy >= dLight && dHeavy > 0 ? heavyFormula : lightFormula;
    const suffix = suffixAfterDice(source) || suffixAfterDice(lightFormula) || "";
    return formulaFromDiceCount(critD, { suffix, useExplicitCount: true });
}

/**
 * Standard ICON attack packet defaults.
 * @param {{ lightD?: number, heavyD?: number, missFormula?: string, fray?: boolean }} [opts]
 */
export function standardAttackPackets(opts = {}) {
    const lightD = opts.lightD ?? 1;
    const heavyD = opts.heavyD ?? 2;
    const fraySuffix = opts.fray === false ? "" : "+[fray]";
    const light = formulaFromDiceCount(lightD, { suffix: fraySuffix, useExplicitCount: lightD !== 1 });
    const heavy = formulaFromDiceCount(heavyD, { suffix: fraySuffix, useExplicitCount: true });
    const crit = deriveCritFormula(light, heavy);
    const miss = opts.missFormula ?? "[fray]";
    return {
        damageOnHit: { formula: light },
        damageOnHeavy: { formula: heavy },
        damageOnCrit: { formula: crit },
        damageOnMiss: { formula: miss },
    };
}
