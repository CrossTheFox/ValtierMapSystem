import React, { useState, useEffect } from 'react';
import { Box, Stack, IconButton, Tooltip, Grid } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AddLocationAltIcon from '@mui/icons-material/AddLocationAlt';
import EditLocationAltIcon from '@mui/icons-material/EditLocationAlt';
import { CyberTitle, CyberText } from '../../customs/CustomTexts';
import { CyberInput, CyberButton } from '../../customs/CyberInputs';
import { updateCampaignElement, createCampaignElement } from '../../../../firebase/services/campaignService';
import { deleteStorageFile, uploadLocationImage } from '../../../../firebase/services/assetLoader';
import { useDispatch, useSelector } from 'react-redux';
import { setIsSelectingPosition, setSelectedWorldPosition, showSnackbar, openWikiOverlay } from '../../../store/uiSlice';
import { WIKI_ENTITY_TYPES } from '../../../constants/wikiEntityTypes';
import { WIKI_AREA_IDS } from '../../../constants/wiki/index';
import { findWikiLocacionForPin } from '../../../constants/wiki/archiveIdentity.js';
import { useCampaignWikiEntities } from '../../../hooks/useCampaignWikiEntities';
import { linkWikiLocacionToVtt } from '../../../../firebase/services/wikiVttLinkService';
import { fetchWikiEntities } from '../../../store/wikiSlice';
import { updateLocationInState } from '../../../store/worldSlice';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import { VttToWikiLinkBadge } from '../../wiki/VttWikiLinkBadge';
import { UI_COLORS } from '../../../constants/uiColors';
import { CYBER_SCROLL_STYLE } from '../../../constants/cyberScrollStyle';
import { EntityImageManager } from '../../EntityImageManager';
import useDialogActions from '../../../hooks/useDialogActions';
import { DIALOG_IDS } from '../../../constants/dialogIds';

