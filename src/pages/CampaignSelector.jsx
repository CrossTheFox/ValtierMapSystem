import React, { useEffect, useState } from 'react';
import { Box, Stack, CircularProgress } from '@mui/material';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { useDispatch } from 'react-redux';
import { setSelectedCampaign } from '../store/worldSlice';
import { CyberTitle, CyberText } from '../components/customs/CustomTexts';
import { UI_COLORS } from '../constants/uiColors';

const CampaignSelector = () => {
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const dispatch = useDispatch();

    useEffect(() => {
        const fetchCampaigns = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, "campaigns"));
                const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setCampaigns(docs);
            } catch (error) {
                console.error("Error fetching campaigns:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchCampaigns();
    }, []);

    if (loading) return <CircularProgress sx={{ color: UI_COLORS.accent }} />;

    return (
        <div className="login-box">
            <CyberTitle variant="h5" className="title-auth" sx={{ mb: 4, textAlign: 'center' }}>
                SELECT_MISSION_FILE
            </CyberTitle>
            
            <Stack spacing={2.5}>
                {campaigns.map((camp) => (
                    <button 
                        key={camp.id}
                        className="submit-btn" // Reutilizamos tu clase CSS de la Landing
                        onClick={() => dispatch(setSelectedCampaign(camp.id))}
                        style={{ 
                            width: '100%', 
                            textAlign: 'left', 
                            padding: '15px 20px',
                            display: 'flex',
                            flexDirection: 'column',
                            height: 'auto'
                        }}
                    >
                        <span /><span /><span /><span />
                        <CyberTitle sx={{ fontSize: '1.1rem', mb: 0.5 }}>
                            {camp.name?.toUpperCase() || "UNKNOWN_DATA"}
                        </CyberTitle>
                        <CyberText variant="caption" sx={{ opacity: 0.5, letterSpacing: '2px' }}>
                            REF_ID: {camp.id.substring(0, 12).toUpperCase()}
                        </CyberText>
                    </button>
                ))}
            </Stack>
        </div>
    );
};

export default CampaignSelector;