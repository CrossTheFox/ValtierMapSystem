import React, { useState } from 'react';
import { Box, Stack, Grid, Button, CircularProgress } from '@mui/material';
import { CyberInput, CyberButton } from '../../customs/CyberInputs';
import { CyberTitle, CyberText } from '../../customs/CustomTexts';
import { createMapDoc } from '../../../../firebase/services/mapService';
import { UI_COLORS } from '../../../constants/uiColors';

export default function AddMapForm({ currentCampaignId }) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        imageUrl: '',
        width: 2048,
        height: 2048,
        metersPerPixel: 1,
        unit: 'm'
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: (name === 'width' || name === 'height' || name === 'metersPerPixel') 
                ? Number(value) 
                : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const finalData = {
                ...formData,
                campaignId: currentCampaignId,
                createdAt: new Date() // Firestore lo convertirá a Timestamp
            };
            await createMapDoc(finalData);
            alert("MAP_DATA_UPLOAD_SUCCESSFUL");
            // Opcional: limpiar form
        } catch (error) {
            console.error("Error adding map:", error);
            alert("CRITICAL_ERROR: UPLOAD_FAILED");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box component="form" onSubmit={handleSubmit} className="login-box" sx={{ p: 3, maxWidth: '800px' }}>
            <CyberTitle variant="h5" sx={{ mb: 3 }}>REGISTER_NEW_MAP_MODULE</CyberTitle>

            <Stack spacing={3}>
                <div className="user-box">
                    <input required name="name" type="text" value={formData.name} onChange={handleChange} placeholder=" " />
                    <label><CyberText>MAP_IDENTIFIER</CyberText></label>
                </div>

                <div className="user-box">
                    <input required name="imageUrl" type="text" value={formData.imageUrl} onChange={handleChange} placeholder=" " />
                    <label><CyberText>IMAGE_SOURCE_PATH (e.g. maps/Valtia.jpg)</CyberText></label>
                </div>

                <div className="user-box">
                    <textarea 
                        required 
                        name="description" 
                        value={formData.description} 
                        onChange={handleChange} 
                        placeholder=" "
                        style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #fff', color: '#fff', width: '100%', outline: 'none', marginTop: '20px' }}
                    />
                    <label><CyberText>MAP_DESCRIPTION_ENCODING</CyberText></label>
                </div>

                <Grid container spacing={2}>
                    <Grid item xs={6}>
                        <div className="user-box">
                            <input required name="width" type="number" value={formData.width} onChange={handleChange} placeholder=" " />
                            <label><CyberText>PIXEL_WIDTH</CyberText></label>
                        </div>
                    </Grid>
                    <Grid item xs={6}>
                        <div className="user-box">
                            <input required name="height" type="number" value={formData.height} onChange={handleChange} placeholder=" " />
                            <label><CyberText>PIXEL_HEIGHT</CyberText></label>
                        </div>
                    </Grid>
                    <Grid item xs={6}>
                        <div className="user-box">
                            <input required name="metersPerPixel" type="number" value={formData.metersPerPixel} onChange={handleChange} placeholder=" " />
                            <label><CyberText>METERS_PER_PIXEL</CyberText></label>
                        </div>
                    </Grid>
                    <Grid item xs={6}>
                        <div className="user-box">
                            <input required name="unit" type="text" value={formData.unit} onChange={handleChange} placeholder=" " />
                            <label><CyberText>SCALE_UNIT (m/km)</CyberText></label>
                        </div>
                    </Grid>
                </Grid>

                <button type="submit" className="submit-btn" disabled={loading}>
                    <span /><span /><span /><span />
                    <CyberTitle sx={{ fontSize: '1rem' }}>
                        {loading ? <CircularProgress size={20} sx={{ color: UI_COLORS.accent }} /> : "INITIALIZE_MAP_SEQUENCE"}
                    </CyberTitle>
                </button>
            </Stack>
        </Box>
    );
}