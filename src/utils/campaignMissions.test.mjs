import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    emptyMission,
    filterMissionsForCharacter,
    missionProgressPercent,
    MISSION_SCOPE,
    MISSION_STATUS,
    normalizeMission,
    withClockFilled,
    withObjectiveDone,
} from "./campaignMissions.js";

describe("campaignMissions", () => {
    it("normalizes clock sizes to 4|6|8|12", () => {
        assert.equal(normalizeMission({ id: "a", clockSize: 6 }).clockSize, 6);
        assert.equal(normalizeMission({ id: "a", clockSize: 12 }).clockSize, 12);
        assert.equal(normalizeMission({ id: "a", clockSize: 5 }).clockSize, 4);
    });

    it("toggles objective weight into clock and auto-completes", () => {
        const m = emptyMission({
            clockSize: 4,
            objectives: [
                { id: "o1", text: "A", weight: 2, done: false },
                { id: "o2", text: "B", weight: 2, done: false },
            ],
        });
        const mid = withObjectiveDone(m, "o1", true);
        assert.equal(mid.clockFilled, 2);
        assert.equal(mid.status, MISSION_STATUS.ACTIVE);
        const done = withObjectiveDone(mid, "o2", true);
        assert.equal(done.clockFilled, 4);
        assert.equal(done.status, MISSION_STATUS.COMPLETED);
        const undone = withObjectiveDone(done, "o2", false);
        assert.equal(undone.clockFilled, 2);
        assert.equal(undone.status, MISSION_STATUS.ACTIVE);
    });

    it("clamps clock fills and reports percent", () => {
        const m = withClockFilled(emptyMission({ clockSize: 8 }), 99);
        assert.equal(m.clockFilled, 8);
        assert.equal(missionProgressPercent(m), 100);
    });

    it("filters personal vs generic for players", () => {
        const missions = [
            emptyMission({ id: "g1", scope: MISSION_SCOPE.GENERIC, title: "G" }),
            emptyMission({
                id: "p1",
                scope: MISSION_SCOPE.PERSONAL,
                title: "P",
                assigneeCharacterIds: ["c1"],
            }),
            emptyMission({
                id: "h1",
                scope: MISSION_SCOPE.GENERIC,
                status: MISSION_STATUS.HIDDEN,
                title: "H",
            }),
            emptyMission({
                id: "p2",
                scope: MISSION_SCOPE.PERSONAL,
                title: "Other",
                assigneeCharacterIds: ["c9"],
            }),
        ];
        const player = filterMissionsForCharacter(missions, "c1", { isDM: false });
        assert.deepEqual(player.map((m) => m.id).sort(), ["g1", "p1"]);
        // DM still scopes personal missions to the open dossier character (+ hidden generics).
        const dm = filterMissionsForCharacter(missions, "c1", { isDM: true });
        assert.deepEqual(dm.map((m) => m.id).sort(), ["g1", "h1", "p1"]);
    });
});
