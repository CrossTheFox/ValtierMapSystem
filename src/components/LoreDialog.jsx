import React, { useState, useMemo, useEffect } from "react";
import FilterListIcon from "@mui/icons-material/FilterList";
import { Dialog, DialogContent, Box } from "@mui/material";
import ReactMarkdown    from "react-markdown";

import { CyberTitle, CyberText }   from "./customs/CustomTexts";
import { UI_COLORS }               from "../constants/uiColors";
import { RENDER_LAYERS }           from "../constants/renderLayers";
import AnimatedTypewriterText      from "./animations/AnimatedTypewriterText";
import DraggableResizablePaper     from "./DraggableResizablePaper";
import usePopout                   from "../hooks/usePopout";
import {
    VttDialogHeaderControls,
    getVttDialogPopupHeaderSx,
    getVttDialogTitleSx,
} from "./VttDialogHeader";
import VttDialogHeaderBar from "./VttDialogHeaderBar";
import CyberTooltip from "./customs/CyberTooltip";

import { useDispatch, useSelector }                        from "react-redux";
import { setSelectedLore, closeDialog } from "../store/uiSlice";
import { DIALOG_IDS } from "../constants/dialogIds";
import useDialogActions from "../hooks/useDialogActions";

const MarkdownComponents = {
    p:  ({ children }) => <Box sx={{ mb: 2 }}><AnimatedTypewriterText text={children} duration={1000} /></Box>,
    h1: ({ children }) => <CyberTitle sx={{ mb: 2, fontSize: "1.8rem" }}>{children}</CyberTitle>,
    h2: ({ children }) => <CyberTitle sx={{ mb: 1, fontSize: "1.4rem", color: UI_COLORS.accent }}>{children}</CyberTitle>,
    li: ({ children }) => <Box component="li" sx={{ mb: 1 }}><CyberText sx={{ display: "list-item" }}>{children}</CyberText></Box>,
};

const scrollbarSx = {
    "&::-webkit-scrollbar":       { width: "8px" },
    "&::-webkit-scrollbar-track": { background: "#0d0d14" },
    "&::-webkit-scrollbar-thumb": { backgroundColor: `${UI_COLORS.accent}88`, borderRadius: "4px" },
};

// ── Compact category filter (header left) ─────────────────────────────────
function LoreCategoryNav({ categories, value, onChange }) {
    if (categories.length <= 1) return null;

    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.35,
                flexWrap: "nowrap",
                overflowX: "auto",
                maxWidth: "100%",
                "&::-webkit-scrollbar": { display: "none" },
                scrollbarWidth: "none",
            }}
        >
            {categories.map((cat) => {
                const active = value === cat;
                const label = cat === "ALL" ? "Todas las categorías" : cat;
                return (
                    <CyberTooltip key={cat} title={label} placement="bottom">
                        <Box
                            component="button"
                            type="button"
                            onClick={() => onChange(cat)}
                            aria-label={label}
                            aria-current={active ? "true" : undefined}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: 28,
                                height: 28,
                                flexShrink: 0,
                                p: 0,
                                border: `1px solid ${active ? UI_COLORS.anomaly : UI_COLORS.border}`,
                                borderRadius: 0.75,
                                bgcolor: active ? `${UI_COLORS.anomaly}18` : "transparent",
                                color: active ? UI_COLORS.anomaly : UI_COLORS.textSecondary,
                                cursor: "pointer",
                                fontFamily: "'Fira Code', monospace",
                                fontSize: "0.52rem",
                                letterSpacing: "0.06em",
                                transition: "border-color 0.15s, color 0.15s, background-color 0.15s",
                                "&:hover": {
                                    borderColor: UI_COLORS.anomaly,
                                    color: UI_COLORS.anomaly,
                                    bgcolor: `${UI_COLORS.anomaly}10`,
                                },
                            }}
                        >
                            {cat === "ALL" ? (
                                <FilterListIcon sx={{ fontSize: "0.9rem" }} />
                            ) : (
                                cat.slice(0, 3).toUpperCase()
                            )}
                        </Box>
                    </CyberTooltip>
                );
            })}
        </Box>
    );
}

