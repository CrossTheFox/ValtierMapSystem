import { DEFAULT_TURN, normalizeTurn } from "./characterVitals.js";
import { clampHpCur } from "./seamVitals.js";
import { activeCharacterConditions } from "../constants/characterConditions.js";

const HUD_BREAK_CHIP = {
    key: "hud-break",
    code: "BREAK",
    title: "Break",
    body: "VIT rota — el personaje está en Break hasta curarlo.",
    color: "#ff2a4a",
    kind: "flag",
};

const HUD_EXHAUSTED_CHIP = {
    key: "hud-exhausted",
    code: "EXHAUSTED",
    title: "Exhausted",
    body: "Effort agotado — no quedan unidades de effort.",
    color: "#f97316",
    kind: "flag",
};

/**
 * HUD F4 status row: vitals flags first, then catalog conditions (SHA first).
 * No hard slice — the HUD fits what the row can hold and parks the rest in the tags drawer.
 *
 * @param {{ hpBroken?: boolean, effortExhausted?: boolean, conditions?: unknown }} opts
 * @returns {Array<{ key: string, code: string, title: string, body: string, color: string, kind: string }>}
 */
export function buildHudStatusChips(opts = {}) {
    const chips = [];
    if (opts.hpBroken) chips.push({ ...HUD_BREAK_CHIP });
    if (opts.effortExhausted) chips.push({ ...HUD_EXHAUSTED_CHIP });
    const rank = (c) => (c.key === "shattered" ? 0 : 1);
    const conds = [...activeCharacterConditions(opts.conditions)].sort((a, b) => rank(a) - rank(b));
    for (const c of conds) {
        chips.push({
            key: c.key,
            code: c.code,
            title: c.title,
            body: c.effect,
            color: c.color,
            kind: "condition",
        });
    }
    return chips;
}

const TURN_KEYS = new Set(["act1", "act2", "move"]);

/**
 * Mockup BEHAVIOR SPEC §2 — `(+)` is visible only if assignedCount > 1 or DM.
 * Does not read or write `hpCur` / `effort` / `vigor`.
 *
 * @param {{ assignedCount?: number, isDm?: boolean }} opts
 */
export function shouldShowPrincipalPlus(opts = {}) {
    const assignedCount = Math.max(0, Math.floor(Number(opts.assignedCount) || 0));
    return Boolean(opts.isDm) || assignedCount > 1;
}

/**
 * Mockup BEHAVIOR SPEC §3 — eject from the session stack.
 * If the ejected row is the principal, the next assigned id becomes principal.
 * Returns only roster ids — never vitals fields.
 *
 * @param {{
 *   ejectedId?: string|null,
 *   principalId?: string|null,
 *   assignedIds?: string[],
 *   stackIds?: string[],
 * }} opts
 */
export function nextPrincipalAfterEject(opts = {}) {
    const ejectedId = opts.ejectedId ? String(opts.ejectedId) : null;
    const principalId = opts.principalId ? String(opts.principalId) : null;
    const assignedIds = Array.isArray(opts.assignedIds)
        ? opts.assignedIds.map(String).filter(Boolean)
        : [];
    const stackIds = Array.isArray(opts.stackIds)
        ? opts.stackIds.map(String).filter(Boolean)
        : [];

    const remainingAssignedIds = assignedIds.filter((id) => id !== ejectedId);
    const remainingStackIds = stackIds.filter((id) => id !== ejectedId);

    let nextPrincipalId = principalId && principalId !== ejectedId
        ? principalId
        : (remainingAssignedIds[0] ?? remainingStackIds[0] ?? null);

    if (principalId === ejectedId) {
        nextPrincipalId = remainingAssignedIds[0] ?? remainingStackIds[0] ?? null;
    }

    return {
        nextPrincipalId,
        remainingAssignedIds,
        remainingStackIds,
        hidePlus: remainingAssignedIds.length <= 1,
    };
}

/**
 * Effort blades (0-based from the first unit, same semantics as the live HUD bar).
 * Click a lit blade → drop `effort.current` to that index.
 * Click an empty blade → raise `effort.current` to index + 1.
 *
 * @param {number} clickedIndex
 * @param {number} current
 * @param {number} max
 * @returns {{ effort: { current: number, exhausted: boolean } }}
 */
export function effortBladeCommit(clickedIndex, current, max) {
    const cap = Math.max(1, Math.floor(Number(max) || 1));
    const cur = Math.min(Math.max(Math.floor(Number(current) || 0), 0), cap);
    const idx = Math.floor(Number(clickedIndex));
    if (!Number.isFinite(idx) || idx < 0 || idx >= cap) {
        return { effort: { current: cur, exhausted: cur >= cap } };
    }
    const next = idx < cur ? idx : idx + 1;
    const clamped = Math.min(Math.max(next, 0), cap);
    return {
        effort: {
            current: clamped,
            exhausted: clamped >= cap,
        },
    };
}

/**
 * TURN trackers only (I4) — toggles one of `act1` | `act2` | `move`.
 * Returns the full `character.turn` object so persistVitals can replace it.
 *
 * @param {Record<string, unknown>|null|undefined} turn
 * @param {"act1"|"act2"|"move"} key
 * @returns {{ act1: boolean, act2: boolean, move: boolean }}
 */
export function toggleTurn(turn, key) {
    const base = turn && typeof turn === "object"
        ? normalizeTurn(turn)
        : { ...DEFAULT_TURN };
    if (!TURN_KEYS.has(key)) return base;
    return { ...base, [key]: !base[key] };
}

/**
 * Map a 0..1 click along the HUD HP hatch to `character.hpCur` (clamp 0..hpMax).
 *
 * @param {number} ratio
 * @param {number} hpMax
 */
export function hpFromBarRatio(ratio, hpMax) {
    const t = Math.min(Math.max(Number(ratio) || 0, 0), 1);
    return clampHpCur(Math.round(t * (Number(hpMax) || 0)), hpMax);
}
