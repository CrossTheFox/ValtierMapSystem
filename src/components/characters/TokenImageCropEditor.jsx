import { useCallback, useEffect, useRef, useState } from "react";
import { Box, IconButton, Slider } from "@mui/material";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { CyberText } from "../customs/CustomTexts";
import CyberTooltip from "../customs/CyberTooltip";
import { UI_COLORS } from "../../constants/uiColors";
import { loadFirebaseAsset, getCachedUrl } from "../../../firebase/services/assetLoader";
import {
    DEFAULT_TOKEN_CROP,
    normalizeTokenCrop,
    tokenCropCss,
} from "../../utils/tokenImageFit";

const PREVIEW = 120;

/**
 * Circular token preview with drag-to-pan + zoom slider.
 * @param {{
 *   imagePath: string|null,
 *   crop: { zoom?: number, x?: number, y?: number }|null,
 *   onChange: (crop: { zoom: number, x: number, y: number }) => void,
 *   disabled?: boolean,
 * }} props
 */
export default function TokenImageCropEditor({ imagePath, crop, onChange, disabled = false }) {
    const normalized = normalizeTokenCrop(crop);
    const [url, setUrl] = useState(() => {
        if (!imagePath) return null;
        if (imagePath.startsWith("http")) return imagePath;
        return getCachedUrl(imagePath) || null;
    });
    const dragRef = useRef(null);

    useEffect(() => {
        if (!imagePath) {
            setUrl(null);
            return undefined;
        }
        if (imagePath.startsWith("http")) {
            setUrl(imagePath);
            return undefined;
        }
        const cached = getCachedUrl(imagePath);
        if (cached) {
            setUrl(cached);
            return undefined;
        }
        let cancelled = false;
        loadFirebaseAsset(imagePath)
            .then((resolved) => { if (!cancelled) setUrl(resolved); })
            .catch(() => { if (!cancelled) setUrl(null); });
        return () => { cancelled = true; };
    }, [imagePath]);

    const emit = useCallback(
        (partial) => {
            if (disabled) return;
            onChange(normalizeTokenCrop({ ...normalized, ...partial }));
        },
        [disabled, normalized, onChange]
    );

    const onPointerDown = (e) => {
        if (disabled || !url) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        dragRef.current = {
            x0: e.clientX,
            y0: e.clientY,
            ox: normalized.x,
            oy: normalized.y,
        };
    };

    const onPointerMove = (e) => {
        const drag = dragRef.current;
        if (!drag) return;
        // Drag moves the focal point opposite to finger (pan the image)
        const dx = (e.clientX - drag.x0) / PREVIEW;
        const dy = (e.clientY - drag.y0) / PREVIEW;
        const sensitivity = 0.55 / Math.max(normalized.zoom, 0.6);
        emit({
            x: drag.ox - dx * sensitivity,
            y: drag.oy - dy * sensitivity,
        });
    };

    const onPointerUp = (e) => {
        dragRef.current = null;
        try {
            e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
            /* ignore */
        }
    };

    if (!imagePath) {
        return (
            <CyberText sx={{ fontSize: "0.7rem", color: UI_COLORS.textSecondary }}>
                Sube una imagen de token para ajustar el encuadre.
            </CyberText>
        );
    }

    const css = tokenCropCss(normalized);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 160 }}>
            <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.textSecondary, letterSpacing: 0.5 }}>
                Encuadre del token
            </CyberText>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Box
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    sx={{
                        width: PREVIEW,
                        height: PREVIEW,
                        borderRadius: "50%",
                        overflow: "hidden",
                        border: `2px solid ${UI_COLORS.accent}66`,
                        bgcolor: "#050508",
                        cursor: disabled ? "default" : "grab",
                        flexShrink: 0,
                        touchAction: "none",
                        boxShadow: `0 0 12px ${UI_COLORS.accent}22`,
                        "&:active": { cursor: disabled ? "default" : "grabbing" },
                    }}
                >
                    {url ? (
                        <Box
                            component="img"
                            src={url}
                            alt="Token crop preview"
                            draggable={false}
                            sx={{
                                width: "100%",
                                height: "100%",
                                pointerEvents: "none",
                                userSelect: "none",
                                ...css,
                            }}
                        />
                    ) : (
                        <Box sx={{ width: "100%", height: "100%", bgcolor: UI_COLORS.backgroundSecondary }} />
                    )}
                </Box>
                <Box sx={{ flex: 1, minWidth: 100, display: "flex", flexDirection: "column", gap: 0.5 }}>
                    <CyberText sx={{ fontFamily: "monospace", fontSize: "0.5rem", color: UI_COLORS.textSecondary }}>
                        ZOOM
                    </CyberText>
                    <Slider
                        size="small"
                        min={0.6}
                        max={2.5}
                        step={0.05}
                        value={normalized.zoom}
                        disabled={disabled}
                        onChange={(_e, v) => emit({ zoom: v })}
                        sx={{
                            color: UI_COLORS.accent,
                            py: 0.5,
                            "& .MuiSlider-rail": { opacity: 0.3 },
                        }}
                    />
                    <CyberText sx={{ fontSize: "0.65rem", color: UI_COLORS.textSecondary, lineHeight: 1.35 }}>
                        Arrastra el círculo para encuadrar. Zoom acerca el retrato.
                    </CyberText>
                    <CyberTooltip title="Restablecer encuadre centrado">
                        <span>
                            <IconButton
                                size="small"
                                disabled={disabled}
                                onClick={() => onChange({ ...DEFAULT_TOKEN_CROP })}
                                sx={{
                                    color: UI_COLORS.anomaly,
                                    border: `1px solid ${UI_COLORS.border}`,
                                    borderRadius: 1,
                                    width: 28,
                                    height: 28,
                                }}
                            >
                                <RestartAltIcon sx={{ fontSize: "1rem" }} />
                            </IconButton>
                        </span>
                    </CyberTooltip>
                </Box>
            </Box>
        </Box>
    );
}
