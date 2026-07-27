/**
 * Neural Mesh visual knobs.
 *
 * NODE_SHAPE:
 *   - "circle" — all nodes are circles (current default)
 *   - "rect"   — rectangular plates (previous design; flip back if preferred)
 */
export const NEURAL_MESH_NODE_SHAPE = "circle";

export function isRectNodeShape() {
    return NEURAL_MESH_NODE_SHAPE === "rect";
}
