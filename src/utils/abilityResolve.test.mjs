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
            damageOnHeavy: { formula: "2d[damageDie]+[fray]" },
            damageOnCrit: { formula: "4d[damageDie]+[fray]" },
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
    it("skips the d20 roll and resolves Light/Heavy/Crit tickets, no Miss", () => {
        const node = baseAbility({ attack: { ...baseAbility().attack, autoHit: true } });
        const resolved = resolveAbilityForPlay(node, { unlockedKitNodes: [] }, { formulaCtx });
        assert.equal(resolved.hasAttack, true);
        assert.equal(resolved.tone, "atk");
        assert.equal(resolved.atk.autoHit, true);
        assert.equal(resolved.atk.outcome, "AUTOHIT");
        assert.equal(resolved.atk.raw, null);
        assert.ok(resolved.atk.light);
        assert.ok(resolved.atk.light.total >= 3 && resolved.atk.light.total <= 10);
        assert.ok(resolved.atk.heavy);
        assert.ok(resolved.atk.heavy.total >= 6 && resolved.atk.heavy.total <= 18);
        assert.ok(resolved.atk.crit);
        assert.ok(resolved.atk.crit.total >= 10 && resolved.atk.crit.total <= 34);
        assert.equal(resolved.atk.miss, null);
        assert.equal(resolved.atk.activePacket, null);
    });
});

describe("resolveAbilityForPlay — non-autohit attack with boons", () => {
    it("rolls the d20 and resolves Light/Heavy/Crit/Miss", () => {
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
        assert.ok(resolved.atk.heavy.total >= 6 && resolved.atk.heavy.total <= 18);
        assert.ok(resolved.atk.crit.total >= 10 && resolved.atk.crit.total <= 34);
        assert.ok(resolved.atk.miss);
        assert.equal(resolved.atk.miss.total, 2);
        if (resolved.atk.outcome === "CRIT") assert.equal(resolved.atk.activePacket, "crit");
    });

    it("uses heavy packet on HIT when actionsSpent is 2", () => {
        const node = baseAbility({ actionCost: 2, actionCostFlex: true, actionCostMin: 1 });
        let sawHeavy = false;
        for (let i = 0; i < 40; i += 1) {
            const resolved = resolveAbilityForPlay(node, { unlockedKitNodes: [] }, {
                formulaCtx,
                actionsSpent: 2,
            });
            if (resolved.atk.outcome === "HIT") {
                assert.equal(resolved.atk.activePacket, "heavy");
                sawHeavy = true;
                break;
            }
        }
        assert.ok(sawHeavy, "expected at least one HIT in 40 rolls");
    });

    it("uses light packet on HIT when actionsSpent is 1", () => {
        const node = baseAbility({ actionCost: 2, actionCostFlex: true, actionCostMin: 1 });
        let sawLight = false;
        for (let i = 0; i < 40; i += 1) {
            const resolved = resolveAbilityForPlay(node, { unlockedKitNodes: [] }, {
                formulaCtx,
                actionsSpent: 1,
            });
            if (resolved.atk.outcome === "HIT") {
                assert.equal(resolved.atk.activePacket, "light");
                sawLight = true;
                break;
            }
        }
        assert.ok(sawLight, "expected at least one HIT in 40 rolls");
    });

    it("resolves [] macro tokens inside effect text exactly once", () => {
        const node = baseAbility();
        const resolved = resolveAbilityForPlay(node, { unlockedKitNodes: [] }, { formulaCtx });
        assert.equal(resolved.effects.length, 1);
        assert.match(resolved.effects[0].resolvedText, /^Mark the target\. \d+$/);
        assert.equal(resolved.effects[0].rolls.length, 1);
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

describe("resolveAbilityForPlay — flavor hygiene", () => {
    it("strips structured blurb/content from flavor when effects exist", () => {
        const node = baseAbility({
            blurb: `Light: [2d[damageDie]]
Heavy: [3d[damageDie]]
Efecto: foo
Narrativo: Solo narrativa.`,
            content: `Light: [2d[damageDie]]`,
            description: `Light: [2d[damageDie]]`,
        });
        const resolved = resolveAbilityForPlay(node, { unlockedKitNodes: [] }, { formulaCtx });
        assert.equal(resolved.flavor, "Solo narrativa.");
    });
});
