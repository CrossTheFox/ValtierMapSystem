import assert from "node:assert/strict";
import {
    buildCircuitLayout,
    manhattanPath,
    syncToY,
    CIRCUIT_HUB_X,
    CIRCUIT_HUB_Y,
} from "./circuitLayout.js";

assert.equal(syncToY(10), CIRCUIT_HUB_Y - 380);
assert.equal(syncToY(-10), CIRCUIT_HUB_Y + 380);
assert.equal(syncToY(0), CIRCUIT_HUB_Y);

const hub = { id: "hub1", title: "Caelum" };
const affinity = [];
for (let i = 0; i < 20; i++) {
    affinity.push({
        id: `a${i}`,
        entityId: `e${i}`,
        title: `Ally ${i}`,
        sync: 8,
        relationId: `r${i}`,
    });
}

const layout = buildCircuitLayout({ hub, affinityNodes: affinity });
assert.ok(layout.nodes.some((n) => n.kind === "hub"));
assert.ok(layout.nodes.some((n) => n.kind === "cluster"), "bonded overflow should cluster");
assert.ok(layout.edges.length >= 1);

const small = buildCircuitLayout({
    hub,
    affinityNodes: [
        { id: "b1", entityId: "eb1", title: "Krell", sync: 10 },
        { id: "b2", entityId: "eb2", title: "Oni", sync: -4 },
    ],
});
assert.equal(small.nodes.filter((n) => n.kind === "affinity").length, 2);
const krell = small.nodes.find((n) => n.id === "b1");
assert.ok(krell.y < CIRCUIT_HUB_Y);
const oni = small.nodes.find((n) => n.id === "b2");
assert.ok(oni.y > CIRCUIT_HUB_Y);

const d = manhattanPath({ x: CIRCUIT_HUB_X, y: CIRCUIT_HUB_Y }, { x: 1000, y: 200 });
assert.match(d, /^M/);

const withStruct = buildCircuitLayout({
    hub,
    affinityNodes: [{ id: "c1", entityId: "ec1", title: "Mixi", sync: 1 }],
    structuralNodes: [{ id: "s1", entityId: "es1", title: "Guild", relationType: "MIEMBRO" }],
    showStructuralBus: true,
});
assert.ok(withStruct.nodes.some((n) => n.kind === "structural"));
const structNode = withStruct.nodes.find((n) => n.kind === "structural");
assert.ok(structNode.x < 1200, "structural packs near hub, not side bus");

// Outward secondary: edge parent→child, not hub→child; placed past parent
const outward = buildCircuitLayout({
    hub,
    affinityNodes: [{ id: "oni", entityId: "oni", title: "ONI", sync: 4 }],
    secondaryNodes: [
        { id: "stranger", entityId: "stranger", title: "Extra", hop: 2, parentId: "oni" },
    ],
});
const oniNode = outward.nodes.find((n) => n.id === "oni");
const stranger = outward.nodes.find((n) => n.id === "stranger");
assert.ok(oniNode && stranger, "parent + secondary present");
const secEdge = outward.edges.find((e) => e.toId === "stranger" && e.secondary);
assert.equal(secEdge?.fromId, "oni", "secondary edge from parent");
assert.notEqual(secEdge?.fromId, hub.id, "secondary must not attach to hub");
const hubDistOni = Math.hypot(oniNode.x - CIRCUIT_HUB_X, oniNode.y - CIRCUIT_HUB_Y);
const hubDistStr = Math.hypot(stranger.x - CIRCUIT_HUB_X, stranger.y - CIRCUIT_HUB_Y);
assert.ok(hubDistStr > hubDistOni, "secondary farther from hub than parent");

console.log("circuitLayout.test.mjs: ok");
