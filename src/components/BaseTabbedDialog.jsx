import { Dialog, DialogContent, IconButton, Typography, Box, Fade } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CustomBottomNavigation from "./customs/CustomBottomNavigation";
import { UI_COLORS } from "../constants/uiColors";

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
    tabs, // Array de { label, icon }
    children, // Los TabPanels
    activeTab, 
    setActiveTab 
}) {
    return (
        <Dialog
            open={open}
            fullWidth
            maxWidth={false}
            PaperProps={{
                sx: {
                    pointerEvents: "auto",
                    backgroundColor: "#12121a",
                    color: "#fff",
                    height: "85vh",
                    width: "90%",
                    borderRadius: 3,
                    boxShadow: "0 0 40px rgba(255,0,255,0.2)",
                    border: "1px solid #2a2a3d",
                },
            }}
        >
            <Box sx={{ px: 3, py: 2, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #2a2a3d", backgroundColor: "#1a1a2a" }}>
                <Typography variant="h5" sx={{ fontFamily: 'Orbitron' }}>{title}</Typography>
                <IconButton onClick={onClose}>
                    <CloseIcon sx={{ color: "#ff66ff" }} />
                </IconButton>
            </Box>

            <DialogContent
                fullWidth
                sx={{ 
                    flexGrow: 1, 
                    display: "flex", 
                    flexDirection: "column", 
                    p: 0,
                    width: "100%",
                    overflowX: "hidden",
                    alignItems: "stretch",
                    // ESTILO CYBERPUNK SCROLL
                    '&::-webkit-scrollbar': {
                        width: '10px',
                    },
                    '&::-webkit-scrollbar-track': {
                        background: '#0d0d14',
                        borderLeft: '1px dashed rgba(0, 242, 234, 0.2)', // Línea de datos decorativa
                    },
                    '&::-webkit-scrollbar-thumb': {
                        backgroundColor: 'transparent',
                        backgroundImage: `linear-gradient(180deg, 
                            ${UI_COLORS.accent || "#00f2ea"} 0%, 
                            rgba(0, 242, 234, 0.2) 50%, 
                            ${UI_COLORS.accent || "#00f2ea"} 100%)`,
                        border: `1px solid ${UI_COLORS.accent || "#00f2ea"}`,
                        boxShadow: `0 0 8px ${UI_COLORS.accent || "#00f2ea"}44`,
                        '&:hover': {
                            boxShadow: `0 0 12px ${UI_COLORS.accent || "#00f2ea"}`,
                        }
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
        </Dialog>
    );
}