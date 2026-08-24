import { CHAT_MESSAGE_TYPES } from "../constants/chatMessageTypes.js";
import { resolveAbilityContentInline } from "./abilityRollCommands.js";
import { resolveAbilityForPlay } from "./abilityResolve.js";

/**
 * Pure payload builders for `firebase/services/launchToChat.js` (Slice 6).
 * Kept dependency-free from Firestore/`chatService.js` on purpose so they're
 * unit-testable under plain `node --test` (`launchToChatPayload.test.mjs`) —
 * `firebase/firebaseConfig.js` relies on Vite's `import.meta.env` and cannot
 * be imported outside a Vite build/dev context.
 */

/** `kind: "trait"|"mech"` — no attack, no A+ merge, straight text post. */
export function buildLiteChatPayload(node, formulaCtx = {}) {
    const label = String(node?.label || node?.title || "KIT").trim() || "KIT";
    const content = String(node?.blurb ?? node?.description ?? node?.content ?? node?.text ?? "");
    const hasInlineCue = /\[[^\]]*(?:d|@\{)/i.test(content);
    const { displayText, inlineRolls } = hasInlineCue
        ? resolveAbilityContentInline(content, formulaCtx, { skipD20: true })
        : { displayText: content, inlineRolls: [] };

    return {
        type: CHAT_MESSAGE_TYPES.ABILITY,
        text: displayText || content || label,
        abilityId: node?.id ?? node?.key ?? null,
        abilityLabel: label,
        abilityTags: Array.isArray(node?.tagKeys) && node.tagKeys.length ? node.tagKeys : null,
        abilityKind: "standard",
        abilityCost: null,
        abilityInlineRolls: inlineRolls.length ? inlineRolls : null,
        abilityTone: "std",
    };
}

/**
 * `kind: "ability"|"limit_break"` — full A+ resolve (merge + roll) → payload.
 * Accepts an already-computed `resolveAbilityForPlay` bundle via `preResolved`
 * so a caller that already drove the local d20 reveal off of it never rolls
 * twice.
 */
export function buildAbilityChatPayload(node, character, opts = {}) {
    const { ctx = {}, formulaCtx = {}, isLb = false, attackMods = null, preResolved = null } = opts;
    const resolved = preResolved || resolveAbilityForPlay(node, character, {
        ctx, formulaCtx, isLb, attackMods,
    });
    const payload = {
        type: CHAT_MESSAGE_TYPES.ABILITY,
        text: resolved.flavor || "",
        abilityId: node?.id ?? node?.key ?? null,
        abilityLabel: resolved.title || node?.label || node?.title || "ABILITY",
        abilityTags: resolved.tags?.length ? resolved.tags : null,
        abilityKind: resolved.hasAttack ? "attack" : "standard",
        abilityCost: resolved.actionCost ?? null,
        abilityRange: resolved.range,
        abilityAoe: resolved.aoe,
        abilityResolveCost: resolved.resolveCost,
        abilityAttack: resolved.atk,
        abilityEffects: resolved.effects?.length ? resolved.effects : null,
        abilityTone: resolved.tone,
    };
    return { payload, resolved };
}
