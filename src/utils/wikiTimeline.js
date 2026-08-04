import { WIKI_ENTITY_TYPES } from "../constants/wikiEntityTypes";

/** Calendarios soportados. Valtia usa D.Z. (Después del Diluvio) como estándar narrativo. */
export const TIMELINE_CALENDAR = {
    GREGORIAN: "gregorian",
    DZ: "dz",
};

export const TIMELINE_CALENDAR_LABELS = {
    [TIMELINE_CALENDAR.GREGORIAN]: "",
    [TIMELINE_CALENDAR.DZ]: " D.Z.",
};

/** Años entre filas para mostrar banda de compresión temporal. */
export const TIMELINE_GAP_COMPRESS_YEARS = 50;

export const TIMELINE_BRANCH = {
    LEFT: "left",
    CENTER: "center",
    RIGHT: "right",
};

const BRANCH_ORDER = { left: 0, center: 1, right: 2 };

/**
 * @param {object} entity
 * @returns {{
 *   calendar: string, date: string, branch: string, isCore: boolean,
 *   anchorId: string|null, eventKind: string, certainty: string,
 *   narrativeArc: string, narrativeArcId: string|null,
 * }}
 */
export function getTimelineMeta(entity) {
    const t = entity?.customFields?.timeline;
    return {
        calendar: t?.calendar || TIMELINE_CALENDAR.DZ,
        date: t?.date || "",
        branch: t?.branch || TIMELINE_BRANCH.CENTER,
        isCore: Boolean(t?.isCore),
        anchorId: t?.anchorId || null,
        eventKind: t?.eventKind || "otro",
        certainty: t?.certainty || "canon",
        narrativeArc: t?.narrativeArc || "",
        narrativeArcId: typeof t?.narrativeArcId === "string" && t.narrativeArcId
            ? t.narrativeArcId
            : null,
    };
}

/**
 * Resolve display label for an event's arc using campaign catalog (dual-read).
 * @param {object} entity
 * @param {{ id: string, label: string }[]} [arcs]
 * @returns {{ arcId: string|null, label: string }}
 */
export function resolveEventArc(entity, arcs = []) {
    const meta = getTimelineMeta(entity);
    if (meta.narrativeArcId) {
        const found = arcs.find((a) => a.id === meta.narrativeArcId);
        if (found) return { arcId: found.id, label: found.label };
        return { arcId: meta.narrativeArcId, label: meta.narrativeArc || meta.narrativeArcId };
    }
    const label = (meta.narrativeArc || "").trim();
    if (!label) return { arcId: null, label: "" };
    const byLabel = arcs.find((a) => a.label === label);
    if (byLabel) return { arcId: byLabel.id, label: byLabel.label };
    return { arcId: null, label };
}

/**
 * @param {object} partial
 * @returns {object}
 */
export function buildTimelineCustomFields(partial = {}) {
    return {
        timeline: {
            calendar: partial.calendar || TIMELINE_CALENDAR.DZ,
            date: partial.date || "",
            branch: partial.branch || TIMELINE_BRANCH.CENTER,
            isCore: Boolean(partial.isCore),
            anchorId: partial.anchorId || null,
            eventKind: partial.eventKind || "otro",
            certainty: partial.certainty || "canon",
            narrativeArc: partial.narrativeArc || "",
            narrativeArcId: partial.narrativeArcId || null,
        },
    };
}

/**
 * Count events per arc (by resolved id or legacy label key).
 * @param {object[]} entities
 * @param {{ id: string, label: string }[]} [arcs]
 * @returns {Map<string, number>}
 */
export function countEventsByArc(entities = [], arcs = []) {
    const counts = new Map();
    for (const ent of entities) {
        if (ent.entityType !== WIKI_ENTITY_TYPES.EVENTO_HISTORICO) continue;
        const { arcId, label } = resolveEventArc(ent, arcs);
        const key = arcId || (label ? `label:${label}` : "__none__");
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
}

/**
 * Insert arc band markers when the resolved arc changes between consecutive rows.
 * Progress = event count for that arc (all events in catalog / legacy label).
 * @param {Array<{ type: string, row?: object, gapYears?: number, label?: string }>} displayItems
 * @param {{ id: string, label: string, order?: number, color?: string|null }[]} arcs
 * @param {object[]} [entities]
 * @returns {Array<object>}
 */
export function insertArcBands(displayItems = [], arcs = [], entities = []) {
    if (!displayItems.length) return displayItems;
    const totals = countEventsByArc(entities, arcs);
    const out = [];
    let lastKey = null;

    for (const item of displayItems) {
        if (item.type !== "row") {
            out.push(item);
            continue;
        }
        const firstNode = item.row?.nodes?.[0];
        if (!firstNode) {
            out.push(item);
            continue;
        }
        const { arcId, label } = resolveEventArc(firstNode.entity, arcs);
        const key = arcId || (label ? `label:${label}` : "__none__");

        if (key !== lastKey && key !== "__none__") {
            const catalog = arcId ? arcs.find((a) => a.id === arcId) : null;
            const total = totals.get(key) || 0;
            out.push({
                type: "arc-band",
                arcId: arcId || null,
                label: catalog?.label || label,
                color: catalog?.color || null,
                total,
                done: total,
            });
        }
        lastKey = key;
        out.push(item);
    }
    return out;
}

/**
 * Parse flexible Gregorian date strings: YYYY | YYYY-MM | YYYY-MM-DD
 * @returns {number|null} sortable timestamp (UTC noon to avoid TZ drift)
 */
export function parseTimelineDate(dateStr) {
    if (!dateStr || typeof dateStr !== "string") return null;
    const trimmed = dateStr.trim();
    if (!trimmed) return null;

    const parts = trimmed.split("-").map((p) => parseInt(p, 10));
    if (parts.some((n) => Number.isNaN(n))) return null;

    const [y, m = 1, d = 1] = parts;
    if (y < 1) return null;
    return Date.UTC(y, Math.max(0, m - 1), d, 12, 0, 0);
}

/** Normalized key for grouping parallel events on the same date. */
export function timelineDateKey(dateStr) {
    const ts = parseTimelineDate(dateStr);
    if (ts === null) return "__undated__";
    const d = new Date(ts);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    if (!dateStr.includes("-")) return String(y);
    if (dateStr.split("-").length === 2) return `${y}-${m}`;
    return `${y}-${m}-${day}`;
}

const MONTHS_ES = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic",
];

