import { resolveCombatStats } from "./resolveCombatStats.js";
import { normalizeCharacterConditions } from "../constants/characterConditions.js";

/** Default VIT when a character has none set (HP = VIT × 4). */
export const DEFAULT_VIT = 4;

/** Session HP ceiling from current VIT (hpMax = vit × 4). */
export function resolveSessionHpMax(vitCurrent) {
    const v = Math.max(0, Math.floor(Number(vitCurrent) || 0));
    return v * 4;
}

/** Default effort pool size when stat_systems has no override. */
export const DEFAULT_EFFORT_MAX = 3;

/** Play-ready turn trackers (G3). */
export const DEFAULT_TURN = Object.freeze({
    act1: true,
    act2: true,
    move: true,
});

/**
 * True when hpCur exists on the Firestore character doc.
 * @param {Record<string, unknown>|null|undefined} char
 */
export function characterHasPersistedVitals(char) {
    return Number.isFinite(Number(char?.hpCur));
}

/**
 * Build patch to copy legacy sessionPools → character (one-shot migration).
 * @param {Record<string, unknown>} char
 * @param {Record<string, unknown>|null|undefined} sessionPoolEntry
 * @param {number} [effortMax]
 */
export function buildVitalsMigrationPatch(char, sessionPoolEntry, effortMax = DEFAULT_EFFORT_MAX) {
    if (!char || characterHasPersistedVitals(char)) return null;
    if (!sessionPoolEntry || typeof sessionPoolEntry !== "object") return null;

    const vitals = normalizeCharacterVitals(char, { effortMax, sessionPoolEntry });
    return {
        hpCur: vitals.hpCur,
        vigor: vitals.vigor,
        effort: vitals.effort,
        turn: vitals.turn,
        conditions: vitals.conditions,
        hpBroken: vitals.hpBroken,
    };
}

/**
 * Break latched when HP hits 0 (parallel to effort.exhausted).
 * Clears only via explicit cure — not when HP is healed.
 */
export function resolveHpBrokenAfterChange(currentBroken, prevHp, nextHp) {
    if (nextHp <= 0 || (prevHp > 0 && nextHp <= 0)) return true;
    return currentBroken;
}

/**
 * @param {unknown} raw
 * @param {number} [maxDefault]
 * @returns {{ current: number, exhausted: boolean, max?: number }}
 */
export function normalizeEffort(raw, maxDefault = DEFAULT_EFFORT_MAX) {
    const max = Math.max(1, Math.floor(Number(maxDefault) || DEFAULT_EFFORT_MAX));
    const src = raw && typeof raw === "object" ? raw : {};
    const current = Math.min(
        Math.max(Math.floor(Number(src.current) || 0), 0),
        max,
    );
    const exhausted = Boolean(src.exhausted) || current >= max;
    const out = { current, exhausted };
    if (src.max != null && Number.isFinite(Number(src.max))) {
        out.max = Math.max(1, Math.floor(Number(src.max)));
    }
    return out;
}

/**
 * @param {unknown} raw
 * @returns {{ act1: boolean, act2: boolean, move: boolean }}
 */
export function normalizeTurn(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    return {
        act1: src.act1 !== false,
        act2: src.act2 !== false,
        move: src.move !== false,
    };
}

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
export function normalizeConditions(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter((c) => typeof c === "string" && c.trim())
        .map((c) => c.trim());
}

/**
 * Derived HP ceiling from plate VIT (never persist hpMax).
 * @param {Record<string, unknown>|null|undefined} character
 * @param {Record<string, unknown>|null|undefined} [claseDoc]
 * @returns {number}
 */
export function resolveCharacterHpMax(character, claseDoc = null) {
    return resolveCombatStats(character, claseDoc).hpMax;
}

/**
 * Resolved plate VIT for display / clamping.
 * @param {Record<string, unknown>|null|undefined} character
 * @param {Record<string, unknown>|null|undefined} [claseDoc]
 * @returns {number}
 */
export function resolveCharacterVit(character, claseDoc = null) {
    return resolveCombatStats(character, claseDoc).vit;
}

/**
 * Normalize persisted vitals on a character document.
 *
 * @param {Record<string, unknown>|null|undefined} char
 * @param {{
 *   claseDoc?: Record<string, unknown>|null,
 *   effortMax?: number,
 *   sessionPoolEntry?: Record<string, unknown>|null,
 * }} [options]
 */
