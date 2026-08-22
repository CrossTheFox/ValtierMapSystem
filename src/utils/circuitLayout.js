/**
 * Circuit Sync-Axis layout (Option 8).
 * Y = affinity strength (−10 top/+10… wait: +10 top, −10 bottom).
 * X = pack without AABB overlap; overflow → rank clusters.
 */

import { syncRankFromStrength } from "./syncRank.js";

const HUB_COLOR = "#00f2ea";
const MUTED_COLOR = "#aaaaaa";

export const CIRCUIT_WORLD_W = 1600;
export const CIRCUIT_WORLD_H = 1000;
export const CIRCUIT_HUB_X = 800;
export const CIRCUIT_HUB_Y = 500;

export const CIRCUIT_NODE_W = 148;
export const CIRCUIT_NODE_H = 136;
export const CIRCUIT_HUB_W = 172;
export const CIRCUIT_HUB_H = 148;
export const CIRCUIT_GAP_X = 40;
export const CIRCUIT_GAP_Y = 22;
export const CIRCUIT_STRUCT_X = 1320;
/** Extra ring distance per hop beyond the parent for outward secondary placement. */
export const CIRCUIT_HOP_RING = 170;

const RANK_ORDER = ["bonded", "allied", "neutral", "rival", "hostile"];

/**
 * @param {number} sync −10…+10
 * @returns {number} world Y (higher sync → smaller Y / top)
 */
export function syncToY(sync) {
    const s = Math.max(-10, Math.min(10, Number(sync) || 0));
    return Math.round(CIRCUIT_HUB_Y - (s / 10) * 380);
}

export function packCollides(a, b, gapX = CIRCUIT_GAP_X, gapY = CIRCUIT_GAP_Y) {
    return (
        Math.abs(a.x - b.x) < (a.w + b.w) / 2 + gapX
        && Math.abs(a.y - b.y) < (a.h + b.h) / 2 + gapY
    );
}

function intervalsForRow(y, hub, nodeW, nodeH, gapX, gapY, xMin, xMax) {
    const vertClear = (nodeH + hub.h) / 2 + gapY;
    if (Math.abs(y - hub.y) >= vertClear) {
        return [[xMin, xMax]];
    }
    const block = hub.w / 2 + gapX + nodeW / 2;
    const leftEnd = hub.x - block;
    const rightStart = hub.x + block;
    const out = [];
    if (leftEnd - xMin >= nodeW) out.push([xMin, leftEnd]);
    if (xMax - rightStart >= nodeW) out.push([rightStart, xMax]);
    return out;
}

function capacityForRow(y, hub, nodeW, nodeH, gapX, gapY, xMin, xMax) {
    const pitchX = nodeW + gapX;
    let cap = 0;
    for (const [a, b] of intervalsForRow(y, hub, nodeW, nodeH, gapX, gapY, xMin, xMax)) {
        const span = b - a;
        if (span < nodeW) continue;
        cap += Math.floor((span - nodeW) / pitchX) + 1;
    }
    return cap;
}

function placeInIntervals(nodes, y, hub, placed, dims) {
    const { nodeW, nodeH, gapX, gapY, xMin, xMax } = dims;
    const pitchX = nodeW + gapX;
    const intervals = intervalsForRow(y, hub, nodeW, nodeH, gapX, gapY, xMin, xMax);
    const slots = [];
    for (const [a, b] of intervals) {
        const span = b - a;
        if (span < nodeW) continue;
        const count = Math.floor((span - nodeW) / pitchX) + 1;
        const used = nodeW + (count - 1) * pitchX;
        const start = a + (span - used) / 2 + nodeW / 2;
        for (let i = 0; i < count; i++) {
            slots.push(Math.round(start + i * pitchX));
        }
    }
    // Prefer center-out
    slots.sort((ax, bx) => Math.abs(ax - hub.x) - Math.abs(bx - hub.x));

    const out = [];
    let si = 0;
    for (const node of nodes) {
        while (si < slots.length) {
            const x = slots[si++];
            const box = { x, y: Math.round(y), w: nodeW, h: nodeH };
            if (placed.some((p) => packCollides(box, p, gapX, gapY))) continue;
            out.push({ ...node, x: box.x, y: box.y, w: nodeW, h: nodeH });
            placed.push(box);
            break;
        }
    }
    return out;
}

