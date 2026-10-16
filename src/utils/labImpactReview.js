/**
 * Neural Lab review of a validated cascade.
 * One group per reacting ficha; one item per thing the DM can accept or reject.
 * Pure: the writes live in `labReviewApply.js`.
 */

import { enrichRelationStrengthChange, formatStrengthChangeLabel } from "./resolveRelationStrengthChange.js";
import { explainImpactSeal, sealGradeColor } from "./impactSealGrade.js";
import { deltaColor, deltaText } from "./labImpactMarks.js";
import { WIKI_RELATION_TYPE_LABELS } from "../constants/wikiRelationTypes.js";
import { NARRATIVE_STATE_LABELS } from "../constants/wiki/entityFieldSchemas.js";

export const REVIEW = Object.freeze({
    PENDING: "pending",
    ACCEPTED: "accepted",
    REJECTED: "rejected",
});

export const REVIEW_COLOR = Object.freeze({
    accepted: "#3dd68c",
    rejected: "#778899",
});

const STATE_FIELDS = {
    narrativeState: { label: "Estado narrativo", short: "estado", column: "narrative_state" },
    narrative_state: { label: "Estado narrativo", short: "estado", column: "narrative_state" },
    collectiveMood: { label: "Ánimo colectivo", short: "ánimo", column: "collective_mood" },
    collective_mood: { label: "Ánimo colectivo", short: "ánimo", column: "collective_mood" },
    condicion: { label: "Condición", short: "condición", column: "condicion" },
    condicion_nota: { label: "Nota de condición", short: "nota", column: "condicion_nota" },
};

const RELATION_KINDS = new Set(["relation_add", "relation_update", "relation_remove"]);

/** Expected sign of the weight: an enemy below zero, an ally above. */
const HOSTILE_SIGN = { enemigo_de: -1, aliado_de: 1 };

export function stateFieldMeta(field) {
    return STATE_FIELDS[field] || { label: field || "Dato", short: field || "dato", column: null };
}

export function stateValueLabel(field, value) {
    if (value == null || value === "") return "sin dato";
    const column = stateFieldMeta(field).column;
    if (column === "narrative_state") return NARRATIVE_STATE_LABELS[value] || String(value);
    return String(value);
}

export function impactKeyOf(impact) {
    const id = impact?.entityResolved?.id || impact?.entityId;
    if (id) return id;
    return `t:${String(impact?.entityTitle || "").toLowerCase().trim()}`;
}

function cleanError(text) {
    return String(text || "").replace(/^(collectiveImpact \d+ )?[Cc]ambio \d+:\s*/, "").trim();
}

function currentValue(entity, field) {
    const column = stateFieldMeta(field).column;
    return column ? entity?.[column] ?? null : null;
}