export function normalizeCharacterVitals(char, options = {}) {
    const { claseDoc = null, effortMax = DEFAULT_EFFORT_MAX, sessionPoolEntry = null } = options;
    const hpMax = resolveCharacterHpMax(char, claseDoc);

    let hpCur;
    if (Number.isFinite(Number(char?.hpCur))) {
        hpCur = Math.floor(Number(char.hpCur));
    } else if (sessionPoolEntry?.hp && Number.isFinite(Number(sessionPoolEntry.hp.current))) {
        hpCur = Math.floor(Number(sessionPoolEntry.hp.current));
    } else {
        hpCur = hpMax;
    }
    hpCur = Math.min(Math.max(hpCur, 0), hpMax);

    let vigor;
    if (Number.isFinite(Number(char?.vigor))) {
        vigor = Math.max(0, Math.floor(Number(char.vigor)));
    } else {
        vigor = 0;
    }

    let effort;
    if (char?.effort != null) {
        effort = normalizeEffort(char.effort, effortMax);
    } else if (sessionPoolEntry?.effort) {
        effort = normalizeEffort(sessionPoolEntry.effort, effortMax);
    } else {
        effort = normalizeEffort(null, effortMax);
    }

    const turn = char?.turn != null ? normalizeTurn(char.turn) : { ...DEFAULT_TURN };
    const conditions = normalizeCharacterConditions(char?.conditions);

    let hpBroken = false;
    if (typeof char?.hpBroken === "boolean") {
        hpBroken = char.hpBroken;
    } else if (sessionPoolEntry?.hp && "broken" in sessionPoolEntry.hp) {
        hpBroken = Boolean(sessionPoolEntry.hp.broken);
    }

    return { hpCur, vigor, effort, turn, conditions, hpBroken, hpMax };
}

/**
 * ICON HP cascade on persisted plate VIT + hpCur.
 *
 * @param {Record<string, unknown>} character
 * @param {number} nextHp
 * @param {Record<string, unknown>|null|undefined} [claseDoc]
 * @returns {{ vit: number, hpCur: number, died: boolean }}
 */
export function applyHpWithVitCascadeOnCharacter(character, nextHp, claseDoc = null, currentHpCur = null) {
    const resolved = resolveCombatStats(character, claseDoc);
    const vitCeiling = Math.max(1, Math.floor(Number(resolved.vit) || DEFAULT_VIT));
    let vitCur = Math.min(
        Math.max(Math.floor(Number(character?.vit ?? vitCeiling) || 0), 0),
        vitCeiling,
    );
    let hp = Math.floor(Number(nextHp) || 0);

    if (hp > 0) {
        const cap = resolveSessionHpMax(vitCur);
        return {
            vit: vitCur,
            hpCur: Math.min(hp, cap),
            died: false,
        };
    }

    if (vitCur <= 1) {
        return {
            vit: 0,
            hpCur: 0,
            died: true,
        };
    }

    vitCur -= 1;
    const refill = resolveSessionHpMax(vitCur);
    return {
        vit: vitCur,
        hpCur: refill,
        died: false,
    };
}

/**
 * When plate VIT is edited directly, retarget hpCur (keep ratio when possible).
 *
 * @param {Record<string, unknown>} character
 * @param {number} nextVit
 * @param {Record<string, unknown>|null|undefined} [claseDoc]
 * @returns {{ vit: number, hpCur: number, died: boolean }}
 */
export function applyVitChangeOnCharacter(character, nextVit, claseDoc = null, currentHpCur = null) {
    const resolved = resolveCombatStats(character, claseDoc);
    const vitCeiling = Math.max(1, Math.floor(Number(resolved.vit) || DEFAULT_VIT));
    const vitCur = Math.min(Math.max(Math.floor(Number(nextVit) || 0), 0), vitCeiling);
    const prevVit = Math.min(
        Math.max(Math.floor(Number(character?.vit ?? vitCeiling) || 0), 0),
        vitCeiling,
    );
    const prevMax = resolveSessionHpMax(prevVit) || 1;
    const prevHpRaw = currentHpCur ?? character?.hpCur;
    const prevHp = Math.min(
        Math.max(Number.isFinite(prevHpRaw) ? Math.floor(prevHpRaw) : prevMax, 0),
        prevMax,
    );
    const nextMax = resolveSessionHpMax(vitCur);
    const ratio = prevMax > 0 ? prevHp / prevMax : 1;
    const nextHp = vitCur <= 0 ? 0 : Math.min(nextMax, Math.max(0, Math.round(ratio * nextMax)));
    return {
        vit: vitCur,
        hpCur: nextHp,
        died: vitCur <= 0,
    };
}

/**
 * Display denominator for HP seam / HUD: max(hpMax, hpCur + vigor).
 * @param {number} hpMax
 * @param {number} hpCur
 * @param {number} vigor
 */
export function resolveHpDisplayDenom(hpMax, hpCur, vigor) {
    const base = Math.max(0, Math.floor(Number(hpMax) || 0));
    const cur = Math.max(0, Math.floor(Number(hpCur) || 0));
    const vig = Math.max(0, Math.floor(Number(vigor) || 0));
    return Math.max(base, cur + vig);
}
