import { useState } from "react";
import {
    Box, IconButton, TextField, Dialog, DialogContent, DialogActions, Chip,
} from "@mui/material";
import TimelineIcon from "@mui/icons-material/Timeline";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import EditIcon from "@mui/icons-material/Edit";
import { useDispatch } from "react-redux";
import { CyberText, CyberTitle } from "../customs/CustomTexts";
import CyberTooltip from "../customs/CyberTooltip";
import { UI_COLORS } from "../../constants/uiColors";
import { cyberMenuPaperSx, primaryButtonSx, secondaryButtonSx } from "../../constants/designSystem";
import { saveCampaignNarrativeArcs } from "../../store/wikiSlice";

function newArcId() {
    return `arc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * DM control: manage campaign narrative arcs (catalog + active).
 */
export default function WikiNarrativeArcsControl({
    campaignId,
    uid,
    arcs = [],
    activeArcId = null,
    compact = true,
}) {
    const dispatch = useDispatch();
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [newLabel, setNewLabel] = useState("");

    const start = () => {
        setDraft(arcs.map((a, i) => ({ ...a, order: a.order ?? i })));
        setActiveId(activeArcId);
        setNewLabel("");
        setOpen(true);
    };

    const persist = async (nextArcs, nextActive) => {
        if (!campaignId) return;
        setSaving(true);
        try {
            await dispatch(
                saveCampaignNarrativeArcs({
                    campaignId,
                    narrativeArcs: nextArcs.map((a, i) => ({
                        id: a.id,
                        label: a.label,
                        order: i,
                        color: a.color || null,
                    })),
                    activeNarrativeArcId: nextActive,
                    uid,
                }),
            ).unwrap();
        } catch (err) {
            console.error("Error guardando arcos narrativos:", err);
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        await persist(draft, activeId);
        setOpen(false);
    };

    const addArc = () => {
        const label = newLabel.trim();
        if (!label) return;
        const arc = { id: newArcId(), label, order: draft.length, color: null };
        setDraft((prev) => [...prev, arc]);
        setNewLabel("");
        if (!activeId) setActiveId(arc.id);
    };

    const rename = (id, label) => {
        setDraft((prev) => prev.map((a) => (a.id === id ? { ...a, label } : a)));
    };

    const remove = (id) => {
        setDraft((prev) => prev.filter((a) => a.id !== id));
        if (activeId === id) setActiveId(null);
    };

    const move = (index, dir) => {
        const next = [...draft];
        const j = index + dir;
        if (j < 0 || j >= next.length) return;
        [next[index], next[j]] = [next[j], next[index]];
        setDraft(next);
    };

    const activeLabel = arcs.find((a) => a.id === activeArcId)?.label;

    return (
        <>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <TimelineIcon sx={{ fontSize: "0.9rem", color: UI_COLORS.accent }} />
                {compact && (
                    <CyberText sx={{ fontSize: "0.65rem", color: UI_COLORS.textSecondary, letterSpacing: 0.5 }}>
                        {activeLabel ? `Arco: ${activeLabel}` : arcs.length ? `${arcs.length} arcos` : "Sin arcos"}
                    </CyberText>
                )}
                <CyberTooltip title="Gestionar arcos narrativos (DM)">
                    <IconButton size="small" onClick={start} sx={{ color: UI_COLORS.textSecondary, p: 0.25 }}>
                        <EditIcon sx={{ fontSize: "0.85rem" }} />
                    </IconButton>
                </CyberTooltip>
            </Box>

            <Dialog
                open={open}
                onClose={() => !saving && setOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        ...cyberMenuPaperSx,
                        bgcolor: UI_COLORS.backgroundPrimary,
                    },
                }}
            >
                <DialogContent sx={{ p: 2.5 }}>
                    <CyberTitle sx={{ fontSize: "0.85rem", color: UI_COLORS.accent, letterSpacing: 2, mb: 1.5 }}>
                        ARCOS NARRATIVOS
                    </CyberTitle>
                    <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.textSecondary, mb: 2, lineHeight: 1.5 }}>
                        Define los arcos de historia de la campaña. Los eventos de la TIMELINE se agrupan por arco.
                        Marca uno como activo para filtrar rápido.
                    </CyberText>

                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 2 }}>
                        {draft.length === 0 && (
                            <CyberText sx={{ fontSize: "0.75rem", color: UI_COLORS.textSecondary }}>
                                Ningún arco aún. Crea el primero abajo.
                            </CyberText>
                        )}
                        {draft.map((arc, i) => (
                            <Box
                                key={arc.id}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 0.75,
                                    p: 1,
                                    border: `1px solid ${activeId === arc.id ? UI_COLORS.accent : UI_COLORS.border}`,
                                    bgcolor: UI_COLORS.backgroundSecondary,
                                    borderRadius: 1,
                                }}
                            >
                                <CyberTooltip title={activeId === arc.id ? "Arco activo" : "Marcar activo"}>
                                    <IconButton
                                        size="small"
                                        onClick={() => setActiveId(activeId === arc.id ? null : arc.id)}
                                        sx={{ color: activeId === arc.id ? UI_COLORS.accent : UI_COLORS.textSecondary }}
                                    >
                                        {activeId === arc.id
                                            ? <StarIcon sx={{ fontSize: "1rem" }} />
                                            : <StarBorderIcon sx={{ fontSize: "1rem" }} />}
                                    </IconButton>
                                </CyberTooltip>
                                <TextField
                                    size="small"
                                    value={arc.label}
                                    onChange={(e) => rename(arc.id, e.target.value)}
                                    fullWidth
                                    sx={{
                                        "& .MuiInputBase-input": {
                                            color: UI_COLORS.textPrimary,
                                            fontSize: "0.8rem",
                                            fontFamily: "'Fira Sans', sans-serif",
                                        },
                                        "& .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.border },
                                    }}
                                />
                                <IconButton size="small" disabled={i === 0} onClick={() => move(i, -1)} sx={{ color: UI_COLORS.textSecondary }}>
                                    <ArrowUpwardIcon sx={{ fontSize: "0.95rem" }} />
                                </IconButton>
                                <IconButton size="small" disabled={i === draft.length - 1} onClick={() => move(i, 1)} sx={{ color: UI_COLORS.textSecondary }}>
                                    <ArrowDownwardIcon sx={{ fontSize: "0.95rem" }} />
                                </IconButton>
                                <IconButton size="small" onClick={() => remove(arc.id)} sx={{ color: UI_COLORS.accentStrong }}>
                                    <DeleteOutlineIcon sx={{ fontSize: "1rem" }} />
                                </IconButton>
                            </Box>
                        ))}
                    </Box>

                    <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                        <TextField
                            size="small"
                            placeholder="Nuevo arco…"
                            value={newLabel}
                            onChange={(e) => setNewLabel(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    addArc();
                                }
                            }}
                            fullWidth
                            sx={{
                                "& .MuiInputBase-input": {
                                    color: UI_COLORS.textPrimary,
                                    fontSize: "0.8rem",
                                },
                                "& .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.border },
                            }}
                        />
                        <CyberTooltip title="Añadir arco">
                            <IconButton
                                onClick={addArc}
                                disabled={!newLabel.trim()}
                                sx={{
                                    color: UI_COLORS.anomaly,
                                    border: `1px solid ${UI_COLORS.border}`,
                                    borderRadius: 1,
                                }}
                            >
                                <AddIcon />
                            </IconButton>
                        </CyberTooltip>
                    </Box>

                    {activeId && (
                        <Chip
                            size="small"
                            label={`Activo: ${draft.find((a) => a.id === activeId)?.label || "—"}`}
                            sx={{
                                mt: 1.5,
                                height: 22,
                                bgcolor: `${UI_COLORS.accent}18`,
                                border: `1px solid ${UI_COLORS.accent}55`,
                                color: UI_COLORS.accent,
                                fontFamily: "'Fira Code', monospace",
                                fontSize: "0.62rem",
                            }}
                        />
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
                    <Box
                        component="button"
                        type="button"
                        disabled={saving}
                        onClick={() => setOpen(false)}
                        sx={{ ...secondaryButtonSx, cursor: "pointer" }}
                    >
                        CANCELAR
                    </Box>
                    <Box
                        component="button"
                        type="button"
                        disabled={saving}
                        onClick={handleSave}
                        sx={{ ...primaryButtonSx, cursor: "pointer", opacity: saving ? 0.6 : 1 }}
                    >
                        {saving ? "GUARDANDO…" : "GUARDAR"}
                    </Box>
                </DialogActions>
            </Dialog>
        </>
    );
}
