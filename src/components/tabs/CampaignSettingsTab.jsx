import React, { useState, useEffect } from 'react';
import { Grid, Box, Accordion, AccordionSummary, AccordionDetails, Typography, Stack, IconButton, Tooltip } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AdminNavButton from '../customs/AdminNavButton';
import AddIcon from '@mui/icons-material/Add';
import AddLocationAltIcon from '@mui/icons-material/AddLocationAlt';
import EditLocationAltIcon from '@mui/icons-material/EditLocationAlt';
import { CyberTitle, CyberText } from '../customs/CustomTexts';
import { CyberAutocomplete } from '../customs/CyberAutocomplete';
import { CyberInput, CyberButton } from '../customs/CyberInputs';
import { CyberTextField } from '../customs/CyberTextField';
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { updateCampaignElement, createCampaignElement } from '../../../firebase/services/campaignService';
import { deleteStorageFile, uploadCharacterImage, uploadLocationImage } from '../../../firebase/services/assetLoader';
import { useDispatch, useSelector } from 'react-redux';
import { setIsSelectingPosition, setSelectedWorldPosition, showSnackbar } from '../../store/uiSlice';
import { db } from "../../../firebase/firebaseConfig";
import { UI_COLORS } from '../../constants/uiColors';
import { EntityImageManager } from '../EntityImageManager';
import useDialogActions from '../../hooks/useDialogActions';

