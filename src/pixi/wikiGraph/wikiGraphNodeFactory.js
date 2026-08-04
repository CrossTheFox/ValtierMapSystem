/**
 * wikiGraphNodeFactory.js
 *
 * Resolves the display texture for a wiki entity node in the graph.
 *
 * Fallback chain (via resolveWikiEntityImageCandidates — tries each until load works):
 *   1. wikiEntity.imageUrl
 *   2. VTT character image (linked / title match)
 *   3. VTT location image (linked / title match)
 *   4. Symbol sprite drawn with PIXI.Graphics (entity-type icon)
 */

import * as PIXI from "pixi.js";
import { loadFirebaseAsset } from "../../../firebase/services/assetLoader";
import { NODE_COLORS, NODE_SYMBOLS, NODE_RADIUS } from "./wikiGraphTypes";
import { resolveWikiEntityImageCandidates } from "../../utils/resolveWikiEntityImage";

// Module-level cache — bounded to avoid unbounded GPU memory in large wikis.
const _textureCache = new Map();
const MAX_TEXTURE_CACHE = 64;

function cacheTexture(url, tex) {
    if (_textureCache.size >= MAX_TEXTURE_CACHE && !_textureCache.has(url)) {
        const oldest = _textureCache.keys().next().value;
        _textureCache.delete(oldest);
    }
    _textureCache.set(url, tex);
}

/**
 * Load or return cached PIXI.Texture for an image URL.
 * Returns null if loading fails.
 * @param {string} url
 * @returns {Promise<PIXI.Texture|null>}
 */
async function loadTextureSafe(url) {
    if (_textureCache.has(url)) return _textureCache.get(url);
    try {
        // If it's a Firebase Storage path (not https) resolve via assetLoader
        const resolvedUrl = url.startsWith("https://") ? url : await loadFirebaseAsset(url);
        const tex = await PIXI.Assets.load(resolvedUrl);
        cacheTexture(url, tex);
        return tex;
    } catch {
        cacheTexture(url, null);
        return null;
    }
}

/**
 * Draw a symbolic fallback sprite for an entity type using PIXI.Graphics + Text.
 * @param {string} entityType
 * @returns {PIXI.Container}
 */
export function drawSymbolNode(entityType) {
    const container = new PIXI.Container();
    const color = NODE_COLORS[entityType] ?? 0x888888;
    const symbol = NODE_SYMBOLS[entityType] ?? "?";

    const g = new PIXI.Graphics();
    g.setFillStyle({ color: 0x0a0a12, alpha: 0.92 });
    g.circle(0, 0, NODE_RADIUS);
    g.fill();
    g.setFillStyle({ color, alpha: 0.08 });
    g.circle(0, 0, NODE_RADIUS);
    g.fill();
    g.setStrokeStyle({ width: 1.8, color, alpha: 0.9 });
    g.circle(0, 0, NODE_RADIUS);
    g.stroke();
    container.addChild(g);

    const text = new PIXI.Text({
        text: symbol,
        style: new PIXI.TextStyle({
            fontSize: 18,
            fill: color,
            fontFamily: "'Fira Code', monospace",
            align: "center",
        }),
    });
    text.anchor.set(0.5, 0.5);
    container.addChild(text);

    return container;
}

/**
 * Build a circular avatar sprite from a loaded texture.
 * Image uses contain-fit inside the circle — original aspect ratio is preserved.
 * @param {PIXI.Texture} texture
 * @param {string} entityType
 * @param {number} [radius=NODE_RADIUS]
 * @returns {PIXI.Container}
 */
function makeAvatarSprite(texture, entityType, radius = NODE_RADIUS) {
    const container = new PIXI.Container();
    const color = NODE_COLORS[entityType] ?? 0x888888;
    const innerR = radius - 2;

    const fill = new PIXI.Graphics();
    fill.setFillStyle({ color: 0x0a0a12, alpha: 0.92 });
    fill.circle(0, 0, radius);
    fill.fill();
    fill.setFillStyle({ color, alpha: 0.08 });
    fill.circle(0, 0, radius);
    fill.fill();
    container.addChild(fill);

    const mask = new PIXI.Graphics();
    mask.setFillStyle({ color: 0xffffff });
    mask.circle(0, 0, innerR);
    mask.fill();
    container.addChild(mask);

    const sprite = new PIXI.Sprite(texture);
    const texW = texture.orig?.width ?? texture.width ?? 1;
    const texH = texture.orig?.height ?? texture.height ?? 1;
    const maxDim = innerR * 2;
    const fitScale = Math.min(maxDim / texW, maxDim / texH);
    sprite.scale.set(fitScale);
    sprite.anchor.set(0.5);
    sprite.mask = mask;
    container.addChild(sprite);

    const ring = new PIXI.Graphics();
    ring.setStrokeStyle({ width: 2, color, alpha: 0.9 });
    ring.circle(0, 0, radius - 1);
    ring.stroke();
    container.addChild(ring);

    return container;
}

/**
 * Resolve the best visual representation for a node.
 * Resolves asynchronously; consumers can start with symbol and swap texture in.
 *
 * @param {object} entity - wikiEntity
 * @param {Record<string, object>} locations - world.locations (pins + nested characters)
 * @param {Record<string, object>|null} [charactersById] - campaign roster (includes null locationId)
 * @returns {Promise<"symbol"|PIXI.Container>} — "symbol" means use drawSymbolNode; otherwise ready container
 */
export async function resolveNodeVisual(entity, locations = {}, charactersById = null) {
    const candidates = resolveWikiEntityImageCandidates(entity, locations, charactersById);
    for (const imagePath of candidates) {
        const tex = await loadTextureSafe(imagePath);
        if (tex) return makeAvatarSprite(tex, entity.entityType);
    }

    return "symbol";
}
