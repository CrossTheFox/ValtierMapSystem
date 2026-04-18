import { useState, useEffect, useCallback } from "react";
import { getSessionPools, setSessionPools } from "../utils/characterSessionPools";

/**
 * Effort / strain (and future tracks): session-only, persisted in localStorage per character.
 * Max comes from resourceTracks (stat system), not from Firestore.
 */
export function useCharacterSessionPools(characterId, resourceTracks) {
    const [pools, setPools] = useState(() => getSessionPools(characterId, resourceTracks));

    useEffect(() => {
        setPools(getSessionPools(characterId, resourceTracks));
    }, [characterId, resourceTracks]);

    const persist = useCallback(
        (next) => {
            if (!characterId) return;
            setSessionPools(characterId, next);
            setPools(next);
        },
        [characterId]
    );

    const setTrack = useCallback(
        (trackKey, partial) => {
            if (!characterId) return;
            const track = resourceTracks.find((t) => t.key === trackKey);
            const max = Math.max(track?.maxDefault ?? (trackKey === "strain" ? 5 : 3), 1);
            setPools((prev) => {
                const base = prev[trackKey] || { current: 0 };
                const merged = { ...base, ...partial };
                if (typeof merged.current === "number") {
                    merged.current = Math.min(Math.max(merged.current, 0), max);
                }
                const next = { ...prev, [trackKey]: merged };
                setSessionPools(characterId, next);
                return next;
            });
        },
        [characterId, resourceTracks]
    );

    return { pools, setTrack, persist };
}
