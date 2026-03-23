import { createSlice } from "@reduxjs/toolkit";

const uiSlice = createSlice({
    name: "ui",
    initialState: {
        selectedLocation: null,
        selectedLore: null,
        isSelectingPosition: false,
        isMinimized: false,
        selectedWorldPosition: null,
        snackbar: {
            open: false,
            message: "",
            severity: "info",
            action: null,
        },
    },
    reducers: {
        openLocation(state, action) {
            state.selectedLocation = action.payload;
        },
        closeLocation(state) {
            state.selectedLocation = null;
        },
        setIsSelectingPosition(state, action) {
            state.isSelectingPosition = action.payload;
        },
        toggleIsSelectingPosition(state) {
            state.isSelectingPosition = !state.isSelectingPosition;
        },
        setIsMinimized(state, action) {
            state.isMinimized = action.payload;
        },
        toggleIsMinimized(state) {
            state.isMinimized = !state.isMinimized;
        },
        setSelectedWorldPosition(state, action) {
            state.selectedWorldPosition = action.payload;
        },
        showSnackbar(state, action) {
            state.snackbar = {
                open: true,
                message: action.payload.message || "SYSTEM_NOTIFICATION",
                severity: action.payload.severity || "info",
                action: action.payload.action || null
            };
        },
        hideSnackbar(state) {
            state.snackbar.open = false;
        },
        setSelectedLore(state, action) {
            state.selectedLore = action.payload;
        }
    },
});

export const { 
    openLocation, 
    closeLocation, 
    setIsSelectingPosition, 
    toggleIsSelectingPosition,
    setIsMinimized,
    toggleIsMinimized,
    setSelectedWorldPosition,
    showSnackbar,
    hideSnackbar,
    setSelectedLore

} = uiSlice.actions;
export default uiSlice.reducer;