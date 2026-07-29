import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { closeDialog, showTokenSpeech } from "../store/uiSlice";

import LocationInfoCard from "../components/LocationInfoCard";
import LoreDialog from "../components/LoreDialog";
import CharactersSettingsDialog from "../components/CharactersSettingsDialog";
import AdminSettingsDialog from "../components/AdminSettingsDialog";
import CharactersGlobalDialog from "../components/CharactersGlobalDialog";
import NarrativeWikiOverlay from "../components/wiki/NarrativeWikiOverlay";
import CyberSnackbar from "../components/customs/CyberSnackbar";
import MapContextMenu from "../components/MapContextMenu";
import MeasuringHUD from "../components/MeasuringHUD";

import TopRightHUD from "../components/hud/TopRightHUD";
import DialogStackBar from "../components/hud/DialogStackBar";
import MapSelectorHUD from "../components/vtt/MapSelectorHUD";
import CharacterCombatHud from "../components/vtt/CharacterCombatHud";
import LeftToolsRail from "../components/vtt/LeftToolsRail";
import VttDiceChatDock from "../components/vtt/VttDiceChatDock";
import {
    CHAT_MESSAGE_TYPES,
    subscribeToChatMessages,
} from "../../firebase/services/chatService";

const EMPTY_TOKEN_POSITIONS = Object.freeze({});
const EMPTY_CHAT = Object.freeze({ campaignId: null, messages: Object.freeze([]) });

/**
 * Chat messages stream in through this component, so anything that does not
 * consume them must be able to bail out of the re-render. These children read
 * what they need from Redux, so memoizing them costs nothing in freshness.
 */
const MemoLocationInfoCard = memo(LocationInfoCard);
const MemoLoreDialog = memo(LoreDialog);
const MemoNarrativeWikiOverlay = memo(NarrativeWikiOverlay);
const MemoCyberSnackbar = memo(CyberSnackbar);
const MemoCharactersGlobalDialog = memo(CharactersGlobalDialog);
const MemoCharactersSettingsDialog = memo(CharactersSettingsDialog);
const MemoAdminSettingsDialog = memo(AdminSettingsDialog);
const MemoMapSelectorHUD = memo(MapSelectorHUD);
const MemoTopRightHUD = memo(TopRightHUD);
const MemoCharacterCombatHud = memo(CharacterCombatHud);
const MemoDialogStackBar = memo(DialogStackBar);
const MemoMeasuringHUD = memo(MeasuringHUD);
const MemoMapContextMenu = memo(MapContextMenu);
const MemoLeftToolsRail = memo(LeftToolsRail);

function messageTimeMs(msg) {
    const t = msg?.createdAt;
    if (!t) return 0;
    if (typeof t.toMillis === "function") return t.toMillis();
    if (typeof t.seconds === "number") return t.seconds * 1000;
    return 0;
}

