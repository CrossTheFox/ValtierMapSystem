/**
 * wikiGraphLayout.js
 *
 * Wraps d3-force to compute node positions for the wiki relation graph.
 * Returns a one-shot snapshot of positions (does not run a continuous simulation).
 *
 * Node IDs come from wikiEntity.id; edges from entityRelation { fromEntityId, toEntityId }.
 */

import {
    forceSimulation,
    forceLink,
    forceManyBody,
    forceCenter,
    forceCollide,
    forceX,
    forceY,
} from "d3-force";

const NODE_RADIUS = 36;
const TICK_COUNT = 300;

/**
 * Run a force simulation and return stabilized node positions.
 *
 * @param {object[]} entities - wiki entities (need id, entityType)
 * @param {object[]} relations - entity relations (need fromEntityId, toEntityId, id)
 * @param {{ width: number, height: number }} bounds - canvas size
 * @returns {{ nodes: Array<{id, x, y}>, links: Array<{source, target, id, relationType, label}> }}
 */
export function computeGraphLayout(entities, relations, { width = 1200, height = 800 } = {}) {
    const nodeIds = new Set(entities.map((e) => e.id));

    // Build link list, filter out any edges pointing at unknown nodes
    const links = relations
        .filter((r) => nodeIds.has(r.fromEntityId) && nodeIds.has(r.toEntityId))
        .map((r) => ({
            source: r.fromEntityId,
            target: r.toEntityId,
            id: r.id,
            relationType: r.relationType,
            label: r.label,
            strength: r.strength ?? 0,
        }));

    const nodes = entities.map((e) => ({
        id: e.id,
        // Random initial position spread across canvas
        x: (Math.random() - 0.5) * width * 0.8 + width / 2,
        y: (Math.random() - 0.5) * height * 0.8 + height / 2,
        entityType: e.entityType,
    }));

    const sim = forceSimulation(nodes)
        .force(
            "link",
            forceLink(links)
                .id((d) => d.id)
                .distance(200)
                .strength(0.5)
        )
        .force("charge", forceManyBody().strength(-420))
        .force("center", forceCenter(width / 2, height / 2))
        .force("collide", forceCollide(NODE_RADIUS + 22))
        .force("x", forceX(width / 2).strength(0.025))
        .force("y", forceY(height / 2).strength(0.025))
        .stop();

    // Run synchronously for TICK_COUNT iterations
    for (let i = 0; i < TICK_COUNT; i++) {
        sim.tick();
    }

    return { nodes, links };
}
