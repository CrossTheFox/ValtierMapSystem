import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    extractRollCommands,
    resolveRollExpression,
    resolveAbilityRollFormulas,
    resolveAbilityContentInline,
    expandCombatTokens,
} from "./abilityRollCommands.js";

const stats = {
    vit: 4,
    defense: 10,
    speed: 4,
    dash: 2,
    fray: 1,
    damageDie: 8,
    armor: 2,
    vigor: 0,
    vigorMax: 0,
    hpMax: 16,
};

describe("abilityRollCommands", () => {
    it("extracts bracketed roll cues", () => {
        const text = "Ataque melee. [1d[@{damage-die}]+@{fray}] y flavor [nota].";
        assert.deepEqual(extractRollCommands(text), ["1d[@{damage-die}]+@{fray}"]);
    });

    it("expands combat tokens", () => {
        assert.equal(expandCombatTokens("1d[@{damage-die}]+@{fray}", stats), "1d[8]+1");
        assert.equal(expandCombatTokens("@{dash}", stats), "2");
    });

    it("resolves damage+fray formula", () => {
        assert.equal(
            resolveRollExpression("1d[@{damage-die}]+@{fray}", stats),
            "1d8+1",
        );
    });

    it("ignores pure number tokens as rolls", () => {
        assert.equal(resolveRollExpression("@{fray}", stats), null);
    });

    it("resolves multiple formulas from ability text", () => {
        const content = "Hit [1d[@{damage-die}]+@{fray}] then splash [1d6].";
        assert.deepEqual(resolveAbilityRollFormulas(content, stats), ["1d8+1", "1d6"]);
    });

    it("inlines rolls onto the card text without animated dice", () => {
        const content = "Light: [2d[@{damage-die}]]\nHeavy: [3d[@{damage-die}]]\nMiss: [@{fray}]";
        const fixed = (formula) => {
            const m = String(formula).match(/^(\d*)d(\d+)([+-]\d+)?$/);
            const count = parseInt(m[1] || "1", 10);
            const sides = parseInt(m[2], 10);
            const mod = m[3] ? parseInt(m[3], 10) : 0;
            const rolls = Array.from({ length: count }, () => 4);
            return {
                rolls,
                mod,
                total: rolls.reduce((a, b) => a + b, 0) + mod,
                formula,
                sides,
                diceCount: count,
            };
        };
        const { displayText, inlineRolls } = resolveAbilityContentInline(content, stats, {
            rollFn: fixed,
        });
        assert.equal(inlineRolls.length, 2);
        assert.equal(inlineRolls[0].formula, "2d8");
        assert.equal(inlineRolls[0].total, 8);
        assert.equal(inlineRolls[1].formula, "3d8");
        assert.equal(inlineRolls[1].total, 12);
        assert.equal(displayText, "Light: ⟦0⟧\nHeavy: ⟦1⟧\nMiss: 1");
    });

    it("skips d20 when skipD20 for attack abilities", () => {
        const content = "Attack [1d20] · Light [1d6]";
        const { displayText, inlineRolls } = resolveAbilityContentInline(content, stats, {
            skipD20: true,
            rollFn: () => ({
                rolls: [3],
                mod: 0,
                total: 3,
                formula: "1d6",
                sides: 6,
                diceCount: 1,
            }),
        });
        assert.equal(inlineRolls.length, 1);
        assert.match(displayText, /Light ⟦0⟧/);
        assert.doesNotMatch(displayText, /1d20|⟦1⟧/);
    });
});
