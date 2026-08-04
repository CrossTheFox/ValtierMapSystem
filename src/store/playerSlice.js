import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { db } from "../../firebase/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { setPlayerActiveCharacter } from "../../firebase/services/characterService";

export const fetchPlayerData = createAsyncThunk(
    "player/fetchData",
    async (uid) => {
        const playerDoc = await getDoc(doc(db, "players", uid));
        if (!playerDoc.exists()) throw new Error("Player data not found");
        
        const data = playerDoc.data();
        
        return {
            uid,
            nickname: data.nickname,
            role: data.role,
            campaignIds: data.campaignIds || [], 
            currentCampaignId: data.campaignIds?.[0] || null,
            characterIds: data.characterIds || [],
            activeCharacterId: data.activeCharacterId || null,
        };
    }
);

export const persistActiveCharacter = createAsyncThunk(
    "player/persistActiveCharacter",
    async ({ uid, characterId }) => {
        await setPlayerActiveCharacter(uid, characterId);
        return characterId;
    }
);

const playerSlice = createSlice({
    name: "player",
    initialState: {
        profile: null,
        status: "idle",
        error: null,
    },
    reducers: {
        clearPlayer: (state) => {
            state.profile = null;
            state.status = "idle";
        },
        setActiveCharacterId: (state, action) => {
            if (state.profile) {
                state.profile.activeCharacterId = action.payload;
            }
        },
        /** Merge live Firestore player-doc fields into the session profile. */
        patchPlayerProfile: (state, action) => {
            if (!state.profile) return;
            state.profile = { ...state.profile, ...action.payload };
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchPlayerData.pending, (state) => {
                state.status = "loading";
            })
            .addCase(fetchPlayerData.fulfilled, (state, action) => {
                state.status = "succeeded";
                state.profile = action.payload;
            })
            .addCase(fetchPlayerData.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.error.message;
            });
    },
});

export const { clearPlayer, setActiveCharacterId, patchPlayerProfile } = playerSlice.actions;
export default playerSlice.reducer;
