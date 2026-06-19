import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { closeLocation, openWikiOverlay } from "../store/uiSlice";
import { Box, IconButton } from "@mui/material";
import CyberTooltip from "./customs/CyberTooltip";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";

import PeopleIcon      from "@mui/icons-material/People";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import AssignmentIcon  from "@mui/icons-material/Assignment";

import BaseTabbedDialog, { TabPanel }  from "./BaseTabbedDialog";
import LocationCharactersTab           from "./tabs/LocationCharactersTab";
import LocationHistoryDescriptionTab   from "./tabs/LocationHistoryDescriptionTab";
import LocationMissionsTab             from "./tabs/LocationMissionsTab";
import usePopout                       from "../hooks/usePopout";
import { ROLES }                       from "../constants/roles";
import { UI_COLORS }                   from "../constants/uiColors";

export default function LocationInfoCard({ popupMode = false }) {
    const location   = useSelector((s) => s.ui.selectedLocation);
    const locationDialogOpen = useSelector((s) => s.ui.locationDialogOpen);
    const locationDialogTab = useSelector((s) => s.ui.locationDialogTab);
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const role       = useSelector((s) => s.player.profile?.role);
    const dispatch   = useDispatch();
    const isDM = role === ROLES.DM;

    const [tab, setTab]   = useState(0);
    const [open, setOpen] = useState(popupMode);

    const { isPopped, popout } = usePopout("location");

    useEffect(() => {
        if (!popupMode && locationDialogOpen) setOpen(true);
        if (!popupMode && !locationDialogOpen) setOpen(false);
    }, [locationDialogOpen, popupMode]);

    useEffect(() => {
        if (location) setTab(locationDialogTab);
    }, [location?.id, locationDialogTab]);

    const handleClose = () => {
        if (popupMode) { window.close(); return; }
        setOpen(false);
        dispatch(closeLocation());
    };

    const handlePopout = () => {
        popout(location);
        handleClose();
    };

    const handleOpenWiki = () => {
        if (!location) return;
        dispatch(openWikiOverlay({
            mode: "list",
            vttContext: {
                linkedVttLocationId: location.id,
                prefillType: "locacion",
            },
        }));
    };

    const locationTabs = [
        { label: "Descripción", icon: <AutoAwesomeIcon /> },
        { label: "Personajes",  icon: <PeopleIcon /> },
        { label: "Misiones",    icon: <AssignmentIcon /> },
    ];

    // Both DM and players can open the wiki card for a location
    const wikiAction = !popupMode ? (
        <CyberTooltip title={isDM ? "Ficha wiki de esta ubicación" : "Ver en el archivo"}>
            <IconButton
                size="small"
                onClick={handleOpenWiki}
                sx={{ color: UI_COLORS.accent, "&:hover": { bgcolor: `${UI_COLORS.accent}18` } }}
            >
                <AutoStoriesIcon sx={{ fontSize: "1.1rem" }} />
            </IconButton>
        </CyberTooltip>
    ) : null;

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
            extraHeaderActions={wikiAction}
            sizePreset="lg"
        >
            <TabPanel isSelected={tab === 0}>
                <LocationHistoryDescriptionTab location={location} campaignId={campaignId} />
            </TabPanel>
            <TabPanel isSelected={tab === 1} pValue={0}>
                <LocationCharactersTab characters={location?.characters || []} campaignId={campaignId} />
            </TabPanel>
            <TabPanel isSelected={tab === 2}>
                <LocationMissionsTab location={location} campaignId={campaignId} />
            </TabPanel>
        </BaseTabbedDialog>
    );
}