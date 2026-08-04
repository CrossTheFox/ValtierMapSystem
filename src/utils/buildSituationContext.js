/**
 * buildSituationContext.js
 *
 * Builds a subgraph-focused context pack for LLM prompts, starting from an anchor entity
 * and expanding outward via BFS weighted by relation type priority.
 *
 * Priority matrix (from plan-ia-situaciones.md §3):
 *   Alta:  vive_en, sede_en, controla, enemigo_de, aliado_de
 *   Media: miembro_confirmado_de, perteneciente_a, ocurrio_en, participo_en, desencadeno
 *   Baja:  relacionado_con (only if strength !== 0 or has label), all others
 *
 * Also exports buildCascadeContext() for the Onda catalizadora mode:
 *   - Pre-resolves entity mentions from the DJ's event text (fuzzy matching)
 *   - Uses wider BFS limits
 *   - Pre-computes wave assignments per entity
 *   - Serializes reaction archetype (PANGeA) when present on personaje entities
 *
 * Usage:
 *   import { buildSituationContext, buildCascadeContext } from "../utils/buildSituationContext";
 */

import { WIKI_ENTITY_TYPE_LABELS, WIKI_ENTITY_TYPES } from "../constants/wikiEntityTypes.js";
import { WIKI_RELATION_TYPE_LABELS, WIKI_RELATION_TYPES as R } from "../constants/wikiRelationTypes.js";
import { parseMentions, parseSlugMentions } from "./wikiSlug.js";
import { resolvedEntitiesFromText } from "./resolveWikiMentions.js";
import {
    REACTION_ARCHETYPE_LABELS,
    REACTION_ARCHETYPE_AI_DESCRIPTIONS,
    NARRATIVE_STATE_LABELS,
    STRESS_RESPONSE_LABELS,
    STRESS_RESPONSE_AI_DESCRIPTIONS,
    COLLECTIVE_ARCHETYPE_LABELS,
    COLLECTIVE_ARCHETYPE_AI_DESCRIPTIONS,
} from "../constants/wiki/entityFieldSchemas.js";
import {
    CASCADE_CONTEXT_OPTS,
    CASCADE_WAVE_RELATION_WEIGHTS,
} from "../constants/wiki/narrativeAiSchemas.js";
import {
    resolveNarrativeAiConfig,
    isCharacterDead,
    getExplicitlyMentionedEntityIds,
    shouldIncludeInAiImpacts,
    shouldIncludeInAiPropagation,
    shouldIncludeInCollectiveImpacts,
    buildAiGuardrailsPrompt,
} from "../constants/wiki/narrativeAiConfig.js";
import { filterGraphEntities } from "./wikiGraphEntities.js";

// ── Priority tiers ────────────────────────────────────────────────────────────

const PRIORITY_HIGH = new Set([
    R.VIVE_EN, R.SEDE_EN, R.CONTROLA, R.ENEMIGO_DE, R.ALIADO_DE,
]);
const PRIORITY_MEDIUM = new Set([
    R.MIEMBRO_CONFIRMADO_DE, R.PERTENECIENTE_A, R.OCURRIO_EN,
    R.PARTICIPO_EN, R.DESENCADENO,
]);

/** Slots reserved after BFS for @[slug] / refs expansion (plan §2.2). */
const MENTION_RESERVE = 10;

function getRelationPriority(relation) {
    const t = relation.relationType;
    if (PRIORITY_HIGH.has(t))   return 0;
    if (PRIORITY_MEDIUM.has(t)) return 1;
    // RELACIONADO_CON only if meaningful
    if (t === R.RELACIONADO_CON) {
        return (relation.strength !== 0 || relation.label) ? 2 : 99;
    }
    return 2;
}

// ── Serializers ───────────────────────────────────────────────────────────────

function entityToText(entity, compact = false) {
    const typeLabel = WIKI_ENTITY_TYPE_LABELS[entity.entityType] || entity.entityType;
    const lines = [`## ${entity.title} [${typeLabel}]`];
    if (entity.summary) lines.push(`> ${entity.summary}`);
    if (!compact && entity.body?.trim()) {
        lines.push("", entity.body.trim());
    }
    if (entity.tags?.length) {
        lines.push(`Etiquetas: ${entity.tags.join(", ")}`);
    }
    return lines.join("\n").trimEnd();
}

/**
 * Unified serializer for the narrative event (cascade) mode.
 * Includes wave label, PANGeA archetype, and the new personality / collective fields.
 *
 * @param {object} entity
 * @param {number} wave        — 0 = anchor
 * @param {boolean} compact    — outer-ring entities get compact format (no body)
 * @param {{ relationsForEntity?: object[], entityMap?: Map }} [ctx]
 */
