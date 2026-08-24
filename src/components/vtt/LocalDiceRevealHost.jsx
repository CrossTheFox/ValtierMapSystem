import { useCallback, useEffect, useRef, useState } from "react";
import DiceRevealOverlay from "./DiceRevealOverlay";
import { registerLocalDiceRevealListener } from "../../utils/localDiceRevealBus";

/**
 * Mounts the local-only d20 reveal used by the unified Play flow (Slice 6),
 * independent from `useDiceRevealController`'s Firestore-message-driven queue
 * (`VttDiceChatDock`'s other `DiceRevealOverlay`) — Play never persists a
 * `DICE` message, so it needs its own overlay instance fed by
 * `src/utils/localDiceRevealBus.js` instead of chat messages.
 */
export default function LocalDiceRevealHost() {
    const [event, setEvent] = useState(null);
    const resolveRef = useRef(null);

    useEffect(() => registerLocalDiceRevealListener((evt, resolve) => {
        resolveRef.current = resolve;
        setEvent(evt);
    }), []);

    const finish = useCallback(() => {
        setEvent(null);
        const resolve = resolveRef.current;
        resolveRef.current = null;
        resolve?.();
    }, []);

    return <DiceRevealOverlay event={event} onDone={finish} onSkip={finish} />;
}
