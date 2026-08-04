import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rollAttackD20 } from "./attackRoll.js";

describe("rollAttackD20", () => {
    it("returns d20 only with no mods", () => {
        const r = rollAttackD20({});
        assert.equal(r.kind, "attack");
        assert.equal(r.polarity, "none");
        assert.equal(r.rolls.length, 1);
        assert.ok(r.d20 >= 1 && r.d20 <= 20);
        assert.equal(r.total, r.d20);
        assert.equal(r.mod, 0);
    });

    it("adds highest boon die", () => {
        const samples = Array.from({ length: 40 }, () => rollAttackD20({ boons: 2 }));
        for (const r of samples) {
            assert.equal(r.polarity, "boon");
            assert.equal(r.modifierDice.length, 2);
            assert.equal(r.modifierKept, Math.max(...r.modifierDice));
            assert.equal(r.total, r.d20 + r.modifierKept);
            assert.equal(r.mod, r.modifierKept);
        }
    });

    it("subtracts highest curse die", () => {
        const r = rollAttackD20({ curses: 1 });
        assert.equal(r.polarity, "curse");
        assert.equal(r.modifierDice.length, 1);
        assert.equal(r.total, r.d20 - r.modifierKept);
        assert.equal(r.mod, -r.modifierKept);
    });

    it("prefers boons when both set", () => {
        const r = rollAttackD20({ boons: 1, curses: 2 });
        assert.equal(r.polarity, "boon");
    });
});
