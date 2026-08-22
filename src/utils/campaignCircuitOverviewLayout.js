/**
 * Campaign Neural Lab overview: deduped personajes on a square grid.
 * Saved positions override defaults. Affinity edges always available.
 */

import {
    CIRCUIT_HUB_X,
    CIRCUIT_HUB_Y,
    CIRCUIT_NODE_H,
    CIRCUIT_NODE_W,
    CIRCUIT_WORLD_H,
    CIRCUIT_WORLD_W,
} from "./circuitLayout.js";
import { isKnownPlayerCharacterName, isPlayerCharacter } from "./characterRosterKind.js";
import { WIKI_ENTITY_TYPES } from "../constants/wikiEntityTypes.js";
import {
    isAffinityRelation,
} from "../constants/wikiRelationTypes.js";

const MUTED = "#aaaaaa";
const PJ_COLOR = "#00f2ea";

const CELL_GAP_X = 52;
const CELL_GAP_Y = 44;
const GRID_ORIGIN_X = 220;
const GRID_ORIGIN_Y = 180;
const WORLD_PAD = 140;

/**
 * @param {object} entity wiki entity
 * @param {Record<string, object>} charactersById
 * @returns {'pj'|'npc'}
 */
export function classifyWikiPersonajeKind(entity, charactersById = {}) {
    if (!entity || entity.entityType !== WIKI_ENTITY_TYPES.PERSONAJE) return "npc";
    const vttId = entity.linkedVttCharacterId;
    if (vttId && charactersById[vttId]) {
        return isPlayerCharacter(charactersById[vttId]) ? "pj" : "npc";
    }
    if (isKnownPlayerCharacterName(entity.title)) return "pj";
    return "npc";
}

function normalizeTitleKey(title) {
    return String(title || "")
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .trim()
        .toLowerCase();
}

function preferPersonajeEntity(a, b) {
    const score = (e) => {
        let s = 0;
        if (e?.linkedVttCharacterId) s += 100;
        if (e?.visibility === "players") s += 20;
        if (e?.imagePath || e?.portraitPath || e?.avatarUrl) s += 10;
        if (e?.customFields && Object.keys(e.customFields).length) s += 5;
        return s;
    };
    const sa = score(a);
    const sb = score(b);
    if (sa !== sb) return sa >= sb ? a : b;
    return String(a.id).localeCompare(String(b.id)) <= 0 ? a : b;
}

/**
 * Collapse duplicate PERSONAJE wiki rows (same VTT link or same title).
 * @param {object[]} entities
 * @returns {{ entities: object[], aliasToCanonical: Map<string, string> }}
 */
export function dedupePersonajeEntities(entities = []) {
    const personajes = (entities || []).filter(
        (e) => e?.id && e.entityType === WIKI_ENTITY_TYPES.PERSONAJE,
    );
    const aliasToCanonical = new Map();
    const byVtt = new Map();
    const byTitle = new Map();
    const kept = new Map();

    const remapAliases = (loserId, winnerId) => {
        aliasToCanonical.set(loserId, winnerId);
        for (const [from, to] of [...aliasToCanonical.entries()]) {
            if (to === loserId) aliasToCanonical.set(from, winnerId);
        }
    };

    for (const e of personajes) {
        const vtt = e.linkedVttCharacterId ? String(e.linkedVttCharacterId) : "";
        if (vtt && byVtt.has(vtt)) {
            const otherId = byVtt.get(vtt);
            const other = kept.get(otherId);
            const winner = preferPersonajeEntity(other, e);
            const loser = winner.id === e.id ? other : e;
            kept.delete(loser.id);
            kept.set(winner.id, winner);
            byVtt.set(vtt, winner.id);
            const titleKey = normalizeTitleKey(winner.title || winner.id);
            if (titleKey) byTitle.set(titleKey, winner.id);
            remapAliases(loser.id, winner.id);
            continue;
        }

        const titleKey = normalizeTitleKey(e.title || e.id);
        if (titleKey && byTitle.has(titleKey)) {
            const otherId = byTitle.get(titleKey);
            const other = kept.get(otherId);
            const aVtt = e.linkedVttCharacterId || null;
            const bVtt = other?.linkedVttCharacterId || null;
            // Distinct VTT links with same display name → keep both
            if (aVtt && bVtt && aVtt !== bVtt) {
                kept.set(e.id, e);
                byVtt.set(String(aVtt), e.id);
                continue;
            }
            const winner = preferPersonajeEntity(other, e);
            const loser = winner.id === e.id ? other : e;
            kept.delete(loser.id);
            kept.set(winner.id, winner);
            byTitle.set(titleKey, winner.id);
            if (winner.linkedVttCharacterId) {
                byVtt.set(String(winner.linkedVttCharacterId), winner.id);
            }
            remapAliases(loser.id, winner.id);
            continue;
        }

        kept.set(e.id, e);
        if (vtt) byVtt.set(vtt, e.id);
        if (titleKey) byTitle.set(titleKey, e.id);
    }

    return {
        entities: [...kept.values()],
        aliasToCanonical,
    };
}

