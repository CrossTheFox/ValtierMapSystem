import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    canViewClock,
    canViewRoll,
    canAttemptResolve,
    canViewClockChatMessage,
    quotaOf,
    consumeGrant,
    withConsumedGrant,
    visibleUserIdsForRoll,
} from "./clockAcl.js";

const assigned = {
    visibility: {
        clockScope: "assigned",
        viewerUserIds: ["uid_nyss"],
        viewerCharacterIds: ["char_nyss"],
        rollScope: "personal",
    },
    resolveGrant: { quotas: { char_nyss: 1 } },
};

const secret = {
    visibility: { clockScope: "dm_only", viewerUserIds: [], viewerCharacterIds: [], rollScope: "dm_only" },
    resolveGrant: { quotas: {} },
};

const table = {
    visibility: { clockScope: "public", viewerUserIds: [], viewerCharacterIds: [], rollScope: "public" },
    resolveGrant: { quotas: {} },
};

describe("canViewClock", () => {
    it("DM bypass", () => {
        assert.equal(canViewClock(secret, { isDM: true }), true);
    });
    it("dm_only hidden from players", () => {
        assert.equal(canViewClock(secret, { isDM: false, userId: "u1" }), false);
    });
    it("assigned + ojo", () => {
        assert.equal(canViewClock(assigned, { isDM: false, userId: "uid_nyss", characterId: "char_nyss" }), true);
        assert.equal(canViewClock(assigned, { isDM: false, userId: "uid_other", characterId: "char_jud" }), false);
    });
    it("public visible", () => {
        assert.equal(canViewClock(table, { isDM: false, userId: "u1" }), true);
    });
    it("assigned only viewerUserIds", () => {
        const clock = {
            visibility: {
                clockScope: "assigned",
                viewerUserIds: ["uid_nyss"],
                viewerCharacterIds: [],
                rollScope: "personal",
            },
        };
        assert.equal(canViewClock(clock, { isDM: false, userId: "uid_nyss", characterId: "char_other" }), true);
        assert.equal(canViewClock(clock, { isDM: false, userId: "uid_other", characterId: "char_nyss" }), false);
    });
    it("assigned only viewerCharacterIds", () => {
        const clock = {
            visibility: {
                clockScope: "assigned",
                viewerUserIds: [],
                viewerCharacterIds: ["char_nyss"],
                rollScope: "personal",
            },
        };
        assert.equal(canViewClock(clock, { isDM: false, userId: "uid_other", characterId: "char_nyss" }), true);
        assert.equal(canViewClock(clock, { isDM: false, userId: "uid_nyss", characterId: "char_jud" }), false);
    });
    it("assigned empty lists hidden", () => {
        const clock = {
            visibility: {
                clockScope: "assigned",
                viewerUserIds: [],
                viewerCharacterIds: [],
                rollScope: "personal",
            },
        };
        assert.equal(canViewClock(clock, { isDM: false, userId: "u1", characterId: "c1" }), false);
    });
    it("assigned via roster characterIds extras (ojo sin ficha activa)", () => {
        const clock = {
            visibility: {
                clockScope: "assigned",
                viewerUserIds: [],
                viewerCharacterIds: ["char_nyss"],
                rollScope: "personal",
            },
        };
        assert.equal(canViewClock(clock, {
            isDM: false,
            userId: "uid_nyss",
            characterId: "char_other",
            characterIds: ["char_nyss", "char_spare"],
        }), true);
        assert.equal(canViewClock(clock, {
            isDM: false,
            userId: "uid_nyss",
            characterId: "char_other",
            characterIds: ["char_spare"],
        }), false);
    });
    it("null clock is hidden", () => {
        assert.equal(canViewClock(null, { isDM: false, userId: "u1" }), false);
        assert.equal(canViewClock(null, { isDM: true }), false);
    });
});

describe("canViewRoll", () => {
    it("personal hides from other players", () => {
        const event = { rollScope: "personal", actorUserId: "uid_nyss" };
        assert.equal(canViewRoll(event, assigned, { isDM: false, userId: "uid_nyss", characterId: "char_nyss" }), true);
        assert.equal(canViewRoll(event, assigned, { isDM: false, userId: "uid_jud", characterId: "char_nyss" }), false);
        assert.equal(canViewRoll(event, assigned, { isDM: true, userId: "dm" }), true);
    });
    it("dm_only rolls hidden even if clock is public", () => {
        const clock = { ...table, visibility: { ...table.visibility, rollScope: "dm_only" } };
        assert.equal(canViewClock(clock, { isDM: false, userId: "u1" }), true);
        assert.equal(canViewRoll({ rollScope: "dm_only" }, clock, { isDM: false, userId: "u1" }), false);
    });
    it("clock null uses event rollScope", () => {
        const player = { isDM: false, userId: "u1" };
        assert.equal(canViewRoll({ rollScope: "public" }, null, player), true);
        assert.equal(canViewRoll({ rollScope: "dm_only" }, null, player), false);
        assert.equal(canViewRoll({ rollScope: "personal", senderId: "u1" }, null, player), true);
        assert.equal(canViewRoll({ rollScope: "personal", senderId: "u2" }, null, player), false);
        assert.equal(canViewRoll({ rollScope: "personal", actorUserId: "u1" }, null, player), true);
    });
});

