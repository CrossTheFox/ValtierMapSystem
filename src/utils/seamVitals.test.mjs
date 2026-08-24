import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    buildOptimisticVitalsReduxPatch,
    clampHpCur,
    clampVigor,
    commitSeamHpChange,
    commitSeamVigChange,
    computeBarPercents,
    scrubDeltaToValue,
    vigorGainBlocked,
    VIGOR_BLOCK_CONDITION_CODES,
} from "./seamVitals.js";
import { normalizeCharacterVitals } from "./characterVitals.js";

describe("clampHpCur / clampVigor", () => {
    it("clamps hp to 0..hpMax", () => {
        assert.equal(clampHpCur(-3, 16), 0);
        assert.equal(clampHpCur(99, 16), 16);
        assert.equal(clampHpCur(8.6, 16), 9);
    });

    it("clamps vigor at floor zero only", () => {
        assert.equal(clampVigor(-2), 0);
        assert.equal(clampVigor(42.2), 42);
    });
});

describe("computeBarPercents", () => {
    it("matches mockup denom when vigor overflows hpMax", () => {
        const { denom, hpPct, vigPct } = computeBarPercents(16, 14, 5);
        assert.equal(denom, 19);
        assert.ok(Math.abs(hpPct - (14 / 19) * 100) < 0.001);
        assert.ok(Math.abs(vigPct - (5 / 19) * 100) < 0.001);
    });

    it("uses hpMax when no overflow", () => {
        const { denom } = computeBarPercents(16, 10, 2);
        assert.equal(denom, 16);
    });
});

describe("scrubDeltaToValue", () => {
    it("scales pointer delta to integer hp steps", () => {
        assert.equal(scrubDeltaToValue(80, 160, 16), 8);
        assert.equal(scrubDeltaToValue(-40, 160, 16), -4);
    });
});

describe("commitSeamHpChange (HUD parity)", () => {
    it("caps hp at vit-based max when above zero", () => {
        const r = commitSeamHpChange({ vit: 4, hpCur: 8 }, 20, { hpCur: 8 });
        assert.equal(r.hpCur, 16);
        assert.equal(r.vit, 4);
    });

    it("burns vit and refills hp when hp hits zero", () => {
        const r = commitSeamHpChange({ vit: 4, hpCur: 2 }, 0, { hpCur: 2, hpBroken: false });
        assert.equal(r.vit, 3);
        assert.equal(r.hpCur, 12);
        assert.equal(r.hpBroken, false);
    });

    it("latches break when cascade ends at zero hp", () => {
        const r = commitSeamHpChange({ vit: 1, hpCur: 1 }, 0, { hpCur: 1, hpBroken: false });
        assert.equal(r.vit, 0);
        assert.equal(r.hpCur, 0);
        assert.equal(r.hpBroken, true);
    });

    it("latches hpBroken until explicit cure", () => {
        const r = commitSeamHpChange(
            { vit: 4, hpCur: 0, hpBroken: true },
            10,
            { hpCur: 0, hpBroken: true },
        );
        assert.equal(r.hpCur, 10);
        assert.equal(r.hpBroken, true);
    });
});

describe("commitSeamVigChange", () => {
    it("allows unbounded vigor increases by default", () => {
        assert.deepEqual(commitSeamVigChange(0, 25), { vigor: 25 });
    });

    it("blocks vigor gains under shattered / SHA", () => {
        assert.deepEqual(
            commitSeamVigChange(2, 5, ["shattered"]),
            { vigor: 2 },
        );
        assert.deepEqual(
            commitSeamVigChange(1, 0, ["SHA"]),
            { vigor: 0 },
        );
        assert.deepEqual(
            commitSeamVigChange(3, 2, ["shattered"]),
            { vigor: 2 },
        );
    });
});

describe("vigorGainBlocked", () => {
    it("recognizes canonical block codes", () => {
        assert.equal(vigorGainBlocked(["SLA", "shattered"]), true);
        assert.equal(vigorGainBlocked(["SLA"]), false);
        for (const code of VIGOR_BLOCK_CONDITION_CODES) {
            assert.equal(vigorGainBlocked([code]), true);
        }
    });
});

describe("buildOptimisticVitalsReduxPatch", () => {
    it("merges nested turn and effort", () => {
        const char = { turn: { act1: true, act2: true, move: true }, effort: { current: 1, exhausted: false } };
        const patch = buildOptimisticVitalsReduxPatch(char, {
            hpCur: 12,
            turn: { act1: false },
            effort: { current: 2 },
        });
        assert.equal(patch.hpCur, 12);
        assert.deepEqual(patch.turn, { act1: false, act2: true, move: true });
        assert.deepEqual(patch.effort, { current: 2, exhausted: false });
    });

    it("ignores unrelated partial keys", () => {
        const patch = buildOptimisticVitalsReduxPatch({ hpCur: 5 }, { name: "X", vigor: 3 });
        assert.deepEqual(patch, { vigor: 3 });
    });
});

describe("vitals read contract (dossier ↔ HUD)", () => {
    it("normalizeCharacterVitals is stable for the same character doc", () => {
        const char = { vit: 5, hpCur: 14, vigor: 3, effort: { current: 1, exhausted: false } };
        const a = normalizeCharacterVitals(char);
        const b = normalizeCharacterVitals({ ...char });
        assert.equal(a.hpCur, b.hpCur);
        assert.equal(a.vigor, b.vigor);
        assert.equal(a.hpMax, b.hpMax);
        assert.deepEqual(a.effort, b.effort);
        assert.deepEqual(a.turn, b.turn);
    });

    it("dossier draft overlay matches merged read when only vitals change", () => {
        const base = { vit: 4, hpCur: 16, vigor: 0 };
        const draftPatch = { hpCur: 10, vigor: 2 };
        const merged = { ...base, ...draftPatch };
        const fromBase = normalizeCharacterVitals(base);
        const fromMerged = normalizeCharacterVitals(merged);
        assert.notEqual(fromBase.hpCur, fromMerged.hpCur);
        assert.equal(fromMerged.hpCur, 10);
        assert.equal(fromMerged.vigor, 2);
        assert.equal(fromMerged.hpMax, fromBase.hpMax);
    });
});