export function resolveCanonicalEntityId(id, aliasToCanonical) {
    if (!id) return id;
    let cur = id;
    const seen = new Set();
    while (aliasToCanonical?.has?.(cur) && !seen.has(cur)) {
        seen.add(cur);
        cur = aliasToCanonical.get(cur);
    }
    return cur;
}

/**
 * @param {object[]} entities
 * @param {Record<string, object>} [charactersById]
 * @returns {{ items: object[], aliasToCanonical: Map<string, string> }}
 */
export function listCampaignPersonajeEntities(entities = [], charactersById = {}) {
    const { entities: deduped, aliasToCanonical } = dedupePersonajeEntities(entities);
    const items = deduped
        .map((e) => ({
            entity: e,
            kind: classifyWikiPersonajeKind(e, charactersById),
        }))
        .sort((a, b) => {
            const ka = a.kind === "pj" ? 0 : 1;
            const kb = b.kind === "pj" ? 0 : 1;
            if (ka !== kb) return ka - kb;
            return String(a.entity.title || a.entity.id).localeCompare(
                String(b.entity.title || b.entity.id),
                "es",
            );
        });
    return { items, aliasToCanonical };
}

/**
 * Place items on a left-to-right, top-to-bottom square-ish grid.
 */
export function placeInSquareGrid(items, {
    originX = GRID_ORIGIN_X,
    originY = GRID_ORIGIN_Y,
    cols = null,
} = {}) {
    const n = items.length;
    if (n === 0) return [];
    const cellW = CIRCUIT_NODE_W + CELL_GAP_X;
    const cellH = CIRCUIT_NODE_H + CELL_GAP_Y;
    const colCount = Math.max(1, cols || Math.ceil(Math.sqrt(n)));
    return items.map((item, i) => {
        const col = i % colCount;
        const row = Math.floor(i / colCount);
        return {
            ...item,
            x: Math.round(originX + col * cellW),
            y: Math.round(originY + row * cellH),
        };
    });
}

/**
 * All undirected affinity edges between PERSONAJE (canonical ids).
 */
export function buildOverviewAffinityEdges(entities = [], relations = []) {
    const { entities: personajes, aliasToCanonical } = dedupePersonajeEntities(entities);
    const ids = new Set(personajes.map((e) => e.id));
    const entityById = new Map(personajes.map((e) => [e.id, e]));
    const seen = new Set();
    const edges = [];

    for (const rel of relations || []) {
        const a = resolveCanonicalEntityId(rel?.fromEntityId, aliasToCanonical);
        const b = resolveCanonicalEntityId(rel?.toEntityId, aliasToCanonical);
        if (!a || !b || a === b) continue;
        if (!ids.has(a) || !ids.has(b)) continue;
        if (!isAffinityRelation({
            relationType: rel.relationType,
            fromEntityType: entityById.get(a)?.entityType,
            toEntityType: entityById.get(b)?.entityType,
        })) continue;
        const key = a < b ? `${a}::${b}` : `${b}::${a}`;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push({
            fromId: a,
            toId: b,
            relationId: rel.id,
            relationType: rel.relationType,
        });
    }

    return { edges, aliasToCanonical };
}

