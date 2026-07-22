import React, { useState, useEffect } from 'react';
import { Box, Accordion, AccordionSummary, AccordionDetails, Stack, IconButton, Tooltip, Grid, Rating } from '@mui/material';

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import DeleteIcon from '@mui/icons-material/Delete';

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
import {
    defaultStatsFromDefinitions,
    emptyBond,
} from '../../../constants/statSystem';
import { useStatSystem } from '../../../hooks/useStatSystem';
import { normalizeCharacterDoc } from '../../../utils/normalizeCharacter';
import { WIKI_ENTITY_TYPES } from '../../../constants/wikiEntityTypes';
import { MEMBERSHIP_STATUS, MEMBERSHIP_STATUS_OPTIONS } from '../../../constants/wiki/entityFieldSchemas';
import { upsertMembership, removeMembership } from '../../../utils/wikiCustomFields';
import { reconcileCharacterMemberships } from '../../../../firebase/services/membershipService';

function normalizeCharacterSheet(char, statDefs) {
    const base = normalizeCharacterDoc(char);
    return {
        ...base,
        stats: { ...defaultStatsFromDefinitions(statDefs), ...(base.stats || {}) },
    };
}

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
    const { stats: campaignStats } = useStatSystem(currentCampaignId);

    const [characters, setCharacters] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [pendingDeletions, setPendingDeletions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [wikiEntities, setWikiEntities] = useState([]);
    const [newOrgId, setNewOrgId] = useState("");
    const [newOrgStatus, setNewOrgStatus] = useState(MEMBERSHIP_STATUS.CONFIRMADO);

    // Fetch independiente para los personajes
    useEffect(() => {
        if (!currentCampaignId) return;

        const qChar = query(collection(db, "characters"), where("campaignId", "==", currentCampaignId));
        const unsubChar = onSnapshot(qChar, (snap) => {
            setCharacters(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => unsubChar();
    }, [currentCampaignId]);

    // Wiki entities (species + organizations) for narrative integration
    useEffect(() => {
        if (!currentCampaignId) return;
        const ref = collection(db, "campaigns", currentCampaignId, "wikiEntities");
        const unsub = onSnapshot(ref, (snap) => {
            setWikiEntities(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, [currentCampaignId]);

    const speciesOptions = wikiEntities.filter((e) => e.entityType === WIKI_ENTITY_TYPES.ESPECIE);
    const orgOptions = wikiEntities.filter((e) => e.entityType === WIKI_ENTITY_TYPES.ORGANIZACION);
    const orgTitle = (id) => wikiEntities.find((e) => e.id === id)?.title || id;

    const handleAddNew = () => {
        setSelectedItem({
            name: "NEW_ENTRY_UNNAMED",
            isNew: true,
            campaignId: currentCampaignId,
            age: 0,
            bio: "",
            locationId: "",
            stats: defaultStatsFromDefinitions(campaignStats),
            bond: emptyBond(),
            bondPowers: [],
            isLocked: true,
            unlockGoal: "",
            speciesEntityId: null,
            organizationMemberships: []
        });
    };

    const handleAddOrg = () => {
        if (!newOrgId) return;
        setSelectedItem((prev) => ({
            ...prev,
            organizationMemberships: upsertMembership(prev.organizationMemberships, {
                organizationEntityId: newOrgId,
                status: newOrgStatus,
            }),
        }));
        setNewOrgId("");
        setNewOrgStatus(MEMBERSHIP_STATUS.CONFIRMADO);
    };

    const handleRemoveOrg = (orgId) => {
        setSelectedItem((prev) => ({
            ...prev,
            organizationMemberships: removeMembership(prev.organizationMemberships, orgId),
        }));
    };

    const handleUpdate = async () => {
        setLoading(true);
        try {
            if (pendingDeletions.length > 0) {
                await Promise.all(pendingDeletions.map(path => deleteStorageFile(path)));
                setPendingDeletions([]);
            }

            if (selectedItem.isNew) {
                const { isNew, effort: _e, strain: _s, ...newData } = selectedItem;
                const docRef = await createCampaignElement('characters', newData);
                setSelectedItem({ id: docRef.id, ...newData });

                await reconcileCharacterMemberships(
                    currentCampaignId,
                    docRef.id,
                    [],
                    newData.organizationMemberships || []
                );

                dispatch(showSnackbar({
                    message: "PROTOCOL_EXECUTED: NEW_ENTRY_SECURED",
                    severity: "success"
                }));
            } else {
                const { id, effort: _e2, strain: _s2, ...updateData } = selectedItem;
                await updateCampaignElement('characters', id, updateData);

                const prevMemberships = characters.find((c) => c.id === id)?.organizationMemberships || [];
                await reconcileCharacterMemberships(
                    currentCampaignId,
                    id,
                    prevMemberships,
                    updateData.organizationMemberships || []
                );

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
                    onChange={(e, val) => {
                        if (!val) {
                            setSelectedItem(null);
                            return;
                        }
                        setSelectedItem(normalizeCharacterSheet(val, campaignStats));
                    }}
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
                                    <CyberInput
                                        select
                                        label="SPECIES_DESIGNATION"
                                        value={selectedItem.speciesEntityId || ''}
                                        onChange={(e) => setSelectedItem({...selectedItem, speciesEntityId: e.target.value || null})}
                                    >
                                        <option value="" style={{backgroundColor: '#000'}}>UNKNOWN_OR_UNASSIGNED</option>
                                        {speciesOptions.map((sp) => (
                                            <option key={sp.id} value={sp.id} style={{backgroundColor: '#000'}}>
                                                {(sp.title || '').toUpperCase()}
                                            </option>
                                        ))}
                                    </CyberInput>
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
                                    {campaignStats.map(({ key, label }) => {
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
                                <CyberText sx={{ mb: 2, color: UI_COLORS.accent, fontSize: "0.8rem" }}>
                                    SHEET_DATA (BOND / POWERS) — Effort is session-only in the player dialog
                                </CyberText>
                                <Grid container spacing={2}>
                                    <Grid size={6}>
                                        <CyberInput
                                            label="BOND_NAME"
                                            value={selectedItem.bond?.name ?? ""}
                                            onChange={(e) =>
                                                setSelectedItem({
                                                    ...selectedItem,
                                                    bond: { ...emptyBond(), ...selectedItem.bond, name: e.target.value },
                                                })
                                            }
                                        />
                                    </Grid>
                                    <Grid size={6}>
                                        <CyberInput
                                            label="BOND_ARCHETYPE"
                                            value={selectedItem.bond?.archetype ?? ""}
                                            onChange={(e) =>
                                                setSelectedItem({
                                                    ...selectedItem,
                                                    bond: { ...emptyBond(), ...selectedItem.bond, archetype: e.target.value },
                                                })
                                            }
                                        />
                                    </Grid>
                                    <Grid size={12}>
                                        <CyberInput
                                            label="BOND_DESCRIPTION"
                                            multiline
                                            rows={3}
                                            value={selectedItem.bond?.description ?? ""}
                                            onChange={(e) =>
                                                setSelectedItem({
                                                    ...selectedItem,
                                                    bond: { ...emptyBond(), ...selectedItem.bond, description: e.target.value },
                                                })
                                            }
                                        />
                                    </Grid>
                                    <Grid size={12}>
                                        <CyberInput
                                            label="SPECIAL_ABILITY"
                                            multiline
                                            rows={2}
                                            value={selectedItem.bond?.specialAbility ?? ""}
                                            onChange={(e) =>
                                                setSelectedItem({
                                                    ...selectedItem,
                                                    bond: { ...emptyBond(), ...selectedItem.bond, specialAbility: e.target.value },
                                                })
                                            }
                                        />
                                    </Grid>
                                    <Grid size={12}>
                                        <CyberInput
                                            label="SECOND_WIND"
                                            multiline
                                            rows={2}
                                            value={selectedItem.bond?.secondWind ?? ""}
                                            onChange={(e) =>
                                                setSelectedItem({
                                                    ...selectedItem,
                                                    bond: { ...emptyBond(), ...selectedItem.bond, secondWind: e.target.value },
                                                })
                                            }
                                        />
                                    </Grid>
                                    <Grid size={12}>
                                        <CyberInput
                                            label="IDEALS (one line each)"
                                            multiline
                                            rows={3}
                                            value={(selectedItem.bond?.ideals || []).join("\n")}
                                            onChange={(e) =>
                                                setSelectedItem({
                                                    ...selectedItem,
                                                    bond: {
                                                        ...emptyBond(),
                                                        ...selectedItem.bond,
                                                        ideals: e.target.value
                                                            .split("\n")
                                                            .map((s) => s.trim())
                                                            .filter(Boolean),
                                                    },
                                                })
                                            }
                                        />
                                    </Grid>
                                    <Grid size={12}>
                                        <CyberInput
                                            label="BOND_NOTES"
                                            multiline
                                            rows={2}
                                            value={selectedItem.bond?.notes ?? ""}
                                            onChange={(e) =>
                                                setSelectedItem({
                                                    ...selectedItem,
                                                    bond: { ...emptyBond(), ...selectedItem.bond, notes: e.target.value },
                                                })
                                            }
                                        />
                                    </Grid>
                                    <Grid size={12}>
                                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                                            <CyberText sx={{ color: UI_COLORS.accent, fontSize: "0.75rem" }}>
                                                BOND_POWERS
                                            </CyberText>
                                            <Tooltip title="ADD_POWER_ROW">
                                                <IconButton
                                                    size="small"
                                                    onClick={() =>
                                                        setSelectedItem({
                                                            ...selectedItem,
                                                            bondPowers: [
                                                                ...(selectedItem.bondPowers || []),
                                                                { name: "", description: "", frequency: "" },
                                                            ],
                                                        })
                                                    }
                                                    sx={{ color: UI_COLORS.accent }}
                                                >
                                                    <AddIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Stack>
                                        {(selectedItem.bondPowers || []).map((p, idx) => (
                                            <Box
                                                key={idx}
                                                sx={{
                                                    mb: 2,
                                                    p: 2,
                                                    border: `1px solid ${UI_COLORS.accent}33`,
                                                    borderRadius: 0,
                                                }}
                                            >
                                                <Grid container spacing={1}>
                                                    <Grid size={12}>
                                                        <CyberInput
                                                            label="POWER_NAME"
                                                            value={p.name || ""}
                                                            onChange={(e) => {
                                                                const next = [...(selectedItem.bondPowers || [])];
                                                                next[idx] = { ...next[idx], name: e.target.value };
                                                                setSelectedItem({ ...selectedItem, bondPowers: next });
                                                            }}
                                                        />
                                                    </Grid>
                                                    <Grid size={12}>
                                                        <CyberInput
                                                            label="FREQUENCY"
                                                            value={p.frequency || ""}
                                                            onChange={(e) => {
                                                                const next = [...(selectedItem.bondPowers || [])];
                                                                next[idx] = { ...next[idx], frequency: e.target.value };
                                                                setSelectedItem({ ...selectedItem, bondPowers: next });
                                                            }}
                                                        />
                                                    </Grid>
                                                    <Grid size={12}>
                                                        <CyberInput
                                                            label="DESCRIPTION"
                                                            multiline
                                                            rows={2}
                                                            value={p.description || ""}
                                                            onChange={(e) => {
                                                                const next = [...(selectedItem.bondPowers || [])];
                                                                next[idx] = { ...next[idx], description: e.target.value };
                                                                setSelectedItem({ ...selectedItem, bondPowers: next });
                                                            }}
                                                        />
                                                    </Grid>
                                                </Grid>
                                            </Box>
                                        ))}
                                    </Grid>
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

                                    {/* Organization affiliations (narrative wiki integration) */}
                                    <Box sx={{ border: `1px solid ${UI_COLORS.accent}33`, p: 2, borderRadius: 0 }}>
                                        <CyberText sx={{ color: UI_COLORS.accent, fontSize: '0.8rem', mb: 1.5, display: 'block' }}>
                                            ORGANIZATION_AFFILIATIONS
                                        </CyberText>

                                        {(selectedItem.organizationMemberships || []).length > 0 && (
                                            <Stack spacing={0.5} sx={{ mb: 1.5 }}>
                                                {(selectedItem.organizationMemberships || []).map((m) => (
                                                    <Box key={m.organizationEntityId} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <CyberText sx={{ flex: 1, fontSize: '0.8rem' }}>{orgTitle(m.organizationEntityId)}</CyberText>
                                                        <CyberText sx={{ fontSize: '0.7rem', color: m.status === MEMBERSHIP_STATUS.SOSPECHADO ? '#ff0055' : 'rgba(255,255,255,0.5)' }}>
                                                            {m.status === MEMBERSHIP_STATUS.SOSPECHADO ? 'SOSPECHADO' : 'CONFIRMADO'}
                                                        </CyberText>
                                                        <IconButton size="small" onClick={() => handleRemoveOrg(m.organizationEntityId)} sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#ff0055' } }}>
                                                            <DeleteIcon sx={{ fontSize: '0.9rem' }} />
                                                        </IconButton>
                                                    </Box>
                                                ))}
                                            </Stack>
                                        )}

                                        <Stack direction="row" spacing={1} alignItems="flex-end">
                                            <CyberInput
                                                select
                                                label="ORGANIZATION"
                                                value={newOrgId}
                                                onChange={(e) => setNewOrgId(e.target.value)}
                                                sx={{ flex: 1 }}
                                            >
                                                <option value="" style={{backgroundColor: '#000'}}>SELECT...</option>
                                                {orgOptions.map((o) => (
                                                    <option key={o.id} value={o.id} style={{backgroundColor: '#000'}}>
                                                        {(o.title || '').toUpperCase()}
                                                    </option>
                                                ))}
                                            </CyberInput>
                                            <CyberInput
                                                select
                                                label="STATUS"
                                                value={newOrgStatus}
                                                onChange={(e) => setNewOrgStatus(e.target.value)}
                                                sx={{ width: 160 }}
                                            >
                                                {MEMBERSHIP_STATUS_OPTIONS.map((s) => (
                                                    <option key={s.value} value={s.value} style={{backgroundColor: '#000'}}>
                                                        {s.label.toUpperCase()}
                                                    </option>
                                                ))}
                                            </CyberInput>
                                            <CyberButton onClick={handleAddOrg} sx={{ width: 'fit-content' }}>
                                                + ADD
                                            </CyberButton>
                                        </Stack>
                                    </Box>
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