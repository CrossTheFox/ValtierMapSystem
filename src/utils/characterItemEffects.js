import { COMBAT_STAT_KEYS } from "../constants/combatStats.js";
import { ITEM_EFFECT_TYPES, ITEM_OWNER } from "./campaignItems.js";

export function characterCarriedItems(items, characterId) {
    return (items || []).filter(
        (it) => it?.ownerType === ITEM_OWNER.CHARACTER && it.ownerCharacterId === characterId,
    );
}

/**
 * Combat stat deltas from items the character currently carries (vault = off).
 * @returns {Record<string, number>}
 */
export function sumItemStatMods(items, characterId) {
    const out = Object.fromEntries(COMBAT_STAT_KEYS.map((k) => [k, 0]));
    for (const it of characterCarriedItems(items, characterId)) {
        const e = it.effect;
        if (!e || e.type !== ITEM_EFFECT_TYPES.STAT_MOD) continue;
        if (!Object.prototype.hasOwnProperty.call(out, e.targetId)) continue;
        out[e.targetId] += Number(e.amount) || 0;
    }
    return out;
}

export function getActionBoon(items, characterId, actionKey) {
    const key = String(actionKey || "").toLowerCase();
    if (!key) return 0;
    let n = 0;
    for (const it of characterCarriedItems(items, characterId)) {
        const e = it.effect;
        if (e?.type !== ITEM_EFFECT_TYPES.ACTION_BOON) continue;
        if (String(e.targetId || "").toLowerCase() !== key) continue;
        n += e.amount === 2 ? 2 : 1;
    }
    return n;
}

export function isItemGrantedAbility(items, characterId, abilityId) {
    const id = String(abilityId || "");
    if (!id) return false;
    return characterCarriedItems(items, characterId).some(
        (it) => it.effect?.type === ITEM_EFFECT_TYPES.GRANT_ABILITY && it.effect.targetId === id,
    );
}

export function isItemGrantedTrait(items, characterId, traitId) {
    const id = String(traitId || "");
    if (!id) return false;
    return characterCarriedItems(items, characterId).some(
        (it) => it.effect?.type === ITEM_EFFECT_TYPES.GRANT_TRAIT && it.effect.targetId === id,
    );
}

export function applyItemCombatOverlays(combatStats, items, characterId) {
    if (!combatStats || typeof combatStats !== "object") return combatStats;
    const mods = sumItemStatMods(items, characterId);
    const next = { ...combatStats };
    for (const key of COMBAT_STAT_KEYS) {
        if (!mods[key]) continue;
        if (key === "damageDie") {
            const faces = [4, 6, 8, 10, 12];
            const cur = Number(next.damageDie) || 6;
            const idx = Math.max(0, Math.min(faces.length - 1, faces.indexOf(cur) + mods[key]));
            next.damageDie = faces[idx];
            continue;
        }
        next[key] = Math.max(0, Math.floor(Number(next[key]) || 0) + mods[key]);
    }
    if (typeof next.vit === "number") {
        next.hpMax = Math.max(0, next.vit) * 4;
    }
    if (typeof next.speed === "number") {
        next.dash = Math.floor(next.speed / 2);
    }
    if (typeof next.vigor === "number") {
        next.vigorMax = next.vigor;
    }
    return next;
}

export function formatItemEffectChip(effect) {
    if (!effect?.type) return null;
    if (effect.type === ITEM_EFFECT_TYPES.STAT_MOD) {
        const sign = (effect.amount || 0) >= 0 ? "+" : "";
        return `${sign}${effect.amount} ${String(effect.targetId || "stat").toUpperCase()}`;
    }
    if (effect.type === ITEM_EFFECT_TYPES.ACTION_BOON) {
        return `+${effect.amount || 1} ${String(effect.targetId || "action").toUpperCase()}`;
    }
    if (effect.type === ITEM_EFFECT_TYPES.GRANT_TRAIT) return `TRAIT · ${effect.targetId || "?"}`;
    if (effect.type === ITEM_EFFECT_TYPES.GRANT_ABILITY) return `ABILITY · ${effect.targetId || "?"}`;
    return effect.type;
}
