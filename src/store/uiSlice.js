import { createSlice } from "@reduxjs/toolkit";
import { DIALOG_IDS, INITIAL_MINIMIZED_DIALOGS } from "../constants/dialogIds";

const uiSlice = createSlice({
    name: "ui",
    initialState: {
        selectedLocation: null,
        previewLocation: null,
        locationDialogOpen: false,
        locationDialogTab: 0,
        selectedLore: null,
        isSelectingPosition: false,
        minimizedDialogs: { ...INITIAL_MINIMIZED_DIALOGS },
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
            pointA: null,     // legacy local measure (kept for compat)
            pointB: null,
        },
        /** Shared-table ruler placement mode (left tools). */
        rulerTool: {
            active: false,
            /** First node while placing: { x, y, col, row } */
            draftA: null,
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
            sheet: false,        // CharactersSettingsDialog (dossier)
            settings: false,     // AdminSettingsDialog
            loreBrowser: false,  // LoreDialog en modo browse (sin selectedLore)
        },
        /**
         * Deep-link target when opening the character dossier.
         * tab: "IDENTIDAD" | "KIT"; kitView: "list" | "tree"
         */
        sheetFocus: {
            tab: "IDENTIDAD",
            kitView: "tree",
            nonce: 0,
        },
        /** IC speech bubbles over map tokens: characterId → { messageId, text, expiresAt } */
        tokenSpeech: {},
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
            state.minimizedDialogs[DIALOG_IDS.LOCATION] = false;
        },
        closeLocation(state) {
            state.selectedLocation = null;
            state.locationDialogOpen = false;
            state.locationDialogTab = 0;
            state.minimizedDialogs[DIALOG_IDS.LOCATION] = false;
        },
        setIsSelectingPosition(state, action) {
            state.isSelectingPosition = action.payload;
        },
        toggleIsSelectingPosition(state) {
            state.isSelectingPosition = !state.isSelectingPosition;
        },
        setDialogMinimized(state, action) {
            const { id, value } = action.payload;
            if (id in state.minimizedDialogs) {
                state.minimizedDialogs[id] = value;
            }
        },
        toggleDialogMinimized(state, action) {
            const id = action.payload;
            if (id in state.minimizedDialogs) {
                state.minimizedDialogs[id] = !state.minimizedDialogs[id];
            }
        },
        restoreDialog(state, action) {
            const id = action.payload;
            if (id in state.minimizedDialogs) {
                state.minimizedDialogs[id] = false;
            }
        },
        restoreAllDialogs(state) {
            Object.keys(state.minimizedDialogs).forEach((id) => {
                state.minimizedDialogs[id] = false;
            });
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
            if (action.payload) {
                state.minimizedDialogs[DIALOG_IDS.LORE] = false;
            }
        },

        // ── Context Menu ──────────────────────────────────────────
        openContextMenu(state, action) {
            state.contextMenu = { open: true, ...action.payload };
        },
        closeContextMenu(state) {
            state.contextMenu.open = false;
        },

        // ── Measure Tool (legacy local) ───────────────────────────
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

        // ── Shared ruler tool ─────────────────────────────────────
        setRulerMode(state, action) {
            state.rulerTool.active = Boolean(action.payload);
            if (!state.rulerTool.active) state.rulerTool.draftA = null;
        },
        toggleRulerMode(state) {
            state.rulerTool.active = !state.rulerTool.active;
            if (!state.rulerTool.active) state.rulerTool.draftA = null;
        },
        setRulerDraftA(state, action) {
            state.rulerTool.draftA = action.payload;
        },
        clearRulerDraft(state) {
            state.rulerTool.draftA = null;
        },

        // ── Wiki Overlay ──────────────────────────────────────────
        openWikiOverlay(state, action) {
            const { mode = "list", entityId = null, vttContext = null, areaFilter = null } = action.payload || {};
            state.wikiOverlay.open = true;
            state.wikiOverlay.mode = mode;
            state.wikiOverlay.entityId = entityId;
            state.wikiOverlay.vttContext = vttContext;
            state.wikiOverlay.areaFilter = areaFilter;
            state.minimizedDialogs[DIALOG_IDS.WIKI] = false;
        },
        closeWikiOverlay(state) {
            state.wikiOverlay.open = false;
            state.wikiOverlay.mode = "list";
            state.wikiOverlay.entityId = null;
            state.wikiOverlay.vttContext = null;
            state.wikiOverlay.areaFilter = null;
            state.minimizedDialogs[DIALOG_IDS.WIKI] = false;
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
                if (name in state.minimizedDialogs) {
                    state.minimizedDialogs[name] = false;
                }
            }
        },
        /**
         * Open player dossier for the active character.
         * Optional deep-link: { tab: "IDENTIDAD"|"KIT"|"MESH", kitView: "list"|"tree" }
         */
        openCharacterSheet(state, action) {
            const { tab = "IDENTIDAD", kitView = "tree" } = action.payload || {};
            const validTabs = ["IDENTIDAD", "KIT", "MESH"];
            const nextTab = validTabs.includes(tab) ? tab : "IDENTIDAD";
            const nextKit = kitView === "list" ? "list" : "tree";
            state.openDialogs.sheet = true;
            state.minimizedDialogs[DIALOG_IDS.SHEET] = false;
            state.sheetFocus = {
                tab: nextTab,
                kitView: nextKit,
                nonce: (state.sheetFocus?.nonce || 0) + 1,
            };
        },
        closeDialog(state, action) {
            const name = action.payload;
            if (name in state.openDialogs) {
                state.openDialogs[name] = false;
            }
            if (name in state.minimizedDialogs) {
                state.minimizedDialogs[name] = false;
            }
        },
        showTokenSpeech(state, action) {
            const { characterId, text, messageId, durationMs = 8000 } = action.payload || {};
            if (!characterId || !text) return;
            state.tokenSpeech[characterId] = {
                messageId: messageId ?? null,
                text: String(text).slice(0, 280),
                expiresAt: Date.now() + Math.max(3000, Number(durationMs) || 8000),
            };
        },
        dismissTokenSpeech(state, action) {
            const characterId = action.payload;
            if (characterId && state.tokenSpeech[characterId]) {
                delete state.tokenSpeech[characterId];
            }
        },
        pruneExpiredTokenSpeech(state) {
            const now = Date.now();
            for (const id of Object.keys(state.tokenSpeech)) {
                if ((state.tokenSpeech[id]?.expiresAt ?? 0) <= now) {
                    delete state.tokenSpeech[id];
                }
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
    setDialogMinimized,
    toggleDialogMinimized,
    restoreDialog,
    restoreAllDialogs,
    setSelectedWorldPosition,
    showSnackbar,
    hideSnackbar,
    setSelectedLore,
    openContextMenu,
    closeContextMenu,
    setMeasurePointA,
    setMeasurePointB,
    clearMeasureTool,
    setRulerMode,
    toggleRulerMode,
    setRulerDraftA,
    clearRulerDraft,
    openWikiOverlay,
    closeWikiOverlay,
    setWikiOverlayMode,
    setWikiOverlayEntity,
    setWikiOverlayAreaFilter,
    openDialog,
    openCharacterSheet,
    closeDialog,
    showTokenSpeech,
    dismissTokenSpeech,
    pruneExpiredTokenSpeech,
} = uiSlice.actions;

export default uiSlice.reducer;
