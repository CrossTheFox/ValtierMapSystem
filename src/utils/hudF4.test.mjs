import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    shouldShowPrincipalPlus,
    nextPrincipalAfterEject,
    effortBladeCommit,
    toggleTurn,
    hpFromBarRatio,
} from "./hudF4.js";
import {
    applyHpWithVitCascadeOnCharacter,
} from "./characterVitals.js";
import {
    computeBarPercents,
    vigorGainBlocked,
    commitSeamVigChange,
} from "./seamVitals.js";

describe("shouldShowPrincipalPlus", () => {
    it("hides (+) when a non-DM has exactly one assigned character", () => {
        assert.equal(shouldShowPrincipalPlus({ assignedCount: 1, isDm: false }), false);
    });

    it("shows (+) when assignedCount > 1", () => {
        assert.equal(shouldShowPrincipalPlus({ assignedCount: 2, isDm: false }), true);
    });

    it("shows (+) for DM even with a single assigned character", () => {
        assert.equal(shouldShowPrincipalPlus({ assignedCount: 1, isDm: true }), true);
    });

    it("does not emit hpCur or effort keys", () => {
        const shown = shouldShowPrincipalPlus({ assignedCount: 3, isDm: false });
        assert.equal(typeof shown, "boolean");
        assert.equal("hpCur" in Object(shown), false);
    });
});

describe("nextPrincipalAfterEject", () => {
    const assigned = ["judeth", "nyssara", "krell"];

    it("keeps principal when ejecting another stack row", () => {
        const out = nextPrincipalAfterEject({
            ejectedId: "krell",
            principalId: "judeth",
            assignedIds: assigned,
            stackIds: assigned,
        });
        assert.equal(out.nextPrincipalId, "judeth");
        assert.deepEqual(out.remainingStackIds, ["judeth", "nyssara"]);
        assert.equal("hpCur" in out, false);
        assert.equal("effort" in out, false);
    });

    it("promotes the next assigned id when ejecting the principal", () => {
        const out = nextPrincipalAfterEject({
            ejectedId: "judeth",
            principalId: "judeth",
            assignedIds: assigned,
            stackIds: assigned,
        });
        assert.equal(out.nextPrincipalId, "nyssara");
        assert.deepEqual(out.remainingAssignedIds, ["nyssara", "krell"]);
    });

    it("sets hidePlus when a single assigned character remains", () => {
        const out = nextPrincipalAfterEject({
            ejectedId: "nyssara",
            principalId: "judeth",
            assignedIds: ["judeth", "nyssara"],
            stackIds: ["judeth", "nyssara"],
        });
        assert.equal(out.nextPrincipalId, "judeth");
        assert.equal(out.hidePlus, true);
    });

    it("clears principal when the last assigned id is ejected", () => {
        const out = nextPrincipalAfterEject({
            ejectedId: "judeth",
            principalId: "judeth",
            assignedIds: ["judeth"],
            stackIds: ["judeth"],
        });
        assert.equal(out.nextPrincipalId, null);
        assert.equal(out.hidePlus, true);
    });
});

describe("effortBladeCommit → character.effort", () => {
    it("raises effort.current when clicking an empty blade", () => {
        const patch = effortBladeCommit(1, 1, 3);
        assert.equal(patch.effort.current, 2);
        assert.equal(patch.effort.exhausted, false);
    });

    it("drops effort.current when clicking a lit blade", () => {
        const patch = effortBladeCommit(0, 2, 3);
        assert.equal(patch.effort.current, 0);
        assert.equal(patch.effort.exhausted, false);
    });

    it("sets effort.exhausted when current reaches max", () => {
        const patch = effortBladeCommit(2, 2, 3);
        assert.equal(patch.effort.current, 3);
        assert.equal(patch.effort.exhausted, true);
    });
});

describe("toggleTurn → character.turn", () => {
    it("toggles act1 on the full turn object", () => {
        const next = toggleTurn({ act1: true, act2: true, move: true }, "act1");
        assert.deepEqual(next, { act1: false, act2: true, move: true });
    });

    it("toggles move independently of act pips", () => {
        const next = toggleTurn({ act1: false, act2: true, move: true }, "move");
        assert.equal(next.move, false);
        assert.equal(next.act1, false);
        assert.equal(next.act2, true);
    });

    it("ignores unknown keys without mutating vitals fields", () => {
        const next = toggleTurn({ act1: true, act2: true, move: false }, "hpCur");
        assert.deepEqual(next, { act1: true, act2: true, move: false });
        assert.equal("hpCur" in next, false);
    });
});

describe("hpFromBarRatio → character.hpCur", () => {
    it("maps a 0..1 click ratio onto hpCur clamped 0..hpMax", () => {
        assert.equal(hpFromBarRatio(0, 16), 0);
        assert.equal(hpFromBarRatio(1, 16), 16);
        assert.equal(hpFromBarRatio(0.5, 16), 8);
        assert.equal(hpFromBarRatio(-1, 16), 0);
        assert.equal(hpFromBarRatio(2, 16), 16);
    });

    it("HUD HP click still uses the VIT cascade when hp hits 0", () => {
        const nextHp = hpFromBarRatio(0, 16);
        const r = applyHpWithVitCascadeOnCharacter({ vit: 4, hpCur: 8 }, nextHp);
        assert.equal(r.vit, 3);
        assert.equal(r.hpCur, 12);
    });
});

describe("HUD HP/VIG paint uses seam percents", () => {
    it("shares computeBarPercents denom with the dossier seam", () => {
        const { denom, hpPct, vigPct } = computeBarPercents(16, 14, 5);
        assert.equal(denom, 19);
        assert.ok(Math.abs(hpPct - (14 / 19) * 100) < 0.001);
        assert.ok(Math.abs(vigPct - (5 / 19) * 100) < 0.001);
    });

    it("SHA blocks vigor gains (HUD is display-only; dossier writes vigor)", () => {
        assert.equal(vigorGainBlocked(["shattered"]), true);
        assert.deepEqual(commitSeamVigChange(0, 2, ["shattered"]), { vigor: 0 });
    });
});
