import { useState } from "react";
import { Dialog, DialogContent, IconButton, Box, Tooltip } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import RemoveIcon from "@mui/icons-material/Remove";
import AspectRatioIcon from "@mui/icons-material/AspectRatio";
import TextIncreaseIcon from "@mui/icons-material/TextIncrease";
import TextDecreaseIcon from "@mui/icons-material/TextDecrease";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import CustomBottomNavigation from "./customs/CustomBottomNavigation";
import { CyberTitle } from "./customs/CustomTexts";
import { UI_COLORS } from "../constants/uiColors";
import useDialogActions from "../hooks/useDialogActions";
import { RENDER_LAYERS } from "../constants/renderLayers";
import { DialogFontSizeContext } from "../contexts/DialogFontSizeContext";
import DraggableResizablePaper from "./DraggableResizablePaper";

const MAX_FONT_STEP = 3;
const DISABLED_BTN_COLOR = "rgba(255,255,255,0.32)";

export const TabPanel = ({ children, isSelected, pValue = 3 }) => (
    <Box sx={{
        display: isSelected ? "flex" : "none",
        flexDirection: "column",
        width: "100%",
        flexGrow: 1,
        p: pValue,
        boxSizing: "border-box",
    }}>
        {children}
    </Box>
);

/* ── Shared header button set (font-size + minimize + optional popout + close) ── */
const DialogHeaderButtons = ({
    fontStep,
    onFontDecrease,
    onFontIncrease,
    isMinimized,
    onToggleMinimize,
    onClose,
    isPopped,
    onPopout,
    popupMode,
}) => (
    <Box className="dialog-no-drag" sx={{ display: "flex", alignItems: "center", gap: 0.25, flexShrink: 0 }}>
        {!isMinimized && !popupMode && (
            <>
                <Tooltip title="Decrease font size">
                    <span>
                        <IconButton onClick={onFontDecrease} size="small" disabled={fontStep === 0}
                            sx={{ color: UI_COLORS.accent, "&.Mui-disabled": { color: DISABLED_BTN_COLOR } }}>
                            <TextDecreaseIcon sx={{ fontSize: "1.1rem" }} />
                        </IconButton>
                    </span>
                </Tooltip>
                <Tooltip title="Increase font size">
                    <span>
                        <IconButton onClick={onFontIncrease} size="small" disabled={fontStep === MAX_FONT_STEP}
                            sx={{ color: UI_COLORS.accent, "&.Mui-disabled": { color: DISABLED_BTN_COLOR } }}>
                            <TextIncreaseIcon sx={{ fontSize: "1.1rem" }} />
                        </IconButton>
                    </span>
                </Tooltip>
            </>
        )}

        {/* Popout button — only in main window, not in popup itself */}
        {!popupMode && onPopout && (
            <Tooltip title={isPopped ? "Already open in popup" : "Detach to new window"}>
                <span>
                    <IconButton onClick={onPopout} size="small" disabled={isPopped}
                        sx={{ color: UI_COLORS.accent, "&.Mui-disabled": { color: DISABLED_BTN_COLOR } }}>
                        <OpenInNewIcon sx={{ fontSize: "1.1rem" }} />
                    </IconButton>
                </span>
            </Tooltip>
        )}

        {/* Minimize toggle — only in main window */}
        {!popupMode && (
            <Tooltip title={isMinimized ? "Restaurar" : "Minimizar"}>
                <IconButton onClick={onToggleMinimize} size="small" sx={{ mx: 0.25 }}>
                    {isMinimized
                        ? <AspectRatioIcon sx={{ color: UI_COLORS.accent, fontSize: "1.2rem" }} />
                        : <RemoveIcon     sx={{ color: "#fff",            fontSize: "1.2rem" }} />}
                </IconButton>
            </Tooltip>
        )}

        {/* Close button — always present */}
        {(!isMinimized || popupMode) && (
            <IconButton onClick={onClose} size="small">
                <CloseIcon sx={{ color: "#ff66ff" }} />
            </IconButton>
        )}
    </Box>
);

/* ── Shared scrollbar style ── */
const scrollbarSx = {
    "&::-webkit-scrollbar":        { width: "10px" },
    "&::-webkit-scrollbar-track":  { background: "#0d0d14" },
    "&::-webkit-scrollbar-thumb":  {
        backgroundColor: "transparent",
        backgroundImage: `linear-gradient(180deg, ${UI_COLORS.accent || "#00f2ea"} 0%, rgba(0,242,234,0.2) 50%, ${UI_COLORS.accent || "#00f2ea"} 100%)`,
        border: `1px solid ${UI_COLORS.accent || "#00f2ea"}`,
    },
};

