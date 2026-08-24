import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergeUnlockedUpgrades } from "./mergeUnlockedUpgrades.js";

function baseAbility(overrides = {}) {
    return {
        id: "a1",
        key: "a1",
        title: "ANCHOR SPIKE",
        effects: [{ id: "e1", lane: "hit", text: "Mark the target." }],
        attack: { autoHit: false, damageOnHit: { formula: "[damageDie]+[fray]" } },
        tags: ["mark"],
        talents: [],
        mastery: null,
        ...overrides,
    };
}

describe("mergeUnlockedUpgrades — gating", () => {
    it("returns an untouched clone when no talents/mastery are unlocked", () => {
        const node = baseAbility({ talents: [{ id: "a1-t1", unlockCostAP: 2, mods: [{ op: "add_tags", tags: ["x"] }] }] });
        const merged = mergeUnlockedUpgrades(node, { unlockedKitNodes: [] });
        assert.deepEqual(merged.tags, ["mark"]);
        assert.deepEqual(merged._mergeMeta, { effectSources: {}, attackPatches: {} });
    });

    it("applies mods only for unlocked slots (T1 unlocked, T2 locked)", () => {
        const node = baseAbility({
            talents: [
                { id: "a1-t1", unlockCostAP: 2, mods: [{ op: "add_tags", tags: ["t1tag"] }] },
                { id: "a1-t2", unlockCostAP: 3, mods: [{ op: "add_tags", tags: ["t2tag"] }] },
            ],
        });
        const merged = mergeUnlockedUpgrades(node, { unlockedKitNodes: ["a1", "a1-t1"] });
        assert.deepEqual(merged.tags, ["mark", "t1tag"]);
    });
});

describe("mergeUnlockedUpgrades — UpgradeOp kinds", () => {
    const unlockedChar = { unlockedKitNodes: ["a1", "a1-m"] };

    it("append_effect adds a new effect row and tracks provenance", () => {
        const node = baseAbility({
            mastery: { id: "a1-m", unlockCostAP: 4, mods: [{ op: "append_effect", effect: { lane: "mech", text: "Charge +1" } }] },
        });
        const merged = mergeUnlockedUpgrades(node, unlockedChar);
        assert.equal(merged.effects.length, 2);
        const added = merged.effects[1];
        assert.equal(added.text, "Charge +1");
        assert.equal(merged._mergeMeta.effectSources[added.id], "M");
    });

    it("replace_effect overwrites an existing effect by id", () => {
        const node = baseAbility({
            mastery: { id: "a1-m", unlockCostAP: 4, mods: [{ op: "replace_effect", effectId: "e1", effect: { text: "Mark + Slow the target." } }] },
        });
        const merged = mergeUnlockedUpgrades(node, unlockedChar);
        assert.equal(merged.effects[0].text, "Mark + Slow the target.");
        assert.equal(merged.effects[0].lane, "hit");
    });

    it("empower_effect patches fields on an existing effect", () => {
        const node = baseAbility({
            mastery: { id: "a1-m", unlockCostAP: 4, mods: [{ op: "empower_effect", effectId: "e1", patch: { statusCode: "SLW" } }] },
        });
        const merged = mergeUnlockedUpgrades(node, unlockedChar);
        assert.equal(merged.effects[0].statusCode, "SLW");
    });

    it("patch_attack merges into an attack packet and tracks provenance", () => {
        const node = baseAbility({
            mastery: { id: "a1-m", unlockCostAP: 4, mods: [{ op: "patch_attack", patch: { damageOnHit: { formula: "2[damageDie]+[fray]" } } }] },
        });
        const merged = mergeUnlockedUpgrades(node, unlockedChar);
        assert.equal(merged.attack.damageOnHit.formula, "2[damageDie]+[fray]");
        assert.equal(merged._mergeMeta.attackPatches.damageOnHit, "M");
    });

    it("patch_attack sets a scalar field directly (autoHit)", () => {
        const node = baseAbility({
            mastery: { id: "a1-m", unlockCostAP: 4, mods: [{ op: "patch_attack", patch: { autoHit: true } }] },
        });
        const merged = mergeUnlockedUpgrades(node, unlockedChar);
        assert.equal(merged.attack.autoHit, true);
    });

    it("add_tags appends tags without dedup (mirrors mockup)", () => {
        const node = baseAbility({
            mastery: { id: "a1-m", unlockCostAP: 4, mods: [{ op: "add_tags", tags: ["burn"] }] },
        });
        const merged = mergeUnlockedUpgrades(node, unlockedChar);
        assert.deepEqual(merged.tags, ["mark", "burn"]);
    });

    it("set_fields assigns arbitrary top-level fields", () => {
        const node = baseAbility({
            mastery: { id: "a1-m", unlockCostAP: 4, mods: [{ op: "set_fields", patch: { actionCost: 2 } }] },
        });
        const merged = mergeUnlockedUpgrades(node, unlockedChar);
        assert.equal(merged.actionCost, 2);
    });

    it("prose_only is a no-op on mechanical fields", () => {
        const node = baseAbility({
            mastery: { id: "a1-m", unlockCostAP: 4, mods: [{ op: "prose_only", text: "Flavor only." }] },
        });
        const merged = mergeUnlockedUpgrades(node, unlockedChar);
        assert.deepEqual(merged.effects, node.effects);
        assert.deepEqual(merged.attack, node.attack);
    });
});

describe("mergeUnlockedUpgrades — isLb (G2 mastery-only safety)", () => {
    it("ignores T1/T2 mods even when unlocked, when ctx.isLb is true", () => {
        const node = baseAbility({
            talents: [{ id: "a1-t1", unlockCostAP: 2, mods: [{ op: "add_tags", tags: ["t1tag"] }] }],
            mastery: { id: "a1-m", unlockCostAP: 4, mods: [{ op: "add_tags", tags: ["mtag"] }] },
        });
        const character = { unlockedKitNodes: ["a1", "a1-t1", "a1-m"] };
        const merged = mergeUnlockedUpgrades(node, character, { isLb: true });
        assert.deepEqual(merged.tags, ["mark", "mtag"]);
    });

    it("still applies mastery mods normally when ctx.isLb is true", () => {
        const node = baseAbility({
            mastery: { id: "a1-m", unlockCostAP: 4, mods: [{ op: "patch_attack", patch: { autoHit: true } }] },
        });
        const merged = mergeUnlockedUpgrades(node, { unlockedKitNodes: ["a1", "a1-m"] }, { isLb: true });
        assert.equal(merged.attack.autoHit, true);
    });

    it("applies T1/T2 normally when ctx.isLb is falsy/omitted (non-LB unaffected)", () => {
        const node = baseAbility({
            talents: [{ id: "a1-t1", unlockCostAP: 2, mods: [{ op: "add_tags", tags: ["t1tag"] }] }],
        });
        const merged = mergeUnlockedUpgrades(node, { unlockedKitNodes: ["a1", "a1-t1"] });
        assert.deepEqual(merged.tags, ["mark", "t1tag"]);
    });
});

describe("mergeUnlockedUpgrades — purity", () => {
    it("does not mutate the original node", () => {
        const node = baseAbility({
            mastery: { id: "a1-m", unlockCostAP: 4, mods: [{ op: "add_tags", tags: ["burn"] }] },
        });
        const before = JSON.stringify(node);
        mergeUnlockedUpgrades(node, { unlockedKitNodes: ["a1", "a1-m"] });
        assert.equal(JSON.stringify(node), before);
    });

    it("returns null/undefined input as-is", () => {
        assert.equal(mergeUnlockedUpgrades(null, {}), null);
    });
});
