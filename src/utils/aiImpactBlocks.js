/**
 * AI narrative impact blocks on wiki entity fichas.
 * Stored as top-level `entity.aiImpactBlocks[]` (any entityType).
 */

import { linkMentionsInText } from "./linkWikiMentions.js";

const MAX_BODY_LINES = 4;
const MAX_BODY_CHARS = 420;

/**
 * @param {object|null|undefined} entity
 * @returns {object[]}
 */
export function getAiImpactBlocks(entity) {
    const raw = entity?.aiImpactBlocks;
    return Array.isArray(raw) ? raw : [];
}

/**
 * Build a short multi-line body from a cascade impact (personaje or colectivo).
 * @param {object} impact
 * @returns {string}
 */
export function buildAiImpactBlockBody(impact) {
    if (!impact) return "";

    const lines = [];
    const reaction = (impact.emotionalReaction || impact.collectiveReaction || "").trim();
    const hook = (impact.narrativeHook || "").trim();
    if (reaction) lines.push(reaction);
    if (hook && hook !== reaction) lines.push(hook);

    const relLine = summarizeRelationChanges(impact);
    if (relLine) lines.push(relLine);

    return clipBlockBody(lines);
}

/**
 * Body for a secondary entity touched by someone else's impact card
 * (e.g. Oni when applying Zorgun's relation change).
 * @param {object} impact
 * @param {object} forEntity
 * @param {{ eventTitle?: string }} [eventMeta]
 * @returns {string}
 */
export function buildPartnerAiImpactBlockBody(impact, forEntity, eventMeta = {}) {
    if (!impact || !forEntity?.id) return "";

    const lines = [];
    const primaryTitle = (impact.entityTitle || impact.entityResolved?.title || "otra ficha").trim();
    const eventTitle = (eventMeta.eventTitle || "").trim();
    if (eventTitle) {
        lines.push(`Afectada por «${eventTitle}» (impacto de ${primaryTitle}).`);
    } else {
        lines.push(`Afectada por el impacto narrativo de ${primaryTitle}.`);
    }

    const relLine = summarizeRelationChangesForEntity(impact, forEntity);
    if (relLine) lines.push(relLine);

    const reaction = (impact.emotionalReaction || impact.collectiveReaction || "").trim();
    if (reaction && lines.length < MAX_BODY_LINES) {
        lines.push(`Contexto: ${reaction}`);
    }

    return clipBlockBody(lines);
}

/**
 * Collect every entity this impact touches (primary + relation endpoints + state targets).
 * @param {object} impact
 * @param {object[]} [entities]
 * @returns {object[]}
 */
export function collectAffectedEntitiesFromImpact(impact, entities = []) {
    const byId = new Map();
    const add = (ent) => {
        if (!ent?.id) return;
        const latest = entities.find((e) => e.id === ent.id) ?? ent;
        byId.set(latest.id, latest);
    };

    add(impact?.entityResolved);
    for (const ch of impact?.resolvedChanges ?? []) {
        if (ch.valid === false) continue;
        add(ch.fromEntity);
        add(ch.toEntity);
    }

    return [...byId.values()];
}

/**
 * @param {object} impact
 * @param {{ eventTitle?: string }} [eventMeta]
 * @param {{
 *   forEntity?: object|null,
 *   entities?: object[],
 *   bodyOverride?: string|null,
 * }} [opts]
 * @returns {object|null}
 */
