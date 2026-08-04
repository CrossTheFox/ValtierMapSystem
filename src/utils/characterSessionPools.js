const STORAGE_KEY = "valtier_character_session_pools_v1";

/**
 * The HUD reads pools during render (once per pinned character), so parsing the
 * whole blob every time was a blocking cost on unrelated re-renders.
 */
let cache = null;

if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
        if (!e.key || e.key === STORAGE_KEY) cache = null;
    });
}

function readAll() {
    if (cache) return cache;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        cache = typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch {
        cache = {};
    }
    return cache;
}

function writeAll(data) {
    cache = data;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn("[characterSessionPools] localStorage write failed", e);
    }
}

function defaultPoolForTrack(track) {
    const stateKey = track.stateKey;
    const base = { current: 0 };
    if (stateKey) base[stateKey] = false;
    return base;
}

/**
 * @param {string} characterId
 * @param {Array<{ key: string, maxDefault?: number, stateKey?: string }>} resourceTracks
 */
export function getSessionPools(characterId, resourceTracks) {
    if (!characterId) return {};
    const all = readAll();
    const stored = all[characterId] && typeof all[characterId] === "object" ? all[characterId] : {};
    const out = {};
    (resourceTracks || []).forEach((track) => {
        const max = Math.max(
            track.maxDefault ?? 3,
            1
        );
        const prev = stored[track.key] && typeof stored[track.key] === "object" ? stored[track.key] : {};
        const hasStoredCurrent = Object.prototype.hasOwnProperty.call(prev, "current");
        const fallback = track.defaultFull ? max : 0;
        const current = Math.min(
            Math.max(hasStoredCurrent ? Number(prev.current) || 0 : fallback, 0),
            max
        );
        const pool = { ...defaultPoolForTrack(track), ...prev, current };
        if (track.stateKey) pool[track.stateKey] = !!prev[track.stateKey];
        out[track.key] = pool;
    });
    return out;
}

/**
 * @param {string} characterId
 * @param {Record<string, { current?: number } & Record<string, unknown>>} pools
 */
export function setSessionPools(characterId, pools) {
    if (!characterId) return;
    const all = readAll();
    all[characterId] = pools;
    writeAll(all);
}

/**
 * Merge updates for one track and persist.
 * @param {string} characterId
 * @param {Array<{ key: string, maxDefault?: number, stateKey?: string }>} resourceTracks
 * @param {string} trackKey
 * @param {Record<string, unknown>} partial
 */
export function patchSessionPool(characterId, resourceTracks, trackKey, partial) {
    const prev = getSessionPools(characterId, resourceTracks);
    const track = resourceTracks.find((t) => t.key === trackKey);
    const max = track?.maxDefault ?? 0;
    const merged = { ...prev[trackKey], ...partial };
    if (typeof merged.current === "number") {
        merged.current = Math.min(Math.max(merged.current, 0), max);
    }
    prev[trackKey] = merged;
    setSessionPools(characterId, prev);
    return prev;
}
