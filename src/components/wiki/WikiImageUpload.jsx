import { useState, useRef, useCallback, useEffect } from "react";
import { Box, CircularProgress, Tooltip, IconButton } from "@mui/material";
import ImageIcon from "@mui/icons-material/Image";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { loadFirebaseAsset, getCachedUrl } from "../../../firebase/services/assetLoader";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
const MAX_MB = 5;

function useResolvedImageUrl(path) {
    const [url, setUrl] = useState(() => {
        if (!path) return null;
        if (path.startsWith("http")) return path;
        return getCachedUrl(path) || null;
    });
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (!path) {
            setUrl(null);
            setFailed(false);
            return;
        }
        if (path.startsWith("http")) {
            setUrl(path);
            setFailed(false);
            return;
        }
        const cached = getCachedUrl(path);
        if (cached) {
            setUrl(cached);
            setFailed(false);
            return;
        }
        let cancelled = false;
        setFailed(false);
        loadFirebaseAsset(path)
            .then((loaded) => {
                if (!cancelled) {
                    setUrl(loaded);
                    setFailed(false);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setUrl(null);
                    setFailed(true);
                }
            });
        return () => { cancelled = true; };
    }, [path]);

    const markFailed = useCallback(() => {
        setUrl(null);
        setFailed(true);
    }, []);

    return { url, failed, markFailed };
}

/**
 * Drag-and-drop image upload widget.
 *
 * @param {string|null} value — wiki-owned image (URL or Storage path)
 * @param {string|null} [fallbackPath] — VTT-linked image when value is empty
 * @param {"wiki"|"vtt_character"|"vtt_location"|null} [fallbackSource]
 * @param {"portrait"|"banner"} [variant]
 * @param {number} [maxMb] — max file size in MB (default 5)
 */