export function createAiImpactBlock(impact, eventMeta = {}, opts = {}) {
    const forEntity = opts.forEntity ?? null;
    const entities = opts.entities ?? [];
    const primaryId = impact?.entityResolved?.id ?? null;
    const isPrimary = !forEntity?.id || forEntity.id === primaryId;

    let body;
    if (isPrimary && typeof opts.bodyOverride === "string") {
        body = opts.bodyOverride.trim();
    } else {
        body = isPrimary
            ? buildAiImpactBlockBody(impact)
            : buildPartnerAiImpactBlockBody(impact, forEntity, eventMeta);
    }
    if (!body) return null;

    body = linkMentionsInText(body, entities);

    return {
        id: typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `ai-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        createdAt: Date.now(),
        updatedAt: null,
        source: "cascade",
        eventTitle: (eventMeta.eventTitle || "").trim(),
        wave: typeof impact.wave === "number" ? impact.wave : null,
        body,
        createdByAi: true,
        editedByHuman: isPrimary && typeof opts.bodyOverride === "string",
        primaryEntityId: primaryId,
        forEntityId: forEntity?.id ?? primaryId,
    };
}

function clipBlockBody(lines) {
    const clipped = lines.filter(Boolean).slice(0, MAX_BODY_LINES);
    let body = clipped.join("\n");
    if (body.length > MAX_BODY_CHARS) {
        body = `${body.slice(0, MAX_BODY_CHARS - 1).trimEnd()}…`;
    }
    return body;
}

/**
 * Prepend a block (newest first). Returns new array.
 * @param {object[]} blocks
 * @param {object} block
 */
export function appendAiImpactBlock(blocks, block) {
    if (!block) return Array.isArray(blocks) ? [...blocks] : [];
    return [block, ...(Array.isArray(blocks) ? blocks : [])];
}

/**
 * @param {object|null|undefined} entity
 * @param {object} block
 * @returns {{ aiImpactBlocks: object[] }}
 */
export function withAppendedAiImpactBlock(entity, block) {
    return {
        aiImpactBlocks: appendAiImpactBlock(getAiImpactBlocks(entity), block),
    };
}

/**
 * @param {object|null|undefined} entity
 * @param {string} blockId
 * @param {string} body
 * @returns {{ aiImpactBlocks: object[] }}
 */
export function withUpdatedAiImpactBlock(entity, blockId, body) {
    const next = getAiImpactBlocks(entity).map((b) => {
        if (b.id !== blockId) return b;
        return {
            ...b,
            body: String(body ?? ""),
            updatedAt: Date.now(),
            editedByHuman: true,
        };
    });
    return { aiImpactBlocks: next };
}

/**
 * @param {object|null|undefined} entity
 * @param {string} blockId
 * @returns {{ aiImpactBlocks: object[] }}
 */
export function withRemovedAiImpactBlock(entity, blockId) {
    return {
        aiImpactBlocks: getAiImpactBlocks(entity).filter((b) => b.id !== blockId),
    };
}

/**
 * Normalize a collective impact so applyProposedImpact / body builder share one shape.
 * @param {object} collective
 */
export function normalizeCollectiveImpactForApply(collective) {
    if (!collective) return collective;
    return {
        ...collective,
        emotionalReaction: collective.emotionalReaction || collective.collectiveReaction || "",
    };
}

function summarizeRelationChanges(impact, entityFilter = null) {
    const changes = impact.resolvedChanges ?? impact.changes ?? [];
    const bits = [];
    for (const ch of changes) {
        if (ch.valid === false) continue;
        if (
            ch.kind !== "relation_add"
            && ch.kind !== "relation_update"
            && ch.kind !== "relation_remove"
        ) {
            continue;
        }
        if (entityFilter?.id) {
            const fromId = ch.fromEntity?.id ?? ch.resolvedEndpoints?.fromEntityId;
            const toId = ch.toEntity?.id ?? ch.resolvedEndpoints?.toEntityId;
            if (fromId !== entityFilter.id && toId !== entityFilter.id) continue;
        }
        const from = ch.fromEntityTitle || "?";
        const to = ch.toEntityTitle || "?";
        const typ = ch.relationType || "relación";
        if (ch.kind === "relation_remove") {
            bits.push(`${from} ↛ ${to} (${typ})`);
        } else if (ch.strengthDelta != null && !Number.isNaN(Number(ch.strengthDelta))) {
            const sign = Number(ch.strengthDelta) > 0 ? "+" : "";
            bits.push(`${from}→${to} ${typ} ${sign}${ch.strengthDelta}`);
        } else {
            bits.push(`${from}→${to} ${typ}`);
        }
        if (bits.length >= 2) break;
    }
    return bits.length ? bits.join("; ") : "";
}

function summarizeRelationChangesForEntity(impact, entity) {
    return summarizeRelationChanges(impact, entity);
}
