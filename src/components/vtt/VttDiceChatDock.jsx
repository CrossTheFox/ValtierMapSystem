import { memo } from "react";
import { Box } from "@mui/material";
import DiceRevealOverlay from "./DiceRevealOverlay";
import VttChatPanel from "./VttChatPanel";
import TokenDeployPanel from "./TokenDeployPanel";
import CharacterRosterPanel from "./CharacterRosterPanel";
import useDiceRevealController from "../../hooks/useDiceRevealController";
import { VTT_RIGHT_DOCK } from "../../constants/vttHudTokens";

/** Neither depends on `messages`, so they must not re-render per chat update. */
const MemoDiceRevealOverlay = memo(DiceRevealOverlay);
const MemoTokenDeployPanel = memo(TokenDeployPanel);
const MemoCharacterRosterPanel = memo(CharacterRosterPanel);

/**
 * Owns dice reveal state + right dock so event/revealedIds updates do not
 * re-render the rest of UIOverlay (dialogs, combat HUD, map chrome).
 * Dock stays mounted (hidden) to avoid open/close remount jank.
 *
 * Column order (top → bottom): roster → tokens → chat so the character list
 * always sits above whatever else is open in the dock.
 */
export default function VttDiceChatDock({
    messages,
    localUid,
    chatPanelOpen,
    tokenPanelOpen,
    rosterPanelOpen = false,
    onCloseChat,
    onCloseToken,
    onCloseRoster,
}) {
    const {
        event: diceRevealEvent,
        skip: skipDiceReveal,
        onEventDone: onDiceRevealDone,
        revealedDiceIds,
    } = useDiceRevealController(messages, localUid);

    const dockVisible = chatPanelOpen || tokenPanelOpen || rosterPanelOpen;

    return (
        <>
            <MemoDiceRevealOverlay
                event={diceRevealEvent}
                onDone={onDiceRevealDone}
                onSkip={skipDiceReveal}
            />
            <Box
                data-no-token-drop
                sx={{
                    position: "fixed",
                    top: VTT_RIGHT_DOCK.top,
                    right: 16,
                    bottom: VTT_RIGHT_DOCK.bottom,
                    width: VTT_RIGHT_DOCK.width,
                    zIndex: 1250,
                    // `display: none` (not visibility/content-visibility) — a hidden
                    // subtree that still participates in layout re-paints on every
                    // toggle, which reads as a flicker.
                    display: dockVisible ? "flex" : "none",
                    flexDirection: "column",
                    gap: `${VTT_RIGHT_DOCK.gap}px`,
                    pointerEvents: dockVisible ? "auto" : "none",
                }}
                aria-hidden={!dockVisible}
            >
                <MemoCharacterRosterPanel
                    open={rosterPanelOpen}
                    onClose={onCloseRoster}
                />
                <MemoTokenDeployPanel
                    open={tokenPanelOpen}
                    onClose={onCloseToken}
                />
                <VttChatPanel
                    open={chatPanelOpen}
                    onClose={onCloseChat}
                    messages={messages}
                    revealedDiceIds={revealedDiceIds}
                />
            </Box>
        </>
    );
}