function entityToTextForAi(entity, wave = 0, compact = false, ctx = {}) {
    const typeLabel = WIKI_ENTITY_TYPE_LABELS[entity.entityType] || entity.entityType;
    const waveLabel = wave === 0 ? "ANCLA" : `ONDA ${wave}`;
    const deadTag = isCharacterDead(entity) ? " [FALLECIDO — solo referencia histórica]" : "";
    const lines = [`## ${entity.title} [${typeLabel}] [${waveLabel}]${deadTag}`];
    if (entity.summary) lines.push(`> ${entity.summary}`);

    const T = WIKI_ENTITY_TYPES;

    if (entity.entityType === T.PERSONAJE) {
        const cf = entity.customFields?.personaje ?? {};

        // PANGeA reaction archetype
        if (cf.reactionArchetype) {
            const archetypeLabel = REACTION_ARCHETYPE_LABELS[cf.reactionArchetype] ?? cf.reactionArchetype;
            const archetypeDesc  = REACTION_ARCHETYPE_AI_DESCRIPTIONS[cf.reactionArchetype] ?? "";
            lines.push(`Arquetipo de reacción: **${archetypeLabel}** — ${archetypeDesc}`);
        }

        // Narrative personality memory (new fields)
        if (cf.narrativeState) {
            const stateLabel = NARRATIVE_STATE_LABELS[cf.narrativeState] ?? cf.narrativeState;
            lines.push(`Estado narrativo actual: **${stateLabel}**`);
        }
        if (cf.stressResponse) {
            const stressLabel = STRESS_RESPONSE_LABELS[cf.stressResponse] ?? cf.stressResponse;
            const stressDesc  = STRESS_RESPONSE_AI_DESCRIPTIONS[cf.stressResponse] ?? "";
            lines.push(`Patrón de estrés: **${stressLabel}** — ${stressDesc}`);
        }
        const traits = Array.isArray(cf.narrativeTraits) ? cf.narrativeTraits : [];
        if (traits.length) {
            lines.push(`Rasgos narrativos: ${traits.join("; ")}`);
        }
        if (cf.bondNotes) {
            lines.push(`Anclas emocionales: ${cf.bondNotes}`);
        }
    } else if (entity.entityType === T.LOCACION || entity.entityType === T.ORGANIZACION) {
        const ns = entity.entityType === T.LOCACION ? "locacion" : "organizacion";
        const cf = entity.customFields?.[ns] ?? {};

        if (cf.collectiveArchetype) {
            const arcLabel = COLLECTIVE_ARCHETYPE_LABELS[cf.collectiveArchetype] ?? cf.collectiveArchetype;
            const arcDesc  = COLLECTIVE_ARCHETYPE_AI_DESCRIPTIONS[cf.collectiveArchetype] ?? "";
            lines.push(`Temperamento colectivo: **${arcLabel}** — ${arcDesc}`);
        }
        if (cf.collectiveMood) {
            lines.push(`Estado colectivo actual: ${cf.collectiveMood}`);
        }
    }

    if (!compact && entity.body?.trim()) {
        lines.push("", entity.body.trim());
    }
    if (entity.tags?.length) {
        lines.push(`Etiquetas: ${entity.tags.join(", ")}`);
    }

    // Vínculos directos con entidades del evento (inner ring, wave >= 1)
    if (ctx.relationsForEntity?.length) {
        const entityMap = ctx.entityMap ?? new Map();
        const bondLines = ctx.relationsForEntity
            .filter((r) => r.strength && Math.abs(r.strength) >= 3)
            .map((r) => {
                const other = entityMap.get(
                    r.fromEntityId === entity.id ? r.toEntityId : r.fromEntityId
                );
                if (!other) return null;
                const relLabel = WIKI_RELATION_TYPE_LABELS[r.relationType] ?? r.relationType;
                const note     = r.label ? ` (${r.label})` : "";
                return `  · ${other.title} — [${relLabel}]${note} [fuerza: ${r.strength}]`;
            })
            .filter(Boolean);
        if (bondLines.length) {
            lines.push("Vínculos directos relevantes:");
            lines.push(...bondLines);
        }
    }

    return lines.join("\n").trimEnd();
}

/** Backward-compat alias kept for callers outside cascade mode. */
function entityToTextCascade(entity, wave, compact = false) {
    return entityToTextForAi(entity, wave, compact);
}

function relationsToText(relations, entityMap) {
    if (!relations.length) return "";
    const lines = relations.map((r) => {
        const fromTitle = entityMap.get(r.fromEntityId)?.title ?? r.fromEntityId;
        const toTitle   = entityMap.get(r.toEntityId)?.title   ?? r.toEntityId;
        const relLabel  = WIKI_RELATION_TYPE_LABELS[r.relationType] ?? r.relationType;
        const note      = r.label ? ` (${r.label})` : "";
        const strength  = r.strength && r.strength !== 0 ? ` [fuerza: ${r.strength}]` : "";
        return `- ${fromTitle} → [${relLabel}] → ${toTitle}${note}${strength}`;
    });
    return `## Relaciones en el subgrafo\n\n${lines.join("\n")}`;
}

// ── BFS subgraph builder ──────────────────────────────────────────────────────

/**
 * Expand from anchorEntityId up to maxDepth hops, sorted by relation priority.
 * Returns { orderedIds: string[], ring: Map<id, depth>, relevantRelations: relation[] }
 */
function buildSubgraph(anchorEntityId, entities, relations, { maxDepth, maxEntities }) {
    const entityById  = new Map(entities.map((e) => [e.id, e]));
    const visited     = new Map(); // id → depth
    const queue       = [{ id: anchorEntityId, depth: 0 }];
    const orderedIds  = [];
    const relsByEntity = new Map(); // entityId → relation[]

    // Index relations per entity
    for (const r of relations) {
        const pri = getRelationPriority(r);
        if (pri === 99) continue; // skip meaningless relacionado_con
        for (const id of [r.fromEntityId, r.toEntityId]) {
            if (!relsByEntity.has(id)) relsByEntity.set(id, []);
            relsByEntity.get(id).push(r);
        }
    }

    // BFS
    while (queue.length > 0 && orderedIds.length < maxEntities) {
        const { id, depth } = queue.shift();
        if (visited.has(id)) continue;
        if (!entityById.has(id)) continue;

        visited.set(id, depth);
        orderedIds.push(id);

        if (depth < maxDepth) {
            const rels = (relsByEntity.get(id) ?? []).slice().sort(
                (a, b) => getRelationPriority(a) - getRelationPriority(b)
            );
            for (const r of rels) {
                const neighborId = r.fromEntityId === id ? r.toEntityId : r.fromEntityId;
                if (!visited.has(neighborId)) {
                    queue.push({ id: neighborId, depth: depth + 1 });
                }
            }
        }
    }

    // Collect relations where BOTH endpoints are in the subgraph
    const subgraphIds  = new Set(orderedIds);
    const relevantRels = relations
        .filter((r) => subgraphIds.has(r.fromEntityId) && subgraphIds.has(r.toEntityId)
                        && getRelationPriority(r) < 99)
        .sort((a, b) => getRelationPriority(a) - getRelationPriority(b));

    return { orderedIds, ring: visited, relevantRelations: relevantRels };
}