export default function CampaignSettingsTab({ currentCampaignId }) {
    const dispatch = useDispatch();
    const { isSelectingPosition, selectedWorldPosition } = useSelector((state) => state.ui);
    const { forceMinimize } = useDialogActions();

    const [locations, setLocations] = useState([]);
    const [characters, setCharacters] = useState([]);

    const [activeSubTab, setActiveSubTab] = useState('LOCATIONS');
    const [maps, setMaps] = useState([]);

    const [selectedItem, setSelectedItem] = useState(null);
    const [pendingDeletions, setPendingDeletions] = useState([]);

    const [loading, setLoading] = useState(false);

    const handleAddNew = () => {
        const isLoc = activeSubTab === 'LOCATIONS';
        
        const newItem = {
            name: "NEW_ENTRY_UNNAMED",
            isNew: true, // Flag para la lógica de guardado
            campaignId: currentCampaignId,
            ...(isLoc ? { 
                mapId: maps[0]?.id || "", 
                description: "", 
                history: "",
                position: null 
            } : { 
                age: 0, 
                bio: "", 
                locationId: "" 
            })
        };

        setSelectedItem(newItem);
    };

    const handleUpdate = async () => {
        setLoading(true);
        const collectionName = activeSubTab === 'LOCATIONS' ? 'locations' : 'characters';
        
        try {
            // 1. Limpieza de Storage (se mantiene igual)
            if (pendingDeletions.length > 0) {
                await Promise.all(pendingDeletions.map(path => deleteStorageFile(path)));
                setPendingDeletions([]);
            }

            // 2. Lógica Dual: CREATE o UPDATE
            if (selectedItem.isNew) {
                const { isNew, ...newData } = selectedItem;
                // Al crear, Firebase nos devuelve el documento con el ID generado
                const docRef = await createCampaignElement(collectionName, newData);
                setSelectedItem({ id: docRef.id, ...newData }); // Actualizamos estado local

                dispatch(showSnackbar({
                    message: "PROTOCOL_EXECUTED: NEW_ENTRY_SECURED",
                    severity: "success"
                }));
            } else {
                const { id, ...updateData } = selectedItem;
                await updateCampaignElement(collectionName, id, updateData);

                dispatch(showSnackbar({
                    message: "DATABASE_OVERRIDE: SUCCESS",
                    severity: "info"
                }));

            }
            
            // Opcional: podrías mostrar un feedback de éxito aquí
        } catch (error) {
            dispatch(showSnackbar({
                message: "CRITICAL_ERROR: SYNC_FAILED",
                severity: "error"
            }));
        } finally {
            setLoading(false);
        }
    };

    const currentList = activeSubTab === 'LOCATIONS' ? locations : characters;
    const hasPosition = !!selectedItem?.position;
    const positionIcon = hasPosition ? <EditLocationAltIcon /> : <AddLocationAltIcon />;
    const positionTooltip = hasPosition 
        ? `CURRENT_POS: [${Math.round(selectedItem.position.x)}, ${Math.round(selectedItem.position.y)}] - CLICK_TO_REPLACE` 
        : "SET_WORLD_POSITION";

    useEffect(() => {
        if (!currentCampaignId) return;

        // 1. Obtener Mapas de la campaña para filtrar localizaciones
        const qMaps = query(collection(db, "maps"), where("campaignId", "==", currentCampaignId));
        const unsubMaps = onSnapshot(qMaps, (snap) => {
            const mapList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMaps(mapList);
            
            if (mapList.length > 0) {
                const mapIds = mapList.map(m => m.id);
                const qLoc = query(collection(db, "locations"), where("mapId", "in", mapIds));
                
                // El onSnapshot actualizará el estado 'locations' automáticamente
                const unsubLoc = onSnapshot(qLoc, (s) => {
                    const locList = s.docs.map(d => ({ id: d.id, ...d.data() }));
                    setLocations(locList);
                });

                return () => unsubLoc();
            }
        });

        // 3. Obtener Personajes de la campaña
        const qChar = query(collection(db, "characters"), where("campaignId", "==", currentCampaignId));
        const unsubChar = onSnapshot(qChar, (snap) => {
            setCharacters(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => { unsubMaps(); unsubChar(); };
    }, [currentCampaignId]);

    useEffect(() => {
        if (selectedWorldPosition && selectedItem) {
            setSelectedItem(prev => ({
                ...prev,
                position: selectedWorldPosition
            }));
            
            // Limpiamos inmediatamente para evitar bucles
            dispatch(setSelectedWorldPosition(null));
        }
    }, [selectedWorldPosition, selectedItem, dispatch]);

    return (
        <Grid 
            container 
            sx={{ 
                height: '100%', // Usa el 100% del TabPanel
                width: '100%', // Forzar 100%
                margin: 0, // Evitar márgenes extra de Grid
                overflow: 'hidden',
            }}
        >
            <Grid size={2} sx={{ 
                borderRight: '1px solid rgba(255, 255, 255, 0.1)', 
                pt: 2, 
                height: '100%',
                boxSizing: 'border-box'
            }}>
                <AdminNavButton label="LOCATIONS" isSelected={activeSubTab === 'LOCATIONS'} onClick={() => {setActiveSubTab('LOCATIONS'); setSelectedItem(null);}} />
                <AdminNavButton label="CHARACTERS" isSelected={activeSubTab === 'CHARACTERS'} onClick={() => {setActiveSubTab('CHARACTERS'); setSelectedItem(null);}} />
            </Grid>

            <Grid size={10} sx={{ 
                p: { xs: 2, md: 4 }, // Padding responsivo
                height: '100%', 
                overflowY: 'auto', 
                overflowX: 'hidden',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                '&::-webkit-scrollbar': { width: '6px' },
                '&::-webkit-scrollbar-track': { background: 'rgba(0,0,0,0.2)' },
                '&::-webkit-scrollbar-thumb': { 
                    background: UI_COLORS.accent || "#00f2ea",
                    borderRadius: '10px'
                }
            }}>
                <Stack spacing={3}>
                    <CyberTitle variant="h5">ACTIVE_CAMPAIGN_OVERRIDE</CyberTitle>
                    
                    <Stack direction="row" spacing={1} alignItems="center">
                        <CyberAutocomplete
                            sx={{ width: '50%' }}
                            options={currentList}
                            getOptionLabel={(option) => option.name || ""}
                            value={selectedItem}
                            onChange={(e, val) => setSelectedItem(val)}
                            renderInput={(params) => (
                                <CyberTextField
                                    {...params} 
                                    label={`SEARCH_${activeSubTab}_DATABASE`} 
                                    placeholder="AWAITING_INPUT..."
                                />
                            )}
                            slotProps={{
                                paper: {
                                    sx: {
                                        backgroundColor: '#0a0a0a', // Fondo oscuro
                                        color: '#fff',
                                        borderRadius: 0,
                                        border: `1px solid ${UI_COLORS.accent || "#00f2ea"}33`,
                                        fontFamily: 'Michroma, sans-serif',
                                        '& .MuiAutocomplete-listbox': {
                                            '& .MuiAutocomplete-option': {
                                                '&:hover': {
                                                    backgroundColor: `${UI_COLORS.accent || "#00f2ea"}22`,
                                                },
                                                '&[aria-selected="true"]': {
                                                    backgroundColor: `${UI_COLORS.accent || "#00f2ea"}44`,
                                                }
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
                            mb: 4 // Espacio extra al final para que no choque con el borde
                        }}>
                            <AccordionSummary expandMoreIcon={<ExpandMoreIcon sx={{color: '#00f2ea'}} />}>
                                <CyberText sx={{ color: '#00f2ea' }}>PROTOCOL: EDIT_{selectedItem.name.toUpperCase()}</CyberText>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Grid container spacing={3}>
                                    {/* --- Lógica Condicional para el Layout --- */}
                                    {activeSubTab === 'CHARACTERS' ? (
                                        <>
                                            {/* VISTA DE PERSONAJES */}
                                            <Grid size={4}>
                                                <Stack spacing={3}>
                                                    <CyberInput 
                                                        label="NAME_IDENTIFIER" 
                                                        value={selectedItem.name || ''} 
                                                        onChange={(e) => setSelectedItem({...selectedItem, name: e.target.value})}
                                                    />
                                                    <CyberInput 
                                                        label="SUBJECT_AGE" 
                                                        type="number"
                                                        value={selectedItem.age || ''} 
                                                        onChange={(e) => setSelectedItem({...selectedItem, age: parseInt(e.target.value)})}
                                                    />
                                                </Stack>
                                            </Grid>

                                            <Grid size={8}>
                                                <EntityImageManager 
                                                    item={selectedItem} 
                                                    onUpdate={setSelectedItem}
                                                    onMarkForDeletion={(path) => setPendingDeletions(prev => [...prev, path])}
                                                    uploadFn={uploadCharacterImage}
                                                />
                                            </Grid>

                                            <Grid size={12}>
                                                <Stack spacing={3}>
                                                    <CyberInput 
                                                        label="BIOGRAPHICAL_DATA" 
                                                        multiline rows={4}
                                                        value={selectedItem.bio || ''} 
                                                        onChange={(e) => setSelectedItem({...selectedItem, bio: e.target.value})}
                                                    />
                                                    <CyberInput
                                                        select
                                                        label="ASSIGNED_LOCATION_DATA"
                                                        value={selectedItem.locationId || ''}
                                                        onChange={(e) => setSelectedItem({...selectedItem, locationId: e.target.value})}
                                                    >
                                                        <option value="" style={{backgroundColor: '#000'}}>NULL_OR_UNASSIGNED</option>
                                                        {locations.map((loc) => (
                                                            <option key={loc.id} value={loc.id} style={{backgroundColor: '#000'}}>
                                                                {loc.name.toUpperCase()}
                                                            </option>
                                                        ))}
                                                    </CyberInput>
                                                </Stack>
                                            </Grid>
                                        </>
                                    ) : (
                                        <>
                                            {/* VISTA DE LOCALIZACIONES */}
                                            <Grid size={7}> {/* Ajustamos tamaño para dejar espacio a la imagen */}
                                                <Stack spacing={3}>
                                                    <Stack direction="row" spacing={1} alignItems="flex-start">
                                                        {/* Input de Nombre */}
                                                        <Box sx={{ flex: 8 }}>
                                                            <CyberInput 
                                                                fullWidth
                                                                label="LOCATION_NAME" 
                                                                value={selectedItem.name || ''} 
                                                                onChange={(e) => setSelectedItem({...selectedItem, name: e.target.value})}
                                                            />
                                                        </Box>

                                                        {/* Icono de Selección */}
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
                                                            flex: 2, 
                                                            height: '45px', // Ajustar al alto de tus CyberInputs
                                                            display: 'flex', 
                                                            flexDirection: 'column',
                                                            justifyContent: 'center',
                                                            px: 1
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
                                                </Stack>
                                            </Grid>

                                            <Grid size={5}>
                                                {/* Manager de Imagen para Locaciones */}
                                                <EntityImageManager 
                                                    item={selectedItem} 
                                                    onUpdate={setSelectedItem}
                                                    onMarkForDeletion={(path) => setPendingDeletions(prev => [...prev, path])}
                                                    uploadFn={uploadLocationImage} // Inyectamos función de locaciones
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
                                        </>
                                    )}
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
            </Grid>
        </Grid>
    );
}