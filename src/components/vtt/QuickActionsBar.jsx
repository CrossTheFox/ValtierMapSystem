import { useState, useEffect, useMemo } from "react";
import { Box, IconButton, Tooltip, Paper } from "@mui/material";
import BoltIcon from "@mui/icons-material/Bolt";
import { useDispatch, useSelector } from "react-redux";
import { CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { getAbilitiesByIds } from "../../../firebase/services/characterService";
import { callAbilityInChat } from "../../../firebase/services/chatService";
import { setActiveCharacterId, persistActiveCharacter } from "../../store/playerSlice";

const HOTBAR_SLOTS = 8;

export default function QuickActionsBar({ glossaryEntities = [] }) {
    const dispatch = useDispatch();
    const [abilities, setAbilities] = useState([]);

    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const profile = useSelector((s) => s.player.profile);
    const locations = useSelector((s) => s.world.locations);
    const sheetCharacters = useSelector((s) => s.characters.list);

    const playerCharacters = useMemo(() => {
        const fromMap = Object.values(locations)
            .flatMap((loc) => loc.characters ?? [])
            .filter((c) => !c.isNpc && !c.isEnemy);
        const byId = new Map(fromMap.map((c) => [c.id, c]));
        (sheetCharacters || []).forEach((c) => {
            if (!c.isNpc && !c.isEnemy && !byId.has(c.id)) byId.set(c.id, c);
        });
        // Prefer roster linked to this player when available
        const ownedIds = new Set(profile?.characterIds || []);
        const list = [...byId.values()];
        if (ownedIds.size) {
            const owned = list.filter((c) => ownedIds.has(c.id) || c.ownerPlayerId === profile?.uid);
            if (owned.length) return owned;
        }
        if (profile?.uid) {
            const owned = list.filter((c) => c.ownerPlayerId === profile.uid);
            if (owned.length) return owned;
        }
        return list;
    }, [locations, sheetCharacters, profile]);

    const selectedCharId = profile?.activeCharacterId
        || playerCharacters[0]?.id
        || null;

    useEffect(() => {
        if (!profile?.uid || !playerCharacters.length) return;
        if (profile.activeCharacterId) return;
        const first = playerCharacters[0];
        if (!first) return;
        dispatch(setActiveCharacterId(first.id));
        dispatch(persistActiveCharacter({ uid: profile.uid, characterId: first.id }));
    }, [profile?.uid, profile?.activeCharacterId, playerCharacters, dispatch]);

    const selectedChar = playerCharacters.find((c) => c.id === selectedCharId);

    useEffect(() => {
        if (!selectedChar?.unlockedAbilities?.length) {
            setAbilities([]);
            return;
        }
        getAbilitiesByIds(selectedChar.unlockedAbilities.slice(0, HOTBAR_SLOTS))
            .then(setAbilities)
            .catch(console.error);
    }, [selectedChar]);

    const handleSelectChar = (charId) => {
        if (!profile?.uid || !charId) return;
        dispatch(setActiveCharacterId(charId));
        dispatch(persistActiveCharacter({ uid: profile.uid, characterId: charId }));
    };

    const handleCall = async (ability) => {
        if (!campaignId) return;
        await callAbilityInChat(campaignId, profile, {
            ...ability,
            characterId: selectedChar?.id,
            characterName: selectedChar?.name,
        }, glossaryEntities);
    };

    if (!playerCharacters.length) return null;

    return (
        <Paper
            elevation={0}
            sx={{
                position: "fixed",
                bottom: 16,
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                px: 1,
                py: 0.75,
                bgcolor: `${UI_COLORS.backgroundSecondary}ee`,
                border: `1px solid ${UI_COLORS.border}`,
                borderRadius: 1,
                zIndex: 1250,
                pointerEvents: "auto",
            }}
        >
            <BoltIcon sx={{ fontSize: "0.9rem", color: UI_COLORS.anomaly, mr: 0.5 }} />
            {abilities.map((ab) => (
                <Tooltip key={ab.id} title={ab.content?.slice(0, 120) ?? ab.label}>
                    <IconButton
                        size="small"
                        onClick={() => handleCall(ab)}
                        sx={{
                            width: 36,
                            height: 36,
                            border: `1px solid ${UI_COLORS.accent}44`,
                            borderRadius: 1,
                            color: UI_COLORS.accent,
                            fontSize: "0.55rem",
                            fontFamily: "'Orbitron', sans-serif",
                            "&:hover": { bgcolor: `${UI_COLORS.accent}18` },
                        }}
                    >
                        {ab.label?.slice(0, 3)?.toUpperCase()}
                    </IconButton>
                </Tooltip>
            ))}
            {playerCharacters.length > 1 && (
                <Box sx={{ ml: 0.5, borderLeft: `1px solid ${UI_COLORS.border}`, pl: 0.5 }}>
                    {playerCharacters.map((c) => (
                        <IconButton
                            key={c.id}
                            size="small"
                            onClick={() => handleSelectChar(c.id)}
                            sx={{
                                color: selectedCharId === c.id ? UI_COLORS.anomaly : UI_COLORS.textSecondary,
                                fontSize: "0.6rem",
                            }}
                        >
                            <CyberText sx={{ fontSize: "0.55rem" }}>{c.name?.slice(0, 2)}</CyberText>
                        </IconButton>
                    ))}
                </Box>
            )}
        </Paper>
    );
}
