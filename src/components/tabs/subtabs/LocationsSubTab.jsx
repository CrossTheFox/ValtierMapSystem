import React, { useState, useEffect } from 'react';
import { Box, Accordion, AccordionSummary, AccordionDetails, Stack, IconButton, Tooltip, Grid } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import AddLocationAltIcon from '@mui/icons-material/AddLocationAlt';
import EditLocationAltIcon from '@mui/icons-material/EditLocationAlt';
import { CyberTitle, CyberText } from '../../customs/CustomTexts';
import { CyberAutocomplete } from '../../customs/CyberAutocomplete';
import { CyberInput, CyberButton } from '../../customs/CyberInputs';
import { CyberTextField } from '../../customs/CyberTextField';
import { updateCampaignElement, createCampaignElement } from '../../../../firebase/services/campaignService';
import { deleteStorageFile, uploadLocationImage } from '../../../../firebase/services/assetLoader';
import { useDispatch, useSelector } from 'react-redux';
import { setIsSelectingPosition, setSelectedWorldPosition, showSnackbar, openWikiOverlay } from '../../../store/uiSlice';
import { WIKI_ENTITY_TYPES } from '../../../constants/wikiEntityTypes';
import { WIKI_AREA_IDS } from '../../../constants/wiki/index';
import { useCampaignWikiEntities } from '../../../hooks/useCampaignWikiEntities';
import { linkWikiLocacionToVtt } from '../../../../firebase/services/wikiVttLinkService';
import { fetchWikiEntities } from '../../../store/wikiSlice';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import { VttToWikiLinkBadge } from '../../wiki/VttWikiLinkBadge';
import { UI_COLORS } from '../../../constants/uiColors';
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
    const linkedNarrativeEntity = selectedItem?.id
        ? narrativeLocaciones.find((e) => e.linkedVttLocationId === selectedItem.id)
        : null;

    const handleOpenNarrativeWiki = () => {
        if (!selectedItem?.id) return;
        dispatch(openWikiOverlay({
            mode: linkedNarrativeEntity ? "detail" : "create",
            areaFilter: WIKI_AREA_IDS.CODEX,
            entityId: linkedNarrativeEntity?.id || null,
            vttContext: {
                linkedVttLocationId: selectedItem.id,
                prefillType: WIKI_ENTITY_TYPES.LOCACION,
            },
        }));
    };

    const handleNarrativeWikiLink = async (wikiEntityId) => {
        if (!currentCampaignId || !selectedItem?.id || selectedItem.isNew) return;
        setWikiLinkSaving(true);
        try {
            await linkWikiLocacionToVtt(
                currentCampaignId,
                wikiEntityId || null,
                selectedItem.id,
                uid
            );
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
        <Stack spacing={3}>             
            <Stack direction="row" spacing={1} alignItems="center">
                <CyberAutocomplete
                    sx={{ width: '50%' }}
                    options={locations}
                    getOptionLabel={(option) => option.name || ""}
                    value={selectedItem}
                    onChange={(e, val) => setSelectedItem(val)}
                    renderInput={(params) => (
                        <CyberTextField
                            {...params} 
                            label="SEARCH_LOCATIONS_DATABASE" 
                            placeholder="AWAITING_INPUT..."
                        />
                    )}
                    slotProps={{
                        paper: {
                            sx: {
                                backgroundColor: '#0a0a0a',
                                color: '#fff',
                                borderRadius: 0,
                                border: `1px solid ${UI_COLORS.accent || "#00f2ea"}33`,
                                fontFamily: 'Michroma, sans-serif',
                                '& .MuiAutocomplete-listbox': {
                                    '& .MuiAutocomplete-option': {
                                        '&:hover': { backgroundColor: `${UI_COLORS.accent || "#00f2ea"}22` },
                                        '&[aria-selected="true"]': { backgroundColor: `${UI_COLORS.accent || "#00f2ea"}44` }
                                    }
                                }
                            }
                        }
                    }}
                />
                <Tooltip title="ADD_NEW_ENTRY">
                    <IconButton 
                        onClick={handleAddNew}
                        sx={{ 
                            border: `1px solid ${UI_COLORS.accent}33`, 
                            borderRadius: 0,
                            color: UI_COLORS.accent 
                        }}
                    >
                        <AddIcon />
                    </IconButton>
                </Tooltip>
            </Stack>

            {selectedItem && (
                <Accordion sx={{ 
                    backgroundColor: 'rgba(0,0,0,0.3)', 
                    border: `1px solid ${UI_COLORS.accent || "#00f2ea"}66`,
                    borderRadius: 0,
                    mb: 4 
                }}>
                    <AccordionSummary expandMoreIcon={<ExpandMoreIcon sx={{color: '#00f2ea'}} />}>
                        <CyberText sx={{ color: '#00f2ea' }}>PROTOCOL: EDIT_{selectedItem.name.toUpperCase()}</CyberText>
                    </AccordionSummary>
                    <AccordionDetails>
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
                                    <CyberInput 
                                        label="GEOGRAPHICAL_DESCRIPTION" 
                                        multiline rows={3}
                                        value={selectedItem.description || ''} 
                                        onChange={(e) => setSelectedItem({...selectedItem, description: e.target.value})}
                                    />

                                    <Box sx={{ border: `1px solid ${UI_COLORS.accent}33`, p: 2, borderRadius: 0 }}>
                                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                                            <Stack direction="row" alignItems="center" gap={1}>
                                                <CyberText sx={{ color: UI_COLORS.accent, fontSize: '0.75rem' }}>
                                                    NARRATIVE_ARCHIVE_LINK
                                                </CyberText>
                                                {linkedNarrativeEntity && (
                                                    <VttToWikiLinkBadge wikiEntity={linkedNarrativeEntity} compact />
                                                )}
                                            </Stack>
                                            <Tooltip title={selectedItem.id ? "Abrir o crear ficha en el archivo" : "Guarda la ubicación primero"}>
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
                                        </Stack>
                                        <CyberInput
                                            select
                                            label="FICHA_LOCACION_NARRATIVA"
                                            value={linkedNarrativeEntity?.id || ''}
                                            disabled={!selectedItem.id || selectedItem.isNew || wikiLinkSaving}
                                            onChange={(e) => handleNarrativeWikiLink(e.target.value || null)}
                                        >
                                            <option value="" style={{ backgroundColor: '#000' }}>
                                                {selectedItem.isNew ? 'GUARDAR_UBICACION_PRIMERO' : 'SIN_VINCULO_NARRATIVO'}
                                            </option>
                                            {narrativeLocaciones.map((ent) => (
                                                <option key={ent.id} value={ent.id} style={{ backgroundColor: '#000' }}>
                                                    {(ent.title || ent.slug || ent.id).toUpperCase()}
                                                </option>
                                            ))}
                                        </CyberInput>
                                        <CyberText sx={{ fontSize: '0.65rem', color: UI_COLORS.textSecondary, mt: 1, display: 'block', lineHeight: 1.4 }}>
                                            El pin VTT es la ciudad/mazmorra en el mapa; la ficha narrativa puede ser país, región o jerarquía superior. Crea regiones en el Códice sin pin y enlázalas aquí.
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

                            <Grid size={12}>
                                <CyberInput 
                                    label="HISTORICAL_LOGS" 
                                    multiline rows={5}
                                    value={selectedItem.history || ''} 
                                    onChange={(e) => setSelectedItem({...selectedItem, history: e.target.value})}
                                />
                            </Grid>
                        </Grid>

                        <Box sx={{ mt: 3, pb: 2 }}>
                            <CyberButton onClick={handleUpdate} loading={loading} sx={{ width: 'fit-content' }}>
                                COMMIT_CHANGES
                            </CyberButton>
                        </Box>
                    </AccordionDetails>
                </Accordion>
            )}
        </Stack>
    );
}