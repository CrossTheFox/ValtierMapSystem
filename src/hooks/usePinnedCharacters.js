import { useCallback, useEffect, useState } from "react";

const STORAGE_PREFIX = "valtier_hud_pins_v1";

function storageKey(uid, campaignId) {
    return `${STORAGE_PREFIX}:${uid || "anon"}:${campaignId || "none"}`;
}

function readPins(uid, campaignId) {
    try {
        const raw = localStorage.getItem(storageKey(uid, campaignId));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
    } catch {
        return [];
    }
}

function writePins(uid, campaignId, ids) {
    try {
        localStorage.setItem(storageKey(uid, campaignId), JSON.stringify(ids));
    } catch (e) {
        console.warn("[usePinnedCharacters] write failed", e);
    }
}

const MAX_PINS = 5;
const EMPTY_PINS = Object.freeze([]);

/**
 * Persist HUD secondary character pins (active is always shown separately).
 */
export function usePinnedCharacters(uid, campaignId) {
    const key = storageKey(uid, campaignId);
    // Keyed state instead of a mount effect: re-reading in an effect committed a
    // second render of the whole combat HUD on every mount.
    const [store, setStore] = useState(() => ({ key, ids: readPins(uid, campaignId) }));
    if (store.key !== key) setStore({ key, ids: readPins(uid, campaignId) });
    const pinnedIds = store.key === key ? store.ids : EMPTY_PINS;

    const update = useCallback(
        (mapIds) => {
            setStore((prev) => {
                const next = mapIds(prev.ids);
                return next === prev.ids ? prev : { key: prev.key, ids: next };
            });
        },
        [],
    );

    const togglePin = useCallback(
        (charId) => {
            if (!charId) return;
            update((prev) =>
                prev.includes(charId)
                    ? prev.filter((id) => id !== charId)
                    : [charId, ...prev.filter((id) => id !== charId)].slice(0, MAX_PINS),
            );
        },
        [update],
    );

    const pinCharacter = useCallback(
        (charId) => {
            if (!charId) return;
            update((prev) => (prev.includes(charId) ? prev : [charId, ...prev].slice(0, MAX_PINS)));
        },
        [update],
    );

    // Persisting here keeps the state updaters pure (StrictMode double-invokes them).
    useEffect(() => {
        if (store.key !== key) return;
        writePins(uid, campaignId, store.ids);
    }, [store, key, uid, campaignId]);

    return { pinnedIds, togglePin, pinCharacter, maxPins: MAX_PINS };
}