// ── Mention / ref expansion (Fase 2.2) ───────────────────────────────────────

function buildSlugIndex(entities) {
    const slugToId = new Map();
    for (const e of entities) {
        if (e.slug) slugToId.set(e.slug, e.id);
        slugToId.set(e.id, e.id);
    }
    return slugToId;
}

function collectLinkedEntityIds(entity, slugToId) {
    const ids = new Set();
    const text = [entity.body, entity.summary].filter(Boolean).join("\n");

    for (const m of parseMentions(text)) {
        if (m.entityId) ids.add(m.entityId);
    }
    for (const slug of parseSlugMentions(text)) {
        const id = slugToId.get(slug);
        if (id) ids.add(id);
    }
    for (const v of Object.values(entity.refs ?? {})) {
        if (typeof v === "string" && v) {
            ids.add(slugToId.get(v) ?? v);
        }
    }
    return ids;
}

/**
 * Pull in entities referenced via @[slug], @[title](id) or refs{} from the BFS core.
 * Fills gaps when maxEntities cuts the graph before high-signal neighbors (e.g. Motor Zarken).
 */
function expandMentionNeighbors(orderedIds, entityById, slugToId, ring, maxEntities, outerRingDepth) {
    const result = [...orderedIds];
    const inSet  = new Set(result);
    const coreCount = orderedIds.length;

    for (const id of orderedIds) {
        const entity = entityById.get(id);
        if (!entity) continue;
        for (const linkedId of collectLinkedEntityIds(entity, slugToId)) {
            if (result.length >= maxEntities) {
                return { orderedIds: result, mentionCount: result.length - coreCount };
            }
            if (!inSet.has(linkedId) && entityById.has(linkedId)) {
                inSet.add(linkedId);
                result.push(linkedId);
                ring.set(linkedId, outerRingDepth);
            }
        }
    }

    return { orderedIds: result, mentionCount: result.length - coreCount };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Build a context string focused on anchorEntityId for use in LLM prompts.
 *
 * @param {object[]} entities   — wikiEntity[] (all accessible by role, already filtered)
 * @param {object[]} relations  — wikiRelation[] (all campaign relations)
 * @param {{
 *   anchorEntityId: string,
 *   intent?: string,
 *   role?: "dm" | "player",
 *   maxDepth?: number,
 *   maxEntities?: number,
 *   maxRelations?: number,
 *   maxChars?: number,
 * }} opts
 * @returns {{
 *   text: string,
 *   meta: {
 *     entityCount: number,
 *     relationCount: number,
 *     anchorTitle: string,
 *     truncated: boolean,
 *     relationTypesUsed: string[],
 *     entityIds: string[],
 *   }
 * }}
 */
export function buildSituationContext(entities = [], relations = [], opts = {}) {
    const {
        anchorEntityId,
        intent,
        role = "dm",
        maxDepth     = 2,
        maxEntities  = 25,
        maxRelations = 40,
        maxChars     = 10000,
    } = opts;

    // Filter visibility + exclude idioma from IA subgraph
    const roleFiltered = role === "player"
        ? entities.filter((e) => e.visibility === "players")
        : entities;
    const visibleEntities = filterGraphEntities(roleFiltered);
    const visibleIds   = new Set(visibleEntities.map((e) => e.id));
    const visibleRels  = relations.filter(
        (r) => visibleIds.has(r.fromEntityId) && visibleIds.has(r.toEntityId)
    );

    if (!anchorEntityId || !visibleIds.has(anchorEntityId)) {
        // Fallback: include all entities up to limit (no focus)
        const fallbackEntities = visibleEntities.slice(0, maxEntities);
        const fallbackRels     = visibleRels.slice(0, maxRelations);
        const entityMap = new Map(visibleEntities.map((e) => [e.id, e]));
        const text = buildContextText(
            fallbackEntities, fallbackRels, entityMap,
            null, intent, maxChars, new Set()
        );
        return {
            text,
            meta: {
                entityCount: fallbackEntities.length,
                relationCount: fallbackRels.length,
                anchorTitle: null,
                truncated: false,
                relationTypesUsed: [...new Set(fallbackRels.map((r) => r.relationType))],
                entityIds: fallbackEntities.map((e) => e.id),
            },
        };
    }

    const coreMaxEntities = Math.max(8, maxEntities - MENTION_RESERVE);
    const { orderedIds: bfsIds, ring, relevantRelations } = buildSubgraph(
        anchorEntityId, visibleEntities, visibleRels, { maxDepth, maxEntities: coreMaxEntities }
    );

    const entityMap      = new Map(visibleEntities.map((e) => [e.id, e]));
    const slugToId       = buildSlugIndex(visibleEntities);
    const anchorEntity   = entityMap.get(anchorEntityId);
    const outerRingDepth = maxDepth;

    const { orderedIds, mentionCount } = expandMentionNeighbors(
        bfsIds, entityMap, slugToId, ring, maxEntities, outerRingDepth
    );

    const subgraphIds = new Set(orderedIds);
    const includedRels = visibleRels
        .filter((r) => subgraphIds.has(r.fromEntityId) && subgraphIds.has(r.toEntityId)
                        && getRelationPriority(r) < 99)
        .sort((a, b) => getRelationPriority(a) - getRelationPriority(b))
        .slice(0, maxRelations);

    const includedEnts = orderedIds
        .map((id) => entityMap.get(id))
        .filter(Boolean);

    const text = buildContextText(
        includedEnts, includedRels, entityMap,
        anchorEntity, intent, maxChars, ring, outerRingDepth
    );

    return {
        text,
        meta: {
            entityCount:       includedEnts.length,
            relationCount:     includedRels.length,
            mentionExpanded:   mentionCount,
            anchorTitle:       anchorEntity?.title ?? null,
            truncated:         text.includes("[...contexto truncado"),
            relationTypesUsed: [...new Set(includedRels.map((r) => r.relationType))],
            entityIds:         includedEnts.map((e) => e.id),
        },
    };
}

function buildContextText(entities, relations, entityMap, anchor, intent, maxChars, ring, outerRingDepth = 99) {
    const sections = ["# Contexto del archivo narrativo de campaña (Valtia-01)\n"];

    if (anchor) {
        sections.push(`Ancla: **${anchor.title}** [${WIKI_ENTITY_TYPE_LABELS[anchor.entityType] ?? anchor.entityType}]`);
    }
    if (intent) {
        sections.push(`Intención del DJ: ${intent}`);
    }
    sections.push(`Fichas: ${entities.length} | Relaciones: ${relations.length}\n`);

    sections.push("---\n# Fichas narrativas\n");
    for (const e of entities) {
        const depth   = ring?.get(e.id) ?? 0;
        const compact = depth >= outerRingDepth;
        sections.push(entityToText(e, compact));
    }

    if (relations.length > 0) {
        sections.push("\n---\n");
        sections.push(relationsToText(relations, entityMap));
    }

    let text    = sections.join("\n\n");
    let truncated = false;

    if (text.length > maxChars) {
        text = text.slice(0, maxChars);
        const lastNL = text.lastIndexOf("\n");
        if (lastNL > maxChars * 0.9) text = text.slice(0, lastNL);
        text += "\n\n[...contexto truncado por límite de caracteres]";
        truncated = true;
    }

    return text;
}

// ── CASCADE context builder ───────────────────────────────────────────────────

/**
 * Pre-compute wave assignment for each entity relative to the anchor.
 * Wave 0 = anchor itself.
 * Wave N = minimum hops through CASCADE_WAVE_RELATION_WEIGHTS-typed relations.
 *
 * Returns Map<entityId, waveNumber>.
 */
function computeWaveMap(anchorEntityId, entities, relations, maxWaves, { aiRules, explicitIds } = {}) {
    const rules = resolveNarrativeAiConfig({ aiRules }).rules;
    const entityById   = new Map(entities.map((e) => [e.id, e]));
    const waveMap      = new Map([[anchorEntityId, 0]]);
    const relsByEntity = new Map();

    for (const r of relations) {
        for (const id of [r.fromEntityId, r.toEntityId]) {
            if (!relsByEntity.has(id)) relsByEntity.set(id, []);
            relsByEntity.get(id).push(r);
        }
    }

    const canExpandFrom = (entityId) => {
        if (entityId === anchorEntityId) return true;
        const entity = entityById.get(entityId);
        return shouldIncludeInAiPropagation(entity, rules, { explicitIds });
    };

    const queue = [{ id: anchorEntityId, wave: 0 }];
    while (queue.length > 0) {
        const { id, wave } = queue.shift();
        if (wave >= maxWaves || !canExpandFrom(id)) continue;

        for (const r of relsByEntity.get(id) ?? []) {
            const neighborId = r.fromEntityId === id ? r.toEntityId : r.fromEntityId;
            if (waveMap.has(neighborId)) continue;
            if (!entityById.has(neighborId)) continue;

            const weight = CASCADE_WAVE_RELATION_WEIGHTS[r.relationType];
            if (!weight) continue;

            const neighbor = entityById.get(neighborId);
            if (!shouldIncludeInAiPropagation(neighbor, rules, { explicitIds })) continue;

            const assignedWave = Math.min(wave + weight.wave, maxWaves);
            waveMap.set(neighborId, assignedWave);
            queue.push({ id: neighborId, wave: assignedWave });
        }
    }

    return waveMap;
}

/**
 * Build a context string for the Onda catalizadora (CASCADE) mode.
 *
 * Steps:
 *   1. Resolve entity mentions from the DJ's event text (fuzzy match)
 *   2. Expand BFS from anchor + mentioned entities (larger limits)
 *   3. Pre-compute wave assignment for each entity
 *   4. Serialize entities with wave label + reaction archetype
 *
 * @param {object[]} entities        — full visible wikiEntity[] for the campaign
 * @param {object[]} relations       — full entityRelation[] for the campaign
 * @param {{
 *   anchorEntityId: string,
 *   eventText: string,             — free-text event description from the DJ
 *   role?: "dm" | "player",
 *   maxDepth?: number,
 *   maxEntities?: number,
 *   maxRelations?: number,
 *   maxChars?: number,
 *   maxWaves?: number,
 * }} opts
 * @param {object[]} allEntities     — full unfiltered entity list (for fuzzy mention resolve)
 * @returns {{
 *   text: string,
 *   meta: object,
 *   resolvedMentions: object[],
 *   ambiguousMentions: object[],
 *   waveMap: Map<string, number>,
 * }}
 */
export function buildCascadeContext(entities = [], relations = [], opts = {}, allEntities = []) {
    const {
        anchorEntityId,
        eventText   = "",
        role        = "dm",
        maxDepth    = CASCADE_CONTEXT_OPTS.maxDepth,
        maxEntities = CASCADE_CONTEXT_OPTS.maxEntities,
        maxRelations = CASCADE_CONTEXT_OPTS.maxRelations,
        maxChars    = CASCADE_CONTEXT_OPTS.maxChars,
        maxWaves    = CASCADE_CONTEXT_OPTS.maxWaves,
        maxTotalImpacts = CASCADE_CONTEXT_OPTS.maxTotalImpacts ?? 12,
        aiRules     = null,
    } = opts;

    const rules = resolveNarrativeAiConfig({ aiRules }).rules;
    const explicitIds = getExplicitlyMentionedEntityIds(eventText, allEntities.length ? allEntities : entities);

    // Filter by visibility + exclude idioma from IA subgraph
    const roleFiltered = role === "player"
        ? entities.filter((e) => e.visibility === "players")
        : entities;
    const visibleEntities = filterGraphEntities(roleFiltered);
    const visibleIds  = new Set(visibleEntities.map((e) => e.id));
    const visibleRels = relations.filter(
        (r) => visibleIds.has(r.fromEntityId) && visibleIds.has(r.toEntityId)
    );

    // 1 — Resolve mentions from event text against full campaign
    const mentionSource = allEntities.length ? allEntities : visibleEntities;
    const mentionEntities = resolvedEntitiesFromText(eventText, mentionSource);
    const resolvedMentions    = mentionEntities.map((e) => ({ entity: e }));
    const ambiguousMentions   = []; // full result available via resolveWikiMentions if needed

    // Force the resolved mention entities into the BFS seed (if visible)
    const mentionEntityIds = new Set(
        mentionEntities
            .map((e) => e?.id)
            .filter((id) => id && visibleIds.has(id))
    );

    // 2 — BFS from anchor (seeding mentioned entities as forced includes)
    const entityById   = new Map(visibleEntities.map((e) => [e.id, e]));
    const slugToId     = buildSlugIndex(visibleEntities);
    const anchorEntity = entityById.get(anchorEntityId);

    const coreMax = Math.max(12, maxEntities - MENTION_RESERVE - mentionEntityIds.size);
    let { orderedIds: bfsIds, ring } = buildSubgraph(
        anchorEntityId, visibleEntities, visibleRels,
        { maxDepth, maxEntities: coreMax }
    );

    // Add mentioned entities not yet in BFS (mark as outer ring)
    const inBfs = new Set(bfsIds);
    for (const id of mentionEntityIds) {
        if (!inBfs.has(id) && entityById.has(id)) {
            inBfs.add(id);
            bfsIds.push(id);
            ring.set(id, maxDepth); // outer ring
        }
    }

    // Mention expansion from body text
    const { orderedIds } = expandMentionNeighbors(
        bfsIds, entityById, slugToId, ring, maxEntities, maxDepth
    );

    const subgraphIds  = new Set(orderedIds);
    const includedRelsAll = visibleRels
        .filter((r) => subgraphIds.has(r.fromEntityId) && subgraphIds.has(r.toEntityId))
        .sort((a, b) => getRelationPriority(a) - getRelationPriority(b));

    const includedEnts = orderedIds.map((id) => entityById.get(id)).filter(Boolean);

    // 3 — Pre-compute wave map (for context serialization + UI grouping)
    const waveMap = computeWaveMap(anchorEntityId, includedEnts, includedRelsAll, maxWaves, {
        aiRules: rules,
        explicitIds,
    });

    /** Strongest |strength| between entity and anchor (0 if none). */
    const bondToAnchor = (entityId) => {
        let best = 0;
        for (const r of includedRelsAll) {
            const touches =
                (r.fromEntityId === anchorEntityId && r.toEntityId === entityId)
                || (r.toEntityId === anchorEntityId && r.fromEntityId === entityId);
            if (!touches) continue;
            best = Math.max(best, Math.abs(r.strength ?? 0));
        }
        return best;
    };

    // Relation-first: cap total impacts; prioritize mentions + strong bonds + close waves
    const impactTargets = includedEnts
        .filter((e) => e.entityType === WIKI_ENTITY_TYPES.PERSONAJE)
        .filter((e) => e.id !== anchorEntityId)
        .filter((e) => shouldIncludeInAiImpacts(e, rules, { explicitIds }))
        .map((e) => ({
            id: e.id,
            title: e.title,
            wave: waveMap.get(e.id) ?? maxDepth,
            entityType: e.entityType,
            mentioned: explicitIds.has(e.id) || mentionEntityIds.has(e.id),
            bond: bondToAnchor(e.id),
        }))
        .filter((t) => t.wave >= 1 && t.wave <= maxWaves)
        .sort((a, b) => {
            if (a.mentioned !== b.mentioned) return a.mentioned ? -1 : 1;
            if (b.bond !== a.bond) return b.bond - a.bond;
            if (a.wave !== b.wave) return a.wave - b.wave;
            return a.title.localeCompare(b.title, "es");
        })
        .slice(0, maxTotalImpacts);

    const impactIdSet = new Set(impactTargets.map((t) => t.id));

    // Collective targets: locaciones & organizaciones in wave >= 2 (small cap)
    const collectiveTargets = includedEnts
        .filter((e) =>
            e.entityType === WIKI_ENTITY_TYPES.LOCACION ||
            e.entityType === WIKI_ENTITY_TYPES.ORGANIZACION
        )
        .filter((e) => shouldIncludeInCollectiveImpacts(e, rules))
        .map((e) => ({ id: e.id, title: e.title, wave: waveMap.get(e.id) ?? maxDepth, entityType: e.entityType }))
        .filter((t) => t.wave >= 2 && t.wave <= maxWaves)
        .sort((a, b) => a.wave - b.wave || a.title.localeCompare(b.title, "es"))
        .slice(0, 6);

    const collectiveIdSet = new Set(collectiveTargets.map((t) => t.id));
    const coreEntityIds = new Set([
        anchorEntityId,
        ...impactIdSet,
        ...collectiveIdSet,
        ...mentionEntityIds,
    ].filter(Boolean));

    // Only serialize relations that touch the narrative core (not the whole BFS dump)
    const includedRels = includedRelsAll
        .filter((r) => coreEntityIds.has(r.fromEntityId) && coreEntityIds.has(r.toEntityId))
        .slice(0, maxRelations);

    const coreEnts = includedEnts.filter((e) => coreEntityIds.has(e.id));

    // 4 — Serialize context with wave labels and archetypes (compact sheets — no body)
    const sections = ["# Contexto narrativo — Onda catalizadora (Valtia-01)\n"];
    sections.push(
        "Enfoque: propaga cambios de RELACIÓN y estado. Prioriza vínculos (tipo/fuerza/label) "
        + "sobre lore largo de cada ficha.\n"
    );
    if (anchorEntity) {
        sections.push(`Entidad ancla: **${anchorEntity.title}**`);
    }
    sections.push(
        `Fichas núcleo: ${coreEnts.length} | Relaciones núcleo: ${includedRels.length} | Ondas: ${maxWaves} `
        + `| Impacts requeridos: ${impactTargets.length}\n`
    );

    // Summary of wave assignments (full BFS for orientation, short)
    const waveGroups = new Map();
    for (const [id, wave] of waveMap) {
        if (!waveGroups.has(wave)) waveGroups.set(wave, []);
        const e = entityById.get(id);
        if (e) waveGroups.get(wave).push(e.title);
    }
    for (const wave of [...waveGroups.keys()].sort()) {
        const label = wave === 0 ? "ANCLA" : `ONDA ${wave}`;
        const titles = waveGroups.get(wave);
        const shown = titles.slice(0, 14);
        const extra = titles.length > 14 ? ` (+${titles.length - 14})` : "";
        sections.push(`${label}: ${shown.join(", ")}${extra}`);
    }

    sections.push("\n---\n## Personajes que DEBEN tener un impacto en \"impacts\"\n");
    sections.push(
        "Ordenados por mención en el evento y fuerza de vínculo con el ancla. "
        + "Cada impacto: reacción breve (1–2 frases) y como máximo 3 changes centrados en relaciones.\n"
    );
    if (impactTargets.length === 0) {
        sections.push(
            "No hay personajes en ondas 1–" + maxWaves
            + " además del ancla. Devuelve impacts: [] y explica en dmNotes."
        );
    } else {
        for (const t of impactTargets) {
            const bondNote = t.bond > 0 ? ` · vínculo ancla ${t.bond}` : "";
            const ment = t.mentioned ? " · mencionado" : "";
            sections.push(`- ONDA ${t.wave}: ${t.title}${bondNote}${ment}`);
        }
        sections.push(`\nTotal requerido en "impacts": ${impactTargets.length} (uno por personaje listado).`);
    }

    if (collectiveTargets.length > 0) {
        sections.push("\n---\n## Entidades colectivas con posible impacto (\"collectiveImpacts\")\n");
        sections.push("Si el evento afecta a estas entidades colectivas, incluye su reacción en el campo \"collectiveImpacts\".");
        for (const t of collectiveTargets) {
            const typeLabel = WIKI_ENTITY_TYPE_LABELS[t.entityType] ?? t.entityType;
            sections.push(`- ONDA ${t.wave}: ${t.title} [${typeLabel}]`);
        }
    }

    sections.push("\n---\n# Fichas (compactas: memoria + vínculos fuertes — sin body)\n");

    // Build per-entity relation index for "vínculos directos"
    const relsByEntityId = new Map();
    for (const r of includedRels) {
        for (const id of [r.fromEntityId, r.toEntityId]) {
            if (!relsByEntityId.has(id)) relsByEntityId.set(id, []);
            relsByEntityId.get(id).push(r);
        }
    }

    for (const e of coreEnts) {
        const wave = waveMap.get(e.id) ?? maxDepth;
        // Always compact: bodies burn tokens without improving relation fidelity
        sections.push(entityToTextForAi(e, wave, true, {
            relationsForEntity: (relsByEntityId.get(e.id) ?? []),
            entityMap: entityById,
        }));
    }

    if (includedRels.length > 0) {
        sections.push("\n---\n");
        sections.push(relationsToText(includedRels, entityById));
    }

    let text = sections.join("\n\n");
    let truncated = false;
    if (text.length > maxChars) {
        text = text.slice(0, maxChars);
        const lastNL = text.lastIndexOf("\n");
        if (lastNL > maxChars * 0.9) text = text.slice(0, lastNL);
        text += "\n\n[...contexto truncado]";
        truncated = true;
    }

    const deadInContext = coreEnts.filter(isCharacterDead);
    const guardrailsText = buildAiGuardrailsPrompt(rules, {
        deadTitles: deadInContext.map((e) => e.title),
        explicitDeadTitles: deadInContext
            .filter((e) => explicitIds.has(e.id))
            .map((e) => e.title),
    });

    return {
        text,
        guardrailsText,
        meta: {
            entityCount:           coreEnts.length,
            relationCount:         includedRels.length,
            anchorTitle:           anchorEntity?.title ?? null,
            truncated,
            waveCount:             maxWaves,
            impactTargetCount:     impactTargets.length,
            impactTargets:         impactTargets.map((t) => t.title),
            impactTargetsDetailed: impactTargets,
            collectiveTargetCount: collectiveTargets.length,
            collectiveTargets:     collectiveTargets.map((t) => t.title),
            entityIds:             coreEnts.map((e) => e.id),
            packing:               "relation-first",
        },
        resolvedMentions,
        ambiguousMentions,
        waveMap,
    };
}

// ── Propagation waves for graph animation ─────────────────────────────────────

function indexRelationsByEntity(relations) {
    const relsByEntity = new Map();
    for (const r of relations) {
        if (getRelationPriority(r) === 99) continue;
        for (const id of [r.fromEntityId, r.toEntityId]) {
            if (!relsByEntity.has(id)) relsByEntity.set(id, []);
            relsByEntity.get(id).push(r);
        }
    }
    return relsByEntity;
}

function computeBfsPropagationWaves(anchorEntityId, entities, relations, maxDepth = 2, { canTraverse } = {}) {
    const entityById = new Map(entities.map((e) => [e.id, e]));
    if (!entityById.has(anchorEntityId)) return { waves: [] };

    const relsByEntity = indexRelationsByEntity(relations);
    const visited = new Set([anchorEntityId]);
    const waves = [{ depth: 0, edges: [], nodeIds: [anchorEntityId] }];

    let frontier = [anchorEntityId];
    for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth++) {
        const edges = [];
        const nodeIds = [];
        const nextFrontier = [];

        for (const fromId of frontier) {
            if (canTraverse && fromId !== anchorEntityId && !canTraverse(fromId)) continue;

            const rels = (relsByEntity.get(fromId) ?? []).slice().sort(
                (a, b) => getRelationPriority(a) - getRelationPriority(b)
            );
            for (const r of rels) {
                const toId = r.fromEntityId === fromId ? r.toEntityId : r.fromEntityId;
                if (visited.has(toId) || !entityById.has(toId)) continue;
                if (canTraverse && !canTraverse(toId)) continue;
                visited.add(toId);
                edges.push({ fromId, toId, relationId: r.id });
                nodeIds.push(toId);
                nextFrontier.push(toId);
            }
        }

        if (nodeIds.length > 0) {
            waves.push({ depth, edges, nodeIds });
        }
        frontier = nextFrontier;
    }

    return { waves };
}