function relationItem(change, index, ctx) {
    const { key, relations, blockAll, blockReason } = ctx;
    const enriched = enrichRelationStrengthChange(change, relations);
    const fromId = enriched.resolvedEndpoints?.fromEntityId ?? enriched.fromEntity?.id ?? null;
    const toId = enriched.resolvedEndpoints?.toEntityId ?? enriched.toEntity?.id ?? null;
    const relationType = enriched.relationType || "";
    const typeLabel = WIKI_RELATION_TYPE_LABELS[relationType] || relationType || "vínculo";
    const fromTitle = enriched.fromEntity?.title || enriched.fromEntityTitle || "?";
    const toTitle = enriched.toEntity?.title || enriched.toEntityTitle || "?";
    const before = enriched.currentStrength ?? null;
    const after = change.kind === "relation_remove" ? null : (enriched.proposedStrength ?? null);
    const valid = change.valid !== false && !blockAll && Boolean(fromId && toId);
    const warnings = [];
    if (change.kind === "relation_add" && enriched.existingRelationId && before != null) {
        warnings.push(`Este vínculo ya existe con peso ${before}. La IA lo pidió como nuevo con peso ${after ?? 0}: aceptar reemplaza el peso, no lo suma.`);
    }
    const delta = Number(enriched.strengthDeltaResolved);
    if (after != null && Math.sign(after) !== 0 && Math.sign(after) === -(HOSTILE_SIGN[relationType] || 0)) {
        warnings.push(`«${typeLabel}» con peso ${after > 0 ? "positivo" : "negativo"} contradice el tipo; revisa si la IA invirtió el signo.`);
    } else if (change.kind === "relation_update" && HOSTILE_SIGN[relationType] && Math.sign(delta) === -HOSTILE_SIGN[relationType]) {
        warnings.push(HOSTILE_SIGN[relationType] < 0
            ? `En «${typeLabel}», ${deltaText(enriched)} acerca el peso a 0: la enemistad baja. Si la reacción describe más odio, usa «Invertir signo».`
            : `En «${typeLabel}», ${deltaText(enriched)} acerca el peso a 0: la alianza se enfría. Si la reacción la refuerza, usa «Invertir signo».`);
    }
    return {
        warnings,
        key: `${key}:c${index}`,
        groupKey: key,
        kind: change.kind,
        title: typeLabel,
        detail: formatStrengthChangeLabel(enriched) || typeLabel,
        short: `${toTitle} ${deltaText(enriched)}`,
        reason: change.reason || "",
        valid,
        error: change.valid === false ? cleanError(change.validationError) : (blockAll ? blockReason : null),
        fromId,
        toId,
        fromTitle,
        toTitle,
        fromType: enriched.fromEntity?.entityType || null,
        toType: enriched.toEntity?.entityType || null,
        relationType,
        label: change.newLabel || "",
        before,
        after,
        delta: Number.isFinite(Number(enriched.strengthDeltaResolved)) ? Number(enriched.strengthDeltaResolved) : null,
        existingId: enriched.existingRelationId || null,
        isNew: !enriched.existingRelationId && change.kind !== "relation_remove",
        edgeKey: fromId && toId ? `${fromId}|${toId}` : "",
        deltaText: deltaText(enriched),
        deltaColor: deltaColor(enriched),
        isStructural: Boolean(enriched.isStructural),
    };
}

function stateItem(change, index, ctx) {
    const { key, entity, byId, blockAll, blockReason } = ctx;
    const target = change.fromEntity ? (byId.get(change.fromEntity.id) || change.fromEntity) : entity;
    const meta = stateFieldMeta(change.field);
    const before = currentValue(target, change.field);
    const after = change.newValue ?? null;
    const applicable = change.valid !== false && !blockAll && Boolean(target?.id && meta.column);
    const same = applicable && before != null
        && String(before).trim().toLowerCase() === String(after ?? "").trim().toLowerCase();
    return {
        key: `${key}:c${index}`,
        groupKey: key,
        kind: "state",
        title: meta.label,
        detail: `${stateValueLabel(change.field, before)} → ${stateValueLabel(change.field, after)}`,
        short: `${meta.short} ${stateValueLabel(change.field, after).toLowerCase()}`,
        reason: change.reason || "",
        valid: applicable && !same,
        ...(same ? { advisory: true, note: `Sin cambio: la ficha ya está en «${stateValueLabel(change.field, before)}».` } : {}),
        error: change.valid === false
            ? cleanError(change.validationError)
            : (!meta.column ? `El campo «${change.field}» no existe en la ficha.` : (blockAll ? blockReason : null)),
        field: change.field,
        targetId: target?.id || null,
        targetTitle: target?.title || change.fromEntityTitle || "",
        targetType: target?.entityType || null,
        before,
        after,
    };
}

/**
 * @param {object|null} result validated cascade
 * @param {{ relations?: object[], entities?: object[] }} [ctx]
 */
