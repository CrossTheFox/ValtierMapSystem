import { useState, useEffect, useMemo, useRef, useCallback, createContext, useContext } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Dialog, DialogContent, Box, CircularProgress, Divider } from "@mui/material";
import MinimizeIcon from "@mui/icons-material/Remove";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import { fetchPlayerCharacters, updateCharacterInList } from "../store/characterSlice";
import { updateCharacterInState } from "../store/worldSlice";
import { showSnackbar } from "../store/uiSlice";
import { UI_COLORS } from "../constants/uiColors";
import { DIALOG_IDS } from "../constants/dialogIds";
import { VTT_DIALOG_SIZE } from "../constants/vttHudTokens";
import { CHARACTER_SHEET_TOKENS } from "../constants/characterSheetTokens";
import { resolveCharacterAp, resolveCharacterLevel } from "../constants/skillTreeProgression";
import useDialogActions from "../hooks/useDialogActions";
import { useStatSystem } from "../hooks/useStatSystem";
import { useCampaignWikiEntities } from "../hooks/useCampaignWikiEntities";
import { updateCharacterFields } from "../../firebase/services/characterService";
import { normalizeBurdens } from "../utils/characterBurdens";
import { buildOptimisticVitalsReduxPatch } from "../utils/seamVitals";
import DraggableResizablePaper from "./DraggableResizablePaper";
import usePopout from "../hooks/usePopout";
import CharacterSheetBody from "./characters/CharacterSheetBody";
import { SHEET_TABS, normalizeSheetTab, isMaletinIntent } from "./characters/CharacterSheetTabs";
import { DebouncedBoxInput } from "./customs/DebouncedField";

/** Debounce for text / click edits before Firestore write. */
const AUTOSAVE_MS = 600;

/* ── Dossier context (passed down to ID/KIT views) ────────────────── */
export const DossierContext = createContext({
    editMode: true,
    dirty: false,
    draft: null,
    saveStatus: "idle",
    spawnPing: () => {},
    patchDraft: () => {},
    saveDraft: async () => true,
    flushSave: async () => true,
    requestToggleEdit: () => {},
});
export const useDossier = () => useContext(DossierContext);

/* ── Chrome color map (matches mockup exactly) ───────────────────── */
const TAB_COLORS = {
    IDENTIDAD: UI_COLORS.anomaly,      // #00f2ea cyan
    KIT:       UI_COLORS.anomaly,
    MESH:      UI_COLORS.accent,       // #ff66ff pink
    NARRATIVA: UI_COLORS.accentStrong, // #ff1493 — narrative facet
};

const SAVE_FAILED_MSG = "No se pudieron guardar los cambios. Reintenta o descarta para salir.";

/**
 * Merge sheet list + world realtime without blocking user edits.
 * List wins for keys it actually has (incl. 0 / empty string). World fills gaps only.
 * If list stats look like an empty stub while world has real values, keep world
 * (guards against partial list patches wiping the sheet — without Math.max freezes).
 */
function isHollowStats(stats) {
    if (!stats || typeof stats !== "object") return true;
    const vals = Object.values(stats).map((v) => Number(v));
    if (!vals.length) return true;
    return vals.every((n) => !Number.isFinite(n) || n === 0);
}

function mergeStatsSafe(listStats, worldStats) {
    const list = listStats && typeof listStats === "object" ? listStats : {};
    const world = worldStats && typeof worldStats === "object" ? worldStats : {};
    if (!Object.keys(list).length || (isHollowStats(list) && !isHollowStats(world))) {
        return { ...world };
    }
    const keys = new Set([...Object.keys(world), ...Object.keys(list)]);
    const out = {};
    for (const k of keys) {
        if (Object.prototype.hasOwnProperty.call(list, k)) {
            const n = Number(list[k]);
            out[k] = Number.isFinite(n) ? n : (Number(world[k]) || 0);
        } else {
            out[k] = Number(world[k]) || 0;
        }
    }
    return out;
}

function mergeBondSafe(listBond, worldBond) {
    const list = listBond && typeof listBond === "object" ? listBond : {};
    const world = worldBond && typeof worldBond === "object" ? worldBond : {};
    if (!Object.keys(list).length) return { ...world };
    return {
        ...world,
        ...list,
        ideals: Array.isArray(list.ideals)
            ? list.ideals
            : (Array.isArray(world.ideals) ? world.ideals : []),
    };
}

function mergeBondPowersSafe(listPowers, worldPowers) {
    if (Array.isArray(listPowers)) return listPowers;
    if (Array.isArray(worldPowers)) return worldPowers;
    return [];
}

/**
 * Player dossier for the HUD-active character — Holodeck shell.
 * Chrome: tabs (ID / KIT / MESH / NAR) left, character name + level centred, controls right.
 * Always click-to-edit; edits autosave (debounce + flush on blur / leave).
 */