function computeCascadePropagationWaves(anchorEntityId, entities, relations, maxWaves = 3, waveOpts = {}) {
    const entityById = new Map(entities.map((e) => [e.id, e]));
    if (!entityById.has(anchorEntityId)) return { waves: [] };

    const waveMap = computeWaveMap(anchorEntityId, entities, relations, maxWaves, waveOpts);
    const nodesByWave = new Map();
    for (const [id, wave] of waveMap) {
        if (!nodesByWave.has(wave)) nodesByWave.set(wave, []);
        nodesByWave.get(wave).push(id);
    }

    const maxWaveNum = Math.max(0, ...waveMap.values());
    const waves = [];
    for (let w = 0; w <= maxWaveNum; w++) {
        waves.push({ depth: w, nodeIds: nodesByWave.get(w) ?? [], edges: [] });
    }

    for (const r of relations) {
        const a = r.fromEntityId;
        const b = r.toEntityId;
        const wa = waveMap.get(a);
        const wb = waveMap.get(b);
        if (wa == null || wb == null) continue;
        if (wa + 1 === wb) {
            waves[wb].edges.push({ fromId: a, toId: b, relationId: r.id });
        } else if (wb + 1 === wa) {
            waves[wa].edges.push({ fromId: b, toId: a, relationId: r.id });
        }
    }

    return { waves };
}

