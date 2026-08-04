import { COMBAT_MACRO_ALIASES } from "../constants/combatStats.js";

/**
 * Extract roll command bodies from ability text (supports nested `[1d[@{damage-die}]]`).
 * Only outer brackets that contain `d` or `@{` are kept.
 *
 * @param {string} content
 * @returns {string[]}
 */
export function extractRollCommands(content) {
    const text = String(content || "");
    const out = [];
    let i = 0;
    while (i < text.length) {
        if (text[i] !== "[") {
            i += 1;
            continue;
        }
        let depth = 0;
        let j = i;
        let closed = false;
        for (; j < text.length; j += 1) {
            const ch = text[j];
            if (ch === "[") depth += 1;
            else if (ch === "]") {
                depth -= 1;
                if (depth === 0) {
                    const body = text.slice(i + 1, j).trim();
                    if (body && /[dD]|@\{/.test(body)) out.push(body);
                    i = j + 1;
                    closed = true;
                    break;
                }
            }
        }
        if (!closed) break;
    }
    return out;
}

/**
 * Expand @{token} using resolved combat stats.
 * @param {string} expr
 * @param {Record<string, number>} combatStats
 * @returns {string}
 */
export function expandCombatTokens(expr, combatStats = {}) {
    return String(expr || "").replace(/@\{([a-zA-Z0-9_-]+)\}/g, (_full, rawKey) => {
        const key = String(rawKey || "").toLowerCase();
        const mapped = COMBAT_MACRO_ALIASES[key];
        if (!mapped) return "0";
        const n = Number(combatStats[mapped]);
        return Number.isFinite(n) ? String(Math.floor(n)) : "0";
    });
}

/**
 * Resolve a roll bracket body to an NdM[+/-mod] formula, or null if not a roll.
 * Supports nested die faces: `1d[@{damage-die}]+@{fray}` → `1d8+1`
 *
 * @param {string} rawExpr
 * @param {Record<string, number>} combatStats
 * @returns {string|null}
 */
export function resolveRollExpression(rawExpr, combatStats = {}) {
    let s = expandCombatTokens(rawExpr, combatStats);
    // Collapse remaining nested brackets used only for die size: 1d[8] → 1d8
    s = s.replace(/\[(\d+)\]/g, "$1");
    s = s.replace(/\s+/g, "").toLowerCase();

    // Pure number after expand (e.g. just @{fray}) — not a dice formula
    if (/^\d+$/.test(s)) return null;

    // Must match rollDiceFormula shape
    if (!/^(\d*)d(\d+)([+-]\d+)?$/.test(s)) return null;
    return s;
}

/**
 * Silent NdM[+/-mod] roll (no chat). Same shape as chatService.rollDiceFormula.
 * @param {string} formula
 * @returns {{ rolls: number[], mod: number, total: number, formula: string, sides: number, diceCount: number }|null}
 */
export function rollResolvedFormula(formula) {
    const trimmed = String(formula || "").trim().toLowerCase();
    const match = trimmed.match(/^(\d*)d(\d+)([+-]\d+)?$/);
    if (!match) return null;
    const count = parseInt(match[1] || "1", 10);
    const sides = parseInt(match[2], 10);
    const mod = match[3] ? parseInt(match[3], 10) : 0;
    if (!Number.isFinite(count) || count < 1 || !Number.isFinite(sides) || sides < 2) return null;
    const rolls = [];
    for (let i = 0; i < count; i += 1) {
        rolls.push(Math.floor(Math.random() * sides) + 1);
    }
    const total = rolls.reduce((a, b) => a + b, 0) + mod;
    return {
        rolls,
        mod,
        total,
        formula: trimmed,
        sides,
        diceCount: rolls.length,
    };
}

function faceHot(value, sides) {
    const s = Math.max(2, Math.floor(Number(sides) || 20));
    const r = Math.floor(Number(value) || 0);
    if (r === 1) return "fail";
    if (r === s) return "crit";
    return "normal";
}

function rollHot(rolls, sides) {
    if (!rolls?.length) return "normal";
    if (rolls.length === 1) return faceHot(rolls[0], sides);
    if (rolls.some((r) => faceHot(r, sides) === "crit")) return "crit";
    if (rolls.some((r) => faceHot(r, sides) === "fail")) return "fail";
    return "normal";
}

/** Marker in abilityResolvedText → abilityInlineRolls[index]. */
export const INLINE_ROLL_MARKER_RE = /⟦(\d+)⟧/g;

/**
 * Resolve ability text for chat: roll damage/etc. inline (numbers on the card),
 * expand @{tokens}. Does not emit animated dice messages.
 *
 * @param {string} content
 * @param {Record<string, number>} combatStats
 * @param {{ skipD20?: boolean, rollFn?: typeof rollResolvedFormula }} [opts]
 * @returns {{ displayText: string, inlineRolls: Array<{ formula: string, total: number, rolls: number[], sides: number, mod: number, hot: string }> }}
 */
export function resolveAbilityContentInline(content, combatStats = {}, opts = {}) {
    const skipD20 = Boolean(opts.skipD20);
    const rollFn = opts.rollFn || rollResolvedFormula;
    const text = String(content || "");
    const inlineRolls = [];
    let out = "";
    let i = 0;

    while (i < text.length) {
        if (text[i] !== "[") {
            out += text[i];
            i += 1;
            continue;
        }
        let depth = 0;
        let j = i;
        let closed = false;
        for (; j < text.length; j += 1) {
            if (text[j] === "[") depth += 1;
            else if (text[j] === "]") {
                depth -= 1;
                if (depth === 0) {
                    closed = true;
                    break;
                }
            }
        }
        if (!closed) {
            out += text[i];
            i += 1;
            continue;
        }

        const body = text.slice(i + 1, j).trim();
        if (!body || !/[dD]|@\{/.test(body)) {
            out += text.slice(i, j + 1);
            i = j + 1;
            continue;
        }

        const formula = resolveRollExpression(body, combatStats);
        if (formula) {
            if (skipD20 && /^1?d20([+-]\d+)?$/.test(formula)) {
                // Attack d20 is rolled separately (animated) — omit from card.
                i = j + 1;
                continue;
            }
            const result = rollFn(formula);
            if (result) {
                const idx = inlineRolls.length;
                inlineRolls.push({
                    formula: result.formula,
                    total: result.total,
                    rolls: result.rolls,
                    sides: result.sides,
                    mod: result.mod,
                    hot: rollHot(result.rolls, result.sides),
                });
                out += `⟦${idx}⟧`;
                i = j + 1;
                continue;
            }
        }

        // Token-only bracket e.g. [@{fray}] → plain number
        let expanded = expandCombatTokens(body, combatStats);
        expanded = expanded.replace(/\[(\d+)\]/g, "$1").replace(/\s+/g, "");
        out += expanded;
        i = j + 1;
    }

    out = expandCombatTokens(out, combatStats);
    return { displayText: out, inlineRolls };
}

/**
 * @param {string} content
 * @param {Record<string, number>} combatStats
 * @param {{ skipD20?: boolean }} [opts]
 * @returns {string[]} valid NdM[+/-mod] formulas
 */
export function resolveAbilityRollFormulas(content, combatStats, opts = {}) {
    const cmds = extractRollCommands(content);
    const formulas = [];
    for (const raw of cmds) {
        const f = resolveRollExpression(raw, combatStats);
        if (!f) continue;
        if (opts.skipD20 && /^1?d20([+-]\d+)?$/.test(f)) continue;
        formulas.push(f);
    }
    return formulas;
}
