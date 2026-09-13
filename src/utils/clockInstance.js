/**
 * ClockInstance normalizers + session defaults.
 * Size theme maps to UI_COLORS roles (boon / anomaly / loot / danger).
 */

import { UI_COLORS } from "../constants/uiColors.js";
import { jumpToHalfSteps, sizeHalfSteps } from "./clockResolver.js";

export const CLOCK_SIZES = Object.freeze([4, 6, 8, 12]);

export const CLOCK_SCOPES = Object.freeze({
    DM_ONLY: "dm_only",
    PUBLIC: "public",
    ASSIGNED: "assigned",
});

export const CLOCK_RESOLVE_MODES = Object.freeze({
    GENERIC: "generic",
    ACTIONS: "actions",
});

export const CLOCK_OWNER_TYPES = Object.freeze({
    BURDEN: "burden",
    MISSION: "mission",
    SESSION: "session",
    CHARACTER: "character",
});

export const CLOCK_HISTORY_CAP = 50;

/** Difficulty color + labels — mockup size-4/6/8/12. */
export const CLOCK_SIZE_THEME = Object.freeze({
    4: {
        hex: UI_COLORS.boon,
        fill: "rgba(61, 214, 140, 0.72)",
        stroke: UI_COLORS.boon,
        off: "rgba(61, 214, 140, 0.35)",
        label: "fácil",
    },
    6: {
        hex: UI_COLORS.anomaly,
        fill: "rgba(0, 242, 234, 0.72)",
        stroke: UI_COLORS.anomaly,
        off: "rgba(0, 242, 234, 0.35)",
        label: "estándar",
    },
    8: {
        hex: UI_COLORS.loot,
        fill: "rgba(245, 197, 66, 0.72)",
        stroke: UI_COLORS.loot,
        off: "rgba(245, 197, 66, 0.35)",
        label: "difícil",
    },
    12: {
        hex: UI_COLORS.danger,
        fill: "rgba(255, 51, 85, 0.72)",
        stroke: UI_COLORS.danger,
        off: "rgba(255, 51, 85, 0.35)",
        label: "extremo",
    },
});

export function normalizeClockSize(raw) {
    const n = Number(raw);
    if (n === 6 || n === 8 || n === 12) return n;
    return 4;
}

export function sizeTheme(sizeTicks) {
    return CLOCK_SIZE_THEME[normalizeClockSize(sizeTicks)] || CLOCK_SIZE_THEME[4];
}

export function clockScopeFromUi(uiScope) {
    const s = String(uiScope || "").toLowerCase();
    if (s === "public" || s === "mesa") return CLOCK_SCOPES.PUBLIC;
    if (s === "assigned" || s === "personajes" || s === "pjs") return CLOCK_SCOPES.ASSIGNED;
    return CLOCK_SCOPES.DM_ONLY;
}

