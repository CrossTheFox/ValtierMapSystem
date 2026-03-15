import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { db } from "../../firebase/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

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
            // Extraemos el array y definimos la campaña activa (la primera por defecto)
            campaignIds: data.campaignIds || [], 
            currentCampaignId: data.campaignIds?.[0] || null 
        };
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
        }
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

export const { clearPlayer } = playerSlice.actions;
export default playerSlice.reducer;