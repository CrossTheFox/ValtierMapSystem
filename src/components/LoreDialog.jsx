import React, { useState } from "react";
import { Dialog, DialogContent, IconButton, Box, Tooltip, Typography } from "@mui/material";
import CloseIcon        from "@mui/icons-material/Close";
import RemoveIcon       from "@mui/icons-material/Remove";
import AspectRatioIcon  from "@mui/icons-material/AspectRatio";
import TextIncreaseIcon from "@mui/icons-material/TextIncrease";
import TextDecreaseIcon from "@mui/icons-material/TextDecrease";
import OpenInNewIcon    from "@mui/icons-material/OpenInNew";
import ReactMarkdown    from "react-markdown";

import { CyberTitle, CyberText }   from "./customs/CustomTexts";
import { UI_COLORS }               from "../constants/uiColors";
import { RENDER_LAYERS }           from "../constants/renderLayers";
import AnimatedTypewriterText      from "./animations/AnimatedTypewriterText";
import { DialogFontSizeContext }   from "../contexts/DialogFontSizeContext";
import DraggableResizablePaper     from "./DraggableResizablePaper";
import usePopout                   from "../hooks/usePopout";

import { useDispatch, useSelector }          from "react-redux";
import { setSelectedLore, toggleIsMinimized } from "../store/uiSlice";

const MAX_FONT_STEP      = 3;
const DISABLED_BTN_COLOR = "rgba(255,255,255,0.32)";

const MarkdownComponents = {
    p:  ({ children }) => <Box sx={{ mb: 2 }}><AnimatedTypewriterText text={children} duration={1000} /></Box>,
    h1: ({ children }) => <CyberTitle sx={{ mb: 2, fontSize: "1.8rem" }}>{children}</CyberTitle>,
    h2: ({ children }) => <CyberTitle sx={{ mb: 1, fontSize: "1.4rem", color: UI_COLORS.accent }}>{children}</CyberTitle>,
    li: ({ children }) => <Box component="li" sx={{ mb: 1 }}><CyberText sx={{ display: "list-item" }}>{children}</CyberText></Box>,
};

const scrollbarSx = {
    "&::-webkit-scrollbar":       { width: "8px" },
    "&::-webkit-scrollbar-track": { background: "#0d0d14" },
    "&::-webkit-scrollbar-thumb": { backgroundColor: UI_COLORS.accent || "#00f2ea", borderRadius: "4px" },
};

