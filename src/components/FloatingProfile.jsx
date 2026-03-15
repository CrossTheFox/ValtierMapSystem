import React, { useState } from 'react';
import { UI_COLORS } from "../constants/uiColors";
import { logoutPlayer } from "../../firebase/playersAuth";
import { CyberProfile } from "./customs/CyberProfile";
import AdminSettingsDialog from "./AdminSettingsDialog";

const FloatingProfile = ({ profile }) => {
    const [adminOpen, setAdminOpen] = useState(false);
    const accentColor = UI_COLORS.accent || "#00f2ea";

    const handleLogout = async () => {
        try { await logoutPlayer(); } 
        catch (error) { console.error("Logout Error:", error); }
    };

    return (
        <>
            <CyberProfile 
                profile={profile} 
                accentColor={accentColor}
                setAdminOpen={setAdminOpen} 
                handleLogout={handleLogout} 
            />

            <AdminSettingsDialog 
                open={adminOpen} 
                onClose={() => setAdminOpen(false)} 
            />
        </>
    );
};

export default FloatingProfile;