/**
 * Pre-compute wave-by-wave edges for neural propagation animation on the graph.
 *
 * @param {string} anchorEntityId
 * @param {object[]} entities
 * @param {object[]} relations
 * @param {{ strategy?: "bfs"|"cascade", maxDepth?: number, maxWaves?: number }} [opts]
 * @returns {{ waves: Array<{ depth: number, edges: {fromId:string,toId:string,relationId:string}[], nodeIds: string[] }> }}
 */
export function computePropagationWaves(anchorEntityId, entities, relations, opts = {}) {
    const {
        strategy = "bfs",
        maxDepth = 2,
        maxWaves = 3,
        aiRules = null,
        eventText = "",
    } = opts;

    if (!anchorEntityId) return { waves: [] };

    const rules = resolveNarrativeAiConfig({ aiRules }).rules;
    const explicitIds = getExplicitlyMentionedEntityIds(eventText, entities);
    const graphEntities = filterGraphEntities(entities);
    const graphIds = new Set(graphEntities.map((e) => e.id));
    const graphRelations = relations.filter(
        (r) => graphIds.has(r.fromEntityId) && graphIds.has(r.toEntityId)
    );

    if (!graphIds.has(anchorEntityId)) return { waves: [] };

    const waveOpts = { aiRules: rules, explicitIds };
    const canTraverse = (entityId) => {
        if (entityId === anchorEntityId) return true;
        const entity = graphEntities.find((e) => e.id === entityId);
        return shouldIncludeInAiPropagation(entity, rules, { explicitIds });
    };

    if (strategy === "cascade") {
        return computeCascadePropagationWaves(
            anchorEntityId, graphEntities, graphRelations, maxWaves, waveOpts
        );
    }
    return computeBfsPropagationWaves(
        anchorEntityId, graphEntities, graphRelations, maxDepth, { canTraverse }
    );
}

