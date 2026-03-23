import React, { useState, useEffect } from 'react';
import { Box, Accordion, AccordionSummary, AccordionDetails, Stack, IconButton, Tooltip, Grid } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import { CyberTitle, CyberText } from '../../customs/CustomTexts';
import { CyberAutocomplete } from '../../customs/CyberAutocomplete';
import { CyberInput, CyberButton } from '../../customs/CyberInputs';
import { CyberTextField } from '../../customs/CyberTextField';
import { updateCampaignElement, createCampaignElement } from '../../../../firebase/services/campaignService';
import { deleteStorageFile, uploadCharacterImage } from '../../../../firebase/services/assetLoader';
import { useDispatch } from 'react-redux';
import { showSnackbar } from '../../../store/uiSlice';
import { db } from "../../../../firebase/firebaseConfig";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { UI_COLORS } from '../../../constants/uiColors';
import { EntityImageManager } from '../../EntityImageManager';

export default function CharactersSubTab({ currentCampaignId, locations }) {
    const dispatch = useDispatch();

    const [characters, setCharacters] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [pendingDeletions, setPendingDeletions] = useState([]);
    const [loading, setLoading] = useState(false);

    // Fetch independiente para los personajes
    useEffect(() => {
        if (!currentCampaignId) return;

        const qChar = query(collection(db, "characters"), where("campaignId", "==", currentCampaignId));
        const unsubChar = onSnapshot(qChar, (snap) => {
            setCharacters(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => unsubChar();
    }, [currentCampaignId]);

    const handleAddNew = () => {
        setSelectedItem({
            name: "NEW_ENTRY_UNNAMED",
            isNew: true,
            campaignId: currentCampaignId,
            age: 0, 
            bio: "", 
            locationId: "" 
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
                const docRef = await createCampaignElement('characters', newData);
                setSelectedItem({ id: docRef.id, ...newData });

                dispatch(showSnackbar({
                    message: "PROTOCOL_EXECUTED: NEW_ENTRY_SECURED",
                    severity: "success"
                }));
            } else {
                const { id, ...updateData } = selectedItem;
                await updateCampaignElement('characters', id, updateData);

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

    return (
        <Stack spacing={3}>             
            <Stack direction="row" spacing={1} alignItems="center">
                <CyberAutocomplete
                    sx={{ width: '50%' }}
                    options={characters}
                    getOptionLabel={(option) => option.name || ""}
                    value={selectedItem}
                    onChange={(e, val) => setSelectedItem(val)}
                    renderInput={(params) => (
                        <CyberTextField
                            {...params} 
                            label="SEARCH_CHARACTERS_DATABASE" 
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