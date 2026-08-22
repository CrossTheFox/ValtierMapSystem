/**
 * Run: node --test src/utils/characterBurdens.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    normalizeBurdens,
    normalizeBurdenEffect,
    getActionPenance,
    effectiveActionDice,
    isBondPowerNullified,
    isAbilityCut,
    isTraitTorn,
    assertUniqueBurdenTarget,
    formatBurdenEffectSummary,
    isBurdenClockCleared,
    BURDEN_EFFECT_TYPES,
} from "./characterBurdens.js";

describe("normalizeBurdenEffect", () => {
    it("rejects empty / unknown", () => {
        assert.equal(normalizeBurdenEffect(null), null);
        assert.equal(normalizeBurdenEffect({ type: "nope", targetId: "x" }), null);
    });

    it("keeps type-only drafts", () => {
        assert.deepEqual(
            normalizeBurdenEffect({ type: "bond_nullify", targetId: "" }),
            { type: "bond_nullify", targetId: "" },
        );
    });

    it("clamps action penance amount to 1|2", () => {
        assert.deepEqual(
            normalizeBurdenEffect({ type: "action_penance", targetId: "sneak", amount: 9 }),
            { type: "action_penance", targetId: "sneak", amount: 1 },
        );
        assert.equal(
            normalizeBurdenEffect({ type: "action_penance", targetId: "sneak", amount: 2 }).amount,
            2,
        );
    });
});

describe("penance + dice", () => {
    const burdens = [
        {
            id: "b1",
            title: "Scar",
            text: "",
            clockSize: 4,
            clockFilled: 1,
            consequence: "",
            effect: { type: "action_penance", targetId: "sneak", amount: 2 },
        },
        null,
        null,
    ];

    it("reads penance and effective dice", () => {
        assert.equal(getActionPenance(burdens, "sneak"), 2);
        assert.equal(getActionPenance(burdens, "smash"), 0);
        assert.equal(effectiveActionDice(4, 2), 2);
        assert.equal(effectiveActionDice(1, 2), 0);
    });
});

describe("nullify / cut / torn", () => {
    const burdens = normalizeBurdens([
        {
            id: "b1",
            effect: { type: "bond_nullify", targetId: "bp1" },
            clockSize: 4,
            clockFilled: 0,
        },
        {
            id: "b2",
            effect: { type: "cutted_ability", targetId: "ab1" },
            clockSize: 4,
            clockFilled: 0,
        },
        {
            id: "b3",
            effect: { type: "trait_torn", targetId: "tr1" },
            clockSize: 4,
            clockFilled: 0,
        },
    ]);

    it("flags correct targets", () => {
        assert.equal(isBondPowerNullified(burdens, "bp1"), true);
        assert.equal(isAbilityCut(burdens, "ab1"), true);
        assert.equal(isTraitTorn(burdens, "tr1"), true);
        assert.equal(isAbilityCut(burdens, "tr1"), false);
    });
});

describe("assertUniqueBurdenTarget", () => {
    const burdens = [
        { id: "b1", effect: { type: "action_penance", targetId: "sneak", amount: 1 }, clockSize: 4, clockFilled: 0 },
        null,
        null,
    ];

    it("blocks duplicate action target", () => {
        const r = assertUniqueBurdenTarget(
            burdens,
            { type: BURDEN_EFFECT_TYPES.ACTION_PENANCE, targetId: "sneak", amount: 2 },
            1,
        );
        assert.equal(r.ok, false);
        assert.equal(r.conflictIndex, 0);
    });

    it("allows same slot re-save", () => {
        const r = assertUniqueBurdenTarget(
            burdens,
            { type: BURDEN_EFFECT_TYPES.ACTION_PENANCE, targetId: "sneak", amount: 1 },
            0,
        );
        assert.equal(r.ok, true);
    });
});

describe("format + clock clear", () => {
    it("formats penance summary", () => {
        assert.match(
            formatBurdenEffectSummary({ type: "action_penance", targetId: "sneak", amount: 2 }),
            /SNEAK/,
        );
    });

    it("detects cleared clock", () => {
        assert.equal(isBurdenClockCleared({ clockSize: 4, clockFilled: 4 }), true);
        assert.equal(isBurdenClockCleared({ clockSize: 4, clockFilled: 3 }), false);
    });
});