// ── SCOUT context (Two-pass Pasa 1) ──────────────────────────────────────────
//
// Builds a minimal context string for the Scout (Pasa 1) of the Two-pass cascade.
// Uses ONTO columnar format for relations (ONTO 2025: 46-51% token reduction vs prose).
// Target: ~1.5-2k tokens, well under the Scout's context budget.
//
// Receives the result of buildCascadeContext() to avoid re-running BFS.

/**
 * Build an ultra-compact Scout context for Pasa 1 of the Two-pass cascade.
 *
 * Format:
 *   - Anchor entity title (1 line)
 *   - Impact target list: one line per entity with wave + state + bond to anchor
 *   - Relations in ONTO columnar: `from|to|tipo|fuerza` (header + rows)
 *
 * @param {object} cascadeCtxMeta  — `meta` from buildCascadeContext()
 * @param {string} anchorEntityId  — anchor entity ID (for relation filtering)
 * @param {object[]} entities       — full entity list (for looking up custom fields)
 * @param {object[]} relations      — full relation list (for building ONTO block)
 * @returns {string}               — compact context text (~1.5-2k tokens)
 */
export function buildScoutContext(cascadeCtxMeta, anchorEntityId, entities, relations) {
    const entityById = new Map(entities.map((e) => [e.id, e]));
    const targets    = cascadeCtxMeta.impactTargetsDetailed ?? [];

    const lines = ["# Evaluación de impacto — Pasa 1 (Scout)"];
    lines.push(`Ancla: ${cascadeCtxMeta.anchorTitle ?? "desconocida"}`);
    lines.push(`Ondas: ${cascadeCtxMeta.waveCount ?? 3} | Impacts a evaluar: ${targets.length}\n`);

    // ── Impact target list ──────────────────────────────────────────────────
    lines.push("## Personajes a evaluar (onda · vínculo_ancla · arquetipo · estado)");
    for (const t of targets) {
        const entity   = entityById.get(t.id);
        const cf       = entity?.customFields?.personaje ?? {};
        const statePart = cf.narrativeState    ? ` · estado:${cf.narrativeState}` : "";
        const archPart  = cf.reactionArchetype ? ` · arq:${cf.reactionArchetype}` : "";
        const bondPart  = t.bond > 0           ? ` · vínculo:${t.bond}` : "";
        const mentPart  = t.mentioned          ? " · mencionado" : "";
        lines.push(`- ONDA ${t.wave}: ${t.title}${bondPart}${archPart}${statePart}${mentPart}`);
    }

    // ── ONTO columnar relations (ONTO 2025: 46-51% less tokens vs prose) ────
    const coreIds = new Set([
        anchorEntityId,
        ...targets.map((t) => t.id),
    ].filter(Boolean));

    const coreRels = relations
        .filter((r) => coreIds.has(r.fromEntityId) && coreIds.has(r.toEntityId))
        .sort((a, b) => Math.abs(b.strength ?? 0) - Math.abs(a.strength ?? 0))
        .slice(0, 40);

    if (coreRels.length > 0) {
        lines.push("\n## Vínculos principales (from|to|tipo|fuerza)");
        for (const r of coreRels) {
            const fromTitle = entityById.get(r.fromEntityId)?.title ?? r.fromEntityId;
            const toTitle   = entityById.get(r.toEntityId)?.title   ?? r.toEntityId;
            const strength  = r.strength ?? 0;
            lines.push(`${fromTitle}|${toTitle}|${r.relationType}|${strength}`);
        }
    }

    return lines.join("\n");
}

