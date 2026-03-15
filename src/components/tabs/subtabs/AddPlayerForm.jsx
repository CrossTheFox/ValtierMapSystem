import React, { useState } from 'react';
import { Box, Stack, Alert, Collapse } from '@mui/material';
import { CyberInput, CyberButton } from '../../customs/CyberInputs';
import { CyberTitle, CyberText } from '../../customs/CustomTexts';
import { CyberCheckbox } from '../../customs/CyberCheckbox';
import { UI_COLORS } from '../../../constants/uiColors';
import { ROLES } from '../../../constants/roles';
import { registerPlayer } from '../../../../firebase/playersAuth';

export default function AddPlayerForm({ currentCampaignId }) {
    const [formData, setFormData] = useState({
        nickname: '',
        password: '',
        isDM: false
    });
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState({ type: '', msg: '', open: false });

    const handleChange = (field) => (e) => {
        setFormData({ ...formData, [field]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatus({ ...status, open: false });

        try {
            // Definimos el rol según el checkbox
            const role = formData.isDM ? ROLES.DM : ROLES.PLAYER;

            // Ejecutamos el registro en Firebase con la data de tu arquitectura
            await registerPlayer(
                formData.nickname, 
                formData.password, 
                role, 
                currentCampaignId // Pasamos el ID de la campaña activa
            );

            setStatus({ 
                type: 'success', 
                msg: 'SUBJECT_ENROLLED: Connection established and campaign linked', 
                open: true 
            });
            
            // Reset del form (manteniendo el estado del checkbox si lo prefieres)
            setFormData({ nickname: '', password: '', isDM: false });
        } catch (error) {
            console.error("Enrollment error:", error);
            setStatus({ 
                type: 'error', 
                msg: `CONNECTION_FAILED: ${error.code || 'System rejection'}`, 
                open: true 
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ maxWidth: '500px' }}>
            <Stack spacing={1} sx={{ mb: 4 }}>
                <CyberTitle variant="h5" sx={{ color: UI_COLORS.accent || "#00f2ea" }}>
                    NEW_PLAYER_REGISTRATION
                </CyberTitle>
                <CyberText sx={{ opacity: 0.7 }}>
                    Ingrese las credenciales para autorizar el acceso de un nuevo usuario a la campaña activa.
                </CyberText>
            </Stack>

            <Collapse in={status.open}>
                <Alert 
                    severity={status.type === 'success' ? 'success' : 'error'}
                    sx={{ 
                        mb: 3, 
                        backgroundColor: status.type === 'success' ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 0, 0, 0.1)',
                        color: '#fff',
                        fontFamily: 'Michroma',
                        border: `1px solid ${status.type === 'success' ? '#00ff00' : '#ff0000'}`,
                        '& .MuiAlert-icon': { color: status.type === 'success' ? '#00ff00' : '#ff0000' }
                    }}
                    onClose={() => setStatus({ ...status, open: false })}
                >
                    {status.msg}
                </Alert>
            </Collapse>

            <form onSubmit={handleSubmit}>
                <Stack spacing={2}>
                    <CyberInput 
                        label="USERNAME / NICKNAME"
                        value={formData.nickname}
                        onChange={handleChange('nickname')}
                        allowAutofill={false}
                        required
                    />

                    <CyberInput 
                        label="ACCESS_KEY (PASSWORD)"
                        type="new-password" // Evita autocompletado en algunos navegadores
                        value={formData.password}
                        onChange={handleChange('password')}
                        allowAutofill={false}
                        required
                    />

                    <CyberCheckbox 
                        label="GRANT_DUNGEON_MASTER_AUTHORITY"
                        checked={formData.isDM}
                        onChange={(e) => setFormData({...formData, isDM: e.target.checked})}
                    />

                    <Box sx={{ mt: 2 }}>
                        <CyberButton loading={loading}>
                            EXECUTE_ENROLLMENT
                        </CyberButton>
                    </Box>
                </Stack>
            </form>
        </Box>
    );
}