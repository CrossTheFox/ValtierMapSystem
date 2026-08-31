import { useCallback, useEffect, useRef, useState } from "react";

/** Typing paints immediately; parent/Firestore catch up after idle. */
export const LOCAL_TEXT_COMMIT_MS = 400;

/**
 * Controlled local draft for inputs/textareas.
 * Updates paint immediately; schedules `onCommit(value)` after idle so parents
 * don't re-render (and autosave) on every keystroke.
 */
export function useLocalText(remoteValue, onCommit, delayMs = LOCAL_TEXT_COMMIT_MS) {
    const [draft, setDraft] = useState(remoteValue ?? "");
    const focusedRef = useRef(false);
    const timerRef = useRef(null);
    const pendingRef = useRef(null);
    const onCommitRef = useRef(onCommit);
    onCommitRef.current = onCommit;

    useEffect(() => {
        if (!focusedRef.current && pendingRef.current == null) {
            setDraft(remoteValue ?? "");
        }
    }, [remoteValue]);

    const flush = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        const pending = pendingRef.current;
        pendingRef.current = null;
        if (pending != null) onCommitRef.current?.(pending);
    }, []);

    const cancel = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        pendingRef.current = null;
    }, []);

    useEffect(() => () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        const pending = pendingRef.current;
        pendingRef.current = null;
        if (pending != null) onCommitRef.current?.(pending);
    }, []);

    const setValue = useCallback((next, { commitNow = false } = {}) => {
        setDraft(next);
        pendingRef.current = next;
        if (timerRef.current) clearTimeout(timerRef.current);
        if (commitNow) {
            timerRef.current = null;
            pendingRef.current = null;
            onCommitRef.current?.(next);
            return;
        }
        timerRef.current = setTimeout(() => {
            timerRef.current = null;
            const pending = pendingRef.current;
            pendingRef.current = null;
            if (pending != null) onCommitRef.current?.(pending);
        }, delayMs);
    }, [delayMs]);

    return {
        value: draft,
        setValue,
        flush,
        cancel,
        onFocus: () => { focusedRef.current = true; },
        onBlur: () => {
            focusedRef.current = false;
            flush();
        },
    };
}