// ── Extended context (sessions, canon, thread history) ───────────────────────

/**
 * Prefix block for campaign canon, session recaps, and Lab IA thread history.
 * @param {{ canonSummary?: string, sessionRecaps?: Array<{title:string,recap:string}>, threadMessages?: Array<{role:string,content:string}> }} extras
 */
export function buildExtendedContextPrefix(extras = {}) {
    const { canonSummary, sessionRecaps = [], threadMessages = [] } = extras;
    const parts = [];

    if (canonSummary?.trim()) {
        parts.push(`## Canon de campaña\n${canonSummary.trim()}`);
    }

    if (sessionRecaps.length > 0) {
        const block = sessionRecaps
            .slice(0, 5)
            .map((s) => `### ${s.title}\n${s.recap}`)
            .join("\n\n");
        parts.push(`## Sesiones recientes\n${block}`);
    }

    if (threadMessages.length > 0) {
        const block = threadMessages
            .slice(-8)
            .map((m) => `[${m.role}] ${m.content}`)
            .join("\n");
        parts.push(`## Historial Lab IA\n${block}`);
    }

    return parts.join("\n\n");
}

/**
 * Merge extended prefix into a base context pack from buildSituationContext / buildCascadeContext.
 */
export function mergeContextWithExtras(baseContext, extras = {}) {
    const prefix = buildExtendedContextPrefix(extras);
    if (!prefix?.trim()) return baseContext;
    return {
        ...baseContext,
        text: `${prefix}\n\n---\n\n${baseContext.text}`,
        meta: {
            ...baseContext.meta,
            hasExtendedContext: true,
        },
    };
}

