import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    canUnlockNode,
    isKitNodeUnlocked,
    isKitProgressionMigrated,
    kitTalentNodeId,
    resolveUnlockedKitNodes,
    unlockNode,
} from "./kitProgression.js";

describe("isKitProgressionMigrated", () => {
    it("false when unlockedKitNodes is absent (grandfather)", () => {
        assert.equal(isKitProgressionMigrated({}), false);
        assert.equal(isKitProgressionMigrated({ unlockedAbilities: ["a1"] }), false);
    });

    it("true once unlockedKitNodes is a real array, even empty", () => {
        assert.equal(isKitProgressionMigrated({ unlockedKitNodes: [] }), true);
        assert.equal(isKitProgressionMigrated({ unlockedKitNodes: ["a1"] }), true);
    });
});

describe("resolveUnlockedKitNodes — grandfather mode", () => {
    it("treats owned base nodes as unlocked, ignoring talent/mastery children", () => {
        const character = { unlockedAbilities: ["a1"] }; // legacy field, not migrated
        const set = resolveUnlockedKitNodes(character, { ownedBaseNodeIds: ["a1", "a2"] });
        assert.equal(set.has("a1"), true);
        assert.equal(set.has("a2"), true);
        assert.equal(set.has(kitTalentNodeId("a1", "t0")), false);
    });

    it("empty set when no owned base nodes provided", () => {
        const set = resolveUnlockedKitNodes({});
        assert.equal(set.size, 0);
    });
});

describe("resolveUnlockedKitNodes — strict mode", () => {
    it("uses unlockedKitNodes as-is, ignoring ownedBaseNodeIds", () => {
        const character = { unlockedKitNodes: ["a1", kitTalentNodeId("a1", "t0")] };
        const set = resolveUnlockedKitNodes(character, { ownedBaseNodeIds: ["a2"] });
        assert.equal(set.has("a1"), true);
        assert.equal(set.has(kitTalentNodeId("a1", "t0")), true);
        assert.equal(set.has("a2"), false);
    });
});

describe("isKitNodeUnlocked", () => {
    it("always unlocked when unlockCostAP is missing or 0 (no gating)", () => {
        const character = {};
        assert.equal(isKitNodeUnlocked(character, { id: "a1" }), true);
        assert.equal(isKitNodeUnlocked(character, { id: "a1", unlockCostAP: 0 }), true);
        assert.equal(isKitNodeUnlocked(character, { id: "a1", unlockCostAP: null }), true);
    });

    it("grandfathered base node is unlocked even with a positive cost", () => {
        const character = {};
        const ctx = { ownedBaseNodeIds: ["a1"] };
        assert.equal(isKitNodeUnlocked(character, { id: "a1", unlockCostAP: 2 }, ctx), true);
    });

    it("talent/mastery node starts locked in grandfather mode", () => {
        const character = {};
        const ctx = { ownedBaseNodeIds: ["a1"] };
        const talentNode = { id: kitTalentNodeId("a1", "t0"), unlockCostAP: 2 };
        assert.equal(isKitNodeUnlocked(character, talentNode, ctx), false);
    });

    it("strict mode gates a costed node not present in unlockedKitNodes", () => {
        const character = { unlockedKitNodes: ["a1"] };
        assert.equal(isKitNodeUnlocked(character, { id: "a2", unlockCostAP: 3 }), false);
        assert.equal(isKitNodeUnlocked(character, { id: "a1", unlockCostAP: 3 }), true);
    });
});

describe("canUnlockNode", () => {
    it("no_cost when unlockCostAP missing/0", () => {
        assert.deepEqual(canUnlockNode({ ap: 10 }, { id: "a1" }), { ok: false, reason: "no_cost" });
    });

    it("already_unlocked when node already in the resolved set", () => {
        const character = { ap: 10, unlockedKitNodes: ["a1"] };
        assert.deepEqual(
            canUnlockNode(character, { id: "a1", unlockCostAP: 2 }),
            { ok: false, reason: "already_unlocked" },
        );
    });

    it("insufficient_ap when character.ap < cost", () => {
        const character = { ap: 1, unlockedKitNodes: [] };
        assert.deepEqual(
            canUnlockNode(character, { id: "a1", unlockCostAP: 2 }),
            { ok: false, reason: "insufficient_ap" },
        );
    });

    it("ok when enough AP and not yet unlocked", () => {
        const character = { ap: 3, unlockedKitNodes: [] };
        assert.deepEqual(canUnlockNode(character, { id: "a1", unlockCostAP: 2 }), { ok: true });
    });
});

describe("unlockNode", () => {
    it("returns null when the unlock isn't allowed", () => {
        const character = { ap: 1, unlockedKitNodes: [] };
        assert.equal(unlockNode(character, { id: "a1", unlockCostAP: 2 }), null);
    });

    it("spends AP and appends the node in strict mode", () => {
        const character = { ap: 5, unlockedKitNodes: ["a1"] };
        const patch = unlockNode(character, { id: kitTalentNodeId("a1", "t0"), unlockCostAP: 2 });
        assert.equal(patch.ap, 3);
        assert.deepEqual(new Set(patch.unlockedKitNodes), new Set(["a1", kitTalentNodeId("a1", "t0")]));
    });

    it("freezes grandfathered base nodes into the strict array on first unlock", () => {
        const character = { ap: 5 }; // never migrated
        const ctx = { ownedBaseNodeIds: ["a1", "a2"] };
        const patch = unlockNode(character, { id: kitTalentNodeId("a1", "t0"), unlockCostAP: 2 }, ctx);
        assert.equal(patch.ap, 3);
        assert.deepEqual(
            new Set(patch.unlockedKitNodes),
            new Set(["a1", "a2", kitTalentNodeId("a1", "t0")]),
        );
    });
});