export default function LoreDialog({ popupMode = false }) {
    const dispatch = useDispatch();
    const { selectedLore, isMinimized } = useSelector((state) => state.ui);

    const [fontStep, setFontStep] = useState(0);
    const { isPopped, popout }    = usePopout("lore");

    if (!selectedLore) return null;

    const accent = UI_COLORS.accent || "#00f2ea";

    const handleClose           = () => dispatch(setSelectedLore(null));
    const handleToggleMinimize  = (e) => { e.stopPropagation(); dispatch(toggleIsMinimized()); };
    const handleFontIncrease    = (e) => { e.stopPropagation(); setFontStep((s) => Math.min(s + 1, MAX_FONT_STEP)); };
    const handleFontDecrease    = (e) => { e.stopPropagation(); setFontStep((s) => Math.max(s - 1, 0)); };

    const handlePopout = (e) => {
        e.stopPropagation();
        // Serialize the current lore entry so the popup can restore it
        popout(selectedLore);
        handleClose(); // close in main window while popup is open
    };

    const formattedDate = selectedLore.created_at?.toDate
        ? selectedLore.created_at.toDate().toLocaleDateString()
        : new Date(selectedLore.created_at).toLocaleDateString();

    /* ── Header buttons ── */
    const headerButtons = (
        <Box className="dialog-no-drag" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            {!isMinimized && !popupMode && (
                <>
                    <Tooltip title="Decrease font size"><span>
                        <IconButton onClick={handleFontDecrease} size="small" disabled={fontStep === 0}
                            sx={{ color: accent, "&.Mui-disabled": { color: DISABLED_BTN_COLOR } }}>
                            <TextDecreaseIcon sx={{ fontSize: "1.1rem" }} />
                        </IconButton>
                    </span></Tooltip>
                    <Tooltip title="Increase font size"><span>
                        <IconButton onClick={handleFontIncrease} size="small" disabled={fontStep === MAX_FONT_STEP}
                            sx={{ color: accent, "&.Mui-disabled": { color: DISABLED_BTN_COLOR } }}>
                            <TextIncreaseIcon sx={{ fontSize: "1.1rem" }} />
                        </IconButton>
                    </span></Tooltip>
                    <Tooltip title={isPopped ? "Already open in popup" : "Detach to new window"}><span>
                        <IconButton onClick={handlePopout} size="small" disabled={isPopped}
                            sx={{ color: accent, "&.Mui-disabled": { color: DISABLED_BTN_COLOR } }}>
                            <OpenInNewIcon sx={{ fontSize: "1.1rem" }} />
                        </IconButton>
                    </span></Tooltip>
                </>
            )}
            {!popupMode && (
                <Tooltip title={isMinimized ? "Restaurar" : "Minimizar"}>
                    <IconButton onClick={handleToggleMinimize} size="small" sx={{ mx: 0.25 }}>
                        {isMinimized
                            ? <AspectRatioIcon sx={{ color: accent, fontSize: "1.2rem" }} />
                            : <RemoveIcon      sx={{ color: "#fff",  fontSize: "1.2rem" }} />}
                    </IconButton>
                </Tooltip>
            )}
            {(!isMinimized || popupMode) && (
                <IconButton onClick={popupMode ? () => window.close() : handleClose} size="small">
                    <CloseIcon sx={{ color: "#ff66ff" }} />
                </IconButton>
            )}
        </Box>
    );

    /* ── POPUP MODE ── */
    if (popupMode) {
        return (
            <DialogFontSizeContext.Provider value={fontStep}>
                <Box sx={{ display: "flex", flexDirection: "column", width: "100vw", height: "100vh", bgcolor: "#0d0d14", color: "#fff" }}>
                    <Box sx={{ px: 3, py: 2, display: "flex", justifyContent: "space-between", alignItems: "center", bgcolor: "#1a1a2a", borderBottom: "1px solid #2a2a3d", flexShrink: 0 }}>
                        <Box sx={{ display: "flex", alignItems: "baseline", gap: 2 }}>
                            <CyberTitle sx={{ fontSize: "1.2rem", color: accent }}>{selectedLore.title}</CyberTitle>
                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}>
                                [{formattedDate}]
                            </Typography>
                        </Box>
                        {headerButtons}
                    </Box>
                    <Box sx={{ flexGrow: 1, overflow: "auto", p: 4, ...scrollbarSx }}>
                        <ReactMarkdown components={MarkdownComponents}>{selectedLore.content}</ReactMarkdown>
                    </Box>
                </Box>
            </DialogFontSizeContext.Provider>
        );
    }

    /* ── NORMAL / MINIMIZED MODE ── */
    return (
        <Dialog
            open={!!selectedLore}
            fullWidth
            maxWidth={false}
            hideBackdrop={isMinimized}
            disableEnforceFocus={isMinimized}
            style={isMinimized ? { pointerEvents: "none" } : {}}
            sx={{
                zIndex: RENDER_LAYERS.DIALOG,
                "& .MuiDialog-container": {
                    alignItems: { xs: "flex-end", sm: "center" },
                },
            }}
            PaperComponent={DraggableResizablePaper}
            PaperProps={{
                dragKey: isMinimized ? "min" : "max",
                sx: isMinimized ? {
                    pointerEvents: "auto",
                    backgroundColor: "#12121a",
                    color: "#fff",
                    borderRadius: 2,
                    boxShadow: `0 0 20px ${accent}44`,
                    border: `1px solid ${accent}`,
                    transition: "border 0.3s, box-shadow 0.3s",
                    position: "fixed",
                    bottom: { xs: 82, sm: 24 },
                    right: { xs: 8, sm: 215 },
                    m: 0,
                    width: { xs: "calc(100vw - 16px)", sm: "300px" },
                    maxHeight: "60px",
                    overflow: "hidden",
                } : {
                    pointerEvents: "auto",
                    backgroundColor: "#12121a",
                    color: "#fff",
                    borderRadius: { xs: "12px 12px 0 0", sm: 3 },
                    boxShadow: "0 0 40px rgba(0,0,0,0.8)",
                    border: "1px solid #2a2a3d",
                    transition: "border 0.3s, box-shadow 0.3s",
                    m: 0,
                    height: { xs: "90vh", sm: "80vh" },
                    width: { xs: "100%", sm: "60%" },
                    minWidth: { xs: "unset", sm: "400px" },
                },
            }}
        >
            {/* ── Drag handle / Header ── */}
            <Box
                className="dialog-drag-handle"
                sx={{
                    px: 3, py: 2,
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    bgcolor: "#1a1a2a",
                    borderBottom: isMinimized ? "none" : "1px solid #2a2a3d",
                    cursor: isMinimized ? "pointer" : "move",
                    userSelect: "none",
                }}
                onClick={isMinimized ? handleToggleMinimize : undefined}
            >
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 2 }}>
                    <CyberTitle sx={{ fontSize: isMinimized ? "0.9rem" : "1.2rem", color: accent }}>
                        {selectedLore.title}
                    </CyberTitle>
                    {!isMinimized && (
                        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}>
                            [{formattedDate}]
                        </Typography>
                    )}
                </Box>
                {headerButtons}
            </Box>

            {/* ── Content ── */}
            <DialogFontSizeContext.Provider value={fontStep}>
                <DialogContent
                    className="dialog-no-drag"
                    sx={{ display: isMinimized ? "none" : "block", p: 4, bgcolor: "#0d0d14", ...scrollbarSx }}
                >
                    <ReactMarkdown components={MarkdownComponents}>{selectedLore.content}</ReactMarkdown>
                </DialogContent>
            </DialogFontSizeContext.Provider>
        </Dialog>
    );
}
