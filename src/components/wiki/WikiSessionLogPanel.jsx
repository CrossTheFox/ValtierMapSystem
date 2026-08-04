import { useState, useEffect, useCallback } from "react";
import {
    Box, Button, TextField, IconButton, Stack, Chip, Dialog,
    DialogTitle, DialogContent, DialogActions,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import { CyberTitle, CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import {
    listSessionLogs,
    createSessionLog,
    updateSessionLog,
    deleteSessionLog,
} from "../../../firebase/services/sessionLogService";

export default function WikiSessionLogPanel({ campaignId, readOnly }) {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ title: "", recap: "", sessionDate: "", participants: "" });

    const reload = useCallback(async () => {
        if (!campaignId) return;
        setLoading(true);
        try {
            const rows = await listSessionLogs(campaignId);
            setSessions(rows);
        } finally {
            setLoading(false);
        }
    }, [campaignId]);

    useEffect(() => { reload(); }, [reload]);

    const openNew = () => {
        setEditing(null);
        setForm({
            title: `Sesión ${sessions.length + 1}`,
            recap: "",
            sessionDate: new Date().toISOString().slice(0, 10),
            participants: "",
        });
        setEditorOpen(true);
    };

    const openEdit = (session) => {
        setEditing(session);
        setForm({
            title: session.title ?? "",
            recap: session.recap ?? "",
            sessionDate: session.sessionDate ?? "",
            participants: (session.participants ?? []).join(", "),
        });
        setEditorOpen(true);
    };

    const handleSave = async () => {
        const payload = {
            title: form.title.trim(),
            recap: form.recap.trim(),
            sessionDate: form.sessionDate,
            participants: form.participants.split(",").map((s) => s.trim()).filter(Boolean),
        };
        if (editing) {
            await updateSessionLog(campaignId, editing.id, payload);
        } else {
            await createSessionLog(campaignId, payload);
        }
        setEditorOpen(false);
        reload();
    };

    const handleDelete = async (id) => {
        await deleteSessionLog(campaignId, id);
        reload();
    };

    return (
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1.5, borderBottom: `1px solid ${UI_COLORS.border}` }}>
                <CyberTitle sx={{ fontSize: "0.75rem", color: UI_COLORS.anomaly, letterSpacing: 2, flex: 1 }}>
                    DIARIO DE SESIÓN
                </CyberTitle>
                {!readOnly && (
                    <Button size="small" startIcon={<AddIcon />} onClick={openNew}
                        sx={{ fontSize: "0.65rem", color: UI_COLORS.anomaly, borderColor: UI_COLORS.anomaly }}
                        variant="outlined">
                        NUEVA
                    </Button>
                )}
            </Box>

            <Box sx={{ flex: 1, overflowY: "auto", px: 2, py: 1.5, ...CYBER_SCROLL_STYLE }}>
                {loading && (
                    <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "0.8rem" }}>Cargando…</CyberText>
                )}
                {!loading && sessions.length === 0 && (
                    <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "0.8rem" }}>
                        Aún no hay sesiones registradas. El diario alimenta el contexto del Lab IA.
                    </CyberText>
                )}
                {sessions.map((s) => (
                    <Box key={s.id} sx={{ mb: 1.5, p: 1.5, border: `1px solid ${UI_COLORS.border}`, borderRadius: 1, bgcolor: `${UI_COLORS.backgroundPrimary}aa` }}>
                        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <CyberTitle sx={{ fontSize: "0.8rem", color: UI_COLORS.accent }}>{s.title}</CyberTitle>
                                {s.sessionDate && (
                                    <Chip label={s.sessionDate} size="small" sx={{ height: 18, fontSize: "0.55rem", mt: 0.5 }} />
                                )}
                                <CyberText sx={{ fontSize: "0.78rem", color: UI_COLORS.textPrimary, mt: 1, whiteSpace: "pre-wrap" }}>
                                    {s.recap || "Sin recap."}
                                </CyberText>
                            </Box>
                            {!readOnly && (
                                <Stack direction="row" spacing={0.25}>
                                    <IconButton size="small" onClick={() => openEdit(s)} sx={{ color: UI_COLORS.textSecondary }}>
                                        <EditIcon sx={{ fontSize: "0.95rem" }} />
                                    </IconButton>
                                    <IconButton size="small" onClick={() => handleDelete(s.id)} sx={{ color: UI_COLORS.accentStrong }}>
                                        <DeleteOutlineIcon sx={{ fontSize: "0.95rem" }} />
                                    </IconButton>
                                </Stack>
                            )}
                        </Box>
                    </Box>
                ))}
            </Box>

            <Dialog open={editorOpen} onClose={() => setEditorOpen(false)} PaperProps={{ sx: { bgcolor: UI_COLORS.backgroundSecondary, border: `1px solid ${UI_COLORS.border}`, minWidth: 420 } }}>
                <DialogTitle sx={{ color: UI_COLORS.anomaly, fontFamily: "'Orbitron', sans-serif", fontSize: "0.85rem" }}>
                    {editing ? "EDITAR SESIÓN" : "NUEVA SESIÓN"}
                </DialogTitle>
                <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1.5, pt: 1 }}>
                    <TextField label="Título" size="small" fullWidth value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                    <TextField label="Fecha" size="small" type="date" fullWidth value={form.sessionDate} onChange={(e) => setForm((f) => ({ ...f, sessionDate: e.target.value }))} InputLabelProps={{ shrink: true }} />
                    <TextField label="Participantes (coma)" size="small" fullWidth value={form.participants} onChange={(e) => setForm((f) => ({ ...f, participants: e.target.value }))} />
                    <TextField label="Recap" multiline minRows={4} fullWidth value={form.recap} onChange={(e) => setForm((f) => ({ ...f, recap: e.target.value }))} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditorOpen(false)} sx={{ color: UI_COLORS.textSecondary }}>Cancelar</Button>
                    <Button onClick={handleSave} variant="contained" sx={{ bgcolor: UI_COLORS.accent, color: "#000" }}>Guardar</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
