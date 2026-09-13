import { useCallback, useEffect, useState } from "react";

const STORAGE_PREFIX = "valtier_hud_activated_v1";

function storageKey(uid, campaignId) {
    return `${STORAGE_PREFIX}:${uid || "anon"}:${campaignId || "none"}`;
}

function readActivated(uid, campaignId) {
    try {
        const raw = localStorage.getItem(storageKey(uid, campaignId));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
    } catch {
        return [];
    }
}

function writeActivated(uid, campaignId, ids) {
    try {
        localStorage.setItem(storageKey(uid, campaignId), JSON.stringify(ids));
    } catch (e) {
        console.warn("[useHudActivatedCharacters] write failed", e);
    }
}

const EMPTY = Object.freeze([]);

/**
 * Session characters added to the combat HUD stack (≠ pins, ≠ principal only).
 * Shared between CharacterCombatHud and MapContextMenu (DM token add).
 */
export function useHudActivatedCharacters(uid, campaignId) {
    const key = storageKey(uid, campaignId);
    const [store, setStore] = useState(() => ({ key, ids: readActivated(uid, campaignId) }));
    if (store.key !== key) setStore({ key, ids: readActivated(uid, campaignId) });
    const activatedIds = store.key === key ? store.ids : EMPTY;

    const update = useCallback((mapIds) => {
        setStore((prev) => {
            const next = mapIds(prev.ids);
            return next === prev.ids ? prev : { key: prev.key, ids: next };
        });
    }, []);

    const addActivated = useCallback(
        (charId) => {
            if (!charId) return;
            update((prev) => (prev.includes(charId) ? prev : [...prev, charId]));
        },
        [update],
    );

    const removeActivated = useCallback(
        (charId) => {
            if (!charId) return;
            update((prev) => prev.filter((id) => id !== charId));
        },
        [update],
    );

    useEffect(() => {
        if (store.key !== key) return;
        writeActivated(uid, campaignId, store.ids);
    }, [store, key, uid, campaignId]);

    return { activatedIds, addActivated, removeActivated };
}
