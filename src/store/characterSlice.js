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
            const { id, data } = action.payload || {};
            if (!id || !data) return;
            const index = state.list.findIndex((c) => c.id === id);
            if (index !== -1) {
                const prev = state.list[index];
                const next = {
                    ...prev,
                    ...data,
                };
                if (data.stats) {
                    next.stats = { ...(prev.stats || {}), ...data.stats };
                } else {
                    next.stats = prev.stats;
                }
                if (data.bond) {
                    // Merge bond fields; don't let accidental empty strings wipe richer prev values
                    // unless the patch explicitly includes that key (user cleared it).
                    const merged = { ...(prev.bond || {}), ...data.bond };
                    next.bond = merged;
                } else {
                    next.bond = prev.bond;
                }
                state.list[index] = next;
            } else {
                // Never seed the list with a partial media/burdens-only stub — it would
                // overwrite richer world data when the sheet merges list+world.
                if (data.stats || data.bond || data.name || data.bondPowers) {
                    state.list.push({ id, ...data });
                }
            }
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