/**
 * Human-readable label for HUD (Gregorian v1).
 * @param {string} dateStr
 * @returns {string}
 */
export function formatTimelineDateLabel(dateStr, calendar = TIMELINE_CALENDAR.GREGORIAN) {
    if (!dateStr) return "Sin fecha";
    const ts = parseTimelineDate(dateStr);
    if (ts === null) return dateStr;

    const suffix = TIMELINE_CALENDAR_LABELS[calendar] ?? "";
    const d = new Date(ts);
    const y = d.getUTCFullYear();
    const parts = dateStr.split("-");

    if (parts.length === 1) return `${y}${suffix}`;
    if (parts.length === 2) {
        const m = d.getUTCMonth();
        return `${MONTHS_ES[m]} ${y}${suffix}`;
    }
    const m = d.getUTCMonth();
    const day = d.getUTCDate();
    return `${day} ${MONTHS_ES[m]} ${y}${suffix}`;
}

/**
 * Convert a year-first storage string into display segments for the Latin
 * American DD-MM-YYYY input. Storage is always year-first and sortable; only
 * the UI shows day-month-year.
 * @param {string} storage — "YYYY" | "YYYY-MM" | "YYYY-MM-DD"
 * @returns {{ d: string, m: string, y: string }}
 */
export function formatDateForInput(storage) {
    if (!storage || typeof storage !== "string") return { d: "", m: "", y: "" };
    const parts = storage.trim().split("-");
    const [y = "", m = "", d = ""] = parts;
    return {
        d: d ? String(parseInt(d, 10)) : "",
        m: m ? String(parseInt(m, 10)) : "",
        y: y ? String(parseInt(y, 10)) : "",
    };
}

/**
 * Convert DD-MM-YYYY input segments into a year-first storage string.
 * Year is required; month optional; day requires month. Returns "" if no year.
 * @param {{ d?: string|number, m?: string|number, y?: string|number }} seg
 * @returns {string}
 */
export function parseInputToStorage({ d, m, y } = {}) {
    const year = parseInt(y, 10);
    if (Number.isNaN(year) || year < 1) return "";
    const month = parseInt(m, 10);
    const day = parseInt(d, 10);

    if (!Number.isNaN(month) && month >= 1 && month <= 12) {
        const mm = String(month).padStart(2, "0");
        if (!Number.isNaN(day) && day >= 1 && day <= 31) {
            const dd = String(day).padStart(2, "0");
            return `${year}-${mm}-${dd}`;
        }
        return `${year}-${mm}`;
    }
    return String(year);
}

/**
 * Suggest a later date when branching downward from an anchor.
 * @param {string} anchorDate
 * @returns {string}
 */
export function suggestTimelineDateBelow(anchorDate) {
    if (!anchorDate) {
        const y = new Date().getFullYear();
        return String(y);
    }
    const parts = anchorDate.split("-");
    const y = parseInt(parts[0], 10);
    if (parts.length === 1) return String(y + 1);
    if (parts.length === 2) {
        const m = parseInt(parts[1], 10);
        if (m >= 12) return `${y + 1}-01`;
        return `${y}-${String(m + 1).padStart(2, "0")}`;
    }
    const ts = parseTimelineDate(anchorDate);
    if (ts === null) return anchorDate;
    const next = new Date(ts);
    next.setUTCDate(next.getUTCDate() + 1);
    const ny = next.getUTCFullYear();
    const nm = String(next.getUTCMonth() + 1).padStart(2, "0");
    const nd = String(next.getUTCDate()).padStart(2, "0");
    return `${ny}-${nm}-${nd}`;
}

