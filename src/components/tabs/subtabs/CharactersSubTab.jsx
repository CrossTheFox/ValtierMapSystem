import React, { useState, useEffect } from 'react';
import { Box, Accordion, AccordionSummary, AccordionDetails, Stack, IconButton, Tooltip, Grid, Rating } from '@mui/material';

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';

import { CyberTitle, CyberText } from '../../customs/CustomTexts';
import { CyberAutocomplete } from '../../customs/CyberAutocomplete';
import { CyberInput, CyberButton } from '../../customs/CyberInputs';
import { CyberTextField } from '../../customs/CyberTextField';
import { CyberCheckbox } from '../../customs/CyberCheckbox';

import { updateCampaignElement, createCampaignElement } from '../../../../firebase/services/campaignService';
import { deleteStorageFile, uploadCharacterImage } from '../../../../firebase/services/assetLoader';

import { useDispatch } from 'react-redux';
import { showSnackbar } from '../../../store/uiSlice';

import { db } from "../../../../firebase/firebaseConfig";
import { collection, query, where, onSnapshot } from "firebase/firestore";

import { EntityImageManager } from '../../EntityImageManager';

import { UI_COLORS } from '../../../constants/uiColors';
import { STAT_SYSTEM } from '../../../constants/stat_system';

const CustomEmptyIcon = () => (
    <Box sx={{ width: 15, height: 6, bgcolor: 'rgba(42, 42, 61, 0.3)', border: '1px solid #2a2a3d', mx: 0.2, borderRadius: '1px' }} />
);

const CustomFilledIcon = ({ isMax, isUnknown }) => (
    <Box sx={{ 
        width: 15, 
        height: 6, 
        bgcolor: isUnknown ? '#ff0055' : (isMax ? "#ff0055" : UI_COLORS.accent), 
        border: `1px solid ${isUnknown ? '#ff0055' : (isMax ? "#ff0055" : UI_COLORS.accent)}`,
        boxShadow: `0 0 6px ${isUnknown ? 'rgba(255,0,85,0.6)' : (isMax ? 'rgba(255,0,85,0.6)' : UI_COLORS.accentGlow)}`,
        mx: 0.2,
        borderRadius: '1px'
    }} />
);

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
        const defaultStats = STAT_SYSTEM.reduce((acc, stat) => ({ ...acc, [stat.key]: 0 }), {});

        setSelectedItem({
            name: "NEW_ENTRY_UNNAMED",
            isNew: true,
            campaignId: currentCampaignId,
            age: 0, 
            bio: "", 
            locationId: "",
            stats: defaultStats,
            isLocked: true,
            unlockGoal: ""
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

    const handleStatChange = (statKey, newValue) => {
        setSelectedItem(prev => ({
            ...prev,
            stats: {
                ...prev.stats,
                [statKey]: newValue
            }
        }));
    };

    const toggleUnknown = (statKey) => {
        const currentValue = selectedItem.stats?.[statKey];
        // Si ya es -1, lo devolvemos a 0, si no, lo seteamos a -1
        handleStatChange(statKey, currentValue === -1 ? 0 : -1);
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
                                    <Box sx={{ borderLeft: `2px solid ${UI_COLORS.accent}66`, pl: 2, mt: 1 }}>
                                        <CyberText variant="caption" sx={{ color: UI_COLORS.accent, mb: 1, display: 'block' }}>
                                            ACCESS_CONTROL_PROTOCOLS
                                        </CyberText>
                                        <CyberCheckbox 
                                            label="INITIAL_ENCRYPTION (LOCKED)"
                                            checked={selectedItem.isLocked || false}
                                            onChange={(e) => setSelectedItem({...selectedItem, isLocked: e.target.checked})}
                                        />
                                        <CyberInput 
                                            label="UNLOCK_CONDITION_HINT" 
                                            placeholder="Ej: Derrotar al Rey Pollo"
                                            value={selectedItem.unlockGoal || ''} 
                                            onChange={(e) => setSelectedItem({...selectedItem, unlockGoal: e.target.value})}
                                            sx={{ mt: 1 }}
                                        />
                                    </Box>
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

                            {/* Sección de Stats con Rating */}
                            <Grid size={12}>
                                <CyberText sx={{ mb: 2, color: UI_COLORS.accent, fontSize: '0.8rem' }}>CHARACTER_STATISTICS_V9.0</CyberText>
                                <Grid container spacing={2}>
                                    {STAT_SYSTEM.map(({ key, label }) => {
                                        const val = selectedItem.stats?.[key] || 0;
                                        const isUnknown = val === -1;
                                        const isMax = val >= 5;
                                        const accentColor = isUnknown ? "#ff0055" : (isMax ? "#ff0055" : UI_COLORS.accent);

                                        return (
                                            <Grid key={key} size={3} sx={{ display: 'flex', justifyContent: 'center' }}>
                                                <Box sx={{ 
                                                    border: `1px solid ${accentColor}${isUnknown ? '88' : '22'}`, 
                                                    p: 1.5, 
                                                    borderRadius: 0, 
                                                    position: 'relative',
                                                    background: isUnknown ? 'linear-gradient(45deg, rgba(255,0,85,0.05) 0%, rgba(0,0,0,0) 100%)' : 'transparent',
                                                    transition: 'all 0.3s ease'
                                                }}>
                                                    {/* Icono arriba a la derecha para setear -1 */}
                                                    <Tooltip title="SET_UNKNOWN">
                                                        <IconButton 
                                                            onClick={() => toggleUnknown(key)}
                                                            size="small"
                                                            sx={{ 
                                                                position: 'absolute', top: 2, right: 2, 
                                                                color: isUnknown ? '#ff0055' : 'rgba(255,255,255,0.2)',
                                                                '&:hover': { color: '#ff0055' }
                                                            }}
                                                        >
                                                            <QuestionMarkIcon sx={{ fontSize: '0.9rem' }} />
                                                        </IconButton>
                                                    </Tooltip>

                                                    <CyberText variant="caption" sx={{ 
                                                        color: isUnknown ? '#ff0055' : 'rgba(255,255,255,0.5)',
                                                        display: 'block', mb: 1, fontWeight: isUnknown ? 'bold' : 'normal'
                                                    }}>
                                                        {isUnknown ? "UNKNOWN_ERR" : label.toUpperCase()}
                                                    </CyberText>

                                                    <Rating
                                                        max={5}
                                                        value={isUnknown ? 0 : val}
                                                        disabled={isUnknown}
                                                        onChange={(e, newValue) => handleStatChange(key, newValue)}
                                                        icon={<CustomFilledIcon isMax={isMax} isUnknown={isUnknown} />}
                                                        emptyIcon={<CustomEmptyIcon />}
                                                        sx={{ opacity: isUnknown ? 0.3 : 1 }}
                                                    />
                                                </Box>
                                            </Grid>
                                        );
                                    })}
                                </Grid>
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