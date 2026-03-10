import { getDownloadURL, ref } from "firebase/storage";
import { storage } from "../firebaseConfig";
import * as PIXI from "pixi.js";

const assetCache = {};
const textureCache = {};
const texturePromises = {};

export function preloadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = url;

        img.onload = async () => {
            try {
                await img.decode(); // 🔥 fuerza decode
            } catch {}

            resolve(url);
        };

        img.onerror = reject;
    });
}

export async function loadFirebaseAsset(path) {
    if (assetCache[path]) return assetCache[path];

    const storageRef = ref(storage, path);
    const url = await getDownloadURL(storageRef);

    assetCache[path] = url;
    return url;
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
        const texture = await PIXI.Assets.load(url);

        textureCache[path] = texture;
        return texture;
    })();

    return texturePromises[path];
}

export function getCachedUrl(path) {
    return assetCache[path];
}

export function getCachedTexture(path) {
    return textureCache[path];
}