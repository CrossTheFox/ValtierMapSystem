import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    CLOCK_SIZES,
    CLOCK_SCOPES,
    normalizeClockSize,
    normalizeClockInstance,
    emptySessionClock,
    halfStepsFromLegacyFilled,
    cycleClockSize,
    sizeTheme,
} from "./clockInstance.js";

describe("normalizeClockSize", () => {
    it("allows 4/6/8/12", () => {
        assert.equal(normalizeClockSize(4), 4);
        assert.equal(normalizeClockSize(12), 12);
        assert.equal(normalizeClockSize(7), 4);
        assert.deepEqual(CLOCK_SIZES, [4, 6, 8, 12]);
    });
});

describe("normalizeClockInstance", () => {
    it("defaults session clock to dm_only", () => {
        const c = emptySessionClock({ name: "Patrulla" });
        assert.equal(c.ownerType, "session");
        assert.equal(c.visibility.clockScope, CLOCK_SCOPES.DM_ONLY);
        assert.equal(c.filledHalfSteps, 0);
        assert.equal(c.sizeTicks, 4);
        assert.equal(c.name, "Patrulla");
    });
    it("migrates legacy clockFilled to half-steps", () => {
        const c = normalizeClockInstance({
            id: "x",
            clockFilled: 2,
            sizeTicks: 4,
            visibility: { clockScope: "public" },
        });
        assert.equal(c.filledHalfSteps, 4);
        assert.equal(c.visibility.clockScope, "public");
        assert.equal(c.visibility.rollScope, "public");
    });
    it("clamps filled to size", () => {
        const c = normalizeClockInstance({ id: "x", filledHalfSteps: 99, sizeTicks: 6 });
        assert.equal(c.filledHalfSteps, 12);
    });
});

describe("halfStepsFromLegacyFilled", () => {
    it("prefers filledHalfSteps", () => {
        assert.equal(halfStepsFromLegacyFilled(2, 4, 5), 5);
        assert.equal(halfStepsFromLegacyFilled(2, 4, undefined), 4);
    });
});

describe("cycleClockSize / theme", () => {
    it("cycles 4→6→8→12→4", () => {
        assert.equal(cycleClockSize(4), 6);
        assert.equal(cycleClockSize(12), 4);
        assert.equal(sizeTheme(4).label, "fácil");
        assert.equal(sizeTheme(12).label, "extremo");
    });
});
