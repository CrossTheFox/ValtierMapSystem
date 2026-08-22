/**
 * ICON action-dice pool helpers (narrative / skill rolls).
 * Run: node --test src/utils/actionDiceRoll.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    resolveActionDicePool,
    describeActionDicePool,
} from "./actionDiceRoll.js";

describe("resolveActionDicePool", () => {
    it("adds boons and subtracts curses", () => {
        assert.deepEqual(resolveActionDicePool(2, { boons: 1, curses: 0 }).net, 3);
        assert.deepEqual(resolveActionDicePool(2, { boons: 0, curses: 1 }).net, 1);
        assert.equal(resolveActionDicePool(1, { curses: 1 }).isLowest, true);
        assert.equal(resolveActionDicePool(0, {}).diceCount, 2);
    });

    it("clamps mods to 0–2", () => {
        assert.equal(resolveActionDicePool(2, { boons: 9 }).boons, 2);
        assert.equal(resolveActionDicePool(2, { curses: -3 }).curses, 0);
    });
});

describe("describeActionDicePool", () => {
    it("previews keep-highest and keep-lowest", () => {
        const hi = describeActionDicePool(2, { boons: 1 });
        assert.equal(hi.isLowest, false);
        assert.match(hi.summary, /3d6/);
        const lo = describeActionDicePool(0, {});
        assert.equal(lo.isLowest, true);
        assert.match(lo.summary, /2d6/);
    });
});