describe("canAttemptResolve / quotas", () => {
    it("quota 0 blocks, 1 and -1 allow", () => {
        const v = { isDM: false, userId: "uid_nyss", characterId: "char_nyss" };
        assert.equal(canAttemptResolve({ ...assigned, resolveGrant: { quotas: {} } }, v), false);
        assert.equal(canAttemptResolve(assigned, v), true);
        assert.equal(canAttemptResolve({ ...assigned, resolveGrant: { quotas: { char_nyss: -1 } } }, v), true);
        assert.equal(quotaOf(assigned, "char_nyss"), 1);
    });
    it("DM always, consumeGrant does not touch DM", () => {
        const clock = { resolveGrant: { quotas: { char_nyss: 2 } } };
        consumeGrant(clock, { isDM: true, characterId: "char_nyss" });
        assert.equal(clock.resolveGrant.quotas.char_nyss, 2);
        const next = withConsumedGrant(clock, { isDM: false, characterId: "char_nyss" });
        assert.equal(next.resolveGrant.quotas.char_nyss, 1);
        assert.equal(clock.resolveGrant.quotas.char_nyss, 2);
    });
    it("visible without grant cannot resolve", () => {
        assert.equal(
            canAttemptResolve(table, { isDM: false, userId: "u1", characterId: "char_x" }),
            false,
        );
    });
    it("quota on a non-active character does not grant resolve", () => {
        const clock = {
            ...table,
            resolveGrant: { quotas: { char_nyss: 2 } },
        };
        assert.equal(canAttemptResolve(clock, {
            isDM: false,
            userId: "uid_nyss",
            characterId: "char_other",
            characterIds: ["char_nyss"],
        }), false);
        assert.equal(canAttemptResolve(clock, {
            isDM: false,
            userId: "uid_nyss",
            characterId: "char_nyss",
        }), true);
    });
    it("quota 0 / -1 / missing characterId consume is no-op", () => {
        const zero = { resolveGrant: { quotas: { char_nyss: 0 } } };
        consumeGrant(zero, { isDM: false, characterId: "char_nyss" });
        assert.equal(zero.resolveGrant.quotas.char_nyss, 0);

        const inf = { resolveGrant: { quotas: { char_nyss: -1 } } };
        consumeGrant(inf, { isDM: false, characterId: "char_nyss" });
        assert.equal(inf.resolveGrant.quotas.char_nyss, -1);
        const infNext = withConsumedGrant(inf, { isDM: false, characterId: "char_nyss" });
        assert.equal(infNext.resolveGrant.quotas.char_nyss, -1);

        const some = { resolveGrant: { quotas: { char_nyss: 3 } } };
        consumeGrant(some, { isDM: false });
        assert.equal(some.resolveGrant.quotas.char_nyss, 3);
        const noChar = withConsumedGrant(some, { isDM: false, characterId: null });
        assert.equal(noChar.resolveGrant.quotas.char_nyss, 3);
    });
});

describe("visibleUserIdsForRoll", () => {
    it("public → null, personal → [uid], dm_only → []", () => {
        assert.equal(visibleUserIdsForRoll(table, "u1"), null);
        assert.deepEqual(visibleUserIdsForRoll(assigned, "uid_nyss"), ["uid_nyss"]);
        assert.deepEqual(visibleUserIdsForRoll(assigned, null), []);
        assert.deepEqual(visibleUserIdsForRoll(secret, "u1"), []);
    });
});

describe("canViewClockChatMessage", () => {
    it("filters personal / dm_only without full clock", () => {
        const personal = { clockInstanceId: "c1", rollScope: "personal", senderId: "u1", visibleToUserIds: ["u1"] };
        assert.equal(canViewClockChatMessage(personal, { isDM: false, userId: "u1" }), true);
        assert.equal(canViewClockChatMessage(personal, { isDM: false, userId: "u2" }), false);
        assert.equal(canViewClockChatMessage({ clockInstanceId: "c1", rollScope: "dm_only" }, { isDM: false, userId: "u1" }), false);
        assert.equal(canViewClockChatMessage({ text: "hi" }, { isDM: false, userId: "u1" }), true);
    });
    it("non-empty visibleToUserIds is an allow-list", () => {
        const msg = { clockInstanceId: "c1", rollScope: "public", visibleToUserIds: ["u1"] };
        assert.equal(canViewClockChatMessage(msg, { isDM: false, userId: "u1" }), true);
        assert.equal(canViewClockChatMessage(msg, { isDM: false, userId: "u2" }), false);
        assert.equal(canViewClockChatMessage(msg, { isDM: true, userId: "dm" }), true);
    });
    it("empty visibleToUserIds does not deny; falls through to rollScope", () => {
        const dmOnly = { clockInstanceId: "c1", rollScope: "dm_only", visibleToUserIds: [] };
        assert.equal(canViewClockChatMessage(dmOnly, { isDM: false, userId: "u1" }), false);
        const pub = { clockInstanceId: "c1", rollScope: "public", visibleToUserIds: [] };
        assert.equal(canViewClockChatMessage(pub, { isDM: false, userId: "u2" }), true);
        const nullList = { clockInstanceId: "c1", rollScope: "public", visibleToUserIds: null };
        assert.equal(canViewClockChatMessage(nullList, { isDM: false, userId: "u2" }), true);
    });
    it("personal matches senderId when no allow-list", () => {
        const msg = { clockInstanceId: "c1", rollScope: "personal", senderId: "u1" };
        assert.equal(canViewClockChatMessage(msg, { isDM: false, userId: "u1" }), true);
        assert.equal(canViewClockChatMessage(msg, { isDM: false, userId: "u2" }), false);
        assert.equal(canViewClockChatMessage(msg, { isDM: true, userId: "dm" }), true);
    });
    it("plain chat without clockInstanceId or rollScope always passes", () => {
        assert.equal(canViewClockChatMessage({ text: "hi" }, { isDM: false, userId: "u1" }), true);
        assert.equal(canViewClockChatMessage({}, { isDM: false, userId: "u1" }), true);
    });
});

