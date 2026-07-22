/** Default VTT column count when auto-fitting the map. */
export const DEFAULT_GRID_COLUMNS = 30;

/** Fallback when map dimensions are unknown. */
export const DEFAULT_GRID_CELL_PX = 70;

/** Token size multipliers relative to one grid cell diameter. */
export const TOKEN_SIZE_MULTIPLIERS = {
    small: 0.5,
    normal: 1,
    large: 2,
    huge: 3,
};

export const TOKEN_SIZE_OPTIONS = [
    { id: "small", label: "Small" },
    { id: "normal", label: "Normal" },
    { id: "large", label: "Large" },
    { id: "huge", label: "Huge" },
];

export function getMapWidth(map) {
    return map?.widthPx ?? map?.width ?? 2000;
}

export function getMapHeight(map) {
    return map?.heightPx ?? map?.height ?? 2000;
}

/**
 * Resolve cell size in world pixels.
 * Prefer explicit cellSize; otherwise divide map width by columns (default 30).
 */
export function resolveCellSize(map, gridConfig = {}) {
    if (gridConfig?.cellSize != null && Number(gridConfig.cellSize) > 0) {
        return Number(gridConfig.cellSize);
    }
    const cols = gridConfig?.columns ?? DEFAULT_GRID_COLUMNS;
    const w = getMapWidth(map);
    if (!cols || cols <= 0) return DEFAULT_GRID_CELL_PX;
    return Math.max(1, Math.round(w / cols));
}

export function resolveGridDimensions(map, gridConfig = {}) {
    const cellSize = resolveCellSize(map, gridConfig);
    const w = getMapWidth(map);
    const h = getMapHeight(map);
    const columns = gridConfig?.columns ?? Math.max(1, Math.round(w / cellSize));
    const rows = gridConfig?.rows ?? Math.ceil(h / cellSize);
    return { cellSize, columns, rows, width: w, height: h };
}

/** Snap world coords to the center of the nearest grid cell. */
export function snapToGridCenter(x, y, cellSize) {
    const size = cellSize > 0 ? cellSize : DEFAULT_GRID_CELL_PX;
    return {
        x: Math.floor(x / size) * size + size / 2,
        y: Math.floor(y / size) * size + size / 2,
    };
}

export function resolveTokenSizeKey(char, sizeOverride) {
    if (sizeOverride && TOKEN_SIZE_MULTIPLIERS[sizeOverride]) return sizeOverride;
    const base = char?.tokenSize;
    if (base && TOKEN_SIZE_MULTIPLIERS[base]) return base;
    return "normal";
}

/** Diameter of the token circle in world pixels. */
export function resolveTokenDiameter(char, cellSize, sizeOverride) {
    const key = resolveTokenSizeKey(char, sizeOverride);
    const mult = TOKEN_SIZE_MULTIPLIERS[key] ?? 1;
    return Math.max(8, cellSize * mult);
}
