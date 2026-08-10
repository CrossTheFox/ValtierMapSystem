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
            type: "map",      // "map" | "location" | "token"
            location: null,
            tokenId: null,
            tokenName: null,
        },
        measureTool: {
            pointA: null,     // legacy local measure (kept for compat)
            pointB: null,
        },
        /** Shared-table ruler placement mode (left tools). */
        rulerTool: {
            active: false,
            /** Anchored points of the in-progress polyline: [{ x, y, col, row }, ...] */
            draftPoints: [],
        },
        /** Map shapes tool (circle / rect / polygon-on-grid). */
        drawTool: {
            active: false,
            /** "circle" | "rect" | "freehand" (polygon) */
            shape: "circle",
            /** "round" | "square" — circle footprint from center */
            circleMode: "round",
            /** Stroke/fill hex for new figures */
            color: "#00f2ea",
            /** First corner / center while placing circle|rect */
            draftPoint: null,
            /** Completed parts waiting to be saved (Ctrl chain) */
            draftParts: [],
            /**
             * Polygon draft: grid-snapped vertices while placing "freehand".
             * (Legacy name kept; no longer a free-drag stroke.)
             */
            draftPath: null,
            /** Completed polygon point-lists in the current compound (Ctrl chain) */
            draftPaths: [],
        },
        /** Selected map rulers (local). */
        selectedRulerIds: [],
        /** Selected map drawings (local). */
        selectedDrawingIds: [],
        wikiOverlay: {
            open: false,
            mode: "list",         // "list" | "detail" | "edit" | "create"
            entityId: null,
            vttContext: null,     // { linkedVttLocationId?, linkedVttCharacterId?, prefillType? }
            areaFilter: null,     // WikiAreaId | null — set when opening from drawer area nav
        },
        /** Campaign Neural Lab (circuit) — separate from Narrative Archive. */
        neuralLabOverlay: {
            open: false,
            focusEntityId: null,
        },
        openDialogs: {
            characters: false,   // legacy key (roster moved into VTT Configs / settings)
            sheet: false,        // CharactersSettingsDialog (dossier)
            settings: false,     // AdminSettingsDialog
            loreBrowser: false,  // LoreDialog en modo browse (sin selectedLore)
            initiative: false,   // InitiativeTurnBar (DM)
        },
        /**
         * Deep-link target when opening the character dossier.
         * tab: "IDENTIDAD" | "KIT" | "MESH" | "NARRATIVA"; kitView: "list" | "tree"
         */
        sheetFocus: {
            tab: "IDENTIDAD",
            kitView: "tree",
            /** Optional: open dossier for this id (DM roster). Else activeCharacterId. */
            characterId: null,
            nonce: 0,
        },
        /**
         * Deep-link into VTT Configs (AdminSettingsDialog).
         * tab: 0 PERSONAJES … 3 CONTENIDO …; contentSub: LOCATIONS|JOBS|OBJECTS
         */
        settingsFocus: {
            tab: 0,
            contentSub: null,
            jobId: null,
            nonce: 0,
        },
        /** IC speech bubbles over map tokens: characterId → { messageId, text, expiresAt } */
        tokenSpeech: {},
        /** Tokens selected on the active map (multi-select / marquee). */
        selectedTokenIds: [],
        /** Ephemeral turn-focus flash on the map (local, not Firestore). */
        turnFocus: null, // { id, x, y, mapId, createdAt }
        /**
         * Macro bar (AbilityHotbar) — survives map clicks / map switches.
         * Only closes via the bolt toggle or the bar's X.
         */
        abilityBarOpen: false,
        /** Active macro page index 0..8 */
        macroPage: 0,
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
            state.contextMenu = {
                open: true,
                screenX: 0,
                screenY: 0,
                worldX: 0,
                worldY: 0,
                type: "map",
                location: null,
                tokenId: null,
                tokenName: null,
                ...action.payload,
            };
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
            if (!state.rulerTool.active) state.rulerTool.draftPoints = [];
            if (state.rulerTool.active && state.drawTool) {
                state.drawTool.active = false;
                state.drawTool.draftPoint = null;
                state.drawTool.draftParts = [];
                state.drawTool.draftPath = null;
                state.drawTool.draftPaths = [];
            }
        },
        toggleRulerMode(state) {
            state.rulerTool.active = !state.rulerTool.active;
            if (!state.rulerTool.active) state.rulerTool.draftPoints = [];
        },
        /** @deprecated Prefer pushRulerDraftPoint — kept for gradual migration */
        setRulerDraftA(state, action) {
            state.rulerTool.draftPoints = action.payload ? [action.payload] : [];
        },
        setRulerDraftPoints(state, action) {
            state.rulerTool.draftPoints = Array.isArray(action.payload) ? action.payload : [];
        },
        pushRulerDraftPoint(state, action) {
            if (!action.payload) return;
            state.rulerTool.draftPoints.push(action.payload);
        },
        clearRulerDraft(state) {
            state.rulerTool.draftPoints = [];
        },

        // ── Draw / shapes tool ────────────────────────────────────
        setDrawMode(state, action) {
            const payload = action.payload;
            if (payload === false || payload == null) {
                state.drawTool.active = false;
                state.drawTool.draftPoint = null;
                state.drawTool.draftParts = [];
                state.drawTool.draftPath = null;
                state.drawTool.draftPaths = [];
                return;
            }
            const shape = typeof payload === "string"
                ? payload
                : (payload.shape || state.drawTool.shape || "circle");
            const active = typeof payload === "object" && "active" in payload
                ? Boolean(payload.active)
                : true;
            state.drawTool.active = active;
            state.drawTool.shape = shape;
            state.drawTool.draftPoint = null;
            state.drawTool.draftParts = [];
            state.drawTool.draftPath = null;
            state.drawTool.draftPaths = [];
            if (active) {
                state.rulerTool.active = false;
                state.rulerTool.draftPoints = [];
            }
        },
        setDrawShape(state, action) {
            state.drawTool.shape = action.payload || "circle";
            state.drawTool.draftPoint = null;
            state.drawTool.draftParts = [];
            state.drawTool.draftPath = null;
            state.drawTool.draftPaths = [];
        },
        setDrawCircleMode(state, action) {
            state.drawTool.circleMode = action.payload === "square" ? "square" : "round";
        },
        setDrawColor(state, action) {
            if (typeof action.payload === "string" && action.payload.trim()) {
                state.drawTool.color = action.payload.trim();
            }
        },
        setDrawDraftPoint(state, action) {
            state.drawTool.draftPoint = action.payload ?? null;
        },
        setDrawDraftParts(state, action) {
            state.drawTool.draftParts = Array.isArray(action.payload) ? action.payload : [];
        },
        pushDrawDraftPart(state, action) {
            if (!action.payload) return;
            state.drawTool.draftParts.push(action.payload);
        },
        setDrawDraftPath(state, action) {
            state.drawTool.draftPath = action.payload ?? null;
        },
        setDrawDraftPaths(state, action) {
            state.drawTool.draftPaths = Array.isArray(action.payload) ? action.payload : [];
        },
        pushDrawDraftPath(state, action) {
            if (!action.payload) return;
            state.drawTool.draftPaths.push(action.payload);
        },
        clearDrawDraft(state) {
            state.drawTool.draftPoint = null;
            state.drawTool.draftParts = [];
            state.drawTool.draftPath = null;
            state.drawTool.draftPaths = [];
        },

        setSelectedRulerIds(state, action) {
            const ids = Array.isArray(action.payload) ? action.payload : [];
            state.selectedRulerIds = [...new Set(ids.filter(Boolean).map(String))];
        },
        clearRulerSelection(state) {
            state.selectedRulerIds = [];
        },
        setSelectedDrawingIds(state, action) {
            const ids = Array.isArray(action.payload) ? action.payload : [];
            state.selectedDrawingIds = [...new Set(ids.filter(Boolean).map(String))];
        },
        clearDrawingSelection(state) {
            state.selectedDrawingIds = [];
        },
        clearMapMarkSelection(state) {
            state.selectedRulerIds = [];
            state.selectedDrawingIds = [];
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

        // ── Campaign Neural Lab ───────────────────────────────────
        openNeuralLabOverlay(state, action) {
            const { focusEntityId = null } = action.payload || {};
            state.neuralLabOverlay.open = true;
            state.neuralLabOverlay.focusEntityId = focusEntityId ? String(focusEntityId) : null;
        },
        closeNeuralLabOverlay(state) {
            state.neuralLabOverlay.open = false;
            state.neuralLabOverlay.focusEntityId = null;
        },
        setNeuralLabFocusEntity(state, action) {
            state.neuralLabOverlay.focusEntityId = action.payload
                ? String(action.payload)
                : null;
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
         * Open player dossier.
         * Optional deep-link: { tab, kitView, characterId } — characterId lets DM open any roster sheet.
         */
        openCharacterSheet(state, action) {
            const {
                tab = "IDENTIDAD",
                kitView = "tree",
                characterId = null,
            } = action.payload || {};
            const validTabs = ["IDENTIDAD", "KIT", "MESH", "NARRATIVA"];
            const nextTab = validTabs.includes(tab) ? tab : "IDENTIDAD";
            const nextKit = kitView === "list" ? "list" : "tree";
            state.openDialogs.sheet = true;
            state.minimizedDialogs[DIALOG_IDS.SHEET] = false;
            state.sheetFocus = {
                tab: nextTab,
                kitView: nextKit,
                characterId: characterId ? String(characterId) : null,
                nonce: (state.sheetFocus?.nonce || 0) + 1,
            };
        },
        /**
         * Open VTT Configs with optional deep-link into a tab / content sub / job.
         * @param {{ tab?: number, contentSub?: string|null, jobId?: string|null }} [payload]
         */
        openSettingsFocus(state, action) {
            const { tab = 0, contentSub = null, jobId = null } = action.payload || {};
            state.openDialogs.settings = true;
            state.minimizedDialogs[DIALOG_IDS.SETTINGS] = false;
            state.settingsFocus = {
                tab: Number.isFinite(tab) ? tab : 0,
                contentSub: contentSub || null,
                jobId: jobId || null,
                nonce: (state.settingsFocus?.nonce || 0) + 1,
            };
        },
        clearSettingsFocus(state) {
            state.settingsFocus = {
                tab: 0,
                contentSub: null,
                jobId: null,
                nonce: state.settingsFocus?.nonce || 0,
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

        // ── Token selection ───────────────────────────────────────
        setSelectedTokenIds(state, action) {
            const ids = Array.isArray(action.payload) ? action.payload : [];
            state.selectedTokenIds = [...new Set(ids.filter(Boolean).map(String))];
        },
        toggleTokenSelected(state, action) {
            const id = action.payload != null ? String(action.payload) : null;
            if (!id) return;
            const idx = state.selectedTokenIds.indexOf(id);
            if (idx >= 0) state.selectedTokenIds.splice(idx, 1);
            else state.selectedTokenIds.push(id);
        },
        clearTokenSelection(state) {
            state.selectedTokenIds = [];
        },
        clearAllMapSelection(state) {
            state.selectedTokenIds = [];
            state.selectedRulerIds = [];
            state.selectedDrawingIds = [];
        },
        setTurnFocus(state, action) {
            const p = action.payload;
            if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) {
                state.turnFocus = null;
                return;
            }
            state.turnFocus = {
                id: p.id || `tf-${Date.now()}`,
                x: p.x,
                y: p.y,
                mapId: p.mapId ?? null,
                createdAt: p.createdAt ?? Date.now(),
            };
        },
        clearTurnFocus(state) {
            state.turnFocus = null;
        },
        toggleAbilityBar(state) {
            state.abilityBarOpen = !state.abilityBarOpen;
        },
        setAbilityBarOpen(state, action) {
            state.abilityBarOpen = !!action.payload;
        },
        setMacroPage(state, action) {
            const n = Math.floor(Number(action.payload));
            state.macroPage = Number.isFinite(n)
                ? Math.max(0, Math.min(8, n))
                : 0;
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
    setRulerDraftPoints,
    pushRulerDraftPoint,
    clearRulerDraft,
    setDrawMode,
    setDrawShape,
    setDrawCircleMode,
    setDrawColor,
    setDrawDraftPoint,
    setDrawDraftParts,
    pushDrawDraftPart,
    setDrawDraftPath,
    setDrawDraftPaths,
    pushDrawDraftPath,
    clearDrawDraft,
    setSelectedRulerIds,
    clearRulerSelection,
    setSelectedDrawingIds,
    clearDrawingSelection,
    clearMapMarkSelection,
    openWikiOverlay,
    closeWikiOverlay,
    setWikiOverlayMode,
    setWikiOverlayEntity,
    setWikiOverlayAreaFilter,
    openNeuralLabOverlay,
    closeNeuralLabOverlay,
    setNeuralLabFocusEntity,
    openDialog,
    openCharacterSheet,
    openSettingsFocus,
    clearSettingsFocus,
    closeDialog,
    showTokenSpeech,
    dismissTokenSpeech,
    pruneExpiredTokenSpeech,
    setSelectedTokenIds,
    toggleTokenSelected,
    clearTokenSelection,
    clearAllMapSelection,
    setTurnFocus,
    clearTurnFocus,
    toggleAbilityBar,
    setAbilityBarOpen,
    setMacroPage,
} = uiSlice.actions;

export default uiSlice.reducer;
