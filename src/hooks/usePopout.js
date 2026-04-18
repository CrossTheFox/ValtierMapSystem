import { useCallback, useEffect, useRef, useState } from "react";

const POPUP_FEATURES =
    "width=960,height=720,resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no,location=no";

const STORAGE_KEY = (key) => `popup_payload_${key}`;

/**
 * Manages a single detached popup window for a dialog.
 *
 * @param {string} dialogKey  – identifier used in the URL: /popup?dialog=dialogKey
 *                              and as part of the localStorage payload key
 * @returns {{
 *   isPopped: boolean,
 *   popout: (payload?: any) => void
 * }}
 *
 * Pass `payload` to store data in localStorage so the popup window can restore
 * Redux state (e.g. the selected lore entry or location object).
 * The payload is automatically removed from localStorage when the popup closes.
 */
export default function usePopout(dialogKey) {
    const windowRef = useRef(null);
    const timerRef  = useRef(null);
    const [isPopped, setIsPopped] = useState(false);

    const stopPolling = useCallback(() => {
        clearInterval(timerRef.current);
        timerRef.current = null;
    }, []);

    const startPolling = useCallback(() => {
        stopPolling();
        timerRef.current = setInterval(() => {
            if (!windowRef.current || windowRef.current.closed) {
                stopPolling();
                windowRef.current = null;
                setIsPopped(false);
                localStorage.removeItem(STORAGE_KEY(dialogKey));
            }
        }, 600);
    }, [dialogKey, stopPolling]);

    const popout = useCallback(
        (payload = null) => {
            // Focus existing popup instead of opening a duplicate
            if (windowRef.current && !windowRef.current.closed) {
                windowRef.current.focus();
                return;
            }

            // Store payload for the popup to read from localStorage
            if (payload != null) {
                localStorage.setItem(STORAGE_KEY(dialogKey), JSON.stringify(payload));
            }

            const popup = window.open(
                `/popup?dialog=${dialogKey}`,
                `popup_${dialogKey}`,
                POPUP_FEATURES
            );

            if (!popup) {
                // Browser blocked the popup
                alert("Popups are blocked! Please allow popups for this site.");
                localStorage.removeItem(STORAGE_KEY(dialogKey));
                return;
            }

            windowRef.current = popup;
            setIsPopped(true);
            startPolling();
        },
        [dialogKey, startPolling]
    );

    // Cleanup polling timer on unmount
    useEffect(() => () => stopPolling(), [stopPolling]);

    return { isPopped, popout };
}

export { STORAGE_KEY };
