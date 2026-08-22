/**
 * Character burdens: up to 3 significant physical/mental traumas.
 * Always returns length-3; empty slots are null.
 *
 * Clock tracks progress toward clearing: when filled === size, the burden is removed.
 * While active, structured `effect` applies (nullify / penalty / cut / torn).
 * Persist keys stay `action_penance` / `cutted_ability` for backward compat.
 */

export const BURDEN_EFFECT_TYPES = Object.freeze({
    BOND_NULLIFY: "bond_nullify",
    ACTION_PENANCE: "action_penance",
    CUTTED_ABILITY: "cutted_ability",
    TRAIT_TORN: "trait_torn",
});

export const BURDEN_EFFECT_LABELS = Object.freeze({
    [BURDEN_EFFECT_TYPES.BOND_NULLIFY]: "Bond Nullify",
    [BURDEN_EFFECT_TYPES.ACTION_PENANCE]: "Action Penalty",
    [BURDEN_EFFECT_TYPES.CUTTED_ABILITY]: "Cut Ability",
    [BURDEN_EFFECT_TYPES.TRAIT_TORN]: "Trait Torn",
});

const EFFECT_TYPE_SET = new Set(Object.values(BURDEN_EFFECT_TYPES));

/**
 * @param {unknown} raw
 * @returns {null|{ type: string, targetId: string, amount?: 1|2 }}
 */
export function normalizeBurdenEffect(raw) {
    if (!raw || typeof raw !== "object") return null;
    const type = String(raw.type || "").toLowerCase();
    if (!EFFECT_TYPE_SET.has(type)) return null;
    const targetId = typeof raw.targetId === "string" ? raw.targetId.trim() : "";
    if (type === BURDEN_EFFECT_TYPES.ACTION_PENANCE) {
        const amt = Number(raw.amount);
        const amount = amt === 2 ? 2 : 1;
        // Allow type-only draft while picking target in the editor.
        return { type, targetId, amount };
    }
    return { type, targetId };
}

/**
 * @param {unknown} raw
 * @returns {Array<null|{
 *   id: string,
 *   title: string,
 *   text: string,
 *   clockSize: 4|6|8,
 *   clockFilled: number,
 *   consequence: string,
 *   effect: null|{ type: string, targetId: string, amount?: 1|2 },
 * }>}
 */
export function normalizeBurdens(raw) {
    const src = Array.isArray(raw) ? raw : [];
    const out = [null, null, null];
    for (let i = 0; i < 3; i++) {
        const b = src[i];
        if (!b || typeof b !== "object") {
            out[i] = null;
            continue;
        }
        const clockSizeRaw = Number(b.clockSize);
        const clockSize = clockSizeRaw === 6 || clockSizeRaw === 8 ? clockSizeRaw : 4;
        const filledRaw = Number(b.clockFilled);
        const clockFilled = Number.isFinite(filledRaw)
            ? Math.max(0, Math.min(clockSize, Math.floor(filledRaw)))
            : 0;
        out[i] = {
            id: typeof b.id === "string" && b.id ? b.id : `burden_${i}`,
            title: typeof b.title === "string" ? b.title : "",
            text: typeof b.text === "string" ? b.text : "",
            clockSize,
            clockFilled,
            consequence: typeof b.consequence === "string" ? b.consequence : "",
            effect: normalizeBurdenEffect(b.effect),
        };
    }
    return out;
}

/** @param {number} index */
export function emptyBurden(index = 0) {
    return {
        id: `burden_${Date.now()}_${index}`,
        title: "",
        text: "",
        clockSize: 4,
        clockFilled: 0,
        consequence: "",
        effect: null,
    };
}

/** Active (non-null) burdens only. */
export function listActiveBurdens(burdens) {
    return normalizeBurdens(burdens).filter(Boolean);
}

/** Effects from active burdens that have a resolved target (with source burden id). */
export function listActiveBurdenEffects(burdens) {
    return listActiveBurdens(burdens)
        .filter((b) => b.effect?.type && b.effect?.targetId)
        .map((b) => ({ burdenId: b.id, ...b.effect }));
}

/**
 * @param {unknown} burdens
 * @param {string} actionKey
 * @returns {0|1|2}
 */
export function getActionPenance(burdens, actionKey) {
    const key = String(actionKey || "").toLowerCase();
    if (!key) return 0;
    for (const b of listActiveBurdens(burdens)) {
        const e = b.effect;
        if (!e?.targetId || e.type !== BURDEN_EFFECT_TYPES.ACTION_PENANCE) continue;
        if (String(e.targetId).toLowerCase() !== key) continue;
        return e.amount === 2 ? 2 : 1;
    }
    return 0;
}

export function isBondPowerNullified(burdens, bondId) {
    const id = String(bondId || "");
    if (!id) return false;
    return listActiveBurdens(burdens).some(
        (b) => b.effect?.type === BURDEN_EFFECT_TYPES.BOND_NULLIFY
            && b.effect.targetId === id,
    );
}

export function isAbilityCut(burdens, abilityId) {
    const id = String(abilityId || "");
    if (!id) return false;
    return listActiveBurdens(burdens).some(
        (b) => b.effect?.type === BURDEN_EFFECT_TYPES.CUTTED_ABILITY
            && b.effect.targetId === id,
    );
}