/**
 * @typedef {{
 *   id: string,
 *   kind: 'hub'|'affinity'|'structural'|'secondary'|'cluster',
 *   entityId?: string,
 *   title?: string,
 *   sync?: number,
 *   rankId?: string,
 *   rankLabel?: string,
 *   rankColor?: string,
 *   relationId?: string,
 *   relationType?: string,
 *   memberIds?: string[],
 *   hop?: number,
 *   x: number,
 *   y: number,
 *   w: number,
 *   h: number,
 * }} CircuitLayoutNode
 */

/**
 * Build circuit layout.
 *
 * @param {{
 *   hub: { id: string, title?: string },
 *   affinityNodes: Array<{
 *     id: string,
 *     entityId: string,
 *     title: string,
 *     sync: number,
 *     relationId?: string,
 *     relationType?: string,
 *     imagePath?: string,
 *     avatarStatus?: string,
 *     avatarCrop?: object|null,
 *   }>,
 *   structuralNodes?: Array<{
 *     id: string,
 *     entityId: string,
 *     title: string,
 *     relationId?: string,
 *     relationType?: string,
 *     imagePath?: string,
 *   }>,
 *   secondaryNodes?: Array<{
 *     id: string,
 *     entityId: string,
 *     title: string,
 *     hop?: number,
 *     parentId?: string,
 *     imagePath?: string,
 *   }>,
 *   expandedClusterId?: string|null,
 *   showStructuralBus?: boolean,
 * }} opts
 */

