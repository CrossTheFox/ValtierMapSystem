import { useState, useEffect, useMemo, useRef, useCallback, createContext, useContext } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Dialog, DialogContent, Box, CircularProgress } from "@mui/material";
import MinimizeIcon from "@mui/icons-material/Remove";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import { fetchPlayerCharacters, updateCharacterInList } from "../store/characterSlice";
import { updateCharacterInState } from "../store/worldSlice";
import { UI_COLORS } from "../constants/uiColors";
import { DIALOG_IDS } from "../constants/dialogIds";
import { VTT_DIALOG_SIZE } from "../constants/vttHudTokens";
import { CHARACTER_SHEET_TOKENS } from "../constants/characterSheetTokens";
import { resolveCharacterAp, resolveCharacterLevel } from "../constants/skillTreeProgression";
import useDialogActions from "../hooks/useDialogActions";
import { useStatSystem } from "../hooks/useStatSystem";
import { useCampaignWikiEntities } from "../hooks/useCampaignWikiEntities";
import { updateCharacterFields } from "../../firebase/services/characterService";
import DraggableResizablePaper from "./DraggableResizablePaper";
import usePopout from "../hooks/usePopout";
import CharacterSheetBody from "./characters/CharacterSheetBody";
import { SHEET_TABS, normalizeSheetTab } from "./characters/CharacterSheetTabs";

/* ── Dossier context (passed down to ID/KIT views) ────────────────── */
export const DossierContext = createContext({
    editMode: true,
    dirty: false,
    draft: null,
    spawnPing: () => {},
    patchDraft: () => {},
    requestToggleEdit: () => {},
});
export const useDossier = () => useContext(DossierContext);

/* ── Chrome color map (matches mockup exactly) ───────────────────── */
const TAB_COLORS = {
    IDENTIDAD: UI_COLORS.anomaly,      // #00f2ea cyan
    KIT:       UI_COLORS.anomaly,
    MESH:      UI_COLORS.accent,       // #ff66ff pink
};

const UNSAVED_MSG = "Hay cambios sin guardar. Si cierras ahora se perderán.";

