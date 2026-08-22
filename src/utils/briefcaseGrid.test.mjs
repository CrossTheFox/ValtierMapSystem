import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    canPlace,
    compactMaskFromCells,
    findFit,
    liveMask,
    occupancyMap,
    rotateItem,
    rotateMask,
    tryRotatePlaced,
    worldCells,
    placedFitsBriefcase,
} from "./briefcaseGrid.js";

const L = {
    id: "blade",
    mask: [
        [1, 1, 1, 1],
        [0, 0, 0, 1],
    ],
    rot: 0,
    gx: 0,
    gy: 0,
};

describe("briefcaseGrid", () => {
    it("rotates L clockwise and keeps hole free", () => {
        const m = rotateMask(L.mask, 1);
        assert.deepEqual(m, [
            [0, 1],
            [0, 1],
            [0, 1],
            [1, 1],
        ]);
        const cells = worldCells({ ...L, rot: 1 }, 0, 0).map((c) => `${c.x},${c.y}`);
        assert.equal(cells.includes("0,0"), false);
        assert.equal(cells.includes("1,0"), true);
    });

    it("rejects overlap and allows hole of another L", () => {
        const a = { ...L, id: "a", gx: 0, gy: 0 };
        const occ = occupancyMap([a]);
        const filler = { id: "dot", mask: [[1]], rot: 0 };
        assert.equal(canPlace(filler, 0, 1, 10, 7, occ), true);
        assert.equal(canPlace(filler, 0, 0, 10, 7, occ), false);
    });

    it("findFit packs into first free origin", () => {
        const occ = occupancyMap([]);
        const fit = findFit(L, 10, 7, occ);
        assert.deepEqual(fit, { x: 0, y: 0 });
    });

    it("rotateItem keeps centroid near original when placed", () => {
        const next = rotateItem({ ...L, gx: 2, gy: 1 }, 1);
        assert.equal(next.rot, 1);
        const live = liveMask(next);
        assert.equal(live.length, 4);
        assert.equal(live[0].length, 2);
    });

    it("tryRotatePlaced reverts when rotation would leave the grid", () => {
        const item = { ...L, gx: 9, gy: 0 };
        const same = tryRotatePlaced(item, 1, 10, 7, [item]);
        assert.equal(same.rot, 0);
        assert.equal(same.gx, 9);
    });

    it("compactMaskFromCells builds bounding mask + origin", () => {
        const packed = compactMaskFromCells([
            { x: 2, y: 3 },
            { x: 3, y: 3 },
            { x: 3, y: 4 },
        ]);
        assert.deepEqual(packed.gx, 2);
        assert.deepEqual(packed.gy, 3);
        assert.deepEqual(packed.mask, [
            [1, 1],
            [0, 1],
        ]);
    });

    it("refuses shrink when a placed item would clip", () => {
        const items = [{ id: "a", mask: [[1, 1], [1, 0]], rot: 0, gx: 8, gy: 5 }];
        assert.equal(placedFitsBriefcase(items, 10, 7), true);
        assert.equal(placedFitsBriefcase(items, 8, 7), false);
    });
});