function resolveParentBox(parentId, nodesById, hub) {
    if (!parentId) return hub;
    const direct = nodesById.get(parentId);
    if (direct) return direct;
    for (const n of nodesById.values()) {
        if (n.kind === "cluster" && (n.memberIds || []).includes(parentId)) return n;
    }
    return hub;
}
export function buildCircuitLayout(opts = {}) {
    const {
        hub: hubIn,
        affinityNodes = [],
        structuralNodes = [],
        secondaryNodes = [],
        expandedClusterId = null,
        showStructuralBus = false,
    } = opts;

    const nodeW = CIRCUIT_NODE_W;
    const nodeH = CIRCUIT_NODE_H;
    const gapX = CIRCUIT_GAP_X;
    const gapY = CIRCUIT_GAP_Y;
    const xMin = 160 + nodeW / 2;
    // Leave room for struct bus on the right when DM
    const xMax = showStructuralBus
        ? CIRCUIT_STRUCT_X - nodeW / 2 - 40
        : CIRCUIT_WORLD_W - 60 - nodeW / 2;

    const hub = {
        id: hubIn?.id || "hub",
        kind: "hub",
        entityId: hubIn?.id,
        title: hubIn?.title || "—",
        sync: 0,
        rankId: "hub",
        rankLabel: "ANCLA",
        rankColor: HUB_COLOR,
        x: CIRCUIT_HUB_X,
        y: CIRCUIT_HUB_Y,
        w: CIRCUIT_HUB_W,
        h: CIRCUIT_HUB_H,
        hop: 0,
    };

    // Avoid circular import of uiColors in math-only path — hardcode cyan for hub label color
    // (rankColor only used for display)
    const placed = [{ x: hub.x, y: hub.y, w: hub.w, h: hub.h }];
    /** @type {CircuitLayoutNode[]} */
    const nodes = [hub];
    /** @type {Array<{ fromId: string, toId: string, traceClass: string, structural?: boolean, secondary?: boolean }>} */
    const edges = [];

    const dims = { nodeW, nodeH, gapX, gapY, xMin, xMax };

    // Enrich affinity with ranks
    const enriched = affinityNodes.map((n) => {
        const rank = syncRankFromStrength(n.sync);
        return {
            ...n,
            kind: "affinity",
            rankId: rank.id,
            rankLabel: rank.label,
            rankColor: rank.color,
            hop: 1,
        };
    });

    // Group by rank
    const byRank = new Map();
    for (const n of enriched) {
        if (!byRank.has(n.rankId)) byRank.set(n.rankId, []);
        byRank.get(n.rankId).push(n);
    }

    for (const rankId of RANK_ORDER) {
        const group = byRank.get(rankId);
        if (!group?.length) continue;

        // Sort by |sync| desc then title
        group.sort((a, b) => Math.abs(b.sync) - Math.abs(a.sync) || String(a.title).localeCompare(String(b.title)));

        const medianSync = group.reduce((s, n) => s + n.sync, 0) / group.length;
        const bandY = syncToY(medianSync);
        const cap = capacityForRow(bandY, hub, nodeW, nodeH, gapX, gapY, xMin, xMax);
        const clusterKey = `cluster:${rankId}`;
        const isExpanded = expandedClusterId === clusterKey;

        if (group.length > cap && !isExpanded) {
            const clusterNode = {
                id: clusterKey,
                kind: "cluster",
                title: `${group[0].rankLabel} ×${group.length}`,
                sync: Math.round(medianSync),
                rankId,
                rankLabel: group[0].rankLabel,
                rankColor: group[0].rankColor,
                memberIds: group.map((g) => g.entityId || g.id),
                members: group,
                x: CIRCUIT_HUB_X + (rankId === "hostile" || rankId === "rival" ? 220 : -220),
                y: bandY,
                w: nodeW,
                h: nodeH,
                hop: 1,
            };
            // Nudge if collides
            let tries = 0;
            while (placed.some((p) => packCollides(clusterNode, p, gapX, gapY)) && tries < 12) {
                clusterNode.x += (tries % 2 === 0 ? 1 : -1) * (nodeW + gapX);
                tries++;
            }
            placed.push({ x: clusterNode.x, y: clusterNode.y, w: clusterNode.w, h: clusterNode.h });
            nodes.push(clusterNode);
            edges.push({
                fromId: hub.id,
                toId: clusterNode.id,
                traceClass: rankId === "hostile" ? "hot" : rankId === "rival" ? "warn" : rankId === "neutral" ? "idle" : "ok",
            });
            continue;
        }

        // Place individually — use each node's sync Y when expanded or small group
        if (isExpanded || group.length <= cap) {
            // Place each at its own Y when possible; batch by rounded Y
            const byY = new Map();
            for (const n of group) {
                const y = syncToY(n.sync);
                if (!byY.has(y)) byY.set(y, []);
                byY.get(y).push(n);
            }
            for (const [y, list] of [...byY.entries()].sort((a, b) => a[0] - b[0])) {
                const placedList = placeInIntervals(list, y, hub, placed, dims);
                for (const p of placedList) {
                    nodes.push(p);
                    edges.push({
                        fromId: hub.id,
                        toId: p.id,
                        traceClass:
                            p.sync >= 3 ? "ok"
                                : p.sync <= -7 ? "hot"
                                    : p.sync <= -3 ? "warn"
                                        : "idle",
                    });
                }
                // If some didn't fit, append as cluster remnant
                if (placedList.length < list.length) {
                    const left = list.filter((n) => !placedList.some((p) => p.id === n.id));
                    const remY = y;
                    const remnant = {
                        id: `cluster:${rankId}:${y}`,
                        kind: "cluster",
                        title: `${list[0].rankLabel} ×${left.length}`,
                        sync: Math.round(medianSync),
                        rankId,
                        rankLabel: list[0].rankLabel,
                        rankColor: list[0].rankColor,
                        memberIds: left.map((g) => g.entityId || g.id),
                        members: left,
                        x: CIRCUIT_HUB_X + 280,
                        y: remY,
                        w: nodeW,
                        h: nodeH,
                        hop: 1,
                    };
                    let tries = 0;
                    while (placed.some((p) => packCollides(remnant, p, gapX, gapY)) && tries < 12) {
                        remnant.x += (tries % 2 === 0 ? 1 : -1) * (nodeW + gapX);
                        tries++;
                    }
                    placed.push({ x: remnant.x, y: remnant.y, w: remnant.w, h: remnant.h });
                    nodes.push(remnant);
                    edges.push({ fromId: hub.id, toId: remnant.id, traceClass: "idle" });
                }
            }
        }
    }

    // Structural neighbors — packed around hub (STRUCT mode), not a side bus
    if (structuralNodes.length) {
        const enrichedStruct = structuralNodes.map((n) => ({
            ...n,
            kind: "structural",
            sync: 0,
            rankId: "struct",
            rankLabel: n.relationLabel || n.relationType || "HECHO",
            rankColor: "#ffaa00",
            hop: 1,
        }));
        // Fan across a few Y bands near sync 0 so many hechos still fit
        const bands = [0, 2, -2, 4, -4, 6, -6];
        let remaining = [...enrichedStruct];
        for (const syncBand of bands) {
            if (!remaining.length) break;
            const y = syncToY(syncBand);
            const placedList = placeInIntervals(remaining, y, hub, placed, dims);
            for (const p of placedList) {
                nodes.push(p);
                edges.push({
                    fromId: hub.id,
                    toId: p.id,
                    traceClass: "struct",
                    structural: true,
                });
            }
            const placedIds = new Set(placedList.map((p) => p.id));
            remaining = remaining.filter((n) => !placedIds.has(n.id));
        }
        // Leftovers: nudge to the right of hub
        remaining.forEach((n, i) => {
            const node = {
                ...n,
                x: CIRCUIT_HUB_X + 260 + (i % 3) * (nodeW + gapX),
                y: CIRCUIT_HUB_Y + Math.floor(i / 3) * (nodeH + gapY) - 80,
                w: nodeW,
                h: nodeH,
            };
            let tries = 0;
            while (placed.some((p) => packCollides(node, p, gapX, gapY)) && tries < 16) {
                node.x += nodeW + gapX;
                tries++;
            }
            placed.push({ x: node.x, y: node.y, w: node.w, h: node.h });
            nodes.push(node);
            edges.push({
                fromId: hub.id,
                toId: node.id,
                traceClass: "struct",
                structural: true,
            });
        });
    }

    // Secondary (2+ hop) — grow outward from BFS parent (not a side column)
    if (secondaryNodes.length) {
        const nodesById = new Map(nodes.map((n) => [n.id, n]));
        const sorted = [...secondaryNodes].sort(
            (a, b) => (a.hop ?? 2) - (b.hop ?? 2)
                || String(a.title || "").localeCompare(String(b.title || ""), "es"),
        );

        for (const n of sorted) {
            const parent = resolveParentBox(n.parentId, nodesById, hub);
            const dx = parent.x - hub.x;
            const dy = parent.y - hub.y;
            const len = Math.hypot(dx, dy);
            let ux;
            let uy;
            if (len < 8) {
                // Parent ≈ hub (fallback) — fan to the right
                ux = 1;
                uy = 0;
            } else {
                ux = dx / len;
                uy = dy / len;
            }
            const hop = Math.max(2, n.hop ?? 2);
            const ring = CIRCUIT_HOP_RING + (hop - 2) * 48;
            const node = {
                ...n,
                kind: "secondary",
                parentId: n.parentId || parent.id,
                sync: 0,
                rankId: "secondary",
                rankLabel: `HOP ${hop}`,
                rankColor: MUTED_COLOR,
                x: Math.round(parent.x + ux * ring),
                y: Math.round(parent.y + uy * ring * 0.35),
                w: nodeW,
                h: nodeH,
                hop,
            };

            let tries = 0;
            while (placed.some((p) => packCollides(node, p, gapX, gapY)) && tries < 24) {
                const side = tries % 2 === 0 ? 1 : -1;
                const step = Math.ceil((tries + 1) / 2);
                // Nudge perpendicular to outward vector, then further out
                const px = -uy;
                const py = ux;
                node.x = Math.round(parent.x + ux * (ring + step * 18) + side * px * step * (nodeW * 0.55));
                node.y = Math.round(parent.y + uy * (ring * 0.35 + step * 10) + side * py * step * (nodeH * 0.4));
                tries++;
            }

            placed.push({ x: node.x, y: node.y, w: node.w, h: node.h });
            nodes.push(node);
            nodesById.set(node.id, node);
            edges.push({
                fromId: parent.id,
                toId: node.id,
                traceClass: "idle",
                secondary: true,
            });
        }
    }

    return { nodes, edges, hubId: hub.id };
}

/**
 * Manhattan path from hub to node (world coords).
 * @returns {string} SVG path d
 */
export function manhattanPath(from, to) {
    const x0 = from.x;
    const y0 = from.y;
    const x1 = to.x;
    const y1 = to.y;
    if (Math.abs(x1 - x0) < 8) return `M${x0} ${y0} V${y1}`;
    if (Math.abs(y1 - y0) < 8) return `M${x0} ${y0} H${x1}`;
    // Vertical first then horizontal (circuit look)
    return `M${x0} ${y0} V${y1} H${x1}`;
}
