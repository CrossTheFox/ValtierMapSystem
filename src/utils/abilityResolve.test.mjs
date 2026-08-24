import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveAbilityForPlay } from "./abilityResolve.js";

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
        effects: [{ id: "e1", lane: "hit", label: "ON HIT", text: "Mark the target. [damageDie]" }],
        tags: ["mark"],
        talents: [],
        mastery: null,
        ...overrides,
    };
}

describe("resolveAbilityForPlay — autohit ability", () => {
    it("skips the d20 roll and resolves Light/Heavy tickets, no Miss", () => {
        const node = baseAbility({ attack: { ...baseAbility().attack, autoHit: true } });
        const resolved = resolveAbilityForPlay(node, { unlockedKitNodes: [] }, { formulaCtx });
        assert.equal(resolved.hasAttack, true);
        assert.equal(resolved.tone, "atk");
        assert.equal(resolved.atk.autoHit, true);
        assert.equal(resolved.atk.outcome, "AUTOHIT");
        assert.equal(resolved.atk.raw, null);
        assert.ok(resolved.atk.light);
        assert.ok(resolved.atk.light.total >= 3 && resolved.atk.light.total <= 10); // 1d8+2
        assert.ok(resolved.atk.heavy);
        assert.ok(resolved.atk.heavy.total >= 4 && resolved.atk.heavy.total <= 18); // 2d8+2
        assert.equal(resolved.atk.miss, null);
    });
});

describe("resolveAbilityForPlay — non-autohit attack with boons", () => {
    it("rolls the d20 with the given attackMods and resolves Light/Heavy/Miss", () => {
        const node = baseAbility();
        const resolved = resolveAbilityForPlay(node, { unlockedKitNodes: [] }, {
            formulaCtx,
            attackMods: { boons: 2, curses: 0 },
        });
        assert.equal(resolved.hasAttack, true);
        assert.equal(resolved.atk.autoHit, false);
        assert.ok(resolved.atk.raw >= 1 && resolved.atk.raw <= 20);
        assert.equal(resolved.atk.polarity, "boon");
        assert.ok(["HIT", "MISS", "CRIT"].includes(resolved.atk.outcome));
        assert.ok(resolved.atk.light.total >= 3 && resolved.atk.light.total <= 10);
        assert.ok(resolved.atk.heavy.total >= 4 && resolved.atk.heavy.total <= 18);
        assert.ok(resolved.atk.miss);
        assert.equal(resolved.atk.miss.total, 2);
    });

    it("resolves [] macro tokens inside effect text exactly once", () => {
        const node = baseAbility();
        const resolved = resolveAbilityForPlay(node, { unlockedKitNodes: [] }, { formulaCtx });
        assert.equal(resolved.effects.length, 1);
        assert.match(resolved.effects[0].resolvedText, /^Mark the target\. \d+$/);
        assert.equal(resolved.effects[0].rolls.length, 1); // [damageDie] → 1d8 roll
    });
});

describe("resolveAbilityForPlay — limit break ignores talents (G2)", () => {
    it("never applies talent mods even when unlocked on the doc, only mastery", () => {
        const node = baseAbility({
            talents: [{ id: "a1-t1", unlockCostAP: 2, mods: [{ op: "add_tags", tags: ["t1tag"] }] }],
            mastery: { id: "a1-m", unlockCostAP: 4, mods: [{ op: "add_tags", tags: ["mtag"] }] },
        });
        const character = { unlockedKitNodes: ["a1", "a1-t1", "a1-m"] };
        const resolved = resolveAbilityForPlay(node, character, { formulaCtx, isLb: true });
        assert.equal(resolved.tone, "lb");
        assert.deepEqual(resolved.tags, ["mark", "mtag"]);
    });
});

describe("resolveAbilityForPlay — trait/mech (no attack branch)", () => {
    it("returns hasAttack:false, atk:null, tone std for a non-attack node", () => {
        const node = baseAbility({ hasAttack: false, attack: null });
        const resolved = resolveAbilityForPlay(node, { unlockedKitNodes: [] }, { formulaCtx });
        assert.equal(resolved.hasAttack, false);
        assert.equal(resolved.atk, null);
        assert.equal(resolved.tone, "std");
    });
});
