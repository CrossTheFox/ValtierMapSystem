import React, { useState, useEffect } from 'react';
import { UI_COLORS } from "../constants/uiColors";
import { logoutPlayer } from "../../firebase/playersAuth";
import { CyberProfile } from "./customs/CyberProfile";
import AdminSettingsDialog from "./AdminSettingsDialog";
import CharactersSettingsDialog from "./CharactersSettingsDialog";
import { useDispatch, useSelector } from 'react-redux';
import { resetWorldState } from '../store/worldSlice';
import { fetchPlayerCharacters } from '../store/characterSlice';

const FloatingProfile = ({ profile }) => {
    const dispatch = useDispatch();
    const [adminOpen, setAdminOpen] = useState(false);
    const [charactersOpen, setCharactersOpen] = useState(false);
    const accentColor = UI_COLORS.accent || "#00f2ea";

    const { list: characters } = useSelector((state) => state.characters);

    // Load the player's characters as soon as the profile is available
    useEffect(() => {
        if (profile?.characterIds?.length > 0) {
            dispatch(fetchPlayerCharacters(profile.characterIds));
        }
    }, [profile?.uid, dispatch]);

    const activeCharacter = characters.find(c => c.id === profile?.activeCharacterId) || characters[0] || null;

    const handleLogout = async () => {
        try { 
            await logoutPlayer();
            dispatch(resetWorldState());
        } 
        catch (error) { console.error("Logout Error:", error); }
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
