import { getDownloadURL, ref, uploadBytes, deleteObject } from "firebase/storage";
import { storage } from "../firebaseConfig";
import * as PIXI from "pixi.js";

/** @type {Record<string, string>} path|url → resolved https (or local) url */
const assetCache = {};
/** @type {Record<string, Promise<string>>} */
const assetPromises = {};
/** @type {Record<string, HTMLImageElement>} path|url → decoded Image */
const decodedImages = {};
/** @type {Record<string, import("pixi.js").Texture>} */
const textureCache = {};
/** @type {Record<string, Promise<import("pixi.js").Texture>>} */
const texturePromises = {};
/** @type {Map<string, Set<() => void>>} */
const listeners = new Map();

function notify(path) {
    const set = listeners.get(path);
    if (!set) return;
    for (const cb of set) {
        try { cb(); } catch { /* ignore subscriber errors */ }
    }
}

function rememberUrl(path, url) {
    if (!path || !url) return url;
    assetCache[path] = url;
    assetCache[url] = url;
    notify(path);
    if (path !== url) notify(url);
    return url;
}

function rememberDecoded(path, url, img) {
    if (!img) return;
    if (path) decodedImages[path] = img;
    if (url) decodedImages[url] = img;
}

function isDirectUrl(path) {
    return (
        path.startsWith("http://")
        || path.startsWith("https://")
        || path.startsWith("/")
        || path.startsWith("data:")
        || path.startsWith("blob:")
    );
}

/**
 * Subscribe to cache updates for a path (useSyncExternalStore-compatible).
 * @param {string|null|undefined} path
 * @param {() => void} onStoreChange
 */
export function subscribeAssetUrl(path, onStoreChange) {
    if (!path) return () => {};

    let set = listeners.get(path);
    if (!set) {
        set = new Set();
        listeners.set(path, set);
    }
    set.add(onStoreChange);
    return () => {
        set.delete(onStoreChange);
        if (set.size === 0) listeners.delete(path);
    };
}

export function getCachedUrl(path) {
    if (!path) return undefined;
    return assetCache[path];
}

/** True when the browser has a decoded Image for this path/url. */
export function isImageDecoded(path) {
    if (!path) return false;
    const img = decodedImages[path] || decodedImages[assetCache[path]];
    return Boolean(img?.complete);
}

export function getDecodedImage(path) {
    if (!path) return null;
    return decodedImages[path] || decodedImages[assetCache[path]] || null;
}

/**
 * Decode into an HTMLImageElement and keep it for sync reuse.
 * @param {string} url
 * @param {string} [cacheKey] — usually the storage path
 */
export function preloadImage(url, cacheKey = url) {
    if (!url) return Promise.reject(new Error("URL vacía"));

    const existing = decodedImages[cacheKey] || decodedImages[url];
    if (existing?.complete) {
        rememberUrl(cacheKey, url);
        return Promise.resolve(url);
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = async () => {
            try {
                if (img.decode) await img.decode();
            } catch { /* decode optional */ }
            rememberUrl(cacheKey, url);
            rememberDecoded(cacheKey, url, img);
            resolve(url);
        };
        img.onerror = () => reject(new Error(`No se pudo precargar imagen: ${url}`));
        img.src = url;
    });
}

export async function loadFirebaseAsset(path) {
    if (!path) throw new Error("Asset path vacío");
    if (assetCache[path]) return assetCache[path];
    if (assetPromises[path]) return assetPromises[path];

    assetPromises[path] = (async () => {
        if (isDirectUrl(path)) {
            return rememberUrl(path, path);
        }

        const storageRef = ref(storage, path);
        const url = await getDownloadURL(storageRef);
        return rememberUrl(path, url);
    })();

    try {
        return await assetPromises[path];
    } catch (error) {
        delete assetPromises[path];
        throw error instanceof Error
            ? error
            : new Error(`Asset no encontrado en Storage: ${path}`);
    }
}

/**
 * Resolve Storage/HTTP path → URL and decode in browser cache.
 * Safe to call many times; deduped.
 * @param {string|null|undefined} path
 * @param {{ pixi?: boolean }} [opts] — also warm PIXI texture when true
 */
export async function warmAsset(path, opts = {}) {
    if (!path) return null;
    try {
        const url = await loadFirebaseAsset(path);
        await preloadImage(url, path);
        if (opts.pixi) {
            await loadTexture(path).catch(() => null);
        }
        return url;
    } catch (err) {
        console.warn(`warmAsset falló: ${path}`, err);
        notify(path);
        return null;
    }
}

/**
 * Warm token + portrait paths for a list of characters (DOM decode).
 * @param {Array<{ tokenImageUrl?: string, imageUrl?: string, name?: string }|null|undefined>} characters
 * @param {{ pixi?: boolean }} [opts]
 */
export async function warmCharacterAssets(characters, opts = {}) {
    const paths = new Set();
    for (const char of characters || []) {
        if (!char) continue;
        if (char.tokenImageUrl) paths.add(char.tokenImageUrl);
        if (char.imageUrl) paths.add(char.imageUrl);
    }
    await Promise.all([...paths].map((p) => warmAsset(p, opts)));
}

export async function loadTexture(path) {
    if (textureCache[path]) {
        return textureCache[path];
    }

    if (texturePromises[path]) {
        return texturePromises[path];
    }

    texturePromises[path] = (async () => {
        const url = await loadFirebaseAsset(path);
        await preloadImage(url, path);
        const texture = await PIXI.Assets.load(url);

        textureCache[path] = texture;
        return texture;
    })();

    return texturePromises[path];
}

export const uploadCharacterImage = async (characterId, file) => {
    const storageRef = ref(storage, `characters/${characterId}_${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    rememberUrl(snapshot.ref.fullPath, downloadURL);
    await preloadImage(downloadURL, snapshot.ref.fullPath).catch(() => null);
    return { url: downloadURL, path: snapshot.ref.fullPath };
};

export const uploadLocationImage = async (locationId, file) => {
    const storageRef = ref(storage, `locations/${locationId}_${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    rememberUrl(snapshot.ref.fullPath, downloadURL);
    await preloadImage(downloadURL, snapshot.ref.fullPath).catch(() => null);
    return { url: downloadURL, path: snapshot.ref.fullPath };
};

/** Upload a campaign map image. Returns { url, path }. */
export async function uploadMapImage(campaignId, file) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeName = file.name.replace(/[^a-z0-9._-]/gi, "_").slice(0, 48) || `map.${ext}`;
    const path = `maps/${campaignId || "shared"}/${Date.now()}_${safeName}`;
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    rememberUrl(path, downloadURL);
    await preloadImage(downloadURL, path).catch(() => null);
    return { url: downloadURL, path: snapshot.ref.fullPath };
}

export const deleteStorageFile = async (path) => {
    if (!path) return;
    try {
        const storageRef = ref(storage, path);
        await deleteObject(storageRef);
    } catch (e) {
        if (e?.code !== "storage/object-not-found") throw e;
    }
};

export function getCachedTexture(path) {
    return textureCache[path];
}
