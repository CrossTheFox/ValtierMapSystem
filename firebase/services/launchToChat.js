import { sendChatMessage } from "./chatService.js";
import { buildLiteChatPayload, buildAbilityChatPayload } from "../../src/utils/launchToChatPayload.js";

export { buildLiteChatPayload, buildAbilityChatPayload };

/**
 * Unified Play → Chat entry point (Slice 6, `CHAT-PLAY-FLOW.md`). Replaces the
 * legacy `callAbilityInChat` / `callKitCardInChat` / `rollAttackD20InChat` trio
 * for every Play button in the dossier + hotbar: exactly **one** Firestore
 * write per Play (`CHAT_MESSAGE_TYPES.ABILITY`), never a separate `DICE`
 * message — the attack d20 (when rolled) is shown via the local-only reveal
 * (`useLocalDiceReveal`) and its result is embedded straight into the ABILITY
 * card's `abilityAttack` field.
 *
 * `kind: "trait"|"mech"` is a lite path (no attack, no A+ merge/roll — legacy
 * free-text content with `resolveAbilityContentInline` for any `[..]`/`@{}`
 * cues already authored on job/mechanic descriptions). `kind: "ability"` and
 * `"limit_break"` go through `resolveAbilityForPlay` (G11 merge + roll bundle).
 *
 * Payload building lives in the pure `src/utils/launchToChatPayload.js` (unit
 * tested in `src/utils/launchToChatPayload.test.mjs` without touching
 * Firestore) — the only side-effecting statement in this module is the single
 * `sendChatMessage` call per branch below.
 *
 * @param {{
 *   kind: "ability"|"trait"|"mech"|"limit_break",
 *   node: object,
 *   character: object|null,
 *   campaignId: string,
 *   profile: { uid?: string, nickname?: string }|null,
 *   kitCtx?: object,
 *   formulaCtx?: object,
 *   attackMods?: { boons?: number, curses?: number }|null,
 *   resolved?: object,
 * }} params - `resolved` lets a caller pass an already-computed
 *   `resolveAbilityForPlay` bundle (e.g. after driving the local d20 reveal
 *   off of it) so the roll never happens twice.
 */
export async function launchToChat({
    kind,
    node,
    character,
    campaignId,
    profile,
    kitCtx = {},
    formulaCtx = {},
    attackMods = null,
    resolved: preResolved = null,
}) {
    if (!campaignId || !node) return null;

    const avatarUrl = character?.tokenImageUrl || character?.imageUrl || node.characterAvatarUrl || null;
    const baseFields = {
        senderId: profile?.uid,
        senderName: profile?.nickname ?? "Jugador",
        characterId: character?.id ?? node.characterId ?? null,
        characterName: character?.name ?? node.characterName ?? null,
        characterAvatarUrl: avatarUrl,
        isOOC: false,
    };

    if (kind === "trait" || kind === "mech") {
        const payload = buildLiteChatPayload(node, formulaCtx);
        await sendChatMessage(campaignId, { ...payload, ...baseFields });
        return null;
    }

    // "ability" | "limit_break"
    const isLb = kind === "limit_break";
    const { payload, resolved } = buildAbilityChatPayload(node, character, {
        ctx: kitCtx, formulaCtx, isLb, attackMods, preResolved,
    });
    await sendChatMessage(campaignId, { ...payload, ...baseFields });
    return resolved;
}
