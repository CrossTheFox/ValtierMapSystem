/**
 * RE4-style briefcase occupancy: X = columns left→right, Y = rows top→bottom.
 * Item shape is a binary mask; rotation is 90° clockwise.
 */

export const DEFAULT_BRIEFCASE = Object.freeze({ cols: 10, rows: 7 });
export const VAULT_BRIEFCASE = Object.freeze({ cols: 12, rows: 8 });
/** DM vault world — pan/zoom; standard 10×7 case is a framed region at origin. */
export const VAULT_WORLD = Object.freeze({ cols: 48, rows: 36 });
export const BRIEFCASE_SIZE = Object.freeze({
    minCols: 6,
    maxCols: 24,
    minRows: 4,
    maxRows: 18,
});

export function cloneMask(mask) {
    if (!Array.isArray(mask) || !mask.length) return [[1]];
    return mask.map((row) => (Array.isArray(row) ? row.slice() : []));
}

export function rotateMask90(mask) {
    const src = cloneMask(mask);
    const h = src.length;
    const w = src[0]?.length || 0;
    if (!h || !w) return [[1]];
    const out = Array.from({ length: w }, () => Array(h).fill(0));
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) out[x][h - 1 - y] = src[y][x] ? 1 : 0;
    }
    return out;
}

export function rotateMask(mask, turns = 1) {
    let m = cloneMask(mask);
    const n = ((turns % 4) + 4) % 4;
    for (let i = 0; i < n; i++) m = rotateMask90(m);
    return m;
}

export function liveMask(item) {
    return rotateMask(item?.mask, item?.rot || 0);
}

export function maskCells(mask) {
    const cells = [];
    const src = Array.isArray(mask) ? mask : [];
    for (let y = 0; y < src.length; y++) {
        const row = src[y] || [];
        for (let x = 0; x < row.length; x++) {
            if (row[x]) cells.push({ x, y });
        }
    }
    return cells;
}

export function isPlaced(item) {
    return Number.isInteger(item?.gx) && Number.isInteger(item?.gy);
}

export function worldCells(item, ox = item?.gx, oy = item?.gy) {
    if (!Number.isInteger(ox) || !Number.isInteger(oy)) return [];
    return maskCells(liveMask(item)).map((c) => ({ x: ox + c.x, y: oy + c.y }));
}

export function occupancyMap(items, ignoreId = null) {
    const map = new Map();
    for (const it of items || []) {
        if (!isPlaced(it) || it.id === ignoreId) continue;
        for (const c of worldCells(it)) map.set(`${c.x},${c.y}`, it.id);
    }
    return map;
}

export function canPlace(item, ox, oy, cols, rows, occ) {
    const cells = worldCells(item, ox, oy);
    if (!cells.length) return false;
    for (const c of cells) {
        if (c.x < 0 || c.y < 0 || c.x >= cols || c.y >= rows) return false;
        if (occ.has(`${c.x},${c.y}`)) return false;
    }
    return true;
}

export function findFit(item, cols, rows, occ) {
    const mask = liveMask(item);
    const h = mask.length;
    const w = mask[0]?.length || 0;
    for (let y = 0; y <= rows - h; y++) {
        for (let x = 0; x <= cols - w; x++) {
            if (canPlace(item, x, y, cols, rows, occ)) return { x, y };
        }
    }
    return null;
}

/**
 * Rotate 90° * dir (CW if +1). Keeps grab offset and placed centroid stable.
 * @returns {object} new item
 */
export function rotateItem(item, dir = 1) {
    const prev = liveMask(item);
    const pw = prev[0]?.length || 0;
    const ph = prev.length;
    const turns = ((dir % 4) + 4) % 4;
    const next = { ...item };

    if (item._grab) {
        let { dx, dy } = item._grab;
        let w = pw;
        let h = ph;
        for (let i = 0; i < turns; i++) {
            const nx = h - 1 - dy;
            const ny = dx;
            dx = nx;
            dy = ny;
            const tw = h;
            h = w;
            w = tw;
        }
        next._grab = { dx, dy };
    }

    if (isPlaced(item)) {
        const cells = maskCells(prev);
        if (!cells.length) {
            next.rot = ((item.rot || 0) + dir + 4) % 4;
            return next;
        }
        const cx = cells.reduce((s, c) => s + c.x, 0) / cells.length;
        const cy = cells.reduce((s, c) => s + c.y, 0) / cells.length;
        next.rot = ((item.rot || 0) + dir + 4) % 4;
        const nCells = maskCells(liveMask(next));
        const ncx = nCells.reduce((s, c) => s + c.x, 0) / nCells.length;
        const ncy = nCells.reduce((s, c) => s + c.y, 0) / nCells.length;
        next.gx = Math.round(item.gx + cx - ncx);
        next.gy = Math.round(item.gy + cy - ncy);
        return next;
    }

    next.rot = ((item.rot || 0) + dir + 4) % 4;
    return next;
}

export function tryRotatePlaced(item, dir, cols, rows, items) {
    const next = rotateItem(item, dir);
    if (!isPlaced(item)) return next;
    const occ = occupancyMap(items, item.id);
    if (!canPlace(next, next.gx, next.gy, cols, rows, occ)) return item;
    return next;
}

/** Paint cells → bounding-box mask + origin. */
export function compactMaskFromCells(cells) {
    const list = (cells || []).map((c) => ({
        x: Math.trunc(Number(c?.x)),
        y: Math.trunc(Number(c?.y)),
    })).filter((c) => Number.isInteger(c.x) && Number.isInteger(c.y));
    if (!list.length) return null;
    const minX = Math.min(...list.map((c) => c.x));
    const minY = Math.min(...list.map((c) => c.y));
    const maxX = Math.max(...list.map((c) => c.x));
    const maxY = Math.max(...list.map((c) => c.y));
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    const mask = Array.from({ length: h }, () => Array(w).fill(0));
    for (const c of list) mask[c.y - minY][c.x - minX] = 1;
    return { mask, gx: minX, gy: minY };
}

export function cellHasNeighbor(cells, x, y, dx, dy) {
    const set = cells instanceof Set
        ? cells
        : new Set((cells || []).map((c) => `${c.x},${c.y}`));
    return set.has(`${x + dx},${y + dy}`);
}

export function normalizeBriefcase(raw) {
    const colsRaw = Number(raw?.cols);
    const rowsRaw = Number(raw?.rows);
    const cols = Number.isFinite(colsRaw)
        ? Math.max(BRIEFCASE_SIZE.minCols, Math.min(BRIEFCASE_SIZE.maxCols, Math.floor(colsRaw)))
        : DEFAULT_BRIEFCASE.cols;
    const rows = Number.isFinite(rowsRaw)
        ? Math.max(BRIEFCASE_SIZE.minRows, Math.min(BRIEFCASE_SIZE.maxRows, Math.floor(rowsRaw)))
        : DEFAULT_BRIEFCASE.rows;
    return { cols, rows };
}

export function placedFitsBriefcase(items, cols, rows) {
    for (const it of items || []) {
        if (!isPlaced(it)) continue;
        for (const c of worldCells(it)) {
            if (c.x < 0 || c.y < 0 || c.x >= cols || c.y >= rows) return false;
        }
    }
    return true;
}
