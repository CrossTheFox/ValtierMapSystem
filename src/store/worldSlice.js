import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

// 🔹 Async thunk para cargar el JSON del mundo
export const loadWorld = createAsyncThunk(
    "world/load",
    async (url) => {
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error("Failed to load world data");
        }
        return await res.json();
    }
);

const worldSlice = createSlice({
    name: "world",
    initialState: {
        map: null,
        locations: {},
        npcs: {},
        players: {},
        status: "idle",
        error: null,
    },
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(loadWorld.pending, (state) => {
                state.status = "loading";
            })
            .addCase(loadWorld.fulfilled, (state, action) => {
                state.status = "succeeded";
                state.map = action.payload.map;
                state.locations = action.payload.locations ?? {};
                state.npcs = action.payload.npcs ?? {};
                state.players = action.payload.players ?? {};
            })
            .addCase(loadWorld.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.error.message;
                console.error("Error loading world data:", action.error.message);
            });
    },
});

export default worldSlice.reducer;
