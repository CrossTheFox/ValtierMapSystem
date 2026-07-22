import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Box, TextField, Paper, List, ListItemButton, ListItemText, CircularProgress } from "@mui/material";
import Fuse from "fuse.js";
import { CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import { buildMentionToken } from "../../utils/wikiSlug";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];

const TRIGGER = "@";
const MAX_ITEMS = 8;

const FUSE_OPTIONS = {
    keys: [
        { name: "title", weight: 3 },
        { name: "summary", weight: 1 },
        { name: "tags", weight: 1 },
        { name: "entityType", weight: 0.5 },
    ],
    threshold: 0.4,
    includeScore: true,
    minMatchCharLength: 1,
};

/**
 * Textarea with @ mention autocompletion + image drag-and-drop.
 *
 * Extra props:
 *   uploadImage  — async (file: File) => { url: string, path?: string }
 *                  When provided, dropping an image file will upload it and
 *                  insert `![filename](url)` at the cursor position.
 *   onImageUploaded — optional (result: { url, path }) => void — tracks Storage path for orphan cleanup
 */
export default function WikiMentionInput({
    value,
    onChange,
    entities = [],
    rows = 8,
    label,
    placeholder,
    uploadImage,
    onImageUploaded,
}) {
    const [popperOpen, setPopperOpen] = useState(false);
    const [popperItems, setPopperItems] = useState([]);
    const [highlightIndex, setHighlightIndex] = useState(0);
    const [triggerPos, setTriggerPos] = useState(null);
    const [mentionQuery, setMentionQuery] = useState("");
    const [imageDragging, setImageDragging] = useState(false);
    const [imageUploading, setImageUploading] = useState(false);

    // Track last known cursor position so we can insert at a good spot after drop
    const lastCursorRef = useRef(null);

    const textareaRef = useRef(null);
    const popperRef = useRef(null);
    const itemRefs = useRef([]);

    const fuse = useMemo(
        () => (entities.length > 0 ? new Fuse(entities, FUSE_OPTIONS) : null),
        [entities]
    );

    const detectMentionState = useCallback((text, caretPos) => {
        const before = text.slice(0, caretPos);
        const atIdx = before.lastIndexOf(TRIGGER);
        if (atIdx === -1) return { active: false };
        const fragment = before.slice(atIdx + 1);
        if (fragment.includes(" ") || fragment.includes("\n")) return { active: false };
        return { active: true, atIdx, fragment };
    }, []);

    const filterEntities = useCallback(
        (query) => {
            if (!fuse && entities.length === 0) return [];
            if (!query && entities.length > 0) {
                return entities.slice(0, MAX_ITEMS);
            }
            if (!fuse) return [];
            return fuse.search(query).map((r) => r.item).slice(0, MAX_ITEMS);
        },
        [fuse, entities]
    );

    const handleChange = useCallback(
        (e) => {
            const text = e.target.value;
            const caretPos = e.target.selectionStart;
            onChange(text);

            const state = detectMentionState(text, caretPos);
            if (state.active) {
                const query = state.fragment.toLowerCase();
                const filtered = filterEntities(query);
                setMentionQuery(query);
                setTriggerPos(state.atIdx);
                setPopperItems(filtered);
                setHighlightIndex(0);
                setPopperOpen(true);
            } else {
                setPopperOpen(false);
            }
        },
        [onChange, detectMentionState, filterEntities]
    );

    const insertMention = useCallback(
        (entity) => {
            if (!entity) return;
            const token = buildMentionToken(entity.title, entity.id);
            const before = value.slice(0, triggerPos);
            const caretAfterTrigger = triggerPos + 1 + mentionQuery.length;
            const after = value.slice(caretAfterTrigger);
            const newText = before + token + after;
            onChange(newText);
            setPopperOpen(false);

            requestAnimationFrame(() => {
                if (textareaRef.current) {
                    const newCaret = before.length + token.length;
                    textareaRef.current.setSelectionRange(newCaret, newCaret);
                    textareaRef.current.focus();
                }
            });
        },
        [value, triggerPos, mentionQuery, onChange]
    );

    // Scroll active item into view when highlightIndex changes
    useEffect(() => {
        const el = itemRefs.current[highlightIndex];
        if (el) el.scrollIntoView({ block: "nearest" });
    }, [highlightIndex]);

    // Close popper on click outside (but not when clicking the textarea itself)
    useEffect(() => {
        function handleMouseDown(e) {
            if (
                popperRef.current &&
                !popperRef.current.contains(e.target) &&
                textareaRef.current !== e.target
            ) {
                setPopperOpen(false);
            }
        }
        document.addEventListener("mousedown", handleMouseDown);
        return () => document.removeEventListener("mousedown", handleMouseDown);
    }, []);

    // ── Image drag-and-drop ──────────────────────────────────────────────────

    const isImageDragEvent = useCallback((e) => {
        if (!uploadImage) return false;
        const types = Array.from(e.dataTransfer?.types || []);
        if (types.includes("Files")) {
            const items = Array.from(e.dataTransfer?.items || []);
            return items.some((it) => IMAGE_TYPES.includes(it.type));
        }
        return false;
    }, [uploadImage]);

    const handleDragOver = useCallback((e) => {
        if (!isImageDragEvent(e)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "copy";
        setImageDragging(true);
    }, [isImageDragEvent]);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        setImageDragging(false);
    }, []);

    const insertImageMarkdown = useCallback((url, altText) => {
        const md = `![${altText}](${url})`;
        const insertAt = lastCursorRef.current ?? value.length;
        const before = value.slice(0, insertAt);
        const after = value.slice(insertAt);
        // Ensure blank line separation if inserting mid-paragraph
        const prefix = before.length > 0 && !before.endsWith("\n") ? "\n" : "";
        const suffix = after.length > 0 && !after.startsWith("\n") ? "\n" : "";
        onChange(before + prefix + md + suffix + after);
        // Restore focus and move cursor after inserted text
        requestAnimationFrame(() => {
            if (textareaRef.current) {
                const newCaret = insertAt + prefix.length + md.length + suffix.length;
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(newCaret, newCaret);
            }
        });
    }, [value, onChange]);

    const handleDrop = useCallback(async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setImageDragging(false);

        if (!uploadImage) return;
        const file = Array.from(e.dataTransfer.files).find((f) => IMAGE_TYPES.includes(f.type));
        if (!file) return;

        setImageUploading(true);
        try {
            const result = await uploadImage(file);
            onImageUploaded?.(result);
            const altText = file.name.replace(/\.[^.]+$/, "");
            insertImageMarkdown(result.url, altText);
        } catch (err) {
            console.error("Error subiendo imagen inline:", err);
        } finally {
            setImageUploading(false);
        }
    }, [uploadImage, insertImageMarkdown, onImageUploaded]);

    const handleKeyDown = useCallback(
        (e) => {
            if (!popperOpen) return;

            const hasItems = popperItems.length > 0;

            if (e.key === "ArrowDown") {
                e.preventDefault();
                if (hasItems) setHighlightIndex((i) => (i + 1) % popperItems.length);
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                if (hasItems) setHighlightIndex((i) => (i - 1 + popperItems.length) % popperItems.length);
            } else if (e.key === "Enter" || e.key === "Tab") {
                if (hasItems) {
                    e.preventDefault();
                    insertMention(popperItems[highlightIndex]);
                }
            } else if (e.key === "Escape") {
                e.preventDefault();
                setPopperOpen(false);
            }
        },
        [popperOpen, popperItems, highlightIndex, insertMention]
    );

    return (
        <Box sx={{ position: "relative" }}>
            <Box
                sx={{ position: "relative" }}
                onDragOver={uploadImage ? handleDragOver : undefined}
                onDragLeave={uploadImage ? handleDragLeave : undefined}
                onDrop={uploadImage ? handleDrop : undefined}
            >
            <TextField
                inputRef={textareaRef}
                multiline
                rows={rows}
                fullWidth
                label={label}
                placeholder={placeholder || "Escribe @ para mencionar una entidad..."}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onSelect={(e) => { lastCursorRef.current = e.target.selectionStart; }}
                onBlur={(e) => { lastCursorRef.current = e.target.selectionStart; }}
                variant="outlined"
                size="small"
                sx={{
                    ...textFieldSx,
                    ...(imageDragging && {
                        "& .MuiOutlinedInput-root": {
                            ...textFieldSx["& .MuiOutlinedInput-root"],
                            "& fieldset": { borderColor: UI_COLORS.accent, borderWidth: 2 },
                            boxShadow: `0 0 10px ${UI_COLORS.accentGlow}`,
                        },
                    }),
                }}
            />

            {/* Drag-over overlay */}
            {imageDragging && (
                <Box
                    sx={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: `${UI_COLORS.accent}12`,
                        borderRadius: 1,
                        border: `2px dashed ${UI_COLORS.accent}`,
                        pointerEvents: "none",
                        zIndex: 5,
                    }}
                >
                    <CyberText sx={{ color: UI_COLORS.accent, fontSize: "0.78rem", letterSpacing: 2 }}>
                        📷 SOLTAR IMAGEN AQUÍ
                    </CyberText>
                </Box>
            )}

            {/* Uploading spinner overlay */}
            {imageUploading && (
                <Box
                    sx={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: `${UI_COLORS.backgroundSecondary}cc`,
                        borderRadius: 1,
                        zIndex: 6,
                    }}
                >
                    <CircularProgress size={24} sx={{ color: UI_COLORS.accent }} />
                    <CyberText sx={{ color: UI_COLORS.accent, fontSize: "0.72rem", ml: 1.5 }}>
                        Subiendo imagen...
                    </CyberText>
                </Box>
            )}
            </Box>

            {popperOpen && (
                <Paper
                    ref={popperRef}
                    elevation={8}
                    sx={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        left: 0,
                        right: 0,
                        zIndex: 2000,
                        bgcolor: UI_COLORS.backgroundSecondary,
                        border: `1px solid ${UI_COLORS.accent}66`,
                        maxHeight: 220,
                        overflowY: "auto",
                        ...scrollbarSx,
                    }}
                >
                    <List dense disablePadding>
                        {popperItems.length === 0 ? (
                            <Box sx={{ px: 2, py: 1 }}>
                                <CyberText sx={{ fontSize: "0.78rem", color: UI_COLORS.textSecondary }}>
                                    Sin coincidencias
                                </CyberText>
                            </Box>
                        ) : (
                            popperItems.map((ent, idx) => (
                                <ListItemButton
                                    key={ent.id}
                                    ref={(el) => { itemRefs.current[idx] = el; }}
                                    selected={idx === highlightIndex}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        insertMention(ent);
                                    }}
                                    onMouseEnter={() => setHighlightIndex(idx)}
                                    sx={{
                                        px: 1.5,
                                        py: 0.6,
                                        "&:hover": { bgcolor: `${UI_COLORS.accent}18` },
                                        "&.Mui-selected": { bgcolor: `${UI_COLORS.accent}28` },
                                        "&.Mui-selected:hover": { bgcolor: `${UI_COLORS.accent}38` },
                                    }}
                                >
                                    <ListItemText
                                        primary={
                                            <CyberText sx={{ fontSize: "0.82rem", color: UI_COLORS.textPrimary, lineHeight: 1.3 }}>
                                                {ent.title}
                                            </CyberText>
                                        }
                                        secondary={
                                            <CyberText sx={{ fontSize: "0.65rem", color: UI_COLORS.textSecondary, lineHeight: 1.2 }}>
                                                {ent.mentionKind === "vtt-location"
                                                    ? "Mapa · ubicación"
                                                    : ent.mentionKind === "vtt-character"
                                                      ? "Mapa · personaje"
                                                      : ent.entityType || "Archivo"}
                                            </CyberText>
                                        }
                                        disableTypography
                                    />
                                </ListItemButton>
                            ))
                        )}
                    </List>
                </Paper>
            )}
        </Box>
    );
}

