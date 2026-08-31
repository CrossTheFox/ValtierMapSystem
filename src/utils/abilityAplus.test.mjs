import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    normalizeAbilityAplus,
    defaultAttackBlank,
    parseActionCostText,
    toggleHasAttackPatch,
    needsPlayLaunchDialog,
    getPlayLaunchDialogProps,
    inferDefaultActionsSpent,
} from "./abilityAplus.js";

describe("normalizeAbilityAplus — blank-safe defaults", () => {
    it("fills every A+ field from an empty doc", () => {
        const a = normalizeAbilityAplus(null);
        assert.equal(a.title, "NEW ABILITY");
        assert.equal(a.description, "");
        assert.equal(a.hasAttack, false);
        assert.equal(a.actionCost, 1);
        assert.equal(a.actionCostMin, 1);
        assert.equal(a.actionCostFlex, false);
        assert.equal(a.range, null);
        assert.equal(a.aoe, null);
        assert.deepEqual(a.tags, []);
        assert.deepEqual(a.effects, []);
        assert.equal(a.attack, null);
        assert.equal(a.traitMode, "passive");
        assert.equal(a.resolveCost, null);
        assert.deepEqual(a.talents, []);
        assert.equal(a.mastery, null);
        assert.equal(a.unlockCostAP, null);
    });

    it("maps live label/content/blurb → title/description", () => {
        const a = normalizeAbilityAplus({ label: "Anchor Spike", content: "Drive a spike." });
        assert.equal(a.title, "Anchor Spike");
        assert.equal(a.description, "Drive a spike.");
    });

    it("derives hasAttack from legacy abilityKind when A+ field absent", () => {
        const a = normalizeAbilityAplus({ abilityKind: "attack" });
        assert.equal(a.hasAttack, true);
        assert.deepEqual(a.attack, defaultAttackBlank());
    });

    it("A+ hasAttack:false wins over legacy abilityKind:attack", () => {
        const a = normalizeAbilityAplus({ abilityKind: "attack", hasAttack: false });
        assert.equal(a.hasAttack, false);
        assert.equal(a.attack, null);
    });

    it("maps legacy tagKeys[] to tags[] when tags absent", () => {
        const a = normalizeAbilityAplus({ tagKeys: ["Mark", "mark", ""] });
        assert.deepEqual(a.tags, ["mark"]);
        assert.deepEqual(a.tagKeys, ["mark"]);
    });

    it("migrates legacy two-packet docs to three-tier shape", () => {
        const a = normalizeAbilityAplus({
            hasAttack: true,
            attack: {
                damageOnHit: { formula: "1d[damageDie]+[fray]" },
                damageOnCrit: { formula: "2d[damageDie]+[fray]" },
            },
        });
        assert.equal(a.attack.damageOnHit.formula, "1d[damageDie]+[fray]");
        assert.equal(a.attack.damageOnHeavy.formula, "2d[damageDie]+[fray]");
        assert.equal(a.attack.damageOnCrit.formula, "4d[damageDie]+[fray]");
    });

    it("keeps a real attack doc intact (partial packets preserved)", () => {
        const a = normalizeAbilityAplus({
            hasAttack: true,
            attack: { autoHit: true, damageOnHit: { formula: "1d8+1" } },
        });
        assert.equal(a.attack.autoHit, true);
        assert.deepEqual(a.attack.damageOnHit, { formula: "1d8+1" });
        assert.equal(a.attack.damageOnMiss, null);
    });

    it("normalizes effects rows and drops malformed entries", () => {
        const a = normalizeAbilityAplus({
            effects: [{ id: "e1", lane: "hit", text: "Mark target" }, null, "garbage"],
        });
        assert.equal(a.effects.length, 1);
        assert.equal(a.effects[0].id, "e1");
        assert.equal(a.effects[0].lane, "hit");
        assert.equal(a.effects[0].label, "ON HIT");
    });

    it("clamps unlockCostAP to a positive integer or null", () => {
        assert.equal(normalizeAbilityAplus({ unlockCostAP: 0 }).unlockCostAP, null);
        assert.equal(normalizeAbilityAplus({ unlockCostAP: -3 }).unlockCostAP, null);
        assert.equal(normalizeAbilityAplus({ unlockCostAP: "2" }).unlockCostAP, 2);
        assert.equal(normalizeAbilityAplus({ unlockCostAP: 3.9 }).unlockCostAP, 3);
    });

    it("preserves the free/interrupt/superheavy actionCost keywords (CORE chip enum)", () => {
        assert.equal(normalizeAbilityAplus({ actionCost: "free" }).actionCost, "free");
        assert.equal(normalizeAbilityAplus({ actionCost: "INTERRUPT" }).actionCost, "interrupt");
        assert.equal(normalizeAbilityAplus({ actionCost: "superheavy" }).actionCost, "superheavy");
        assert.equal(normalizeAbilityAplus({ actionCost: 2 }).actionCost, 2);
        assert.equal(normalizeAbilityAplus({ actionCost: "2" }).actionCost, 2);
    });

    it("parses 1|2 Actions from legacy cost field", () => {
        const a = normalizeAbilityAplus({
            cost: "1–3 Z-Gems · 1|2 Actions",
            content: "Light: [damageDie]",
        });
        assert.equal(a.actionCost, 2);
        assert.equal(a.actionCostMin, 1);
        assert.equal(a.actionCostFlex, true);
    });

    it("toggleHasAttackPatch writes full attack blank", () => {
        const on = toggleHasAttackPatch(true);
        assert.equal(on.hasAttack, true);
        assert.equal(on.abilityKind, "attack");
        assert.ok(on.attack.damageOnHeavy);
        const off = toggleHasAttackPatch(false);
        assert.equal(off.hasAttack, false);
        assert.equal(off.attack, null);
    });
});

describe("parseActionCostText", () => {
    it("detects flexible 1|2 and 1/2", () => {
        assert.deepEqual(parseActionCostText("Range 1 · 1|2 Actions"), {
            actionCost: 2, actionCostMin: 1, actionCostFlex: true,
        });
        assert.deepEqual(parseActionCostText("4–10 Z-Gems · 1/2 Actions"), {
            actionCost: 2, actionCostMin: 1, actionCostFlex: true,
        });
    });
});

describe("play launch helpers", () => {
    it("needs dialog for flex cost or non-autohit attack", () => {
        assert.equal(needsPlayLaunchDialog({ actionCostFlex: true }), true);
        assert.equal(needsPlayLaunchDialog({
            hasAttack: true,
            attack: { autoHit: false },
        }), true);
        assert.equal(needsPlayLaunchDialog({
            hasAttack: true,
            attack: { autoHit: true },
            actionCost: 1,
        }), false);
    });

    it("infers default actions spent from flex vs fixed cost", () => {
        assert.equal(inferDefaultActionsSpent({ actionCostFlex: true, actionCostMin: 1 }), 1);
        assert.equal(inferDefaultActionsSpent({ actionCost: 2 }), 2);
    });

    it("exposes dialog sections for flex attacks", () => {
        const props = getPlayLaunchDialogProps({
            actionCostFlex: true,
            actionCost: 2,
            actionCostMin: 1,
            hasAttack: true,
            attack: { autoHit: false },
        });
        assert.equal(props.showActions, true);
        assert.equal(props.showBoons, true);
    });
});
