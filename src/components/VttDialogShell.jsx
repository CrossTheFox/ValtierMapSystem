import { useState } from "react";
import { Dialog, DialogContent, Box } from "@mui/material";
import { UI_COLORS } from "../constants/uiColors";
import useDialogActions from "../hooks/useDialogActions";
import { RENDER_LAYERS } from "../constants/renderLayers";
import { VTT_DIALOG_SIZE } from "../constants/vttHudTokens";
import { CYBER_SCROLL_STYLE } from "../constants/cyberScrollStyle";
import DraggableResizablePaper from "./DraggableResizablePaper";
import VttDialogHeaderBar from "./VttDialogHeaderBar";
import {
    VttDialogHeaderControls,
    VttDialogHeaderTitle,
    getVttDialogPopupHeaderSx,
} from "./VttDialogHeader";

const scrollbarSx = {
    ...CYBER_SCROLL_STYLE,
    scrollbarWidth: "thin",
};

/**
 * Dialog shell without bottom tabs — for custom layouts (e.g. Characters Global).
 */
export default function VttDialogShell({
    open,
    onClose,
    title,
    subtitle = null,
    children,
    sizePreset = "xl",
    popupMode = false,
    isPopped = false,
    onPopout = null,
    extraHeaderActions = null,
    dialogId,
}) {
    const { isMinimized, toggleMinimize, forceMinimize } = useDialogActions(dialogId);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const accent = UI_COLORS.accent || "#ff66ff";

    const handleToggleMinimize = (e) => { e.stopPropagation(); toggleMinimize(); };
    const handleToggleFullscreen = (e) => { e.stopPropagation(); setIsFullscreen((v) => !v); };

    const handleDialogClose = (event, reason) => {
        if (reason === "backdropClick") {
            forceMinimize();
            return;
        }
        setIsFullscreen(false);
        onClose();
    };

    const preset = VTT_DIALOG_SIZE[sizePreset] || VTT_DIALOG_SIZE.xl;
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
                <Box sx={{ ...getVttDialogPopupHeaderSx(), flexWrap: "wrap", rowGap: 0.5 }}>
                    <Box sx={{ flex: 1, display: "flex", justifyContent: "center" }}>
                        <VttDialogHeaderTitle title={title} subtitle={subtitle} />
                    </Box>
                    {headerControls}
                </Box>
                <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                    {children}
                </Box>
            </Box>
        );
    }

    if (!open || isMinimized) return null;

    return (
        <Dialog
            open={open}
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
                dragKey: isFullscreen ? "fs" : "max",
                disableDrag: isFullscreen,
                disableResize: isFullscreen,
                sx: {
                    pointerEvents: "auto",
                    backgroundColor: "#12121a",
                    color: "#fff",
                    border: isFullscreen ? "none" : `1px solid ${UI_COLORS.border}`,
                    boxShadow: isFullscreen ? "none" : "0 0 40px rgba(255,102,255,0.12)",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    ...sizeSx,
                },
            }}
        >
            <VttDialogHeaderBar
                isFullscreen={isFullscreen}
                center={
                    <VttDialogHeaderTitle title={title} subtitle={subtitle} />
                }
                right={headerControls}
            />

            <DialogContent
                className="dialog-no-drag"
                sx={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    p: 0,
                    minHeight: 0,
                    overflow: "hidden",
                    ...scrollbarSx,
                }}
            >
                {children}
            </DialogContent>
        </Dialog>
    );
}
