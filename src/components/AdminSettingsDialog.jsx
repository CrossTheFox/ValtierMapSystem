import { useState } from "react";
import BaseTabbedDialog, { TabPanel } from "./BaseTabbedDialog";
import SettingsIcon from "@mui/icons-material/Settings";
import StorageIcon from "@mui/icons-material/Storage";
import { Typography } from "@mui/material";
import GeneralSettingsTab from "./tabs/GeneralSettingsTab";
import CampaignSettingsTab from "./tabs/CampaignSettingsTab";
import { useSelector } from "react-redux";

export default function AdminSettingsDialog({ open, onClose }) {
    const [tab, setTab] = useState(0);

    const { profile } = useSelector((state) => state.player);

    const adminTabs = [
        { label: "General", icon: <SettingsIcon /> },
        { label: "Campaña", icon: <StorageIcon /> },
    ];

    return (
        <BaseTabbedDialog
            open={open}
            onClose={onClose}
            title="SYSTEM_ADMIN_PANEL"
            tabs={adminTabs}
            activeTab={tab}
            setActiveTab={setTab}
        >
            <TabPanel isSelected={tab === 0}>
                <GeneralSettingsTab currentCampaignId={profile?.currentCampaignId} />
            </TabPanel>
            <TabPanel isSelected={tab === 1}>
                <CampaignSettingsTab currentCampaignId={profile?.currentCampaignId} />
            </TabPanel>
        </BaseTabbedDialog>
    );
}