/**
 * Player dossier for the HUD-active character — Holodeck shell.
 * Chrome: tabs (ID / KIT / MESH) left, character name + level centred, controls right.
 * Always click-to-edit; GUARDAR FAB appears only when there are uncommitted changes.
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
    /** In-dialog leave guard — avoids unreliable window.confirm under MUI focus trap. */
    const [leaveGuard, setLeaveGuard] = useState(null); // 'close' | 'mesh' | 'popout' | 'backdrop'

    const { isMinimized, toggleMinimize, forceMinimize } = useDialogActions(DIALOG_IDS.SHEET);
    const { isPopped, popout } = usePopout("characters");

    /* ── Ping overlay ref ─────────────────────────────────────────── */
    const pingLayerRef = useRef(null);
    const dirtyRef = useRef(false);
    dirtyRef.current = dirty;

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

    const selectedCharacter = useMemo(() => {
        if (!activeCharacterId) return null;
        const fromList = characters.find((c) => c.id === activeCharacterId);
        const fromWorld = worldChars[activeCharacterId];
        if (fromList && fromWorld) {
            // Sheet doc is richer for bio/banner; world may have fresher placement/token.
            // Don't let a missing media key on one source wipe the other.
            return {
                ...fromWorld,
                ...fromList,
                id: activeCharacterId,
                bannerUrl: fromList.bannerUrl ?? fromWorld.bannerUrl ?? null,
                imageUrl: fromList.imageUrl ?? fromWorld.imageUrl ?? null,
                tokenImageUrl: fromList.tokenImageUrl ?? fromWorld.tokenImageUrl ?? null,
                ap: fromList.ap ?? fromWorld.ap ?? 0,
                level: fromList.level ?? fromWorld.level ?? 0,
            };
        }
        if (fromList) return fromList;
        if (fromWorld) return { id: activeCharacterId, ...fromWorld };
        return null;
    }, [activeCharacterId, characters, worldChars]);

    /** Character as shown in the sheet (live doc + uncommitted draft). */
    const viewCharacter = useMemo(() => {
        if (!selectedCharacter) return null;
        if (!draft) return selectedCharacter;
        return {
            ...selectedCharacter,
            ...draft,
            bond: { ...(selectedCharacter.bond || {}), ...(draft.bond || {}) },
            stats: { ...(selectedCharacter.stats || {}), ...(draft.stats || {}) },
            bondPowers: draft.bondPowers ?? selectedCharacter.bondPowers,
            narrativeShortcuts: draft.narrativeShortcuts ?? selectedCharacter.narrativeShortcuts,
            bannerUrl: draft.bannerUrl ?? selectedCharacter.bannerUrl ?? null,
            imageUrl: draft.imageUrl ?? selectedCharacter.imageUrl ?? null,
            tokenImageUrl: draft.tokenImageUrl ?? selectedCharacter.tokenImageUrl ?? null,
            ap: draft.ap ?? selectedCharacter.ap ?? 0,
            level: draft.level ?? selectedCharacter.level ?? 0,
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
        setDraft(null);
        setDirty(false);
        setLeaveGuard(null);
    }, [activeCharacterId]);

    /* Reset draft when sheet fully closes (keeps state while minimized). */
    useEffect(() => {
        if (open || popupMode) return;
        setDraft(null);
        setDirty(false);
        setLeaveGuard(null);
    }, [open, popupMode]);

    const patchDraft = useCallback((partial) => {
        setDraft((prev) => {
            const base = prev || {};
            const next = { ...base, ...partial };
            if (partial.bond) {
                next.bond = { ...(base.bond || {}), ...partial.bond };
            }
            if (partial.stats) {
                next.stats = { ...(base.stats || {}), ...partial.stats };
            }
            return next;
        });
        setDirty(true);
    }, []);

    const discardDraft = useCallback(() => {
        setDraft(null);
        setDirty(false);
        setLeaveGuard(null);
    }, []);

    const saveDraft = useCallback(async () => {
        if (!selectedCharacter?.id || !draft || !dirty) return false;
        setSaving(true);
        try {
            const payload = {};
            const reduxPatch = {};
            if (draft.name != null) {
                payload.name = draft.name;
                reduxPatch.name = draft.name;
            }
            if (draft.bannerUrl !== undefined) {
                payload.bannerUrl = draft.bannerUrl;
                reduxPatch.bannerUrl = draft.bannerUrl;
            }
            if (draft.imageUrl !== undefined) {
                payload.imageUrl = draft.imageUrl;
                reduxPatch.imageUrl = draft.imageUrl;
            }
            if (draft.tokenImageUrl !== undefined) {
                payload.tokenImageUrl = draft.tokenImageUrl;
                reduxPatch.tokenImageUrl = draft.tokenImageUrl;
            }
            if (draft.stats) {
                Object.entries(draft.stats).forEach(([k, v]) => {
                    payload[`stats.${k}`] = v;
                });
                reduxPatch.stats = { ...(selectedCharacter.stats || {}), ...draft.stats };
            }
            if (draft.bond) {
                Object.entries(draft.bond).forEach(([k, v]) => {
                    payload[`bond.${k}`] = v;
                });
                reduxPatch.bond = { ...(selectedCharacter.bond || {}), ...draft.bond };
            }
            if (draft.bondPowers !== undefined) {
                payload.bondPowers = draft.bondPowers;
                reduxPatch.bondPowers = draft.bondPowers;
            }
            if (draft.narrativeShortcuts !== undefined) {
                payload.narrativeShortcuts = draft.narrativeShortcuts;
                reduxPatch.narrativeShortcuts = draft.narrativeShortcuts;
            }
            if (draft.assignedClassIds !== undefined) {
                payload.assignedClassIds = draft.assignedClassIds;
                reduxPatch.assignedClassIds = draft.assignedClassIds;
            }
            if (draft.activeClassId !== undefined) {
                payload.activeClassId = draft.activeClassId;
                reduxPatch.activeClassId = draft.activeClassId;
            }
            if (draft.combatOverrides !== undefined) {
                payload.combatOverrides = draft.combatOverrides;
                reduxPatch.combatOverrides = draft.combatOverrides;
            }
            if (draft.vit !== undefined) {
                payload.vit = draft.vit;
                reduxPatch.vit = draft.vit;
            }
            if (draft.level !== undefined) {
                payload.level = draft.level;
                reduxPatch.level = draft.level;
            }
            if (draft.ap !== undefined) {
                payload.ap = draft.ap;
                reduxPatch.ap = draft.ap;
            }
            if (draft.jobResources !== undefined) {
                payload.jobResources = draft.jobResources;
                reduxPatch.jobResources = draft.jobResources;
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
            setDraft(null);
            setDirty(false);
            setLeaveGuard(null);
            return true;
        } catch (err) {
            console.error("[Dossier] save:", err);
            return false;
        } finally {
            setSaving(false);
        }
    }, [selectedCharacter, draft, dirty, dispatch]);

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

    const requestLeave = useCallback((action) => {
        if (dirtyRef.current) {
            setLeaveGuard(action);
            return;
        }
        runLeaveAction(action);
    }, [runLeaveAction]);

    const requestToggleEdit = useCallback(() => {
        /* no-op: dossier is always editable; GUARDAR appears when dirty */
    }, []);

    const handleTabChange = (tabId) => {
        const next = normalizeSheetTab(tabId);
        if (next === "MESH" && dirtyRef.current) {
            requestLeave("mesh");
            return;
        }
        setActiveTab(next);
    };

    const handleToggleMinimize = (e) => { e.stopPropagation(); toggleMinimize(); };

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
            {/* LEFT — tabs */}
            <Box sx={{ display: "flex", alignItems: "center", gap: "2px", zIndex: 1 }}>
                {SHEET_TABS.map((tab) => {
                    const on = activeTab === tab.id;
                    const isMesh = tab.id === "MESH";
                    const tabColor = TAB_COLORS[tab.id];
                    return (
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
                                ...(isMesh && on
                                    ? { color: "#ffffff", bgcolor: `${UI_COLORS.accent}22` }
                                    : {}),
                            }}
                        >
                            {tab.id === "IDENTIDAD" ? "▣ ID"
                                : tab.id === "KIT" ? "⚙ KIT"
                                : "◈ MESH"}
                        </Box>
                    );
                })}
            </Box>

            {/* CENTER — character name + LV + AP (always editable) */}
            {activeTab !== "MESH" ? (
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
                    <Box
                        component="input"
                        value={viewCharacter?.name ?? ""}
                        onChange={(e) => patchDraft({ name: e.target.value })}
                        placeholder="NOMBRE"
                        sx={{
                            fontFamily: "Orbitron, sans-serif",
                            fontSize: "0.78rem",
                            letterSpacing: "0.16em",
                            color: "#ffffff",
                            textAlign: "center",
                            textTransform: "uppercase",
                            bgcolor: "rgba(0,0,0,0.45)",
                            border: `1px solid ${dirty ? UI_COLORS.accent : UI_COLORS.border}`,
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

            {/* RIGHT — window controls */}
            <Box sx={{ display: "flex", alignItems: "center", gap: "6px", zIndex: 1 }} className="dialog-no-drag">
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
                        onClick={() => {
                            if (dirtyRef.current) {
                                setLeaveGuard("close");
                                return;
                            }
                            window.close();
                        }}
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
        spawnPing,
        patchDraft,
        requestToggleEdit,
    }), [editMode, dirty, draft, spawnPing, patchDraft, requestToggleEdit]);

    /* ── Body ─────────────────────────────────────────────────────── */
    const sheetBody = (
        <DossierContext.Provider value={dossierCtx}>
            <CharacterSheetBody
                character={viewCharacter}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                kitView={kitView}
                onKitViewChange={setKitView}
                statDefinitions={statDefinitions}
                maxStat={4}
                wikiEntities={campaignWikiEntities}
                avatarSize={popupMode
                    ? CHARACTER_SHEET_TOKENS.avatarSize.popup
                    : CHARACTER_SHEET_TOKENS.avatarSize.dialog}
            />
        </DossierContext.Provider>
    );

    const saveFab = dirty && activeTab !== "MESH" ? (
        <Box
            component="button"
            type="button"
            className="dialog-no-drag"
            disabled={saving}
            onClick={saveDraft}
            sx={{
                position: "absolute",
                right: 18,
                bottom: 18,
                zIndex: 20,
                fontFamily: "Orbitron, sans-serif",
                fontSize: "0.62rem",
                letterSpacing: "0.14em",
                px: 2.2,
                py: 1.1,
                borderRadius: "8px",
                cursor: saving ? "wait" : "pointer",
                border: `1px solid ${UI_COLORS.accent}`,
                bgcolor: "rgba(255,102,255,0.22)",
                color: "#ffffff",
                boxShadow: "0 0 24px rgba(255,102,255,0.35)",
                backdropFilter: "blur(10px)",
                "&:hover": { bgcolor: "rgba(255,102,255,0.35)" },
                "&:disabled": { opacity: 0.6 },
            }}
        >
            {saving ? "GUARDANDO…" : "GUARDAR"}
        </Box>
    ) : null;

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
                    CAMBIOS SIN GUARDAR
                </Box>
                <Box sx={{
                    fontFamily: "Fira Sans, sans-serif",
                    fontSize: "0.82rem",
                    color: "#ffffff",
                    mb: 1.5,
                    lineHeight: 1.4,
                }}>
                    {UNSAVED_MSG}
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
                            const ok = await saveDraft();
                            if (!ok) return;
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
                        GUARDAR Y SALIR
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
                        {saveFab}
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
                        height: { xs: "92vh", sm: VTT_DIALOG_SIZE.xl.height },
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
                    {saveFab}
                    {leaveGuardUi}
                </DialogContent>
            </Dialog>
        </>
    );
}