// ── Sidebar entry ─────────────────────────────────────────────────────────
function LoreEntry({ entry, isActive, onClick }) {
    const date = useMemo(() => {
        if (!entry.created_at) return null;
        try {
            const d = entry.created_at?.toDate
                ? entry.created_at.toDate()
                : new Date(entry.created_at);
            return d.toLocaleDateString();
        } catch {
            return null;
        }
    }, [entry.created_at]);

    return (
        <Box
            onClick={onClick}
            sx={{
                px: 1.5,
                py: 1.1,
                cursor: "pointer",
                borderLeft: `3px solid ${isActive ? UI_COLORS.anomaly : "transparent"}`,
                bgcolor: isActive ? `${UI_COLORS.anomaly}0f` : "transparent",
                borderBottom: `1px solid rgba(42,42,61,0.4)`,
                transition: "background-color 0.15s",
                "&:hover": { bgcolor: "rgba(255,255,255,0.03)" },
            }}
        >
            <CyberTitle
                sx={{
                    fontSize: "0.65rem",
                    letterSpacing: "0.06em",
                    color: isActive ? UI_COLORS.anomaly : "#fff",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                }}
            >
                {entry.title || entry.name || "Sin título"}
            </CyberTitle>
            <Box
                sx={{
                    fontFamily: "'Fira Code', monospace",
                    fontSize: "0.55rem",
                    color: UI_COLORS.textSecondary,
                    mt: 0.25,
                }}
            >
                {entry.category ? `${entry.category.toUpperCase()} · ` : ""}{date || ""}
            </Box>
        </Box>
    );
}