export function buildLabReview(result, { relations = [], entities = [] } = {}) {
    if (!result) return { groups: [], items: [] };
    const byId = new Map((entities || []).map((row) => [row.id, row]));
    const rows = [
        ...(result.impacts || []).map((impact) => ({ impact, collective: false })),
        ...(result.collectiveImpacts || []).map((ci) => ({
            impact: { ...ci, emotionalReaction: ci.emotionalReaction || ci.collectiveReaction || "" },
            collective: true,
        })),
    ];
    const groups = rows.map(({ impact, collective }) => {
        const key = impactKeyOf(impact);
        const entity = impact.entityResolved ? (byId.get(impact.entityResolved.id) || impact.entityResolved) : null;
        const seal = explainImpactSeal(impact);
        const blockAll = !entity || impact.valid === false;
        const blockReason = blockAll ? (seal.reasons.find((r) => r.tone === "fail")?.text || seal.headline) : null;
        const ctx = { key, entity, byId, relations, blockAll, blockReason };
        const items = [];
        const reaction = String(impact.emotionalReaction || "").trim();
        const hook = String(impact.narrativeHook || "").trim();
        if (reaction || hook) {
            items.push({
                key: `${key}:reaction`,
                groupKey: key,
                kind: "reaction",
                title: "Reacción narrativa",
                detail: reaction || hook,
                hook: hook && hook !== reaction ? hook : "",
                short: "reacción",
                reason: "",
                valid: !blockAll,
                error: blockAll ? blockReason : null,
            });
        }
        const changes = impact.resolvedChanges || [];
        const shift = impact.personalityShift;
        const stateCovered = changes.some((c) => c.kind === "entity_state_update"
            && stateFieldMeta(c.field).column === "narrative_state"
            && (c.fromEntity?.id ?? entity?.id) === entity?.id);
        if (shift?.to && entity && !stateCovered) {
            items.push(stateItem({
                kind: "entity_state_update",
                field: "narrativeState",
                newValue: shift.to,
                fromEntity: entity,
                reason: shift.reason || "",
                valid: true,
            }, "shift", ctx));
            items[items.length - 1].key = `${key}:shift`;
        }
        changes.forEach((change, index) => {
            if (RELATION_KINDS.has(change.kind)) {
                items.push(relationItem(change, index, ctx));
            } else if (change.kind === "entity_state_update") {
                items.push(stateItem(change, index, ctx));
            } else if (change.kind === "dm_note") {
                items.push({
                    key: `${key}:c${index}`,
                    groupKey: key,
                    kind: "note",
                    title: "Nota para el DM",
                    detail: change.noteText || change.reason || "",
                    short: "nota",
                    reason: "",
                    valid: false,
                    advisory: true,
                    error: null,
                });
            } else {
                items.push({
                    key: `${key}:c${index}`,
                    groupKey: key,
                    kind: "unknown",
                    title: "Cambio desconocido",
                    detail: change.kind || "",
                    short: "?",
                    reason: change.reason || "",
                    valid: false,
                    error: cleanError(change.validationError) || `Tipo «${change.kind}» desconocido.`,
                });
            }
        });
        return {
            key,
            entityId: entity?.id || null,
            entityTitle: impact.entityTitle || entity?.title || "?",
            entityType: entity?.entityType || (collective ? impact.entityKind : null) || null,
            wave: typeof impact.wave === "number" ? impact.wave : null,
            collective,
            archetype: impact.reactionArchetype || null,
            confidence: impact.confidence || "media",
            seal,
            reaction,
            hook,
            items,
        };
    });
    flagSharedEdges(groups);
    return { groups, items: groups.flatMap((g) => g.items) };
}

const SIGN_WARNING = /invirtió el signo|Invertir signo/;

/** Only an adjustment on an existing edge has a sign the DM can flip. */
export function canFlip(item) {
    return item?.kind === "relation_update" && item.before != null && Number.isFinite(item.delta) && item.delta !== 0;
}

/** The same adjustment with the opposite sign, as the DM corrected it. */
export function flippedItem(item) {
    if (!canFlip(item)) return item;
    const delta = -item.delta;
    const after = Math.max(-10, Math.min(10, item.before + delta));
    const text = delta > 0 ? `+${delta}` : String(delta);
    return {
        ...item,
        delta,
        after,
        flipped: true,
        detail: `${item.before} → ${after} (${text})`,
        short: `${item.toTitle} ${text}`,
        deltaText: text,
        deltaColor: delta > 0 ? "#3dd68c" : "#ff3355",
        warnings: (item.warnings || []).filter((w) => !SIGN_WARNING.test(w)),
    };
}

function withStrength(item, after) {
    const before = item.before;
    const delta = before != null ? after - before : after;
    const sign = delta > 0 ? "+" : "";
    return {
        ...item,
        after,
        delta,
        detail: before != null ? `${before} → ${after} (${sign}${delta})` : `nueva · peso ${after}`,
        deltaText: `${sign}${delta}`,
    };
}

/** The item as it will be written, after the DM's corrections. */
export function effectiveItem(item, decisions = {}) {
    const base = decisions[item?.key]?.flipped ? flippedItem(item) : item;
    const raw = decisions[item?.key]?.after;
    if (raw == null || raw === "" || !Number.isFinite(Number(raw))) return base;
    if (base?.kind !== "relation_add" && base?.kind !== "relation_update") return base;
    if (base.isStructural) return base;
    const after = Math.max(-10, Math.min(10, Math.round(Number(raw))));
    return withStrength(base, after);
}

