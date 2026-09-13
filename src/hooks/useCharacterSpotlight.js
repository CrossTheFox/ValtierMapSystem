import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";

const STORAGE_PREFIX = "valtier_spotlight_dismissed_v1";

function storageKey(campaignId) {
    return `${STORAGE_PREFIX}:${campaignId || "none"}`;
}

function readDismissed(campaignId) {
    try {
        return sessionStorage.getItem(storageKey(campaignId)) || null;
    } catch {
        return null;
    }
}

function writeDismissed(campaignId, spotlightId) {
    try {
        if (!spotlightId) sessionStorage.removeItem(storageKey(campaignId));
        else sessionStorage.setItem(storageKey(campaignId), spotlightId);
    } catch {
        /* ignore */
    }
}

/**
 * Reads `game.characterSpotlight` and manages per-client dismiss state.
 * Re-shows when Firestore publishes a new `id`.
 */
export function useCharacterSpotlight() {
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const spotlight = useSelector((s) => s.game.characterSpotlight);
    const [dismissedId, setDismissedId] = useState(() => readDismissed(campaignId));

    useEffect(() => {
        setDismissedId(readDismissed(campaignId));
    }, [campaignId]);

    const visible = Boolean(
        spotlight?.id
        && spotlight.id !== dismissedId,
    );

    const dismiss = useCallback(() => {
        if (!spotlight?.id || !campaignId) return;
        writeDismissed(campaignId, spotlight.id);
        setDismissedId(spotlight.id);
    }, [spotlight?.id, campaignId]);

    return {
        spotlight,
        isActive: visible,
        dismiss,
    };
}
