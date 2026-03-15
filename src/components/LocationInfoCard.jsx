import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { closeLocation } from "../store/uiSlice";

import HistoryEduIcon from "@mui/icons-material/HistoryEdu";
import PeopleIcon from "@mui/icons-material/People";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import AssignmentIcon from "@mui/icons-material/Assignment";

import BaseTabbedDialog, { TabPanel } from "./BaseTabbedDialog";
import AnimatedTypewriterText from "./animations/AnimatedTypewriterText";
import LocationCharactersTab from "./tabs/LocationCharactersTab";
import LocationHistoryDescriptionTab from "./tabs/LocationHistoryDescriptionTab";

export default function LocationInfoCard() {
    const location = useSelector((s) => s.ui.selectedLocation);
    const dispatch = useDispatch();

    const [tab, setTab] = useState(0);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        console.log("Selected location changed:", location);
        if (location) setOpen(true);
    }, [location]);

    const handleClose = () => {
        setOpen(false);
        dispatch(closeLocation());
    }

    const locationTabs = [
        { label: "Descripción", icon: <AutoAwesomeIcon /> },
        { label: "Personajes", icon: <PeopleIcon /> },
        { label: "Misiones", icon: <AssignmentIcon /> },
    ];

    if (!location && !open) return null;

    return (
        <BaseTabbedDialog
            open={open}
            onClose={handleClose}
            title={location?.name || "LOCATION_UNKNOWN"}
            tabs={locationTabs}
            activeTab={tab}
            setActiveTab={setTab}
        >
            <TabPanel isSelected={tab === 0}>
                <LocationHistoryDescriptionTab location={location} />
            </TabPanel>

            <TabPanel isSelected={tab === 1} pValue={0}>
                <LocationCharactersTab characters={location?.characters || []} />
            </TabPanel>

            <TabPanel isSelected={tab === 2}>
                <AnimatedTypewriterText text="[We'll add missions to this tab in a NEAR future]" duration={1200} />
            </TabPanel>
        </BaseTabbedDialog>
    );
}