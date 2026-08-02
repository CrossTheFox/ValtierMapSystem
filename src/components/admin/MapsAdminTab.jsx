import { useState, useEffect } from "react";
import {
    Box, Stack, Grid, IconButton, Tooltip, Dialog, DialogTitle,
    DialogContent, DialogActions, Button, Collapse,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PublicIcon from "@mui/icons-material/Public";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useDispatch, useSelector } from "react-redux";
import { CyberInput, CyberButton } from "../customs/CyberInputs";
import { CyberTitle, CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import { showSnackbar } from "../../store/uiSlice";
import { loadWorld, preloadWorldAssets } from "../../store/worldSlice";
import { setActiveMapForPlayers } from "../../../firebase/services/gameService";
import {
    subscribeMapsByCampaign,
    updateMapDoc,
    deleteMapDoc,
    countLocationsForMap,
} from "../../../firebase/services/mapService";
import AdminSectionShell from "./AdminSectionShell";
import AdminDataRow from "./AdminDataRow";
import AddMapForm from "../tabs/subtabs/AddMapForm";

export default function MapsAdminTab({ campaignId }) {
    const dispatch = useDispatch();
    const activeMapId = useSelector((s) => s.world.activeMapId);
    const gameActiveMapId = useSelector((s) => s.game?.activeMapId);

    const [maps, setMaps] = useState([]);
    const [createOpen, setCreateOpen] = useState(false);
    const [editMap, setEditMap] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteLocCount, setDeleteLocCount] = useState(0);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!campaignId) return undefined;
        return subscribeMapsByCampaign(campaignId, setMaps);
    }, [campaignId]);

    const reloadWorld = async () => {
        if (!campaignId) return;
        const world = await dispatch(loadWorld(campaignId)).unwrap();
        await dispatch(preloadWorldAssets(world)).unwrap();
    };
    const openEdit = (map) => {
        setEditMap({
            id: map.id,
            name: map.name || "",
            description: map.description || "",
            imageUrl: map.imageUrl || "",
            width: map.width ?? 2048,
            height: map.height ?? 2048,
            metersPerPixel: map.metersPerPixel ?? 1,
            unit: map.unit || "m",
        });
    };

    const handleSaveEdit = async () => {
        if (!editMap?.id) return;
        setSaving(true);
        try {
            const { id, ...data } = editMap;
            await updateMapDoc(id, data);
            dispatch(showSnackbar({ message: "Mapa actualizado.", severity: "success" }));
            setEditMap(null);
        } catch (err) {
            dispatch(showSnackbar({ message: "Error al guardar mapa.", severity: "error" }));
        } finally {
            setSaving(false);
        }
    };

    const confirmDelete = async (map) => {
        const count = await countLocationsForMap(map.id);
        setDeleteLocCount(count);
        setDeleteTarget(map);
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        if (deleteLocCount > 0) {
            dispatch(showSnackbar({
                message: `Mapa tiene ${deleteLocCount} locación(es). Elimínalas o reasígnalas primero.`,
                severity: "warning",
            }));
            setDeleteTarget(null);
            return;
        }
        try {
            await deleteMapDoc(deleteTarget.id);
            dispatch(showSnackbar({ message: "Mapa eliminado.", severity: "success" }));
            await reloadWorld();
        } catch (err) {
            dispatch(showSnackbar({ message: "Error al eliminar mapa.", severity: "error" }));
        } finally {
            setDeleteTarget(null);
        }
    };

    const handlePublishActive = async (mapId) => {
        if (!campaignId || !mapId) return;
        try {
            await setActiveMapForPlayers(campaignId, mapId);
            dispatch(showSnackbar({ message: "Mapa publicado para todos los jugadores.", severity: "success" }));
        } catch (err) {
            dispatch(showSnackbar({ message: "Error al publicar mapa.", severity: "error" }));
        }
    };

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, height: "100%", minHeight: 0, overflowY: "auto", ...CYBER_SCROLL_STYLE }}>
            <AdminSectionShell title="CREAR MAPA" hint="Registra un nuevo módulo de mapa para la campaña.">
                <Box
                    component="button"
                    type="button"
                    onClick={() => setCreateOpen((v) => !v)}
                    sx={{
                        display: "flex", alignItems: "center", gap: 0.5, bgcolor: "transparent", border: "none",
                        color: UI_COLORS.accent, cursor: "pointer", fontFamily: "'Orbitron', sans-serif", fontSize: "0.68rem", p: 0,
                    }}
                >
                    {createOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                    {createOpen ? "OCULTAR" : "NUEVO MAPA"}
                </Box>
                <Collapse in={createOpen} unmountOnExit>
                    <AddMapForm
                        campaignId={campaignId}
                        onCreated={async () => {
                            setCreateOpen(false);
                            try {
                                await reloadWorld();
                            } catch (err) {
                                console.error(err);
                                dispatch(showSnackbar({
                                    message: "Mapa creado, pero no se pudo refrescar la mesa.",
                                    severity: "warning",
                                }));
                            }
                        }}
                    />
                </Collapse>
            </AdminSectionShell>

            <AdminSectionShell title="MAPAS DE LA CAMPAÑA" hint="Edita, publica como mapa activo para jugadores o elimina.">
                {maps.length === 0 && (
                    <CyberText sx={{ fontSize: "0.78rem", color: UI_COLORS.textSecondary }}>Sin mapas registrados.</CyberText>
                )}
                {maps.map((m) => {
                    const isPublished = gameActiveMapId === m.id;
                    const isLocalActive = activeMapId === m.id;
                    return (
                        <AdminDataRow
                            key={m.id}
                            primary={m.name || m.id}
                            secondary={`${m.width}×${m.height}px · ${m.metersPerPixel} ${m.unit}/px`}
                            meta={isPublished ? "PUBLICADO" : isLocalActive ? "LOCAL" : ""}
                            actions={
                                <>
                                    <Tooltip title="Publicar para jugadores">
                                        <IconButton size="small" onClick={() => handlePublishActive(m.id)} sx={{ color: UI_COLORS.anomaly }}>
                                            <PublicIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Editar">
                                        <IconButton size="small" onClick={() => openEdit(m)} sx={{ color: UI_COLORS.accent }}>
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Eliminar">
                                        <IconButton size="small" onClick={() => confirmDelete(m)} sx={{ color: UI_COLORS.accentStrong }}>
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </>
                            }
                        />
                    );
                })}
            </AdminSectionShell>

            <Dialog open={Boolean(editMap)} onClose={() => setEditMap(null)} maxWidth="sm" fullWidth sx={{ zIndex: 1900 }}>
                <DialogTitle sx={{ bgcolor: UI_COLORS.backgroundSecondary }}>
                    <CyberTitle sx={{ fontSize: "0.78rem", color: UI_COLORS.accent }}>EDITAR MAPA</CyberTitle>
                </DialogTitle>
                <DialogContent sx={{ bgcolor: UI_COLORS.backgroundSecondary }}>
                    {editMap && (
                        <Stack spacing={2} sx={{ pt: 1 }}>
                            <CyberInput label="NOMBRE" value={editMap.name} onChange={(e) => setEditMap({ ...editMap, name: e.target.value })} />
                            <CyberInput label="IMAGEN" value={editMap.imageUrl} onChange={(e) => setEditMap({ ...editMap, imageUrl: e.target.value })} />
                            <CyberInput label="DESCRIPCIÓN" value={editMap.description} onChange={(e) => setEditMap({ ...editMap, description: e.target.value })} multiline />
                            <Grid container spacing={2}>
                                <Grid size={6}><CyberInput label="ANCHO" type="number" value={editMap.width} onChange={(e) => setEditMap({ ...editMap, width: Number(e.target.value) })} /></Grid>
                                <Grid size={6}><CyberInput label="ALTO" type="number" value={editMap.height} onChange={(e) => setEditMap({ ...editMap, height: Number(e.target.value) })} /></Grid>
                                <Grid size={6}><CyberInput label="M/PIXEL" type="number" value={editMap.metersPerPixel} onChange={(e) => setEditMap({ ...editMap, metersPerPixel: Number(e.target.value) })} /></Grid>
                                <Grid size={6}><CyberInput label="UNIDAD" value={editMap.unit} onChange={(e) => setEditMap({ ...editMap, unit: e.target.value })} /></Grid>
                            </Grid>
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions sx={{ bgcolor: UI_COLORS.backgroundSecondary }}>
                    <Button onClick={() => setEditMap(null)} sx={{ color: UI_COLORS.textSecondary }}>Cancelar</Button>
                    <Button onClick={handleSaveEdit} disabled={saving} sx={{ color: UI_COLORS.accent }}>Guardar</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} sx={{ zIndex: 1900 }}>
                <DialogTitle sx={{ bgcolor: UI_COLORS.backgroundSecondary }}>
                    <CyberTitle sx={{ fontSize: "0.78rem", color: UI_COLORS.accentStrong }}>ELIMINAR MAPA</CyberTitle>
                </DialogTitle>
                <DialogContent sx={{ bgcolor: UI_COLORS.backgroundSecondary }}>
                    <CyberText sx={{ fontSize: "0.8rem", color: UI_COLORS.textPrimary }}>
                        ¿Eliminar «{deleteTarget?.name}»?
                        {deleteLocCount > 0 && ` Tiene ${deleteLocCount} locación(es) asociada(s).`}
                    </CyberText>
                </DialogContent>
                <DialogActions sx={{ bgcolor: UI_COLORS.backgroundSecondary }}>
                    <Button onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                    <Button onClick={handleDelete} sx={{ color: UI_COLORS.accentStrong }}>Eliminar</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