/** Two reactions moving one edge: their deltas stack when both are accepted. */
function flagSharedEdges(groups) {
    const byEdge = new Map();
    for (const group of groups) {
        for (const item of group.items) {
            if (!item.valid || !item.fromId || !item.toId || !RELATION_KINDS.has(item.kind)) continue;
            const edge = [item.fromId, item.toId].sort().join("|");
            if (!byEdge.has(edge)) byEdge.set(edge, []);
            byEdge.get(edge).push({ group, item });
        }
    }
    for (const rows of byEdge.values()) {
        if (rows.length < 2) continue;
        for (const { group, item } of rows) {
            const others = [...new Set(rows.filter((row) => row.group !== group).map((row) => row.group.entityTitle))];
            const text = others.length
                ? `La reacción de ${others.join(", ")} también mueve este vínculo. Si aceptas ambas, los ajustes se suman sobre el peso vigente.`
                : "Esta reacción mueve este vínculo más de una vez; los ajustes se suman sobre el peso vigente.";
            item.warnings = [...(item.warnings || []), text];
        }
    }
}

export function statusOf(decisions, key) {
    return decisions?.[key]?.status || REVIEW.PENDING;
}

/** Items that need a decision (valid, not advisory). */
export function decidable(items) {
    return (items || []).filter((item) => item.valid && !item.advisory);
}

export function reviewCounts(items, decisions) {
    const counts = { total: 0, pending: 0, accepted: 0, rejected: 0, blocked: 0 };
    for (const item of items || []) {
        if (item.advisory) continue;
        if (!item.valid) {
            counts.blocked += 1;
            continue;
        }
        counts.total += 1;
        counts[statusOf(decisions, item.key)] += 1;
    }
    return counts;
}

/**
 * Map chrome: one chip per reacting ficha, one delta per edge, ghost traces for
 * new pairs. Rejected items fade; accepted ones turn green.
 * @param {{ groups: object[] }} review
 * @param {Record<string, { status: string }>} decisions
 */
export function reviewMapChrome(review, decisions = {}) {
    const marks = {};
    const edgeDeltas = {};
    const ghosts = [];
    for (const group of review?.groups || []) {
        const counts = reviewCounts(group.items, decisions);
        const bits = [];
        for (const raw of group.items) {
            if (!raw.valid) continue;
            const item = effectiveItem(raw, decisions);
            const status = statusOf(decisions, item.key);
            if (item.kind !== "reaction" && status !== REVIEW.REJECTED && bits.length < 2) bits.push(item.short);
            if (!item.edgeKey) continue;
            const color = status === REVIEW.ACCEPTED ? REVIEW_COLOR.accepted
                : status === REVIEW.REJECTED ? REVIEW_COLOR.rejected
                    : item.deltaColor;
            const text = status === REVIEW.ACCEPTED ? `✓ ${item.deltaText}`
                : status === REVIEW.REJECTED ? `✕ ${item.deltaText}`
                    : item.deltaText;
            edgeDeltas[item.edgeKey] = { text, color, status, itemKey: item.key };
            if (item.isNew && status !== REVIEW.REJECTED && status !== REVIEW.ACCEPTED) {
                ghosts.push({
                    key: item.edgeKey,
                    fromId: item.fromId,
                    toId: item.toId,
                    label: `${item.title} · ${item.after ?? 0}`,
                    color: item.deltaColor,
                    itemKey: item.key,
                });
            }
        }
        if (!group.entityId) continue;
        const done = counts.total > 0 && counts.pending === 0;
        const allRejected = done && counts.accepted === 0;
        const color = done ? (allRejected ? REVIEW_COLOR.rejected : REVIEW_COLOR.accepted) : sealGradeColor(group.seal.grade);
        const head = done
            ? (allRejected ? "✕ rechazado" : `✓ ${counts.accepted}/${counts.total}`)
            : `${group.seal.label}${counts.total ? ` · ${counts.accepted + counts.rejected}/${counts.total}` : ""}`;
        marks[group.entityId] = {
            grade: group.seal.grade,
            color,
            label: bits.length && !done ? `${head} · ${bits.join(" · ")}` : head,
            status: done ? (allRejected ? REVIEW.REJECTED : REVIEW.ACCEPTED) : REVIEW.PENDING,
        };
    }
    return { marks, edgeDeltas, ghosts };
}

