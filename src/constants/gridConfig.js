import { DEFAULT_GRID_COLUMNS } from "../utils/gridMath";

/** Shared per-map rules (persisted on `maps/{id}.gridConfig`). */
export const DEFAULT_MAP_GRID_CONFIG = {
    snap: true,
    columns: DEFAULT_GRID_COLUMNS,
    cellSize: null,
    rows: null,
};

/** Local-only UI preference — not written to Firestore. */
export const DEFAULT_LOCAL_GRID_VISIBLE = true;

export function normalizeMapGridConfig(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    return {
        snap: src.snap !== false,
        columns:
            Number.isFinite(Number(src.columns)) && Number(src.columns) > 0
                ? Math.min(200, Math.max(1, Math.round(Number(src.columns))))
                : DEFAULT_GRID_COLUMNS,
        cellSize:
            src.cellSize != null && Number(src.cellSize) > 0
                ? Number(src.cellSize)
                : null,
        rows:
            src.rows != null && Number(src.rows) > 0
                ? Math.round(Number(src.rows))
                : null,
    };
}

/** Merge persisted map rules with current local `visible`. */
export function mergeGridConfig(mapGrid, localVisible = DEFAULT_LOCAL_GRID_VISIBLE) {
    return {
        ...normalizeMapGridConfig(mapGrid),
        visible: localVisible !== false,
    };
}
