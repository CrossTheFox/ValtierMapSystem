import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { getCharactersByIds, getCharactersByPlayer } from "../../firebase/services/characterService";
import { normalizeCharacterDoc } from "../utils/normalizeCharacter";

/**
 * Load characters for the signed-in player.
 * Primary source: Firestore `characters` where `ownerPlayerId` == uid.
 * Legacy: if `characterIds` is passed, any IDs not returned by the owner query
 * are still fetched (GM may not have set owner yet).
 *
 * @param {{ uid: string, characterIds?: string[] } | string} arg
 */
export const fetchPlayerCharacters = createAsyncThunk(
    "characters/fetchPlayer",
    async (arg) => {
        const uid = typeof arg === "string" ? arg : arg?.uid;
        const characterIds = Array.isArray(arg) ? arg : arg?.characterIds;

        let list = [];
        if (uid) {
            list = await getCharactersByPlayer(uid);
        }
        if (characterIds?.length) {
            const have = new Set(list.map((c) => c.id));
            const missing = characterIds.filter((id) => id && !have.has(id));
            if (missing.length) {
                const extra = await getCharactersByIds(missing);
                list = [...list, ...extra];
            }
        } else if (!uid && characterIds?.length) {
            list = await getCharactersByIds(characterIds);
        }
        return list.map((c) => normalizeCharacterDoc(c));
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