import { useCallback } from "react";
import { showLocalDiceReveal } from "../utils/localDiceRevealBus";

/**
 * Trigger the local-only d20 reveal used by the unified Play flow (Slice 6) —
 * no persisted `DICE` chat message, purely a client-side animation gate before
 * the resolved ABILITY card posts. Requires `<LocalDiceRevealHost />` mounted
 * once somewhere in the tree (already done in `VttDiceChatDock`).
 *
 * @returns {(atk: { raw: number, total: number, mod: number }, opts?: { rollerName?: string, senderId?: string|null }) => Promise<void>}
 */
export function useLocalDiceReveal() {
    return useCallback((atk, opts = {}) => {
        if (!atk || atk.raw == null) return Promise.resolve();
        return showLocalDiceReveal({
            kind: "unified",
            sides: 20,
            result: atk.raw,
            total: atk.total ?? atk.raw + (atk.mod || 0),
            mod: atk.mod || 0,
            rollerName: opts.rollerName || "???",
            senderId: opts.senderId ?? null,
        });
    }, []);
}