/**
 * BFS affinity waves using canonical personaje ids.
 */
export function computeOverviewRelationWaves(
    anchorId,
    entities = [],
    relations = [],
    maxDepth = 3,
) {
    const { entities: personajes, aliasToCanonical } = dedupePersonajeEntities(entities);
    const canonicalAnchor = resolveCanonicalEntityId(anchorId, aliasToCanonical);
    const ids = new Set(personajes.map((e) => e.id));
    if (!canonicalAnchor || !ids.has(canonicalAnchor)) {
        return { waves: [], aliasToCanonical };
    }

    const entityById = new Map(personajes.map((e) => [e.id, e]));
    const { edges: allEdges } = buildOverviewAffinityEdges(entities, relations);
    const adj = new Map();
    for (const edge of allEdges) {
        if (!adj.has(edge.fromId)) adj.set(edge.fromId, []);
        if (!adj.has(edge.toId)) adj.set(edge.toId, []);
        adj.get(edge.fromId).push({ toId: edge.toId, relationId: edge.relationId });
        adj.get(edge.toId).push({ toId: edge.fromId, relationId: edge.relationId });
    }

    const visited = new Set([canonicalAnchor]);
    const waves = [{ depth: 0, nodeIds: [canonicalAnchor], edges: [] }];
    let frontier = [canonicalAnchor];

    for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth += 1) {
        const nodeIds = [];
        const edges = [];
        const next = [];
        for (const fromId of frontier) {
            const links = (adj.get(fromId) || []).slice().sort((x, y) => (
                String(entityById.get(x.toId)?.title || x.toId)
                    .localeCompare(String(entityById.get(y.toId)?.title || y.toId), "es")
            ));
            for (const link of links) {
                if (visited.has(link.toId)) continue;
                visited.add(link.toId);
                nodeIds.push(link.toId);
                edges.push({ fromId, toId: link.toId, relationId: link.relationId });
                next.push(link.toId);
            }
        }
        if (!nodeIds.length) break;
        waves.push({ depth, nodeIds, edges });
        frontier = next;
    }

    return { waves, aliasToCanonical };
}

function edgeKey(a, b) {
    return a < b ? `${a}::${b}` : `${b}::${a}`;
}

/**
 * Attach affinity edges for overview.
 * With a selection, impact-path traces (onda 0…depth) sit on the front layer;
 * everyone else stays faint on the back layer.
 */
export function withOverviewEdges(
    layout,
    entities = [],
    relations = [],
    selectedId = null,
    maxDepth = 3,
) {
    if (!layout) return layout;
    const alias = layout.aliasToCanonical || new Map();
    const visible = layout.visibleIds
        || new Set((layout.nodes || []).map((n) => n.id));
    const { edges: all } = buildOverviewAffinityEdges(entities, relations);
    const sel = selectedId
        ? resolveCanonicalEntityId(selectedId, alias)
        : null;
    const depth = Math.max(1, Math.min(8, Math.round(Number(maxDepth) || 3)));
    const { waves } = sel
        ? computeOverviewRelationWaves(sel, entities, relations, depth)
        : { waves: [] };

    const litIds = new Set();
    const impactKeys = new Set();
    for (const wave of waves) {
        for (const id of wave.nodeIds || []) litIds.add(id);
        for (const e of wave.edges || []) {
            if (!e?.fromId || !e?.toId) continue;
            impactKeys.add(edgeKey(e.fromId, e.toId));
        }
    }
    if (sel) litIds.add(sel);

    const edges = all
        .filter((e) => visible.has(e.fromId) && visible.has(e.toId))
        .map((e) => {
            const impact = Boolean(sel && impactKeys.has(edgeKey(e.fromId, e.toId)));
            return {
                fromId: e.fromId,
                toId: e.toId,
                relationId: e.relationId,
                secondary: Boolean(sel) && !impact,
                layer: impact ? "front" : "back",
                traceClass: !sel ? "idle" : impact ? "impact" : "secondary",
            };
        });

    return { ...layout, edges, overviewWaves: waves, litIds };
}

