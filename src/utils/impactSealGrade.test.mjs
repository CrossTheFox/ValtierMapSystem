/**
 * Unit tests — Seal Grade (F1) mapping from cascade impacts.
 */
import assert from "node:assert/strict";
import {
    SEAL_GRADE,
    gradeImpactSeal,
    computeSealCoverage,
    buildSealGradeFromCascadeResult,
} from "./impactSealGrade.js";

function imp(partial) {
    return {
        entityTitle: "Test",
        valid: true,
        confidence: "alta",
        entityResolved: { id: "e1", title: "Test" },
        resolvedChanges: [],
        ...partial,
    };
}

assert.equal(gradeImpactSeal(imp({})), SEAL_GRADE.OK);
assert.equal(gradeImpactSeal(imp({ confidence: "media" })), SEAL_GRADE.WARN);
assert.equal(gradeImpactSeal(imp({ confidence: "baja" })), SEAL_GRADE.WARN);
assert.equal(gradeImpactSeal(imp({ valid: false })), SEAL_GRADE.FAIL);
assert.equal(gradeImpactSeal(imp({ entityResolved: null })), SEAL_GRADE.FAIL);

assert.equal(
    gradeImpactSeal(imp({
        resolvedChanges: [
            { kind: "relation_update", valid: true },
            { kind: "relation_add", valid: false },
        ],
    })),
    SEAL_GRADE.WARN,
);

assert.equal(
    gradeImpactSeal(imp({
        resolvedChanges: [
            { kind: "relation_update", valid: false },
            { kind: "dm_note", valid: true },
        ],
    })),
    SEAL_GRADE.FAIL,
);

assert.equal(
    gradeImpactSeal(imp({
        resolvedChanges: [{ kind: "relation_update", valid: true, repaired: true }],
    })),
    SEAL_GRADE.WARN,
);

const okish = [
    imp({ entityTitle: "A", entityResolved: { id: "a" }, confidence: "alta" }),
    imp({ entityTitle: "B", entityResolved: { id: "b" }, confidence: "media" }),
    imp({ entityTitle: "C", entityResolved: { id: "c" }, valid: false }),
];
assert.equal(computeSealCoverage(okish), 67);

const sealed = buildSealGradeFromCascadeResult({
    impacts: okish,
    collectiveImpacts: [],
});
assert.equal(sealed.gradesByEntityId.a, SEAL_GRADE.OK);
assert.equal(sealed.gradesByEntityId.b, SEAL_GRADE.WARN);
assert.equal(sealed.gradesByEntityId.c, SEAL_GRADE.FAIL);
assert.ok(["ok", "warn", "fail"].includes(sealed.grade));
assert.equal(typeof sealed.pct, "number");

console.log("impactSealGrade.test.mjs: ok");
