import { useState } from "react";
import { Dialog, DialogContent, Box } from "@mui/material";

import { UI_COLORS } from "../constants/uiColors";
import useDialogActions from "../hooks/useDialogActions";
import { RENDER_LAYERS } from "../constants/renderLayers";
import { VTT_DIALOG_SIZE } from "../constants/vttHudTokens";
import { CYBER_SCROLL_STYLE } from "../constants/cyberScrollStyle";
import DraggableResizablePaper from "./DraggableResizablePaper";
import VttDialogHeaderTabs from "./VttDialogHeaderTabs";
import VttDialogHeaderBar from "./VttDialogHeaderBar";
import {
    VttDialogHeaderControls,
    VttDialogHeaderTitle,
    getVttDialogPopupHeaderSx,
} from "./VttDialogHeader";

export const TabPanel = ({ children, isSelected, pValue = 3 }) => (
    <Box sx={{
        display: isSelected ? "flex" : "none",
        flexDirection: "column",
        width: "100%",
        flexGrow: 1,
        minHeight: 0,
        overflow: "hidden",
        p: pValue,
        boxSizing: "border-box",
    }}>
        {children}
    </Box>
);

const scrollbarSx = {
    ...CYBER_SCROLL_STYLE,
    scrollbarWidth: "thin",
};

export default function BaseTabbedDialog({
    open,
    onClose,
    title,
    tabs,
    children,
    activeTab,
    setActiveTab,
    popupMode  = false,
    isPopped   = false,
    onPopout   = null,
    extraHeaderActions = null,
    sizePreset = "lg",
    subtitle = null,
}) {
    const { isMinimized, toggleMinimize, forceMinimize } = useDialogActions();
    const [isFullscreen, setIsFullscreen] = useState(false);

    const handleToggleMinimize = (e) => { e.stopPropagation(); toggleMinimize(); };
    const handleToggleFullscreen = (e) => {
        e.stopPropagation();
        setIsFullscreen((v) => !v);
    };

    const handleDialogClose = (event, reason) => {
        if (reason === "backdropClick") {
            forceMinimize();
            return;
        }
        setIsFullscreen(false);
        onClose();
    };

    const accent = UI_COLORS.accent || "#00f2ea";
    const preset = VTT_DIALOG_SIZE[sizePreset] || VTT_DIALOG_SIZE.lg;
    const sizeSx = isFullscreen ? VTT_DIALOG_SIZE.fullscreen : {
        width: preset.width,
        height: preset.height,
        maxWidth: preset.width,
        borderRadius: preset.borderRadius,
        m: 0,
    };

    const headerControls = (
        <VttDialogHeaderControls
            isMinimized={isMinimized}
            isFullscreen={isFullscreen}
            onToggleFullscreen={handleToggleFullscreen}
            onToggleMinimize={handleToggleMinimize}
            onClose={onClose}
            isPopped={isPopped}
            onPopout={onPopout}
            popupMode={popupMode}
            extraActions={extraHeaderActions}
            accent={accent}
        />
    );

    if (popupMode) {
        return (
            <Box sx={{ display: "flex", flexDirection: "column", width: "100vw", height: "100vh", bgcolor: "#12121a", color: "#fff" }}>
                <Box sx={{ ...getVttDialogPopupHeaderSx(), flexDirection: "column", gap: 0.375, py: 0.75 }}>
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: "1fr auto 1fr",
                            alignItems: "center",
                            width: "100%",
                            gap: 0.75,
                        }}
                    >
                        <Box sx={{ display: "flex", justifyContent: "flex-start" }}>
                            <VttDialogHeaderTabs tabs={tabs} value={activeTab} onChange={(e, v) => setActiveTab(v)} />
                        </Box>
                        <VttDialogHeaderTitle title={title} subtitle={subtitle} />
                        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>{headerControls}</Box>
                    </Box>
                </Box>
                <Box sx={{ display: "flex", flexDirection: "column", flexGrow: 1, overflow: "hidden" }}>
                    <DialogContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column", p: 0, width: "100%", overflow: "hidden", alignItems: "stretch", ...scrollbarSx }}>
                        {children}
                    </DialogContent>
                </Box>
            </Box>
        );
    }

    return (
        <Dialog
            open={open}
            onClose={handleDialogClose}
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
                dragKey: isMinimized ? "min" : isFullscreen ? "fs" : "max",
                disableDrag: isFullscreen,
                disableResize: isFullscreen,
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
                    boxShadow: isFullscreen ? "none" : "0 0 40px rgba(255,102,255,0.12)",
                    border: isFullscreen ? "none" : `1px solid ${UI_COLORS.border}`,
                    transition: "border 0.3s, box-shadow 0.3s, width 0.2s, height 0.2s",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    ...sizeSx,
                },
            }}
        >
            <VttDialogHeaderBar
                isMinimized={isMinimized}
                isFullscreen={isFullscreen}
                onMinimizedClick={handleToggleMinimize}
                left={
                    !isMinimized ? (
                        <VttDialogHeaderTabs tabs={tabs} value={activeTab} onChange={(e, v) => setActiveTab(v)} />
                    ) : null
                }
                center={
                    <VttDialogHeaderTitle
                        title={title}
                        subtitle={subtitle}
                        isMinimized={isMinimized}
                        minimizedSuffix={isMinimized ? " (MINIMIZADO)" : ""}
                    />
                }
                right={headerControls}
            />

            <Box sx={{ display: isMinimized ? "none" : "flex", flexDirection: "column", flexGrow: 1, overflow: "hidden", minHeight: 0 }}>
                <DialogContent className="dialog-no-drag" sx={{ flexGrow: 1, display: "flex", flexDirection: "column", p: 0, width: "100%", overflow: "hidden", alignItems: "stretch", minHeight: 0, ...scrollbarSx }}>
                    {children}
                </DialogContent>
            </Box>
        </Dialog>
    );
}
