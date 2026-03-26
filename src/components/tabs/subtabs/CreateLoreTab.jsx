import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { createLoreEntry } from '../../../../firebase/services/encyclopediaService'; // Si tienes un servicio específico para esto, úsalo

import { CyberText, CyberTitle } from '../../customs/CustomTexts';
import { CyberTextField } from '../../customs/CyberTextField';
import { CyberCheckbox } from '../../customs/CyberCheckbox';

import { Button, Box, Typography, Alert, Paper, Divider, Grid } from '@mui/material'; 

export const CreateLoreTab = ({ campaignId, onLoreCreated }) => {
    const [formData, setFormData] = useState({
        title: '',
        category: 'Lore',
        summary: '',
        content: '',
        imageUrl: '',
        audioUrl: '',
        isLocked: false,
        unlockGoal: ''
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

    const handleChange = (e) => {
        // Fix para Checkbox: aseguramos que tome 'checked' si el type es checkbox
        const { name, value, type, checked } = e.target;
        
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        console.log("Submitting Lore Entry:", formData); // Debug: Verificar datos antes de enviar

        try {
            await createLoreEntry(campaignId, formData);
            setStatusMessage({ type: 'success', text: 'DATA_SAVED_SUCCESSFULLY' });
            if(onLoreCreated) onLoreCreated();
        } catch (error) {
            console.error("Error creating lore entry:", error);
            setStatusMessage({ type: 'error', text: 'CRITICAL_ERROR_DATABASE_UNREACHABLE' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Box component="form" onSubmit={handleSubmit} sx={{ p: 2 }}>
            <Grid container spacing={3}>
                
                {/* MENSAJES DE ESTADO */}
                {statusMessage.text && (
                    <Grid size={12}>
                        <Alert severity={statusMessage.type} variant="outlined" sx={{ borderColor: 'primary.main', color: 'primary.main' }}>
                            {statusMessage.text}
                        </Alert>
                    </Grid>
                )}

                {/* COLUMNA IZQUIERDA: FORMULARIO */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Grid container spacing={2}>
                        <Grid size={12}>
                            <CyberTextField label="TITLE" name="title" value={formData.title} onChange={handleChange} required fullWidth />
                        </Grid>

                        <Grid size={{ xs: 12, sm: 8 }}>
                            <CyberTextField label="CATEGORY" name="category" value={formData.category} onChange={handleChange} fullWidth />
                        </Grid>

                        <Grid size={{ xs: 12, sm: 4 }} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #333', borderRadius: '4px' }}>
                            <CyberCheckbox 
                                label="LOCKED" 
                                name="isLocked" 
                                checked={formData.isLocked} 
                                onChange={handleChange} 
                            />
                        </Grid>

                        {formData.isLocked && (
                            <Grid size={12}>
                                <CyberTextField 
                                    label="UNLOCK_GOAL" 
                                    name="unlockGoal" 
                                    value={formData.unlockGoal} 
                                    onChange={handleChange} 
                                    placeholder="Ej: Derrota al Rey Pollo..."
                                    required 
                                    fullWidth 
                                />
                            </Grid>
                        )}

                        <Grid size={12}>
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
                        </Grid>

                        <Grid size={12}>
                            <CyberTextField 
                                label="CONTENT (Markdown)" 
                                name="content" 
                                value={formData.content} 
                                onChange={handleChange} 
                                required 
                                fullWidth 
                                multiline 
                                rows={10} 
                            />
                        </Grid>
                    </Grid>
                </Grid>

                {/* COLUMNA DERECHA: PREVIEW REALTIME */}
                <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex', flexDirection: 'column' }}>
                    <CyberTitle variant="overline" sx={{ mb: 1, color: '#666', display: 'block' }}>
                        MARKDOWN_PREVIEW_LIVE
                    </CyberTitle>
                    <Paper variant="outlined" sx={{ 
                        p: 3, 
                        flexGrow: 1,
                        minHeight: '400px',
                        maxHeight: '650px', 
                        overflowY: 'auto',
                        backgroundColor: 'rgba(0,0,0,0.2)',
                        borderColor: '#333',
                        '& h1, h2, h3': { color: '#ff00ff', fontFamily: 'Orbitron, sans-serif' },
                        '& p': { color: '#ccc', lineHeight: 1.6, fontFamily: 'Roboto, sans-serif' },
                        '& code': { backgroundColor: '#1a1a1a', p: 0.5, borderRadius: 1, color: '#00f2ea' }
                    }}>
                        {formData.content ? (
                            <ReactMarkdown>{formData.content}</ReactMarkdown>
                        ) : (
                            <CyberTitle sx={{ color: '#444', fontStyle: 'italic' }}>Esperando entrada de datos...</CyberTitle>
                        )}
                    </Paper>
                </Grid>

                <Grid size={12}>
                    <Divider sx={{ borderColor: '#333', my: 1 }} />
                </Grid>

                {/* MULTIMEDIA Y ACCIONES */}
                <Grid size={{ xs: 12, md: 4 }}>
                    <CyberTextField label="IMAGE_URL" name="imageUrl" value={formData.imageUrl} onChange={handleChange} fullWidth />
                </Grid>
                
                <Grid size={{ xs: 12, md: 4 }}>
                    <CyberTextField label="AUDIO_URL" name="audioUrl" value={formData.audioUrl} onChange={handleChange} fullWidth />
                </Grid>

                <Grid size={{ xs: 12, md: 4 }} sx={{ display: 'flex', alignItems: 'flex-start' }}>
                    <Button 
                        type="submit" 
                        variant="outlined" 
                        disabled={isSubmitting}
                        fullWidth
                        sx={{ 
                            height: '56px',
                            color: '#00f2ea', 
                            borderColor: '#00f2ea',
                            textTransform: 'uppercase',
                            fontFamily: 'Orbitron',
                            '&:hover': { backgroundColor: 'rgba(0, 242, 234, 0.1)', borderColor: '#00f2ea' }
                        }}
                    >
                        {isSubmitting ? 'UPLOADING...' : 'SAVE_LORE'}
                    </Button>
                </Grid>
            </Grid>
        </Box>
    );
};

export default CreateLoreTab;