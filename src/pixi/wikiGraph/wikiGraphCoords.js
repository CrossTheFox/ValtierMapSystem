/**
 * Pure coordinate helpers for the wiki network graph.
 * Mirrors pixi-viewport moveCenter / center math so we can unit-test without a canvas.
 *
 * Coordinate spaces:
 * - screen: CSS pixels, origin top-left of the pixi canvas (0,0)
 * - world:  viewport-local coords; node.x/node.y live here (d3 layout, 0..LAYOUT_WORLD)
 */

/** pixi-viewport moveCenter: place world (x,y) at screen center. */
export function viewportPositionForWorldCenter(
    worldX,
    worldY,
    screenWidth,
    screenHeight,
    scaleX = 1,
    scaleY = 1
) {
    const worldScreenWidth = screenWidth / scaleX;
    const worldScreenHeight = screenHeight / scaleY;
    return {
        x: (worldScreenWidth / 2 - worldX) * scaleX,
        y: (worldScreenHeight / 2 - worldY) * scaleY,
    };
}

/** Inverse of moveCenter — world point currently at screen center. */
export function worldCenterFromViewportPosition(
    viewportX,
    viewportY,
    screenWidth,
    screenHeight,
    scaleX = 1,
    scaleY = 1
) {
    const worldScreenWidth = screenWidth / scaleX;
    const worldScreenHeight = screenHeight / scaleY;
    return {
        x: worldScreenWidth / 2 - viewportX / scaleX,
        y: worldScreenHeight / 2 - viewportY / scaleY,
    };
}

/** Screen position of a world point (viewport child at worldX, worldY). */
export function worldToScreen(
    worldX,
    worldY,
    viewportX,
    viewportY,
    scaleX = 1,
    scaleY = 1
) {
    return {
        x: worldX * scaleX + viewportX,
        y: worldY * scaleY + viewportY,
    };
}

/** How far a world point is from the visual screen center (should be ~0 after moveCenter). */
export function worldPointOffsetFromScreenCenter(
    worldX,
    worldY,
    viewportX,
    viewportY,
    screenWidth,
    screenHeight,
    scaleX = 1,
    scaleY = 1
) {
    const screen = worldToScreen(worldX, worldY, viewportX, viewportY, scaleX, scaleY);
    return {
        screenX: screen.x,
        screenY: screen.y,
        screenCenterX: screenWidth / 2,
        screenCenterY: screenHeight / 2,
        offsetX: screen.x - screenWidth / 2,
        offsetY: screen.y - screenHeight / 2,
    };
}

/**
 * Pick viewport screen size — must match CSS layout pixels, NOT renderer buffer pixels.
 * Using renderer.width (physical px) while events use CSS px causes left/up offset on center.
 */
export function resolveViewportScreenSize({
    containerClientWidth = 0,
    containerClientHeight = 0,
    appScreenWidth = 0,
    appScreenHeight = 0,
    rendererWidth = 0,
    rendererHeight = 0,
    resolution = 1,
} = {}) {
    const width = containerClientWidth || appScreenWidth;
    const height = containerClientHeight || appScreenHeight;
    return {
        width,
        height,
        diagnostics: {
            containerClient: { w: containerClientWidth, h: containerClientHeight },
            appScreen: { w: appScreenWidth, h: appScreenHeight },
            rendererBuffer: { w: rendererWidth, h: rendererHeight },
            resolution,
            /** True when renderer buffer ≠ CSS size — moveCenter breaks without autoDensity. */
            resolutionMismatch: rendererWidth > 0 && Math.abs(rendererWidth - width * resolution) > 1,
            /** True if someone passed renderer pixels as screenWidth (classic bug). */
            usingRendererAsScreenWouldOffset: {
                offsetX: (rendererWidth / 2) - (width / 2),
                offsetY: (rendererHeight / 2) - (height / 2),
            },
        },
    };
}
