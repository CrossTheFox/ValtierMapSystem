import { useMemo, useState } from "react";
import { Box, Dialog, DialogContent, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

import { UI_COLORS } from "../../constants/uiColors";
import {
    MACRO_PAGE_COUNT,
    MACRO_SLOT_COUNT,
    macroTypeAccent,
    normalizeMacroBar,
    serializeMacroBar,
    setMacroSlot,
} from "../../constants/macroBar";
import { updateCharacterFields } from "../../../firebase/services/characterService";
import { showSnackbar } from "../../store/uiSlice";
import { useDispatch } from "react-redux";
import { RENDER_LAYERS } from "../../constants/renderLayers";

const PICKER_Z = RENDER_LAYERS.WIKI_OVERLAY + 50;

/**
 * Pick a macro page + slot for a dossier pin.
 *
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   character: object|null,
 *   entry: { type: string, id: string, label: string, blurb?: string }|null,
 * }} props
 */
export default function MacroPinPicker({ open, onClose, character, entry }) {
    const dispatch = useDispatch();
    const [page, setPage] = useState(0);
    const [saving, setSaving] = useState(false);

    const bar = useMemo(() => normalizeMacroBar(character?.macroBar), [character?.macroBar]);
    const slots = bar.pages[page] || [];

    const handlePick = async (slotIndex) => {
        if (!character?.id || !entry) return;
        setSaving(true);
        try {
            const next = setMacroSlot(bar, page, slotIndex, entry);
            await updateCharacterFields(character.id, { macroBar: serializeMacroBar(next) });
            dispatch(showSnackbar({
                message: `Macro P${page + 1}·${slotIndex + 1}: ${entry.label || entry.id}`,
                severity: "success",
            }));
            onClose?.();
        } catch (err) {
            console.error(err);
            dispatch(showSnackbar({ message: "No se pudo guardar la macro", severity: "error" }));
        } finally {
            setSaving(false);
        }
    };

    const handleClear = async (slotIndex, e) => {
        e.stopPropagation();
        if (!character?.id) return;
        setSaving(true);
        try {
            const next = setMacroSlot(bar, page, slotIndex, null);
            await updateCharacterFields(character.id, { macroBar: serializeMacroBar(next) });
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="xs"
            fullWidth
            slotProps={{
                backdrop: { sx: { zIndex: PICKER_Z } },
            }}
            PaperProps={{
                sx: {
                    zIndex: PICKER_Z + 1,
                    bgcolor: UI_COLORS.backgroundSecondary,
                    border: `1px solid ${UI_COLORS.border}`,
                    borderRadius: 1,
                    backgroundImage: "none",
                },
            }}
            sx={{ zIndex: PICKER_Z }}
        >
            <Box sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1.5,
                py: 1,
                borderBottom: `1px solid ${UI_COLORS.border}`,
            }}>
                <Box sx={{
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "0.72rem",
                    letterSpacing: "0.12em",
                    color: "#ffffff",
                    flex: 1,
                }}>
                    ASIGNAR A MACRO
                </Box>
                <IconButton size="small" onClick={onClose} sx={{ color: "#ffffff" }}>
                    <CloseIcon fontSize="small" />
                </IconButton>
            </Box>
            <DialogContent sx={{ p: 1.5 }}>
                {entry && (
                    <Box sx={{
                        mb: 1.25,
                        p: "8px 10px",
                        borderRadius: "6px",
                        border: `1px solid ${macroTypeAccent(entry.type)}66`,
                        bgcolor: "rgba(0,0,0,0.35)",
                    }}>
                        <Box sx={{
                            fontFamily: "Orbitron, sans-serif",
                            fontSize: "0.55rem",
                            letterSpacing: "0.1em",
                            color: macroTypeAccent(entry.type),
                            mb: 0.35,
                        }}>
                            {(entry.type || "").toUpperCase()}
                        </Box>
                        <Box sx={{
                            fontFamily: "Orbitron, sans-serif",
                            fontSize: "0.78rem",
                            color: "#ffffff",
                        }}>
                            {entry.label}
                        </Box>
                    </Box>
                )}

                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1.25 }}>
                    {Array.from({ length: MACRO_PAGE_COUNT }, (_, i) => {
                        const filled = (bar.pages[i] || []).filter(Boolean).length;
                        const active = i === page;
                        return (
                            <Box
                                key={i}
                                component="button"
                                type="button"
                                disabled={saving}
                                onClick={() => setPage(i)}
                                sx={{
                                    minWidth: 32,
                                    height: 28,
                                    px: 0.75,
                                    borderRadius: "4px",
                                    border: `1px solid ${active ? UI_COLORS.anomaly : UI_COLORS.border}`,
                                    bgcolor: active ? `${UI_COLORS.anomaly}18` : "rgba(0,0,0,0.35)",
                                    color: active ? UI_COLORS.anomaly : "#ffffff",
                                    fontFamily: "'Fira Code', monospace",
                                    fontSize: "0.62rem",
                                    cursor: "pointer",
                                }}
                            >
                                {i + 1}{filled > 0 ? `·${filled}` : ""}
                            </Box>
                        );
                    })}
                </Box>

                <Box sx={{
                    fontFamily: "'Fira Code', monospace",
                    fontSize: "0.58rem",
                    color: "rgba(255,255,255,0.65)",
                    mb: 0.75,
                }}>
                    Página {page + 1} — elige espacio (ocupados marcados)
                </Box>

                <Box sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(5, 1fr)",
                    gap: 0.65,
                }}>
                    {Array.from({ length: MACRO_SLOT_COUNT }, (_, i) => {
                        const occupied = slots[i];
                        const accent = occupied ? macroTypeAccent(occupied.type) : UI_COLORS.border;
                        return (
                            <Box
                                key={i}
                                component="button"
                                type="button"
                                disabled={saving}
                                onClick={() => handlePick(i)}
                                onContextMenu={(e) => {
                                    if (occupied) handleClear(i, e);
                                    else e.preventDefault();
                                }}
                                title={occupied
                                    ? `${occupied.label} — click reemplaza · RMB vacía`
                                    : `Espacio ${i + 1} vacío`}
                                sx={{
                                    position: "relative",
                                    height: 48,
                                    borderRadius: "6px",
                                    border: `1px solid ${accent}`,
                                    bgcolor: occupied ? `${accent}14` : "rgba(0,0,0,0.4)",
                                    color: "#ffffff",
                                    cursor: "pointer",
                                    fontFamily: "Orbitron, sans-serif",
                                    fontSize: "0.48rem",
                                    letterSpacing: "0.04em",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "2px",
                                    px: 0.35,
                                    "&:hover": {
                                        borderColor: UI_COLORS.accent,
                                        boxShadow: `0 0 12px ${UI_COLORS.accent}33`,
                                    },
                                }}
                            >
                                <Box component="span" sx={{
                                    position: "absolute",
                                    top: 3,
                                    left: 5,
                                    fontFamily: "'Fira Code', monospace",
                                    fontSize: "0.45rem",
                                    color: "rgba(255,255,255,0.4)",
                                }}>
                                    {i + 1}
                                </Box>
                                {occupied ? (
                                    <>
                                        <Box component="span" sx={{ color: accent, fontSize: "0.4rem" }}>
                                            {(occupied.type || "").slice(0, 5).toUpperCase()}
                                        </Box>
                                        <Box component="span" sx={{
                                            maxWidth: "100%",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}>
                                            {(occupied.label || "?").slice(0, 8).toUpperCase()}
                                        </Box>
                                    </>
                                ) : (
                                    <Box component="span" sx={{ color: "rgba(255,255,255,0.35)" }}>+</Box>
                                )}
                            </Box>
                        );
                    })}
                </Box>
            </DialogContent>
        </Dialog>
    );
}
