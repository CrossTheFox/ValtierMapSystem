/**
 * Timeline model helpers for the Archive solar graph and calendar
 * (`docs/memoria/propuestas-ui-narrative-archive/timeline-modelo.md`).
 * Pure functions: no imports, so `node --test` can load this file as is.
 */

export const DZ_MON = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export const ANCHOR_PRECISIONS = ["day", "month", "year", "range", "decade", "century", "eon", "era", "inherited"];

const BUCKET_WIDTH = { decade: 10, century: 100, eon: 1000 };
const BUCKET_NAME = { decade: "década", century: "siglo", eon: "eón" };

/** Open eras are drawn this many years past their start (mock `eraHi`). */
export const OPEN_ERA_YEARS = 80;

export function pad2(n) {
    return String(n).padStart(2, "0");
}

/** `YYYY`, `YYYY-MM` or `YYYY-MM-DD` (D.Z., civil months) → parts, or null. */
export function parseDZ(value) {
    const m = String(value ?? "").trim().match(/^(-?\d{1,6})(?:-(\d{2}))?(?:-(\d{2}))?$/);
    if (!m) return null;
    return { y: +m[1], m: m[2] ? +m[2] : null, d: m[3] ? +m[3] : null };
}

export function fmtDZ(y, m, d) {
    if (m && d) return `${y}-${pad2(m)}-${pad2(d)}`;
    if (m) return `${y}-${pad2(m)}`;
    return String(y);
}

/** Mock `fmtWhen`: `7024`, `mar 7024`, `7024-mar-05`, ranges with an en dash, suffix D.Z. */
export function fmtWhen(start, end) {
    const one = (v) => {
        const d = parseDZ(v);
        if (!d) return String(v || "");
        if (d.m && d.d) return `${d.y}-${DZ_MON[d.m - 1]}-${pad2(d.d)}`;
        if (d.m) return `${DZ_MON[d.m - 1]} ${d.y}`;
        return String(d.y);
    };
    if (!start && !end) return "";
    if (end && end !== start) return `${one(start)}–${one(end)} D.Z.`;
    return `${one(start || end)} D.Z.`;
}

