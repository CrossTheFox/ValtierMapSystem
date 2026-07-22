import { useState, useEffect, useCallback, useRef } from "react";
import { getSessionPools, setSessionPools } from "../utils/characterSessionPools";

function tracksSignature(resourceTracks) {
    if (!resourceTracks?.length) return "";
    return resourceTracks
        .map((t) => `${t.key}:${t.maxDefault ?? ""}:${t.defaultFull ? 1 : 0}:${t.stateKey || ""}`)
        .join("|");
}

function poolsEqual(a, b) {
    if (a === b) return true;
    if (!a || !b) return false;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const k of keysA) {
        const pa = a[k];
        const pb = b[k];
        if (!pb) return false;
        if (pa.current !== pb.current) return false;
        const sk = Object.keys(pa);
        if (sk.length !== Object.keys(pb).length) return false;
        for (const f of sk) {
            if (pa[f] !== pb[f]) return false;
        }
    }
    return true;
}

/**
 * Effort (and future tracks): session-only, persisted in localStorage per character.
 * Max comes from resourceTracks (stat system), not from Firestore.
 */
export function useCharacterSessionPools(characterId, resourceTracks) {
    const [pools, setPools] = useState(() => getSessionPools(characterId, resourceTracks));
    const tracksRef = useRef(resourceTracks);
    tracksRef.current = resourceTracks;
    const sig = tracksSignature(resourceTracks);

    useEffect(() => {
        const next = getSessionPools(characterId, tracksRef.current);
        setPools((prev) => (poolsEqual(prev, next) ? prev : next));
    }, [characterId, sig]);

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
            const tracks = tracksRef.current || [];
            const track = tracks.find((t) => t.key === trackKey);
            const max = Math.max(track?.maxDefault ?? 3, 1);
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
        [characterId]
    );

    return { pools, setTrack, persist };
}
