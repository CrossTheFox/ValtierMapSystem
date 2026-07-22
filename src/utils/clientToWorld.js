/**
 * Convert a DOM client coordinate to pixi-viewport world space.
 * Uses Pixi's EventSystem mapping so devicePixelRatio / canvas CSS size stay correct.
 *
 * @param {import("pixi-viewport").Viewport | null} viewport
 * @param {number} clientX
 * @param {number} clientY
 * @returns {{ x: number, y: number } | null}
 */
export function clientToWorld(viewport, clientX, clientY) {
    if (!viewport || viewport.destroyed) return null;

    const global = mapClientToGlobal(viewport, clientX, clientY);
    if (!global) return null;

    const world = viewport.toWorld(global.x, global.y);
    if (!world || Number.isNaN(world.x) || Number.isNaN(world.y)) return null;
    return { x: world.x, y: world.y };
}

/** Map window client coords → Pixi global (screen) coords. */
function mapClientToGlobal(viewport, clientX, clientY) {
    const events = viewport.options?.events;
    if (events?.mapPositionToPoint) {
        const point = { x: 0, y: 0 };
        events.mapPositionToPoint(point, clientX, clientY);
        return point;
    }

    const canvas =
        events?.domElement
        || viewport.options?.events?.domElement
        || document.querySelector("canvas");
    if (!canvas?.getBoundingClientRect) return null;

    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    // Match Pixi EventSystem: CSS → buffer → resolution
    const resolution = Number(viewport.options?.events?.renderer?.resolution)
        || Number(window.devicePixelRatio)
        || 1;
    const x = ((clientX - rect.left) * (canvas.width / rect.width)) / resolution;
    const y = ((clientY - rect.top) * (canvas.height / rect.height)) / resolution;
    return { x, y };
}