describe("B3 mesa matrix (secret / table / assigned)", () => {
    const CAELUM = "5CTYu1PQe3ybiZ5crVO7";
    const MIXI = "5lp35ryn4r7eentcKtEO";
    const pjA = { isDM: false, userId: "2aG1nkaDp9Yh5Ps45UsszIromLh1", characterId: CAELUM };
    const pjB = { isDM: false, userId: "R2pIyPsW7zLeWzYLJMfW76rYd3P2", characterId: MIXI };
    const dm = { isDM: true, userId: "ZmK4TxrcQFfGkMVmuJoJ8IHG7Bb2" };

    const qaSecret = {
        visibility: { clockScope: "dm_only", viewerUserIds: [], viewerCharacterIds: [], rollScope: "dm_only" },
        resolveGrant: { quotas: {} },
    };
    const qaTable = {
        visibility: { clockScope: "public", viewerUserIds: [], viewerCharacterIds: [], rollScope: "public" },
        resolveGrant: { quotas: { [CAELUM]: 1 } },
    };
    const qaAssigned = {
        visibility: {
            clockScope: "assigned",
            viewerUserIds: [],
            viewerCharacterIds: [CAELUM],
            rollScope: "personal",
        },
        resolveGrant: { quotas: { [CAELUM]: -1 } },
    };

    it("island visibility: secret DM-only, table both PJs, assigned only PJ A", () => {
        assert.equal(canViewClock(qaSecret, dm), true);
        assert.equal(canViewClock(qaSecret, pjA), false);
        assert.equal(canViewClock(qaSecret, pjB), false);

        assert.equal(canViewClock(qaTable, pjA), true);
        assert.equal(canViewClock(qaTable, pjB), true);

        assert.equal(canViewClock(qaAssigned, pjA), true);
        assert.equal(canViewClock(qaAssigned, pjB), false);
    });

    it("TIRAR: PJ A has grant, PJ B cannot resolve table or assigned", () => {
        assert.equal(canAttemptResolve(qaTable, pjA), true);
        assert.equal(canAttemptResolve(qaTable, pjB), false);
        assert.equal(canAttemptResolve(qaAssigned, pjA), true);
        assert.equal(canAttemptResolve(qaAssigned, pjB), false);
        assert.equal(canAttemptResolve(qaSecret, pjA), false);

        const after = withConsumedGrant(qaTable, pjA);
        assert.equal(after.resolveGrant.quotas[CAELUM], 0);
        assert.equal(canAttemptResolve(after, pjA), false);
        assert.equal(withConsumedGrant(qaAssigned, pjA).resolveGrant.quotas[CAELUM], -1);
    });

    it("chat: mesa public both see; assigned personal only roller; secret none", () => {
        const tableMsg = { clockInstanceId: "qa-table", rollScope: "public", visibleToUserIds: null, senderId: pjA.userId };
        const assignedMsg = {
            clockInstanceId: "qa-assigned",
            rollScope: "personal",
            visibleToUserIds: [pjA.userId],
            senderId: pjA.userId,
        };
        const secretMsg = { clockInstanceId: "qa-secret", rollScope: "dm_only", visibleToUserIds: [] };

        assert.equal(canViewClockChatMessage(tableMsg, pjA), true);
        assert.equal(canViewClockChatMessage(tableMsg, pjB), true);
        assert.equal(canViewClockChatMessage(assignedMsg, pjA), true);
        assert.equal(canViewClockChatMessage(assignedMsg, pjB), false);
        assert.equal(canViewClockChatMessage(secretMsg, pjA), false);
        assert.equal(canViewClockChatMessage(secretMsg, pjB), false);
        assert.equal(canViewClockChatMessage(secretMsg, dm), true);
    });
});
