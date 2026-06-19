import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Dialog, DialogContent, Box, CircularProgress } from "@mui/material";

import { fetchPlayerCharacters } from "../store/characterSlice";
import { setActiveCharacterId, persistActiveCharacter } from "../store/playerSlice";
import { UI_COLORS } from "../constants/uiColors";
import { useStatSystem } from "../hooks/useStatSystem";
import { useCampaignWikiEntities } from "../hooks/useCampaignWikiEntities";
import DraggableResizablePaper from "./DraggableResizablePaper";
import usePopout from "../hooks/usePopout";
import VttDialogHeaderBar from "./VttDialogHeaderBar";
import CharacterSheetBody from "./characters/CharacterSheetBody";
import CharacterAvatarPicker from "./characters/CharacterAvatarPicker";
import CharacterSheetHeaderTitle from "./characters/CharacterSheetHeaderTitle";
import SessionPoolHud from "./characters/SessionPoolHud";
import { VttDialogHeaderControls } from "./VttDialogHeader";

export default function CharactersSettingsDialog({ open, onClose, popupMode = false }) {
    const dispatch = useDispatch();

    const { profile } = useSelector((state) => state.player);
    const { list: characters, status: charactersStatus } = useSelector((state) => state.characters);
    const loading = charactersStatus === "loading";

    const [selectedCharId, setSelectedCharId] = useState(null);
    const [selectedCharacter, setSelectedCharacter] = useState(null);
    const [activeTab, setActiveTab] = useState("STATS");
    const [isMinimized, setIsMinimized] = useState(false);

    const { isPopped, popout } = usePopout("characters");

    const handleToggleMinimize = (e) => {
        e.stopPropagation();
        setIsMinimized((v) => !v);
    };

    const handlePopout = (e) => {
        e.stopPropagation();
        popout();
        onClose();
    };

    useEffect(() => {
        if (open && profile?.uid) {
            dispatch(
                fetchPlayerCharacters({
                    uid: profile.uid,
                    characterIds: profile.characterIds || [],
                })
            );
        }
    }, [open, profile?.uid, profile?.characterIds, dispatch]);

    useEffect(() => {
        if (characters.length > 0 && !selectedCharId) {
            const initial = profile?.activeCharacterId
                ? characters.find((c) => c.id === profile.activeCharacterId)
                : null;
            const first = initial || characters[0];
            setSelectedCharId(first.id);
            setSelectedCharacter(first);
        }
    }, [characters, selectedCharId, profile?.activeCharacterId]);

    const handleSelectCharacter = (charId) => {
        setSelectedCharId(charId);
        dispatch(setActiveCharacterId(charId));
        if (profile?.uid) {
            dispatch(persistActiveCharacter({ uid: profile.uid, characterId: charId }));
        }
    };

    useEffect(() => {
        const char = characters.find((c) => c.id === selectedCharId);
        setSelectedCharacter(char);
    }, [selectedCharId, characters]);

    useEffect(() => {
        setActiveTab("STATS");
    }, [selectedCharId]);

    const campaignForRules = selectedCharacter?.campaignId || profile?.currentCampaignId;
    const { stats: statDefinitions, resourceTracks } = useStatSystem(open ? campaignForRules : null);
    const campaignWikiEntities = useCampaignWikiEntities(open ? campaignForRules : null);

    const headerControls = (
        <VttDialogHeaderControls
            isMinimized={isMinimized}
            onToggleMinimize={handleToggleMinimize}
            onClose={popupMode ? () => window.close() : onClose}
            isPopped={isPopped}
            onPopout={handlePopout}
            popupMode={popupMode}
        />
    );

    const sheetHeader = (
        <VttDialogHeaderBar
            isMinimized={isMinimized}
            onMinimizedClick={handleToggleMinimize}
            left={
                !isMinimized && characters.length > 0 ? (
                    <CharacterAvatarPicker
                        characters={characters}
                        selectedId={selectedCharId}
                        onSelect={handleSelectCharacter}
                        size={popupMode ? 48 : 44}
                        variant="header"
                    />
                ) : null
            }
            center={
                <CharacterSheetHeaderTitle
                    character={selectedCharacter}
                    isMinimized={isMinimized}
                />
            }
            right={
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
                    {!isMinimized && selectedCharacter && (
                        <SessionPoolHud
                            characterId={selectedCharacter.id}
                            resourceTracks={resourceTracks}
                        />
                    )}
                    {headerControls}
                </Box>
            }
        />
    );

    const sheetBody = (
        <CharacterSheetBody
            character={selectedCharacter}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            statDefinitions={statDefinitions}
            wikiEntities={campaignWikiEntities}
        />
    );

    if (popupMode) {
        return (
            <Box sx={{ display: "flex", flexDirection: "column", width: "100vw", height: "100vh", bgcolor: "#0d0d14", color: "#fff", overflow: "hidden" }}>
                {sheetHeader}
                <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                    {loading ? (
                        <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        sheetBody
                    )}
                </Box>
            </Box>
        );
    }

    return (
        <Dialog
            open={open}
            onClose={!isMinimized ? onClose : undefined}
            fullWidth
            maxWidth={false}
            hideBackdrop={isMinimized}
            disableEnforceFocus={isMinimized}
            style={isMinimized ? { pointerEvents: "none" } : {}}
            sx={{
                "& .MuiDialog-container": {
                    alignItems: { xs: "flex-end", sm: "center" },
                },
            }}
            PaperComponent={DraggableResizablePaper}
            PaperProps={{
                dragKey: isMinimized ? "min" : "max",
                sx: isMinimized
                    ? {
                          pointerEvents: "auto",
                          bgcolor: "#0d0d14",
                          color: "#fff",
                          border: `1px solid ${UI_COLORS.accent}`,
                          transition: "border 0.3s, box-shadow 0.3s",
                          borderRadius: 2,
                          boxShadow: `0 0 20px ${UI_COLORS.accent}44`,
                          position: "fixed",
                          bottom: { xs: 82, sm: 24 },
                          right: { xs: 8, sm: 215 },
                          m: 0,
                          width: { xs: "calc(100vw - 16px)", sm: "300px" },
                          maxHeight: "60px",
                          overflow: "hidden",
                      }
                    : {
                          pointerEvents: "auto",
                          bgcolor: "#0d0d14",
                          color: "#fff",
                          border: `1px solid ${UI_COLORS.accent}44`,
                          transition: "border 0.3s, box-shadow 0.3s",
                          borderRadius: { xs: "12px 12px 0 0", sm: 3 },
                          boxShadow: "0 0 40px rgba(255,0,255,0.2)",
                          display: "flex",
                          flexDirection: "column",
                          m: 0,
                          height: { xs: "90vh", sm: "85vh" },
                          width: { xs: "100%", sm: "90%" },
                          overflow: "hidden",
                      },
            }}
        >
            {sheetHeader}

            <DialogContent
                className="dialog-no-drag"
                sx={{
                    display: isMinimized ? "none" : "flex",
                    flexDirection: "column",
                    p: 0,
                    flex: 1,
                    minHeight: 0,
                    overflow: "hidden",
                }}
            >
                {loading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    sheetBody
                )}
            </DialogContent>
        </Dialog>
    );
}
