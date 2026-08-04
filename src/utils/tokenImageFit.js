/** @typedef {{ zoom: number, x: number, y: number }} TokenCrop */

/** @type {TokenCrop} */
export const DEFAULT_TOKEN_CROP = Object.freeze({ zoom: 1, x: 0.5, y: 0.5 });

/**
 * @param {unknown} raw
 * @returns {TokenCrop}
 */
export function normalizeTokenCrop(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    const zoom = Number(src.zoom);
    const x = Number(src.x);
    const y = Number(src.y);
    return {
        zoom: Number.isFinite(zoom) ? Math.min(3, Math.max(0.6, zoom)) : DEFAULT_TOKEN_CROP.zoom,
        x: Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : DEFAULT_TOKEN_CROP.x,
        y: Number.isFinite(y) ? Math.min(1, Math.max(0, y)) : DEFAULT_TOKEN_CROP.y,
    };
}

/**
 * Stable key so token markers rebuild when URL or crop changes.
 * @param {{ tokenImageUrl?: string, imageUrl?: string, tokenCrop?: unknown }|null|undefined} char
 */
export function tokenVisualKey(char) {
    const url = char?.tokenImageUrl || char?.imageUrl || "";
    const c = normalizeTokenCrop(char?.tokenCrop);
    return `${url}|z${c.zoom.toFixed(3)}|x${c.x.toFixed(3)}|y${c.y.toFixed(3)}`;
}

/**
 * Cover-fit a PIXI sprite into a circle without stretching.
 * Focal point (crop.x/y in 0–1) lands at the circle center; zoom > 1 zooms in.
 *
 * @param {import("pixi.js").Sprite} sprite — anchor should be 0.5
 * @param {number} diameter
 * @param {unknown} [crop]
 */
export function applyTokenImageFit(sprite, diameter, crop) {
    const tex = sprite?.texture;
    const tw = tex?.width || 0;
    const th = tex?.height || 0;
    if (!tw || !th || !diameter) return;

    const { zoom, x, y } = normalizeTokenCrop(crop);
    const cover = Math.max(diameter / tw, diameter / th) * zoom;
    const w = tw * cover;
    const h = th * cover;
    sprite.width = w;
    sprite.height = h;
    // Shift so focal point sits at (0,0) under anchor 0.5
    sprite.x = -(x - 0.5) * w;
    sprite.y = -(y - 0.5) * h;
}

/**
 * CSS helpers for circular previews that match map tokens.
 * @param {unknown} [crop]
 */
export function tokenCropCss(crop) {
    const { zoom, x, y } = normalizeTokenCrop(crop);
    return {
        objectFit: "cover",
        objectPosition: `${x * 100}% ${y * 100}%`,
        transform: zoom === 1 ? undefined : `scale(${zoom})`,
        transformOrigin: `${x * 100}% ${y * 100}%`,
    };
}