// ── Main component ────────────────────────────────────────────────────────
export default function LoreDialog({ popupMode = false }) {
    const dispatch = useDispatch();
    const { selectedLore, openDialogs } = useSelector((state) => state.ui);
    const dialogId = selectedLore ? DIALOG_IDS.LORE : DIALOG_IDS.LORE_BROWSER;
    const { isMinimized, toggleMinimize, forceMinimize } = useDialogActions(dialogId);
    const wikiEntities = useSelector((s) => s.wiki?.entities ?? []);

    const [categoryFilter, setCategoryFilter] = useState("ALL");
    const [localSelected, setLocalSelected] = useState(null);
    const { isPopped, popout } = usePopout("lore");

    const loreBrowserOpen = openDialogs?.loreBrowser ?? false;

    // Chronicle entities from wiki + legacy lore entries
    const loreEntries = useMemo(() => {
        const fromWiki = wikiEntities.filter(
            (e) => e.entityType === "cronica" || e.entityType === "chronicle"
        );
        return fromWiki;
    }, [wikiEntities]);

    // Unique categories
    const categories = useMemo(() => {
        const cats = new Set(loreEntries.map((e) => e.category).filter(Boolean));
        return ["ALL", ...cats];
    }, [loreEntries]);

    // Filtered list
    const filteredEntries = useMemo(() => {
        if (categoryFilter === "ALL") return loreEntries;
        return loreEntries.filter((e) => e.category === categoryFilter);
    }, [loreEntries, categoryFilter]);

    // Active entry: selectedLore (from redux) takes priority, else localSelected
    const activeEntry = selectedLore || localSelected;

    // Auto-select first entry when opening in browse mode without a selectedLore
    useEffect(() => {
        if (loreBrowserOpen && !selectedLore && !localSelected && filteredEntries.length > 0) {
            setLocalSelected(filteredEntries[0]);
        }
    }, [loreBrowserOpen, selectedLore, localSelected, filteredEntries]);

    const isOpen = !!selectedLore || loreBrowserOpen;
    if (!isOpen) return null;

    const accent = UI_COLORS.accent;

    const handleClose = () => {
        dispatch(setSelectedLore(null));
        dispatch(closeDialog("loreBrowser"));
        setLocalSelected(null);
    };

    const handleToggleMinimize = (e) => {
        e.stopPropagation();
        toggleMinimize();
    };

    const handleDialogClose = (event, reason) => {
        if (reason === "backdropClick") {
            forceMinimize();
            return;
        }
        handleClose();
    };

    const handlePopout = (e) => {
        e.stopPropagation();
        if (activeEntry) popout(activeEntry);
        handleClose();
    };

    const formattedDate = activeEntry?.created_at
        ? (() => {
            try {
                return activeEntry.created_at?.toDate
                    ? activeEntry.created_at.toDate().toLocaleDateString()
                    : new Date(activeEntry.created_at).toLocaleDateString();
            } catch { return ""; }
        })()
        : "";

    const loreSubtitle = activeEntry
        ? `${activeEntry.title || ""}${formattedDate ? ` · ${formattedDate}` : ""}`
        : null;

    const headerButtons = (
        <VttDialogHeaderControls
            isMinimized={isMinimized}
            onToggleMinimize={handleToggleMinimize}
            onClose={popupMode ? () => window.close() : handleClose}
            isPopped={isPopped}
            onPopout={handlePopout}
            popoutDisabled={!activeEntry}
            popupMode={popupMode}
            accent={accent}
        />
    );

    const loreTitleBlock = (
        <Box sx={{ textAlign: "center", maxWidth: "100%" }}>
            <CyberTitle sx={getVttDialogTitleSx()}>
                CHRONICLE
            </CyberTitle>
            {loreSubtitle && (
                <Box
                    sx={{
                        fontFamily: "'Fira Code', monospace",
                        fontSize: "7px",
                        color: UI_COLORS.textSecondary,
                        letterSpacing: "0.06em",
                        mt: 0.25,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: { xs: 180, sm: 320 },
                    }}
                >
                    {loreSubtitle}
                </Box>
            )}
        </Box>
    );

    const categoryNav = categories.length > 1 ? (
        <LoreCategoryNav
            categories={categories}
            value={categoryFilter}
            onChange={setCategoryFilter}
        />
    ) : null;

    /* ── POPUP MODE ── */
    if (popupMode) {
        return (
            <Box sx={{ display: "flex", flexDirection: "column", width: "100vw", height: "100vh", bgcolor: "#0d0d14", color: "#fff" }}>
                <Box sx={{ ...getVttDialogPopupHeaderSx(), flexDirection: "column", gap: 0.375 }}>
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: "1fr auto 1fr",
                            alignItems: "center",
                            width: "100%",
                            gap: 0.75,
                        }}
                    >
                        <Box sx={{ display: "flex", justifyContent: "flex-start", minWidth: 0 }}>
                            {categoryNav}
                        </Box>
                        <Box sx={{ textAlign: "center", minWidth: 0 }}>
                            <CyberTitle sx={getVttDialogTitleSx()}>
                                {activeEntry?.title || "CHRONICLE"}
                            </CyberTitle>
                            {formattedDate && (
                                <Box sx={{ fontFamily: "'Fira Code', monospace", fontSize: "7px", color: UI_COLORS.textSecondary, mt: 0.25 }}>
                                    {formattedDate}
                                </Box>
                            )}
                        </Box>
                        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>{headerButtons}</Box>
                    </Box>
                </Box>
                <Box sx={{ flexGrow: 1, overflow: "auto", p: 4, ...scrollbarSx }}>
                    {activeEntry
                        ? <ReactMarkdown components={MarkdownComponents}>{activeEntry.body || activeEntry.content || activeEntry.description || ""}</ReactMarkdown>
                        : <CyberText sx={{ opacity: 0.4 }}>// Sin entrada seleccionada</CyberText>
                    }
                </Box>
            </Box>
        );
    }

    if (isMinimized) return null;

    return (
        <Dialog
            open={isOpen}
            onClose={handleDialogClose}
            fullWidth
            maxWidth={false}
            sx={{
                zIndex: RENDER_LAYERS.DIALOG,
                "& .MuiDialog-container": {
                    alignItems: { xs: "flex-end", sm: "center" },
                },
            }}
            PaperComponent={DraggableResizablePaper}
            PaperProps={{
                dragKey: "max",
                sx: {
                    pointerEvents: "auto",
                    backgroundColor: "#12121a",
                    color: "#fff",
                    borderRadius: { xs: "12px 12px 0 0", sm: 3 },
                    boxShadow: "0 0 40px rgba(0,0,0,0.8)",
                    border: "1px solid #2a2a3d",
                    m: 0,
                    height: { xs: "90vh", sm: "min(92vh, 100%)" },
                    width: { xs: "100%", sm: "min(97vw, 100%)" },
                    maxWidth: "none",
                    minWidth: { xs: "unset", sm: "400px" },
                    display: "flex",
                    flexDirection: "column",
                },
            }}
        >
            <VttDialogHeaderBar
                left={categoryNav}
                center={loreTitleBlock}
                right={headerButtons}
            />

            <Box
                className="dialog-no-drag"
                sx={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}
            >
                    {/* Left sidebar */}
                    <Box
                        sx={{
                            width: 260,
                            flexShrink: 0,
                            borderRight: "1px solid #2a2a3d",
                            bgcolor: "#1a1a2a",
                            display: "flex",
                            flexDirection: "column",
                            overflow: "hidden",
                        }}
                    >
                        {/* Entry list */}
                        <Box sx={{ flex: 1, overflow: "auto", ...scrollbarSx }}>
                            {filteredEntries.length === 0 ? (
                                <CyberText
                                    sx={{
                                        p: 2,
                                        fontSize: "0.65rem",
                                        color: UI_COLORS.textSecondary,
                                        opacity: 0.5,
                                        fontFamily: "'Fira Code', monospace",
                                    }}
                                >
                                    // Sin entradas
                                </CyberText>
                            ) : (
                                filteredEntries.map((entry) => (
                                    <LoreEntry
                                        key={entry.id || entry.title}
                                        entry={entry}
                                        isActive={activeEntry?.id === entry.id || activeEntry?.title === entry.title}
                                        onClick={() => {
                                            setLocalSelected(entry);
                                            dispatch(setSelectedLore(entry));
                                        }}
                                    />
                                ))
                            )}
                        </Box>
                    </Box>

                    {/* Right content area */}
                    <DialogContent
                        sx={{ flex: 1, p: 4, bgcolor: "#0d0d14", ...scrollbarSx, overflow: "auto" }}
                    >
                            {activeEntry ? (
                                <>
                                    <Box
                                        sx={{
                                            fontFamily: "'Fira Code', monospace",
                                            fontSize: "0.6rem",
                                            color: UI_COLORS.anomaly,
                                            mb: 1,
                                            letterSpacing: "0.1em",
                                        }}
                                    >
                                        SESSION_LOG · UNLOCKED
                                    </Box>
                                    <ReactMarkdown components={MarkdownComponents}>
                                        {activeEntry.body || activeEntry.content || activeEntry.description || ""}
                                    </ReactMarkdown>
                                </>
                            ) : (
                                <CyberText
                                    sx={{
                                        opacity: 0.35,
                                        fontFamily: "'Fira Code', monospace",
                                        fontSize: "0.7rem",
                                        textAlign: "center",
                                        mt: 6,
                                    }}
                                >
                                    // SELECCIONA UNA ENTRADA DEL ARCHIVO
                                </CyberText>
                            )}
                        </DialogContent>
            </Box>
        </Dialog>
    );
}
