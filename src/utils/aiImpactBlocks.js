/**
 * AI narrative impact blocks on wiki entity fichas.
 * Stored as top-level `entity.aiImpactBlocks[]` (any entityType).
 *
 * Body = narrative prose only (reaction / hook).
 * Relation sync deltas live in `relationEffects[]` (never editable plain text).
 */

import { linkMentionsInText } from "./linkWikiMentions.js";

const MAX_BODY_LINES = 4;
const MAX_BODY_CHARS = 420;
const MAX_RELATION_EFFECTS = 6;

/** Legacy / accidental Sync lines mixed into body. */
const RELATION_EFFECT_LINE_RE = /^\s*(Sync\b|Vínculo\b|Vinculo\b|Nuevo vínculo:|Nuevo vinculo:|Vínculo roto:|Vinculo roto:|Vínculo actualizado:|Vinculo actualizado:)/i;

/** Partner-sheet boilerplate mistakenly stored on the primary ficha. */
const AFECTADA_POR_LINE_RE = /^\s*Afectad[oa]s?\s+por\b/i;
const CONTEXTO_PREFIX_RE = /^\s*Contexto:\s*(.*)$/i;

/**
 * True when this block was stamped on a non-primary (partner) entity.
 * @param {object|null|undefined} block
 */
export function isPartnerImpactBlock(block) {
    const primary = block?.primaryEntityId || null;
    const forId = block?.forEntityId || null;
    return Boolean(primary && forId && primary !== forId);
}

/**
 * Drop "Afectada por…" / unwrap "Contexto:" — primary fichas are free prose only.
 * @param {string} raw
 * @returns {string}
 */
