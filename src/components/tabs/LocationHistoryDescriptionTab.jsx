import React, { useState, useEffect } from "react";
import { Grid, Box, Skeleton, Typography } from "@mui/material";
import { 
    Timeline, 
    TimelineItem, 
    TimelineSeparator, 
    TimelineConnector, 
    TimelineContent, 
    TimelineDot, 
    TimelineOppositeContent 
} from "@mui/lab";
import { loadFirebaseAsset, getCachedUrl } from "../../../firebase/services/assetLoader";
import { CyberTitle } from "../customs/CustomTexts";
import AnimatedTypewriterText from "../animations/AnimatedTypewriterText";
import LandscapeIcon from "@mui/icons-material/Landscape";
import { UI_COLORS } from "../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";

export default function LocationHistoryDescriptionTab({ location }) {
    const [url, setUrl] = useState(() => getCachedUrl(location?.imageUrl) || null);

    useEffect(() => {
        if (!url && location?.imageUrl) {
            loadFirebaseAsset(location.imageUrl).then(setUrl);
        }
    }, [location?.imageUrl, url]);

    const historyEvents = Array.isArray(location?.history) ? location.history : [];

    return (
        // Quitamos overflowY y maxHeight para que use el del padre
        <Box sx={{ flexGrow: 1, p: 3 }}> 
            <Grid container spacing={4}>
                {/* 1. DESCRIPCIÓN E IMAGEN */}
                <Grid size={{ xs: 12, md: 7 }}>
                    <Box sx={{ mb: 2 }}>
                        <CyberTitle variant="h5" sx={{ mb: 2, color: UI_COLORS.accent }}>
                            SYSTEM_LOG: DESCRIPTION
                        </CyberTitle>
                        <AnimatedTypewriterText 
                            text={location?.description || "No description available."}
                            duration={3000} 
                        />
                    </Box>
                </Grid>

                <Grid size={{ xs: 12, md: 5 }}>
                    <Box sx={{
                        width: '100%',
                        height: '250px',
                        backgroundColor: "#1a1a2a",
                        borderRadius: '8px',
                        border: `1px solid ${UI_COLORS.accent}44`,
                        boxShadow: `0 0 20px ${UI_COLORS.accentGlow}33`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                    }}>
                        {location?.imageUrl ? (
                            url ? <Box component="img" src={url} sx={{ width: "100%", height: "100%", objectFit: "cover" }} /> 
                            : <Skeleton variant="rectangular" width="100%" height="100%" sx={{ bgcolor: "#121221" }} />
                        ) : <LandscapeIcon sx={{ fontSize: 60, color: "#3a3a4d" }} />}
                    </Box>
                </Grid>

                {/* 2. LÍNEA DE TIEMPO */}
                <Grid size={{ xs: 12 }}>
                    <Box sx={{ mt: 4, pt: 3, borderTop: `1px solid ${UI_COLORS.accent}22` }}>
                        <CyberTitle variant="h6" sx={{ mb: 4, color: UI_COLORS.accent, textAlign: 'center' }}>
                            HISTORICAL_TIMELINE_STREAMS
                        </CyberTitle>

                        {historyEvents.length > 0 ? (
                            <Timeline position="alternate">
                                {historyEvents.map((event, index) => (
                                    <TimelineItem key={index}>
                                        <TimelineOppositeContent sx={{ m: 'auto 0', color: UI_COLORS.accent, fontWeight: 'bold', fontFamily: 'Orbitron, sans-serif' }}>
                                            {event.date}
                                        </TimelineOppositeContent>

                                        <TimelineSeparator>
                                            <TimelineConnector sx={{ bgcolor: UI_COLORS.accent }} />
                                            <TimelineDot sx={{ 
                                                borderColor: UI_COLORS.accent, 
                                                borderWidth: 2,
                                                boxShadow: `0 0 10px ${UI_COLORS.accentGlow}`,
                                                backgroundColor: '#000',
                                                margin: '12px 0'
                                            }} />
                                            <TimelineConnector sx={{ bgcolor: UI_COLORS.accent }} />
                                        </TimelineSeparator>

                                        <TimelineContent sx={{ py: '12px', px: 2 }}>
                                            <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
                                                <Typography variant="subtitle1" component="div" sx={{ color: UI_COLORS.accent, fontWeight: 'bold', lineHeight: 1, mb: 0.5 }}>
                                                    {event.event}
                                                </Typography>
                                                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', lineHeight: 1.2 }}>
                                                    {event.description}
                                                </Typography>
                                            </Box>
                                        </TimelineContent>
                                    </TimelineItem>
                                ))}
                            </Timeline>
                        ) : (
                            <Typography sx={{ color: 'gray', textAlign: 'center', py: 4 }}>
                                No historical data packets found in memory banks.
                            </Typography>
                        )}
                    </Box>
                </Grid>
            </Grid>
        </Box>
    );
}