/**
 * @param {object[]} entities — all wiki entities
 * @returns {{ dateKey: string, dateLabel: string, sortTs: number, nodes: object[] }[]}
 */
export function buildTimelineRows(entities = []) {
    const events = entities.filter((e) => e.entityType === WIKI_ENTITY_TYPES.EVENTO_HISTORICO);

    const items = events.map((entity) => {
        const meta = getTimelineMeta(entity);
        const sortTs = parseTimelineDate(meta.date);
        return {
            entity,
            meta,
            sortTs: sortTs ?? Number.MAX_SAFE_INTEGER,
            dateKey: timelineDateKey(meta.date),
            dateLabel: formatTimelineDateLabel(meta.date, meta.calendar),
        };
    });

    items.sort((a, b) => {
        if (a.meta.isCore && !b.meta.isCore) return -1;
        if (!a.meta.isCore && b.meta.isCore) return 1;
        if (a.sortTs !== b.sortTs) return a.sortTs - b.sortTs;
        const ba = BRANCH_ORDER[a.meta.branch] ?? 1;
        const bb = BRANCH_ORDER[b.meta.branch] ?? 1;
        if (ba !== bb) return ba - bb;
        return (a.entity.title || "").localeCompare(b.entity.title || "", "es");
    });

    const rows = [];
    for (const item of items) {
        const last = rows[rows.length - 1];
        if (last && last.dateKey === item.dateKey) {
            last.nodes.push(item);
        } else {
            rows.push({
                dateKey: item.dateKey,
                dateLabel: item.dateLabel,
                sortTs: item.sortTs,
                nodes: [item],
            });
        }
    }

    for (const row of rows) {
        row.nodes.sort((a, b) => {
            const ba = BRANCH_ORDER[a.meta.branch] ?? 1;
            const bb = BRANCH_ORDER[b.meta.branch] ?? 1;
            if (ba !== bb) return ba - bb;
            if (a.meta.isCore && !b.meta.isCore) return -1;
            if (!a.meta.isCore && b.meta.isCore) return 1;
            return (a.entity.title || "").localeCompare(b.entity.title || "", "es");
        });
    }

    return rows;
}

export function hasTimelineCoreEvent(entities = []) {
    return entities.some(
        (e) =>
            e.entityType === WIKI_ENTITY_TYPES.EVENTO_HISTORICO &&
            getTimelineMeta(e).isCore
    );
}

/**
 * Estima años entre dos timestamps de timeline (aprox. por año civil).
 * @param {number} tsA
 * @param {number} tsB
 */
export function estimateTimelineYearGap(tsA, tsB) {
    if (!Number.isFinite(tsA) || !Number.isFinite(tsB)) return 0;
    const dA = new Date(tsA);
    const dB = new Date(tsB);
    return Math.abs(dB.getUTCFullYear() - dA.getUTCFullYear());
}

/**
 * Inserta bandas de compresión entre filas con huecos largos.
 * @param {ReturnType<typeof buildTimelineRows>} rows
 * @param {{ compress?: boolean, gapYears?: number }} [opts]
 * @returns {Array<{ type: 'row', row: object }|{ type: 'gap', gapYears: number, label: string }>}
 */
export function buildTimelineDisplayItems(rows = [], opts = {}) {
    const compress = opts.compress !== false;
    const threshold = opts.gapYears ?? TIMELINE_GAP_COMPRESS_YEARS;

    if (!compress || rows.length < 2) {
        return rows.map((row) => ({ type: "row", row }));
    }

    const items = [];
    for (let i = 0; i < rows.length; i++) {
        if (i > 0) {
            const gapYears = estimateTimelineYearGap(rows[i - 1].sortTs, rows[i].sortTs);
            if (gapYears >= threshold) {
                items.push({
                    type: "gap",
                    gapYears,
                    label: `~${gapYears} años sin eventos registrados`,
                });
            }
        }
        items.push({ type: "row", row: rows[i] });
    }
    return items;
}

/**
 * Mapa eventId → eventIds desencadenados (relación desencadeno).
 * @param {object[]} relations
 * @returns {Map<string, string[]>}
 */
export function buildCausalEdgeMap(relations = []) {
    const map = new Map();
    for (const rel of relations) {
        if (rel.relationType !== "desencadeno") continue;
        const list = map.get(rel.fromEntityId) || [];
        list.push(rel.toEntityId);
        map.set(rel.fromEntityId, list);
    }
    return map;
}

/**
 * Posición relativa de la fecha narrativa actual en la línea (0–1) o null si fuera de rango.
 */
export function getNarrativePresentPosition(rows = [], narrativeDate) {
    if (!narrativeDate || !rows.length) return null;
    const ts = parseTimelineDate(narrativeDate);
    if (ts === null) return null;

    const first = rows[0]?.sortTs;
    const last = rows[rows.length - 1]?.sortTs;
    if (!Number.isFinite(first) || !Number.isFinite(last)) return null;
    if (ts <= first) return { placement: "before" };
    if (ts >= last) return { placement: "after", sortTs: ts };
    return { placement: "after", sortTs: ts };
}
