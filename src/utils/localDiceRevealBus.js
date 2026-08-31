/**
 * Tiny pub/sub so the unified Play flow (Slice 6) can trigger the local-only
 * d20 reveal from anywhere — a `PlayButton` deep inside the Dossier dialog,
 * `AbilityHotbar` on the VTT overlay, etc. — without prop-drilling through
 * every intermediate component or duplicating `DiceRevealOverlay`.
 *
 * `LocalDiceRevealHost` (mounted once in `VttDiceChatDock`) is the only
 * subscriber; `showLocalDiceReveal` is the only publisher. Deliberately NOT a
 * React hook itself so it works the same from a plain callback.
 */

let listener = null;

/**
 * @param {object} event - same shape `DiceRevealOverlay` already consumes for
 *   a `kind: "unified"` reveal (see `src/utils/diceRollAnim/classify.js`).
 * @returns {Promise<void>} resolves once the reveal finishes or is skipped.
 *   Resolves immediately if no host is mounted (never blocks Play).
 */
export function showLocalDiceReveal(event) {
    return new Promise((resolve) => {
        if (!listener) {
            resolve();
            return;
        }
        listener(event, resolve);
    });
}

/** @returns {() => void} unsubscribe */
export function registerLocalDiceRevealListener(fn) {
    listener = fn;
    return () => {
        if (listener === fn) listener = null;
    };
}
