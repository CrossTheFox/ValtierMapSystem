import { useState } from "react";
import {
    Drawer,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Typography,
    IconButton,
    Box,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import BookIcon from '@mui/icons-material/Book';

const DRAWER_WIDTH = 320;

export default function WorldDrawer() {
    const [open, setOpen] = useState(false);
    const [yOffset, setYOffset] = useState(100);
    const [dragging, setDragging] = useState(false);

    /* =========================
       DRAG LOGIC
    ========================= */
    const handlePointerDown = (e) => {
        setDragging(true);
        e.preventDefault();
    };

    const handlePointerMove = (e) => {
        if (!dragging) return;
        setYOffset((prev) => Math.max(40, prev + e.movementY));
    };

    const handlePointerUp = () => {
        setDragging(false);
    };

    const toggleDrawer = () => {
        setOpen((prev) => !prev);
    };

    return (
        <>
            {/* =========================
                TAB / HANDLE
            ========================= */}
            <Box
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                sx={{
                    pointerEvents: "auto",
                    position: "fixed",
                    top: yOffset,
                    left: open ? DRAWER_WIDTH : 0,
                    width: 40,
                    height: 120,
                    backgroundColor: "#1e1e2f",
                    borderRadius: "0 8px 8px 0",
                    zIndex: 100001,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: dragging ? "grabbing" : "grab",
                    boxShadow: "0 0 10px rgba(255,0,255,0.5)",
                    transition: dragging
                        ? "none"
                        : "left 0.25s ease",
                }}
            >
                <IconButton
                    onClick={toggleDrawer}
                    size="small"
                    sx={{
                        transition: "transform 0.25s ease",
                    }}
                >
                    {open ? <MenuBookIcon sx={{ color: "#ff66ff" }} /> : <BookIcon sx={{ color: "#ff66ff" }} />}
                </IconButton>
            </Box>

            {/* =========================
                DRAWER
            ========================= */}
            <Drawer
                anchor="left"
                open={open}
                onClose={() => setOpen(false)}
                ModalProps={{
                    keepMounted: true,
                }}
                PaperProps={{
                    sx: {
                        pointerEvents: "auto",
                        width: DRAWER_WIDTH,
                        backgroundColor: "#12121a",
                        color: "#fff",
                    },
                }}
            >
                <Box sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                        World Encyclopedia
                    </Typography>

                    <Accordion defaultExpanded>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography>Lore of the World</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Typography variant="body2">
                                A fractured world where magic and technology
                                coexist in fragile balance. Ancient powers
                                awaken beneath modern ruins.
                            </Typography>
                        </AccordionDetails>
                    </Accordion>

                    <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography>Regions</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Typography variant="body2">
                                Each region has its own laws of magic,
                                political conflicts, and hidden dangers.
                            </Typography>
                        </AccordionDetails>
                    </Accordion>

                    <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography>Factions</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Typography variant="body2">
                                Tech guilds, arcane circles, and ancient
                                cults compete for control.
                            </Typography>
                        </AccordionDetails>
                    </Accordion>
                </Box>
            </Drawer>
        </>
    );
}
