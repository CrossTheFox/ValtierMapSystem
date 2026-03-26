import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
    Drawer,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    IconButton,
    Box,
    Divider
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import BookIcon from '@mui/icons-material/Book';
import LockIcon from '@mui/icons-material/Lock';
import LocalLibraryIcon from '@mui/icons-material/LocalLibrary';
import { CyberTitle, CyberText } from "./customs/CustomTexts";
import { setSelectedLore } from "../store/uiSlice";

const DRAWER_WIDTH = 320;

const LoreItem = ({ entry, onClick }) => {
    const [showHint, setShowHint] = useState(false); // Estado para mostrar el objetivo
    const isLocked = entry.isLocked;
    
    const dateLabel = entry.created_at 
        ? new Date(entry.created_at.seconds ? entry.created_at.seconds * 1000 : entry.created_at).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        })
        : "N/A";

    const handleLockedClick = (e) => {
        e.stopPropagation();
        setShowHint(!showHint); // Alterna la visibilidad del objetivo
    };

    return (
        <Box
            onClick={(e) => {
                if (isLocked) return handleLockedClick(e);
                e.stopPropagation();
                onClick(entry);
            }}
            sx={{
                position: "relative",
                p: 1.5,
                mb: 1.5,
                cursor: "pointer", // Cambiado a pointer para que el usuario sepa que puede clickear
                borderRadius: "4px",
                backgroundColor: "rgba(255,255,255,0.03)",
                borderLeft: `2px solid ${isLocked ? (showHint ? "#00f2ea" : "rgba(255,255,255,0.1)") : "transparent"}`,
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                overflow: "hidden",
                "&:hover": {
                    backgroundColor: isLocked ? "rgba(255,255,255,0.05)" : "rgba(0,242,234,0.08)",
                }
            }}
        >
            {/* Overlay de Bloqueo */}
            {isLocked && (
                <Box sx={{
                    position: "absolute",
                    top: 0, left: 0, right: 0, bottom: 0,
                    zIndex: 2,
                    backdropFilter: showHint ? "blur(8px)" : "blur(4px)",
                    backgroundColor: showHint ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.4)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.3s ease",
                    px: 2,
                    textAlign: "center"
                }}>
                    <LockIcon sx={{ 
                        color: "#00f2ea", // Candado Celeste
                        fontSize: "1.5rem",
                        filter: "drop-shadow(0 0 5px #00f2ea)",
                        mb: showHint ? 1 : 0 
                    }} />
                    
                    {showHint && (
                        <CyberText variant="caption" sx={{ color: "#00f2ea", animation: "fadeIn 0.3s" }}>
                            OBJETIVO: {entry.unlockGoal || "Misión desconocida"}
                        </CyberText>
                    )}
                </Box>
            )}

            {/* Resto del contenido (Título, Fecha, etc) */}
            <Box sx={{ opacity: isLocked ? 0.2 : 1 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                    <LocalLibraryIcon sx={{ fontSize: "0.9rem", color: "rgba(0,242,234,0.5)" }} />
                    <CyberText variant="caption" sx={{ color: "rgba(255,255,255,0.3)", fontSize: "0.65rem" }}>
                        ({dateLabel})
                    </CyberText>
                </Box>

                <CyberText variant="body2" sx={{ color: "#00f2ea", fontWeight: "bold", textTransform: "uppercase" }}>
                    {entry.title}
                </CyberText>
                
                <CyberText variant="caption" sx={{ color: "rgba(255,255,255,0.5)" }}>
                    {entry.summary}
                </CyberText>
            </Box>
        </Box>
    );
};

