/**
 * Location-scoped missions (legacy).
 *
 * BACKLOG: Replace this tab with the campaign missions system used in
 * NAR → MISIONES (`campaigns/{id}/missions`, DossierMissionsView). Do not
 * migrate `location.missions[]` until that redesign ships.
 */

import { useState, useMemo } from "react";
import {
    Box,
    IconButton,
    TextField,
    MenuItem,
    Checkbox,
    FormControlLabel,
    Button,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import { useSelector } from "react-redux";

import { CyberTitle, CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { ROLES } from "../../constants/roles";
import { updateCampaignElement } from "../../../firebase/services/campaignService";

const STATUS_LABELS = {
    active: { label: "ACTIVE", color: UI_COLORS.accent },
    completed: { label: "COMPLETED", color: "#4ade80" },
    failed: { label: "FAILED", color: "#f87171" },
    hidden: { label: "HIDDEN", color: UI_COLORS.textSecondary },
};

function MissionStatusChip({ status }) {
    const cfg = STATUS_LABELS[status] || STATUS_LABELS.active;
    return (
        <Box
            component="span"
            sx={{
                fontFamily: "'Fira Code', monospace",
                fontSize: "8px",
                letterSpacing: "0.1em",
                px: 0.75,
                py: 0.25,
                borderRadius: 0.5,
                border: `1px solid ${cfg.color}55`,
                color: cfg.color,
                bgcolor: `${cfg.color}14`,
            }}
        >
            {cfg.label}
        </Box>
    );
}

function objectiveProgress(objectives = []) {
    if (!objectives.length) return 0;
    const done = objectives.filter((o) => o.done).length;
    return Math.round((done / objectives.length) * 100);
}

function newId() {
    return crypto.randomUUID();
}

function emptyMission() {
    return {
        id: newId(),
        title: "Nueva misión",
        status: "active",
        summary: "",
        objectives: [{ id: newId(), text: "", done: false }],
        visibility: "players",
        linkedWikiEntityId: null,
    };
}

export default function LocationMissionsTab({ location }) {
    const role = useSelector((s) => s.player.profile?.role);
    const liveLocation = useSelector((s) => s.world.locations?.[location?.id]) || location;
    const isDM = role === ROLES.DM;

    const missions = useMemo(() => {
        const all = Array.isArray(liveLocation?.missions) ? liveLocation.missions : [];
        if (isDM) return all;
        return all.filter((m) => m.visibility === "players" && m.status !== "hidden");
    }, [liveLocation?.missions, isDM]);

    const [selectedId, setSelectedId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [editDraft, setEditDraft] = useState(null);

    const selected = missions.find((m) => m.id === selectedId) || null;
    const draft = editDraft ?? selected;

    const persistMissions = async (nextMissions) => {
        if (!liveLocation?.id) return;
        setSaving(true);
        try {
            await updateCampaignElement("locations", liveLocation.id, { missions: nextMissions });
        } finally {
            setSaving(false);
        }
    };

    const allMissionsRaw = Array.isArray(liveLocation?.missions) ? liveLocation.missions : [];

    const updateMission = (missionId, patch) => {
        const next = allMissionsRaw.map((m) => (m.id === missionId ? { ...m, ...patch } : m));
        persistMissions(next);
        if (editDraft?.id === missionId) {
            setEditDraft({ ...editDraft, ...patch });
        }
    };

    const handleAddMission = async () => {
        const mission = emptyMission();
        const next = [...allMissionsRaw, mission];
        await persistMissions(next);
        setSelectedId(mission.id);
        setEditDraft(mission);
    };

    const handleDeleteMission = async (missionId) => {
        const next = allMissionsRaw.filter((m) => m.id !== missionId);
        await persistMissions(next);
        if (selectedId === missionId) {
            setSelectedId(null);
            setEditDraft(null);
        }
    };

    const startEdit = (mission) => {
        setSelectedId(mission.id);
        setEditDraft({ ...mission, objectives: mission.objectives?.map((o) => ({ ...o })) || [] });
    };

    const saveDraft = () => {
        if (!draft) return;
        updateMission(draft.id, draft);
        setEditDraft(null);
    };

    const toggleObjective = (objId, done) => {
        if (!draft) return;
        const objectives = (draft.objectives || []).map((o) => (o.id === objId ? { ...o, done } : o));
        const patch = { objectives };
        setEditDraft({ ...draft, ...patch });
        if (!isDM) updateMission(draft.id, patch);
    };

    const addObjective = () => {
        if (!draft) return;
        setEditDraft({
            ...draft,
            objectives: [...(draft.objectives || []), { id: newId(), text: "", done: false }],
        });
    };

    if (!missions.length && !isDM) {
        return (
            <Box sx={{ p: 4, textAlign: "center" }}>
                <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "0.85rem" }}>
                    No hay misiones activas en esta locación.
                </CyberText>
            </Box>
        );
    }

    return (
        <Box sx={{ display: "flex", height: "100%", overflow: "hidden" }}>
            <Box sx={{
                width: selected ? { xs: "100%", md: 280 } : "100%",
                flexShrink: 0,
                borderRight: selected ? `1px solid ${UI_COLORS.border}` : "none",
                overflow: "auto",
                p: 2,
                display: "flex",
                flexDirection: "column",
                gap: 1,
            }}>
                {isDM && (
                    <Button
                        startIcon={<AddIcon />}
                        onClick={handleAddMission}
                        disabled={saving}
                        sx={{
                            mb: 1,
                            alignSelf: "flex-start",
                            fontFamily: "'Fira Code', monospace",
                            fontSize: "10px",
                            color: UI_COLORS.accent,
                            borderColor: UI_COLORS.accent,
                        }}
                        variant="outlined"
                        size="small"
                    >
                        Añadir misión
                    </Button>
                )}

                {missions.length === 0 && isDM && (
                    <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "0.8rem", py: 2 }}>
                        Sin misiones. Usa el botón para crear la primera.
                    </CyberText>
                )}

                {missions.map((mission) => {
                    const progress = objectiveProgress(mission.objectives);
                    const isSelected = selectedId === mission.id;
                    return (
                        <Box
                            key={mission.id}
                            onClick={() => startEdit(mission)}
                            sx={{
                                p: 1.5,
                                borderRadius: 1,
                                border: `1px solid ${isSelected ? UI_COLORS.accent : UI_COLORS.border}`,
                                bgcolor: isSelected ? `${UI_COLORS.accent}08` : UI_COLORS.backgroundSecondary,
                                cursor: "pointer",
                                transition: "border-color 0.2s",
                                "&:hover": { borderColor: UI_COLORS.accent },
                            }}
                        >
                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1, mb: 0.75 }}>
                                <CyberTitle sx={{ fontSize: "11px", letterSpacing: "0.06em", flex: 1 }}>
                                    {mission.title}
                                </CyberTitle>
                                <MissionStatusChip status={mission.status} />
                            </Box>
                            <Box sx={{ height: 3, bgcolor: "rgba(255,255,255,0.06)", borderRadius: 1, overflow: "hidden" }}>
                                <Box sx={{ height: "100%", width: `${progress}%`, bgcolor: UI_COLORS.accent, transition: "width 0.3s" }} />
                            </Box>
                            <CyberText sx={{ fontSize: "9px", color: UI_COLORS.textSecondary, mt: 0.5 }}>
                                {progress}% objetivos
                            </CyberText>
                        </Box>
                    );
                })}
            </Box>

            {selected && draft && (
                <Box sx={{ flex: 1, overflow: "auto", p: 2, minWidth: 0 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                        <CyberTitle sx={{ fontSize: "13px", color: UI_COLORS.accent }}>
                            DETALLE_MISIÓN
                        </CyberTitle>
                        <IconButton size="small" onClick={() => { setSelectedId(null); setEditDraft(null); }}>
                            <CloseIcon sx={{ color: UI_COLORS.textSecondary, fontSize: "1rem" }} />
                        </IconButton>
                    </Box>

                    {isDM ? (
                        <>
                            <TextField
                                fullWidth
                                size="small"
                                label="Título"
                                value={draft.title}
                                onChange={(e) => setEditDraft({ ...draft, title: e.target.value })}
                                sx={{ mb: 1.5 }}
                            />
                            <TextField
                                select
                                fullWidth
                                size="small"
                                label="Estado"
                                value={draft.status}
                                onChange={(e) => setEditDraft({ ...draft, status: e.target.value })}
                                sx={{ mb: 1.5 }}
                            >
                                {Object.keys(STATUS_LABELS).map((k) => (
                                    <MenuItem key={k} value={k}>{STATUS_LABELS[k].label}</MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                select
                                fullWidth
                                size="small"
                                label="Visibilidad"
                                value={draft.visibility}
                                onChange={(e) => setEditDraft({ ...draft, visibility: e.target.value })}
                                sx={{ mb: 1.5 }}
                            >
                                <MenuItem value="players">Jugadores</MenuItem>
                                <MenuItem value="dm_only">Solo DM</MenuItem>
                            </TextField>
                            <TextField
                                fullWidth
                                multiline
                                minRows={3}
                                size="small"
                                label="Resumen"
                                value={draft.summary}
                                onChange={(e) => setEditDraft({ ...draft, summary: e.target.value })}
                                sx={{ mb: 2 }}
                            />
                        </>
                    ) : (
                        <>
                            <Box sx={{ mb: 1.5, display: "flex", gap: 1 }}>
                                <MissionStatusChip status={draft.status} />
                            </Box>
                            {draft.summary && (
                                <CyberText sx={{ fontSize: "0.85rem", color: "#ccc", lineHeight: 1.6, mb: 2 }}>
                                    {draft.summary}
                                </CyberText>
                            )}
                        </>
                    )}

                    <CyberText sx={{ fontFamily: "'Fira Code', monospace", fontSize: "9px", color: UI_COLORS.anomaly, mb: 1 }}>
                        // OBJETIVOS
                    </CyberText>

                    {(draft.objectives || []).map((obj) => (
                        <Box key={obj.id} sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 1 }}>
                            <Checkbox
                                size="small"
                                checked={!!obj.done}
                                onChange={(e) => toggleObjective(obj.id, e.target.checked)}
                                disabled={!isDM}
                                sx={{ color: UI_COLORS.accent, p: 0.5 }}
                            />
                            {isDM ? (
                                <TextField
                                    fullWidth
                                    size="small"
                                    value={obj.text}
                                    onChange={(e) => {
                                        const objectives = draft.objectives.map((o) =>
                                            o.id === obj.id ? { ...o, text: e.target.value } : o
                                        );
                                        setEditDraft({ ...draft, objectives });
                                    }}
                                    placeholder="Objetivo..."
                                />
                            ) : (
                                <CyberText sx={{
                                    fontSize: "0.85rem",
                                    color: obj.done ? UI_COLORS.textSecondary : "#ccc",
                                    textDecoration: obj.done ? "line-through" : "none",
                                    pt: 0.5,
                                }}>
                                    {obj.text || "—"}
                                </CyberText>
                            )}
                        </Box>
                    ))}

                    {isDM && (
                        <Box sx={{ display: "flex", gap: 1, mt: 2, flexWrap: "wrap" }}>
                            <Button size="small" onClick={addObjective} sx={{ fontSize: "10px", color: UI_COLORS.accent }}>
                                + Objetivo
                            </Button>
                            <Button
                                size="small"
                                variant="contained"
                                onClick={saveDraft}
                                disabled={saving}
                                sx={{ fontSize: "10px", bgcolor: UI_COLORS.accent, color: "#000" }}
                            >
                                Guardar
                            </Button>
                            <Button
                                size="small"
                                color="error"
                                onClick={() => handleDeleteMission(draft.id)}
                                disabled={saving}
                                sx={{ fontSize: "10px" }}
                            >
                                Eliminar
                            </Button>
                        </Box>
                    )}
                </Box>
            )}
        </Box>
    );
}
