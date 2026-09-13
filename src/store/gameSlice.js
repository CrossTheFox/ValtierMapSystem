import { createSlice } from "@reduxjs/toolkit";

/**
 * The session doc is a single document: any write (a token move, a ping) re-emits
 * every field with fresh object identities. Comparing before assigning keeps the
 * previous reference so unrelated subscribers do not re-render.
 */
function samePlain(a, b) {
    if (a === b) return true;
    if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
    if (a instanceof Date || b instanceof Date) return Number(a) === Number(b);
    if (typeof a.toMillis === "function" && typeof b.toMillis === "function") {
        return a.toMillis() === b.toMillis();
    }
    const aArr = Array.isArray(a);
    if (aArr !== Array.isArray(b)) return false;
    if (aArr) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i += 1) if (!samePlain(a[i], b[i])) return false;
        return true;
    }
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;
    for (const k of keys) {
        if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
        if (!samePlain(a[k], b[k])) return false;
    }
    return true;
}

function assignMap(state, key, value) {
    const next = value ?? {};
    if (!samePlain(state[key], next)) state[key] = next;
}

const gameSlice = createSlice({
    name: "game",
    initialState: {
        partyPositions: {},
        tokenPositions: {},
        activeMapId: null,
        /** Shared map rulers: id → ruler */
        rulers: {},
        /** Shared map drawings: id → drawing */
        drawings: {},
        /** Shared map pings: id → ping (short-lived) */
        pings: {},
        /** Shared session pools: characterId → { hp, effort, ..., updatedAt } */
        sessionPools: {},
        /** Shared initiative tracker (DM writes). */
        initiative: {
            open: false,
            started: false,
            entries: [],
            activeIndex: 0,
            round: 1,
        },
        /** Session clocks (DM writes; clients filter via canViewClock). */
        clocks: [],
        clockHistory: [],
        sessionClocks: { open: true },
        /** DM broadcast: full-screen character banner reveal. */
        characterSpotlight: null,
    },
    reducers: {
        setPartyPositions(state, action) {
            assignMap(state, "partyPositions", action.payload);
        },
        setTokenPositions(state, action) {
            assignMap(state, "tokenPositions", action.payload);
        },
        setActiveMapId(state, action) {
            state.activeMapId = action.payload ?? null;
        },
        setGameSession(state, action) {
            const data = action.payload ?? {};
            if (data.partyPositions) assignMap(state, "partyPositions", data.partyPositions);
            if (data.tokenPositions) assignMap(state, "tokenPositions", data.tokenPositions);
            if (data.activeMapId !== undefined) state.activeMapId = data.activeMapId;
            if ("rulers" in data) assignMap(state, "rulers", data.rulers);
            if ("drawings" in data) assignMap(state, "drawings", data.drawings);
            if ("pings" in data) assignMap(state, "pings", data.pings);
            if ("sessionPools" in data) assignMap(state, "sessionPools", data.sessionPools);
            if ("initiative" in data) {
                const next = data.initiative ?? {
                    open: false,
                    started: false,
                    entries: [],
                    activeIndex: 0,
                    round: 1,
                };
                if (!samePlain(state.initiative, next)) state.initiative = next;
            }
            if ("clocks" in data) {
                const next = Array.isArray(data.clocks) ? data.clocks : [];
                if (!samePlain(state.clocks, next)) state.clocks = next;
            }
            if ("clockHistory" in data) {
                const next = Array.isArray(data.clockHistory) ? data.clockHistory : [];
                if (!samePlain(state.clockHistory, next)) state.clockHistory = next;
            }
            if ("sessionClocks" in data) {
                const next = data.sessionClocks && typeof data.sessionClocks === "object"
                    ? { open: data.sessionClocks.open !== false }
                    : { open: true };
                if (!samePlain(state.sessionClocks, next)) state.sessionClocks = next;
            }
            if ("characterSpotlight" in data) {
                const next = data.characterSpotlight ?? null;
                if (!samePlain(state.characterSpotlight, next)) {
                    state.characterSpotlight = next;
                }
            }
        },
        setRulers(state, action) {
            assignMap(state, "rulers", action.payload);
        },
        setDrawings(state, action) {
            assignMap(state, "drawings", action.payload);
        },
        setPings(state, action) {
            assignMap(state, "pings", action.payload);
        },
        setSessionPools(state, action) {
            assignMap(state, "sessionPools", action.payload);
        },
        setInitiative(state, action) {
            const next = action.payload ?? {
                open: false,
                started: false,
                entries: [],
                activeIndex: 0,
                round: 1,
            };
            if (!samePlain(state.initiative, next)) state.initiative = next;
        },
        setSessionClocks(state, action) {
            const next = Array.isArray(action.payload) ? action.payload : [];
            if (!samePlain(state.clocks, next)) state.clocks = next;
        },
        setClockHistory(state, action) {
            const next = Array.isArray(action.payload) ? action.payload : [];
            if (!samePlain(state.clockHistory, next)) state.clockHistory = next;
        },
        setSessionClocksOpen(state, action) {
            const next = { open: action.payload !== false };
            if (!samePlain(state.sessionClocks, next)) state.sessionClocks = next;
        },
    },
});

export const {
    setPartyPositions,
    setTokenPositions,
    setActiveMapId,
    setGameSession,
    setRulers,
    setDrawings,
    setPings,
    setSessionPools,
    setInitiative,
    setSessionClocks,
    setClockHistory,
    setSessionClocksOpen,
} = gameSlice.actions;
export default gameSlice.reducer;
