import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSelector } from "react-redux";
import { Box, Collapse, IconButton } from "@mui/material";
import ZoomIn from "@mui/icons-material/ZoomIn";
import ZoomOut from "@mui/icons-material/ZoomOut";
import FitScreen from "@mui/icons-material/FitScreen";
import FilterCenterFocus from "@mui/icons-material/FilterCenterFocus";
import ExpandMore from "@mui/icons-material/ExpandMore";

import { useViewport } from "../context/ViewportContext";
import { UI_COLORS } from "../constants/uiColors";
import { CyberText } from "./customs/CustomTexts";
import CyberTooltip from "./customs/CyberTooltip";
import { RENDER_LAYERS } from "../constants/renderLayers";
import { VTT_HUD } from "../constants/vttHudTokens";

/** Relative scale change per step (~12% per click); pixi-viewport expects a ratio, not a whole percent. */
const ZOOM_STEP = 0.12;

const iconBtnSx = (accent) => ({
    color: accent,
    border: `1px solid ${accent}40`,
    borderRadius: 0.75,
    width: VTT_HUD.mapControlBtnSize,
    height: VTT_HUD.mapControlBtnSize,
    p: 0,
    "& .MuiSvgIcon-root": { fontSize: "0.95rem" },
    "&:hover": {
        backgroundColor: `${accent}18`,
        borderColor: accent,
        boxShadow: `0 0 8px ${accent}33`,
    },
});

export default function MapControls() {
    const viewport = useViewport();
    const wikiOverlayOpen = useSelector((s) => s.ui.wikiOverlay.open);
    const [scalePct, setScalePct] = useState(100);
    const [expanded, setExpanded] = useState(false);

    const accent = UI_COLORS.accent || "#ff66ff";

    const readScalePct = useCallback(() => {
        if (!viewport) return;
        setScalePct(Math.round((viewport.scale?.x ?? 1) * 100));
    }, [viewport]);

    useEffect(() => {
        if (!viewport) return;
        const onViewportChange = () => readScalePct();
        readScalePct();
        viewport.on("moved", onViewportChange);
        viewport.on("zoomed", onViewportChange);
        return () => {
            viewport.off("moved", onViewportChange);
            viewport.off("zoomed", onViewportChange);
        };
    }, [viewport, readScalePct]);

    const zoomIn = useCallback(() => {
        if (!viewport) return;
        viewport.zoomPercent(ZOOM_STEP, true);
        readScalePct();
    }, [viewport, readScalePct]);

    const zoomOut = useCallback(() => {
        if (!viewport) return;
        viewport.zoomPercent(-ZOOM_STEP, true);
        readScalePct();
    }, [viewport, readScalePct]);

    const fitToScreen = useCallback(() => {
        if (!viewport) return;
        viewport.fitWorld(false);
        viewport.moveCenter(viewport.worldWidth / 2, viewport.worldHeight / 2);
        readScalePct();
    }, [viewport, readScalePct]);

    const centerMap = useCallback(() => {
        if (!viewport) return;
        const cx = viewport.worldWidth / 2;
        const cy = viewport.worldHeight / 2;
        viewport.moveCenter(cx, cy);
        readScalePct();
    }, [viewport, readScalePct]);

    const toggleExpanded = useCallback(() => {
        setExpanded((v) => !v);
    }, []);

    if (typeof document === "undefined" || !viewport || wikiOverlayOpen) return null;

    const panel = (
        <Box
            data-no-token-drop
            sx={{
                pointerEvents: "auto",
                position: "fixed",
                bottom: VTT_HUD.mapControlsInset,
                right: VTT_HUD.mapControlsInset,
                zIndex: RENDER_LAYERS.MAP_CONTROLS,
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                gap: 0.5,
                p: VTT_HUD.mapControlPanelPadding,
                borderRadius: 1,
                border: `1px solid ${VTT_HUD.glassBorder}`,
                bgcolor: VTT_HUD.glassBg,
                backdropFilter: "blur(14px)",
                boxShadow: "0 0 14px rgba(255,102,255,0.05)",
                minWidth: VTT_HUD.mapControlPanelMinWidth,
            }}
        >
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <CyberTooltip title="Alejar" placement="top">
                    <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); zoomOut(); }}
                        sx={iconBtnSx(accent)}
                        aria-label="Zoom out"
                    >
                        <ZoomOut />
                    </IconButton>
                </CyberTooltip>

                <Box
                    role="button"
                    tabIndex={0}
                    aria-expanded={expanded}
                    aria-label={expanded ? "Ocultar controles extra" : "Mostrar controles extra"}
                    onClick={(e) => { e.stopPropagation(); toggleExpanded(); }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleExpanded();
                        }
                    }}
                    sx={{
                        flex: 1,
                        minWidth: 44,
                        py: 0.25,
                        px: 0.5,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 0.15,
                        border: `1px solid ${accent}55`,
                        borderRadius: 0.75,
                        background: `linear-gradient(180deg, ${accent}10 0%, transparent 100%)`,
                        "&:hover": {
                            borderColor: accent,
                            boxShadow: `0 0 8px ${accent}28`,
                        },
                    }}
                >
                    <CyberText
                        sx={{
                            fontFamily: "'Orbitron', sans-serif",
                            fontSize: VTT_HUD.scaleFontSize,
                            letterSpacing: 0.8,
                            color: accent,
                            fontWeight: 600,
                            userSelect: "none",
                            lineHeight: 1,
                        }}
                    >
                        {scalePct}%
                    </CyberText>
                    <ExpandMore
                        sx={{
                            color: accent,
                            fontSize: "0.95rem",
                            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                            transition: "transform 0.2s ease",
                        }}
                    />
                </Box>

                <CyberTooltip title="Acercar" placement="top">
                    <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); zoomIn(); }}
                        sx={iconBtnSx(accent)}
                        aria-label="Zoom in"
                    >
                        <ZoomIn />
                    </IconButton>
                </CyberTooltip>
            </Box>

            <Collapse in={expanded} timeout="auto" unmountOnExit>
                <Box sx={{ display: "flex", justifyContent: "center", gap: 0.5, pt: 0.25 }}>
                    <CyberTooltip title="Ajustar al mapa" placement="top">
                        <span>
                            <IconButton
                                size="small"
                                onClick={(e) => { e.stopPropagation(); fitToScreen(); }}
                                sx={iconBtnSx(accent)}
                                aria-label="Fit map to screen"
                            >
                                <FitScreen />
                            </IconButton>
                        </span>
                    </CyberTooltip>
                    <CyberTooltip title="Centrar mapa" placement="top">
                        <span>
                            <IconButton
                                size="small"
                                onClick={(e) => { e.stopPropagation(); centerMap(); }}
                                sx={iconBtnSx(accent)}
                                aria-label="Center map"
                            >
                                <FilterCenterFocus />
                            </IconButton>
                        </span>
                    </CyberTooltip>
                </Box>
            </Collapse>
        </Box>
    );

    return createPortal(panel, document.body);
}
