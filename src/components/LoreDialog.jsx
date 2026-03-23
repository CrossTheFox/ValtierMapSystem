import React from "react";
import { Dialog, DialogContent, IconButton, Box, Tooltip, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import RemoveIcon from "@mui/icons-material/Remove";
import AspectRatioIcon from "@mui/icons-material/AspectRatio";
import ReactMarkdown from "react-markdown";

// Componentes internos y constantes
import { CyberTitle, CyberText } from "./customs/CustomTexts";
import { UI_COLORS } from "../constants/uiColors";
import { RENDER_LAYERS } from "../constants/renderLayers";
import AnimatedTypewriterText from "./animations/AnimatedTypewriterText";

// Hooks y Redux
import { useDispatch, useSelector } from "react-redux";
import { setSelectedLore, toggleIsMinimized } from "../store/uiSlice";

export default function LoreDialog() {
    const dispatch = useDispatch();
    const { selectedLore, isMinimized } = useSelector((state) => state.ui);

    // Si no hay lore seleccionado, no renderizamos nada
    if (!selectedLore) return null;

    const handleClose = () => {
        dispatch(setSelectedLore(null));
    };

    const handleToggleMinimize = (e) => {
        e.stopPropagation();
        dispatch(toggleIsMinimized());
    };

    // Formateo de fecha (asumiendo que viene de Firebase Timestamp o string)
    const formattedDate = selectedLore.created_at?.toDate 
        ? selectedLore.created_at.toDate().toLocaleDateString() 
        : new Date(selectedLore.created_at).toLocaleDateString();

    // Renderizadores personalizados para ReactMarkdown
    const MarkdownComponents = {
        p: ({ children }) => (
            <Box sx={{ mb: 2 }}>
                <AnimatedTypewriterText text={children} duration={1000} />
            </Box>
        ),
        h1: ({ children }) => <CyberTitle sx={{ mb: 2, fontSize: '1.8rem' }}>{children}</CyberTitle>,
        h2: ({ children }) => <CyberTitle sx={{ mb: 1, fontSize: '1.4rem', color: UI_COLORS.accent }}>{children}</CyberTitle>,
        li: ({ children }) => (
            <Box component="li" sx={{ mb: 1 }}>
                <CyberText sx={{ display: 'list-item' }}>{children}</CyberText>
            </Box>
        )
    };

    return (
        <Dialog
            open={!!selectedLore}
            fullWidth
            maxWidth={false}
            hideBackdrop={isMinimized}
            disableEnforceFocus={isMinimized}
            style={isMinimized ? { pointerEvents: 'none' } : {}}
            sx={{ zIndex: RENDER_LAYERS.DIALOG }}
            PaperProps={{
                sx: {
                    pointerEvents: "auto",
                    backgroundColor: "#12121a",
                    color: "#fff",
                    borderRadius: 3,
                    boxShadow: isMinimized 
                        ? `0 0 20px ${UI_COLORS.accent || "#00f2ea"}44` 
                        : "0 0 40px rgba(0,0,0,0.8)",
                    border: `1px solid ${isMinimized ? (UI_COLORS.accent || "#00f2ea") : "#2a2a3d"}`,
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    ...(isMinimized ? {
                        position: 'fixed',
                        bottom: 20,
                        right: 20,
                        m: 0,
                        width: "300px",
                        maxHeight: "60px",
                        overflow: 'hidden'
                    } : {
                        height: "80vh",
                        width: "60%", // Más angosto para facilitar la lectura de historias
                        minWidth: "400px"
                    })
                },
            }}
        >
            {/* Header */}
            <Box sx={{ 
                px: 3, 
                py: 2, 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center", 
                backgroundColor: "#1a1a2a",
                borderBottom: isMinimized ? "none" : "1px solid #2a2a3d",
                cursor: isMinimized ? 'pointer' : 'default'
            }}
            onClick={isMinimized ? handleToggleMinimize : undefined}
            >
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                    <CyberTitle sx={{ fontSize: isMinimized ? "0.9rem" : "1.2rem", color: UI_COLORS.accent }}>
                        {selectedLore.title}
                    </CyberTitle>
                    {!isMinimized && (
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
                            [{formattedDate}]
                        </Typography>
                    )}
                </Box>
                
                <Box>
                    <Tooltip title={isMinimized ? "Restaurar" : "Minimizar"}>
                        <IconButton onClick={handleToggleMinimize} size="small" sx={{ mr: 1 }}>
                            {isMinimized ? 
                                <AspectRatioIcon sx={{ color: UI_COLORS.accent || "#00f2ea", fontSize: '1.2rem' }} /> : 
                                <RemoveIcon sx={{ color: "#fff", fontSize: '1.2rem' }} />
                            }
                        </IconButton>
                    </Tooltip>
                    {!isMinimized && (
                        <IconButton onClick={handleClose} size="small">
                            <CloseIcon sx={{ color: "#ff66ff" }} />
                        </IconButton>
                    )}
                </Box>
            </Box>

            {/* Contenido de la Historia */}
            <DialogContent
                sx={{ 
                    display: isMinimized ? 'none' : 'block',
                    p: 4,
                    backgroundColor: "#0d0d14",
                    '&::-webkit-scrollbar': { width: '8px' },
                    '&::-webkit-scrollbar-track': { background: '#0d0d14' },
                    '&::-webkit-scrollbar-thumb': {
                        backgroundColor: UI_COLORS.accent || "#00f2ea",
                        borderRadius: '4px'
                    }
                }}
            >
                <ReactMarkdown components={MarkdownComponents}>
                    {selectedLore.content}
                </ReactMarkdown>
            </DialogContent>
        </Dialog>
    );
}