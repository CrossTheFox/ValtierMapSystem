import { Box, IconButton } from "@mui/material";
import CyberTooltip from "./customs/CyberTooltip";
import CloseIcon from "@mui/icons-material/Close";
import RemoveIcon from "@mui/icons-material/Remove";
import AspectRatioIcon from "@mui/icons-material/AspectRatio";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import { CyberTitle } from "./customs/CustomTexts";
import { UI_COLORS } from "../constants/uiColors";
import { VTT_DIALOG_HEADER } from "../constants/vttHudTokens";

const DISABLED_BTN_COLOR = "rgba(255,255,255,0.32)";

export function getVttDialogHeaderSx({ isMinimized = false, isFullscreen = false } = {}) {
    return {
        px: VTT_DIALOG_HEADER.px,
        py: VTT_DIALOG_HEADER.py,
        display: "flex",
        alignItems: "center",
        borderBottom: isMinimized ? "none" : `1px solid ${UI_COLORS.border}`,
        bgcolor: UI_COLORS.backgroundSecondary,
        cursor: isMinimized ? "pointer" : isFullscreen ? "default" : "move",
        userSelect: "none",
        flexShrink: 0,
        gap: 0.75,
        minHeight: 44,
    };
}

export function getVttDialogTitleSx({ isMinimized = false } = {}) {
    return {
        fontSize: isMinimized ? VTT_DIALOG_HEADER.minimizedTitleFontSize : VTT_DIALOG_HEADER.titleFontSize,
        color: UI_COLORS.accent,
        letterSpacing: VTT_DIALOG_HEADER.titleLetterSpacing,
        transition: "0.3s",
    };
}

export function getVttDialogSubtitleSx() {
    return {
        fontFamily: "'Fira Code', monospace",
        fontSize: VTT_DIALOG_HEADER.subtitleFontSize,
        color: UI_COLORS.textSecondary,
        letterSpacing: VTT_DIALOG_HEADER.subtitleLetterSpacing,
        mt: 0.25,
    };
}

export function getVttDialogPopupHeaderSx() {
    return {
        ...getVttDialogHeaderSx(),
        cursor: "default",
    };
}

/**
 * Standard VTT dialog header controls (popout, fullscreen, minimize, close).
 * Font-size controls intentionally omitted.
 */
export function VttDialogHeaderControls({
    isMinimized = false,
    isFullscreen = false,
    onToggleFullscreen = null,
    onToggleMinimize = null,
    onClose,
    isPopped = false,
    onPopout = null,
    popupMode = false,
    extraActions = null,
    accent = UI_COLORS.accent,
    popoutDisabled = false,
}) {
    return (
        <Box className="dialog-no-drag" sx={{ display: "flex", alignItems: "center", gap: 0, flexShrink: 0 }}>
            {extraActions}
            {!popupMode && onPopout && (
                <CyberTooltip title={isPopped ? "Ya abierto en pestaña" : "Abrir en pestaña"} placement="bottom">
                    <span>
                        <IconButton
                            onClick={onPopout}
                            size="small"
                            disabled={isPopped || popoutDisabled}
                            sx={{ color: accent, p: 0.35, "& .MuiSvgIcon-root": { fontSize: "0.95rem" }, "&.Mui-disabled": { color: DISABLED_BTN_COLOR } }}
                        >
                            <OpenInNewIcon />
                        </IconButton>
                    </span>
                </CyberTooltip>
            )}
            {!popupMode && onToggleFullscreen && (
                <CyberTooltip title={isFullscreen ? "Restaurar tamaño" : "Pantalla completa"} placement="bottom">
                    <IconButton onClick={onToggleFullscreen} size="small" sx={{ p: 0.35, "& .MuiSvgIcon-root": { fontSize: "0.95rem" } }}>
                        {isFullscreen
                            ? <FullscreenExitIcon sx={{ color: accent }} />
                            : <FullscreenIcon sx={{ color: accent }} />}
                    </IconButton>
                </CyberTooltip>
            )}
            {!popupMode && !isFullscreen && onToggleMinimize && (
                <CyberTooltip title={isMinimized ? "Restaurar" : "Minimizar"} placement="bottom">
                    <IconButton onClick={onToggleMinimize} size="small" sx={{ p: 0.35, "& .MuiSvgIcon-root": { fontSize: "0.95rem" } }}>
                        {isMinimized
                            ? <AspectRatioIcon sx={{ color: accent }} />
                            : <RemoveIcon sx={{ color: "#fff" }} />}
                    </IconButton>
                </CyberTooltip>
            )}
            {(!isMinimized || popupMode) && onClose && (
                <CyberTooltip title="Cerrar" placement="bottom">
                    <IconButton onClick={onClose} size="small" sx={{ p: 0.35, "& .MuiSvgIcon-root": { fontSize: "0.95rem" } }}>
                        <CloseIcon sx={{ color: accent }} />
                    </IconButton>
                </CyberTooltip>
            )}
        </Box>
    );
}

export function VttDialogHeaderTitle({ title, subtitle, isMinimized = false, minimizedSuffix = "" }) {
    return (
        <Box>
            <CyberTitle sx={getVttDialogTitleSx({ isMinimized })}>
                {title}{minimizedSuffix}
            </CyberTitle>
            {subtitle && !isMinimized && (
                <Box sx={getVttDialogSubtitleSx()}>{subtitle}</Box>
            )}
        </Box>
    );
}
