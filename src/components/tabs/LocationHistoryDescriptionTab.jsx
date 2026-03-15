import React, { useState, useEffect } from "react";
import { Grid, Box, Skeleton } from "@mui/material";
import { loadFirebaseAsset, getCachedUrl } from "../../../firebase/services/assetLoader";
import { CyberTitle } from "../customs/CustomTexts";
import AnimatedTypewriterText from "../animations/AnimatedTypewriterText";
import LandscapeIcon from "@mui/icons-material/Landscape"; // Icono de respaldo para locaciones
import { UI_COLORS } from "../../constants/uiColors";

export default function LocationHistoryDescriptionTab({ location }) {
    // Implementación IGUAL a la de CharacterCard para el manejo de imágenes
    const [url, setUrl] = useState(() => getCachedUrl(location?.imageUrl) || null);

    useEffect(() => {
        if (!url && location?.imageUrl) {
            loadFirebaseAsset(location.imageUrl).then(setUrl);
        }
    }, [location?.imageUrl, url]);

    return (
        <Box sx={{ flexGrow: 1, p: 2 }}>
            <Grid container spacing={4}>
                {/* 1. DESCRIPCIÓN (Izquierda) */}
                <Grid size={7}>
                    <AnimatedTypewriterText 
                        text={location?.description || "No description available."}
                        duration={4000} 
                    />
                </Grid>

                {/* 2. IMAGEN (Derecha) - Con lógica de Asset Loader */}
                <Grid size={5}>
                    <Box
                        sx={{
                            width: '100%',
                            height: '300px',
                            backgroundColor: "#1a1a2a",
                            borderRadius: '8px',
                            border: `1px solid ${UI_COLORS.accent}44`, // 44 es alpha
                            boxShadow: `0 0 20px ${UI_COLORS.accentGlow}33`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            position: 'relative'
                        }}
                    >
                        {location?.imageUrl ? (
                            url ? (
                                <Box
                                    component="img"
                                    src={url}
                                    alt={location.name}
                                    draggable={false}
                                    sx={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                        userSelect: "none",
                                        transition: "opacity 0.5s ease-in-out"
                                    }}
                                />
                            ) : (
                                <Skeleton 
                                    variant="rectangular" 
                                    width="100%" 
                                    height="100%" 
                                    sx={{ bgcolor: "#121221" }} 
                                />
                            )
                        ) : (
                            <LandscapeIcon sx={{ fontSize: 60, color: "#3a3a4d" }} />
                        )}
                    </Box>
                </Grid>

                {/* 3. HISTORIA (Abajo) */}
                <Grid size={12}>
                    <Box sx={{ 
                        mt: 2, 
                        pt: 3, 
                        borderTop: `1px solid ${UI_COLORS.accent}22`,
                        position: 'relative'
                    }}>
                        <CyberTitle variant="h6" sx={{ mb: 1, color: UI_COLORS.accent }}>
                            HISTORY
                        </CyberTitle>
                        <AnimatedTypewriterText
                            text={location?.history || "No history available."}
                            duration={4000}
                        />
                    </Box>
                </Grid>
            </Grid>
        </Box>
    );
}