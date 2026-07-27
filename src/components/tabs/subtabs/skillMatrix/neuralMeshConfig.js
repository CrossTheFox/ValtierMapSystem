/**
 * Neural Mesh visual / camera knobs.
 *
 * ── Quick revert (pre-viewport checkpoint) ─────────────────────────
 * Set CAMERA_MODE to "fixed" to restore the fitted elliptical layout
 * without pan/zoom (commit 90dfe7d on fix/pixi-layer-teardown).
 * Or: git revert / checkout that commit for a full rollback.
 *
 * NODE_SHAPE:
 *   - "circle" — circular node plates (default)
 *   - "rect"   — rectangular plates
 *
 * CAMERA_MODE:
 *   - "viewport" — circular world + pixi-viewport pan/zoom (default)
 *   - "fixed"    — fit-to-stage elliptical layout, no camera
 */

export const NEURAL_MESH_NODE_SHAPE = "circle";

/** @type {"viewport" | "fixed"} */
export const NEURAL_MESH_CAMERA_MODE = "viewport";

/** Fixed world used when CAMERA_MODE === "viewport" (circular orbits). */
export const NEURAL_MESH_WORLD = {
    size: 1200,
    /** Orbital radius — HTML mock uses min(w,h)*0.42; this is the world-space equivalent. */
    R: 420,
};

export function isRectNodeShape() {
    return NEURAL_MESH_NODE_SHAPE === "rect";
}

export function isViewportCamera() {
    return NEURAL_MESH_CAMERA_MODE === "viewport";
}

export function isFixedCamera() {
    return NEURAL_MESH_CAMERA_MODE === "fixed";
}
