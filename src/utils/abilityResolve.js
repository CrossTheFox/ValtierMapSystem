import { mergeUnlockedUpgrades } from "./mergeUnlockedUpgrades.js";
import { substituteFormulaTokens } from "./abilityFormula.js";
import { rollResolvedFormula } from "./abilityRollCommands.js";
import { rollAttackD20 } from "./attackRoll.js";
import { inferDefaultActionsSpent } from "./abilityAplus.js";
import { deriveAbilityFlavorText } from "./abilityContentParser.js";

/**
 * One resolve bundle for a unified Play click (Slice 6).
 * Three-tier attack: LIGHT (1D hit) / HEAVY (2D hit) / CRIT (2×max D) / MISS.
 */
export function resolveAbilityForPlay(node, character, opts = {}) {
    const { ctx = {}, formulaCtx = {}, isLb = false, attackMods = null, actionsSpent = null } = opts;
    const merged = mergeUnlockedUpgrades(node, character, { ...ctx, isLb }) || {};
    const patches = merged._mergeMeta?.attackPatches || {};
    const effectSources = merged._mergeMeta?.effectSources || {};

    const attack = merged.attack || null;
    const hasAttack = Boolean(merged.hasAttack && attack);
    const autoHit = Boolean(attack?.autoHit);

    const spent = actionsSpent != null
        ? Number(actionsSpent)
        : inferDefaultActionsSpent(merged);

    const atk = hasAttack ? buildAttackBundle(attack, attackMods, autoHit, formulaCtx, patches, spent) : null;
    const effects = resolveEffects(merged.effects, formulaCtx, effectSources);

    return {
        tone: isLb ? "lb" : hasAttack ? "atk" : "std",
        hasAttack,
        atk,
        effects,
        range: merged.range ?? null,
        aoe: merged.aoe ?? null,
        tags: Array.isArray(merged.tags) ? merged.tags : Array.isArray(merged.tagKeys) ? merged.tagKeys : [],
        resolveCost: merged.resolveCost ?? null,
        actionCost: merged.actionCost ?? null,
        title: merged.label || merged.title || "",
        flavor: deriveAbilityFlavorText(merged),
    };
}

function resolvePacket(attack, key, label, formulaCtx, patches) {
    const packet = attack[key];
    if (!packet || packet.formula == null || packet.formula === "") return null;
    const display = substituteFormulaTokens(packet.formula, formulaCtx);
    const rolled = rollResolvedFormula(display);
    return {
        key,
        label,
        total: rolled ? rolled.total : (Number(display) || 0),
        detail: rolled
            ? `${rolled.formula} → [${rolled.rolls.join(", ")}]${rolled.mod ? (rolled.mod > 0 ? `+${rolled.mod}` : rolled.mod) : ""}`
            : display,
        fromUp: patches[key] || null,
    };
}

function pickActivePacketKey(outcome, actionsSpent, hasHeavyTier) {
    if (outcome === "AUTOHIT") return null;
    if (outcome === "MISS") return "miss";
    if (outcome === "CRIT") return "crit";
    if (outcome === "HIT" && actionsSpent >= 2 && hasHeavyTier) return "heavy";
    return "light";
}

function buildAttackBundle(attack, attackMods, autoHit, formulaCtx, patches, actionsSpent) {
    const d20Result = autoHit ? null : rollAttackD20(attackMods || {});
    let outcome = "AUTOHIT";
    if (d20Result) {
        if (d20Result.d20 === 1) outcome = "MISS";
        else if (d20Result.d20 === 20) outcome = "CRIT";
        else outcome = "HIT";
    }

    const light = resolvePacket(attack, "damageOnHit", "LIGHT", formulaCtx, patches);
    const heavy = attack.damageOnHeavy?.formula
        ? resolvePacket(attack, "damageOnHeavy", "HEAVY", formulaCtx, patches)
        : null;
    const crit = resolvePacket(attack, "damageOnCrit", "CRIT", formulaCtx, patches);
    const miss = autoHit ? null : resolvePacket(attack, "damageOnMiss", "MISS", formulaCtx, patches);
    const aoe = attack.damageAoe?.formula
        ? resolvePacket(attack, "damageAoe", "AOE", formulaCtx, patches)
        : null;

    const activePacket = pickActivePacketKey(outcome, actionsSpent, Boolean(heavy));

    return {
        autoHit,
        outcome,
        raw: d20Result?.d20 ?? null,
        total: d20Result?.total ?? null,
        mod: d20Result?.mod ?? 0,
        polarity: d20Result?.polarity ?? "none",
        modifierDice: d20Result?.modifierDice ?? [],
        light,
        heavy,
        crit,
        miss,
        aoe,
        activePacket,
        actionsSpent,
    };
}

/** Same bracket shape `KitCardBodyB2`'s `EffectRowView` extracts (`(\d*)\[[^\]]+\]`). */
const EFFECT_MACRO_RE = /(\d*)\[[^\]]+\]/g;

function resolveEffects(effects, formulaCtx, effectSources) {
    if (!Array.isArray(effects)) return [];
    return effects.map((fx) => {
        const rolls = [];
        const resolvedText = String(fx?.text || "").replace(EFFECT_MACRO_RE, (m) => {
            const display = substituteFormulaTokens(m, formulaCtx);
            const rolled = rollResolvedFormula(display);
            if (rolled) {
                rolls.push(rolled);
                return String(rolled.total);
            }
            return display;
        });
        return {
            id: fx?.id,
            lane: fx?.lane || "plain",
            label: fx?.label || "",
            resolvedText,
            rolls,
            from: effectSources[fx?.id] || null,
        };
    });
}
