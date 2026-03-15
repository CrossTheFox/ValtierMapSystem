import React, { useState, useEffect } from 'react';
import { Grid, Box, Accordion, AccordionSummary, AccordionDetails, Typography, Stack } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AdminNavButton from '../customs/AdminNavButton';
import { CyberTitle, CyberText } from '../customs/CustomTexts';
import { CyberAutocomplete } from '../customs/CyberAutocomplete';
import { CyberInput, CyberButton } from '../customs/CyberInputs';
import { CyberTextField } from '../customs/CyberTextField';
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { updateCampaignElement } from '../../../firebase/services/campaignService';
import { deleteStorageFile, uploadCharacterImage, uploadLocationImage } from '../../../firebase/services/assetLoader';
import { updateLocationInState, updateCharacterInState } from '../../store/worldSlice';
import { db } from "../../../firebase/firebaseConfig";
import { UI_COLORS } from '../../constants/uiColors';
import { EntityImageManager } from '../EntityImageManager';

export default function CampaignSettingsTab({ currentCampaignId }) {
    const [locations, setLocations] = useState([]);
    const [characters, setCharacters] = useState([]);

    const [activeSubTab, setActiveSubTab] = useState('LOCATIONS');
    const [maps, setMaps] = useState([]);

    const [selectedItem, setSelectedItem] = useState(null);
    const [pendingDeletions, setPendingDeletions] = useState([]);

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!currentCampaignId) return;

        // 1. Obtener Mapas de la campaña para filtrar localizaciones
        const qMaps = query(collection(db, "maps"), where("campaignId", "==", currentCampaignId));
        const unsubMaps = onSnapshot(qMaps, (snap) => {
            const mapList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMaps(mapList);
            
            // 2. Obtener Localizaciones vinculadas a esos mapas
            if (mapList.length > 0) {
                const mapIds = mapList.map(m => m.id);
                const qLoc = query(collection(db, "locations"), where("mapId", "in", mapIds));
                onSnapshot(qLoc, (s) => setLocations(s.docs.map(d => ({ id: d.id, ...d.data() }))));
            }
        });

        // 3. Obtener Personajes de la campaña
        const qChar = query(collection(db, "characters"), where("campaignId", "==", currentCampaignId));
        const unsubChar = onSnapshot(qChar, (snap) => {
            setCharacters(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => { unsubMaps(); unsubChar(); };
    }, [currentCampaignId]);

    const handleUpdate = async () => {
        setLoading(true);
        const collectionName = activeSubTab === 'LOCATIONS' ? 'locations' : 'characters';
        
        try {
            // 1. Ejecutar eliminaciones físicas en Storage solo ahora
            if (pendingDeletions.length > 0) {
                await Promise.all(pendingDeletions.map(path => deleteStorageFile(path)));
                setPendingDeletions([]); // Limpiar lista tras éxito
            }

            // 2. Actualizar Firestore
            const { id, ...updateData } = selectedItem;
            
            await updateCampaignElement(collectionName, id, updateData);
        } catch (error) {
            console.error("SYNC_ERROR", error);
        } finally {
            setLoading(false);
        }
    };

    const currentList = activeSubTab === 'LOCATIONS' ? locations : characters;

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
                                                    <CyberInput 
                                                        label="LOCATION_NAME" 
                                                        value={selectedItem.name || ''} 
                                                        onChange={(e) => setSelectedItem({...selectedItem, name: e.target.value})}
                                                    />
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