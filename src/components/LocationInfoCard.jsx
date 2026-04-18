import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { closeLocation } from "../store/uiSlice";

import PeopleIcon      from "@mui/icons-material/People";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import AssignmentIcon  from "@mui/icons-material/Assignment";

import BaseTabbedDialog, { TabPanel }  from "./BaseTabbedDialog";
import AnimatedTypewriterText          from "./animations/AnimatedTypewriterText";
import LocationCharactersTab           from "./tabs/LocationCharactersTab";
import LocationHistoryDescriptionTab   from "./tabs/LocationHistoryDescriptionTab";
import usePopout                       from "../hooks/usePopout";

export default function LocationInfoCard({ popupMode = false }) {
    const location   = useSelector((s) => s.ui.selectedLocation);
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const dispatch   = useDispatch();

    const [tab, setTab]   = useState(0);
    const [open, setOpen] = useState(popupMode);

    const { isPopped, popout } = usePopout("location");

    useEffect(() => {
        if (!popupMode && location) setOpen(true);
    }, [location, popupMode]);

    const handleClose = () => {
        if (popupMode) { window.close(); return; }
        setOpen(false);
        dispatch(closeLocation());
    };

    const handlePopout = () => {
        // Serialize the current location so the popup can restore it via Redux
        popout(location);
        handleClose();
    };

    const locationTabs = [
        { label: "Descripción", icon: <AutoAwesomeIcon /> },
        { label: "Personajes",  icon: <PeopleIcon /> },
        { label: "Misiones",    icon: <AssignmentIcon /> },
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
            popupMode={popupMode}
            isPopped={isPopped}
            onPopout={handlePopout}
        >
            <TabPanel isSelected={tab === 0}>
                <LocationHistoryDescriptionTab location={location} />
            </TabPanel>
            <TabPanel isSelected={tab === 1} pValue={0}>
                <LocationCharactersTab characters={location?.characters || []} campaignId={campaignId} />
            </TabPanel>
            <TabPanel isSelected={tab === 2}>
                <AnimatedTypewriterText text="[We'll add missions to this tab in a NEAR future]" duration={1200} />
            </TabPanel>
        </BaseTabbedDialog>
    );
}