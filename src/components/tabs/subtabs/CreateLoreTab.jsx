import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useDispatch, useSelector } from 'react-redux';
import { saveWikiEntity } from '../../../store/wikiSlice';
import { slugify } from '../../../utils/wikiSlug';

import { CyberText, CyberTitle } from '../../customs/CustomTexts';
import { CyberTextField } from '../../customs/CyberTextField';
import { CyberCheckbox } from '../../customs/CyberCheckbox';

import { Button, Box, Alert, Paper, Divider, Grid, MenuItem, Select, FormControl, InputLabel } from '@mui/material';
import { UI_COLORS } from '../../../constants/uiColors';

const CATEGORY_OPTIONS = [
    { value: "general", label: "General" },
    { value: "historia", label: "Historia" },
    { value: "mito", label: "Mito" },
    { value: "leyenda", label: "Leyenda" },
    { value: "documento", label: "Documento / texto" },
    { value: "otro", label: "Otro" },
];

const selectSx = {
    color: UI_COLORS.textPrimary,
    fontFamily: "'Fira Sans', sans-serif",
    fontSize: "0.9rem",
    bgcolor: UI_COLORS.backgroundPrimary,
    "& .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.border },
    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: `${UI_COLORS.accent}88` },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.accent },
    "& .MuiSvgIcon-root": { color: UI_COLORS.textSecondary },
};

export const CreateLoreTab = ({ campaignId, onLoreCreated }) => {
    const dispatch = useDispatch();
    const uid = useSelector((s) => s.player.profile?.uid);

    const [formData, setFormData] = useState({
        title: '',
        category: 'general',
        summary: '',
        content: '',
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
            await dispatch(saveWikiEntity({
                campaignId,
                entityId: null,
                uid,
                data: {
                    entityType: "cronica",
                    title: formData.title,
                    summary: formData.summary,
                    body: formData.content,
                    tags: [],
                    visibility: formData.isLocked ? "dm_only" : "players",
                    slug: slugify(formData.title),
                    customFields: {
                        cronica: {
                            category: formData.category,
                            isLocked: formData.isLocked,
                            unlockGoal: formData.unlockGoal,
                            legacyEncyclopediaId: null,
                        },
                    },
                },
            })).unwrap();

            setStatusMessage({ type: 'success', text: 'DATA_SAVED_SUCCESSFULLY' });
            setFormData({ title: '', category: 'general', summary: '', content: '', isLocked: false, unlockGoal: '' });
            if (onLoreCreated) onLoreCreated();
        } catch (error) {
            console.error("Error creating chronicle entry:", error);
            setStatusMessage({ type: 'error', text: 'CRITICAL_ERROR_DATABASE_UNREACHABLE' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Box component="form" onSubmit={handleSubmit} sx={{ p: 2 }}>
            <Grid container spacing={3}>
                {statusMessage.text && (
                    <Grid size={12}>
                        <Alert severity={statusMessage.type} variant="outlined">
                            {statusMessage.text}
                        </Alert>
                    </Grid>
                )}

                {/* Left: form */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Grid container spacing={2}>
                        <Grid size={12}>
                            <CyberTextField label="TITLE" name="title" value={formData.title} onChange={handleChange} required fullWidth />
                        </Grid>

                        <Grid size={{ xs: 12, sm: 8 }}>
                            <FormControl fullWidth>
                                <InputLabel sx={{ color: UI_COLORS.textSecondary }}>CATEGORY</InputLabel>
                                <Select
                                    name="category"
                                    value={formData.category}
                                    onChange={handleChange}
                                    label="CATEGORY"
                                    sx={selectSx}
                                >
                                    {CATEGORY_OPTIONS.map((o) => (
                                        <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid size={{ xs: 12, sm: 4 }} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${UI_COLORS.border}`, borderRadius: '4px' }}>
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

                {/* Right: preview */}
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
                        borderColor: UI_COLORS.border,
                        '& h1, h2, h3': { color: UI_COLORS.accent, fontFamily: 'Orbitron, sans-serif' },
                        '& p': { color: '#ccc', lineHeight: 1.6, fontFamily: 'Fira Sans, sans-serif' },
                        '& code': { backgroundColor: '#1a1a1a', p: 0.5, borderRadius: 1, color: UI_COLORS.anomaly }
                    }}>
                        {formData.content ? (
                            <ReactMarkdown>{formData.content}</ReactMarkdown>
                        ) : (
                            <CyberTitle sx={{ color: '#444', fontStyle: 'italic' }}>Esperando entrada de datos...</CyberTitle>
                        )}
                    </Paper>
                </Grid>

                <Grid size={12}>
                    <Divider sx={{ borderColor: UI_COLORS.border, my: 1 }} />
                </Grid>

                <Grid size={{ xs: 12, md: 4 }} sx={{ display: 'flex', alignItems: 'flex-start' }}>
                    <Button
                        type="submit"
                        variant="outlined"
                        disabled={isSubmitting}
                        fullWidth
                        sx={{
                            height: '56px',
                            color: UI_COLORS.anomaly,
                            borderColor: UI_COLORS.anomaly,
                            textTransform: 'uppercase',
                            fontFamily: 'Orbitron',
                            '&:hover': { backgroundColor: `${UI_COLORS.anomaly}18`, borderColor: UI_COLORS.anomaly }
                        }}
                    >
                        {isSubmitting ? 'UPLOADING...' : 'SAVE_CHRONICLE'}
                    </Button>
                </Grid>
            </Grid>
        </Box>
    );
};

export default CreateLoreTab;