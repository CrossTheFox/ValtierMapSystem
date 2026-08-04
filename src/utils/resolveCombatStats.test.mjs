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
});