export default function LocationsSubTab({ currentCampaignId, locations, maps }) {
    const dispatch = useDispatch();
    const { isSelectingPosition, selectedWorldPosition } = useSelector((state) => state.ui);
    const uid = useSelector((state) => state.player.profile?.uid);
    const { forceMinimize } = useDialogActions(DIALOG_IDS.LOCATION);
    const wikiEntities = useCampaignWikiEntities(currentCampaignId);

    const [selectedItem, setSelectedItem] = useState(null);
    const [wikiLinkSaving, setWikiLinkSaving] = useState(false);
    const [pendingDeletions, setPendingDeletions] = useState([]);
    const [loading, setLoading] = useState(false);

    const handleAddNew = () => {
        setSelectedItem({
            name: "NEW_ENTRY_UNNAMED",
            isNew: true,
            campaignId: currentCampaignId,
            mapId: maps[0]?.id || "", 
            description: "", 
            history: "",
            wikiEntityId: null,
            position: null 
        });
    };

    const handleUpdate = async () => {
        setLoading(true);
        try {
            if (pendingDeletions.length > 0) {
                await Promise.all(pendingDeletions.map(path => deleteStorageFile(path)));
                setPendingDeletions([]);
            }

            if (selectedItem.isNew) {
                const { isNew, ...newData } = selectedItem;
                const docRef = await createCampaignElement('locations', newData);
                setSelectedItem({ id: docRef.id, ...newData });
                if (newData.wikiEntityId) {
                    await linkWikiLocacionToVtt(
                        currentCampaignId,
                        newData.wikiEntityId,
                        docRef.id,
                        uid
                    );
                    dispatch(updateLocationInState({
                        id: docRef.id,
                        data: { wikiEntityId: newData.wikiEntityId },
                    }));
                    dispatch(fetchWikiEntities({ campaignId: currentCampaignId }));
                }

                dispatch(showSnackbar({
                    message: "PROTOCOL_EXECUTED: NEW_ENTRY_SECURED",
                    severity: "success"
                }));
            } else {
                const { id, ...updateData } = selectedItem;
                await updateCampaignElement('locations', id, updateData);

                dispatch(showSnackbar({
                    message: "DATABASE_OVERRIDE: SUCCESS",
                    severity: "info"
                }));
            }
        } catch (error) {
            dispatch(showSnackbar({
                message: "CRITICAL_ERROR: SYNC_FAILED",
                severity: "error"
            }));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedWorldPosition && selectedItem) {
            setSelectedItem(prev => ({
                ...prev,
                position: selectedWorldPosition
            }));
            dispatch(setSelectedWorldPosition(null));
        }
    }, [selectedWorldPosition, selectedItem, dispatch]);

    const narrativeLocaciones = wikiEntities.filter((e) => e.entityType === WIKI_ENTITY_TYPES.LOCACION);
    const linkedNarrativeEntity = selectedItem
        ? findWikiLocacionForPin(selectedItem, narrativeLocaciones)
            || (selectedItem.wikiEntityId
                ? narrativeLocaciones.find((e) => e.id === selectedItem.wikiEntityId)
                : null)
        : null;

    const handleOpenNarrativeWiki = () => {
        if (!selectedItem?.id) return;
        dispatch(openWikiOverlay({
            mode: linkedNarrativeEntity ? "detail" : "list",
            areaFilter: WIKI_AREA_IDS.CODEX,
            entityId: linkedNarrativeEntity?.id || null,
            vttContext: {
                linkedVttLocationId: selectedItem.id,
                prefillType: WIKI_ENTITY_TYPES.LOCACION,
            },
        }));
    };

    const handleCreateNarrativeWiki = () => {
        if (!selectedItem?.id) return;
        dispatch(openWikiOverlay({
            mode: "create",
            areaFilter: WIKI_AREA_IDS.CODEX,
            entityId: null,
            vttContext: {
                linkedVttLocationId: selectedItem.id,
                prefillType: WIKI_ENTITY_TYPES.LOCACION,
            },
        }));
    };

    const handleNarrativeWikiLink = async (wikiEntityId) => {
        if (!currentCampaignId || !selectedItem) return;
        if (selectedItem.isNew || !selectedItem.id) {
            setSelectedItem((prev) => ({ ...prev, wikiEntityId: wikiEntityId || null }));
            return;
        }
        setWikiLinkSaving(true);
        try {
            await linkWikiLocacionToVtt(
                currentCampaignId,
                wikiEntityId || null,
                selectedItem.id,
                uid
            );
            dispatch(updateLocationInState({
                id: selectedItem.id,
                data: { wikiEntityId: wikiEntityId || null },
            }));
            setSelectedItem((prev) => ({ ...prev, wikiEntityId: wikiEntityId || null }));
            dispatch(fetchWikiEntities({ campaignId: currentCampaignId }));
            dispatch(showSnackbar({
                message: wikiEntityId ? "Vínculo narrativo actualizado." : "Vínculo narrativo eliminado.",
                severity: "success",
            }));
        } catch {
            dispatch(showSnackbar({
                message: "Error al vincular ficha narrativa.",
                severity: "error",
            }));
        } finally {
            setWikiLinkSaving(false);
        }
    };

    const hasPosition = !!selectedItem?.position;
    const positionIcon = hasPosition ? <EditLocationAltIcon /> : <AddLocationAltIcon />;
    const positionTooltip = hasPosition 
        ? `CURRENT_POS: [${Math.round(selectedItem.position.x)}, ${Math.round(selectedItem.position.y)}] - CLICK_TO_REPLACE` 
        : "SET_WORLD_POSITION";

    return (
        <Box
            sx={{
                display: "flex",
                height: "100%",
                minHeight: 420,
                border: `1px solid ${UI_COLORS.border}`,
                borderRadius: 1,
                overflow: "hidden",
            }}
        >
            <Box
                sx={{
                    width: 240,
                    flexShrink: 0,
                    borderRight: `1px solid ${UI_COLORS.border}`,
                    bgcolor: `${UI_COLORS.backgroundPrimary}aa`,
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 0,
                }}
            >
                <Box sx={{ p: 1.25, borderBottom: `1px solid ${UI_COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <CyberTitle sx={{ fontSize: "0.65rem", color: UI_COLORS.anomaly, letterSpacing: "0.1em" }}>
                        LOCACIONES
                    </CyberTitle>
                    <IconButton
                        size="small"
                        onClick={handleAddNew}
                        sx={{
                            color: UI_COLORS.accent,
                            border: `1px solid ${UI_COLORS.accent}55`,
                            borderRadius: 0.75,
                            width: 28,
                            height: 28,
                        }}
                    >
                        <AddIcon sx={{ fontSize: "1rem" }} />
                    </IconButton>
                </Box>
                <Box sx={{ flex: 1, overflowY: "auto", ...CYBER_SCROLL_STYLE }}>
                    {(locations || []).map((loc) => {
                        const active = selectedItem?.id === loc.id;
                        return (
                            <Box
                                key={loc.id}
                                onClick={() => setSelectedItem(loc)}
                                sx={{
                                    px: 1.5,
                                    py: 1.05,
                                    cursor: "pointer",
                                    borderLeft: `3px solid ${active ? UI_COLORS.anomaly : "transparent"}`,
                                    bgcolor: active ? `${UI_COLORS.anomaly}12` : "transparent",
                                    "&:hover": { bgcolor: "rgba(255,255,255,0.04)" },
                                }}
                            >
                                <CyberText sx={{ fontSize: "0.72rem", color: active ? UI_COLORS.anomaly : UI_COLORS.textPrimary }}>
                                    {loc.name || loc.id}
                                </CyberText>
                                <CyberText sx={{ fontSize: "0.55rem", color: UI_COLORS.textSecondary, fontFamily: "'Fira Code', monospace" }}>
                                    {loc.mapId ? String(loc.mapId).slice(0, 8) : "sin mapa"}
                                </CyberText>
                            </Box>
                        );
                    })}
                    {selectedItem?.isNew && (
                        <Box sx={{ px: 1.5, py: 1, borderLeft: `3px solid ${UI_COLORS.accent}`, bgcolor: `${UI_COLORS.accent}12` }}>
                            <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.accent }}>
                                {selectedItem.name || "Nueva locación"}
                            </CyberText>
                            <CyberText sx={{ fontSize: "0.55rem", color: UI_COLORS.textSecondary }}>sin guardar</CyberText>
                        </Box>
                    )}
                </Box>
            </Box>

            <Box sx={{ flex: 1, minWidth: 0, overflowY: "auto", p: 2, ...CYBER_SCROLL_STYLE }}>
            {!selectedItem ? (
                <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "0.75rem" }}>
                    Selecciona o crea una locación.
                </CyberText>
            ) : (
                <>
                        <Grid container spacing={3}>
                            <Grid size={7}> 
                                <Stack spacing={3}>
                                    <Stack direction="row" spacing={1} alignItems="flex-start">
                                        <Box sx={{ flex: 8 }}>
                                            <CyberInput 
                                                fullWidth
                                                label="LOCATION_NAME" 
                                                value={selectedItem.name || ''} 
                                                onChange={(e) => setSelectedItem({...selectedItem, name: e.target.value})}
                                            />
                                        </Box>
                                        <Box sx={{ flex: 2, display: 'flex', justifyContent: 'center' }}>
                                            <Tooltip title={positionTooltip}>
                                                <IconButton 
                                                    onClick={() => {
                                                        dispatch(setIsSelectingPosition(true));
                                                        forceMinimize(); 
                                                    }}
                                                    sx={{ 
                                                        width: '45px', height: '45px',
                                                        color: hasPosition ? UI_COLORS.accent : '#666',
                                                        border: `1px solid ${hasPosition ? UI_COLORS.accent : '#666'}33`,
                                                        borderRadius: 0,
                                                        backgroundColor: isSelectingPosition ? `${UI_COLORS.accent}22` : 'transparent',
                                                    }}
                                                >
                                                    {positionIcon}
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                        <Box sx={{ 
                                            flex: 2, height: '45px', display: 'flex', 
                                            flexDirection: 'column', justifyContent: 'center', px: 1
                                        }}>
                                            <CyberText variant="caption" sx={{ color: UI_COLORS.accent, fontSize: '0.8rem', opacity: 0.7 }}>
                                                {selectedItem.position ? Math.round(selectedItem.position.x) : '---'}, {selectedItem.position ? Math.round(selectedItem.position.y) : '---'}
                                            </CyberText>
                                        </Box>
                                    </Stack>
                                    <Box sx={{ border: `1px solid ${UI_COLORS.accent}33`, p: 2, borderRadius: 0 }}>
                                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                                            <Stack direction="row" alignItems="center" gap={1}>
                                                <CyberText sx={{ color: UI_COLORS.accent, fontSize: '0.75rem' }}>
                                                    LUGAR DEL ARCHIVO
                                                </CyberText>
                                                {linkedNarrativeEntity && (
                                                    <VttToWikiLinkBadge wikiEntity={linkedNarrativeEntity} compact />
                                                )}
                                            </Stack>
                                            <Stack direction="row" spacing={0.5}>
                                                <Tooltip title={selectedItem.id ? "Abrir artículo en Archive" : "Guarda el pin primero para abrir Archive"}>
                                                    <span>
                                                        <IconButton
                                                            size="small"
                                                            disabled={!selectedItem.id}
                                                            onClick={handleOpenNarrativeWiki}
                                                            sx={{ color: UI_COLORS.accent, '&:hover': { bgcolor: `${UI_COLORS.accent}18` } }}
                                                        >
                                                            <AutoStoriesIcon sx={{ fontSize: '1rem' }} />
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>
                                                {!linkedNarrativeEntity && selectedItem.id && (
                                                    <Box
                                                        component="button"
                                                        type="button"
                                                        onClick={handleCreateNarrativeWiki}
                                                        sx={{
                                                            px: 1,
                                                            py: 0.45,
                                                            borderRadius: 0.75,
                                                            border: `1px solid ${UI_COLORS.border}`,
                                                            bgcolor: "transparent",
                                                            color: UI_COLORS.textPrimary,
                                                            fontFamily: "'Orbitron', sans-serif",
                                                            fontSize: "0.52rem",
                                                            letterSpacing: "0.08em",
                                                            cursor: "pointer",
                                                        }}
                                                    >
                                                        CREAR_FICHA
                                                    </Box>
                                                )}
                                            </Stack>
                                        </Stack>
                                        <CyberInput
                                            select
                                            label="FICHA_LOCACION"
                                            value={linkedNarrativeEntity?.id || selectedItem.wikiEntityId || ''}
                                            disabled={wikiLinkSaving}
                                            onChange={(e) => handleNarrativeWikiLink(e.target.value || null)}
                                        >
                                            <option value="" style={{ backgroundColor: '#000', color: '#fff' }}>
                                                SIN_VINCULO — elegir lugar existente
                                            </option>
                                            {narrativeLocaciones.map((ent) => (
                                                <option key={ent.id} value={ent.id} style={{ backgroundColor: '#000', color: '#fff' }}>
                                                    {(ent.title || ent.slug || ent.id).toUpperCase()}
                                                </option>
                                            ))}
                                        </CyberInput>
                                        {linkedNarrativeEntity?.summary && (
                                            <CyberText sx={{ fontSize: '0.72rem', color: UI_COLORS.textPrimary, mt: 1.25, display: 'block', lineHeight: 1.45 }}>
                                                {linkedNarrativeEntity.summary}
                                            </CyberText>
                                        )}
                                        <CyberText sx={{ fontSize: '0.65rem', color: UI_COLORS.textSecondary, mt: 1, display: 'block', lineHeight: 1.4 }}>
                                            El pin es una instancia en el mapa (puede haber varias). El artículo vive en el Archive; no se clona al colocar el pin.
                                        </CyberText>
                                    </Box>
                                </Stack>
                            </Grid>

                            <Grid size={5}>
                                <EntityImageManager 
                                    item={selectedItem} 
                                    onUpdate={setSelectedItem}
                                    onMarkForDeletion={(path) => setPendingDeletions(prev => [...prev, path])}
                                    uploadFn={uploadLocationImage}
                                />
                            </Grid>

                        </Grid>

                        <Box sx={{ mt: 3, pb: 2 }}>
                            <CyberButton onClick={handleUpdate} loading={loading} sx={{ width: 'fit-content' }}>
                                COMMIT_CHANGES
                            </CyberButton>
                        </Box>
                </>
            )}
            </Box>
        </Box>
    );
}