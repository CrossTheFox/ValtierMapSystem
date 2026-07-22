import React, { useState, useEffect } from 'react';
import { UI_COLORS } from "../constants/uiColors";
import { logoutPlayer } from "../../firebase/playersAuth";
import { CyberProfile } from "./customs/CyberProfile";
import AdminSettingsDialog from "./AdminSettingsDialog";
import CharactersSettingsDialog from "./CharactersSettingsDialog";
import { useDispatch, useSelector } from 'react-redux';
import { resetWorldState } from '../store/worldSlice';
import { fetchPlayerCharacters } from '../store/characterSlice';
import { showSnackbar, openWikiOverlay, restoreDialog } from '../store/uiSlice';
import { DIALOG_IDS } from '../constants/dialogIds';
import { ROLES } from '../constants/roles';

const FloatingProfile = ({ profile }) => {
    const dispatch = useDispatch();
    const [adminOpen, setAdminOpen] = useState(false);
    const [charactersOpen, setCharactersOpen] = useState(false);
    const accentColor = UI_COLORS.accent || "#00f2ea";

    const { list: characters } = useSelector((state) => state.characters);
    const campaignId = useSelector((state) => state.world.selectedCampaignId);
    const isDM = profile?.role === ROLES.DM;

    // Load characters owned by this player (ownerPlayerId); legacy characterIds merged if present
    useEffect(() => {
        if (profile?.uid) {
            dispatch(
                fetchPlayerCharacters({
                    uid: profile.uid,
                    characterIds: profile.characterIds || [],
                })
            );
        }
    }, [profile?.uid, profile?.characterIds, dispatch]);

    const activeCharacter = characters.find(c => c.id === profile?.activeCharacterId) || characters[0] || null;

    const handleLogout = async () => {
        try { 
            await logoutPlayer();
            dispatch(resetWorldState());
        } 
        catch (error) { console.error("Logout Error:", error); }
    };

    const handleOpenArchive = () => {
        if (!campaignId) {
            dispatch(showSnackbar({
                message: "Selecciona una campaña antes de abrir el archivo narrativo.",
                severity: "warning",
            }));
            return;
        }
        dispatch(restoreDialog(DIALOG_IDS.WIKI));
        dispatch(openWikiOverlay({ mode: "list" }));
    };

    return (
        <>
            <CyberProfile 
                profile={profile} 
                activeCharacter={activeCharacter}
                accentColor={accentColor}
                setAdminOpen={setAdminOpen} 
                setCharactersOpen={setCharactersOpen}
                handleLogout={handleLogout}
                onWikiOpen={isDM ? handleOpenArchive : undefined}
            />

            <AdminSettingsDialog 
                open={adminOpen} 
                onClose={() => setAdminOpen(false)} 
            />

            <CharactersSettingsDialog 
                open={charactersOpen} 
                onClose={() => setCharactersOpen(false)} 
            />
        </>
    );
};

export default FloatingProfile;
