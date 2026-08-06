import { useEffect, useSyncExternalStore } from "react";
import {
    getCachedUrl,
    subscribeAssetUrl,
    warmAsset,
} from "../../firebase/services/assetLoader";

function isDirectUrl(path) {
    return (
        path.startsWith("http://")
        || path.startsWith("https://")
        || path.startsWith("/")
        || path.startsWith("data:")
        || path.startsWith("blob:")
    );
}

export { isDirectUrl };

/**
 * Resolved image URL for a Storage path / https URL.
 * Sync when already warmed by preloadWorldAssets / warmCharacterAssets;
 * otherwise warms in the background and updates when ready.
 * Direct http(s)/data/blob paths resolve immediately (no wait for cache).
 *
 * @param {string|null|undefined} path
 * @returns {string|null}
 */
export function useAssetUrl(path) {
    const url = useSyncExternalStore(
        (onStoreChange) => {
            if (!path) return () => {};
            return subscribeAssetUrl(path, onStoreChange);
        },
        () => (path ? getCachedUrl(path) ?? null : null),
        () => null,
    );

    useEffect(() => {
        if (!path || getCachedUrl(path)) return undefined;
        let cancelled = false;
        warmAsset(path).then((resolved) => {
            if (cancelled || resolved) return;
        });
        return () => { cancelled = true; };
    }, [path]);

    if (!path) return null;
    if (isDirectUrl(path)) return url || path;
    return url;
}
