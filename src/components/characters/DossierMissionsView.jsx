/**
 * NAR → MISIONES: campaign missions (generic + personal) for the open character.
 * DM creates/edits/progress; players read-only.
 *
 * BACKLOG: replace LocationMissionsTab (location.missions[]) with this campaign
 * missions system once the location Info card is redesigned.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Box,
    Button,
    Checkbox,
    Chip,
    CircularProgress,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    OutlinedInput,
    Select,
    TextField,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useSelector } from "react-redux";

import { CyberText, CyberTitle } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import { cyberMenuItemSx, cyberMenuPaperSx } from "../../constants/designSystem";
import {
    MISSION_CLOCK_SIZES,
    MISSION_SCOPE,
    MISSION_STATUS,
    MISSION_STATUS_LABELS,
    filterMissionsForCharacter,
    missionProgressPercent,
    withClockFilled,
    withObjectiveDone,
} from "../../utils/campaignMissions";
import { buildCampaignCharacterMap } from "../../utils/characterCombat";
import {
    createCampaignMission,
    deleteCampaignMission,
    saveCampaignMission,
    subscribeCampaignMissions,
} from "../../../firebase/services/missionService";

const NAR_ACCENT = UI_COLORS.accentStrong;

const fieldSx = {
    "& .MuiOutlinedInput-root": {
        color: UI_COLORS.textPrimary,
        fontFamily: '"Fira Sans", sans-serif',
        fontSize: "0.78rem",
        bgcolor: "rgba(8,8,14,0.55)",
        "& fieldset": { borderColor: UI_COLORS.border },
        "&:hover fieldset": { borderColor: `${NAR_ACCENT}66` },
        "&.Mui-focused fieldset": { borderColor: NAR_ACCENT },
    },
    "& .MuiInputBase-input": { color: UI_COLORS.textPrimary },
    "& .MuiInputLabel-root": { color: UI_COLORS.textSecondary },
    "& .MuiFormHelperText-root": { color: UI_COLORS.textSecondary },
};

const STATUS_COLORS = {
    [MISSION_STATUS.ACTIVE]: UI_COLORS.anomaly,
    [MISSION_STATUS.COMPLETED]: UI_COLORS.boon,
    [MISSION_STATUS.FAILED]: UI_COLORS.danger,
    [MISSION_STATUS.HIDDEN]: UI_COLORS.textSecondary,
};

function MissionClockBar({ clockSize, clockFilled, onSegmentClick, canEdit }) {
    const size = clockSize || 4;
    const filled = Math.max(0, Math.min(size, clockFilled || 0));
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.35 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <CyberText
                    sx={{
                        fontFamily: "'Orbitron', sans-serif",
                        fontSize: "0.55rem",
                        letterSpacing: "0.1em",
                        color: UI_COLORS.anomaly,
                    }}
                >
                    PROGRESO {filled}/{size}
                </CyberText>
                <CyberText sx={{ fontSize: "0.55rem", color: UI_COLORS.textSecondary }}>
                    {missionProgressPercent({ clockSize: size, clockFilled: filled })}%
                </CyberText>
            </Box>
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${size}, 1fr)`,
                    gap: "3px",
                    height: 14,
                }}
            >
                {Array.from({ length: size }, (_, i) => {
                    const on = i < filled;
                    return (
                        <Box
                            key={i}
                            component={canEdit ? "button" : "div"}
                            type={canEdit ? "button" : undefined}
                            onClick={canEdit ? () => onSegmentClick?.(i + 1 === filled ? i : i + 1) : undefined}
                            sx={{
                                border: `1px solid ${on ? `${UI_COLORS.anomaly}99` : UI_COLORS.border}`,
                                borderRadius: "2px",
                                bgcolor: on ? `${UI_COLORS.anomaly}55` : "rgba(0,0,0,0.35)",
                                boxShadow: on ? `0 0 8px ${UI_COLORS.anomaly}44` : "none",
                                cursor: canEdit ? "pointer" : "default",
                                p: 0,
                                minWidth: 0,
                                "&:hover": canEdit
                                    ? { borderColor: UI_COLORS.anomaly, bgcolor: `${UI_COLORS.anomaly}33` }
                                    : undefined,
                            }}
                        />
                    );
                })}
            </Box>
        </Box>
    );
}

function StatusChip({ status }) {
    const color = STATUS_COLORS[status] || UI_COLORS.textSecondary;
    return (
        <Chip
            label={MISSION_STATUS_LABELS[status] || status}
            size="small"
            sx={{
                height: 18,
                fontSize: "0.48rem",
                fontFamily: "'Orbitron', sans-serif",
                letterSpacing: "0.06em",
                color,
                border: `1px solid ${color}77`,
                bgcolor: `${color}14`,
                "& .MuiChip-label": { px: 0.6 },
            }}
        />
    );
}

export default function DossierMissionsView({
    character,
    campaignId,
    isDM = false,
}) {
    const uid = useSelector((s) => s.player.profile?.uid);
    const charactersById = useSelector((s) => s.world.charactersById ?? {});
    const locations = useSelector((s) => s.world.locations);
    const sheetCharacters = useSelector((s) => s.characters.list);

    const [missions, setMissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedId, setSelectedId] = useState(null);
    const [draft, setDraft] = useState(null);
    const [saving, setSaving] = useState(false);

    const characterId = character?.id || null;

    const roster = useMemo(
        () => [...buildCampaignCharacterMap(charactersById, locations, sheetCharacters, campaignId).values()],
        [charactersById, locations, sheetCharacters, campaignId]
    );

    useEffect(() => {
        if (!campaignId) {
            setMissions([]);
            setLoading(false);
            return undefined;
        }
        setLoading(true);
        setError(null);
        const unsub = subscribeCampaignMissions(
            campaignId,
            (list) => {
                setMissions(list);
                setLoading(false);
            },
            (err) => {
                const code = err?.code || "";
                const msg = code === "permission-denied"
                    || /insufficient permissions/i.test(err?.message || "")
                    ? "Sin permiso para leer misiones. Si sos DM, pedí desplegar firestore.rules (colección missions)."
                    : (err?.message || "No se pudieron cargar las misiones");
                setError(msg);
                setLoading(false);
            }
        );
        return unsub;
    }, [campaignId]);

    const visible = useMemo(
        () => filterMissionsForCharacter(missions, characterId, { isDM }),
        [missions, characterId, isDM]
    );

    const selected = useMemo(() => {
        if (draft?.id) return draft;
        return visible.find((m) => m.id === selectedId) || null;
    }, [draft, visible, selectedId]);

    const persist = useCallback(async (mission) => {
        if (!isDM || !campaignId || !mission?.id) return;
        setSaving(true);
        try {
            await saveCampaignMission(campaignId, mission, uid);
            setDraft(null);
        } catch (err) {
            console.error("[DossierMissionsView] save", err);
            setError(err?.message || "No se pudo guardar la misión");
        } finally {
            setSaving(false);
        }
    }, [isDM, campaignId, uid]);

    const handleCreate = async (scope) => {
        if (!isDM || !campaignId) return;
        setSaving(true);
        try {
            const created = await createCampaignMission(campaignId, {
                scope,
                title: scope === MISSION_SCOPE.PERSONAL ? "Misión personal" : "Misión general",
                assigneeCharacterIds: scope === MISSION_SCOPE.PERSONAL && characterId
                    ? [characterId]
                    : [],
                clockSize: 4,
            }, uid);
            setSelectedId(created.id);
            setDraft(created);
        } catch (err) {
            console.error("[DossierMissionsView] create", err);
            setError(err?.message || "No se pudo crear la misión");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (missionId) => {
        if (!isDM || !campaignId || !missionId) return;
        setSaving(true);
        try {
            await deleteCampaignMission(campaignId, missionId);
            if (selectedId === missionId) {
                setSelectedId(null);
                setDraft(null);
            }
        } catch (err) {
            setError(err?.message || "No se pudo borrar la misión");
        } finally {
            setSaving(false);
        }
    };

    const startEdit = (mission) => {
        setSelectedId(mission.id);
        setDraft(isDM ? { ...mission } : null);
    };

    const patchDraft = (partial) => {
        if (!isDM || !selected) return;
        setDraft((prev) => {
            const base = prev || selected;
            return { ...base, ...partial };
        });
    };

    const toggleObjective = async (objectiveId, done) => {
        if (!isDM || !selected) return;
        const next = withObjectiveDone(selected, objectiveId, done);
        setDraft(next);
        await persist(next);
    };

    const setClock = async (filled) => {
        if (!isDM || !selected) return;
        const next = withClockFilled(selected, filled);
        setDraft(next);
        await persist(next);
    };

    if (loading) {
        return (
            <Box sx={{ flex: 1, display: "grid", placeItems: "center", minHeight: 200 }}>
                <CircularProgress size={26} sx={{ color: NAR_ACCENT }} />
            </Box>
        );
    }

    return (
        <Box
            sx={{
                flex: 1,
                minHeight: 0,
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "minmax(240px, 0.9fr) minmax(0, 1.1fr)" },
                gap: 1.5,
                overflow: "hidden",
            }}
        >
            <Box
                sx={{
                    minHeight: 0,
                    overflow: "auto",
                    ...CYBER_SCROLL_STYLE,
                    borderRight: { md: `1px solid ${UI_COLORS.border}` },
                    pr: { md: 1 },
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1 }}>
                    <CyberTitle sx={{ fontSize: "0.7rem", letterSpacing: "0.14em", color: NAR_ACCENT }}>
                        MISIONES
                    </CyberTitle>
                    <CyberText sx={{ fontSize: "0.55rem", color: UI_COLORS.textSecondary }}>
                        {visible.length}
                    </CyberText>
                    <Box sx={{ flex: 1 }} />
                    {isDM && (
                        <>
                            <IconButton
                                size="small"
                                disabled={saving}
                                onClick={() => handleCreate(MISSION_SCOPE.PERSONAL)}
                                title="Nueva personal"
                                sx={{ color: NAR_ACCENT, border: `1px solid ${NAR_ACCENT}55`, borderRadius: "4px" }}
                            >
                                <AddIcon sx={{ fontSize: "1rem" }} />
                            </IconButton>
                            <Button
                                size="small"
                                disabled={saving}
                                onClick={() => handleCreate(MISSION_SCOPE.GENERIC)}
                                sx={{
                                    minWidth: 0,
                                    px: 0.8,
                                    fontSize: "0.5rem",
                                    fontFamily: "'Orbitron', sans-serif",
                                    color: UI_COLORS.anomaly,
                                    border: `1px solid ${UI_COLORS.anomaly}55`,
                                    textTransform: "none",
                                }}
                            >
                                + GENERAL
                            </Button>
                        </>
                    )}
                </Box>

                {error && (
                    <CyberText sx={{ fontSize: "0.7rem", color: UI_COLORS.danger, mb: 1 }}>
                        {error}
                    </CyberText>
                )}

                {!visible.length && (
                    <CyberText sx={{ fontSize: "0.75rem", color: UI_COLORS.textSecondary, lineHeight: 1.5 }}>
                        {isDM
                            ? "Sin misiones. Creá una personal (para este PJ) o una general (toda la mesa)."
                            : "No hay misiones activas para este personaje."}
                    </CyberText>
                )}

                {visible.map((m) => {
                    const on = m.id === (selected?.id || selectedId);
                    return (
                        <Box
                            key={m.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => startEdit(m)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    startEdit(m);
                                }
                            }}
                            sx={{
                                mb: 0.65,
                                p: 1,
                                borderRadius: "6px",
                                border: on
                                    ? `1px solid ${NAR_ACCENT}77`
                                    : `1px solid ${UI_COLORS.border}`,
                                bgcolor: on ? `${NAR_ACCENT}12` : "rgba(8,8,14,0.45)",
                                cursor: "pointer",
                                "&:hover": { borderColor: `${NAR_ACCENT}55` },
                            }}
                        >
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.55 }}>
                                <CyberTitle
                                    sx={{
                                        fontSize: "0.68rem",
                                        color: UI_COLORS.textPrimary,
                                        flex: 1,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {m.title}
                                </CyberTitle>
                                <StatusChip status={m.status} />
                            </Box>
                            <Box sx={{ display: "flex", gap: 0.5, mb: 0.65, flexWrap: "wrap" }}>
                                <Chip
                                    label={m.scope === MISSION_SCOPE.PERSONAL ? "PERSONAL" : "GENERAL"}
                                    size="small"
                                    sx={{
                                        height: 16,
                                        fontSize: "0.45rem",
                                        fontFamily: "'Orbitron', sans-serif",
                                        color: m.scope === MISSION_SCOPE.PERSONAL
                                            ? NAR_ACCENT
                                            : UI_COLORS.anomaly,
                                        border: `1px solid ${
                                            m.scope === MISSION_SCOPE.PERSONAL
                                                ? NAR_ACCENT
                                                : UI_COLORS.anomaly
                                        }66`,
                                        bgcolor: "transparent",
                                        "& .MuiChip-label": { px: 0.5 },
                                    }}
                                />
                            </Box>
                            <MissionClockBar
                                clockSize={m.clockSize}
                                clockFilled={m.clockFilled}
                                canEdit={false}
                            />
                        </Box>
                    );
                })}
            </Box>

            <Box
                sx={{
                    minHeight: 0,
                    overflow: "auto",
                    ...CYBER_SCROLL_STYLE,
                    pl: { md: 0.5 },
                }}
            >
                {!selected ? (
                    <Box sx={{ display: "grid", placeItems: "center", minHeight: 180 }}>
                        <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "0.8rem" }}>
                            Seleccioná una misión para ver el detalle.
                        </CyberText>
                    </Box>
                ) : (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                            <CyberTitle sx={{ fontSize: "0.72rem", color: NAR_ACCENT, letterSpacing: "0.12em" }}>
                                DETALLE
                            </CyberTitle>
                            <Box sx={{ flex: 1 }} />
                            {isDM && (
                                <>
                                    <Button
                                        size="small"
                                        disabled={saving || !draft}
                                        onClick={() => persist(draft || selected)}
                                        sx={{
                                            fontSize: "0.55rem",
                                            fontFamily: "'Orbitron', sans-serif",
                                            color: UI_COLORS.boon,
                                            border: `1px solid ${UI_COLORS.boon}66`,
                                            textTransform: "none",
                                        }}
                                    >
                                        GUARDAR
                                    </Button>
                                    <IconButton
                                        size="small"
                                        disabled={saving}
                                        onClick={() => handleDelete(selected.id)}
                                        sx={{ color: UI_COLORS.danger }}
                                    >
                                        <DeleteOutlineIcon fontSize="small" />
                                    </IconButton>
                                </>
                            )}
                        </Box>

                        {isDM ? (
                            <>
                                <TextField
                                    label="Título"
                                    size="small"
                                    fullWidth
                                    value={selected.title || ""}
                                    onChange={(e) => patchDraft({ title: e.target.value })}
                                    sx={fieldSx}
                                />
                                <TextField
                                    label="Resumen"
                                    size="small"
                                    fullWidth
                                    multiline
                                    minRows={2}
                                    value={selected.summary || ""}
                                    onChange={(e) => patchDraft({ summary: e.target.value })}
                                    sx={fieldSx}
                                />
                                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                                    <FormControl size="small" sx={fieldSx}>
                                        <InputLabel sx={{ color: UI_COLORS.textSecondary }}>Ámbito</InputLabel>
                                        <Select
                                            label="Ámbito"
                                            value={selected.scope}
                                            onChange={(e) => {
                                                const scope = e.target.value;
                                                patchDraft({
                                                    scope,
                                                    assigneeCharacterIds: scope === MISSION_SCOPE.GENERIC
                                                        ? []
                                                        : (selected.assigneeCharacterIds?.length
                                                            ? selected.assigneeCharacterIds
                                                            : (characterId ? [characterId] : [])),
                                                });
                                            }}
                                            MenuProps={{ PaperProps: { sx: cyberMenuPaperSx } }}
                                        >
                                            <MenuItem value={MISSION_SCOPE.GENERIC} sx={cyberMenuItemSx}>General</MenuItem>
                                            <MenuItem value={MISSION_SCOPE.PERSONAL} sx={cyberMenuItemSx}>Personal</MenuItem>
                                        </Select>
                                    </FormControl>
                                    <FormControl size="small" sx={fieldSx}>
                                        <InputLabel sx={{ color: UI_COLORS.textSecondary }}>Estado</InputLabel>
                                        <Select
                                            label="Estado"
                                            value={selected.status}
                                            onChange={(e) => patchDraft({ status: e.target.value })}
                                            MenuProps={{ PaperProps: { sx: cyberMenuPaperSx } }}
                                        >
                                            {Object.values(MISSION_STATUS).map((st) => (
                                                <MenuItem key={st} value={st} sx={cyberMenuItemSx}>
                                                    {MISSION_STATUS_LABELS[st]}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                    <FormControl size="small" sx={fieldSx}>
                                        <InputLabel sx={{ color: UI_COLORS.textSecondary }}>Clock</InputLabel>
                                        <Select
                                            label="Clock"
                                            value={selected.clockSize}
                                            onChange={(e) => {
                                                const clockSize = Number(e.target.value);
                                                patchDraft({
                                                    clockSize,
                                                    clockFilled: Math.min(selected.clockFilled || 0, clockSize),
                                                });
                                            }}
                                            MenuProps={{ PaperProps: { sx: cyberMenuPaperSx } }}
                                        >
                                            {MISSION_CLOCK_SIZES.map((n) => (
                                                <MenuItem key={n} value={n} sx={cyberMenuItemSx}>
                                                    {n} segmentos
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                    {selected.scope === MISSION_SCOPE.PERSONAL && (
                                        <FormControl size="small" sx={fieldSx}>
                                            <InputLabel sx={{ color: UI_COLORS.textSecondary }}>Asignados</InputLabel>
                                            <Select
                                                multiple
                                                label="Asignados"
                                                value={selected.assigneeCharacterIds || []}
                                                onChange={(e) => patchDraft({
                                                    assigneeCharacterIds: e.target.value,
                                                })}
                                                input={<OutlinedInput label="Asignados" />}
                                                renderValue={(ids) => ids
                                                    .map((id) => roster.find((c) => c.id === id)?.name || id)
                                                    .join(", ")}
                                                MenuProps={{
                                                    PaperProps: {
                                                        sx: { ...cyberMenuPaperSx, ...CYBER_SCROLL_STYLE, maxHeight: 280 },
                                                    },
                                                }}
                                            >
                                                {roster.map((c) => (
                                                    <MenuItem key={c.id} value={c.id} sx={cyberMenuItemSx}>
                                                        <Checkbox
                                                            checked={(selected.assigneeCharacterIds || []).includes(c.id)}
                                                            sx={{ color: UI_COLORS.textSecondary, "&.Mui-checked": { color: NAR_ACCENT } }}
                                                        />
                                                        {c.name || c.id}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    )}
                                </Box>
                                <TextField
                                    label="Quién / qué la dio"
                                    size="small"
                                    fullWidth
                                    value={selected.grantedBy || ""}
                                    onChange={(e) => patchDraft({ grantedBy: e.target.value })}
                                    sx={fieldSx}
                                />
                                <TextField
                                    label="Recompensa"
                                    size="small"
                                    fullWidth
                                    value={selected.reward || ""}
                                    onChange={(e) => patchDraft({ reward: e.target.value })}
                                    sx={fieldSx}
                                />
                            </>
                        ) : (
                            <>
                                <CyberTitle sx={{ fontSize: "0.95rem", color: UI_COLORS.textPrimary }}>
                                    {selected.title}
                                </CyberTitle>
                                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                                    <StatusChip status={selected.status} />
                                    <Chip
                                        label={selected.scope === MISSION_SCOPE.PERSONAL ? "PERSONAL" : "GENERAL"}
                                        size="small"
                                        sx={{
                                            height: 18,
                                            fontSize: "0.48rem",
                                            color: UI_COLORS.textPrimary,
                                            border: `1px solid ${UI_COLORS.border}`,
                                            bgcolor: "transparent",
                                        }}
                                    />
                                </Box>
                                {selected.summary && (
                                    <CyberText sx={{ fontSize: "0.8rem", color: UI_COLORS.textPrimary, lineHeight: 1.55 }}>
                                        {selected.summary}
                                    </CyberText>
                                )}
                                {(selected.grantedBy || selected.reward) && (
                                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.35 }}>
                                        {selected.grantedBy && (
                                            <CyberText sx={{ fontSize: "0.7rem", color: UI_COLORS.textSecondary }}>
                                                Otorgada por: {selected.grantedBy}
                                            </CyberText>
                                        )}
                                        {selected.reward && (
                                            <CyberText sx={{ fontSize: "0.7rem", color: UI_COLORS.boon }}>
                                                Recompensa: {selected.reward}
                                            </CyberText>
                                        )}
                                    </Box>
                                )}
                            </>
                        )}

                        <MissionClockBar
                            clockSize={selected.clockSize}
                            clockFilled={selected.clockFilled}
                            canEdit={isDM}
                            onSegmentClick={(filled) => setClock(filled)}
                        />

                        <CyberTitle sx={{ fontSize: "0.62rem", letterSpacing: "0.12em", color: UI_COLORS.textSecondary, mt: 0.5 }}>
                            OBJETIVOS
                        </CyberTitle>
                        {(selected.objectives || []).map((obj, idx) => (
                            <Box
                                key={obj.id}
                                sx={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: 0.75,
                                    p: 0.75,
                                    borderRadius: "4px",
                                    border: `1px solid ${UI_COLORS.border}`,
                                    bgcolor: "rgba(0,0,0,0.25)",
                                }}
                            >
                                <Checkbox
                                    size="small"
                                    checked={Boolean(obj.done)}
                                    disabled={!isDM || saving}
                                    onChange={(e) => toggleObjective(obj.id, e.target.checked)}
                                    sx={{
                                        color: UI_COLORS.textSecondary,
                                        "&.Mui-checked": { color: UI_COLORS.boon },
                                        pt: 0.25,
                                    }}
                                />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    {isDM ? (
                                        <Box sx={{ display: "flex", gap: 0.75 }}>
                                            <TextField
                                                size="small"
                                                fullWidth
                                                placeholder={`Objetivo ${idx + 1}`}
                                                value={obj.text}
                                                onChange={(e) => {
                                                    const objectives = selected.objectives.map((o) =>
                                                        o.id === obj.id ? { ...o, text: e.target.value } : o
                                                    );
                                                    patchDraft({ objectives });
                                                }}
                                                sx={fieldSx}
                                            />
                                            <TextField
                                                size="small"
                                                type="number"
                                                label="Peso"
                                                value={obj.weight}
                                                onChange={(e) => {
                                                    const weight = Math.max(1, Math.min(12, Number(e.target.value) || 1));
                                                    const objectives = selected.objectives.map((o) =>
                                                        o.id === obj.id ? { ...o, weight } : o
                                                    );
                                                    patchDraft({ objectives });
                                                }}
                                                sx={{ ...fieldSx, width: 88 }}
                                                inputProps={{ min: 1, max: 12 }}
                                            />
                                            <IconButton
                                                size="small"
                                                disabled={selected.objectives.length <= 1}
                                                onClick={() => {
                                                    patchDraft({
                                                        objectives: selected.objectives.filter((o) => o.id !== obj.id),
                                                    });
                                                }}
                                                sx={{ color: UI_COLORS.textSecondary }}
                                            >
                                                <DeleteOutlineIcon sx={{ fontSize: "1rem" }} />
                                            </IconButton>
                                        </Box>
                                    ) : (
                                        <>
                                            <CyberText
                                                sx={{
                                                    fontSize: "0.8rem",
                                                    color: obj.done ? UI_COLORS.textSecondary : UI_COLORS.textPrimary,
                                                    textDecoration: obj.done ? "line-through" : "none",
                                                }}
                                            >
                                                {obj.text || "—"}
                                            </CyberText>
                                            <CyberText sx={{ fontSize: "0.58rem", color: UI_COLORS.textSecondary }}>
                                                +{obj.weight} al clock
                                            </CyberText>
                                        </>
                                    )}
                                </Box>
                            </Box>
                        ))}
                        {isDM && (
                            <Button
                                size="small"
                                onClick={() => {
                                    const objectives = [
                                        ...(selected.objectives || []),
                                        { id: crypto.randomUUID(), text: "", weight: 1, done: false },
                                    ];
                                    patchDraft({ objectives });
                                }}
                                sx={{
                                    alignSelf: "flex-start",
                                    fontSize: "0.55rem",
                                    fontFamily: "'Orbitron', sans-serif",
                                    color: UI_COLORS.anomaly,
                                    textTransform: "none",
                                }}
                            >
                                + OBJETIVO
                            </Button>
                        )}
                    </Box>
                )}
            </Box>
        </Box>
    );
}
