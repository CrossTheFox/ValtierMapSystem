import {
    Dialog,
    DialogContent,
    IconButton,
    Typography,
    Box,
    Fade,
} from "@mui/material";

import CloseIcon from "@mui/icons-material/Close";
import HistoryEduIcon from "@mui/icons-material/HistoryEdu";
import PeopleIcon from "@mui/icons-material/People";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import AssignmentIcon from "@mui/icons-material/Assignment";

import { useSelector, useDispatch } from "react-redux";
import { closeLocation } from "../store/uiSlice";
import { useEffect, useState } from "react";

import CustomBottomNavigation from "./customs/CustomBottomNavigation";
import AnimatedTypewriterText from "./animations/AnimatedTypewriterText";
import LocationCharactersTab from "./tabs/LocationCharactersTab";

const TabBox = ({ children, isSelected, pValue = 3 }) => (
    <Box
        sx={{
            hidden: !isSelected,
            role: "tabpanel",
            flexGrow: 1,
            display: isSelected ? "flex" : "none",
            flexDirection: "column",
            width: "100%",
            p: pValue,
        }}
    >
        {children}
    </Box>
);

export default function LocationDialog() {
    const location = useSelector((s) => s.ui.selectedLocation);
    const dispatch = useDispatch();

    const [tab, setTab] = useState(0);
    const [open, setOpen] = useState(false);

    /* =========================
       CONTROL OPEN / CLOSE
    ========================= */
    useEffect(() => {
        if (location) {
            setOpen(true);
        }
    }, [location]);

    const handleClose = () => {
        setOpen(false);
    };

    const handleExited = () => {
        dispatch(closeLocation());
    };

    if (!location && !open) return null;

    return (
        <Dialog
            open={open}
            TransitionComponent={Fade}
            TransitionProps={{
                timeout: 400,
                onExited: handleExited,
            }}
            keepMounted
            maxWidth
            PaperProps={{
                sx: {
                    pointerEvents: "auto",
                    backgroundColor: "#12121a",
                    color: "#fff",
                    height: "85vh",
                    width: "80vw",
                    borderRadius: 3,
                    boxShadow: "0 0 40px rgba(255,0,255,0.3)",
                },
            }}
        >
            {/* HEADER */}
            <Box
                sx={{
                    px: 3,
                    py: 2,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "1px solid #2a2a3d",
                    backgroundColor: "#1a1a2a",
                }}
            >
                <Typography variant="h5">
                    {location?.name}
                </Typography>

                <IconButton onClick={handleClose}>
                    <CloseIcon sx={{ color: "#ff66ff" }} />
                </IconButton>
            </Box>

            {/* CONTENT */}
            <DialogContent
                sx={{
                    flexGrow: 1,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    p: 0,
                }}
            >
                <TabBox isSelected={tab === 0}>
                    <AnimatedTypewriterText
                        text={location?.history || "No history available."}
                        duration={1800}
                    />
                </TabBox>

                <TabBox isSelected={tab === 1} pValue={0}>
                    <LocationCharactersTab characters={location?.characters || []} />
                </TabBox>

                <TabBox isSelected={tab === 2} pValue={3}>
                    <AnimatedTypewriterText
                        text="Curiosities and hidden secrets will be shown here."
                        duration={1200}
                    />
                </TabBox>

                <TabBox isSelected={tab === 3} pValue={3}>
                    <AnimatedTypewriterText
                        text="Mission history connected to this place."
                        duration={1200}
                    />
                </TabBox>
            </DialogContent>

            {/* BOTTOM NAVIGATION */}
            <CustomBottomNavigation
                value={tab}
                onChange={(e, newValue) => setTab(newValue)}
                actions={[
                    { label: "Historia", icon: <HistoryEduIcon /> },
                    { label: "Personajes", icon: <PeopleIcon /> },
                    { label: "Curiosidades", icon: <AutoAwesomeIcon /> },
                    { label: "Misiones", icon: <AssignmentIcon /> },
                ]}
            />
        </Dialog>
    );
}