const textFieldSx = {
    "& .MuiOutlinedInput-root": {
        bgcolor: UI_COLORS.backgroundPrimary,
        fontFamily: "'Fira Sans', sans-serif",
        fontSize: "0.85rem",
        color: UI_COLORS.textPrimary,
        "& fieldset": { borderColor: UI_COLORS.border },
        "&:hover fieldset": { borderColor: `${UI_COLORS.accent}88` },
        "&.Mui-focused fieldset": {
            borderColor: UI_COLORS.accent,
            boxShadow: `0 0 6px ${UI_COLORS.accentGlow}`,
        },
    },
    "& .MuiInputLabel-root": {
        color: UI_COLORS.textSecondary,
        fontFamily: "'Fira Sans', sans-serif",
        fontSize: "0.8rem",
    },
    "& .MuiInputLabel-root.Mui-focused": { color: UI_COLORS.accent },
    "& textarea": {
        scrollbarWidth: "thin",
        scrollbarColor: `${UI_COLORS.accent} #0d0d14`,
        "&::-webkit-scrollbar": { width: "8px" },
        "&::-webkit-scrollbar-track": { background: "#0d0d14" },
        "&::-webkit-scrollbar-thumb": {
            backgroundImage: `linear-gradient(180deg, ${UI_COLORS.accent} 0%, rgba(0, 242, 234, 0.2) 50%, ${UI_COLORS.accent} 100%)`,
            border: `1px solid ${UI_COLORS.accent}`,
            borderRadius: "4px",
        },
    },
};

const scrollbarSx = CYBER_SCROLL_STYLE;