export function stripPartnerImpactBoilerplate(raw) {
    if (raw == null) return "";
    const lines = String(raw).split("\n").map((line) => {
        const t = line.trim();
        if (!t) return "";
        if (AFECTADA_POR_LINE_RE.test(t)) return null;
        const m = t.match(CONTEXTO_PREFIX_RE);
        if (m) return m[1];
        return line;
    }).filter((l) => l != null);
    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * @param {object|null|undefined} entity
 * @returns {object[]}
 */
export function getAiImpactBlocks(entity) {
    const raw = entity?.aiImpactBlocks;
    return Array.isArray(raw) ? raw : [];
}

/**
 * Strip relation-sync lines from free text (body / DM override).
 * @param {string} raw
 * @returns {string}
 */
export function sanitizeNarrativeImpactBody(raw) {
    if (raw == null) return "";
    const lines = String(raw).split("\n").filter((line) => {
        const t = line.trim();
        if (!t) return true;
        return !RELATION_EFFECT_LINE_RE.test(t);
    });
    return clipBlockBody(lines);
}

/**
 * Narrative-only body from a cascade impact (no Sync / vínculo lines).
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

    return clipBlockBody(lines);
}

/**
 * Body for a secondary entity touched by someone else's impact card.
 * Narrative context only — relation deltas go in `relationEffects`.
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

    const reaction = (impact.emotionalReaction || impact.collectiveReaction || "").trim();
    if (reaction && lines.length < MAX_BODY_LINES) {
        lines.push(`Contexto: ${reaction}`);
    }

    return clipBlockBody(lines);
}

/**
 * Structured relation effects for UI chips (not part of editable body).
 * @param {object} impact
 * @param {object|null} [entityFilter]
 * @returns {object[]}
 */
export function buildRelationEffectsFromImpact(impact, entityFilter = null) {
    const changes = impact?.resolvedChanges ?? impact?.changes ?? [];
    const out = [];
    for (const ch of changes) {
        if (ch.valid === false) continue;
        if (
            ch.kind !== "relation_add"
            && ch.kind !== "relation_update"
            && ch.kind !== "relation_remove"
        ) {
            continue;
        }
        const fromId = ch.fromEntity?.id ?? ch.resolvedEndpoints?.fromEntityId ?? null;
        const toId = ch.toEntity?.id ?? ch.resolvedEndpoints?.toEntityId ?? null;
        if (entityFilter?.id) {
            if (fromId !== entityFilter.id && toId !== entityFilter.id) continue;
        }
        const fromTitle = ch.fromEntityTitle || ch.fromEntity?.title || "?";
        const toTitle = ch.toEntityTitle || ch.toEntity?.title || "?";
        const deltaRaw = ch.strengthDelta;
        const strengthDelta = deltaRaw != null && !Number.isNaN(Number(deltaRaw))
            ? Number(deltaRaw)
            : null;
        out.push({
            kind: ch.kind,
            fromTitle: String(fromTitle),
            toTitle: String(toTitle),
            fromEntityId: fromId,
            toEntityId: toId,
            relationType: ch.relationType || null,
            strengthDelta,
        });
        if (out.length >= MAX_RELATION_EFFECTS) break;
    }
    return out;
}

/**
 * Prose body for display/edit (strips legacy Sync lines from stored body).
 * On primary (own) impact cards, also strips partner "Afectada por…" boilerplate.
 * @param {object|null|undefined} block
 */
export function narrativeBodyOfBlock(block) {
    let body = sanitizeNarrativeImpactBody(block?.body || "");
    if (!isPartnerImpactBlock(block)) {
        body = stripPartnerImpactBoilerplate(body);
    }
    return body;
}

/**
 * Relation effects for display: stored array, or recover from legacy body lines.
 * @param {object|null|undefined} block
 * @returns {object[]}
 */
export function relationEffectsOfBlock(block) {
    if (Array.isArray(block?.relationEffects) && block.relationEffects.length) {
        return block.relationEffects;
    }
    return parseLegacyRelationEffectLines(block?.body || "");
}

/**
 * @param {string} body
 * @returns {object[]}
 */
function parseLegacyRelationEffectLines(body) {
    const lines = String(body || "").split("\n").map((l) => l.trim()).filter(Boolean);
    const effects = [];
    for (const line of lines) {
        if (!RELATION_EFFECT_LINE_RE.test(line)) continue;
        // Best-effort display object; titles may still contain @[Name](id) wiki links.
        effects.push({
            kind: /roto/i.test(line) ? "relation_remove"
                : /Nuevo/i.test(line) ? "relation_add"
                    : "relation_update",
            fromTitle: "",
            toTitle: "",
            fromEntityId: null,
            toEntityId: null,
            relationType: null,
            strengthDelta: null,
            legacyLabel: line,
        });
        if (effects.length >= MAX_RELATION_EFFECTS) break;
    }
    return effects;
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
    const primaryTitle = String(
        impact?.entityResolved?.title || impact?.entityTitle || ""
    ).trim().toLowerCase();
    const forTitle = String(forEntity?.title || "").trim().toLowerCase();
    // Missing primaryId must not force partner boilerplate onto the subject ficha.
    const isPrimary = !forEntity?.id
        || (primaryId != null && forEntity.id === primaryId)
        || (!primaryId && Boolean(primaryTitle) && forTitle === primaryTitle);

    let body;
    if (isPrimary && typeof opts.bodyOverride === "string") {
        body = sanitizeNarrativeImpactBody(opts.bodyOverride);
    } else {
        body = isPrimary
            ? buildAiImpactBlockBody(impact)
            : buildPartnerAiImpactBlockBody(impact, forEntity, eventMeta);
    }

    const relationEffects = buildRelationEffectsFromImpact(
        impact,
        isPrimary ? null : forEntity
    );

    if (!body && !relationEffects.length) return null;

    if (body) {
        body = linkMentionsInText(body, entities);
    }

    return {
        id: typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `ai-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        createdAt: Date.now(),
        updatedAt: null,
        source: "cascade",
        eventTitle: (eventMeta.eventTitle || "").trim(),
        wave: typeof impact.wave === "number" ? impact.wave : null,
        body: body || "",
        relationEffects,
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
 * Update narrative body only — never touches relationEffects.
 * @param {object|null|undefined} entity
 * @param {string} blockId
 * @param {string} body
 * @returns {{ aiImpactBlocks: object[] }}
 */
export function withUpdatedAiImpactBlock(entity, blockId, body) {
    const next = getAiImpactBlocks(entity).map((b) => {
        if (b.id !== blockId) return b;
        let nextBody = sanitizeNarrativeImpactBody(body);
        if (!isPartnerImpactBlock(b)) {
            nextBody = stripPartnerImpactBoilerplate(nextBody);
        }
        return {
            ...b,
            body: nextBody,
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

/** Display-friendly titles: drop `@[Name](id)` wiki-link markup. */
function displayTitle(raw) {
    return String(raw || "")
        .replace(/@\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Short label for a structured relation effect (UI).
 * @param {object} effect
 * @returns {string}
 */
export function formatRelationEffectLabel(effect) {
    if (!effect) return "";
    if (effect.legacyLabel) {
        return displayTitle(effect.legacyLabel)
            .replace(/^Sync\s+/i, "")
            .replace(/^V[ií]nculo\s+(roto|actualizado):\s*/i, "")
            .replace(/^Nuevo v[ií]nculo:\s*/i, "");
    }
    const typ = String(effect.relationType || "relación").replace(/_/g, " ");
    const from = displayTitle(effect.fromTitle) || "?";
    const to = displayTitle(effect.toTitle) || "?";
    if (effect.kind === "relation_remove") {
        return `${from} ↔ ${to} · roto (${typ})`;
    }
    if (effect.strengthDelta != null && !Number.isNaN(Number(effect.strengthDelta))) {
        const n = Number(effect.strengthDelta);
        const sign = n > 0 ? "+" : "";
        return `${from} → ${to} · ${sign}${n} (${typ})`;
    }
    if (effect.kind === "relation_add") {
        return `${from} → ${to} · nuevo (${typ})`;
    }
    return `${from} → ${to} · ${typ}`;
}
