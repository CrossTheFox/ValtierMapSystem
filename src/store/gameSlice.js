import { createSlice } from "@reduxjs/toolkit";

const gameSlice = createSlice({
    name: "game",
    initialState: {
        // { [mapId]: { x, y } } — one position per map, per campaign
        partyPositions: {},
        // { trackPath, trackName, status, startedAt, pausedAt } | null
        music: null,
    },
    reducers: {
        setPartyPositions(state, action) {
            state.partyPositions = action.payload;
        },
        setMusic(state, action) {
            state.music = action.payload;
        },
    },
});

export const { setPartyPositions, setMusic } = gameSlice.actions;
export default gameSlice.reducer;
