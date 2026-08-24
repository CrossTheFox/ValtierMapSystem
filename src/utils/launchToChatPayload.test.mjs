import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildLiteChatPayload, buildAbilityChatPayload } from "./launchToChatPayload.js";
import { CHAT_MESSAGE_TYPES } from "../constants/chatMessageTypes.js";

const formulaCtx = { damageDie: 8, fray: 2, mechanicResource: 1 };

function baseAbility(overrides = {}) {
    return {
        id: "a1",
        key: "a1",
        label: "ANCHOR SPIKE",
        blurb: "Slam the target.",
        hasAttack: true,
        attack: {
            autoHit: false,
            damageOnHit: { formula: "[damageDie]+[fray]" },
            damageOnCrit: { formula: "2[damageDie]+[fray]" },
            damageOnMiss: { formula: "[fray]" },
        },
        effects: [{ id: "e1", lane: "hit", label: "ON HIT", text: "Mark the target." }],
        tags: ["mark"],
        talents: [],
        mastery: null,
        ...overrides,
    };
}

/**
 * `launchToChat` (`firebase/services/launchToChat.js`) calls `sendChatMessage`
 * exactly once per branch with the payload these builders return — since each
 * builder returns a single payload object (never a list), "one post per Play"
 * (`PHASE-03-GUIDE.md` slice-6 requirement, no separate `DICE` message) is
 * structurally guaranteed. These tests assert the payload shape/values
 * without touching Firestore.
 */

describe("buildLiteChatPayload — trait/mech lite path", () => {
    it("builds a single ABILITY-type payload with no attack fields", () => {
        const node = { id: "t1", label: "Second Wind", blurb: "Recover some HP." };
        const payload = buildLiteChatPayload(node, formulaCtx);
        assert.equal(payload.type, CHAT_MESSAGE_TYPES.ABILITY);
        assert.equal(payload.abilityTone, "std");
        assert.equal(payload.abilityKind, "standard");
        assert.equal(payload.abilityLabel, "Second Wind");
        assert.equal(payload.text, "Recover some HP.");
        assert.equal(payload.abilityAttack, undefined);
    });
});

describe("buildAbilityChatPayload — autohit ability", () => {
    it("posts abilityTone atk with autoHit attack, no boon dialog needed", () => {
        const node = baseAbility({ attack: { ...baseAbility().attack, autoHit: true } });
        const { payload, resolved } = buildAbilityChatPayload(node, { unlockedKitNodes: [] }, { formulaCtx });
        assert.equal(payload.type, CHAT_MESSAGE_TYPES.ABILITY);
        assert.equal(payload.abilityTone, "atk");
        assert.equal(payload.abilityKind, "attack");
        assert.equal(payload.abilityAttack.autoHit, true);
        assert.equal(payload.abilityAttack.raw, null);
        assert.equal(resolved.atk.autoHit, true);
    });
});

describe("buildAbilityChatPayload — non-autohit attack", () => {
    it("embeds one resolved d20 roll directly in abilityAttack (no separate DICE message)", () => {
        const node = baseAbility();
        const { payload } = buildAbilityChatPayload(node, { unlockedKitNodes: [] }, {
            formulaCtx,
            attackMods: { boons: 1, curses: 0 },
        });
        assert.equal(payload.abilityAttack.autoHit, false);
        assert.ok(payload.abilityAttack.raw >= 1 && payload.abilityAttack.raw <= 20);
        assert.ok(["HIT", "MISS", "CRIT"].includes(payload.abilityAttack.outcome));
        assert.ok(Array.isArray(payload.abilityEffects));
    });

    it("reuses a pre-resolved bundle (preResolved) instead of rolling twice", () => {
        const node = baseAbility();
        const first = buildAbilityChatPayload(node, { unlockedKitNodes: [] }, { formulaCtx }).resolved;
        const { payload, resolved } = buildAbilityChatPayload(node, { unlockedKitNodes: [] }, {
            formulaCtx,
            preResolved: first,
        });
        assert.equal(resolved, first);
        assert.equal(payload.abilityAttack.raw, first.atk.raw);
    });
});

describe("buildAbilityChatPayload — limit break (G2 mastery-only)", () => {
    it("never carries talent-sourced effects/tags, even when a talent is present + unlocked on the doc", () => {
        const node = baseAbility({
            talents: [{ id: "a1-t1", unlockCostAP: 2, mods: [{ op: "add_tags", tags: ["t1tag"] }] }],
            mastery: { id: "a1-m", unlockCostAP: 4, mods: [{ op: "append_effect", effect: { lane: "mech", text: "Bonus mastery effect." } }] },
        });
        const character = { unlockedKitNodes: ["a1", "a1-t1", "a1-m"] };
        const { payload } = buildAbilityChatPayload(node, character, { formulaCtx, isLb: true });
        assert.equal(payload.abilityTone, "lb");
        assert.ok(!payload.abilityTags?.includes("t1tag"));
        assert.ok(payload.abilityEffects.some((e) => e.resolvedText === "Bonus mastery effect." && e.from === "M"));
        assert.ok(!payload.abilityEffects.some((e) => e.from === "T1" || e.from === "T2"));
    });
});
