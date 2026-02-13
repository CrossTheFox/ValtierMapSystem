import { createSlice } from "@reduxjs/toolkit";

const uiSlice = createSlice({
    name: "ui",
    initialState: {
        selectedLocation: null,
    },
    reducers: {
        openLocation(state, action) {
            state.selectedLocation = action.payload;
        },
        closeLocation(state) {
            state.selectedLocation = null;
        },
    },
});

export const { openLocation, closeLocation } = uiSlice.actions;
export default uiSlice.reducer;