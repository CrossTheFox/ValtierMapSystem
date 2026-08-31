import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    applyHpWithVitCascadeOnCharacter,
    applyVitChangeOnCharacter,
    buildVitalsMigrationPatch,
    normalizeCharacterVitals,
    normalizeEffort,
    resolveHpDisplayDenom,
    resolveHpBrokenAfterChange,
} from "./characterVitals.js";

describe("normalizeCharacterVitals", () => {
    it("defaults hpCur to hpMax when missing", () => {
        const v = normalizeCharacterVitals({ vit: 5 });
        assert.equal(v.hpMax, 20);
        assert.equal(v.hpCur, 20);
        assert.equal(v.vigor, 0);
    });

    it("reads hpCur and effort from sessionPools fallback", () => {
        const v = normalizeCharacterVitals(
            { vit: 4 },
            {
                sessionPoolEntry: {
                    hp: { current: 6, broken: true },
                    effort: { current: 2, exhausted: false },
                },
            },
        );
        assert.equal(v.hpCur, 6);
        assert.equal(v.effort.current, 2);
        assert.equal(v.hpBroken, true);
    });

    it("never raises hpCur above hpMax", () => {
        const v = normalizeCharacterVitals({ vit: 4, hpCur: 99 });
        assert.equal(v.hpCur, 16);
    });
});

describe("normalizeEffort", () => {
    it("marks exhausted when current reaches max", () => {
        const e = normalizeEffort({ current: 3 }, 3);
        assert.equal(e.current, 3);
        assert.equal(e.exhausted, true);
    });
});

describe("applyHpWithVitCascadeOnCharacter", () => {
    it("refills hp and burns vit when hp hits zero", () => {
        const r = applyHpWithVitCascadeOnCharacter({ vit: 4, hpCur: 2 }, 0);
        assert.equal(r.vit, 3);
        assert.equal(r.hpCur, 12);
        assert.equal(r.died, false);
    });

    it("dies at last vit", () => {
        const r = applyHpWithVitCascadeOnCharacter({ vit: 1, hpCur: 1 }, 0);
        assert.equal(r.vit, 0);
        assert.equal(r.hpCur, 0);
        assert.equal(r.died, true);
    });
});

describe("buildVitalsMigrationPatch", () => {
    it("maps legacy sessionPools for characters without hpCur", () => {
        const patch = buildVitalsMigrationPatch(
            { vit: 7, combatOverrides: { vit: 7 } },
            { hp: { current: 28, broken: false }, effort: { current: 1, exhausted: false } },
        );
        assert.ok(patch);
        assert.equal(patch.hpCur, 28);
        assert.equal(patch.effort.current, 1);
        assert.equal(patch.hpBroken, false);
    });

    it("returns null when hpCur already persisted", () => {
        assert.equal(buildVitalsMigrationPatch({ hpCur: 10 }, { hp: { current: 5 } }), null);
    });
});

describe("resolveHpBrokenAfterChange", () => {
    it("latches break when hp hits zero", () => {
        assert.equal(resolveHpBrokenAfterChange(false, 5, 0), true);
    });

    it("keeps break after healing hp", () => {
        assert.equal(resolveHpBrokenAfterChange(true, 0, 8), true);
    });
});

describe("applyVitChangeOnCharacter", () => {
    it("scales hpCur when vit is reduced", () => {
        const r = applyVitChangeOnCharacter({ vit: 4, hpCur: 16 }, 2);
        assert.equal(r.vit, 2);
        assert.equal(r.hpCur, 8);
    });
});

describe("resolveHpDisplayDenom", () => {
    it("uses hpCur + vigor when above hpMax", () => {
        assert.equal(resolveHpDisplayDenom(16, 14, 5), 19);
    });
});
