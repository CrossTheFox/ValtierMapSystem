/**
 * Campaign missions (generic + personal) — progress clock as segmented bar.
 * Storage: campaigns/{campaignId}/missions/{missionId}
 */

export const MISSION_CLOCK_SIZES = [4, 6, 8, 12];

export const MISSION_SCOPE = {
    GENERIC: "generic",
    PERSONAL: "personal",
};

export const MISSION_STATUS = {
    ACTIVE: "active",
    COMPLETED: "completed",
    FAILED: "failed",
    HIDDEN: "hidden",
};

export const MISSION_STATUS_LABELS = {
    [MISSION_STATUS.ACTIVE]: "ACTIVE",
    [MISSION_STATUS.COMPLETED]: "COMPLETED",
    [MISSION_STATUS.FAILED]: "FAILED",
    [MISSION_STATUS.HIDDEN]: "HIDDEN",
};

function newId() {
    return typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * @param {unknown} raw
 * @returns {4|6|8|12}
 */
export function normalizeClockSize(raw) {
    const n = Number(raw);
    if (n === 6 || n === 8 || n === 12) return n;
    return 4;
}

/**
 * @param {unknown} raw
 * @param {number} clockSize
 */
export function clampClockFilled(raw, clockSize) {
    const size = normalizeClockSize(clockSize);
    const n = Number(raw);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(size, Math.floor(n)));
}

/**
 * @param {unknown} raw
 */
export function normalizeMissionObjective(raw) {
    if (!raw || typeof raw !== "object") {
        return { id: newId(), text: "", weight: 1, done: false };
    }
    const weightRaw = Number(raw.weight);
    const weight = Number.isFinite(weightRaw) && weightRaw > 0
        ? Math.min(12, Math.floor(weightRaw))
        : 1;
    return {
        id: typeof raw.id === "string" && raw.id ? raw.id : newId(),
        text: typeof raw.text === "string" ? raw.text : "",
        weight,
        done: Boolean(raw.done),
    };
}

/**
 * @param {unknown} raw
 * @returns {object|null}
 */
export function normalizeMission(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = typeof raw.id === "string" && raw.id ? raw.id : null;
    if (!id) return null;

    const scope = raw.scope === MISSION_SCOPE.PERSONAL
        ? MISSION_SCOPE.PERSONAL
        : MISSION_SCOPE.GENERIC;
    const status = Object.values(MISSION_STATUS).includes(raw.status)
        ? raw.status
        : MISSION_STATUS.ACTIVE;
    const clockSize = normalizeClockSize(raw.clockSize);
    const assignees = Array.isArray(raw.assigneeCharacterIds)
        ? raw.assigneeCharacterIds.filter((x) => typeof x === "string" && x)
        : [];
    const objectives = Array.isArray(raw.objectives)
        ? raw.objectives.map(normalizeMissionObjective)
        : [];

    return {
        id,
        campaignId: typeof raw.campaignId === "string" ? raw.campaignId : null,
        title: typeof raw.title === "string" ? raw.title : "Sin título",
        scope,
        assigneeCharacterIds: scope === MISSION_SCOPE.PERSONAL ? assignees : [],
        clockSize,
        clockFilled: clampClockFilled(raw.clockFilled, clockSize),
        objectives,
        reward: typeof raw.reward === "string" ? raw.reward : "",
        grantedBy: typeof raw.grantedBy === "string" ? raw.grantedBy : "",
        status,
        summary: typeof raw.summary === "string" ? raw.summary : "",
        createdAt: raw.createdAt ?? null,
        updatedAt: raw.updatedAt ?? null,
        createdBy: raw.createdBy ?? null,
    };
}

/**
 * @param {Partial<object>} [partial]
 */
export function emptyMission(partial = {}) {
    const clockSize = normalizeClockSize(partial.clockSize);
    return normalizeMission({
        id: newId(),
        title: "Nueva misión",
        scope: MISSION_SCOPE.GENERIC,
        assigneeCharacterIds: [],
        clockSize,
        clockFilled: 0,
        objectives: [{ id: newId(), text: "", weight: 1, done: false }],
        reward: "",
        grantedBy: "",
        status: MISSION_STATUS.ACTIVE,
        summary: "",
        ...partial,
    });
}

/**
 * @param {object} mission
 * @returns {number} 0..100
 */
export function missionProgressPercent(mission) {
    const size = normalizeClockSize(mission?.clockSize);
    if (!size) return 0;
    const filled = clampClockFilled(mission?.clockFilled, size);
    return Math.round((filled / size) * 100);
}

/**
 * Toggle objective done and adjust clockFilled by weight.
 * Auto-completes status when clock fills (unless already failed/hidden).
 * @param {object} mission
 * @param {string} objectiveId
 * @param {boolean} done
 */
export function withObjectiveDone(mission, objectiveId, done) {
    const m = normalizeMission(mission);
    if (!m) return mission;

    let delta = 0;
    const objectives = m.objectives.map((o) => {
        if (o.id !== objectiveId) return o;
        if (Boolean(o.done) === Boolean(done)) return o;
        delta = done ? o.weight : -o.weight;
        return { ...o, done: Boolean(done) };
    });

    let clockFilled = clampClockFilled(m.clockFilled + delta, m.clockSize);
    let status = m.status;
    if (clockFilled >= m.clockSize && status === MISSION_STATUS.ACTIVE) {
        status = MISSION_STATUS.COMPLETED;
    } else if (
        status === MISSION_STATUS.COMPLETED
        && clockFilled < m.clockSize
    ) {
        status = MISSION_STATUS.ACTIVE;
    }

    return { ...m, objectives, clockFilled, status };
}

/**
 * @param {object} mission
 * @param {number} clockFilled
 */
export function withClockFilled(mission, clockFilled) {
    const m = normalizeMission(mission);
    if (!m) return mission;
    const next = clampClockFilled(clockFilled, m.clockSize);
    let status = m.status;
    if (next >= m.clockSize && status === MISSION_STATUS.ACTIVE) {
        status = MISSION_STATUS.COMPLETED;
    } else if (status === MISSION_STATUS.COMPLETED && next < m.clockSize) {
        status = MISSION_STATUS.ACTIVE;
    }
    return { ...m, clockFilled: next, status };
}

/**
 * Missions visible for a dossier character (player view).
 * DM sees all when `includeHidden` is true.
 * @param {object[]} missions
 * @param {string|null} characterId
 * @param {{ isDM?: boolean }} [opts]
 */
export function filterMissionsForCharacter(missions, characterId, opts = {}) {
    const isDM = Boolean(opts.isDM);
    const list = (Array.isArray(missions) ? missions : [])
        .map(normalizeMission)
        .filter(Boolean);

    return list.filter((m) => {
        if (!isDM && m.status === MISSION_STATUS.HIDDEN) return false;
        if (m.scope === MISSION_SCOPE.GENERIC) return true;
        if (!characterId) return isDM;
        return m.assigneeCharacterIds.includes(characterId);
    }).sort((a, b) => {
        const rank = (s) => (s === MISSION_STATUS.ACTIVE ? 0
            : s === MISSION_STATUS.COMPLETED ? 1
                : s === MISSION_STATUS.FAILED ? 2 : 3);
        return rank(a.status) - rank(b.status)
            || a.title.localeCompare(b.title, "es");
    });
}
