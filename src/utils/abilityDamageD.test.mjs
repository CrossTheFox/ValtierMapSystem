import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    countDamageDice,
    deriveCritFormula,
    doubleDiceInFormula,
    formulaFromDiceCount,
    standardAttackPackets,
} from "./abilityDamageD.js";

describe("countDamageDice", () => {
    it("counts Nd[damageDie] and shorthand forms", () => {
        assert.equal(countDamageDice("1d[damageDie]+[fray]"), 1);
        assert.equal(countDamageDice("2d[damageDie]"), 2);
        assert.equal(countDamageDice("[damageDie]+[fray]"), 1);
        assert.equal(countDamageDice("3[damageDie]"), 3);
        assert.equal(countDamageDice("[fray]"), 0);
    });
});

describe("deriveCritFormula", () => {
    it("doubles max D between light and heavy (1D/2D → 4D)", () => {
        const crit = deriveCritFormula("1d[damageDie]+[fray]", "2d[damageDie]+[fray]");
        assert.equal(crit, "4d[damageDie]+[fray]");
    });

    it("handles Anathema-style 2D/3D → 6D crit", () => {
        const crit = deriveCritFormula("2d[damageDie]", "3d[damageDie]");
        assert.equal(crit, "6d[damageDie]");
    });

    it("light-only derives 2D crit from 1D light", () => {
        const crit = deriveCritFormula("1d[damageDie]+[fray]", "");
        assert.equal(crit, "2d[damageDie]+[fray]");
    });
});

describe("standardAttackPackets", () => {
    it("returns 1D / 2D / 4D defaults", () => {
        const p = standardAttackPackets();
        assert.equal(p.damageOnHit.formula, "[damageDie]+[fray]");
        assert.equal(p.damageOnHeavy.formula, "2d[damageDie]+[fray]");
        assert.equal(p.damageOnCrit.formula, "4d[damageDie]+[fray]");
        assert.equal(p.damageOnMiss.formula, "[fray]");
    });
});

describe("doubleDiceInFormula", () => {
    it("doubles dice preserving suffix", () => {
        assert.equal(doubleDiceInFormula("1d[damageDie]+[fray]"), "2d[damageDie]+[fray]");
    });
});

describe("formulaFromDiceCount", () => {
    it("uses shorthand for 1D unless forced", () => {
        assert.equal(formulaFromDiceCount(1, { suffix: "+[fray]" }), "[damageDie]+[fray]");
        assert.equal(
            formulaFromDiceCount(1, { suffix: "+[fray]", useExplicitCount: true }),
            "1d[damageDie]+[fray]",
        );
    });
});
