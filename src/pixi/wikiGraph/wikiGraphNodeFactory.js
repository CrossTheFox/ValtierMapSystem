/**
 * wikiGraphNodeFactory.js
 *
 * Resolves the display texture for a wiki entity node in the graph.
 *
 * Fallback chain:
 *   1. wikiEntity.imageUrl (Firebase Storage or HTTPS URL)
 *   2. VTT character image (via assetLoader, if linkedVttCharacterId is set)
 *   3. Symbol sprite drawn with PIXI.Graphics (entity-type icon)
 */

import * as PIXI from "pixi.js";
import { loadFirebaseAsset } from "../../../firebase/services/assetLoader";
import { NODE_COLORS, NODE_SYMBOLS, NODE_RADIUS } from "./wikiGraphTypes";

// Simple LRU-ish cache (module-level; survives re-renders)
const _textureCache = new Map();

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
        _textureCache.set(url, tex);
        return tex;
    } catch {
        _textureCache.set(url, null);
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
    g.setFillStyle({ color, alpha: 0.18 });
    g.circle(0, 0, NODE_RADIUS);
    g.fill();
    g.setStrokeStyle({ width: 1.5, color, alpha: 0.85 });
    g.circle(0, 0, NODE_RADIUS);
    g.stroke();
    container.addChild(g);

    const text = new PIXI.Text({
        text: symbol,
        style: new PIXI.TextStyle({
            fontSize: 18,
            fill: color,
            fontFamily: "sans-serif",
            align: "center",
        }),
    });
    text.anchor.set(0.5, 0.5);
    container.addChild(text);

    return container;
}

/**
 * Build a circular avatar sprite from a loaded texture.
 * @param {PIXI.Texture} texture
 * @param {string} entityType
 * @returns {PIXI.Container}
 */
function makeAvatarSprite(texture, entityType) {
    const container = new PIXI.Container();

    // Circular mask
    const mask = new PIXI.Graphics();
    mask.setFillStyle({ color: 0xffffff });
    mask.circle(0, 0, NODE_RADIUS - 2);
    mask.fill();
    container.addChild(mask);

    const sprite = new PIXI.Sprite(texture);
    const size = (NODE_RADIUS - 2) * 2;
    sprite.width = size;
    sprite.height = size;
    sprite.anchor.set(0.5);
    sprite.mask = mask;
    container.addChild(sprite);

    // Ring
    const ring = new PIXI.Graphics();
    const color = NODE_COLORS[entityType] ?? 0x888888;
    ring.setStrokeStyle({ width: 2, color, alpha: 0.9 });
    ring.circle(0, 0, NODE_RADIUS - 1);
    ring.stroke();
    container.addChild(ring);

    return container;
}

/**
 * Resolve the best visual representation for a node.
 * Resolves asynchronously; consumers can start with symbol and swap texture in.
 *
 * @param {object} entity - wikiEntity
 * @param {{ [charId]: string }} vttCharacterImages - map charId → imageUrl from world.locations
 * @returns {Promise<"symbol"|PIXI.Container>} — "symbol" means use drawSymbolNode; otherwise ready container
 */
export async function resolveNodeVisual(entity, vttCharacterImages = {}) {
    // 1. Wiki-level imageUrl
    if (entity.imageUrl) {
        const tex = await loadTextureSafe(entity.imageUrl);
        if (tex) return makeAvatarSprite(tex, entity.entityType);
    }

    // 2. VTT character image
    if (entity.linkedVttCharacterId) {
        const imgUrl = vttCharacterImages[entity.linkedVttCharacterId];
        if (imgUrl) {
            const tex = await loadTextureSafe(imgUrl);
            if (tex) return makeAvatarSprite(tex, entity.entityType);
        }
    }

    // 3. Symbol fallback
    return "symbol";
}
