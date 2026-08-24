import { mergeUnlockedUpgrades } from "./mergeUnlockedUpgrades.js";
import { substituteFormulaTokens } from "./abilityFormula.js";
import { rollResolvedFormula } from "./abilityRollCommands.js";
import { rollAttackD20 } from "./attackRoll.js";

/**
 * One resolve bundle for a unified Play click (Slice 6) — merges unlocked
 * talent/mastery upgrades (G11), rolls the attack d20 once (if needed), and
 * resolves every `DamagePacket.formula` + effect `[]` macro token into a
 * concrete number, all in a single pass. No chat/Firestore writes happen
 * here — `firebase/services/launchToChat.js` posts the returned bundle.
 *
 * Ticket set mirrors `KitCardBodyB2`'s `AttackTicketRow` (Slice 5, already
 * shipped) so the dossier body preview and the chat card always agree:
 * Light + Heavy always resolved, Miss only when `!autoHit`, AoE only when
 * the merged attack carries a `damageAoe` packet.
 *
 * @param {object|null} node — A+ ability/trait/LB (flattened by `useCharacterJobData`).
 * @param {Record<string, unknown>|null|undefined} character
 * @param {{ ctx?: { ownedBaseNodeIds?: string[] }, formulaCtx?: object, isLb?: boolean, attackMods?: { boons?: number, curses?: number } }} [opts]
 * @returns {{
 *   tone: "atk"|"std"|"lb",
 *   hasAttack: boolean,
 *   atk: null|{ autoHit: boolean, outcome: "AUTOHIT"|"HIT"|"MISS"|"CRIT", raw: number|null, total: number|null,
 *     mod: number, polarity: "none"|"boon"|"curse", modifierDice: number[],
 *     light: object|null, heavy: object|null, miss: object|null, aoe: object|null },
 *   effects: Array<{ id: string, lane: string, label: string, resolvedText: string, rolls: object[], from: string|null }>,
 *   range: string|null, aoe: string|null, tags: string[], resolveCost: number|null,
 *   actionCost: unknown, title: string, flavor: string,
 * }}
 */
export function resolveAbilityForPlay(node, character, opts = {}) {
    const { ctx = {}, formulaCtx = {}, isLb = false, attackMods = null } = opts;
    const merged = mergeUnlockedUpgrades(node, character, { ...ctx, isLb }) || {};
    const patches = merged._mergeMeta?.attackPatches || {};
    const effectSources = merged._mergeMeta?.effectSources || {};

    const attack = merged.attack || null;
    const hasAttack = Boolean(merged.hasAttack && attack);
    const autoHit = Boolean(attack?.autoHit);

    const atk = hasAttack ? buildAttackBundle(attack, attackMods, autoHit, formulaCtx, patches) : null;
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
        flavor: merged.blurb || merged.description || "",
    };
}

function buildAttackBundle(attack, attackMods, autoHit, formulaCtx, patches) {
    const d20Result = autoHit ? null : rollAttackD20(attackMods || {});
    let outcome = "AUTOHIT";
    if (d20Result) {
        if (d20Result.d20 === 1) outcome = "MISS";
        else if (d20Result.d20 === 20) outcome = "CRIT";
        else outcome = "HIT";
    }

    const resolvePacket = (key, label) => {
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
    };

    return {
        autoHit,
        outcome,
        raw: d20Result?.d20 ?? null,
        total: d20Result?.total ?? null,
        mod: d20Result?.mod ?? 0,
        polarity: d20Result?.polarity ?? "none",
        modifierDice: d20Result?.modifierDice ?? [],
        light: resolvePacket("damageOnHit", "LIGHT"),
        heavy: resolvePacket("damageOnCrit", "HEAVY"),
        miss: autoHit ? null : resolvePacket("damageOnMiss", "MISS"),
        aoe: attack.damageAoe ? resolvePacket("damageAoe", "AOE") : null,
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
