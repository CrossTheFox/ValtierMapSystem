import { useEffect, useMemo, useRef, useState } from "react";
import { Box } from "@mui/material";
import { useSelector, useDispatch } from "react-redux";
import { closeDialog, showTokenSpeech } from "../store/uiSlice";

import LocationInfoCard        from "../components/LocationInfoCard";
import LoreDialog              from "../components/LoreDialog";
import CharactersSettingsDialog from "../components/CharactersSettingsDialog";
import AdminSettingsDialog     from "../components/AdminSettingsDialog";
import CharactersGlobalDialog  from "../components/CharactersGlobalDialog";
import NarrativeWikiOverlay    from "../components/wiki/NarrativeWikiOverlay";
import CyberSnackbar           from "../components/customs/CyberSnackbar";
import MapContextMenu          from "../components/MapContextMenu";
import MeasuringHUD            from "../components/MeasuringHUD";

import TopRightHUD             from "../components/hud/TopRightHUD";
import DialogStackBar          from "../components/hud/DialogStackBar";
import MapSelectorHUD          from "../components/vtt/MapSelectorHUD";
import VttChatPanel            from "../components/vtt/VttChatPanel";
import TokenDeployPanel        from "../components/vtt/TokenDeployPanel";
import CharacterCombatHud      from "../components/vtt/CharacterCombatHud";
import { VTT_RIGHT_DOCK } from "../constants/vttHudTokens";
import {
    CHAT_MESSAGE_TYPES,
    subscribeToChatMessages,
} from "../../firebase/services/chatService";

function messageTimeMs(msg) {
    const t = msg?.createdAt;
    if (!t) return 0;
    if (typeof t.toMillis === "function") return t.toMillis();
    if (typeof t.seconds === "number") return t.seconds * 1000;
    return 0;
}

export default function UIOverlay() {
    const dispatch  = useDispatch();
    const profile   = useSelector((state) => state.player.profile);
    const { openDialogs } = useSelector((state) => state.ui);
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const isAuthenticated = !!profile;

    const [tokenPanelOpen, setTokenPanelOpen] = useState(false);
    const [chatPanelOpen, setChatPanelOpen] = useState(false);
    const [abilityBarOpen, setAbilityBarOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [lastReadMs, setLastReadMs] = useState(0);
    const seededReadRef = useRef(false);
    const speechSeededRef = useRef(false);
    const seenSpeechIdsRef = useRef(new Set());
    const activeMapId = useSelector((s) => s.world.activeMapId ?? s.world.map?.id);
    const tokenPositions = useSelector((s) => s.game.tokenPositions ?? {});

    useEffect(() => {
        if (!campaignId) {
            setMessages([]);
            seededReadRef.current = false;
            speechSeededRef.current = false;
            seenSpeechIdsRef.current = new Set();
            return undefined;
        }
        seededReadRef.current = false;
        speechSeededRef.current = false;
        seenSpeechIdsRef.current = new Set();
        return subscribeToChatMessages(campaignId, setMessages);
    }, [campaignId]);

    // On first snapshot, treat existing history as already read
    useEffect(() => {
        if (seededReadRef.current || !messages.length) return;
        const latest = Math.max(...messages.map(messageTimeMs), Date.now());
        setLastReadMs(latest);
        seededReadRef.current = true;
    }, [messages]);

    // IC speech bubbles over tokens on the active map
    useEffect(() => {
        if (!messages.length) return;

        if (!speechSeededRef.current) {
            messages.forEach((m) => {
                if (m?.id) seenSpeechIdsRef.current.add(m.id);
            });
            speechSeededRef.current = true;
            return;
        }

        const mapTokens = activeMapId ? (tokenPositions[activeMapId] ?? {}) : {};

        for (const msg of messages) {
            if (!msg?.id || seenSpeechIdsRef.current.has(msg.id)) continue;
            seenSpeechIdsRef.current.add(msg.id);

            if (msg.isOOC) continue;
            if (msg.type && msg.type !== CHAT_MESSAGE_TYPES.TEXT) continue;
            if (!msg.characterId || !msg.text?.trim()) continue;
            if (!mapTokens[msg.characterId]) continue;

            dispatch(showTokenSpeech({
                characterId: msg.characterId,
                text: msg.text.trim(),
                messageId: msg.id,
                durationMs: 8000,
            }));
        }
    }, [messages, activeMapId, tokenPositions, dispatch]);

    // While chat is open, keep read cursor at the latest message
    useEffect(() => {
        if (!chatPanelOpen || !messages.length) return;
        const latest = Math.max(...messages.map(messageTimeMs), Date.now());
        setLastReadMs(latest);
    }, [chatPanelOpen, messages]);

    const chatUnread = useMemo(() => {
        if (chatPanelOpen) return 0;
        const uid = profile?.uid;
        return messages.filter((m) => {
            if (uid && m.senderId === uid) return false;
            return messageTimeMs(m) > lastReadMs;
        }).length;
    }, [messages, lastReadMs, chatPanelOpen, profile?.uid]);

    const dockVisible = chatPanelOpen || tokenPanelOpen;

    return (
        <div
            id="ui-overlay"
            style={{ position: "fixed", inset: 0, pointerEvents: "none" }}
        >
            <LocationInfoCard />
            <LoreDialog />
            {isAuthenticated && <NarrativeWikiOverlay />}

            <CharactersGlobalDialog
                open={openDialogs.characters}
                onClose={() => dispatch(closeDialog("characters"))}
            />

            <CharactersSettingsDialog
                open={openDialogs.sheet}
                onClose={() => dispatch(closeDialog("sheet"))}
            />

            {isAuthenticated && (
                <AdminSettingsDialog
                    open={openDialogs.settings}
                    onClose={() => dispatch(closeDialog("settings"))}
                />
            )}

            <CyberSnackbar />

            <div style={{ pointerEvents: "auto" }}>
                <MapSelectorHUD />
                <TopRightHUD
                    profile={profile}
                    showTokenToggle={isAuthenticated}
                    tokenPanelOpen={tokenPanelOpen}
                    onToggleTokenPanel={() => setTokenPanelOpen((v) => !v)}
                    showChatToggle={isAuthenticated}
                    chatPanelOpen={chatPanelOpen}
                    chatUnread={chatUnread}
                    onToggleChatPanel={() => setChatPanelOpen((v) => !v)}
                />
                {isAuthenticated && (
                    <CharacterCombatHud
                        abilityBarOpen={abilityBarOpen}
                        onToggleAbilityBar={() => setAbilityBarOpen((v) => !v)}
                    />
                )}
                <DialogStackBar />
                <MeasuringHUD />
                <MapContextMenu />
                {isAuthenticated && (
                    <>
                        {dockVisible && (
                            <Box
                                sx={{
                                    position: "fixed",
                                    top: VTT_RIGHT_DOCK.top,
                                    right: 16,
                                    bottom: VTT_RIGHT_DOCK.bottom,
                                    width: VTT_RIGHT_DOCK.width,
                                    zIndex: 1250,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: `${VTT_RIGHT_DOCK.gap}px`,
                                    pointerEvents: "none",
                                }}
                            >
                                <TokenDeployPanel
                                    open={tokenPanelOpen}
                                    onClose={() => setTokenPanelOpen(false)}
                                />
                                <VttChatPanel
                                    open={chatPanelOpen}
                                    onClose={() => setChatPanelOpen(false)}
                                    messages={messages}
                                />
                            </Box>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