export default function CharactersSettingsDialog({ open, onClose, popupMode = false }) {
    const dispatch = useDispatch();

    const { profile } = useSelector((s) => s.player);
    const { list: characters, status: charactersStatus } = useSelector((s) => s.characters);
    const worldChars = useSelector((s) => s.world.charactersById ?? {});
    const sheetFocus = useSelector((s) => s.ui.sheetFocus);
    const loading = charactersStatus === "loading";

    const [activeTab, setActiveTab] = useState("IDENTIDAD");
    const [kitView, setKitView] = useState("tree");
    /** Always-on click-to-edit (no toggle). */
    const editMode = true;
    const [draft, setDraft] = useState(null);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    /** idle | pending | saving | saved | error */
    const [saveStatus, setSaveStatus] = useState("idle");
    /** In-dialog leave guard — only when flush fails. */
    const [leaveGuard, setLeaveGuard] = useState(null); // 'close' | 'mesh' | 'popout' | 'backdrop'

    const { isMinimized, toggleMinimize, forceMinimize } = useDialogActions(DIALOG_IDS.SHEET);
    const { isPopped, popout } = usePopout("characters");

    /* ── Ping overlay ref ─────────────────────────────────────────── */
    const pingLayerRef = useRef(null);
    const dirtyRef = useRef(false);
    const draftRef = useRef(null);
    /** Bumped on every patchDraft so saveDraft won't clear newer in-flight edits. */
    const draftEpochRef = useRef(0);
    const saveTimerRef = useRef(null);
    const savedClearTimerRef = useRef(null);
    const saveDraftRef = useRef(async () => true);

    const spawnPing = useCallback((x, y) => {
        const layer = pingLayerRef.current;
        if (!layer) return;
        const wrap = document.createElement("div");
        wrap.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:0;height:0;pointer-events:none`;
        wrap.innerHTML = `
            <div class="dossier-ping-ring"></div>
            <div class="dossier-ping-ring"></div>
            <div class="dossier-ping-ring"></div>
            <div class="dossier-ping-cross"></div>`;
        layer.appendChild(wrap);
        setTimeout(() => wrap.remove(), 1200);
    }, []);

    /* ── Character resolution ─────────────────────────────────────── */
    const activeCharacterId = profile?.activeCharacterId || null;
    const focusCharacterId = sheetFocus?.characterId || activeCharacterId || null;

    const selectedCharacter = useMemo(() => {
        if (!focusCharacterId) return null;
        const fromList = characters.find((c) => c.id === focusCharacterId);
        const fromWorld = worldChars[focusCharacterId];
        if (fromList && fromWorld) {
            // Sheet list can lag / get partial patches; world realtime has the full doc.
            // Never let empty list stats/bond wipe richer world data (burden autosave bug).
            return {
                ...fromWorld,
                ...fromList,
                id: focusCharacterId,
                stats: mergeStatsSafe(fromList.stats, fromWorld.stats),
                bond: mergeBondSafe(fromList.bond, fromWorld.bond),
                bondPowers: mergeBondPowersSafe(fromList.bondPowers, fromWorld.bondPowers),
                burdens: normalizeBurdens(
                    fromList.burdens !== undefined ? fromList.burdens : fromWorld.burdens,
                ),
                bannerUrl: fromList.bannerUrl ?? fromWorld.bannerUrl ?? null,
                imageUrl: fromList.imageUrl ?? fromWorld.imageUrl ?? null,
                tokenImageUrl: fromList.tokenImageUrl ?? fromWorld.tokenImageUrl ?? null,
                ap: fromList.ap ?? fromWorld.ap ?? 0,
                level: fromList.level ?? fromWorld.level ?? 0,
                hpCur: fromList.hpCur ?? fromWorld.hpCur,
                vigor: fromList.vigor ?? fromWorld.vigor,
                effort: fromList.effort ?? fromWorld.effort,
                turn: fromList.turn ?? fromWorld.turn,
                conditions: fromList.conditions ?? fromWorld.conditions,
                hpBroken: fromList.hpBroken ?? fromWorld.hpBroken,
                vit: fromList.vit ?? fromWorld.vit,
            };
        }
        if (fromList) {
            return {
                ...fromList,
                stats: fromList.stats || {},
                bond: fromList.bond || {},
                burdens: normalizeBurdens(fromList.burdens),
            };
        }
        if (fromWorld) {
            return {
                id: focusCharacterId,
                ...fromWorld,
                burdens: normalizeBurdens(fromWorld.burdens),
            };
        }
        return null;
    }, [focusCharacterId, characters, worldChars]);

    /** Character as shown in the sheet (live doc + uncommitted draft). */
    const viewCharacter = useMemo(() => {
        if (!selectedCharacter) return null;
        if (!draft) return selectedCharacter;
        // Apply only known draft keys — never raw-spread draft (avoids wiping nested fields).
        return {
            ...selectedCharacter,
            name: draft.name ?? selectedCharacter.name,
            bond: { ...(selectedCharacter.bond || {}), ...(draft.bond || {}) },
            stats: { ...(selectedCharacter.stats || {}), ...(draft.stats || {}) },
            bondPowers: draft.bondPowers ?? selectedCharacter.bondPowers,
            burdens: draft.burdens !== undefined
                ? normalizeBurdens(draft.burdens)
                : normalizeBurdens(selectedCharacter.burdens),
            narrativeShortcuts: draft.narrativeShortcuts ?? selectedCharacter.narrativeShortcuts,
            bannerUrl: draft.bannerUrl !== undefined ? draft.bannerUrl : (selectedCharacter.bannerUrl ?? null),
            imageUrl: draft.imageUrl !== undefined ? draft.imageUrl : (selectedCharacter.imageUrl ?? null),
            tokenImageUrl: draft.tokenImageUrl !== undefined
                ? draft.tokenImageUrl
                : (selectedCharacter.tokenImageUrl ?? null),
            ap: draft.ap ?? selectedCharacter.ap ?? 0,
            level: draft.level ?? selectedCharacter.level ?? 0,
            assignedClassIds: draft.assignedClassIds ?? selectedCharacter.assignedClassIds,
            activeClassId: draft.activeClassId ?? selectedCharacter.activeClassId,
            combatOverrides: draft.combatOverrides ?? selectedCharacter.combatOverrides,
            vit: draft.vit ?? selectedCharacter.vit,
            jobResources: draft.jobResources ?? selectedCharacter.jobResources,
            macroBar: draft.macroBar ?? selectedCharacter.macroBar,
            hpCur: draft.hpCur ?? selectedCharacter.hpCur,
            vigor: draft.vigor ?? selectedCharacter.vigor,
            effort: draft.effort ?? selectedCharacter.effort,
            turn: draft.turn ?? selectedCharacter.turn,
            conditions: draft.conditions ?? selectedCharacter.conditions,
            hpBroken: draft.hpBroken ?? selectedCharacter.hpBroken,
        };
    }, [selectedCharacter, draft]);

    /* ── Fetch on open ────────────────────────────────────────────── */
    useEffect(() => {
        if (open && profile?.uid) {
            dispatch(fetchPlayerCharacters({ uid: profile.uid, characterIds: profile.characterIds || [] }));
        }
    }, [open, profile?.uid, profile?.characterIds, dispatch]);

    /* ── Deep-link focus ──────────────────────────────────────────── */
    useEffect(() => {
        if (!open && !popupMode) return;
        if (!sheetFocus) return;
        setActiveTab(normalizeSheetTab(sheetFocus.tab));
        setKitView(sheetFocus.kitView === "list" ? "list" : "tree");
    }, [open, popupMode, sheetFocus?.nonce, sheetFocus?.tab, sheetFocus?.kitView]);

    /* Reset draft when character changes */
    useEffect(() => {
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }
        if (savedClearTimerRef.current) {
            clearTimeout(savedClearTimerRef.current);
            savedClearTimerRef.current = null;
        }
        draftEpochRef.current += 1;
        draftRef.current = null;
        dirtyRef.current = false;
        setDraft(null);
        setDirty(false);
        setSaveStatus("idle");
        setLeaveGuard(null);
    }, [focusCharacterId]);

    /* Reset draft when sheet fully closes (keeps state while minimized). */
    useEffect(() => {
        if (open || popupMode) return;
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }
        if (savedClearTimerRef.current) {
            clearTimeout(savedClearTimerRef.current);
            savedClearTimerRef.current = null;
        }
        draftEpochRef.current += 1;
        draftRef.current = null;
        dirtyRef.current = false;
        setDraft(null);
        setDirty(false);
        setSaveStatus("idle");
        setLeaveGuard(null);
    }, [open, popupMode]);

    useEffect(() => () => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        if (savedClearTimerRef.current) clearTimeout(savedClearTimerRef.current);
    }, []);

    const clearAutosaveTimer = useCallback(() => {
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }
    }, []);

    const scheduleAutosave = useCallback(() => {
        setSaveStatus("pending");
        clearAutosaveTimer();
        saveTimerRef.current = setTimeout(() => {
            saveTimerRef.current = null;
            saveDraftRef.current?.();
        }, AUTOSAVE_MS);
    }, [clearAutosaveTimer]);

    const patchDraft = useCallback((partial) => {
        draftEpochRef.current += 1;
        setDraft((prev) => {
            const base = prev || {};
            const next = { ...base, ...partial };
            if (partial.bond) {
                next.bond = { ...(base.bond || {}), ...partial.bond };
            }
            if (partial.stats) {
                next.stats = { ...(base.stats || {}), ...partial.stats };
            }
            if (partial.turn) {
                next.turn = { ...(base.turn || {}), ...partial.turn };
            }
            if (partial.effort) {
                next.effort = { ...(base.effort || {}), ...partial.effort };
            }
            draftRef.current = next;
            return next;
        });

        const char = selectedCharacter;
        if (char?.id) {
            const vitalsPatch = buildOptimisticVitalsReduxPatch(char, partial);
            if (Object.keys(vitalsPatch).length) {
                dispatch(updateCharacterInList({ id: char.id, data: vitalsPatch }));
                dispatch(updateCharacterInState({
                    id: char.id,
                    locationId: char.locationId,
                    data: vitalsPatch,
                }));
            }
        }

        dirtyRef.current = true;
        setDirty(true);
        scheduleAutosave();
    }, [scheduleAutosave, selectedCharacter, dispatch]);

    const discardDraft = useCallback(() => {
        clearAutosaveTimer();
        if (savedClearTimerRef.current) {
            clearTimeout(savedClearTimerRef.current);
            savedClearTimerRef.current = null;
        }
        draftEpochRef.current += 1;
        draftRef.current = null;
        dirtyRef.current = false;
        setDraft(null);
        setDirty(false);
        setSaveStatus("idle");
        setLeaveGuard(null);
    }, [clearAutosaveTimer]);

    const saveDraft = useCallback(async () => {
        const liveDraft = draftRef.current;
        const liveDirty = dirtyRef.current;
        // Nothing pending → success (flush / leave can proceed).
        if (!selectedCharacter?.id || !liveDraft || !liveDirty) {
            setSaveStatus((s) => (s === "pending" || s === "saving" ? "idle" : s));
            return true;
        }
        const epochAtStart = draftEpochRef.current;
        setSaving(true);
        setSaveStatus("saving");
        try {
            const payload = {};
            const reduxPatch = {};
            const baseStats = selectedCharacter.stats || {};
            const baseBond = selectedCharacter.bond || {};
            if (liveDraft.name != null) {
                payload.name = liveDraft.name;
                reduxPatch.name = liveDraft.name;
            }
            if (liveDraft.bannerUrl !== undefined) {
                payload.bannerUrl = liveDraft.bannerUrl;
                reduxPatch.bannerUrl = liveDraft.bannerUrl;
            }
            if (liveDraft.imageUrl !== undefined) {
                payload.imageUrl = liveDraft.imageUrl;
                reduxPatch.imageUrl = liveDraft.imageUrl;
            }
            if (liveDraft.tokenImageUrl !== undefined) {
                payload.tokenImageUrl = liveDraft.tokenImageUrl;
                reduxPatch.tokenImageUrl = liveDraft.tokenImageUrl;
            }
            if (liveDraft.stats) {
                // Only write keys the user actually edited — never dump a full zero map.
                Object.entries(liveDraft.stats).forEach(([k, v]) => {
                    payload[`stats.${k}`] = v;
                });
                reduxPatch.stats = { ...baseStats, ...liveDraft.stats };
            }
            if (liveDraft.bond) {
                Object.entries(liveDraft.bond).forEach(([k, v]) => {
                    payload[`bond.${k}`] = v;
                });
                reduxPatch.bond = { ...baseBond, ...liveDraft.bond };
            }
            if (liveDraft.bondPowers !== undefined) {
                payload.bondPowers = liveDraft.bondPowers;
                reduxPatch.bondPowers = liveDraft.bondPowers;
            }
            if (liveDraft.burdens !== undefined) {
                payload.burdens = normalizeBurdens(liveDraft.burdens);
                reduxPatch.burdens = payload.burdens;
            }
            if (liveDraft.narrativeShortcuts !== undefined) {
                payload.narrativeShortcuts = liveDraft.narrativeShortcuts;
                reduxPatch.narrativeShortcuts = liveDraft.narrativeShortcuts;
            }
            if (liveDraft.assignedClassIds !== undefined) {
                payload.assignedClassIds = liveDraft.assignedClassIds;
                reduxPatch.assignedClassIds = liveDraft.assignedClassIds;
            }
            if (liveDraft.activeClassId !== undefined) {
                payload.activeClassId = liveDraft.activeClassId;
                reduxPatch.activeClassId = liveDraft.activeClassId;
            }
            if (liveDraft.combatOverrides !== undefined) {
                payload.combatOverrides = liveDraft.combatOverrides;
                reduxPatch.combatOverrides = liveDraft.combatOverrides;
            }
            if (liveDraft.vit !== undefined) {
                payload.vit = liveDraft.vit;
                reduxPatch.vit = liveDraft.vit;
            }
            if (liveDraft.level !== undefined) {
                payload.level = liveDraft.level;
                reduxPatch.level = liveDraft.level;
            }
            if (liveDraft.ap !== undefined) {
                payload.ap = liveDraft.ap;
                reduxPatch.ap = liveDraft.ap;
            }
            if (liveDraft.jobResources !== undefined) {
                payload.jobResources = liveDraft.jobResources;
                reduxPatch.jobResources = liveDraft.jobResources;
            }
            if (liveDraft.hpCur !== undefined) {
                payload.hpCur = liveDraft.hpCur;
                reduxPatch.hpCur = liveDraft.hpCur;
            }
            if (liveDraft.vigor !== undefined) {
                payload.vigor = liveDraft.vigor;
                reduxPatch.vigor = liveDraft.vigor;
            }
            if (liveDraft.effort !== undefined) {
                payload.effort = liveDraft.effort;
                reduxPatch.effort = liveDraft.effort;
            }
            if (liveDraft.turn !== undefined) {
                payload.turn = liveDraft.turn;
                reduxPatch.turn = liveDraft.turn;
            }
            if (liveDraft.conditions !== undefined) {
                payload.conditions = liveDraft.conditions;
                reduxPatch.conditions = liveDraft.conditions;
            }
            if (liveDraft.hpBroken !== undefined) {
                payload.hpBroken = liveDraft.hpBroken;
                reduxPatch.hpBroken = liveDraft.hpBroken;
            }
            if (Object.keys(payload).length) {
                await updateCharacterFields(selectedCharacter.id, payload);
                dispatch(updateCharacterInList({ id: selectedCharacter.id, data: reduxPatch }));
                dispatch(updateCharacterInState({
                    id: selectedCharacter.id,
                    locationId: selectedCharacter.locationId,
                    data: reduxPatch,
                }));
            }
            // Don't wipe edits typed/clicked while Firestore save was in flight.
            if (draftEpochRef.current === epochAtStart) {
                draftRef.current = null;
                dirtyRef.current = false;
                setDraft(null);
                setDirty(false);
                setLeaveGuard(null);
                setSaveStatus("saved");
                if (savedClearTimerRef.current) clearTimeout(savedClearTimerRef.current);
                savedClearTimerRef.current = setTimeout(() => {
                    savedClearTimerRef.current = null;
                    setSaveStatus((s) => (s === "saved" ? "idle" : s));
                }, 1800);
            } else {
                // Newer edits landed during save — schedule another pass.
                scheduleAutosave();
            }
            return true;
        } catch (err) {
            console.error("[Dossier] save:", err);
            setSaveStatus("error");
            return false;
        } finally {
            setSaving(false);
        }
    }, [selectedCharacter, dispatch, scheduleAutosave]);

    saveDraftRef.current = saveDraft;

    const flushSave = useCallback(async () => {
        clearAutosaveTimer();
        // Drain pending draft (incl. edits that arrived mid-write).
        for (let i = 0; i < 4; i += 1) {
            if (!dirtyRef.current || !draftRef.current) return true;
            const ok = await saveDraftRef.current?.();
            if (!ok) return false;
        }
        return !dirtyRef.current;
    }, [clearAutosaveTimer]);

    const runLeaveAction = useCallback((action) => {
        discardDraft();
        if (action === "mesh") {
            setActiveTab("MESH");
            return;
        }
        if (action === "backdrop") {
            forceMinimize();
            return;
        }
        if (action === "popout") {
            popout();
            onClose();
            return;
        }
        // 'close'
        if (popupMode) {
            window.close();
            return;
        }
        onClose();
    }, [discardDraft, forceMinimize, popout, onClose, popupMode]);

    const requestLeave = useCallback(async (action) => {
        if (!dirtyRef.current && !saveTimerRef.current) {
            runLeaveAction(action);
            return;
        }
        const ok = await flushSave();
        if (ok && !dirtyRef.current) {
            runLeaveAction(action);
            return;
        }
        setLeaveGuard(action);
        dispatch(showSnackbar({
            message: "No se pudieron guardar los cambios del dossier",
            severity: "error",
        }));
    }, [runLeaveAction, flushSave, dispatch]);

    const requestToggleEdit = useCallback(() => {
        /* no-op: dossier is always editable; autosave handles persistence */
    }, []);

    const handleTabChange = useCallback(async (tabId) => {
        const next = normalizeSheetTab(tabId);
        if (next === activeTab) return;
        if (dirtyRef.current || saveTimerRef.current) {
            const ok = await flushSave();
            if (!ok || dirtyRef.current) {
                setLeaveGuard(next === "MESH" ? "mesh" : null);
                if (next === "MESH") {
                    dispatch(showSnackbar({
                        message: "No se pudieron guardar los cambios del dossier",
                        severity: "error",
                    }));
                }
                return;
            }
        }
        setActiveTab(next);
    }, [activeTab, flushSave, dispatch]);

    const handleToggleMinimize = async (e) => {
        e.stopPropagation();
        if (dirtyRef.current || saveTimerRef.current) {
            await flushSave();
        }
        toggleMinimize();
    };

    const attemptClose = useCallback(() => {
        requestLeave("close");
    }, [requestLeave]);

    const handleDialogClose = (_event, reason) => {
        if (reason === "backdropClick") {
            requestLeave("backdrop");
            return;
        }
        requestLeave("close");
    };
    const handlePopout = (e) => {
        e.stopPropagation();
        requestLeave("popout");
    };

    const campaignForRules = selectedCharacter?.campaignId || profile?.currentCampaignId;
    const { stats: statDefinitions } = useStatSystem(open || popupMode ? campaignForRules : null);
    const campaignWikiEntities = useCampaignWikiEntities(open || popupMode ? campaignForRules : null);

    const displayName = (viewCharacter?.name || "DOSSIER").toUpperCase();

    /* ── Holodeck chrome bar ──────────────────────────────────────── */
    const chromeSx = {
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "10px",
        px: "10px",
        py: 0,
        minHeight: 36,
        position: "relative",
        bgcolor: "rgba(18,18,28,0.92)",
        borderBottom: `1px solid ${UI_COLORS.border}`,
        cursor: popupMode ? "default" : "move",
        userSelect: "none",
        zIndex: 2,
    };

    const chrome = (
        <Box className="dialog-drag-handle" sx={chromeSx}>
            {/* LEFT — play tabs | narrative facet */}
            <Box sx={{ display: "flex", alignItems: "center", gap: "2px", zIndex: 1 }}>
                {SHEET_TABS.map((tab) => {
                    const on = activeTab === tab.id;
                    const isMesh = tab.id === "MESH";
                    const isNar = tab.id === "NARRATIVA";
                    const tabColor = TAB_COLORS[tab.id] || UI_COLORS.anomaly;
                    const tabBtn = (
                        <Box
                            key={tab.id}
                            component="button"
                            type="button"
                            className="dialog-no-drag"
                            onClick={() => handleTabChange(tab.id)}
                            sx={{
                                border: "none",
                                background: on
                                    ? `${tabColor}1e`
                                    : "transparent",
                                color: on ? "#ffffff" : "rgba(255,255,255,0.75)",
                                cursor: "pointer",
                                fontFamily: '"Fira Code", monospace',
                                fontSize: "0.58rem",
                                letterSpacing: "0.1em",
                                px: "12px",
                                py: "7px",
                                borderRadius: "6px",
                                transition: "color 0.15s, background 0.15s",
                                "&:hover": {
                                    color: "#ffffff",
                                    bgcolor: "rgba(255,255,255,0.04)",
                                },
                                ...((isMesh || isNar) && on
                                    ? { color: "#ffffff", bgcolor: `${tabColor}22` }
                                    : {}),
                            }}
                        >
                            {tab.id === "IDENTIDAD" ? "▣ ID"
                                : tab.id === "KIT" ? "⚙ KIT"
                                : tab.id === "MESH" ? "◈ MESH"
                                : "◇ NAR"}
                        </Box>
                    );
                    if (!isNar) return tabBtn;
                    return (
                        <Box
                            key="nar-facet"
                            sx={{ display: "flex", alignItems: "stretch", ml: "4px" }}
                        >
                            <Divider
                                orientation="vertical"
                                flexItem
                                sx={{ borderColor: `${UI_COLORS.accentStrong}66`, mx: 1 }}
                            />
                            {tabBtn}
                        </Box>
                    );
                })}
            </Box>

            {/* CENTER — name + LV + AP on ID/NAR only. KIT owns them on the plate. */}
            {activeTab !== "MESH" && activeTab !== "KIT" ? (
                <Box
                    sx={{
                        position: "absolute",
                        left: "50%",
                        top: "50%",
                        transform: "translate(-50%, -50%)",
                        zIndex: 2,
                        display: "flex",
                        alignItems: "flex-end",
                        gap: 0.85,
                        maxWidth: "min(56vw, 480px)",
                    }}
                    className="dialog-no-drag"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <DebouncedBoxInput
                        value={viewCharacter?.name ?? ""}
                        onCommit={(next) => patchDraft({ name: next })}
                        onBlurExtra={() => { flushSave(); }}
                        placeholder="NOMBRE"
                        sx={{
                            fontFamily: "Orbitron, sans-serif",
                            fontSize: "0.78rem",
                            letterSpacing: "0.16em",
                            color: "#ffffff",
                            textAlign: "center",
                            textTransform: "uppercase",
                            bgcolor: "rgba(0,0,0,0.45)",
                            border: `1px solid ${
                                saveStatus === "error"
                                    ? UI_COLORS.danger
                                    : (dirty || saveStatus === "pending" || saveStatus === "saving")
                                        ? UI_COLORS.accent
                                        : UI_COLORS.border
                            }`,
                            borderRadius: "4px",
                            outline: "none",
                            px: 1.5,
                            py: 0.45,
                            minWidth: 120,
                            maxWidth: "min(34vw, 260px)",
                            flex: 1,
                            "&:focus": { borderColor: UI_COLORS.accent },
                            "&::placeholder": { color: "rgba(255,255,255,0.35)" },
                        }}
                    />
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.2 }}>
                        <Box sx={{ fontFamily: "Orbitron, sans-serif", fontSize: "0.38rem", letterSpacing: "0.14em", color: UI_COLORS.anomaly }}>
                            LV
                        </Box>
                        <Box
                            component="input"
                            type="number"
                            min={0}
                            max={12}
                            title="Nivel"
                            value={resolveCharacterLevel(viewCharacter)}
                            onChange={(e) => {
                                const n = Math.max(0, Math.min(12, Math.floor(Number(e.target.value) || 0)));
                                patchDraft({ level: n });
                            }}
                            onBlur={() => { flushSave(); }}
                            sx={{
                                width: 44,
                                fontFamily: "Orbitron, sans-serif",
                                fontSize: "0.62rem",
                                color: UI_COLORS.anomaly,
                                textAlign: "center",
                                bgcolor: "rgba(0,242,234,0.1)",
                                border: `1px solid ${UI_COLORS.anomaly}88`,
                                borderRadius: "4px",
                                outline: "none",
                                px: 0.4,
                                py: 0.4,
                                boxShadow: `0 0 12px ${UI_COLORS.anomaly}28`,
                                "&::-webkit-outer-spin-button, &::-webkit-inner-spin-button": { WebkitAppearance: "none", margin: 0 },
                                MozAppearance: "textfield",
                                "&:focus": { borderColor: UI_COLORS.anomaly },
                            }}
                        />
                    </Box>
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.2 }}>
                        <Box sx={{ fontFamily: "Orbitron, sans-serif", fontSize: "0.38rem", letterSpacing: "0.14em", color: UI_COLORS.accent }}>
                            AP
                        </Box>
                        <Box
                            component="input"
                            type="number"
                            min={0}
                            title="Ability Points"
                            value={resolveCharacterAp(viewCharacter)}
                            onChange={(e) => {
                                const n = Math.max(0, Math.floor(Number(e.target.value) || 0));
                                patchDraft({ ap: n });
                            }}
                            onBlur={() => { flushSave(); }}
                            sx={{
                                width: 44,
                                fontFamily: "Orbitron, sans-serif",
                                fontSize: "0.62rem",
                                color: UI_COLORS.accentStrong,
                                textAlign: "center",
                                bgcolor: "rgba(255,102,255,0.12)",
                                border: `1px solid ${UI_COLORS.accent}99`,
                                borderRadius: "4px",
                                outline: "none",
                                px: 0.4,
                                py: 0.4,
                                boxShadow: `0 0 12px ${UI_COLORS.accent}33`,
                                "&::-webkit-outer-spin-button, &::-webkit-inner-spin-button": { WebkitAppearance: "none", margin: 0 },
                                MozAppearance: "textfield",
                                "&:focus": { borderColor: UI_COLORS.accent },
                            }}
                        />
                    </Box>
                </Box>
            ) : (
                <Box
                    sx={{
                        position: "absolute",
                        left: "50%",
                        top: "50%",
                        transform: "translate(-50%, -50%)",
                        fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.78rem",
                        letterSpacing: "0.16em",
                        color: "#ffffff",
                        textAlign: "center",
                        pointerEvents: "none",
                        whiteSpace: "nowrap",
                        textShadow: "0 0 12px rgba(255,255,255,0.18)",
                        maxWidth: "min(42vw, 360px)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                    }}
                >
                    {displayName}
                </Box>
            )}

            {/* RIGHT — autosave chip + window controls */}
            <Box sx={{ display: "flex", alignItems: "center", gap: "6px", zIndex: 1 }} className="dialog-no-drag">
                <Box
                    aria-live="polite"
                    sx={{
                        fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.42rem",
                        letterSpacing: "0.1em",
                        px: 0.85,
                        py: 0.45,
                        borderRadius: "3px",
                        border: `1px solid ${
                            saveStatus === "error"
                                ? UI_COLORS.danger
                                : saveStatus === "saved"
                                    ? UI_COLORS.anomaly
                                    : UI_COLORS.border
                        }`,
                        color: saveStatus === "error"
                            ? UI_COLORS.danger
                            : saveStatus === "saved"
                                ? UI_COLORS.anomaly
                                : UI_COLORS.textSecondary,
                        bgcolor: saveStatus === "error"
                            ? `${UI_COLORS.danger}14`
                            : saveStatus === "saved"
                                ? `${UI_COLORS.anomaly}12`
                                : "rgba(0,0,0,0.35)",
                        whiteSpace: "nowrap",
                        minWidth: 72,
                        textAlign: "center",
                        flexShrink: 0,
                        opacity: saveStatus !== "idle" ? 1 : 0,
                        visibility: saveStatus !== "idle" ? "visible" : "hidden",
                        transition: "opacity 0.15s ease",
                    }}
                    title={saveStatus === "error" ? "Error al guardar" : undefined}
                >
                    {saveStatus === "pending" && "…"}
                    {saveStatus === "saving" && "GUARDANDO"}
                    {saveStatus === "saved" && "GUARDADO"}
                    {saveStatus === "error" && "ERROR"}
                    {saveStatus === "idle" && "\u00a0"}
                </Box>
                {!popupMode && (
                    <>
                        <Box
                            component="button"
                            type="button"
                            title="Minimizar"
                            onClick={handleToggleMinimize}
                            sx={{
                                width: 28, height: 28,
                                border: `1px solid ${UI_COLORS.border}`,
                                borderRadius: "4px",
                                background: "transparent",
                                color: UI_COLORS.accent,
                                cursor: "pointer",
                                display: "grid",
                                placeItems: "center",
                                "&:hover": { bgcolor: `${UI_COLORS.accent}22` },
                            }}
                        >
                            <MinimizeIcon sx={{ fontSize: "0.75rem" }} />
                        </Box>
                        {!isPopped && (
                            <Box
                                component="button"
                                type="button"
                                title="Popout"
                                onClick={handlePopout}
                                sx={{
                                    width: 28, height: 28,
                                    border: `1px solid ${UI_COLORS.border}`,
                                    borderRadius: "4px",
                                    background: "transparent",
                                    color: UI_COLORS.textSecondary,
                                    cursor: "pointer",
                                    display: "grid",
                                    placeItems: "center",
                                    "&:hover": { color: UI_COLORS.textPrimary },
                                }}
                            >
                                <OpenInNewIcon sx={{ fontSize: "0.75rem" }} />
                            </Box>
                        )}
                        <Box
                            component="button"
                            type="button"
                            title="Cerrar"
                            onClick={attemptClose}
                            sx={{
                                width: 28, height: 28,
                                border: `1px solid ${UI_COLORS.border}`,
                                borderRadius: "4px",
                                background: "transparent",
                                color: UI_COLORS.accent,
                                cursor: "pointer",
                                display: "grid",
                                placeItems: "center",
                                "&:hover": { bgcolor: `${UI_COLORS.accent}22` },
                            }}
                        >
                            <CloseIcon sx={{ fontSize: "0.75rem" }} />
                        </Box>
                    </>
                )}
                {popupMode && (
                    <Box
                        component="button"
                        type="button"
                        onClick={() => requestLeave("close")}
                        sx={{
                            width: 28, height: 28,
                            border: `1px solid ${UI_COLORS.border}`,
                            borderRadius: "4px",
                            background: "transparent",
                            color: UI_COLORS.accent,
                            cursor: "pointer",
                            display: "grid",
                            placeItems: "center",
                            "&:hover": { bgcolor: `${UI_COLORS.accent}22` },
                        }}
                    >
                        <CloseIcon sx={{ fontSize: "0.75rem" }} />
                    </Box>
                )}
            </Box>
        </Box>
    );

    const dossierCtx = useMemo(() => ({
        editMode,
        dirty,
        draft,
        saveStatus,
        spawnPing,
        patchDraft,
        saveDraft,
        flushSave,
        requestToggleEdit,
    }), [editMode, dirty, draft, saveStatus, spawnPing, patchDraft, saveDraft, flushSave, requestToggleEdit]);

    /* ── Body ─────────────────────────────────────────────────────── */
    const sheetBody = (
        <DossierContext.Provider value={dossierCtx}>
            <CharacterSheetBody
                character={viewCharacter}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                kitView={kitView}
                onKitViewChange={setKitView}
                initialMaletinOpen={Boolean(sheetFocus?.openMaletin) || isMaletinIntent(sheetFocus?.tab)}
                statDefinitions={statDefinitions}
                maxStat={4}
                wikiEntities={campaignWikiEntities}
                avatarSize={popupMode
                    ? CHARACTER_SHEET_TOKENS.avatarSize.popup
                    : CHARACTER_SHEET_TOKENS.avatarSize.dialog}
            />
        </DossierContext.Provider>
    );

    const leaveGuardUi = leaveGuard ? (
        <Box
            className="dialog-no-drag"
            sx={{
                position: "absolute",
                inset: 0,
                zIndex: 40,
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                bgcolor: "rgba(4,4,10,0.55)",
                p: 2,
                pointerEvents: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <Box
                sx={{
                    width: "min(420px, 100%)",
                    mb: 1,
                    p: "14px 16px",
                    borderRadius: "10px",
                    border: `1px solid ${UI_COLORS.accent}`,
                    bgcolor: "rgba(14,14,24,0.98)",
                    boxShadow: "0 0 28px rgba(255,102,255,0.25)",
                }}
            >
                <Box sx={{
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "0.68rem",
                    letterSpacing: "0.08em",
                    color: "#ffffff",
                    mb: 0.75,
                }}>
                    NO SE PUDO GUARDAR
                </Box>
                <Box sx={{
                    fontFamily: "Fira Sans, sans-serif",
                    fontSize: "0.82rem",
                    color: "#ffffff",
                    mb: 1.5,
                    lineHeight: 1.4,
                }}>
                    {SAVE_FAILED_MSG}
                </Box>
                <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", justifyContent: "flex-end" }}>
                    <Box
                        component="button"
                        type="button"
                        onClick={() => setLeaveGuard(null)}
                        sx={{
                            fontFamily: "Orbitron, sans-serif",
                            fontSize: "0.55rem",
                            letterSpacing: "0.1em",
                            px: 1.5,
                            py: 0.9,
                            borderRadius: "6px",
                            border: `1px solid ${UI_COLORS.border}`,
                            bgcolor: "transparent",
                            color: "#ffffff",
                            cursor: "pointer",
                            "&:hover": { borderColor: UI_COLORS.anomaly, color: "#ffffff" },
                        }}
                    >
                        SEGUIR EDITANDO
                    </Box>
                    <Box
                        component="button"
                        type="button"
                        disabled={saving}
                        onClick={async () => {
                            const action = leaveGuard;
                            const ok = await flushSave();
                            if (!ok || dirtyRef.current) return;
                            runLeaveAction(action);
                        }}
                        sx={{
                            fontFamily: "Orbitron, sans-serif",
                            fontSize: "0.55rem",
                            letterSpacing: "0.1em",
                            px: 1.5,
                            py: 0.9,
                            borderRadius: "6px",
                            border: `1px solid ${UI_COLORS.anomaly}`,
                            bgcolor: "rgba(0,242,234,0.12)",
                            color: "#ffffff",
                            cursor: saving ? "wait" : "pointer",
                            "&:hover": { bgcolor: "rgba(0,242,234,0.22)" },
                            "&:disabled": { opacity: 0.6 },
                        }}
                    >
                        REINTENTAR Y SALIR
                    </Box>
                    <Box
                        component="button"
                        type="button"
                        onClick={() => runLeaveAction(leaveGuard)}
                        sx={{
                            fontFamily: "Orbitron, sans-serif",
                            fontSize: "0.55rem",
                            letterSpacing: "0.1em",
                            px: 1.5,
                            py: 0.9,
                            borderRadius: "6px",
                            border: `1px solid ${UI_COLORS.accentStrong}`,
                            bgcolor: "rgba(255,51,85,0.12)",
                            color: "#ffffff",
                            cursor: "pointer",
                            "&:hover": { bgcolor: "rgba(255,51,85,0.22)" },
                        }}
                    >
                        DESCARTAR
                    </Box>
                </Box>
            </Box>
        </Box>
    ) : null;

    /* ── Ping overlay (fixed, global) ────────────────────────────── */
    const pingOverlay = (
        <div
            ref={pingLayerRef}
            style={{
                position: "fixed",
                inset: 0,
                pointerEvents: "none",
                zIndex: 9999,
            }}
        />
    );

    /* ── Popup mode ───────────────────────────────────────────────── */
    if (popupMode) {
        return (
            <>
                {pingOverlay}
                <Box sx={{ display: "flex", flexDirection: "column", width: "100vw", height: "100vh", bgcolor: "#0d0d14", color: "#fff", overflow: "hidden" }}>
                    {chrome}
                    <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>
                        {loading && !selectedCharacter ? (
                            <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
                                <CircularProgress />
                            </Box>
                        ) : sheetBody}
                        {leaveGuardUi}
                    </Box>
                </Box>
            </>
        );
    }

    // Keep mounted while open (even minimized) so dirty draft survives minimize/restore.
    if (!popupMode && !open) return null;

    return (
        <>
            {pingOverlay}
            <Dialog
                open={open && !isMinimized}
                onClose={handleDialogClose}
                fullWidth
                maxWidth={false}
                sx={{
                    "& .MuiDialog-container": {
                        alignItems: { xs: "flex-end", sm: "center" },
                    },
                }}
                PaperComponent={DraggableResizablePaper}
                PaperProps={{
                    dragKey: "max",
                    sx: {
                        pointerEvents: "auto",
                        bgcolor: "rgba(8,8,14,0.99)",
                        color: "#fff",
                        border: `1px solid rgba(255,102,255,0.3)`,
                        boxShadow: "0 0 48px rgba(255,102,255,0.1)",
                        display: "flex",
                        flexDirection: "column",
                        m: 0,
                        borderRadius: { xs: "12px 12px 0 0", sm: VTT_DIALOG_SIZE.xl.borderRadius },
                        height: { xs: "96vh", sm: VTT_DIALOG_SIZE.xl.height },
                        width: { xs: "100%", sm: VTT_DIALOG_SIZE.xl.width },
                        maxWidth: "100vw",
                        maxHeight: "100vh",
                        overflow: "hidden",
                        background: "linear-gradient(165deg, rgba(22,22,36,0.98), rgba(8,8,14,0.99))",
                        transition: "border 0.3s, box-shadow 0.3s",
                    },
                }}
            >
                {chrome}

                <DialogContent
                    className="dialog-no-drag"
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        p: 0,
                        flex: 1,
                        minHeight: 0,
                        overflow: "hidden",
                        position: "relative",
                    }}
                >
                    {loading && !selectedCharacter ? (
                        <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
                            <CircularProgress />
                        </Box>
                    ) : sheetBody}
                    {leaveGuardUi}
                </DialogContent>
            </Dialog>
        </>
    );
}
