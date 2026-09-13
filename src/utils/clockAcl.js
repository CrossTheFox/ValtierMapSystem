/**
 * Clock ACL — three independent axes: clockScope, rollScope, resolveGrant.quotas.
 * Pure (no Firebase / React). DM always bypasses.
 */

export function quotaOf(clock, characterId) {
    if (!characterId) return 0;
    const q = clock?.resolveGrant?.quotas?.[characterId];
    return q == null ? 0 : Number(q);
}

/**
 * @param {object} clock
 * @param {{ isDM?: boolean, userId?: string|null, characterId?: string|null, characterIds?: string[] }} viewer
 */
export function canViewClock(clock, viewer) {
    if (!clock) return false;
    if (viewer?.isDM) return true;
    const vis = clock.visibility || {};
    const clockScope = vis.clockScope || "dm_only";
    if (clockScope === "public") return true;
    if (clockScope === "dm_only") return false;
    if (clockScope === "assigned") {
        const userIds = Array.isArray(vis.viewerUserIds) ? vis.viewerUserIds : [];
        const charIds = Array.isArray(vis.viewerCharacterIds) ? vis.viewerCharacterIds : [];
        if (viewer?.userId && userIds.includes(viewer.userId)) return true;
        if (viewer?.characterId && charIds.includes(viewer.characterId)) return true;
        const extras = Array.isArray(viewer?.characterIds) ? viewer.characterIds : [];
        return extras.some((id) => charIds.includes(id));
    }
    return false;
}

/**
 * @param {{ rollScope?: string, actorUserId?: string, senderId?: string }} event
 * @param {object} clock
 * @param {{ isDM?: boolean, userId?: string|null, characterId?: string|null }} viewer
 */
export function canViewRoll(event, clock, viewer) {
    if (viewer?.isDM) return true;
    if (clock && !canViewClock(clock, viewer)) return false;
    const scope = event?.rollScope ?? clock?.visibility?.rollScope ?? "public";
    if (scope === "public") return true;
    if (scope === "personal") {
        const actor = event?.actorUserId ?? event?.senderId;
        return Boolean(actor && actor === viewer?.userId);
    }
    if (scope === "dm_only") return false;
    return false;
}

/**
 * Chat-row filter when the full clock may not be in memory.
 * @param {{ rollScope?: string, visibleToUserIds?: string[], senderId?: string, clockInstanceId?: string }} msg
 * @param {{ isDM?: boolean, userId?: string|null }} viewer
 */
export function canViewClockChatMessage(msg, viewer) {
    if (viewer?.isDM) return true;
    if (!msg?.clockInstanceId && !msg?.rollScope) return true;
    const allow = msg.visibleToUserIds;
    if (Array.isArray(allow) && allow.length > 0) {
        return Boolean(viewer?.userId && allow.includes(viewer.userId));
    }
    if (msg.rollScope === "dm_only") return false;
    if (msg.rollScope === "personal") {
        return Boolean(msg.senderId && msg.senderId === viewer?.userId);
    }
    return true;
}

export function canAttemptResolve(clock, viewer) {
    if (viewer?.isDM) return true;
    if (!canViewClock(clock, viewer)) return false;
    const q = quotaOf(clock, viewer?.characterId);
    return q === -1 || q > 0;
}

/** Mutates quotas (spec §5.5). Prefer `withConsumedGrant` in React. */
export function consumeGrant(clock, viewer) {
    if (!clock || viewer?.isDM) return;
    const id = viewer?.characterId;
    const q = quotaOf(clock, id);
    if (q === -1 || q <= 0 || !id) return;
    if (!clock.resolveGrant) clock.resolveGrant = { quotas: {} };
    if (!clock.resolveGrant.quotas) clock.resolveGrant.quotas = {};
    clock.resolveGrant.quotas[id] = q - 1;
}

export function withConsumedGrant(clock, viewer) {
    if (!clock || viewer?.isDM) return clock;
    const id = viewer?.characterId;
    const q = quotaOf(clock, id);
    if (q === -1 || q <= 0 || !id) return clock;
    return {
        ...clock,
        resolveGrant: {
            ...(clock.resolveGrant || {}),
            quotas: {
                ...((clock.resolveGrant && clock.resolveGrant.quotas) || {}),
                [id]: q - 1,
            },
        },
    };
}

/**
 * Build visibleToUserIds for a chat/event row.
 * DM uid is not required — DMs always pass canViewRoll.
 */
export function visibleUserIdsForRoll(clock, actorUserId) {
    const scope = clock?.visibility?.rollScope || "public";
    if (scope === "dm_only") return [];
    if (scope === "personal") return actorUserId ? [actorUserId] : [];
    return null;
}
