import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    viewportPositionForWorldCenter,
    worldCenterFromViewportPosition,
    worldPointOffsetFromScreenCenter,
    resolveViewportScreenSize,
} from "./wikiGraphCoords.js";

describe("wikiGraphCoords — pixi-viewport center math", () => {
    it("moveCenter places world point at screen center (scale 1)", () => {
        const worldX = 850;
        const worldY = 620;
        const screenW = 480;
        const screenH = 360;

        const pos = viewportPositionForWorldCenter(worldX, worldY, screenW, screenH);
        const offset = worldPointOffsetFromScreenCenter(
            worldX,
            worldY,
            pos.x,
            pos.y,
            screenW,
            screenH
        );

        assert.ok(Math.abs(offset.offsetX) < 0.001, `offsetX=${offset.offsetX}`);
        assert.ok(Math.abs(offset.offsetY) < 0.001, `offsetY=${offset.offsetY}`);
    });

    it("moveCenter round-trips through center getter (zoomed)", () => {
        const worldX = 1200;
        const worldY = 900;
        const screenW = 600;
        const screenH = 400;
        const scale = 1.35;

        const pos = viewportPositionForWorldCenter(worldX, worldY, screenW, screenH, scale, scale);
        const center = worldCenterFromViewportPosition(pos.x, pos.y, screenW, screenH, scale, scale);

        assert.ok(Math.abs(center.x - worldX) < 0.001);
        assert.ok(Math.abs(center.y - worldY) < 0.001);
    });

    it("using renderer buffer width instead of CSS width shifts center right/down", () => {
        const worldX = 1000;
        const worldY = 1000;
        const cssW = 500;
        const cssH = 300;
        const resolution = 2;
        const rendererW = cssW * resolution; // 1000 — wrong if passed as screenWidth

        const correct = viewportPositionForWorldCenter(worldX, worldY, cssW, cssH);
        const wrong = viewportPositionForWorldCenter(worldX, worldY, rendererW, cssH);

        const correctOffset = worldPointOffsetFromScreenCenter(
            worldX,
            worldY,
            correct.x,
            correct.y,
            cssW,
            cssH
        );
        const wrongOffset = worldPointOffsetFromScreenCenter(
            worldX,
            worldY,
            wrong.x,
            wrong.y,
            cssW,
            cssH
        );

        assert.ok(Math.abs(correctOffset.offsetX) < 0.001);
        assert.ok(Math.abs(correctOffset.offsetY) < 0.001);

        // Node appears right/below focus when screenWidth is too large (renderer px used as screen)
        assert.ok(wrongOffset.offsetX > 100, `expected large positive X offset, got ${wrongOffset.offsetX}`);
        assert.equal(resolveViewportScreenSize({
            containerClientWidth: cssW,
            containerClientHeight: cssH,
            appScreenWidth: cssW,
            appScreenHeight: cssH,
            rendererWidth: rendererW,
            rendererHeight: cssH * resolution,
            resolution,
        }).diagnostics.resolutionMismatch, false);
    });

    it("node world coords share origin with viewport (0,0 top-left of world)", () => {
        const layoutWorld = 2000;
        const node = { x: layoutWorld / 2, y: layoutWorld / 2 };
        const screenW = 640;
        const screenH = 480;

        const pos = viewportPositionForWorldCenter(node.x, node.y, screenW, screenH);
        const offset = worldPointOffsetFromScreenCenter(
            node.x,
            node.y,
            pos.x,
            pos.y,
            screenW,
            screenH
        );

        assert.ok(Math.abs(offset.offsetX) < 0.001);
        assert.ok(Math.abs(offset.offsetY) < 0.001);
    });

    it("resolveViewportScreenSize prefers container client dimensions", () => {
        const resolved = resolveViewportScreenSize({
            containerClientWidth: 420,
            containerClientHeight: 280,
            appScreenWidth: 420,
            appScreenHeight: 280,
            rendererWidth: 840,
            rendererHeight: 560,
            resolution: 2,
        });

        assert.equal(resolved.width, 420);
        assert.equal(resolved.height, 280);
        assert.equal(resolved.diagnostics.usingRendererAsScreenWouldOffset.offsetX, 210);
    });
});
