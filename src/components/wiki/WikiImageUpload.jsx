import { useState, useRef, useCallback } from "react";
import { Box, CircularProgress, Tooltip, IconButton } from "@mui/material";
import ImageIcon from "@mui/icons-material/Image";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
const MAX_MB = 5;

/**
 * Drag-and-drop image upload widget.
 *
 * Props:
 *   value        — current image URL (string | null)
 *   onChange     — (url: string | null) => void  — called after successful upload or on clear
 *   uploadImage  — async (file: File) => { url: string }  — the actual upload function
 *   label        — optional string shown above the zone
 *   helperText   — optional hint below the zone
 *   disabled     — boolean
 */
export default function WikiImageUpload({
    value,
    onChange,
    uploadImage,
    label,
    helperText,
    disabled = false,
}) {
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");
    const fileInputRef = useRef(null);

    const processFile = useCallback(
        async (file) => {
            if (!file) return;
            if (!ACCEPTED_TYPES.includes(file.type)) {
                setError("Formato no soportado. Usa JPG, PNG, WEBP, GIF o SVG.");
                return;
            }
            if (file.size > MAX_MB * 1024 * 1024) {
                setError(`La imagen no puede superar ${MAX_MB} MB.`);
                return;
            }
            setError("");
            setUploading(true);
            try {
                const { url } = await uploadImage(file);
                onChange(url);
            } catch (e) {
                setError("Error al subir la imagen. Inténtalo de nuevo.");
                console.error(e);
            } finally {
                setUploading(false);
            }
        },
        [uploadImage, onChange]
    );

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) setDragging(true);
    }, [disabled]);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(false);
    }, []);

    const handleDrop = useCallback(
        (e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragging(false);
            if (disabled) return;
            const file = e.dataTransfer.files?.[0];
            if (file) processFile(file);
        },
        [disabled, processFile]
    );

    const handleFileInput = useCallback(
        (e) => {
            const file = e.target.files?.[0];
            if (file) processFile(file);
            // Reset so the same file can be re-selected
            e.target.value = "";
        },
        [processFile]
    );

    const handleClick = useCallback(() => {
        if (!disabled && !uploading) fileInputRef.current?.click();
    }, [disabled, uploading]);

    const handleClear = useCallback(
        (e) => {
            e.stopPropagation();
            onChange(null);
            setError("");
        },
        [onChange]
    );

    const borderColor = dragging
        ? UI_COLORS.accent
        : error
          ? UI_COLORS.accentStrong
          : value
            ? `${UI_COLORS.accent}55`
            : UI_COLORS.border;

    return (
        <Box>
            {label && (
                <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.textSecondary, mb: 0.5, letterSpacing: 1 }}>
                    {label}
                </CyberText>
            )}

            <Box
                onClick={handleClick}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                sx={{
                    position: "relative",
                    border: `1.5px dashed ${borderColor}`,
                    borderRadius: 1.5,
                    overflow: "hidden",
                    cursor: disabled ? "default" : "pointer",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                    boxShadow: dragging ? `0 0 12px ${UI_COLORS.accentGlow}` : "none",
                    bgcolor: dragging
                        ? `${UI_COLORS.accent}10`
                        : value
                          ? "transparent"
                          : UI_COLORS.backgroundPrimary,
                    minHeight: value ? "auto" : 88,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_TYPES.join(",")}
                    style={{ display: "none" }}
                    onChange={handleFileInput}
                />

                {/* Upload progress overlay */}
                {uploading && (
                    <Box
                        sx={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            bgcolor: `${UI_COLORS.backgroundSecondary}cc`,
                            zIndex: 2,
                        }}
                    >
                        <CircularProgress size={28} sx={{ color: UI_COLORS.accent }} />
                    </Box>
                )}

                {/* Drag overlay label */}
                {dragging && (
                    <Box
                        sx={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            bgcolor: `${UI_COLORS.accent}18`,
                            zIndex: 3,
                            pointerEvents: "none",
                        }}
                    >
                        <CyberText sx={{ color: UI_COLORS.accent, fontSize: "0.8rem", letterSpacing: 2 }}>
                            SOLTAR IMAGEN
                        </CyberText>
                    </Box>
                )}

                {value ? (
                    /* ── Preview mode ── */
                    <Box sx={{ position: "relative", width: "100%", lineHeight: 0 }}>
                        <Box
                            component="img"
                            src={value}
                            alt="preview"
                            sx={{
                                width: "100%",
                                maxHeight: 220,
                                objectFit: "cover",
                                display: "block",
                                borderRadius: 1,
                                filter: dragging ? "brightness(0.7)" : "none",
                                transition: "filter 0.2s",
                            }}
                        />
                        {/* Action buttons over image */}
                        {!disabled && (
                            <Box
                                sx={{
                                    position: "absolute",
                                    top: 6,
                                    right: 6,
                                    display: "flex",
                                    gap: 0.5,
                                    zIndex: 4,
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <Tooltip title="Reemplazar imagen">
                                    <IconButton
                                        size="small"
                                        onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                        sx={{
                                            bgcolor: `${UI_COLORS.backgroundSecondary}cc`,
                                            color: UI_COLORS.accent,
                                            border: `1px solid ${UI_COLORS.accent}66`,
                                            "&:hover": { bgcolor: `${UI_COLORS.accent}22` },
                                            p: 0.5,
                                        }}
                                    >
                                        <EditIcon sx={{ fontSize: "0.95rem" }} />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Eliminar imagen">
                                    <IconButton
                                        size="small"
                                        onClick={handleClear}
                                        sx={{
                                            bgcolor: `${UI_COLORS.backgroundSecondary}cc`,
                                            color: UI_COLORS.accentStrong,
                                            border: `1px solid ${UI_COLORS.accentStrong}66`,
                                            "&:hover": { bgcolor: `${UI_COLORS.accentStrong}22` },
                                            p: 0.5,
                                        }}
                                    >
                                        <DeleteIcon sx={{ fontSize: "0.95rem" }} />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        )}
                    </Box>
                ) : (
                    /* ── Empty drop zone ── */
                    <Box sx={{ textAlign: "center", py: 1.5, px: 2, pointerEvents: "none" }}>
                        <ImageIcon sx={{ color: UI_COLORS.border, fontSize: "1.8rem", mb: 0.5 }} />
                        <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "0.72rem", lineHeight: 1.5 }}>
                            Arrastra una imagen aquí
                            <br />
                            o haz clic para explorar
                        </CyberText>
                        <CyberText sx={{ color: `${UI_COLORS.textSecondary}88`, fontSize: "0.62rem", mt: 0.5 }}>
                            JPG · PNG · WEBP · GIF · SVG — máx. {MAX_MB} MB
                        </CyberText>
                    </Box>
                )}
            </Box>

            {(error || helperText) && (
                <CyberText
                    sx={{
                        fontSize: "0.65rem",
                        mt: 0.5,
                        color: error ? UI_COLORS.accentStrong : `${UI_COLORS.textSecondary}88`,
                    }}
                >
                    {error || helperText}
                </CyberText>
            )}
        </Box>
    );
}
