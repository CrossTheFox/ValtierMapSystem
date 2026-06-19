import { createSlice } from "@reduxjs/toolkit";

const uiSlice = createSlice({
    name: "ui",
    initialState: {
        selectedLocation: null,
        previewLocation: null,
        locationDialogOpen: false,
        locationDialogTab: 0,
        selectedLore: null,
        isSelectingPosition: false,
        isMinimized: false,
        wikiOverlayMinimized: false,
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
        wikiOverlay: {
            open: false,
            mode: "list",         // "list" | "detail" | "edit" | "create"
            entityId: null,
            vttContext: null,     // { linkedVttLocationId?, linkedVttCharacterId?, prefillType? }
            areaFilter: null,     // WikiAreaId | null — set when opening from drawer area nav
        },
        openDialogs: {
            characters: false,   // CharactersGlobalDialog
            sheet: false,        // CharactersSettingsDialog
            settings: false,     // AdminSettingsDialog
            loreBrowser: false,  // LoreDialog en modo browse (sin selectedLore)
        },
    },
    reducers: {
        selectLocationPreview(state, action) {
            state.previewLocation = action.payload;
            state.locationDialogOpen = false;
            state.selectedLocation = null;
        },
        clearLocationPreview(state) {
            state.previewLocation = null;
        },
        openLocation(state, action) {
            const payload = action.payload;
            if (payload?.location) {
                state.selectedLocation = payload.location;
                state.locationDialogTab = payload.initialTab ?? 0;
            } else {
                state.selectedLocation = payload;
                state.locationDialogTab = 0;
            }
            state.previewLocation = state.selectedLocation;
            state.locationDialogOpen = true;
            state.isMinimized = false;
        },
        closeLocation(state) {
            state.selectedLocation = null;
            state.locationDialogOpen = false;
            state.locationDialogTab = 0;
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

        // ── Wiki Overlay ──────────────────────────────────────────
        openWikiOverlay(state, action) {
            const { mode = "list", entityId = null, vttContext = null, areaFilter = null } = action.payload || {};
            state.wikiOverlay.open = true;
            state.wikiOverlay.mode = mode;
            state.wikiOverlay.entityId = entityId;
            state.wikiOverlay.vttContext = vttContext;
            state.wikiOverlay.areaFilter = areaFilter;
            state.wikiOverlayMinimized = false;
        },
        closeWikiOverlay(state) {
            state.wikiOverlay.open = false;
            state.wikiOverlay.mode = "list";
            state.wikiOverlay.entityId = null;
            state.wikiOverlay.vttContext = null;
            state.wikiOverlay.areaFilter = null;
            state.wikiOverlayMinimized = false;
        },
        setWikiOverlayMinimized(state, action) {
            state.wikiOverlayMinimized = action.payload;
        },
        toggleWikiOverlayMinimized(state) {
            state.wikiOverlayMinimized = !state.wikiOverlayMinimized;
        },
        setWikiOverlayMode(state, action) {
            state.wikiOverlay.mode = action.payload;
        },
        setWikiOverlayEntity(state, action) {
            state.wikiOverlay.entityId = action.payload;
            state.wikiOverlay.mode = action.payload ? "detail" : "list";
        },
        setWikiOverlayAreaFilter(state, action) {
            state.wikiOverlay.areaFilter = action.payload;
        },

        // ── Dialog Stack ──────────────────────────────────────────
        openDialog(state, action) {
            const name = action.payload;
            if (name in state.openDialogs) {
                state.openDialogs[name] = true;
                if (name === "settings" || name === "sheet" || name === "characters" || name === "loreBrowser") {
                    state.isMinimized = false;
                }
            }
        },
        closeDialog(state, action) {
            const name = action.payload;
            if (name in state.openDialogs) {
                state.openDialogs[name] = false;
            }
        },
    },
});

export const {
    openLocation,
    closeLocation,
    selectLocationPreview,
    clearLocationPreview,
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
    openWikiOverlay,
    closeWikiOverlay,
    setWikiOverlayMode,
    setWikiOverlayEntity,
    setWikiOverlayAreaFilter,
    setWikiOverlayMinimized,
    toggleWikiOverlayMinimized,
    openDialog,
    closeDialog,
} = uiSlice.actions;

export default uiSlice.reducer;
