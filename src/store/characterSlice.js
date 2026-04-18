import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { getCharactersByIds } from "../../firebase/services/characterService";

export const fetchPlayerCharacters = createAsyncThunk(
    "characters/fetchPlayer",
    async (characterIds) => {
        return await getCharactersByIds(characterIds);
    }
);

const characterSlice = createSlice({
    name: "characters",
    initialState: {
        list: [],
        status: "idle",
        error: null
    },
    reducers: {
        updateCharacterInList: (state, action) => {
            const index = state.list.findIndex(c => c.id === action.payload.id);
            if (index !== -1) state.list[index] = { ...state.list[index], ...action.payload.data };
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchPlayerCharacters.pending, (state) => { state.status = "loading"; })
            .addCase(fetchPlayerCharacters.fulfilled, (state, action) => {
                state.status = "succeeded";
                state.list = action.payload;
            })
            .addCase(fetchPlayerCharacters.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.error.message;
            });
    }
});

export const { 
    updateCharacterInList
} = characterSlice.actions;
export default characterSlice.reducer;