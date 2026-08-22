/**
 * Shared ego-circuit neighbor inputs for dossier RED and campaign Neural Lab.
 */

import {
    getRelationDisplayLabel,
    isAffinityRelation,
    isStructuralRelation,
    resolveRelationStrength,
} from "../constants/wikiRelationTypes.js";
import { resolveWikiEntityImagePath } from "./resolveWikiEntityImage.js";
import {
    buildEgoGraphDataset,
    buildGraphDataset,
} from "./wikiGraphEntities.js";

export const EGO_CIRCUIT_HOPS = 2;

/**
 * Direct affinity + structural neighbors of a hub entity.
 * @returns {{ affinity: object[], structural: object[] }}
 */
export function buildDirectCircuitNeighbors({
    hubId,
    hubEntity,
    relations = [],
    entityById,
    charactersById = {},
    locations = {},
}) {
    const affinity = [];
    const structural = [];
    if (!hubId || !hubEntity) return { affinity, structural };

    const selfType = hubEntity?.entityType;
    for (const rel of relations || []) {
        if (!rel) continue;
        const a = rel.fromEntityId;
        const b = rel.toEntityId;
        if (a !== hubId && b !== hubId) continue;
        const otherId = a === hubId ? b : a;
        const other = entityById.get(otherId);
        if (!other) continue;
        const outgoing = a === hubId;
        const fromType = outgoing ? selfType : other.entityType;
        const toType = outgoing ? other.entityType : selfType;
        const args = {
            relationType: rel.relationType,
            fromEntityType: fromType,
            toEntityType: toType,
        };

        const linkedChar = other.linkedVttCharacterId
            ? (charactersById[other.linkedVttCharacterId] || null)
            : null;
        const imagePath = resolveWikiEntityImagePath(other, locations, charactersById);
        const base = {
            id: otherId,
            entityId: otherId,
            title: other.title || otherId,
            entityType: other.entityType,
            relationId: rel.id,
            relationType: rel.relationType,
            relationLabel: getRelationDisplayLabel(rel.relationType, outgoing),
            imagePath,
            avatarStatus: linkedChar?.status || "alive",
            avatarCrop: linkedChar?.tokenCrop || null,
        };

        if (isAffinityRelation(args)) {
            affinity.push({
                ...base,
                sync: resolveRelationStrength({
                    ...args,
                    strength: rel.strength,
                }),
            });
        } else if (isStructuralRelation(args)) {
            structural.push(base);
        }
    }
    return { affinity, structural };
}

/**
 * Hop-2+ affinity secondaries around hub (DM orbit expansion).
 * @returns {object[]}
 */
export function buildSecondaryCircuitNodes({
    hubId,
    entities = [],
    relations = [],
    entityById,
    directNeighbors,
    charactersById = {},
    locations = {},
    scope = "ego",
    maxSecondary = 24,
}) {
    if (!hubId || scope === "direct") return [];

    const dataset = scope === "full"
        ? buildGraphDataset(entities, relations)
        : buildEgoGraphDataset(entities, relations, hubId, EGO_CIRCUIT_HOPS);

    const directIds = new Set(directNeighbors.affinity.map((n) => n.entityId));
    directNeighbors.structural.forEach((n) => directIds.add(n.entityId));
    directIds.add(hubId);

    const affinityDirect = new Set(directNeighbors.affinity.map((n) => n.entityId));

    const adj = new Map();
    for (const r of dataset.graphRelations || []) {
        const a = r.fromEntityId;
        const b = r.toEntityId;
        if (!a || !b) continue;
        if (!isAffinityRelation({
            relationType: r.relationType,
            fromEntityType: entityById.get(a)?.entityType,
            toEntityType: entityById.get(b)?.entityType,
        })) continue;
        if (!adj.has(a)) adj.set(a, []);
        if (!adj.has(b)) adj.set(b, []);
        adj.get(a).push(b);
        adj.get(b).push(a);
    }

    const sortNeighbors = (ids) => [...ids].sort((a, b) => {
        const pa = affinityDirect.has(a) ? 0 : 1;
        const pb = affinityDirect.has(b) ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return String(a).localeCompare(String(b));
    });

    const dist = new Map([[hubId, 0]]);
    const parentOf = new Map();
    const queue = [hubId];
    const maxHops = scope === "full" ? 8 : EGO_CIRCUIT_HOPS;

    for (let i = 0; i < queue.length; i++) {
        const id = queue[i];
        const d = dist.get(id) ?? 0;
        if (d >= maxHops) continue;
        for (const next of sortNeighbors(adj.get(id) || [])) {
            if (dist.has(next)) continue;
            dist.set(next, d + 1);
            parentOf.set(next, id);
            queue.push(next);
        }
    }

    const out = [];
    for (const e of dataset.graphEntities) {
        if (!e?.id || directIds.has(e.id)) continue;
        const hop = dist.get(e.id);
        if (hop == null || hop < 2) continue;
        const linkedChar = e.linkedVttCharacterId
            ? (charactersById[e.linkedVttCharacterId] || null)
            : null;
        out.push({
            id: e.id,
            entityId: e.id,
            title: e.title || e.id,
            entityType: e.entityType,
            hop,
            parentId: parentOf.get(e.id) || hubId,
            imagePath: resolveWikiEntityImagePath(e, locations, charactersById),
            avatarStatus: linkedChar?.status || "alive",
            avatarCrop: linkedChar?.tokenCrop || null,
        });
    }
    out.sort((a, b) => (a.hop - b.hop) || String(a.title).localeCompare(String(b.title), "es"));
    return out.slice(0, maxSecondary);
}
