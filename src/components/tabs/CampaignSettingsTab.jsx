import React, { useState, useEffect } from 'react';
import { Grid } from '@mui/material';
import AdminNavButton from '../customs/AdminNavButton';
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import { UI_COLORS } from '../../constants/uiColors';

// Imports de las Subtabs
import LocationsSubTab from './subtabs/LocationsSubTab';
import CharactersSubTab from './subtabs/CharactersSubTab';
import CreateLoreTab from './subtabs/CreateLoreTab';

export default function CampaignSettingsTab({ currentCampaignId }) {
    const [activeSubTab, setActiveSubTab] = useState('LOCATIONS');
    
    // Estados COMPARTIDOS que necesitan estar disponibles globalmente
    const [locations, setLocations] = useState([]);
    const [maps, setMaps] = useState([]);

    useEffect(() => {
        if (!currentCampaignId) return;

        // Obtener Mapas de la campaña para filtrar localizaciones
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
            } else {
                setLocations([]);
            }
        });

        return () => { unsubMaps(); };
    }, [currentCampaignId]);

    return (
        <Grid 
            container 
            sx={{ 
                height: '100%', 
                width: '100%', 
                margin: 0, 
                overflow: 'hidden',
            }}
        >
            <Grid size={2} sx={{ 
                borderRight: '1px solid rgba(255, 255, 255, 0.1)', 
                pt: 2, 
                height: '100%',
                boxSizing: 'border-box'
            }}>
                <AdminNavButton 
                    label="LOCATIONS" 
                    isSelected={activeSubTab === 'LOCATIONS'} 
                    onClick={() => setActiveSubTab('LOCATIONS')} 
                />
                <AdminNavButton 
                    label="CHARACTERS" 
                    isSelected={activeSubTab === 'CHARACTERS'} 
                    onClick={() => setActiveSubTab('CHARACTERS')} 
                />
                <AdminNavButton 
                    label="CREATE_LORE" 
                    isSelected={activeSubTab === 'CREATE_LORE'} 
                    onClick={() => setActiveSubTab('CREATE_LORE')} 
                />
            </Grid>

            <Grid size={10} sx={{ 
                p: { xs: 2, md: 4 }, 
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
                {activeSubTab === 'LOCATIONS' && (
                    <LocationsSubTab 
                        currentCampaignId={currentCampaignId} 
                        locations={locations} 
                        maps={maps} 
                    />
                )}
                
                {activeSubTab === 'CHARACTERS' && (
                    <CharactersSubTab 
                        currentCampaignId={currentCampaignId} 
                        locations={locations} 
                    />
                )}
                {activeSubTab === 'CREATE_LORE' && (
                    <CreateLoreTab 
                        campaignId={currentCampaignId} 
                    />
                )}

            </Grid>
        </Grid>
    );
}