export function isTraitTorn(burdens, traitId) {
    const id = String(traitId || "");
    if (!id) return false;
    return listActiveBurdens(burdens).some(
        (b) => b.effect?.type === BURDEN_EFFECT_TYPES.TRAIT_TORN
            && b.effect.targetId === id,
    );
}

/** True when ability/trait id is cut or torn (LB never). */
export function isKitEntryDisabledByBurden(burdens, entryId, entryType) {
    const t = String(entryType || "").toLowerCase();
    if (t === "ultimate" || t === "limit_break" || t === "lb") return false;
    if (t === "trait") return isTraitTorn(burdens, entryId);
    if (t === "ability" || t === "upgrade" || t === "mastery") {
        return isAbilityCut(burdens, entryId);
    }
    return isAbilityCut(burdens, entryId) || isTraitTorn(burdens, entryId);
}

/**
 * Whether a macro bar slot should be blocked by an active burden effect.
 * @param {unknown} burdens
 * @param {{ type?: string, id?: string }|null|undefined} slot
 */
export function isMacroSlotDisabledByBurden(burdens, slot) {
    if (!slot) return false;
    const type = String(slot.type || "").toLowerCase();
    if (type === "ultimate") return false;
    const id = String(slot.id || "");
    if (!id) return false;
    if (type === "shortcut" || id.startsWith("bond:")) {
        const bondId = id.startsWith("bond:") ? id.slice(5) : id;
        return isBondPowerNullified(burdens, bondId);
    }
    if (type === "trait") return isTraitTorn(burdens, id);
    if (type === "ability") return isAbilityCut(burdens, id);
    return false;
}

/**
 * @param {number} base
 * @param {number} penance
 */
export function effectiveActionDice(base, penance) {
    const b = Number.isFinite(Number(base)) ? Math.floor(Number(base)) : 0;
    const p = Number.isFinite(Number(penance)) ? Math.max(0, Math.floor(Number(penance))) : 0;
    return Math.max(0, b - p);
}

/**
 * Whether `effect.targetId` is already used by another burden slot.
 * @param {unknown} burdens
 * @param {{ type?: string, targetId?: string }|null} effect
 * @param {number} [exceptIndex] - slot index to ignore (current editor)
 * @returns {{ ok: boolean, conflictIndex?: number }}
 */
export function assertUniqueBurdenTarget(burdens, effect, exceptIndex = -1) {
    const normalized = normalizeBurdenEffect(effect);
    if (!normalized?.targetId) return { ok: true };
    const list = normalizeBurdens(burdens);
    for (let i = 0; i < list.length; i++) {
        if (i === exceptIndex) continue;
        const other = list[i]?.effect;
        if (!other?.targetId) continue;
        if (other.targetId !== normalized.targetId) continue;
        const kitTypes = new Set([
            BURDEN_EFFECT_TYPES.CUTTED_ABILITY,
            BURDEN_EFFECT_TYPES.TRAIT_TORN,
        ]);
        if (other.type === normalized.type) {
            return { ok: false, conflictIndex: i };
        }
        if (kitTypes.has(other.type) && kitTypes.has(normalized.type)) {
            return { ok: false, conflictIndex: i };
        }
    }
    return { ok: true };
}

/** Set of `${type}:${targetId}` taken by other slots. */
export function takenBurdenTargetKeys(burdens, exceptIndex = -1) {
    const set = new Set();
    const list = normalizeBurdens(burdens);
    for (let i = 0; i < list.length; i++) {
        if (i === exceptIndex) continue;
        const e = list[i]?.effect;
        if (!e?.targetId) continue;
        set.add(`${e.type}:${e.targetId}`);
        if (e.type === BURDEN_EFFECT_TYPES.ACTION_PENANCE) {
            set.add(`action:${String(e.targetId).toLowerCase()}`);
        }
        if (e.type === BURDEN_EFFECT_TYPES.BOND_NULLIFY) {
            set.add(`bond:${e.targetId}`);
        }
        if (e.type === BURDEN_EFFECT_TYPES.CUTTED_ABILITY || e.type === BURDEN_EFFECT_TYPES.TRAIT_TORN) {
            set.add(`kit:${e.targetId}`);
        }
    }
    return set;
}

/**
 * Human-readable effect line for tooltips / viewer.
 * @param {{ type: string, targetId: string, amount?: number }|null|undefined} effect
 * @param {{ targetLabel?: string }} [opts]
 */
export function formatBurdenEffectSummary(effect, opts = {}) {
    const e = normalizeBurdenEffect(effect);
    if (!e) return "";
    const typeLabel = BURDEN_EFFECT_LABELS[e.type] || e.type;
    const target = (opts.targetLabel || e.targetId || "").trim();
    if (e.type === BURDEN_EFFECT_TYPES.ACTION_PENANCE) {
        const name = target ? target.toUpperCase() : e.targetId.toUpperCase();
        return `${typeLabel} · ${name} −${e.amount}`;
    }
    return target ? `${typeLabel} · ${target}` : typeLabel;
}

/** True when clock is full and the burden should be cleared. */
export function isBurdenClockCleared(burden) {
    if (!burden) return false;
    const size = Number(burden.clockSize) || 4;
    const filled = Number(burden.clockFilled) || 0;
    return filled >= size;
}
