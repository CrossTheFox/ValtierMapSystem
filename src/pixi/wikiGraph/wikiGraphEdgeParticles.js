/**
 * Animated circular particles traveling along graph edges during AI propagation.
 */

import * as PIXI from "pixi.js";

export const EDGE_PARTICLE_PRESET = {
    particlesPerEdge: 3,
    particleRadius: 3.5,
    travelDuration: 0.85,
    stagger: 0.12,
    alpha: 0.9,
};

const LAYER_KEY = Symbol("edgePropagation");

/**
 * @param {PIXI.Container} particleLayer
 */
export function detachEdgePropagation(app, particleLayer) {
    const state = particleLayer?.[LAYER_KEY];
    if (!state) return;

    app?.ticker?.remove(state.tick);
    for (const entry of state.particles) {
        const gfx = entry?.gfx ?? entry;
        if (!gfx || typeof gfx.destroy !== "function") continue;
        if (gfx.parent) gfx.parent.removeChild(gfx);
        gfx.destroy();
    }
    delete particleLayer[LAYER_KEY];
}

/**
 * @param {PIXI.Application} app
 * @param {PIXI.Container} particleLayer
 * @param {{ fromId: string, toId: string }[]} edges
 * @param {Map<string, {x:number,y:number}>} posMap
 * @param {(entityId: string) => number} colorForEntity
 * @param {Partial<typeof EDGE_PARTICLE_PRESET>} [presetOverrides]
 */
export function attachEdgePropagation(
    app,
    particleLayer,
    edges,
    posMap,
    colorForEntity,
    presetOverrides = {}
) {
    if (!app?.ticker || !particleLayer || !edges?.length) {
        detachEdgePropagation(app, particleLayer);
        return;
    }

    const preset = { ...EDGE_PARTICLE_PRESET, ...presetOverrides };
    detachEdgePropagation(app, particleLayer);

    const particles = [];

    for (const { fromId, toId } of edges) {
        const from = posMap.get(fromId);
        const to = posMap.get(toId);
        if (!from || !to) continue;

        const color = colorForEntity(toId) ?? 0xffffff;

        for (let i = 0; i < preset.particlesPerEdge; i++) {
            const gfx = new PIXI.Graphics();
            gfx.circle(0, 0, preset.particleRadius);
            gfx.fill({ color, alpha: preset.alpha });
            gfx.position.set(from.x, from.y);
            particleLayer.addChild(gfx);

            particles.push({
                gfx,
                fromX: from.x,
                fromY: from.y,
                toX: to.x,
                toY: to.y,
                phase: i * preset.stagger,
            });
        }
    }

    let elapsed = 0;
    const tick = (ticker) => {
        elapsed += ticker.deltaMS / 1000;

        for (const p of particles) {
            const cycle = ((elapsed + p.phase) % preset.travelDuration) / preset.travelDuration;
            const t = cycle < 0.5
                ? 2 * cycle * cycle
                : 1 - Math.pow(-2 * cycle + 2, 2) / 2;

            p.gfx.position.set(
                p.fromX + (p.toX - p.fromX) * t,
                p.fromY + (p.toY - p.fromY) * t
            );
            p.gfx.alpha = preset.alpha * (0.55 + 0.45 * Math.sin(cycle * Math.PI));
        }
    };

    app.ticker.add(tick);
    particleLayer[LAYER_KEY] = { tick, particles };
}
