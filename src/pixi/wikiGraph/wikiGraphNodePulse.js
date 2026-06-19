/**
 * Reusable neural-network pulse animation for selected wiki graph nodes.
 * Attach to a node container; detach when selection changes or node is destroyed.
 */

import * as PIXI from "pixi.js";
import { NODE_RADIUS_SELECTED } from "./wikiGraphTypes";

/** @typedef {typeof WIKI_NODE_PULSE_PRESET} WikiNodePulsePreset */

export const WIKI_NODE_PULSE_PRESET = {
    rings: 2,
    baseRadius: NODE_RADIUS_SELECTED + 6,
    ringSpacing: 10,
    pulseDuration: 1.4,
    alphaMin: 0.08,
    alphaMax: 0.45,
    scaleMin: 1.0,
    scaleMax: 1.35,
};

const PULSE_KEY = Symbol("wikiNodePulse");

/**
 * @param {number} color
 * @param {WikiNodePulsePreset} preset
 */
function createPulseRings(color, preset) {
    const container = new PIXI.Container();
    const rings = [];

    for (let i = 0; i < preset.rings; i++) {
        const gfx = new PIXI.Graphics();
        const radius = preset.baseRadius + i * preset.ringSpacing;
        gfx.setStrokeStyle({ width: 1.5, color, alpha: preset.alphaMax });
        gfx.circle(0, 0, radius);
        gfx.stroke();
        container.addChild(gfx);
        rings.push({ gfx, phase: (i / preset.rings) * Math.PI * 2 });
    }

    return { container, rings };
}

/**
 * @param {PIXI.Application} app
 * @param {PIXI.Container} nodeContainer
 * @param {number} color
 * @param {Partial<WikiNodePulsePreset>} [presetOverrides]
 */
export function attachNodePulse(app, nodeContainer, color, presetOverrides = {}) {
    if (!app?.ticker || !nodeContainer) return;

    const preset = { ...WIKI_NODE_PULSE_PRESET, ...presetOverrides };
    detachNodePulse(app, nodeContainer);

    const { container, rings } = createPulseRings(color, preset);
    nodeContainer.addChildAt(container, 0);

    let elapsed = 0;
    const tick = (ticker) => {
        elapsed += ticker.deltaMS / 1000;
        const cycle = (elapsed % preset.pulseDuration) / preset.pulseDuration;

        for (const { gfx, phase } of rings) {
            const t = (cycle + phase / (Math.PI * 2)) % 1;
            const wave = (Math.sin(t * Math.PI * 2) + 1) / 2;
            gfx.alpha = preset.alphaMin + wave * (preset.alphaMax - preset.alphaMin);
            const scale = preset.scaleMin + wave * (preset.scaleMax - preset.scaleMin);
            gfx.scale.set(scale);
        }
    };

    app.ticker.add(tick);
    nodeContainer[PULSE_KEY] = { container, tick };
}

/**
 * @param {PIXI.Application} app
 * @param {PIXI.Container} nodeContainer
 */
export function detachNodePulse(app, nodeContainer) {
    const pulse = nodeContainer?.[PULSE_KEY];
    if (!pulse) return;

    app?.ticker?.remove(pulse.tick);
    if (pulse.container.parent) {
        pulse.container.parent.removeChild(pulse.container);
    }
    pulse.container.destroy({ children: true });
    delete nodeContainer[PULSE_KEY];
}

/**
 * @param {PIXI.Application} app
 * @param {PIXI.Container} nodeLayer
 */
export function detachAllNodePulses(app, nodeLayer) {
    if (!nodeLayer?.children?.length) return;
    for (const child of nodeLayer.children) {
        detachNodePulse(app, child);
    }
}