export default function WorldDrawer() {
    const dispatch = useDispatch();
    const [open, setOpen] = useState(false);
    const [yOffset, setYOffset] = useState(100);
    const [dragging, setDragging] = useState(false);

    const [expandedCategory, setExpandedCategory] = useState(false);

    // Extraemos el lore del estado global
    const { lore = [] } = useSelector((state) => state.world);

    // Agrupamos por categorías dinámicamente
    const categories = Array.isArray(lore) 
        ? [...new Set(lore.map(item => item.category))] 
        : [];

    const handleAccordionChange = (category) => (event, isExpanded) => {
        setExpandedCategory(isExpanded ? category : false);
    };

    const toggleDrawer = () => {
        setOpen((prev) => !prev);
    };

    const handleEntryClick = (entry) => {
        dispatch(setSelectedLore(entry));
    };

    return (
        <>
            {/* TAB / HANDLE (Mantiene el sistema de arrastre) */}
            <Box
                sx={{
                    pointerEvents: "auto",
                    position: "fixed",
                    top: yOffset,
                    left: open ? DRAWER_WIDTH : 0,
                    width: 44,
                    height: 120,
                    backgroundColor: "#1e1e2f",
                    borderRadius: "0 8px 8px 0",
                    zIndex: 1300, // Por encima del Drawer si es necesario
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 0 15px rgba(255,0,255,0.3)",
                    border: "1px solid rgba(255,102,255,0.4)",
                    borderLeft: "none",
                }}
            >
                <IconButton onClick={toggleDrawer} size="small">
                    {open ? (
                        <MenuBookIcon sx={{ color: "#ff66ff" }} />
                    ) : (
                        <BookIcon sx={{ color: "#ff66ff" }} />
                    )}
                </IconButton>
            </Box>

            {/* DRAWER (Enciclopedia Dinámica) */}
            <Drawer
                anchor="left"
                open={open}
                variant="persistent"
                PaperProps={{
                    sx: {
                        width: DRAWER_WIDTH,
                        backgroundColor: "#0e0e14",
                        color: "#fff",
                        borderRight: "1px solid #1e1e2f",
                        overflowX: "hidden",
                        pointerEvents: "auto", // IMPORTANTE: Asegura que capture clicks
                    },
                }}
            >
                <Box sx={{ p: 2, mt: 2 }}>
                    <CyberTitle variant="h6" sx={{ color: "#ff66ff", mb: 1, letterSpacing: 2 }}>
                        WORLD_ARCHIVE
                    </CyberTitle>
                    
                    <Divider sx={{ bgcolor: "rgba(255,255,255,0.1)", mb: 2 }} />

                    {categories.length === 0 ? (
                        <CyberTitle variant="caption" sx={{ color: "rgba(255,255,255,0.4)" }}>
                            No archive entries found...
                        </CyberTitle>
                    ) : (
                        categories.map((cat) => (
                            <Accordion 
                                key={cat} 
                                disableGutters 
                                elevation={0}
                                expanded={expandedCategory === cat}
                                onChange={handleAccordionChange(cat)}
                                sx={{ 
                                    backgroundColor: "transparent", 
                                    color: "#fff",
                                    "&:before": { display: "none" }
                                }}
                            >
                                <AccordionSummary 
                                    expandIcon={<ExpandMoreIcon sx={{ color: "#ff66ff" }} />}
                                    sx={{ 
                                        px: 1,
                                        "& .MuiAccordionSummary-content": { margin: "12px 0" }
                                    }}
                                >
                                    <CyberText variant="subtitle2" sx={{ color: "#ff66ff", letterSpacing: 1 }}>
                                        {cat.toUpperCase()}
                                    </CyberText>
                                </AccordionSummary>
                                <AccordionDetails sx={{ px: 1, pt: 0, pb: 2 }}>
                                    {lore
                                        .filter((item) => item.category === cat)
                                        .map((entry) => (
                                            <LoreItem 
                                                key={entry.id} 
                                                entry={entry} 
                                                onClick={handleEntryClick} 
                                            />
                                        ))}
                                </AccordionDetails>
                            </Accordion>
                        ))
                    )}
                </Box>
            </Drawer>
        </>
    );
}