export default function BaseTabbedDialog({
    open,
    onClose,
    title,
    tabs,
    children,
    activeTab,
    setActiveTab,
    /* Popup/popout props passed by the parent */
    popupMode  = false,
    isPopped   = false,
    onPopout   = null,
}) {
    const { isMinimized, toggleMinimize } = useDialogActions();
    const [fontStep, setFontStep] = useState(0);

    const handleToggleMinimize = (e) => { e.stopPropagation(); toggleMinimize(); };
    const handleFontIncrease   = (e) => { e.stopPropagation(); setFontStep((s) => Math.min(s + 1, MAX_FONT_STEP)); };
    const handleFontDecrease   = (e) => { e.stopPropagation(); setFontStep((s) => Math.max(s - 1, 0)); };

    const accent = UI_COLORS.accent || "#00f2ea";

    const headerButtons = (
        <DialogHeaderButtons
            fontStep={fontStep}
            onFontDecrease={handleFontDecrease}
            onFontIncrease={handleFontIncrease}
            isMinimized={isMinimized}
            onToggleMinimize={handleToggleMinimize}
            onClose={onClose}
            isPopped={isPopped}
            onPopout={onPopout}
            popupMode={popupMode}
        />
    );

    // ── POPUP MODE: render fullscreen without any Dialog wrapper ──────────────
    if (popupMode) {
        return (
            <DialogFontSizeContext.Provider value={fontStep}>
                <Box sx={{ display: "flex", flexDirection: "column", width: "100vw", height: "100vh", bgcolor: "#12121a", color: "#fff" }}>
                    {/* Header */}
                    <Box sx={{
                        px: 3, py: 1.75,
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        bgcolor: "#1a1a2a", borderBottom: "1px solid #2a2a3d", flexShrink: 0,
                    }}>
                        <CyberTitle sx={{ fontSize: "1.2rem", color: accent }}>{title}</CyberTitle>
                        {headerButtons}
                    </Box>
                    {/* Content */}
                    <Box sx={{ display: "flex", flexDirection: "column", flexGrow: 1, overflow: "hidden" }}>
                        <DialogContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column", p: 0, width: "100%", overflowX: "hidden", alignItems: "stretch", ...scrollbarSx }}>
                            {children}
                        </DialogContent>
                        <CustomBottomNavigation
                            value={activeTab}
                            onChange={(e, v) => setActiveTab(v)}
                            actions={tabs}
                        />
                    </Box>
                </Box>
            </DialogFontSizeContext.Provider>
        );
    }

    // ── NORMAL / MINIMIZED MODE ───────────────────────────────────────────────
    return (
        <Dialog
            open={open}
            fullWidth
            maxWidth={false}
            hideBackdrop={isMinimized}
            disableEnforceFocus={isMinimized}
            style={isMinimized ? { pointerEvents: "none" } : {}}
            sx={{
                zIndex: RENDER_LAYERS.DIALOG,
                "& .MuiDialog-container": {
                    alignItems: { xs: isMinimized ? "flex-end" : "flex-end", sm: "center" },
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
                    height: "auto",
                    maxHeight: "60px",
                    overflow: "hidden",
                } : {
                    pointerEvents: "auto",
                    backgroundColor: "#12121a",
                    color: "#fff",
                    borderRadius: { xs: "12px 12px 0 0", sm: 3 },
                    boxShadow: "0 0 40px rgba(255,0,255,0.2)",
                    border: "1px solid #2a2a3d",
                    transition: "border 0.3s, box-shadow 0.3s",
                    m: 0,
                    height: { xs: "90vh", sm: "85vh" },
                    width: { xs: "100%", sm: "90%" },
                },
            }}
        >
            {/* ── Drag handle / Header ── */}
            <Box
                className="dialog-drag-handle"
                sx={{
                    px: 3,
                    py: isMinimized ? 1.5 : 2,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: isMinimized ? "none" : "1px solid #2a2a3d",
                    backgroundColor: "#1a1a2a",
                    cursor: isMinimized ? "pointer" : "move",
                    userSelect: "none",
                }}
                onClick={isMinimized ? handleToggleMinimize : undefined}
            >
                <CyberTitle sx={{ fontSize: isMinimized ? "0.9rem" : "1.2rem", transition: "0.3s", color: accent }}>
                    {title} {isMinimized && "(MINIMIZADO)"}
                </CyberTitle>
                {headerButtons}
            </Box>

            {/* ── Content (hidden when minimized) ── */}
            <DialogFontSizeContext.Provider value={fontStep}>
                <Box sx={{ display: isMinimized ? "none" : "flex", flexDirection: "column", flexGrow: 1, overflow: "hidden" }}>
                    <DialogContent className="dialog-no-drag" sx={{ flexGrow: 1, display: "flex", flexDirection: "column", p: 0, width: "100%", overflowX: "hidden", alignItems: "stretch", ...scrollbarSx }}>
                        {children}
                    </DialogContent>
                    <CustomBottomNavigation
                        value={activeTab}
                        onChange={(e, v) => setActiveTab(v)}
                        actions={tabs}
                    />
                </Box>
            </DialogFontSizeContext.Provider>
        </Dialog>
    );
}