export default function UIOverlay() {
    const dispatch = useDispatch();
    const profile = useSelector((state) => state.player.profile);
    const openDialogs = useSelector((state) => state.ui.openDialogs);
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const isAuthenticated = !!profile;

    const [tokenPanelOpen, setTokenPanelOpen] = useState(false);
    const [chatPanelOpen, setChatPanelOpen] = useState(false);
    const [abilityBarOpen, setAbilityBarOpen] = useState(false);
    const [chat, setChat] = useState(EMPTY_CHAT);
    // Everything already in Firestore when the HUD mounts counts as read.
    const [lastReadMs, setLastReadMs] = useState(() => Date.now());
    const speechSeededRef = useRef(false);
    const seenSpeechIdsRef = useRef(new Set());
    const activeMapId = useSelector((s) => s.world.activeMapId ?? s.world.map?.id);
    // Stable empty fallback — never allocate `{}` in the selector (re-render storm).
    const tokenPositions = useSelector((s) => s.game.tokenPositions) || EMPTY_TOKEN_POSITIONS;

    useEffect(() => {
        speechSeededRef.current = false;
        seenSpeechIdsRef.current = new Set();
        if (!campaignId) return undefined;
        return subscribeToChatMessages(campaignId, (list) =>
            setChat({ campaignId, messages: list }),
        );
    }, [campaignId]);

    // Derived instead of cleared in the effect: avoids an extra render on switch.
    const messages = chat.campaignId === campaignId ? chat.messages : EMPTY_CHAT.messages;

    useEffect(() => {
        if (!messages.length) return;

        if (!speechSeededRef.current) {
            messages.forEach((m) => {
                if (m?.id) seenSpeechIdsRef.current.add(m.id);
            });
            speechSeededRef.current = true;
            return;
        }

        const mapTokens = activeMapId ? (tokenPositions[activeMapId] ?? EMPTY_TOKEN_POSITIONS) : EMPTY_TOKEN_POSITIONS;

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

    const chatUnread = useMemo(() => {
        if (chatPanelOpen) return 0;
        const uid = profile?.uid;
        return messages.filter((m) => {
            if (uid && m.senderId === uid) return false;
            return messageTimeMs(m) > lastReadMs;
        }).length;
    }, [messages, lastReadMs, chatPanelOpen, profile?.uid]);

    const closeCharacters = useCallback(() => dispatch(closeDialog("characters")), [dispatch]);
    const closeSheet = useCallback(() => dispatch(closeDialog("sheet")), [dispatch]);
    const closeSettings = useCallback(() => dispatch(closeDialog("settings")), [dispatch]);
    // Marking read on the click keeps the toggle a single render (no effect cascade).
    const closeChat = useCallback(() => {
        setChatPanelOpen(false);
        setLastReadMs(Date.now());
    }, []);
    const closeToken = useCallback(() => setTokenPanelOpen(false), []);
    const toggleChat = useCallback(() => {
        setChatPanelOpen((v) => !v);
        setLastReadMs(Date.now());
    }, []);
    const toggleToken = useCallback(() => setTokenPanelOpen((v) => !v), []);
    const toggleAbilityBar = useCallback(() => setAbilityBarOpen((v) => !v), []);

    const leftRail = useMemo(
        () => (isAuthenticated ? <MemoLeftToolsRail /> : null),
        [isAuthenticated],
    );

    return (
        <div
            id="ui-overlay"
            style={{ position: "fixed", inset: 0, pointerEvents: "none" }}
        >
            <MemoLocationInfoCard />
            <MemoLoreDialog />
            {isAuthenticated && <MemoNarrativeWikiOverlay />}

            <MemoCharactersGlobalDialog
                open={!!openDialogs.characters}
                onClose={closeCharacters}
            />

            <MemoCharactersSettingsDialog
                open={!!openDialogs.sheet}
                onClose={closeSheet}
            />

            {isAuthenticated && (
                <MemoAdminSettingsDialog
                    open={!!openDialogs.settings}
                    onClose={closeSettings}
                />
            )}

            <MemoCyberSnackbar />

            {isAuthenticated && (
                <VttDiceChatDock
                    messages={messages}
                    localUid={profile?.uid}
                    chatPanelOpen={chatPanelOpen}
                    tokenPanelOpen={tokenPanelOpen}
                    onCloseChat={closeChat}
                    onCloseToken={closeToken}
                />
            )}

            <div style={{ pointerEvents: "auto" }}>
                <MemoMapSelectorHUD>{leftRail}</MemoMapSelectorHUD>
                <MemoTopRightHUD
                    profile={profile}
                    showTokenToggle={isAuthenticated}
                    tokenPanelOpen={tokenPanelOpen}
                    onToggleTokenPanel={toggleToken}
                    showChatToggle={isAuthenticated}
                    chatPanelOpen={chatPanelOpen}
                    chatUnread={chatUnread}
                    onToggleChatPanel={toggleChat}
                />
                {isAuthenticated && (
                    <MemoCharacterCombatHud
                        abilityBarOpen={abilityBarOpen}
                        onToggleAbilityBar={toggleAbilityBar}
                    />
                )}
                <MemoDialogStackBar />
                <MemoMeasuringHUD />
                <MemoMapContextMenu />
            </div>
        </div>
    );
}
