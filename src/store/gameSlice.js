import { createSlice } from "@reduxjs/toolkit";

const gameSlice = createSlice({
    name: "game",
    initialState: {
        // { [mapId]: { x, y } } — one position per map, per campaign
        partyPositions: {},
    },
    reducers: {
        setPartyPositions(state, action) {
            state.partyPositions = action.payload;
        },
    },
});

export const { setPartyPositions } = gameSlice.actions;
export default gameSlice.reducer;
