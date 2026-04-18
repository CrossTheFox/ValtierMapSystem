import React, { useState } from 'react';
import { Box, Grid } from '@mui/material';
import AdminNavButton from '../customs/AdminNavButton';
import AddPlayerForm from './subtabs/AddPlayerForm'; // Formulario de inscripción
import AddMapForm from './subtabs/AddMapForm';
import { CyberTitle } from '../customs/CustomTexts';

export default function GeneralSettingsTab({ currentCampaignId }) {
    const [activeSubTab, setActiveSubTab] = useState('ADD_PLAYERS');

    const menuItems = [
        { id: 'ADD_PLAYERS', label: 'ADD_PLAYERS' },
        { id: 'MANAGE_MAPS', label: 'MANAGE_MAPS' },
    ];

    return (
        <Grid container sx={{ height: '100%' }}>
            {/* SIDEBAR IZQUIERDA */}
            <Grid size={3} sx={{ 
                borderRight: '1px solid rgba(255, 255, 255, 0.1)', 
                display: 'flex', 
                flexDirection: 'column',
                pt: 2 
            }}>
                {menuItems.map((item) => (
                    <AdminNavButton
                        key={item.id}
                        label={item.label}
                        isSelected={activeSubTab === item.id}
                        onClick={() => setActiveSubTab(item.id)}
                    />
                ))}
            </Grid>

            {/* CONTENIDO DINÁMICO */}
            <Grid size={9} sx={{ p: 4, overflowY: 'auto' }}>
                {activeSubTab === 'ADD_PLAYERS' && <AddPlayerForm currentCampaignId={currentCampaignId} />}
                {activeSubTab === 'MANAGE_MAPS' && <AddMapForm currentCampaignId={currentCampaignId} />}
            </Grid>
        </Grid>
    );
}