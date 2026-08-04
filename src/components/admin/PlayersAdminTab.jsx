import { useState, useEffect } from "react";
import {
    Box, Collapse, IconButton, Tooltip, Dialog, DialogTitle, DialogContent,
    DialogActions, Button, Chip, Checkbox, FormControlLabel,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import PersonRemoveIcon from "@mui/icons-material/PersonRemove";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import { useDispatch } from "react-redux";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import { CyberTitle, CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import { ROLES } from "../../constants/roles";
import { showSnackbar } from "../../store/uiSlice";
import AdminSectionShell from "./AdminSectionShell";
import AdminDataRow from "./AdminDataRow";
import AddPlayerForm from "../tabs/subtabs/AddPlayerForm";
import {
    subscribePlayersByCampaign,
    updatePlayerRole,
    removePlayerFromCampaign,
    updatePlayerCharacterRoster,
} from "../../../firebase/services/playerAdminService";

function formatDate(val) {
    if (!val) return "—";
    if (val?.toDate) return val.toDate().toLocaleDateString("es");
    if (typeof val === "string") return new Date(val).toLocaleDateString("es");
    return "—";
}

export default function PlayersAdminTab({ campaignId }) {
    const dispatch = useDispatch();
    const [players, setPlayers] = useState([]);
    const [characters, setCharacters] = useState([]);
    const [enrollOpen, setEnrollOpen] = useState(false);
    const [rosterPlayer, setRosterPlayer] = useState(null);
    const [rosterDraft, setRosterDraft] = useState([]);
    const [revokeTarget, setRevokeTarget] = useState(null);

    useEffect(() => {
        if (!campaignId) return undefined;
        return subscribePlayersByCampaign(campaignId, setPlayers);
    }, [campaignId]);

    useEffect(() => {
        if (!campaignId) return undefined;
        const q = query(collection(db, "characters"), where("campaignId", "==", campaignId));
        return onSnapshot(q, (snap) => {
            setCharacters(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
    }, [campaignId]);

    const handleToggleRole = async (player) => {
        const next = player.role === ROLES.DM ? ROLES.PLAYER : ROLES.DM;
        try {
            await updatePlayerRole(player.uid || player.id, next);
            dispatch(showSnackbar({
                message: `${player.nickname} ahora es ${next === ROLES.DM ? "DJ" : "jugador"}.`,
                severity: "success",
            }));
        } catch (err) {
            dispatch(showSnackbar({ message: "No se pudo cambiar el rol.", severity: "error" }));
        }
    };

    const handleRevoke = async () => {
        if (!revokeTarget || !campaignId) return;
        try {
            await removePlayerFromCampaign(revokeTarget.uid || revokeTarget.id, campaignId);
            dispatch(showSnackbar({
                message: `Acceso revocado para ${revokeTarget.nickname} (soft: la cuenta Auth sigue existiendo).`,
                severity: "info",
            }));
        } catch (err) {
            dispatch(showSnackbar({ message: "Error al revocar acceso.", severity: "error" }));
        } finally {
            setRevokeTarget(null);
        }
    };

    const openRoster = (player) => {
        setRosterPlayer(player);
        setRosterDraft(Array.isArray(player.characterIds) ? [...player.characterIds] : []);
    };

    const saveRoster = async () => {
        if (!rosterPlayer) return;
        const uid = rosterPlayer.uid || rosterPlayer.id;
        const previousIds = Array.isArray(rosterPlayer.characterIds)
            ? [...rosterPlayer.characterIds]
            : [];
        try {
            await updatePlayerCharacterRoster(uid, rosterDraft, previousIds);
            dispatch(showSnackbar({
                message: "Control de tokens actualizado (roster + permisos de movimiento).",
                severity: "success",
            }));
            setRosterPlayer(null);
        } catch (err) {
            console.error(err);
            dispatch(showSnackbar({ message: "Error al guardar personajes.", severity: "error" }));
        }
    };

    const toggleCharInRoster = (charId) => {
        setRosterDraft((prev) =>
            prev.includes(charId) ? prev.filter((id) => id !== charId) : [...prev, charId]
        );
    };

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, height: "100%", minHeight: 0, overflowY: "auto", ...CYBER_SCROLL_STYLE }}>
            <AdminSectionShell
                title="NUEVO ACCESO"
                hint="Crea credenciales y vincula automáticamente a la campaña activa."
            >
                <Box
                    component="button"
                    type="button"
                    onClick={() => setEnrollOpen((v) => !v)}
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        bgcolor: "transparent",
                        border: "none",
                        color: UI_COLORS.accent,
                        cursor: "pointer",
                        fontFamily: "'Orbitron', sans-serif",
                        fontSize: "0.68rem",
                        letterSpacing: 1,
                        p: 0,
                    }}
                >
                    {enrollOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                    {enrollOpen ? "OCULTAR FORMULARIO" : "MOSTRAR FORMULARIO"}
                </Box>
                <Collapse in={enrollOpen}>
                    <AddPlayerForm campaignId={campaignId} onEnrolled={() => setEnrollOpen(false)} />
                </Collapse>
            </AdminSectionShell>

            <AdminSectionShell
                title="ROSTER DE CAMPAÑA"
                hint="Revocar acceso solo quita campaignIds; la cuenta Auth permanece (reset vía scripts)."
            >
                {players.length === 0 && (
                    <CyberText sx={{ fontSize: "0.78rem", color: UI_COLORS.textSecondary }}>
                        No hay jugadores con acceso a esta campaña.
                    </CyberText>
                )}
                {players.map((p) => (
                    <AdminDataRow
                        key={p.id}
                        primary={p.nickname}
                        secondary={`Personajes: ${(p.characterIds || []).length} · Alta: ${formatDate(p.createdAt)}`}
                        meta={
                            <Chip
                                size="small"
                                label={(p.role === ROLES.DM ? "DJ" : "PLAYER").toUpperCase()}
                                sx={{
                                    height: 20,
                                    fontSize: "0.58rem",
                                    bgcolor: p.role === ROLES.DM ? `${UI_COLORS.anomaly}22` : `${UI_COLORS.accent}14`,
                                    color: p.role === ROLES.DM ? UI_COLORS.anomaly : UI_COLORS.accent,
                                    border: `1px solid ${p.role === ROLES.DM ? UI_COLORS.anomaly : UI_COLORS.accent}55`,
                                }}
                            />
                        }
                        actions={
                            <>
                                <Tooltip title="Cambiar rol DJ ↔ jugador">
                                    <IconButton size="small" onClick={() => handleToggleRole(p)} sx={{ color: UI_COLORS.anomaly }}>
                                        <AdminPanelSettingsIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Quién puede mover / desplegar tokens">
                                    <IconButton
                                        size="small"
                                        onClick={() => openRoster(p)}
                                        sx={{ color: UI_COLORS.accent }}
                                    >
                                        <CyberText sx={{ fontSize: "0.62rem", fontWeight: 700 }}>PJ</CyberText>
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Revocar acceso a esta campaña">
                                    <IconButton size="small" onClick={() => setRevokeTarget(p)} sx={{ color: UI_COLORS.accentStrong }}>
                                        <PersonRemoveIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </>
                        }
                    />
                ))}
            </AdminSectionShell>

            <Dialog open={Boolean(revokeTarget)} onClose={() => setRevokeTarget(null)} sx={{ zIndex: 1900 }}>
                <DialogTitle sx={{ bgcolor: UI_COLORS.backgroundSecondary, color: UI_COLORS.textPrimary }}>
                    <CyberTitle sx={{ fontSize: "0.8rem", color: UI_COLORS.accentStrong }}>REVOCAR ACCESO</CyberTitle>
                </DialogTitle>
                <DialogContent sx={{ bgcolor: UI_COLORS.backgroundSecondary }}>
                    <CyberText sx={{ fontSize: "0.8rem", color: UI_COLORS.textPrimary }}>
                        ¿Quitar a <strong>{revokeTarget?.nickname}</strong> de esta campaña? La cuenta seguirá existiendo.
                    </CyberText>
                </DialogContent>
                <DialogActions sx={{ bgcolor: UI_COLORS.backgroundSecondary }}>
                    <Button onClick={() => setRevokeTarget(null)} sx={{ color: UI_COLORS.textSecondary }}>Cancelar</Button>
                    <Button onClick={handleRevoke} sx={{ color: UI_COLORS.accentStrong }}>Revocar</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(rosterPlayer)} onClose={() => setRosterPlayer(null)} maxWidth="xs" fullWidth sx={{ zIndex: 1900 }}>
                <DialogTitle sx={{ bgcolor: UI_COLORS.backgroundSecondary }}>
                    <CyberTitle sx={{ fontSize: "0.78rem", color: UI_COLORS.accent }}>
                        CONTROL DE TOKENS — {rosterPlayer?.nickname?.toUpperCase()}
                    </CyberTitle>
                </DialogTitle>
                <DialogContent sx={{ bgcolor: UI_COLORS.backgroundSecondary, ...CYBER_SCROLL_STYLE }}>
                    <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "0.68rem", mb: 1.5, display: "block" }}>
                        Marca los personajes que este jugador puede mover y desplegar en el mapa. El DJ puede moverlos todos.
                    </CyberText>
                    {characters.length === 0 && (
                        <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "0.78rem" }}>No hay personajes VTT en la campaña.</CyberText>
                    )}
                    {characters.map((c) => (
                        <FormControlLabel
                            key={c.id}
                            control={
                                <Checkbox
                                    size="small"
                                    checked={rosterDraft.includes(c.id)}
                                    onChange={() => toggleCharInRoster(c.id)}
                                    sx={{ color: UI_COLORS.textSecondary, "&.Mui-checked": { color: UI_COLORS.accent } }}
                                />
                            }
                            label={<CyberText sx={{ fontSize: "0.78rem" }}>{c.name || c.id}</CyberText>}
                        />
                    ))}
                </DialogContent>
                <DialogActions sx={{ bgcolor: UI_COLORS.backgroundSecondary }}>
                    <Button onClick={() => setRosterPlayer(null)} sx={{ color: UI_COLORS.textSecondary }}>Cancelar</Button>
                    <Button onClick={saveRoster} sx={{ color: UI_COLORS.accent }}>Guardar</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
