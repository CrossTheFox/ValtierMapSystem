import { createSlice } from "@reduxjs/toolkit";

const gameSlice = createSlice({
    name: "game",
    initialState: {
        partyPositions: {},
        tokenPositions: {},
        activeMapId: null,
    },
    reducers: {
        setPartyPositions(state, action) {
            state.partyPositions = action.payload ?? {};
        },
        setTokenPositions(state, action) {
            state.tokenPositions = action.payload ?? {};
        },
        setActiveMapId(state, action) {
            state.activeMapId = action.payload ?? null;
        },
        setGameSession(state, action) {
            const data = action.payload ?? {};
            if (data.partyPositions) state.partyPositions = data.partyPositions;
            if (data.tokenPositions) state.tokenPositions = data.tokenPositions;
            if (data.activeMapId !== undefined) state.activeMapId = data.activeMapId;
        },
    },
});

export const {
    setPartyPositions,
    setTokenPositions,
    setActiveMapId,
    setGameSession,
} = gameSlice.actions;
export default gameSlice.reducer;
