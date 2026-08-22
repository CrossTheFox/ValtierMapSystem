import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    resolveTokenFootprintCells,
    snapToGridCenter,
    snapTokenToGrid,
} from "./gridMath.js";

describe("resolveTokenFootprintCells", () => {
    it("maps size keys to cell span", () => {
        assert.equal(resolveTokenFootprintCells("small"), 1);
        assert.equal(resolveTokenFootprintCells("normal"), 1);
        assert.equal(resolveTokenFootprintCells("large"), 2);
        assert.equal(resolveTokenFootprintCells("huge"), 3);
    });
});

describe("snapTokenToGrid", () => {
    const cell = 70;

    it("keeps 1×1 tokens on cell centers", () => {
        const a = snapTokenToGrid(80, 90, cell, "normal");
        const b = snapToGridCenter(80, 90, cell);
        assert.deepEqual(a, b);
        assert.deepEqual(a, { x: 105, y: 105 });
    });

    it("snaps Large (2×2) to the middle vertex of four cells", () => {
        // Pointer near center of cell (1,1) → footprint top-left (1,1), center on vertex (140,140)
        const snapped = snapTokenToGrid(105, 105, cell, "large");
        assert.deepEqual(snapped, { x: 140, y: 140 });
        // Center sits on a grid intersection, not a cell center
        assert.equal(snapped.x % cell, 0);
        assert.equal(snapped.y % cell, 0);
    });

    it("snaps Huge (3×3) to the center of the middle cell", () => {
        const snapped = snapTokenToGrid(200, 200, cell, "huge");
        // col = round(200/70 - 1.5) = round(1.357) = 1 → center (1+1.5)*70 = 175
        assert.deepEqual(snapped, { x: 175, y: 175 });
        assert.equal(snapped.x % cell, cell / 2);
        assert.equal(snapped.y % cell, cell / 2);
    });

    it("moves Large footprint by whole cells when pointer shifts", () => {
        const a = snapTokenToGrid(100, 100, cell, "large");
        const b = snapTokenToGrid(100 + cell, 100, cell, "large");
        assert.equal(b.x - a.x, cell);
        assert.equal(b.y, a.y);
    });
});
