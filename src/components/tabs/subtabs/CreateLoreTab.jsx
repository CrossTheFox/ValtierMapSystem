import React, { useState } from 'react';
import { createLoreEntry } from '../../../../firebase/services/encyclopediaService'; // Si tienes un servicio específico para esto, úsalo

import { CyberTextField } from '../../customs/CyberTextField';
import { CyberCheckbox } from '../../customs/CyberCheckbox';

import { Button, Box, Typography, Alert } from '@mui/material'; 

export const CreateLoreTab = ({ campaignId, onLoreCreated }) => {
    const [formData, setFormData] = useState({
        title: '',
        category: 'Lore', // Valor por defecto basado en tu BD
        summary: '',
        content: '', // Aquí va el Markdown
        imageUrl: '',
        audioUrl: '',
        isLocked: false,
        unlockGoal: ''
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            await createLoreEntry(campaignId, formData);
            setStatusMessage({ type: 'success', text: 'DATA_SAVED_SUCCESSFULLY' });
            // Reset y callbacks...
        } catch (error) {
            setStatusMessage({ type: 'error', text: 'CRITICAL_ERROR_DATABASE_UNREACHABLE' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3, p: 2 }}>
            <Typography variant="h6" color="primary" sx={{ fontFamily: 'monospace' }}>
                ADD_NEW_LORE_ENTRY
            </Typography>

            {statusMessage.text && (
                <Alert severity={statusMessage.type} sx={{ backgroundColor: 'transparent', border: '1px solid' }}>
                    {statusMessage.text}
                </Alert>
            )}

            <CyberTextField 
                label="TITLE" 
                name="title" 
                value={formData.title} 
                onChange={handleChange} 
                required 
                fullWidth 
            />

            <CyberTextField 
                label="CATEGORY" 
                name="category" 
                value={formData.category} 
                onChange={handleChange} 
                fullWidth 
                helperText="Ej: Lore, Mito, Historia del Mundo..."
            />

            <CyberTextField 
                label="SUMMARY" 
                name="summary" 
                value={formData.summary} 
                onChange={handleChange} 
                required 
                fullWidth 
                multiline 
                rows={2} 
            />

            <CyberTextField 
                label="CONTENT (Markdown Supported)" 
                name="content" 
                value={formData.content} 
                onChange={handleChange} 
                required 
                fullWidth 
                multiline 
                rows={8} 
                helperText="Escribe la historia aquí. Puedes usar formato Markdown (*cursiva*, **negrita**, ![alt](url) para imágenes integradas)."
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
                <CyberTextField 
                    label="COVER IMAGE URL (Optional)" 
                    name="imageUrl" 
                    value={formData.imageUrl} 
                    onChange={handleChange} 
                    fullWidth 
                />
                <CyberTextField 
                    label="AMBIENCE AUDIO URL (Optional)" 
                    name="audioUrl" 
                    value={formData.audioUrl} 
                    onChange={handleChange} 
                    fullWidth 
                    helperText="Link a MP3 o track de fondo"
                />
            </Box>

            <Box sx={{ border: '1px solid #333', p: 2, borderRadius: 1 }}>
                <CyberCheckbox 
                    label="LOCKED_ENTRY (Requiere descubrimiento)" 
                    name="isLocked" 
                    checked={formData.isLocked} 
                    onChange={handleChange} 
                />
                
                {formData.isLocked && (
                    <Box sx={{ mt: 2 }}>
                        <CyberTextField 
                            label="UNLOCK GOAL" 
                            name="unlockGoal" 
                            value={formData.unlockGoal} 
                            onChange={handleChange} 
                            fullWidth 
                            required={formData.isLocked}
                            helperText="Ej: Derrota al Rey Pollo o Encuentra el pergamino en las ruinas."
                        />
                    </Box>
                )}
            </Box>

            <Button 
                type="submit" 
                variant="outlined" 
                disabled={isSubmitting}
                sx={{ 
                    mt: 2, 
                    color: '#ff00ff', // Ajusta al color de tu tema neón
                    borderColor: '#ff00ff',
                    '&:hover': { backgroundColor: 'rgba(255, 0, 255, 0.1)' }
                }}
            >
                {isSubmitting ? 'ENCRYPTING_DATA...' : 'EXECUTE_SAVE_LORE'}
            </Button>
        </Box>
    );
};

export default CreateLoreTab;