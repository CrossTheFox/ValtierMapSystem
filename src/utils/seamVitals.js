import {
    applyHpWithVitCascadeOnCharacter,
    resolveHpBrokenAfterChange,
    resolveHpDisplayDenom,
} from "./characterVitals.js";

/** Condition codes that block gaining vigor (ICON Shattered / SHA). */
export const VIGOR_BLOCK_CONDITION_CODES = new Set([
    "shattered",
    "SHA",
]);

/**
 * @param {string[]|null|undefined} conditions
 */
export function vigorGainBlocked(conditions) {
    if (!Array.isArray(conditions)) return false;
    return conditions.some((c) => {
        const raw = String(c).trim();
        if (!raw) return false;
        if (VIGOR_BLOCK_CONDITION_CODES.has(raw)) return true;
        const lower = raw.toLowerCase();
        const upper = raw.toUpperCase();
        return VIGOR_BLOCK_CONDITION_CODES.has(lower) || VIGOR_BLOCK_CONDITION_CODES.has(upper);
    });
}

export function clampHpCur(n, hpMax) {
    const max = Math.max(1, Math.floor(Number(hpMax) || 1));
    return Math.max(0, Math.min(max, Math.round(Number(n) || 0)));
}

export function clampVigor(n) {
    return Math.max(0, Math.round(Number(n) || 0));
}

/**
 * Bar fill percentages for P3 seam (matches mockup paintHpBar).
 * @returns {{ denom: number, hpPct: number, vigPct: number }}
 */
export function computeBarPercents(hpMax, hpCur, vigor) {
    const denom = resolveHpDisplayDenom(hpMax, hpCur, vigor);
    const cur = Math.max(0, Math.floor(Number(hpCur) || 0));
    const vig = Math.max(0, Math.floor(Number(vigor) || 0));
    const hpPct = denom > 0 ? (cur / denom) * 100 : 0;
    const vigPct = vig > 0 ? (vig / denom) * 100 : 0;
    return { denom, hpPct, vigPct };
}

/**
 * Map horizontal scrub delta (px) to HP delta (same scale as mockup bindHpScrub).
 */
export function scrubDeltaToValue(deltaPx, barWidthPx, hpMax) {
    const scale = Math.max(1, hpMax) / Math.max(Number(barWidthPx) || 1, 1);
    return Math.round(Number(deltaPx) * scale);
}

/**
 * HP commit for dossier seam — uses the same VIT cascade as HUD F4.
 *
 * @param {Record<string, unknown>} character
 * @param {number} nextHpRaw
 * @param {{
 *   hpMax?: number,
 *   hpCur?: number,
 *   hpBroken?: boolean,
 *   claseDoc?: Record<string, unknown>|null,
 * }} [options]
 * @returns {{ vit: number, hpCur: number, hpBroken: boolean }}
 */
export function commitSeamHpChange(character, nextHpRaw, options = {}) {
    const prevHp = Math.floor(
        Number(options.hpCur ?? character?.hpCur ?? options.hpMax ?? 0) || 0,
    );
    const prevBroken = Boolean(options.hpBroken ?? character?.hpBroken);
    const nextHp = Math.round(Number(nextHpRaw) || 0);

    const result = applyHpWithVitCascadeOnCharacter(
        character,
        nextHp,
        options.claseDoc ?? null,
        prevHp,
    );

    return {
        vit: result.vit,
        hpCur: result.hpCur,
        hpBroken: resolveHpBrokenAfterChange(prevBroken, prevHp, result.hpCur),
    };
}

/**
 * Vigor commit for dossier seam (no ceiling; SHA blocks increases only).
 *
 * @param {number} currentVigor
 * @param {number} nextVigorRaw
 * @param {string[]} [conditions]
 * @returns {{ vigor: number }}
 */
export function commitSeamVigChange(currentVigor, nextVigorRaw, conditions = []) {
    const cur = clampVigor(currentVigor);
    const next = clampVigor(nextVigorRaw);
    if (vigorGainBlocked(conditions) && next > cur) {
        return { vigor: cur };
    }
    return { vigor: next };
}

/** Keys mirrored optimistically to Redux when the dossier edits vitals. */
export const VITALS_REACTIVE_KEYS = Object.freeze([
    "hpCur",
    "vigor",
    "effort",
    "turn",
    "conditions",
    "hpBroken",
    "vit",
]);

/**
 * Build a Redux patch from a dossier `patchDraft` partial (nested merge for turn/effort).
 *
 * @param {Record<string, unknown>|null|undefined} character
 * @param {Record<string, unknown>} partial
 */
export function buildOptimisticVitalsReduxPatch(character, partial) {
    const patch = {};
    if (!partial || typeof partial !== "object") return patch;

    for (const key of VITALS_REACTIVE_KEYS) {
        if (!(key in partial)) continue;
        if (key === "turn" || key === "effort") {
            const base = character?.[key] && typeof character[key] === "object"
                ? character[key]
                : {};
            patch[key] = { ...base, ...partial[key] };
        } else {
            patch[key] = partial[key];
        }
    }
    return patch;
}
