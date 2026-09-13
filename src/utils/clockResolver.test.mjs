/**
 * Run: node --test src/utils/clockResolver.test.mjs src/utils/clockAcl.test.mjs src/utils/clockInstance.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    bandAdvanceHalfSteps,
    resolveClockRoll,
    applyAdvance,
    displayFilled,
    jumpToHalfSteps,
    formatFilledLabel,
} from "./clockResolver.js";

describe("bandAdvanceHalfSteps", () => {
    it("maps ICON bands", () => {
        assert.equal(bandAdvanceHalfSteps(1), 0);
        assert.equal(bandAdvanceHalfSteps(3), 0);
        assert.equal(bandAdvanceHalfSteps(4), 1);
        assert.equal(bandAdvanceHalfSteps(5), 1);
        assert.equal(bandAdvanceHalfSteps(6), 2);
    });
});

describe("resolveClockRoll §7.3", () => {
    it("[3] → 0", () => {
        const r = resolveClockRoll([3]);
        assert.equal(r.advanceHalfSteps, 0);
        assert.equal(r.effectiveDie, 3);
    });
    it("[4] → +0.5", () => {
        assert.equal(resolveClockRoll([4]).advanceHalfSteps, 1);
    });
    it("[6] → +1", () => {
        assert.equal(resolveClockRoll([6]).advanceHalfSteps, 2);
    });
    it("[6,6] supercrítico → +2", () => {
        const r = resolveClockRoll([6, 6]);
        assert.equal(r.advanceHalfSteps, 4);
        assert.equal(r.effectiveDie, null);
        assert.equal(r.rule, "multi-six");
    });
    it("[6,4] keep-highest → +1 (no +1.5)", () => {
        assert.equal(resolveClockRoll([6, 4]).advanceHalfSteps, 2);
    });
    it("[4,5] keep-highest → +0.5 (no +1)", () => {
        assert.equal(resolveClockRoll([4, 5]).advanceHalfSteps, 1);
    });
    it("[3,3] → 0", () => {
        assert.equal(resolveClockRoll([3, 3]).advanceHalfSteps, 0);
    });
    it("[6,6,3] → +2", () => {
        assert.equal(resolveClockRoll([6, 6, 3]).advanceHalfSteps, 4);
    });
    it("[2,2,6] 3d6 → +1", () => {
        assert.equal(resolveClockRoll([2, 2, 6]).advanceHalfSteps, 2);
    });
    it("[4,5] acción en cero keep-lowest → +0.5", () => {
        assert.equal(resolveClockRoll([4, 5], { selectionMode: "keep_lowest" }).advanceHalfSteps, 1);
    });
    it("[2,6] acción en cero → 0", () => {
        assert.equal(resolveClockRoll([2, 6], { selectionMode: "keep_lowest" }).advanceHalfSteps, 0);
    });
});

describe("applyAdvance / jumpToHalfSteps", () => {
    it("caps at size", () => {
        const r = applyAdvance({ filledHalfSteps: 6, sizeTicks: 4 }, 4);
        assert.equal(r.filledHalfSteps, 8);
        assert.equal(r.complete, true);
    });
    it("jump clamps and re-click is identity", () => {
        assert.equal(jumpToHalfSteps(5, 4), 5);
        assert.equal(jumpToHalfSteps(5, 4), jumpToHalfSteps(5, 4));
        assert.equal(jumpToHalfSteps(99, 4), 8);
        assert.equal(jumpToHalfSteps(-2, 4), 0);
    });
    it("displayFilled 5 half-steps → 2.5", () => {
        assert.equal(displayFilled(5), 2.5);
        assert.equal(formatFilledLabel(5, 4), "2.5/4");
        assert.equal(formatFilledLabel(4, 4), "2/4");
    });
});
