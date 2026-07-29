import { useState, useEffect, useCallback, useRef } from "react";
import { useSelector } from "react-redux";
import { getSessionPools, setSessionPools } from "../utils/characterSessionPools";
import { updateCharacterSessionPools } from "../../firebase/services/gameService";

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

function mergeRemoteIntoTracks(characterId, resourceTracks, remoteEntry) {
    const local = getSessionPools(characterId, resourceTracks);
    if (!remoteEntry || typeof remoteEntry !== "object") return local;
    const out = { ...local };
    (resourceTracks || []).forEach((track) => {
        const remoteTrack = remoteEntry[track.key];
        if (remoteTrack && typeof remoteTrack === "object" && "current" in remoteTrack) {
            const max = Math.max(track.maxDefault ?? 3, 1);
            out[track.key] = {
                ...out[track.key],
                ...remoteTrack,
                current: Math.min(Math.max(Number(remoteTrack.current) || 0, 0), max),
            };
        }
    });
    return out;
}

/**
 * Session combat pools (HP / Effort).
 * - Always mirrored to localStorage for offline resilience.
 * - When campaignId is set, also sync via game/{campaignId}.sessionPools for the table/DM.
 */
export function useCharacterSessionPools(characterId, resourceTracks, options = {}) {
    const campaignId = options.campaignId ?? null;
    const remoteAll = useSelector((s) => s.game?.sessionPools ?? {});
    const remoteEntry = characterId ? remoteAll[characterId] : null;

    const [pools, setPools] = useState(() =>
        mergeRemoteIntoTracks(characterId, resourceTracks, remoteEntry)
    );
    const tracksRef = useRef(resourceTracks);
    tracksRef.current = resourceTracks;
    const sig = tracksSignature(resourceTracks);
    const writingRef = useRef(false);
    /** Last value mirrored to localStorage, to skip redundant writes. */
    const mirroredRef = useRef(null);
    const poolsRef = useRef(pools);
    poolsRef.current = pools;

    useEffect(() => {
        const next = mergeRemoteIntoTracks(characterId, tracksRef.current, remoteEntry);
        setPools((prev) => (poolsEqual(prev, next) ? prev : next));
        // `remoteEntry` gets a fresh identity on every game-doc snapshot (token
        // moves included), so only touch localStorage when the values changed.
        if (characterId && !poolsEqual(mirroredRef.current, next)) {
            mirroredRef.current = next;
            setSessionPools(characterId, next);
        }
    }, [characterId, sig, remoteEntry]);

    const persistRemote = useCallback(
        (next) => {
            if (!campaignId || !characterId) return;
            writingRef.current = true;
            updateCharacterSessionPools(campaignId, characterId, next)
                .catch((e) => console.warn("[sessionPools] remote write failed", e))
                .finally(() => {
                    writingRef.current = false;
                });
        },
        [campaignId, characterId]
    );

    const commit = useCallback(
        (next) => {
            poolsRef.current = next;
            mirroredRef.current = next;
            setSessionPools(characterId, next);
            setPools(next);
            persistRemote(next);
        },
        [characterId, persistRemote]
    );

    const persist = useCallback(
        (next) => {
            if (!characterId) return;
            commit(next);
        },
        [characterId, commit]
    );

    const setTrack = useCallback(
        (trackKey, partial) => {
            if (!characterId) return;
            const tracks = tracksRef.current || [];
            const track = tracks.find((t) => t.key === trackKey);
            const max = Math.max(track?.maxDefault ?? 3, 1);
            // Derive outside the state updater: updaters must stay pure, and in
            // StrictMode a double invocation here fired two Firestore writes.
            const prev = poolsRef.current || {};
            const base = prev[trackKey] || { current: 0 };
            const merged = { ...base, ...partial };
            if (typeof merged.current === "number") {
                merged.current = Math.min(Math.max(merged.current, 0), max);
            }
            commit({ ...prev, [trackKey]: merged });
        },
        [characterId, commit]
    );

    return { pools, setTrack, persist };
}
