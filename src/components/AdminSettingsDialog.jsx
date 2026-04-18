import { useState } from "react";
import BaseTabbedDialog, { TabPanel } from "./BaseTabbedDialog";
import SettingsIcon from "@mui/icons-material/Settings";
import StorageIcon from "@mui/icons-material/Storage";
import GeneralSettingsTab from "./tabs/GeneralSettingsTab";
import CampaignSettingsTab from "./tabs/CampaignSettingsTab";
import { useSelector } from "react-redux";
import usePopout from "../hooks/usePopout";

export default function AdminSettingsDialog({ open, onClose, popupMode = false }) {
    const [tab, setTab] = useState(0);
    const { profile } = useSelector((state) => state.player);
    const { isPopped, popout } = usePopout("admin");

    const adminTabs = [
        { label: "General", icon: <SettingsIcon /> },
        { label: "Campaña", icon: <StorageIcon /> },
    ];

    const handlePopout = () => {
        popout(); // no payload needed
        onClose();
    };

    return (
        <BaseTabbedDialog
            open={open}
            onClose={onClose}
            title="SYSTEM_ADMIN_PANEL"
            tabs={adminTabs}
            activeTab={tab}
            setActiveTab={setTab}
            popupMode={popupMode}
            isPopped={isPopped}
            onPopout={handlePopout}
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