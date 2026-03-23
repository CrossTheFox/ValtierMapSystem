import { useState } from "react";
import { Dialog, DialogContent, IconButton, Typography, Box, Fade, Tooltip } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CustomBottomNavigation from "./customs/CustomBottomNavigation";
import { CyberTitle } from "./customs/CustomTexts";
import { UI_COLORS } from "../constants/uiColors";
import RemoveIcon from "@mui/icons-material/Remove";
import AspectRatioIcon from "@mui/icons-material/AspectRatio";
import useDialogActions from "../hooks/useDialogActions";
import { RENDER_LAYERS } from "../constants/renderLayers";

export const TabPanel = ({ children, isSelected, pValue = 3 }) => (
    <Box sx={{ 
        display: isSelected ? "flex" : "none", 
        flexDirection: "column", 
        width: "100%", // Asegura que ocupe todo el ancho del DialogContent
        flexGrow: 1, 
        p: pValue,
        boxSizing: 'border-box' // Importante para que el padding no sume al ancho
    }}>
        {children}
    </Box>
);

export default function BaseTabbedDialog({ 
    open, 
    onClose, 
    title, 
    tabs, 
    children, 
    activeTab, 
    setActiveTab,
}) {
    const { isMinimized, toggleMinimize } = useDialogActions();

    // Manejo del toggle de minimizado
    const handleToggleMinimize = (e) => {
        e.stopPropagation();
        toggleMinimize();
    };

    return (
        <Dialog
            open={open}
            fullWidth
            maxWidth={false}
            // Importante: quitamos el backdrop si está minimizado para poder usar el mapa
            hideBackdrop={isMinimized}
            // Evita que el Dialog se cierre al hacer click fuera si está minimizado
            disableEnforceFocus={isMinimized}
            style={isMinimized ? { pointerEvents: 'none' } : {}} 
            sx={{ zIndex: RENDER_LAYERS.DIALOG }} // Asegura que esté por encima de otros elementos UI
            PaperProps={{
                sx: {
                    pointerEvents: "auto",
                    backgroundColor: "#12121a",
                    color: "#fff",
                    borderRadius: 3,
                    boxShadow: isMinimized 
                        ? `0 0 20px ${UI_COLORS.accent || "#00f2ea"}44` 
                        : "0 0 40px rgba(255,0,255,0.2)",
                    border: `1px solid ${isMinimized ? (UI_COLORS.accent || "#00f2ea") : "#2a2a3d"}`,
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    
                    // Lógica de posición y tamaño
                    ...(isMinimized ? {
                        position: 'fixed',
                        bottom: 20,
                        right: 20,
                        m: 0,
                        width: "300px",
                        height: "auto",
                        maxHeight: "60px", // Solo la cabecera
                        overflow: 'hidden'
                    } : {
                        height: "85vh",
                        width: "90%",
                    })
                },
            }}
        >
            {/* Header / Barra de Título */}
            <Box sx={{ 
                px: 3, 
                py: isMinimized ? 1.5 : 2, 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center", 
                borderBottom: isMinimized ? "none" : "1px solid #2a2a3d", 
                backgroundColor: "#1a1a2a",
                cursor: isMinimized ? 'pointer' : 'default'
            }}
                onClick={isMinimized ? handleToggleMinimize : undefined}
            >
                <CyberTitle sx={{ fontSize: isMinimized ? "0.9rem" : "1.2rem", transition: '0.3s', color: UI_COLORS.accent }}>
                    {title} {isMinimized && "(MINIMIZADO)"}
                </CyberTitle>
                
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
                        <IconButton onClick={onClose} size="small">
                            <CloseIcon sx={{ color: "#ff66ff" }} />
                        </IconButton>
                    )}
                </Box>
            </Box>

            {/* Contenido: Se oculta visualmente pero mantiene el estado */}
            <Box sx={{ 
                display: isMinimized ? 'none' : 'flex', 
                flexDirection: 'column', 
                flexGrow: 1,
                overflow: 'hidden' 
            }}>
                <DialogContent
                    sx={{ 
                        flexGrow: 1, 
                        display: "flex", 
                        flexDirection: "column", 
                        p: 0,
                        width: "100%",
                        overflowX: "hidden",
                        alignItems: "stretch",
                        '&::-webkit-scrollbar': { width: '10px' },
                        '&::-webkit-scrollbar-track': { background: '#0d0d14' },
                        '&::-webkit-scrollbar-thumb': {
                            backgroundColor: 'transparent',
                            backgroundImage: `linear-gradient(180deg, ${UI_COLORS.accent || "#00f2ea"} 0%, rgba(0, 242, 234, 0.2) 50%, ${UI_COLORS.accent || "#00f2ea"} 100%)`,
                            border: `1px solid ${UI_COLORS.accent || "#00f2ea"}`,
                        }
                    }}
                >
                    {children}
                </DialogContent>

                <CustomBottomNavigation
                    value={activeTab}
                    onChange={(e, newValue) => setActiveTab(newValue)}
                    actions={tabs}
                />
            </Box>
        </Dialog>
    );
}