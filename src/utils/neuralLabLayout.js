/**
 * Pure helpers for campaign Neural Lab saved card positions.
 */

/**
 * @param {unknown} raw
 * @returns {Record<string, { x: number, y: number }>}
 */
export function normalizeNeuralLabPositions(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out = {};
    for (const [id, v] of Object.entries(raw)) {
        if (!id || !v || typeof v !== "object" || Array.isArray(v)) continue;
        const x = Number(v.x);
        const y = Number(v.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        out[id] = { x: Math.round(x), y: Math.round(y) };
    }
    return out;
}

/**
 * @param {unknown} data campaign doc data
 * @returns {{ positions: Record<string, { x: number, y: number }> }}
 */
export function parseNeuralLabLayout(data) {
    const layout = data?.neuralLabLayout;
    if (!layout || typeof layout !== "object") {
        return { positions: {} };
    }
    return {
        positions: normalizeNeuralLabPositions(layout.positions),
    };
}
