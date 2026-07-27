import { useState, useEffect, useMemo, useRef, useCallback, createContext, useContext } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Dialog, DialogContent, Box, CircularProgress } from "@mui/material";
import MinimizeIcon from "@mui/icons-material/Remove";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import { fetchPlayerCharacters } from "../store/characterSlice";
import { UI_COLORS } from "../constants/uiColors";
import { DIALOG_IDS } from "../constants/dialogIds";
import { VTT_DIALOG_SIZE } from "../constants/vttHudTokens";
import { CHARACTER_SHEET_TOKENS } from "../constants/characterSheetTokens";
import useDialogActions from "../hooks/useDialogActions";
import { useStatSystem } from "../hooks/useStatSystem";
import { useCampaignWikiEntities } from "../hooks/useCampaignWikiEntities";
import DraggableResizablePaper from "./DraggableResizablePaper";
import usePopout from "../hooks/usePopout";
import CharacterSheetBody from "./characters/CharacterSheetBody";
import { SHEET_TABS, normalizeSheetTab } from "./characters/CharacterSheetTabs";

/* ── Dossier context (passed down to ID/KIT views) ────────────────── */
export const DossierContext = createContext({
    editMode: false,
    spawnPing: () => {},
});
export const useDossier = () => useContext(DossierContext);

/* ── Chrome color map (matches mockup exactly) ───────────────────── */
const TAB_COLORS = {
    IDENTIDAD: UI_COLORS.anomaly,      // #00f2ea cyan
    KIT:       UI_COLORS.anomaly,
    MESH:      UI_COLORS.accent,       // #ff66ff pink
};

/**
 * Player dossier for the HUD-active character — Holodeck shell.
 * Chrome: tabs (ID / KIT / MESH) left, character name centred, READ/EDIT + controls right.
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
    const [editMode, setEditMode] = useState(false);

    const { isMinimized, toggleMinimize, forceMinimize } = useDialogActions(DIALOG_IDS.SHEET);
    const { isPopped, popout } = usePopout("characters");

    /* ── Ping overlay ref ─────────────────────────────────────────── */
    const pingLayerRef = useRef(null);

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
        if (fromList) return fromList;
        const fromWorld = worldChars[activeCharacterId];
        if (fromWorld) return { id: activeCharacterId, ...fromWorld };
        return null;
    }, [activeCharacterId, characters, worldChars]);

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

    /* ── Tab change resets editMode ───────────────────────────────── */
    const handleTabChange = (tabId) => {
        const next = normalizeSheetTab(tabId);
        setActiveTab(next);
        if (next === "MESH") setEditMode(false);
    };

    const handleToggleMinimize = (e) => { e.stopPropagation(); toggleMinimize(); };
    const handleDialogClose = (event, reason) => {
        if (reason === "backdropClick") { forceMinimize(); return; }
        onClose();
    };
    const handlePopout = (e) => { e.stopPropagation(); popout(); onClose(); };

    const campaignForRules = selectedCharacter?.campaignId || profile?.currentCampaignId;
    const { stats: statDefinitions } = useStatSystem(open || popupMode ? campaignForRules : null);
    const campaignWikiEntities = useCampaignWikiEntities(open || popupMode ? campaignForRules : null);

    const charName = selectedCharacter?.name?.toUpperCase() || "DOSSIER";

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

    const activeColor = TAB_COLORS[activeTab] || UI_COLORS.anomaly;

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
                                color: on ? tabColor : UI_COLORS.textSecondary,
                                cursor: "pointer",
                                fontFamily: '"Fira Code", monospace',
                                fontSize: "0.5rem",
                                letterSpacing: "0.1em",
                                px: "12px",
                                py: "7px",
                                borderRadius: "6px",
                                transition: "color 0.15s, background 0.15s",
                                "&:hover": {
                                    color: UI_COLORS.textPrimary,
                                    bgcolor: "rgba(255,255,255,0.04)",
                                },
                                ...(isMesh && on
                                    ? { color: UI_COLORS.accent, bgcolor: `${UI_COLORS.accent}22` }
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

            {/* CENTER — character name */}
            <Box
                sx={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "0.62rem",
                    letterSpacing: "0.16em",
                    color: UI_COLORS.accent,
                    textAlign: "center",
                    pointerEvents: "none",
                    whiteSpace: "nowrap",
                    textShadow: "0 0 12px rgba(255,102,255,0.35)",
                    maxWidth: "min(42vw, 360px)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                }}
            >
                {charName}
            </Box>

            {/* RIGHT — READ/EDIT + window controls */}
            <Box sx={{ display: "flex", alignItems: "center", gap: "6px", zIndex: 1 }} className="dialog-no-drag">
                {/* READ / EDIT toggle — hidden in MESH tab */}
                {activeTab !== "MESH" && (
                    <Box
                        sx={{
                            display: "flex",
                            borderRadius: "6px",
                            overflow: "hidden",
                            border: `1px solid ${UI_COLORS.border}`,
                            mr: "4px",
                        }}
                    >
                        {["READ", "EDIT"].map((mode) => {
                            const on = (editMode ? "EDIT" : "READ") === mode;
                            return (
                                <Box
                                    key={mode}
                                    component="button"
                                    type="button"
                                    onClick={() => setEditMode(mode === "EDIT")}
                                    sx={{
                                        border: "none",
                                        background: "transparent",
                                        color: on
                                            ? mode === "EDIT"
                                                ? UI_COLORS.accent
                                                : UI_COLORS.anomaly
                                            : UI_COLORS.textSecondary,
                                        bgcolor: on && mode === "EDIT"
                                            ? `${UI_COLORS.accent}1e`
                                            : "transparent",
                                        cursor: "pointer",
                                        fontFamily: "Orbitron, sans-serif",
                                        fontSize: "0.4rem",
                                        letterSpacing: "0.08em",
                                        px: "9px",
                                        py: "6px",
                                        transition: "color 0.15s, background 0.15s",
                                    }}
                                >
                                    {mode}
                                </Box>
                            );
                        })}
                    </Box>
                )}

                {/* Window controls */}
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
                            onClick={onClose}
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
                        onClick={() => window.close()}
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

    /* ── Body ─────────────────────────────────────────────────────── */
    const sheetBody = (
        <DossierContext.Provider value={{ editMode, spawnPing }}>
            <CharacterSheetBody
                character={selectedCharacter}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                kitView={kitView}
                onKitViewChange={setKitView}
                statDefinitions={statDefinitions}
                maxStat={6}
                wikiEntities={campaignWikiEntities}
                avatarSize={popupMode
                    ? CHARACTER_SHEET_TOKENS.avatarSize.popup
                    : CHARACTER_SHEET_TOKENS.avatarSize.dialog}
            />
        </DossierContext.Provider>
    );

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
                    </Box>
                </Box>
            </>
        );
    }

    if (!popupMode && (!open || isMinimized)) return null;

    return (
        <>
            {pingOverlay}
            <Dialog
                open={open}
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
                </DialogContent>
            </Dialog>
        </>
    );
}
