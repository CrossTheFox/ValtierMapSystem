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
        contextMenu: {
            open: false,
            screenX: 0,
            screenY: 0,
            worldX: 0,
            worldY: 0,
            type: "map",      // "map" | "location"
            location: null,
        },
        measureTool: {
            pointA: null,     // { x, y, label }
            pointB: null,     // { x, y, label }
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
        },

        // ── Context Menu ──────────────────────────────────────────
        openContextMenu(state, action) {
            state.contextMenu = { open: true, ...action.payload };
        },
        closeContextMenu(state) {
            state.contextMenu.open = false;
        },

        // ── Measure Tool ──────────────────────────────────────────
        setMeasurePointA(state, action) {
            state.measureTool.pointA = action.payload;
            state.measureTool.pointB = null;
        },
        setMeasurePointB(state, action) {
            state.measureTool.pointB = action.payload;
        },
        clearMeasureTool(state) {
            state.measureTool.pointA = null;
            state.measureTool.pointB = null;
        },
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
    setSelectedLore,
    openContextMenu,
    closeContextMenu,
    setMeasurePointA,
    setMeasurePointB,
    clearMeasureTool,
} = uiSlice.actions;

export default uiSlice.reducer;
