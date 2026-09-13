/**
 * ICON clock resolution — pure (no Firebase / React).
 * 1 tick = 2 half-steps. Bandas: 1–3 = 0, 4–5 = +0.5, 6 = +1, 6-6+ = +2.
 */

export function bandAdvanceHalfSteps(effectiveDie) {
    const n = Number(effectiveDie);
    if (!Number.isFinite(n) || n <= 3) return 0;
    if (n <= 5) return 1;
    return 2;
}

/**
 * @param {number[]} dice
 * @param {{ selectionMode?: "keep_highest"|"keep_lowest" }} [options]
 * @returns {{ advanceHalfSteps: number, effectiveDie: number|null, breakdown: string, rule: string }}
 */
export function resolveClockRoll(dice, options = {}) {
    const rolls = Array.isArray(dice)
        ? dice.map((d) => Math.floor(Number(d))).filter((d) => d >= 1 && d <= 6)
        : [];
    if (rolls.length === 0) {
        return {
            advanceHalfSteps: 0,
            effectiveDie: null,
            breakdown: "[] → sin dados",
            rule: "empty",
        };
    }

    const selectionMode = options.selectionMode === "keep_lowest"
        ? "keep_lowest"
        : "keep_highest";
    const sixCount = rolls.filter((d) => d === 6).length;
    if (sixCount >= 2) {
        return {
            advanceHalfSteps: 4,
            effectiveDie: null,
            breakdown: `6-6+ (${sixCount}×6) → +2 ticks`,
            rule: "multi-six",
        };
    }

    const effectiveDie = selectionMode === "keep_lowest"
        ? Math.min(...rolls)
        : Math.max(...rolls);
    const advanceHalfSteps = bandAdvanceHalfSteps(effectiveDie);
    const sel = selectionMode === "keep_lowest" ? "min" : "max";
    const band = effectiveDie <= 3 ? "1–3" : effectiveDie <= 5 ? "4–5" : "6 único";
    return {
        advanceHalfSteps,
        effectiveDie,
        breakdown: `[${rolls.join(", ")}] → ${sel}=${effectiveDie} (${band}) → +${advanceHalfSteps / 2} tick(s)`,
        rule: selectionMode,
    };
}

/** Display ticks from persisted half-steps (5 → 2.5). */
export function displayFilled(filledHalfSteps) {
    const n = Number(filledHalfSteps);
    if (!Number.isFinite(n)) return 0;
    return n / 2;
}

export function formatFilledLabel(filledHalfSteps, sizeTicks) {
    const filled = displayFilled(filledHalfSteps);
    const shown = Number.isInteger(filled) ? String(filled) : filled.toFixed(1);
    return `${shown}/${sizeTicks}`;
}

export function sizeHalfSteps(sizeTicks) {
    const n = Math.max(1, Math.floor(Number(sizeTicks) || 4));
    return n * 2;
}

/**
 * Clamp jump-to-target. Re-click of current last fill is a no-op at the call site
 * (same number in → same number out).
 */
export function jumpToHalfSteps(targetHalfSteps, sizeTicks) {
    const cap = sizeHalfSteps(sizeTicks);
    const t = Math.round(Number(targetHalfSteps));
    if (!Number.isFinite(t)) return 0;
    return Math.max(0, Math.min(cap, t));
}

/**
 * @param {{ filledHalfSteps?: number, sizeTicks?: number }} instance
 * @param {number} advanceHalfSteps
 * @param {{ sizeHalfSteps?: number, sizeTicks?: number }} [definition]
 */
export function applyAdvance(instance, advanceHalfSteps, definition = {}) {
    const sizeTicks = definition.sizeTicks
        ?? instance.sizeTicks
        ?? 4;
    const cap = definition.sizeHalfSteps ?? sizeHalfSteps(sizeTicks);
    const current = Math.max(0, Math.round(Number(instance.filledHalfSteps) || 0));
    const delta = Math.max(0, Math.round(Number(advanceHalfSteps) || 0));
    const filledHalfSteps = Math.min(cap, current + delta);
    return {
        filledHalfSteps,
        complete: filledHalfSteps >= cap,
        sizeTicks,
    };
}

export function rollD6Pool(count) {
    const n = Math.max(1, Math.min(12, Math.floor(Number(count) || 1)));
    return Array.from({ length: n }, () => Math.floor(Math.random() * 6) + 1);
}
