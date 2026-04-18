import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Box, Collapse, IconButton, Tooltip } from "@mui/material";
import ZoomIn from "@mui/icons-material/ZoomIn";
import ZoomOut from "@mui/icons-material/ZoomOut";
import FitScreen from "@mui/icons-material/FitScreen";
import FilterCenterFocus from "@mui/icons-material/FilterCenterFocus";
import ExpandMore from "@mui/icons-material/ExpandMore";

import { useViewport } from "../context/ViewportContext";
import { UI_COLORS } from "../constants/uiColors";
import { CyberText } from "./customs/CustomTexts";

/** Relative scale change per step (~12% per click); pixi-viewport expects a ratio, not a whole percent. */
const ZOOM_STEP = 0.12;

const iconBtnSx = (accent) => ({
    color: accent,
    border: `1px solid ${accent}40`,
    borderRadius: 1,
    p: { xs: 1.25, sm: 0.65 },
    "&:hover": {
        backgroundColor: `${accent}18`,
        borderColor: accent,
        boxShadow: `0 0 12px ${accent}33`,
    },
});

export default function MapControls() {
    const viewport = useViewport();
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

    if (typeof document === "undefined" || !viewport) return null;

    const panel = (
        <Box
            sx={{
                pointerEvents: "auto",
                position: "fixed",
                bottom: { xs: 16, sm: 24 },
                right: { xs: 16, sm: 24 },
                zIndex: 1250,
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                gap: 0.75,
                p: { xs: 1.25, sm: 1 },
                borderRadius: 1,
                border: `1px solid ${accent}44`,
                bgcolor: "rgba(10, 10, 15, 0.92)",
                backdropFilter: "blur(10px)",
                boxShadow: `0 0 24px ${accent}1a`,
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.75,
                }}
            >
                <IconButton
                    size="small"
                    onClick={(e) => {
                        e.stopPropagation();
                        zoomOut();
                    }}
                    sx={iconBtnSx(accent)}
                    aria-label="Zoom out"
                >
                    <ZoomOut fontSize="small" />
                </IconButton>

                <Box
                    role="button"
                    tabIndex={0}
                    aria-expanded={expanded}
                    aria-label={expanded ? "Hide extra map controls" : "Show extra map controls"}
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleExpanded();
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleExpanded();
                        }
                    }}
                    sx={{
                        flex: 1,
                        minWidth: { xs: 64, sm: 76 },
                        py: { xs: 1, sm: 0.5 },
                        px: 0.75,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 0.25,
                        border: `1px solid ${accent}55`,
                        borderRadius: 1,
                        background: `linear-gradient(180deg, ${accent}12 0%, transparent 100%)`,
                        "&:hover": {
                            borderColor: accent,
                            boxShadow: `0 0 10px ${accent}30`,
                        },
                    }}
                >
                    <CyberText
                        sx={{
                            fontFamily: "'Orbitron', sans-serif",
                            fontSize: "0.75rem",
                            letterSpacing: 1,
                            color: accent,
                            fontWeight: 600,
                            userSelect: "none",
                        }}
                    >
                        {scalePct}%
                    </CyberText>
                    <ExpandMore
                        fontSize="small"
                        sx={{
                            color: accent,
                            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                            transition: "transform 0.2s ease",
                        }}
                    />
                </Box>

                <IconButton
                    size="small"
                    onClick={(e) => {
                        e.stopPropagation();
                        zoomIn();
                    }}
                    sx={iconBtnSx(accent)}
                    aria-label="Zoom in"
                >
                    <ZoomIn fontSize="small" />
                </IconButton>
            </Box>

            <Collapse in={expanded} timeout="auto" unmountOnExit>
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "center",
                        gap: 1,
                        pt: 0.25,
                    }}
                >
                    <Tooltip title="Fit map to screen" placement="bottom">
                        <span>
                            <IconButton
                                size="small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    fitToScreen();
                                }}
                                sx={iconBtnSx(accent)}
                                aria-label="Fit map to screen"
                            >
                                <FitScreen fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title="Center on map" placement="bottom">
                        <span>
                            <IconButton
                                size="small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    centerMap();
                                }}
                                sx={iconBtnSx(accent)}
                                aria-label="Center map"
                            >
                                <FilterCenterFocus fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Box>
            </Collapse>
        </Box>
    );

    return createPortal(panel, document.body);
}
