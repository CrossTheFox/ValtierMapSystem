import { DEFAULT_MAP_GRID_CONFIG } from "./gridConfig";
import { DEFAULT_GRID_CELL_PX, DEFAULT_GRID_COLUMNS } from "../utils/gridMath";

/** Client-only board when a campaign has zero Firestore maps. */
export const EMPTY_TABLE_PLACEHOLDER_ID = "__empty_table__";

/** Exact cell grid so fill and GridLayer share the same world extent. */
export const EMPTY_TABLE_COLUMNS = DEFAULT_GRID_COLUMNS;
export const EMPTY_TABLE_ROWS = DEFAULT_GRID_COLUMNS;
export const EMPTY_TABLE_CELL = DEFAULT_GRID_CELL_PX;
export const EMPTY_TABLE_WIDTH = EMPTY_TABLE_COLUMNS * EMPTY_TABLE_CELL;
export const EMPTY_TABLE_HEIGHT = EMPTY_TABLE_ROWS * EMPTY_TABLE_CELL;

/** Dark slate fill under the grid (Roll20-style blank table). */
export const EMPTY_TABLE_FILL = 0x16161f;

/**
 * @param {string|null|undefined} campaignId
 * @returns {object}
 */
export function createEmptyTableMap(campaignId = null) {
    return {
        id: null,
        campaignId: campaignId ?? null,
        name: "Sin mapa",
        description: "Mesa vacía — crea un mapa desde Admin.",
        imageUrl: null,
        width: EMPTY_TABLE_WIDTH,
        height: EMPTY_TABLE_HEIGHT,
        metersPerPixel: 1,
        unit: "m",
        gridConfig: {
            ...DEFAULT_MAP_GRID_CONFIG,
            columns: EMPTY_TABLE_COLUMNS,
            rows: EMPTY_TABLE_ROWS,
            cellSize: EMPTY_TABLE_CELL,
        },
        isPlaceholder: true,
    };
}

/** @param {object|null|undefined} map */
export function isEmptyTableMap(map) {
    if (!map) return true;
    return Boolean(map.isPlaceholder || map.id === EMPTY_TABLE_PLACEHOLDER_ID);
}