/**
 * Build situation context from multiple anchor entities (union of subgraphs).
 */
export function buildMultiAnchorSituationContext(entities, relations, opts = {}) {
    const { anchorEntityIds = [], ...rest } = opts;
    const ids = anchorEntityIds.filter(Boolean);
    if (ids.length <= 1) {
        return buildSituationContext(entities, relations, {
            ...rest,
            anchorEntityId: ids[0] ?? rest.anchorEntityId,
        });
    }

    const merged = buildSituationContext(entities, relations, {
        ...rest,
        anchorEntityId: ids[0],
        maxEntities: Math.floor((rest.maxEntities ?? 25) * 0.6),
    });

    const entityIdSet = new Set(merged.meta.entityIds);
    for (let i = 1; i < ids.length; i++) {
        const sub = buildSituationContext(entities, relations, {
            ...rest,
            anchorEntityId: ids[i],
            maxEntities: Math.floor((rest.maxEntities ?? 25) * 0.4),
            maxDepth: Math.min(rest.maxDepth ?? 2, 1),
        });
        sub.meta.entityIds.forEach((id) => entityIdSet.add(id));
    }

    const allIds = [...entityIdSet];
    const entityMap = new Map(entities.map((e) => [e.id, e]));
    const includedEnts = allIds.map((id) => entityMap.get(id)).filter(Boolean);
    const includedIds = new Set(allIds);
    const includedRels = relations.filter(
        (r) => includedIds.has(r.fromEntityId) && includedIds.has(r.toEntityId)
    );

    const anchorTitles = ids.map((id) => entityMap.get(id)?.title).filter(Boolean).join(", ");
    const text = buildContextText(
        includedEnts,
        includedRels.slice(0, rest.maxRelations ?? 40),
        entityMap,
        entityMap.get(ids[0]),
        rest.intent,
        rest.maxChars ?? 10000,
        new Set(),
    );

    return {
        text,
        meta: {
            ...merged.meta,
            entityCount: includedEnts.length,
            relationCount: includedRels.length,
            anchorTitle: anchorTitles,
            entityIds: allIds,
            multiAnchor: true,
        },
    };
}