/** Gregorian table date `YYYY-MM-DD` → `14 mar 2026`. Never written into D.Z. fields. */
export function fmtMesa(date) {
    const m = String(date || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return date || "Sin fecha de mesa";
    return `${Number(m[3])} ${DZ_MON[Number(m[2]) - 1] || m[2]} ${m[1]}`;
}

/** `{ start, end }` years of an era; `end: null` = open. */
export function eraHi(era) {
    const start = Number(era?.start);
    if (era?.end == null || era.end === "") return (Number.isFinite(start) ? start : 0) + OPEN_ERA_YEARS;
    const end = Number(era.end);
    return Number.isFinite(end) ? end : (Number.isFinite(start) ? start : 0);
}

export function eraRange(era) {
    const start = Number(era?.start);
    if (era?.start == null || era.start === "" || !Number.isFinite(start)) return null;
    return { y0: start, y1: eraHi(era), open: era.end == null || era.end === "" };
}

export function arcRange(arc) {
    const s = parseDZ(arc?.start);
    const e = parseDZ(arc?.end) || s;
    if (!s || !e) return null;
    return { y0: Math.min(s.y, e.y), y1: Math.max(s.y, e.y) };
}

export function blankAnchor(partial = {}) {
    return {
        calendar: "dz",
        precision: partial.precision || "year",
        start: partial.start || null,
        end: partial.end || null,
        bucketUnit: partial.bucketUnit || null,
        bucketRef: partial.bucketRef || null,
        eraIds: [...(partial.eraIds || [])],
        arcIds: [...(partial.arcIds || [])],
        parentId: partial.parentId || null,
    };
}

function precisionOfDate(date, end) {
    if (date && end && end !== date) return "range";
    if (/^-?\d{1,6}-\d{2}-\d{2}$/.test(date)) return "day";
    if (/^-?\d{1,6}-\d{2}$/.test(date)) return "month";
    return "year";
}

/**
 * Anchor of an acontecimiento from `customFields.timeline` (mesa) or the ficha columns (biblioteca).
 * New shape has `precision`. The old mesa shape (`date`, `narrativeArcId`) is read, never rewritten.
 * @param {object|null|undefined} raw
 */
export function normalizeAnchor(raw) {
    const t = raw || {};
    if (t.precision) {
        return blankAnchor({
            precision: ANCHOR_PRECISIONS.includes(t.precision) ? t.precision : "year",
            start: t.start ?? null,
            end: t.end ?? null,
            bucketUnit: t.bucketUnit ?? t.bucket_unit ?? null,
            bucketRef: t.bucketRef ?? t.bucket_ref ?? null,
            eraIds: t.eraIds ?? t.era_ids ?? [],
            arcIds: t.arcIds ?? t.arco_ids ?? [],
            parentId: t.parentId ?? t.parent_id ?? null,
        });
    }
    const date = String(t.date || "").trim();
    const end = String(t.end || "").trim();
    return blankAnchor({
        precision: precisionOfDate(date, end),
        start: date || null,
        end: end || null,
        arcIds: t.narrativeArcId ? [t.narrativeArcId] : [],
    });
}

/**
 * Year span of an event, following `inherited` up the parent chain, buckets, then an era bucket.
 * @param {{ anchor: object }} ev
 * @param {(id: string) => ({ anchor: object }|undefined)} eventById
 * @param {(id: string) => ({ start, end }|undefined)} eraById
 */
export function anchorSpan(ev, eventById, eraById, depth = 0) {
    if (!ev || depth > 8) return null;
    const a = ev.anchor;
    if (a.precision === "inherited" && a.parentId) return anchorSpan(eventById(a.parentId), eventById, eraById, depth + 1);
    const s = parseDZ(a.start);
    const en = parseDZ(a.end) || s;
    if (s && en) return { y0: Math.min(s.y, en.y), y1: Math.max(s.y, en.y), s, en };
    const w = BUCKET_WIDTH[a.bucketUnit];
    const y = parseInt(a.bucketRef, 10);
    if (w && Number.isFinite(y)) return { y0: y, y1: y + w - 1 };
    const eraId = a.bucketUnit === "era"
        ? a.bucketRef
        : a.precision === "era" ? a.eraIds?.[0] : (!a.start && a.eraIds?.length ? a.eraIds[0] : "");
    const er = eraId ? eraById(eraId) : null;
    const rg = er ? eraRange(er) : null;
    if (rg) return { y0: rg.y0, y1: rg.y1, fromEra: true };
    return null;
}

export function isInherited(anchor) {
    return anchor.precision === "inherited" || (!!anchor.parentId && !anchor.start && !anchor.end && !anchor.bucketUnit);
}

/** Mock `eventYear`: label and years drawn for an event. */
export function eventYear(ev, eventById, eraById) {
    const a = ev.anchor;
    if (isInherited(a)) return { text: "", y0: null, y1: null };
    const unit = BUCKET_WIDTH[a.bucketUnit] ? a.bucketUnit : (BUCKET_WIDTH[a.precision] ? a.precision : "");
    if (unit) {
        const y = parseInt(a.bucketRef, 10);
        if (Number.isFinite(y)) return { text: `${BUCKET_NAME[unit]} ${y} D.Z.`, y0: y, y1: y + BUCKET_WIDTH[unit] - 1 };
    }
    const sp = anchorSpan(ev, eventById, eraById);
    if (!sp || sp.fromEra) {
        if (a.start) return { text: fmtWhen(a.start, a.end), y0: sp?.y0 ?? null, y1: sp?.y1 ?? null };
        return { text: "", y0: null, y1: null };
    }
    const end = a.end && a.end !== a.start ? a.end : (sp.y0 === sp.y1 ? null : String(sp.y1));
    return { text: fmtWhen(a.start || String(sp.y0), end), y0: sp.y0, y1: sp.y1 };
}

/** Form fields (mock solar form) → anchor. */
export function anchorFromFields(fields) {
    const precision = fields.precision || "year";
    const y = String(fields.y || "").trim();
    const m = String(fields.m || "").padStart(2, "0");
    const d = String(fields.d || "").padStart(2, "0");
    let start = null;
    let end = null;
    let bucketUnit = null;
    let bucketRef = null;
    if (precision === "year" && y) start = y;
    else if (precision === "month" && y) start = `${y}-${m}`;
    else if (precision === "day" && y) start = `${y}-${m}-${d}`;
    else if (precision === "range") {
        start = y || null;
        end = String(fields.y2 || "").trim() || null;
    } else if (BUCKET_WIDTH[precision]) {
        bucketUnit = precision;
        bucketRef = y || null;
    } else if (precision === "era") {
        bucketUnit = "era";
        bucketRef = fields.bucketEra || (fields.eraIds || [])[0] || null;
    }
    return blankAnchor({
        precision, start, end, bucketUnit, bucketRef,
        eraIds: fields.eraIds || [], arcIds: fields.arcIds || [], parentId: fields.parentId || null,
    });
}

/** A finite solar coordinate, or null when the node has never been placed. `0` is a real place. */
export function layoutNum(value) {
    if (value == null || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

const NODE_TYPES = ["lore", "era", "arco", "acontecimiento", "sesion", "neutro"];
const LINK_KINDS = ["agrupa", "sigue", "paralelo"];

/** Who may `agrupa` whom. `sigue` and `paralelo` are not limited by this table. */
const GROUP_OK = {
    lore: ["era", "arco", "acontecimiento", "sesion", "neutro"],
    era: ["era", "arco", "acontecimiento", "sesion", "neutro"],
    arco: ["acontecimiento", "sesion", "neutro"],
    acontecimiento: ["acontecimiento", "sesion", "neutro"],
    sesion: ["acontecimiento"],
    neutro: [],
};

/** Lower rank is the parent when both directions are not the same type. */
const GROUP_RANK = { lore: 0, era: 1, arco: 2, acontecimiento: 3, sesion: 4, neutro: 5 };

const SIDE = {
    right: { tx: 1, ty: 0 },
    left: { tx: -1, ty: 0 },
    bottom: { tx: 0, ty: 1 },
    top: { tx: 0, ty: -1 },
};

function sidePoint(body, side, gap) {
    const n = SIDE[side];
    const r = (Number(body.r) || 0) + (gap || 0);
    return { x: body.x + n.tx * r, y: body.y + n.ty * r, tx: n.tx, ty: n.ty };
}

/**
 * Where a line meets each body: the center of the side it leaves or enters.
 * A diagonal always leaves on the horizontal side and arrives on the vertical
 * one, so a body down-left connects from its right edge into the other's bottom.
 * A pair that is almost in line uses the two facing sides of that axis.
 */
export function linkPorts(a, b, gap = 0) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    const elbow = adx > 36 && ady > 36;
    const src = (elbow || adx >= ady) ? (dx >= 0 ? "right" : "left") : (dy >= 0 ? "bottom" : "top");
    const dst = elbow
        ? (dy >= 0 ? "top" : "bottom")
        : (adx >= ady ? (dx >= 0 ? "left" : "right") : (dy >= 0 ? "top" : "bottom"));
    const from = sidePoint(a, src, gap);
    const to = sidePoint(b, dst, gap);
    return {
        x1: from.x, y1: from.y, tx1: from.tx, ty1: from.ty, fromSide: src,
        x2: to.x, y2: to.y, tx2: to.tx, ty2: to.ty, toSide: dst,
    };
}

export function canGroup(fromType, toType) {
    return (GROUP_OK[fromType] || []).includes(toType);
}

/**
 * Which way `agrupa` points. `a` is the preferred parent when the ranks match.
 * @returns {"ab"|"ba"|""}
 */
export function groupDirection(aType, bType) {
    const ra = GROUP_RANK[aType];
    const rb = GROUP_RANK[bType];
    if (ra == null || rb == null) return "";
    if (ra < rb && canGroup(aType, bType)) return "ab";
    if (rb < ra && canGroup(bType, aType)) return "ba";
    if (ra === rb && canGroup(aType, bType)) return "ab";
    if (ra === rb && canGroup(bType, aType)) return "ba";
    return "";
}

/** Two copies of a port pair, shifted to either side of the chord. */
export function twinPorts(ends, dist = 2.6) {
    const dx = ends.x2 - ends.x1;
    const dy = ends.y2 - ends.y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const shift = (s) => ({
        ...ends,
        x1: ends.x1 + nx * s,
        y1: ends.y1 + ny * s,
        x2: ends.x2 + nx * s,
        y2: ends.y2 + ny * s,
    });
    return [shift(dist), shift(-dist)];
}

/**
 * Seat a parallel set in one horizontal row. The leftmost body keeps its place;
 * the rest sit to its right, at the same height.
 */
export function parallelRow(nodes, gap = 48) {
    const list = (nodes || []).slice().sort((a, b) => a.x - b.x || a.y - b.y || String(a.id).localeCompare(String(b.id)));
    if (!list.length) return [];
    let x = list[0].x;
    const y = list[0].y;
    const out = [{ id: list[0].id, x, y }];
    for (let i = 1; i < list.length; i += 1) {
        x += (Number(list[i - 1].r) || 8) + (Number(list[i].r) || 8) + gap;
        out.push({ id: list[i].id, x, y });
    }
    return out;
}

/** Every id joined to `seeds` by `paralelo`, including the seeds. */
export function parallelIds(links, seeds) {
    const set = new Set((seeds || []).filter(Boolean));
    let grew = true;
    while (grew) {
        grew = false;
        for (const link of links || []) {
            if (link.kind !== "paralelo") continue;
            const a = set.has(link.fromId);
            const b = set.has(link.toId);
            if (a && !b) { set.add(link.toId); grew = true; }
            if (b && !a) { set.add(link.fromId); grew = true; }
        }
    }
    return [...set];
}

/** Move every endpoint that was `fromId` onto the new node. Illegal `agrupa` rows drop. */
export function linksAfterRetarget(links, fromId, toId, toType) {
    const moved = [];
    for (const link of links || []) {
        if (link.fromId !== fromId && link.toId !== fromId) {
            moved.push(link);
            continue;
        }
        const next = { ...link };
        if (next.fromId === fromId) { next.fromId = toId; next.fromType = toType; }
        if (next.toId === fromId) { next.toId = toId; next.toType = toType; }
        if (next.fromId === next.toId) continue;
        const norm = normalizeLink(next);
        if (!norm) continue;
        if (norm.kind === "agrupa" && !canGroup(norm.fromType, norm.toType)) continue;
        moved.push(norm);
    }
    return normalizeLinks(moved);
}

/** Ids de fichas indexadas, sin vacíos ni repetidos. */
export function idList(raw) {
    const out = [];
    const seen = new Set();
    for (const id of Array.isArray(raw) ? raw : []) {
        const key = String(id || "").trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(key);
    }
    return out;
}

/**
 * Indexado propio más el de todos los hijos `agrupa`, hacia arriba, sin repetir.
 * El padre no entra en los hijos. Lo heredado no se vuelve propio.
 * @param {string} id
 * @param {{ kind: string, fromId: string, toId: string }[]} links
 * @param {(id: string) => { people?: string[], places?: string[] }} ownOf
 */
export function rollupIndex(id, links, ownOf) {
    const own = ownOf(id) || {};
    const people = new Set(idList(own.people));
    const places = new Set(idList(own.places));
    const seen = new Set([id]);
    const stack = [id];
    while (stack.length) {
        const cur = stack.pop();
        for (const link of links || []) {
            if (link?.kind !== "agrupa" || link.fromId !== cur || !link.toId || seen.has(link.toId)) continue;
            seen.add(link.toId);
            stack.push(link.toId);
            const child = ownOf(link.toId) || {};
            idList(child.people).forEach((pid) => people.add(pid));
            idList(child.places).forEach((pid) => places.add(pid));
        }
    }
    const ownPeople = new Set(idList(own.people));
    const ownPlaces = new Set(idList(own.places));
    return {
        people: [...people],
        places: [...places],
        inheritedPeople: [...people].filter((pid) => !ownPeople.has(pid)),
        inheritedPlaces: [...places].filter((pid) => !ownPlaces.has(pid)),
    };
}

const INDEX_NODE_TYPES = new Set(["neutro", "era", "arco", "evento_historico"]);

/**
 * Relaciones de indexado, en los dos sentidos.
 * En el nodo: a quién indexa (propio y heredado).
 * En el personaje o el lugar: qué nodos lo indexan, también por herencia hacia arriba.
 * @param {{ id: string, entity_type?: string, index_personajes?: string[], index_lugares?: string[] }} ficha
 * @param {object[]} fichas
 * @param {{ kind: string, fromId: string, toId: string }[]} links
 */
export function indexFacts(ficha, fichas, links) {
    if (!ficha?.id) return [];
    const rows = fichas || [];
    const byId = new Map(rows.map((row) => [row.id, row]));
    const ownOf = (id) => {
        const row = byId.get(id);
        return {
            people: idList(row?.index_personajes ?? row?.people),
            places: idList(row?.index_lugares ?? row?.places),
        };
    };
    const out = [];
    const push = (otherId, verb, inherited) => {
        const other = byId.get(otherId);
        if (!other || otherId === ficha.id) return;
        out.push({
            id: otherId,
            title: other.title || "Sin título",
            type: other.entity_type || "",
            verb,
            inherited: !!inherited,
        });
    };
    if (INDEX_NODE_TYPES.has(ficha.entity_type)) {
        const roll = rollupIndex(ficha.id, links, ownOf);
        const own = ownOf(ficha.id);
        const ownPeople = new Set(own.people);
        const ownPlaces = new Set(own.places);
        roll.people.forEach((pid) => push(pid, "Indexa", !ownPeople.has(pid)));
        roll.places.forEach((pid) => push(pid, "Indexa", !ownPlaces.has(pid)));
    }
    const side = ficha.entity_type === "personaje" ? "people" : ficha.entity_type === "locacion" ? "places" : "";
    if (side) {
        for (const node of rows) {
            if (!INDEX_NODE_TYPES.has(node.entity_type)) continue;
            const roll = rollupIndex(node.id, links, ownOf);
            const list = side === "people" ? roll.people : roll.places;
            if (!list.includes(ficha.id)) continue;
            const own = new Set(ownOf(node.id)[side]);
            push(node.id, "Indexado en", !own.has(ficha.id));
        }
    }
    return out;
}

export function normalizeNeutro(raw) {
    if (!raw || typeof raw !== "object" || !raw.id) return null;
    return {
        id: String(raw.id),
        title: raw.title || "Sin título",
        summary: raw.summary || "",
        body: raw.body || "",
        people: idList(raw.index_personajes ?? raw.people),
        places: idList(raw.index_lugares ?? raw.places),
        layoutX: layoutNum(raw.layout_x ?? raw.layoutX),
        layoutY: layoutNum(raw.layout_y ?? raw.layoutY),
    };
}

export function neutroToRow(node) {
    return {
        id: node.id,
        title: node.title || "Sin título",
        summary: node.summary || "",
        body: node.body || "",
        index_personajes: idList(node.people ?? node.index_personajes),
        index_lugares: idList(node.places ?? node.index_lugares),
        layout_x: node.layoutX ?? null,
        layout_y: node.layoutY ?? null,
    };
}

function paintHex(value) {
    const hex = String(value || "").trim();
    return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : "";
}

/** `pinturas` on the lore or campaign doc. Missing keys keep the shared defaults. */
export function normalizePaints(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out = {};
    for (const [id, row] of Object.entries(raw)) {
        if (!id || !row || typeof row !== "object") continue;
        const color = paintHex(row.color);
        const auraColor = paintHex(row.aura_color ?? row.auraColor);
        const radius = Number(row.aura_radius ?? row.auraRadius);
        const paint = {};
        if (color) paint.color = color;
        if (auraColor) paint.auraColor = auraColor;
        if (Number.isFinite(radius) && radius >= 16 && radius <= 320) paint.auraRadius = radius;
        if (Object.keys(paint).length) out[String(id)] = paint;
    }
    return out;
}

/** Firestore shape of the paint map. */
export function paintsToRows(paints) {
    const out = {};
    for (const [id, paint] of Object.entries(normalizePaints(paints))) {
        out[id] = {
            ...(paint.color ? { color: paint.color } : {}),
            ...(paint.auraColor ? { aura_color: paint.auraColor } : {}),
            ...(paint.auraRadius != null ? { aura_radius: paint.auraRadius } : {}),
        };
    }
    return out;
}

/** Fold several relations onto one link list. A rejected row is skipped, not fatal. */
export function upsertLinks(links, rows) {
    let current = links || [];
    const saved = [];
    const skipped = [];
    for (const row of rows || []) {
        const result = upsertLink(current, row);
        if (!result.ok) { skipped.push({ row, reason: result.reason }); continue; }
        current = result.links;
        saved.push(current[current.length - 1]);
    }
    return { links: current, saved, skipped };
}

/** One stored row → the link the solar draws, or null when the row is incomplete. */
export function normalizeLink(raw) {
    if (!raw || typeof raw !== "object") return null;
    const kind = raw.kind;
    const fromType = raw.fromType || raw.from_type;
    const toType = raw.toType || raw.to_type;
    const fromId = raw.fromId || raw.from_id;
    const toId = raw.toId || raw.to_id;
    if (!LINK_KINDS.includes(kind) || !NODE_TYPES.includes(fromType) || !NODE_TYPES.includes(toType)) return null;
    if (!fromId || !toId || (fromId === toId && fromType === toType)) return null;
    return {
        id: raw.id || `${kind}:${fromType}:${fromId}:${toType}:${toId}`,
        kind, fromType, fromId, toType, toId,
    };
}

export function normalizeLinks(raw) {
    const out = [];
    const seen = new Set();
    for (const row of Array.isArray(raw) ? raw : []) {
        const link = normalizeLink(row);
        if (!link) continue;
        const key = pairKey(link);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(link);
    }
    return out;
}

/** Firestore shape of one link (`enlaces` / `mesa_enlaces`). */
export function linkToRow(link) {
    return {
        id: link.id,
        kind: link.kind,
        from_type: link.fromType,
        from_id: link.fromId,
        to_type: link.toType,
        to_id: link.toId,
    };
}

function pairKey(link) {
    const a = `${link.fromType}:${link.fromId}`;
    const b = `${link.toType}:${link.toId}`;
    return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function samePair(a, b) {
    return pairKey(a) === pairKey(b);
}

/** `agrupa` and `sigue` may not close a directed cycle. `paralelo` may. */
export function wouldCycle(links, kind, fromId, toId) {
    if (fromId === toId) return true;
    if (kind === "paralelo") return false;
    const next = new Map();
    for (const link of links || []) {
        if (link.kind !== kind) continue;
        if (!next.has(link.fromId)) next.set(link.fromId, []);
        next.get(link.fromId).push(link.toId);
    }
    const stack = [toId];
    const seen = new Set();
    while (stack.length) {
        const id = stack.pop();
        if (id === fromId) return true;
        if (seen.has(id)) continue;
        seen.add(id);
        for (const kid of next.get(id) || []) stack.push(kid);
    }
    return false;
}

function linkId() {
    return `l_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * One relation per unordered pair. The new row replaces whatever was there.
 * @returns {{ ok: true, links: object[] } | { ok: false, reason: string }}
 */
export function upsertLink(links, next) {
    const link = normalizeLink({ ...next, id: next?.id || linkId() });
    if (!link) return { ok: false, reason: "Ese enlace no une dos nodos." };
    if (link.kind === "agrupa" && !canGroup(link.fromType, link.toType)) {
        return { ok: false, reason: "Ese par no se puede agrupar." };
    }
    const rest = (links || []).filter((row) => !samePair(row, link));
    if (link.kind !== "paralelo" && wouldCycle(rest, link.kind, link.fromId, link.toId)) {
        return { ok: false, reason: "Ese enlace cerraría un ciclo." };
    }
    return { ok: true, links: [...rest, link] };
}

/** Drop every link that touches a deleted node. */
export function dropNodeLinks(links, id) {
    return (links || []).filter((link) => link.fromId !== id && link.toId !== id);
}

/** Drop the single relation between two nodes, either direction. */
export function dropPair(links, aId, bId) {
    return (links || []).filter((link) => !(
        (link.fromId === aId && link.toId === bId) || (link.fromId === bId && link.toId === aId)
    ));
}

function stepsOf(ids, links, names) {
    const set = new Set(ids);
    const parent = new Map(ids.map((id) => [id, id]));
    const find = (id) => {
        let x = id;
        while (parent.get(x) !== x) x = parent.get(x);
        return x;
    };
    const union = (a, b) => {
        const ra = find(a);
        const rb = find(b);
        if (ra !== rb) parent.set(rb, ra);
    };
    for (const link of links) {
        if (link.kind === "paralelo" && set.has(link.fromId) && set.has(link.toId)) union(link.fromId, link.toId);
    }
    const groups = new Map();
    for (const id of ids) {
        const root = find(id);
        if (!groups.has(root)) groups.set(root, []);
        groups.get(root).push(id);
    }
    const label = (id) => names[id] || id;
    const steps = [...groups.values()].map((group) => group.slice().sort((a, b) => label(a).localeCompare(label(b), "es")));
    const idStep = new Map();
    steps.forEach((group, index) => group.forEach((id) => idStep.set(id, index)));
    const indeg = steps.map(() => 0);
    const adj = steps.map(() => []);
    const seenEdge = new Set();
    for (const link of links) {
        if (link.kind !== "sigue" || !set.has(link.fromId) || !set.has(link.toId)) continue;
        const from = idStep.get(link.fromId);
        const to = idStep.get(link.toId);
        if (from === to) continue;
        const key = `${from}>${to}`;
        if (seenEdge.has(key)) continue;
        seenEdge.add(key);
        adj[from].push(to);
        indeg[to] += 1;
    }
    const ready = [];
    indeg.forEach((degree, index) => { if (degree === 0) ready.push(index); });
    const ordered = [];
    const used = new Set();
    while (ready.length) {
        ready.sort((a, b) => label(steps[a][0]).localeCompare(label(steps[b][0]), "es"));
        const index = ready.shift();
        if (used.has(index)) continue;
        used.add(index);
        ordered.push(steps[index]);
        for (const next of adj[index]) {
            indeg[next] -= 1;
            if (indeg[next] === 0) ready.push(next);
        }
    }
    steps.forEach((group, index) => { if (!used.has(index)) ordered.push(group); });
    return ordered;
}

/**
 * Right-hand list. A node is repeated under every `agrupa` parent.
 * Inside a sibling set, `sigue` orders the steps and `paralelo` shares a step.
 * @returns {Array<Array<{ id: string, steps: Array<Array<object>> }>>}
 */
export function panelForest(ids, links, names = {}) {
    const present = new Set(ids);
    const children = new Map();
    const childOf = new Set();
    for (const link of links || []) {
        if (link.kind !== "agrupa" || !present.has(link.fromId) || !present.has(link.toId)) continue;
        if (!children.has(link.fromId)) children.set(link.fromId, []);
        if (!children.get(link.fromId).includes(link.toId)) children.get(link.fromId).push(link.toId);
        childOf.add(link.toId);
    }
    const roots = ids.filter((id) => !childOf.has(id));
    function build(id, stack) {
        if (stack.has(id)) return { id, steps: [] };
        const next = new Set(stack);
        next.add(id);
        const kids = (children.get(id) || []).filter((kid) => !next.has(kid));
        return {
            id,
            steps: stepsOf(kids, links || [], names).map((step) => step.map((kid) => build(kid, next))),
        };
    }
    const forest = stepsOf(roots, links || [], names).map((step) => step.map((id) => build(id, new Set())));
    const seen = new Set();
    const walk = (node) => {
        seen.add(node.id);
        node.steps.flat().forEach(walk);
    };
    forest.flat().forEach(walk);
    const missing = ids.filter((id) => !seen.has(id));
    for (const step of stepsOf(missing, links || [], names)) {
        forest.push(step.map((id) => ({ id, steps: [] })));
    }
    return forest;
}

/** Saving needs at least one: date or range, bucket, era, arc, or parent. */
export function anchorValid(a) {
    if (!a || a.precision === "inherited") return !!a?.parentId;
    return !!(a.start || a.end || (a.bucketUnit && a.bucketRef) || a.eraIds?.length || a.arcIds?.length || a.parentId);
}

/**
 * A dated child that falls outside its parent stretches the parent (`range`). Returns the parent's
 * new anchor, or null when nothing changes. Stretching never adds eras.
 */
export function stretchedParentAnchor(child, parent, eventById, eraById) {
    if (!parent || child.anchor.precision === "inherited") return null;
    const cs = anchorSpan(child, eventById, eraById);
    if (!cs) return null;
    const ps = anchorSpan(parent, eventById, eraById);
    if (ps && cs.y0 >= ps.y0 && cs.y1 <= ps.y1) return null;
    const y0 = ps ? Math.min(ps.y0, cs.y0) : cs.y0;
    const y1 = ps ? Math.max(ps.y1, cs.y1) : cs.y1;
    return { ...parent.anchor, precision: "range", start: String(y0), end: String(y1) };
}

/**
 * Deleting a parent leaves the child with a blank parent and its date. An inherited child keeps
 * the span it was drawn in.
 */
export function orphanedChildAnchor(child, parentSpan) {
    const next = { ...child.anchor, parentId: null };
    if (child.anchor.precision !== "inherited") return next;
    if (!parentSpan) return { ...next, precision: "year", start: null, end: null };
    if (parentSpan.y0 === parentSpan.y1) return { ...next, precision: "year", start: String(parentSpan.y0), end: null };
    return { ...next, precision: "range", start: String(parentSpan.y0), end: String(parentSpan.y1) };
}

/** Anchor → ficha columns of `lores/{id}/fichas` (model `acontecimientos`, memberships as arrays). */
export function anchorToColumns(anchor) {
    const a = blankAnchor(anchor || {});
    return {
        calendar: "dz",
        precision: a.precision,
        start: a.start,
        end: a.end,
        bucket_unit: a.bucketUnit,
        bucket_ref: a.bucketRef,
        era_ids: a.eraIds,
        arco_ids: a.arcIds,
        parent_id: a.parentId,
    };
}

/**
 * What else changes when a body is deleted. Era: arcos and acontecimientos lose it (an era bucket
 * goes blank). Arco: acontecimientos lose it. Acontecimiento: children lose the parent and keep the
 * span they were drawn in. What only hung on that body stays loose (no anchor).
 * @returns {{ arcs: Array<{ id: string, eraIds: string[] }>, events: Array<{ id: string, anchor: object }> }}
 */
export function removalPatches(kind, id, { eras = [], arcs = [], events = [] }) {
    const eventById = (x) => events.find((e) => e.id === x);
    const eraById = (x) => eras.find((e) => e.id === x);
    const out = { arcs: [], events: [] };
    if (kind === "era") {
        for (const arc of arcs) {
            if ((arc.eraIds || []).includes(id)) out.arcs.push({ id: arc.id, eraIds: arc.eraIds.filter((x) => x !== id) });
        }
        for (const ev of events) {
            const a = ev.anchor;
            const inBucket = a.bucketUnit === "era" && a.bucketRef === id;
            if (!a.eraIds.includes(id) && !inBucket) continue;
            const next = { ...a, eraIds: a.eraIds.filter((x) => x !== id) };
            if (inBucket) {
                next.bucketUnit = null;
                next.bucketRef = null;
                if (next.precision === "era") next.precision = "year";
            }
            out.events.push({ id: ev.id, anchor: next });
        }
    } else if (kind === "arco") {
        for (const ev of events) {
            if (ev.anchor.arcIds.includes(id)) out.events.push({ id: ev.id, anchor: { ...ev.anchor, arcIds: ev.anchor.arcIds.filter((x) => x !== id) } });
        }
    } else {
        const parent = eventById(id);
        const span = parent ? anchorSpan(parent, eventById, eraById) : null;
        for (const ev of events) {
            if (ev.anchor.parentId === id) out.events.push({ id: ev.id, anchor: orphanedChildAnchor(ev, span) });
        }
    }
    return out;
}

/* ── Calendar ── */

/** Days a day/range event covers (capped at 62), or one `{ month: true }` entry for month precision. */
export function dayList(anchor) {
    if (["year", "decade", "century", "eon", "era", "inherited"].includes(anchor.precision)) return [];
    const s = parseDZ(anchor.start);
    if (!s?.m) return [];
    if (anchor.precision === "month" || !s.d) return [{ y: s.y, m: s.m, month: true }];
    const en = parseDZ(anchor.end) || s;
    const out = [];
    const cur = new Date(Date.UTC(s.y, s.m - 1, s.d));
    const end = new Date(Date.UTC(en.y, (en.m || s.m) - 1, en.d || s.d));
    for (let n = 0; cur <= end && n < 62; n++) {
        out.push({ y: cur.getUTCFullYear(), m: cur.getUTCMonth() + 1, d: cur.getUTCDate() });
        cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return out;
}

/** A vague anchor (year or coarser) never takes a calendar cell. */
export function isVagueAnchor(anchor) {
    return ["year", "decade", "century", "eon", "era", "inherited"].includes(anchor.precision);
}

/** Session mark on a calendar day only for a full D.Z. day `YYYY-MM-DD`. Month or year: no cell. */
export function sessionMarkDay(session) {
    const p = parseDZ(session?.inGame);
    return p?.d ? p : null;
}

/* ── Session contract ── */

/** Label next to a hung session: the session's own `inGame`, never the host event's year. */
export function sessionDayLabel(session) {
    const v = String(session?.inGame || "").trim();
    return v && parseDZ(v) ? `Día ${fmtWhen(v)}` : "Sin fecha D.Z. en la sesión";
}

export function sessionsHungOn(sessions, eventId) {
    return (sessions || []).filter((s) => (s.eventIds || []).includes(eventId));
}

/** Recap as plain text: mention markup `@[Name](id)` becomes `Name`. */
export function plainRecap(text) {
    return String(text || "").replace(/@\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/@\[([^\]]+)\]/g, "$1");
}

/**
 * Hang a session on an event: each person of that night enters as `confirmado` with source
 * `session:{id}`. A manual `probable` becomes `confirmado` and keeps `manual`.
 * @param {Array<{ kind: string, id: string, status: string, sources: string[], manualStatus?: string }>} list
 * @param {string} sessionId
 * @param {Array<{ kind: "wiki"|"vtt", id: string }>} people
 */
export function addSessionSource(list, sessionId, people) {
    const source = `session:${sessionId}`;
    const out = (list || []).map((p) => ({ ...p, sources: [...(p.sources || [])] }));
    for (const person of people || []) {
        const hit = out.find((p) => p.kind === person.kind && p.id === person.id);
        if (!hit) {
            out.push({ kind: person.kind, id: person.id, status: "confirmado", sources: [source] });
            continue;
        }
        if (!hit.sources.includes(source)) hit.sources.push(source);
        if (hit.status !== "confirmado") {
            if (hit.sources.includes("manual")) hit.manualStatus = hit.status;
            hit.status = "confirmado";
        }
    }
    return out;
}

/**
 * Unhang: drop that source. Nobody else left → the person leaves. Only `manual` left → the status
 * the DM set by hand comes back.
 */
export function removeSessionSource(list, sessionId) {
    const source = `session:${sessionId}`;
    const out = [];
    for (const p of list || []) {
        const sources = (p.sources || []).filter((s) => s !== source);
        if (!sources.length) continue;
        const next = { ...p, sources };
        const onlyManual = sources.every((s) => s === "manual");
        if (onlyManual && p.manualStatus) {
            next.status = p.manualStatus;
            delete next.manualStatus;
        }
        out.push(next);
    }
    return out;
}