export default function WikiImageUpload({
    value,
    fallbackPath = null,
    fallbackSource = null,
    onChange,
    uploadImage,
    label,
    helperText,
    disabled = false,
    variant = "portrait",
    maxMb = MAX_MB,
}) {
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");
    const fileInputRef = useRef(null);

    const hasWikiImage = Boolean(value);
    const wikiResolved = useResolvedImageUrl(value);
    const fallbackResolved = useResolvedImageUrl(fallbackPath);
    // Broken wiki paths (404) must not block the VTT fallback.
    const usingWiki = hasWikiImage && Boolean(wikiResolved.url) && !wikiResolved.failed;
    const isFallback = !usingWiki && Boolean(fallbackPath) && Boolean(fallbackResolved.url) && !fallbackResolved.failed;
    const displayPath = usingWiki ? value : (isFallback ? fallbackPath : null);
    const displayUrl = usingWiki ? wikiResolved.url : (isFallback ? fallbackResolved.url : null);
    const displayFailed = hasWikiImage
        ? (wikiResolved.failed && (!fallbackPath || fallbackResolved.failed))
        : fallbackResolved.failed;

    const processFile = useCallback(
        async (file) => {
            if (!file) return;
            if (!ACCEPTED_TYPES.includes(file.type)) {
                setError("Formato no soportado. Usa JPG, PNG, WEBP, GIF o SVG.");
                return;
            }
            if (file.size > maxMb * 1024 * 1024) {
                setError(`La imagen no puede superar ${maxMb} MB.`);
                return;
            }
            setError("");
            setUploading(true);
            try {
                const result = await uploadImage(file);
                // Prefer Storage path: durable across object re-uploads / token rotation.
                onChange(result.path || result.url);
            } catch (e) {
                setError("Error al subir la imagen. Inténtalo de nuevo.");
                console.error(e);
            } finally {
                setUploading(false);
            }
        },
        [uploadImage, onChange, maxMb]
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
            if (!hasWikiImage) return;
            onChange(null);
            setError("");
        },
        [hasWikiImage, onChange]
    );

    const borderColor = dragging
        ? UI_COLORS.accent
        : error
          ? UI_COLORS.accentStrong
          : displayPath
            ? `${UI_COLORS.accent}55`
            : UI_COLORS.border;

    const sourceLabel =
        isFallback && fallbackSource === "vtt_character" ? "VTT" :
        isFallback && fallbackSource === "vtt_location" ? "MAPA" :
        null;

    const isPortrait = variant === "portrait";
    const resolvedHelper = error
        || helperText
        || (isFallback ? "Imagen heredada del VTT. Sube un archivo para usar una propia en la wiki." : null);

    return (
        <Box sx={{ width: isPortrait ? "100%" : "100%", maxWidth: isPortrait ? 200 : "none" }}>
            {label && (
                <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.textSecondary, mb: 0.5, letterSpacing: 0.5, display: "block" }}>
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
                        : displayPath
                          ? UI_COLORS.backgroundPrimary
                          : UI_COLORS.backgroundPrimary,
                    minHeight: displayPath ? "auto" : isPortrait ? 200 : 88,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "100%",
                }}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_TYPES.join(",")}
                    style={{ display: "none" }}
                    onChange={handleFileInput}
                />

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
                        <CyberText sx={{ color: UI_COLORS.accent, fontSize: "0.75rem", letterSpacing: 1.5, textAlign: "center", px: 1 }}>
                            SOLTAR IMAGEN
                        </CyberText>
                    </Box>
                )}

                {displayUrl ? (
                    <Box sx={{ position: "relative", width: "100%", lineHeight: 0 }}>
                        <Box
                            component="img"
                            src={displayUrl}
                            alt=""
                            onError={usingWiki ? wikiResolved.markFailed : fallbackResolved.markFailed}
                            sx={{
                                width: "100%",
                                display: "block",
                                borderRadius: 1,
                                objectFit: "cover",
                                aspectRatio: isPortrait ? "3 / 4" : "auto",
                                maxHeight: isPortrait ? 260 : 180,
                                filter: dragging ? "brightness(0.7)" : "none",
                                transition: "filter 0.2s",
                            }}
                        />
                        {sourceLabel && (
                            <Box
                                sx={{
                                    position: "absolute",
                                    bottom: 6,
                                    left: 6,
                                    px: 0.6,
                                    py: 0.15,
                                    borderRadius: 0.5,
                                    bgcolor: `${UI_COLORS.backgroundSecondary}dd`,
                                    border: `1px solid ${UI_COLORS.anomaly}88`,
                                    color: UI_COLORS.anomaly,
                                    fontFamily: "'Orbitron', sans-serif",
                                    fontSize: "0.5rem",
                                    letterSpacing: 1,
                                    fontWeight: 700,
                                    zIndex: 3,
                                }}
                            >
                                {sourceLabel}
                            </Box>
                        )}
                        {!disabled && hasWikiImage && (
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
                                            bgcolor: `${UI_COLORS.backgroundSecondary}dd`,
                                            color: UI_COLORS.accent,
                                            border: `1px solid ${UI_COLORS.accent}66`,
                                            "&:hover": { bgcolor: `${UI_COLORS.accent}22` },
                                            p: 0.5,
                                        }}
                                    >
                                        <EditIcon sx={{ fontSize: "0.95rem" }} />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Eliminar imagen wiki">
                                    <IconButton
                                        size="small"
                                        onClick={handleClear}
                                        sx={{
                                            bgcolor: `${UI_COLORS.backgroundSecondary}dd`,
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
                        {!disabled && isFallback && (
                            <Box
                                sx={{
                                    position: "absolute",
                                    top: 6,
                                    right: 6,
                                    zIndex: 4,
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <Tooltip title="Subir imagen propia para la wiki">
                                    <IconButton
                                        size="small"
                                        onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                        sx={{
                                            bgcolor: `${UI_COLORS.backgroundSecondary}dd`,
                                            color: UI_COLORS.accent,
                                            border: `1px solid ${UI_COLORS.accent}66`,
                                            "&:hover": { bgcolor: `${UI_COLORS.accent}22` },
                                            p: 0.5,
                                        }}
                                    >
                                        <EditIcon sx={{ fontSize: "0.95rem" }} />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        )}
                    </Box>
                ) : displayPath && !displayUrl && !displayFailed ? (
                    <Box sx={{ textAlign: "center", py: 2, px: 1.5, pointerEvents: "none" }}>
                        <CircularProgress size={22} sx={{ color: UI_COLORS.accent, mb: 1 }} />
                        <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "0.68rem" }}>
                            Cargando imagen…
                        </CyberText>
                    </Box>
                ) : displayFailed ? (
                    <Box sx={{ textAlign: "center", py: 2, px: 1.5, pointerEvents: "none" }}>
                        <ImageIcon sx={{ color: UI_COLORS.accentStrong, fontSize: "1.6rem", mb: 0.5, opacity: 0.7 }} />
                        <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "0.68rem", lineHeight: 1.4 }}>
                            No se pudo cargar la imagen.
                            <br />
                            Haz clic para subir otra.
                        </CyberText>
                    </Box>
                ) : (
                    <Box sx={{ textAlign: "center", py: isPortrait ? 2.5 : 1.5, px: 1.5, pointerEvents: "none" }}>
                        <ImageIcon sx={{ color: UI_COLORS.border, fontSize: isPortrait ? "2rem" : "1.6rem", mb: 0.5 }} />
                        <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "0.7rem", lineHeight: 1.45 }}>
                            Arrastra o haz clic
                        </CyberText>
                        <CyberText sx={{ color: `${UI_COLORS.textSecondary}77`, fontSize: "0.6rem", mt: 0.35, display: "block" }}>
                            JPG · PNG · WEBP — máx. {MAX_MB} MB
                        </CyberText>
                    </Box>
                )}
            </Box>

            {resolvedHelper && (
                <CyberText
                    sx={{
                        fontSize: "0.62rem",
                        mt: 0.5,
                        lineHeight: 1.4,
                        color: error ? UI_COLORS.accentStrong : UI_COLORS.textSecondary,
                    }}
                >
                    {resolvedHelper}
                </CyberText>
            )}
        </Box>
    );
}
