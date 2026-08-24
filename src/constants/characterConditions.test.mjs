import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    CHARACTER_CONDITIONS,
    CHARACTER_CONDITION_KEYS,
    COND_GROUPS,
    normalizeCharacterConditions,
    activeCharacterConditions,
    hasNegConditions,
    hasPosConditions,
    conditionGroupCounts,
} from "./characterConditions.js";

describe("CHARACTER_CONDITIONS — catalog shape", () => {
    it("has exactly 25 codes across the 4 groups", () => {
        assert.equal(CHARACTER_CONDITIONS.length, 25);
        assert.equal(new Set(CHARACTER_CONDITIONS.map((c) => c.code)).size, 25);
        assert.equal(new Set(CHARACTER_CONDITION_KEYS).size, 25);
    });

    it("every entry belongs to one of the 4 canonical groups", () => {
        const groupIds = new Set(COND_GROUPS.map((g) => g.id));
        for (const c of CHARACTER_CONDITIONS) {
            assert.ok(groupIds.has(c.group), `${c.code} has an unknown group ${c.group}`);
        }
    });

    it("keeps the 9 pre-existing ICON status legacy keys (no data migration needed)", () => {
        const legacyKeys = ["slashed", "weakened", "stunned", "sealed", "pacified", "blinded", "dazed", "shattered", "vulnerable"];
        for (const key of legacyKeys) {
            assert.ok(CHARACTER_CONDITION_KEYS.includes(key), `missing legacy key ${key}`);
        }
    });
});

describe("normalizeCharacterConditions", () => {
    it("dedupes and drops anything outside the 25-code allow-list", () => {
        const out = normalizeCharacterConditions(["shattered", "shattered", "bogus", "mrk"]);
        assert.deepEqual(out, ["shattered", "mrk"]);
    });

    it("returns [] for non-array input", () => {
        assert.deepEqual(normalizeCharacterConditions(null), []);
        assert.deepEqual(normalizeCharacterConditions(undefined), []);
    });
});

describe("activeCharacterConditions", () => {
    it("resolves catalog rows in canonical catalog order, not input order", () => {
        const rows = activeCharacterConditions(["shattered", "for"]);
        assert.deepEqual(rows.map((r) => r.code), ["FOR", "SHA"]);
    });
});

describe("hasNegConditions / hasPosConditions", () => {
    it("statuses + suffer count as negative", () => {
        assert.equal(hasNegConditions(["shattered"]), true);
        assert.equal(hasNegConditions(["bld"]), true);
        assert.equal(hasNegConditions(["for"]), false);
    });

    it("boons + ongoing count as positive", () => {
        assert.equal(hasPosConditions(["for"]), true);
        assert.equal(hasPosConditions(["mrk"]), true);
        assert.equal(hasPosConditions(["shattered"]), false);
    });

    it("neg and pos can both be true at once (neg wins visually, decided by the caller)", () => {
        const conds = ["for", "shattered"];
        assert.equal(hasNegConditions(conds), true);
        assert.equal(hasPosConditions(conds), true);
    });
});

describe("conditionGroupCounts", () => {
    it("counts active conditions per group", () => {
        const counts = conditionGroupCounts(["for", "ins", "mrk", "shattered"]);
        assert.deepEqual(counts, { boons: 2, ongoing: 1, statuses: 1, suffer: 0 });
    });
});