function newClockId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return `clock_${crypto.randomUUID()}`;
    }
    return `clock_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeQuotas(raw) {
    if (!raw || typeof raw !== "object") return {};
    const out = {};
    for (const [id, val] of Object.entries(raw)) {
        if (!id) continue;
        const n = Number(val);
        if (n === -1) out[id] = -1;
        else if (Number.isFinite(n) && n > 0) out[id] = Math.floor(n);
    }
    return out;
}

function sanitizeStringList(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.filter((x) => typeof x === "string" && x);
}

/**
 * @param {unknown} raw
 * @returns {object|null}
 */
export function normalizeClockInstance(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = typeof raw.id === "string" && raw.id ? raw.id : newClockId();
    const sizeTicks = normalizeClockSize(raw.sizeTicks ?? raw.clockSize);
    const cap = sizeHalfSteps(sizeTicks);

    let filledHalfSteps;
    if (Number.isFinite(Number(raw.filledHalfSteps))) {
        filledHalfSteps = jumpToHalfSteps(raw.filledHalfSteps, sizeTicks);
    } else if (Number.isFinite(Number(raw.clockFilled))) {
        filledHalfSteps = jumpToHalfSteps(Math.round(Number(raw.clockFilled) * 2), sizeTicks);
    } else {
        filledHalfSteps = 0;
    }
    filledHalfSteps = Math.max(0, Math.min(cap, filledHalfSteps));

    const clockScope = [CLOCK_SCOPES.PUBLIC, CLOCK_SCOPES.ASSIGNED, CLOCK_SCOPES.DM_ONLY]
        .includes(raw.visibility?.clockScope)
        ? raw.visibility.clockScope
        : CLOCK_SCOPES.DM_ONLY;
    const rollScopeRaw = raw.visibility?.rollScope;
    const rollScope = ["public", "personal", "dm_only"].includes(rollScopeRaw)
        ? rollScopeRaw
        : (clockScope === CLOCK_SCOPES.DM_ONLY ? "dm_only" : "public");

    const resolveMode = raw.resolveMode === CLOCK_RESOLVE_MODES.ACTIONS
        ? CLOCK_RESOLVE_MODES.ACTIONS
        : CLOCK_RESOLVE_MODES.GENERIC;
    const diceCountRaw = Math.floor(Number(raw.diceCount) || 2);
    const diceCount = Math.max(1, Math.min(6, diceCountRaw));

    const ownerType = Object.values(CLOCK_OWNER_TYPES).includes(raw.ownerType)
        ? raw.ownerType
        : CLOCK_OWNER_TYPES.SESSION;

    return {
        id,
        definitionId: typeof raw.definitionId === "string" ? raw.definitionId : null,
        name: typeof raw.name === "string"
            ? raw.name
            : (typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : "Clock"),
        sizeTicks,
        sizeHalfSteps: cap,
        filledHalfSteps,
        ownerType,
        ownerId: typeof raw.ownerId === "string" ? raw.ownerId : null,
        characterId: typeof raw.characterId === "string" ? raw.characterId : null,
        campaignId: typeof raw.campaignId === "string" ? raw.campaignId : null,
        visibility: {
            clockScope,
            viewerUserIds: sanitizeStringList(raw.visibility?.viewerUserIds),
            viewerCharacterIds: clockScope === CLOCK_SCOPES.ASSIGNED
                ? sanitizeStringList(raw.visibility?.viewerCharacterIds)
                : [],
            rollScope,
        },
        resolveMode,
        diceCount,
        actionIds: resolveMode === CLOCK_RESOLVE_MODES.ACTIONS
            ? sanitizeStringList(raw.actionIds)
            : [],
        resolveGrant: {
            quotas: sanitizeQuotas(raw.resolveGrant?.quotas),
        },
        advancePolicy: {
            allowedMethods: sanitizeStringList(raw.advancePolicy?.allowedMethods).length
                ? sanitizeStringList(raw.advancePolicy.allowedMethods)
                : ["action", "dice", "manual"],
            manualAdvanceRoles: ["dm"],
        },
        onCompleteText: typeof raw.onCompleteText === "string" ? raw.onCompleteText : "",
        updatedAt: raw.updatedAt ?? null,
    };
}

export function emptySessionClock(partial = {}) {
    return normalizeClockInstance({
        id: newClockId(),
        name: "Clock",
        sizeTicks: 4,
        filledHalfSteps: 0,
        ownerType: CLOCK_OWNER_TYPES.SESSION,
        visibility: {
            clockScope: CLOCK_SCOPES.DM_ONLY,
            viewerCharacterIds: [],
            viewerUserIds: [],
            rollScope: "dm_only",
        },
        resolveMode: CLOCK_RESOLVE_MODES.GENERIC,
        diceCount: 2,
        actionIds: [],
        resolveGrant: { quotas: {} },
        ...partial,
    });
}

/**
 * @param {unknown} raw
 * @returns {object[]}
 */
export function normalizeClockList(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map(normalizeClockInstance).filter(Boolean);
}

export function normalizeSessionClocksOpen(raw) {
    if (raw && typeof raw === "object" && "open" in raw) return raw.open !== false;
    return true;
}

export function normalizeClockHistoryEntry(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = typeof raw.id === "string" && raw.id ? raw.id : `h_${Date.now()}`;
    return {
        id,
        name: typeof raw.name === "string" ? raw.name : "Clock",
        result: typeof raw.result === "string" ? raw.result : "Archivado",
        progress: typeof raw.progress === "string" ? raw.progress : "",
        method: typeof raw.method === "string" ? raw.method : "",
        when: typeof raw.when === "string" ? raw.when : "",
        detail: typeof raw.detail === "string" ? raw.detail : "",
        timestamp: Number.isFinite(Number(raw.timestamp)) ? Number(raw.timestamp) : Date.now(),
        clockInstanceId: typeof raw.clockInstanceId === "string" ? raw.clockInstanceId : null,
    };
}

export function normalizeClockHistory(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map(normalizeClockHistoryEntry).filter(Boolean).slice(0, CLOCK_HISTORY_CAP);
}

export function prependClockHistory(history, entry) {
    const next = [normalizeClockHistoryEntry(entry), ...normalizeClockHistory(history)]
        .filter(Boolean);
    return next.slice(0, CLOCK_HISTORY_CAP);
}

export function cycleClockSize(current) {
    const i = CLOCK_SIZES.indexOf(normalizeClockSize(current));
    return CLOCK_SIZES[(i + 1) % CLOCK_SIZES.length];
}

/**
 * Half-steps from legacy integer `clockFilled` (or already-half field).
 */
export function halfStepsFromLegacyFilled(clockFilled, clockSize, filledHalfSteps) {
    const size = normalizeClockSize(clockSize);
    if (Number.isFinite(Number(filledHalfSteps))) {
        return jumpToHalfSteps(filledHalfSteps, size);
    }
    const ticks = Number(clockFilled);
    if (!Number.isFinite(ticks)) return 0;
    return jumpToHalfSteps(Math.round(ticks * 2), size);
}
