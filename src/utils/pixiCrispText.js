import * as PIXI from "pixi.js";

const MAX_RESOLUTION = 3;

/**
 * Screen-space crisp Text: counter-scales with viewport zoom so glyph
 * rasterization stays near device pixels (sharp at any zoom).
 *
 * @param {string} text
 * @param {ConstructorParameters<typeof PIXI.TextStyle>[0]} [styleOpts]
 * @returns {PIXI.Text}
 */
export function createCrispText(text, styleOpts = {}) {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_RESOLUTION);
    const style = new PIXI.TextStyle({
        fontFamily: "Fira Sans, Arial, sans-serif",
        fontSize: 14,
        fill: 0xffffff,
        stroke: { color: 0x000000, width: 4, join: "round" },
        align: "center",
        padding: 6,
        ...styleOpts,
    });
    const label = new PIXI.Text({
        text: text ?? "",
        style,
        resolution: dpr,
    });
    label.roundPixels = true;
    label.label = "crispText";
    return label;
}

/**
 * Keep a world-space label at constant screen size + retina resolution.
 * Optional meta on the node:
 *   `_tokenRadius` (world) + `_screenPad` (CSS px) → keeps vertical gap stable on zoom.
 *   `_anchor` "below" | "above" (default below for names, above for speech).
 *
 * @param {PIXI.Container} node — Text or container holding crisp labels
 * @param {{ scale?: { x?: number } }|null} viewport
 */
export function syncScreenSpaceLabel(node, viewport) {
    if (!node || !viewport) return;
    const zoom = Math.max(viewport.scale?.x ?? 1, 0.05);
    const inv = 1 / zoom;
    if (node.scale.x !== inv) {
        node.scale.set(inv);
    }
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_RESOLUTION);
    syncResolutionDeep(node, dpr);

    if (typeof node._tokenRadius === "number") {
        const pad = typeof node._screenPad === "number" ? node._screenPad : 8;
        const above = node._anchor === "above";
        const worldGap = node._tokenRadius + pad * inv;
        node.y = above ? -worldGap : worldGap;
    }
}

/**
 * @param {PIXI.Container|PIXI.Text} node
 * @param {number} resolution
 */
function syncResolutionDeep(node, resolution) {
    if (!node) return;
    if (node instanceof PIXI.Text) {
        if (Math.abs((node.resolution || 1) - resolution) > 0.05) {
            node.resolution = resolution;
        }
        return;
    }
    if (node.children?.length) {
        for (const child of node.children) {
            syncResolutionDeep(child, resolution);
        }
    }
}

/**
 * Attach zoom/move listeners so labels stay crisp. Returns disposer.
 * @param {import("pixi-viewport").Viewport} viewport
 * @param {() => void} onSync
 */
export function bindViewportLabelSync(viewport, onSync) {
    if (!viewport || typeof onSync !== "function") return () => {};
    const handler = () => onSync();
    viewport.on("zoomed", handler);
    viewport.on("moved", handler);
    onSync();
    return () => {
        viewport.off("zoomed", handler);
        viewport.off("moved", handler);
    };
}
