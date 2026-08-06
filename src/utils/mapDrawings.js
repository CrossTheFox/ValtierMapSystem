/**
 * Helpers for shared map drawings (circle / rect / polygon-on-grid).
 */

export const DRAW_SHAPES = {
    CIRCLE: "circle",
    RECT: "rect",
    /** Grid polyline that closes into a filled polygon when an endpoint is clicked. */
    FREEHAND: "freehand",
};

export const CIRCLE_MODES = {
    ROUND: "round",
    SQUARE: "square",
};

/** Preset stroke/fill colors for map figures (hex strings for Firestore). */
export const DRAW_COLOR_PRESETS = [
    { id: "cyan", hex: "#00f2ea" },
    { id: "pink", hex: "#ff66ff" },
    { id: "lime", hex: "#b8ff3c" },
    { id: "amber", hex: "#ffb020" },
    { id: "red", hex: "#ff2a3a" },
    { id: "violet", hex: "#a78bfa" },
    { id: "white", hex: "#ffffff" },
];

export const DEFAULT_DRAW_COLOR = DRAW_COLOR_PRESETS[0].hex;

/** Parse stored hex / number into a Pixi color number. */
export function parseDrawingColor(color, fallback = 0x00f2ea) {
    if (typeof color === "number" && Number.isFinite(color)) return color >>> 0;
    if (typeof color === "string") {
        const raw = color.trim().replace(/^#/, "");
        if (/^[0-9a-fA-F]{6}$/.test(raw)) return Number.parseInt(raw, 16);
        if (/^[0-9a-fA-F]{3}$/.test(raw)) {
            const expanded = raw.split("").map((c) => c + c).join("");
            return Number.parseInt(expanded, 16);
        }
    }
    return fallback;
}

export function sameGridCell(a, b) {
    if (!a || !b) return false;
    if (Number.isFinite(a.col) && Number.isFinite(b.col)
        && Number.isFinite(a.row) && Number.isFinite(b.row)) {
        return a.col === b.col && a.row === b.row;
    }
    return Math.abs((a.x ?? 0) - (b.x ?? 0)) < 1
        && Math.abs((a.y ?? 0) - (b.y ?? 0)) < 1;
}

/** Chebyshev radius in cells from center → edge (casillas desde el centro). */
export function circleRadiusCells(center, edge) {
    if (!center || !edge) return 0;
    if (Number.isFinite(center.col) && Number.isFinite(edge.col)
        && Number.isFinite(center.row) && Number.isFinite(edge.row)) {
        return Math.max(
            Math.abs(edge.col - center.col),
            Math.abs(edge.row - center.row),
        );
    }
    return 0;
}

/** Normalize paths from Firestore ({ points }[]) or in-memory (point[][]). */
export function normalizeDrawingPaths(paths) {
    if (!Array.isArray(paths)) return [];
    return paths.map((path) => {
        if (Array.isArray(path)) return path;
        if (path && Array.isArray(path.points)) return path.points;
        return [];
    }).filter((p) => p.length > 0);
}

/** Collect all world points used for AABB / drag of a drawing. */
export function drawingWorldPoints(drawing) {
    if (!drawing) return [];
    const pts = [];
    const parts = Array.isArray(drawing.parts) ? drawing.parts : null;
    if (parts?.length) {
        for (const part of parts) {
            if (part?.a) pts.push(part.a);
            if (part?.b) pts.push(part.b);
            if (Array.isArray(part?.points)) pts.push(...part.points);
            for (const path of normalizeDrawingPaths(part?.paths)) {
                pts.push(...path);
            }
        }
        return pts;
    }
    if (drawing.a) pts.push(drawing.a);
    if (drawing.b) pts.push(drawing.b);
    for (const path of normalizeDrawingPaths(drawing.paths)) {
        pts.push(...path);
    }
    if (Array.isArray(drawing.points)) pts.push(...drawing.points);
    return pts;
}

/** Translate a drawing payload by (dx, dy). */
export function translateDrawing(drawing, dx, dy) {
    if (!drawing) return drawing;
    const shift = (p) => (p && Number.isFinite(p.x)
        ? { ...p, x: p.x + dx, y: p.y + dy }
        : p);

    const next = { ...drawing };
    if (Array.isArray(drawing.parts)) {
        next.parts = drawing.parts.map((part) => ({
            ...part,
            a: shift(part.a),
            b: shift(part.b),
            points: Array.isArray(part.points) ? part.points.map(shift) : part.points,
            paths: Array.isArray(part.paths)
                ? normalizeDrawingPaths(part.paths).map((path) => path.map(shift))
                : part.paths,
        }));
    }
    if (drawing.a) next.a = shift(drawing.a);
    if (drawing.b) next.b = shift(drawing.b);
    if (Array.isArray(drawing.paths)) {
        next.paths = normalizeDrawingPaths(drawing.paths).map((path) =>
            path.map(shift),
        );
    }
    if (Array.isArray(drawing.points)) {
        next.points = drawing.points.map(shift);
    }
    return next;
}

/** Re-snap circle/rect/polygon corners to grid after drag. */
export function resnapDrawing(drawing, snapFn) {
    if (!drawing || typeof snapFn !== "function") return drawing;
    const snapPt = (p) => (p && Number.isFinite(p.x) ? snapFn(p.x, p.y) : p);

    const next = { ...drawing };
    if (Array.isArray(drawing.parts)) {
        next.parts = drawing.parts.map((part) => {
            if (part?.shape === DRAW_SHAPES.FREEHAND || Array.isArray(part?.points)) {
                return {
                    ...part,
                    points: Array.isArray(part.points) ? part.points.map(snapPt) : part.points,
                    a: snapPt(part.a),
                    b: snapPt(part.b),
                };
            }
            return {
                ...part,
                a: snapPt(part.a),
                b: snapPt(part.b),
            };
        });
        return next;
    }
    if (drawing.shape === DRAW_SHAPES.FREEHAND && Array.isArray(drawing.points)) {
        next.points = drawing.points.map(snapPt);
        next.a = snapPt(drawing.a) || next.points[0];
        next.b = snapPt(drawing.b) || next.points[next.points.length - 1];
        return next;
    }
    if (drawing.shape === DRAW_SHAPES.CIRCLE || drawing.shape === DRAW_SHAPES.RECT) {
        next.a = snapPt(drawing.a);
        next.b = snapPt(drawing.b);
    }
    return next;
}

export function shapeLabel(shape) {
    if (shape === DRAW_SHAPES.CIRCLE) return "Círculo";
    if (shape === DRAW_SHAPES.RECT) return "Cuadrado";
    if (shape === DRAW_SHAPES.FREEHAND) return "Polígono";
    if (shape === "compound") return "Grupo";
    return "Figura";
}
