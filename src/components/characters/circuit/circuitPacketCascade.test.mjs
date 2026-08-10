import assert from "node:assert/strict";
import { sampleManhattanPoints } from "./circuitPacketCascade.js";

const pts = sampleManhattanPoints({ x: 800, y: 500 }, { x: 480, y: 190 }, 20);
assert.equal(pts.length, 21);
assert.deepEqual(pts[0], { x: 800, y: 500 });
assert.deepEqual(pts[pts.length - 1], { x: 480, y: 190 });
// Manhattan: vertical first — mid should hit target Y before X finishes
const mid = pts[Math.floor(pts.length / 2)];
assert.equal(mid.y, 190);

console.log("circuitPacketCascade.sampleManhattanPoints: ok");
