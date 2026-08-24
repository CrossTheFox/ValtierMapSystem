import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { substituteFormulaTokens, packetFormula, viewPacketFormula } from "./abilityFormula.js";

describe("substituteFormulaTokens", () => {
    it("returns em-dash for blank input", () => {
        assert.equal(substituteFormulaTokens(null), "—");
        assert.equal(substituteFormulaTokens(undefined), "—");
        assert.equal(substituteFormulaTokens(""), "—");
    });

    it("substitutes [damageDie] with the live die, keeping a leading count", () => {
        assert.equal(substituteFormulaTokens("[damageDie]+[fray]", { damageDie: 8, fray: 1 }), "d8+1");
        assert.equal(substituteFormulaTokens("2[damageDie]", { damageDie: 10 }), "2d10");
    });

    it("substitutes [fray] and [mechanicResource] with live values", () => {
        assert.equal(substituteFormulaTokens("[fray]", { fray: 3 }), "3");
        assert.equal(substituteFormulaTokens("[mechanicResource]", { mechanicResource: 4 }), "4");
    });

    it("passes through literal dice notation untouched", () => {
        assert.equal(substituteFormulaTokens("1d20+3"), "1d20+3");
    });

    it("collapses [Nd sides] macro brackets", () => {
        assert.equal(substituteFormulaTokens("[2d6]+1"), "2d6+1");
    });

    it("defaults missing ctx values sanely (die>=2, fray/mech>=0)", () => {
        assert.equal(substituteFormulaTokens("[damageDie]"), "d6");
        assert.equal(substituteFormulaTokens("[fray]"), "0");
    });
});

describe("packetFormula / viewPacketFormula", () => {
    it("reads formula off a packet, null when absent", () => {
        assert.equal(packetFormula({ formula: "1d8" }), "1d8");
        assert.equal(packetFormula(null), null);
        assert.equal(packetFormula({}), null);
    });

    it("viewPacketFormula substitutes tokens for a packet in one call", () => {
        assert.equal(
            viewPacketFormula({ formula: "[damageDie]+[fray]" }, { damageDie: 8, fray: 2 }),
            "d8+2",
        );
        assert.equal(viewPacketFormula(null), "—");
    });
});
