import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveCombatStats } from "./resolveCombatStats.js";
import { ARCHETYPE_COMBAT_DEFAULTS } from "../constants/combatStats.js";

describe("resolveCombatStats", () => {
    it("uses archetype defaults without job/character", () => {
        const s = resolveCombatStats(null, null);
        assert.equal(s.vit, ARCHETYPE_COMBAT_DEFAULTS.wright.vit);
        assert.equal(s.hpMax, s.vit * 4);
        assert.equal(s.dash, Math.floor(s.speed / 2));
    });

    it("applies job combatStats over archetype", () => {
        const s = resolveCombatStats(
            {},
            { id: "job1", classArchetype: "stalwart", combatStats: { fray: 3, damageDie: 10 } },
        );
        assert.equal(s.fray, 3);
        assert.equal(s.damageDie, 10);
        assert.equal(s.vit, ARCHETYPE_COMBAT_DEFAULTS.stalwart.vit);
        assert.equal(s.armor, ARCHETYPE_COMBAT_DEFAULTS.stalwart.armor);
    });

    it("applies character overrides last", () => {
        const s = resolveCombatStats(
            { combatOverrides: { fray: 5, speed: 6 }, vit: 9 },
            { classArchetype: "vagabond", combatStats: { fray: 1 } },
        );
        assert.equal(s.fray, 5);
        assert.equal(s.speed, 6);
        assert.equal(s.dash, 3);
        // legacy vit when no combatOverrides.vit
        assert.equal(s.vit, 9);
    });

    describe("plate parity (Slice 3 — no VIG cell)", () => {
        const PLATE_KEYS = ["vit", "defense", "speed", "fray", "damageDie", "armor"];

        it("exposes every plate stat key as a finite number", () => {
            const s = resolveCombatStats(
                { combatOverrides: { defense: 4 } },
                { classArchetype: "stalwart", combatStats: { fray: 2 } },
            );
            for (const key of PLATE_KEYS) {
                assert.equal(typeof s[key], "number", `${key} should be a number`);
                assert.ok(Number.isFinite(s[key]), `${key} should be finite`);
            }
        });

        it("hpMax/dash derive from vit/speed only, independent of vigor overrides", () => {
            const withoutVigor = resolveCombatStats(
                { combatOverrides: { vit: 6, speed: 8 } },
                { classArchetype: "wright" },
            );
            const withVigor = resolveCombatStats(
                { combatOverrides: { vit: 6, speed: 8, vigor: 99 } },
                { classArchetype: "wright" },
            );
            assert.equal(withoutVigor.hpMax, 24);
            assert.equal(withoutVigor.dash, 4);
            // vigor override changes only vigor/vigorMax (deprecated fields), never hpMax/dash
            assert.equal(withVigor.hpMax, withoutVigor.hpMax);
            assert.equal(withVigor.dash, withoutVigor.dash);
            assert.equal(withVigor.vigor, 99);
        });

        it("damageDie clamps to a valid die even when the job/character omit it", () => {
            const s = resolveCombatStats({}, { classArchetype: "mendicant" });
            assert.ok(Number.isFinite(s.damageDie) && s.damageDie > 0);
        });
    });
});
