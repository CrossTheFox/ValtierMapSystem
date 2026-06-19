/** Live wave timing — Pixi ticker, no React setState. */
export const PROPAGATION_WAVE_MS = 900;

/** @param {Array<{ nodeIds?: string[] }>|undefined} waves */
export function wavesSignature(waves) {
    if (!waves?.length) return "0";
    return waves.map((w, i) => `${i}:${w.nodeIds?.length ?? 0}`).join("|");
}

/**
 * @param {object|null} prop
 * @param {{ waveIndex: number, elapsedMs: number, wavesSig: string, lastParticleWave: number }} liveAnim
 */
export function buildEffectivePropagation(prop, liveAnim) {
    if (!prop) return null;

    const isLive = prop.mode === "live" && prop.active;
    if (!isLive || !prop.waves?.length) return prop;

    const w = liveAnim.waveIndex;
    const litNodeIds = [];
    for (let i = 0; i <= w; i++) {
        for (const id of prop.waves[i]?.nodeIds ?? []) litNodeIds.push(id);
    }
    return {
        ...prop,
        currentWave: w,
        litNodeIds: [...new Set(litNodeIds)],
    };
}

/**
 * Advance live wave index on elapsed time.
 * @returns {boolean} true if wave index changed
 */
export function tickLivePropagation(prop, liveAnim, deltaMs) {
    if (!prop || prop.mode !== "live" || !prop.active || !prop.waves?.length) {
        return false;
    }

    const sig = wavesSignature(prop.waves);
    if (sig !== liveAnim.wavesSig) {
        liveAnim.wavesSig = sig;
        liveAnim.waveIndex = 0;
        liveAnim.elapsedMs = 0;
        liveAnim.lastParticleWave = -1;
        return true;
    }

    liveAnim.elapsedMs += deltaMs;
    if (liveAnim.elapsedMs < PROPAGATION_WAVE_MS) return false;

    liveAnim.elapsedMs = 0;
    const max = prop.waves.length - 1;
    if (liveAnim.waveIndex >= max) return false;

    liveAnim.waveIndex += 1;
    return true;
}

/** @param {object|null} effectiveProp */
export function propagationRenderKey(effectiveProp, selectedEntityId) {
    if (!effectiveProp) return "none";
    const w = effectiveProp.currentWave ?? -1;
    return `${effectiveProp.mode}:${effectiveProp.active}:${w}:${wavesSignature(effectiveProp.waves)}:${selectedEntityId ?? ""}`;
}