/**
 * @param {{
 *   entities?: object[],
 *   charactersById?: Record<string, object>,
 *   imagePathFor?: (entity: object) => string|null,
 *   positions?: Record<string, { x: number, y: number }>,
 *   kindFilter?: 'all'|'pj'|'npc',
 *   searchQuery?: string,
 *   relations?: object[],
 *   selectedId?: string|null,
 *   labDepth?: number,
 * }} opts
 */
export function buildCampaignCharacterOverviewLayout({
    entities = [],
    charactersById = {},
    imagePathFor = null,
    positions = null,
    kindFilter = "all",
    searchQuery = "",
    relations = [],
    selectedId = null,
    labDepth = 3,
} = {}) {
    const q = String(searchQuery || "").trim().toLowerCase();
    const { items: listedAll, aliasToCanonical } = listCampaignPersonajeEntities(
        entities,
        charactersById,
    );
    let listed = listedAll;
    if (kindFilter === "pj") listed = listed.filter((x) => x.kind === "pj");
    if (kindFilter === "npc") listed = listed.filter((x) => x.kind === "npc");
    if (q) {
        listed = listed.filter((x) => {
            const title = String(x.entity.title || x.entity.id).toLowerCase();
            return title.includes(q);
        });
    }

    const cols = Math.max(3, Math.ceil(Math.sqrt(Math.max(1, listed.length))));
    const placed = placeInSquareGrid(listed, {
        originX: GRID_ORIGIN_X,
        originY: GRID_ORIGIN_Y,
        cols,
    });

    let minX = GRID_ORIGIN_X;
    let maxX = GRID_ORIGIN_X;
    let minY = GRID_ORIGIN_Y;
    let maxY = GRID_ORIGIN_Y;

    const nodes = placed.map(({ entity, kind, x, y }) => {
        const isPj = kind === "pj";
        const saved = positions?.[entity.id];
        const useX = Number.isFinite(saved?.x) ? Math.round(saved.x) : x;
        const useY = Number.isFinite(saved?.y) ? Math.round(saved.y) : y;
        minX = Math.min(minX, useX);
        maxX = Math.max(maxX, useX);
        minY = Math.min(minY, useY);
        maxY = Math.max(maxY, useY);
        const linkedChar = entity.linkedVttCharacterId
            ? (charactersById[entity.linkedVttCharacterId] || null)
            : null;
        return {
            id: entity.id,
            entityId: entity.id,
            kind: "satellite",
            title: entity.title || entity.id,
            entityType: entity.entityType,
            rankLabel: isPj ? "PJ" : "NPC",
            rankColor: isPj ? PJ_COLOR : MUTED,
            color: isPj ? PJ_COLOR : MUTED,
            x: useX,
            y: useY,
            w: CIRCUIT_NODE_W,
            h: CIRCUIT_NODE_H,
            sync: null,
            relationLabel: isPj ? "Operador" : "Contacto",
            imagePath: typeof imagePathFor === "function" ? imagePathFor(entity) : null,
            avatarStatus: linkedChar?.status || "alive",
            avatarCrop: linkedChar?.tokenCrop || null,
            overviewKind: kind,
            positionSaved: Boolean(saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)),
        };
    });

    const visibleIds = new Set(nodes.map((n) => n.id));
    const padX = CIRCUIT_NODE_W / 2 + WORLD_PAD;
    const padY = CIRCUIT_NODE_H / 2 + WORLD_PAD;
    const worldW = Math.max(CIRCUIT_WORLD_W, Math.ceil(maxX + padX));
    const worldH = Math.max(CIRCUIT_WORLD_H, Math.ceil(maxY + padY));
    const hubX = Math.round((minX + maxX) / 2) || CIRCUIT_HUB_X;
    const hubY = Math.round((minY + maxY) / 2) || CIRCUIT_HUB_Y;

    const base = {
        nodes,
        edges: [],
        hubId: null,
        worldW,
        worldH,
        hubX,
        hubY,
        aliasToCanonical,
        visibleIds,
    };

    return withOverviewEdges(base, entities, relations, selectedId, labDepth);
}