/* ── Neural Lab blocks on the ficha ─────────────────────────────────────── */

export function neuralBlockId(runId, entityId) {
    return `nl-${runId}-${entityId}`;
}

export function isNeuralLabBlock(block) {
    return block?.source === "neural_lab";
}

/**
 * Upsert the run's block on a ficha. `mutate` gets the current block (or a fresh one)
 * and returns the next one. An empty block is dropped.
 * @param {object[]} blocks
 * @param {{ runId: string, group: object, eventTitle?: string, eventSummary?: string }} meta
 * @param {(block: object) => object} mutate
 */
export function upsertNeuralBlock(blocks, meta, mutate) {
    const list = Array.isArray(blocks) ? blocks : [];
    const id = neuralBlockId(meta.runId, meta.group.entityId);
    const found = list.find((b) => b.id === id);
    const base = found || {
        id,
        source: "neural_lab",
        createdAt: Date.now(),
        updatedAt: null,
        eventTitle: String(meta.eventTitle || "").trim(),
        eventSummary: String(meta.eventSummary || "").trim().slice(0, 280),
        wave: meta.group.wave,
        body: "",
        relationEffects: [],
        stateEffects: [],
        seal: meta.group.seal.grade,
        sealHeadline: meta.group.seal.headline,
        sealReasons: meta.group.seal.reasons.map((r) => r.text).slice(0, 5),
        archetype: meta.group.archetype || null,
        createdByAi: true,
        editedByHuman: false,
        acceptedByDm: true,
        dmOnly: true,
        primaryEntityId: meta.group.entityId,
        forEntityId: meta.group.entityId,
    };
    const next = { ...mutate(base), updatedAt: found ? Date.now() : null };
    const empty = !String(next.body || "").trim()
        && !(next.relationEffects || []).length
        && !(next.stateEffects || []).length;
    if (empty) return list.filter((b) => b.id !== id);
    return found ? list.map((b) => (b.id === id ? next : b)) : [next, ...list];
}

/** Effect row stored on the block for an accepted item. */
export function effectOfItem(item) {
    if (item.kind === "state") {
        return {
            itemKey: item.key,
            field: item.field,
            fieldLabel: stateFieldMeta(item.field).label,
            targetId: item.targetId,
            targetTitle: item.targetTitle,
            before: item.before ?? null,
            after: item.after ?? null,
            beforeLabel: stateValueLabel(item.field, item.before),
            afterLabel: stateValueLabel(item.field, item.after),
        };
    }
    const before = item.before ?? null;
    const after = item.after ?? null;
    return {
        itemKey: item.key,
        kind: item.kind,
        fromTitle: item.fromTitle,
        toTitle: item.toTitle,
        fromEntityId: item.fromId,
        toEntityId: item.toId,
        relationType: item.relationType,
        before,
        after,
        strengthDelta: item.kind === "relation_remove"
            ? null
            : (item.delta ?? (after != null ? after - (before ?? 0) : null)),
        ...(item.flipped ? { dmFlipped: true } : {}),
    };
}

export function withItemEffect(block, item, reactionBody = "") {
    if (item.kind === "reaction") return { ...block, body: reactionBody };
    const effect = effectOfItem(item);
    if (item.kind === "state") {
        return { ...block, stateEffects: [...(block.stateEffects || []).filter((e) => e.itemKey !== item.key), effect] };
    }
    return { ...block, relationEffects: [...(block.relationEffects || []).filter((e) => e.itemKey !== item.key), effect] };
}

export function withoutItemEffect(block, item) {
    if (item.kind === "reaction") return { ...block, body: "" };
    return {
        ...block,
        stateEffects: (block.stateEffects || []).filter((e) => e.itemKey !== item.key),
        relationEffects: (block.relationEffects || []).filter((e) => e.itemKey !== item.key),
    };
}

/** Same block (by id) placed into another list: replace, insert or remove. */
export function syncBlockInto(blocks, blockId, block) {
    const list = Array.isArray(blocks) ? blocks : [];
    if (!block) return list.filter((b) => b.id !== blockId);
    return list.some((b) => b.id === blockId)
        ? list.map((b) => (b.id === blockId ? block : b))
        : [block, ...list];
}
