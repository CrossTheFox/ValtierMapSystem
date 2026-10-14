/**
 * Writes one accepted Neural Lab item onto the Lore, and undoes it.
 * Every accepted item also lands in the run's `neural_lab` block on the reacting ficha.
 */

import { defaultStrengthForRelation, resolveRelationStrength, WIKI_RELATION_TYPES } from "../constants/wikiRelationTypes.js";
import { WIKI_ENTITY_TYPES } from "../constants/wikiEntityTypes.js";
import { findRelationForPair, proposeLabRelation } from "./labGraph.js";
import { linkMentionsInText } from "./linkWikiMentions.js";
import {
    neuralBlockId,
    stateFieldMeta,
    upsertNeuralBlock,
    withItemEffect,
    withoutItemEffect,
} from "./labImpactReview.js";
import {
    deleteLoreRelation,
    patchLoreRelation,
    replaceLoreRelation,
} from "../../firebase/services/loreRelationService.js";
import { updateLoreFicha } from "../../firebase/services/loreFichaService.js";

function statePatch(entityType, field, value) {
    const column = stateFieldMeta(field).column;
    if (!column) return null;
    if (column === "narrative_state" && entityType !== WIKI_ENTITY_TYPES.PERSONAJE) return null;
    if ((column === "condicion" || column === "condicion_nota") && entityType !== WIKI_ENTITY_TYPES.LOCACION) return null;
    return { [column]: value ?? null };
}

function asRow(rel) {
    return {
        from_ficha_id: rel.from_ficha_id || rel.fromEntityId,
        to_ficha_id: rel.to_ficha_id || rel.toEntityId,
        relation_type: rel.relation_type || rel.relationType,
        label: rel.label || "",
        strength: Number(rel.strength ?? 0),
        neural_lab: rel.neural_lab || null,
    };
}

function reactionBody(group, entities) {
    const lines = [group.reaction, group.hook && group.hook !== group.reaction ? group.hook : ""].filter(Boolean);
    return linkMentionsInText(lines.join("\n"), entities || []);
}

/**
 * @param {{
 *   loreId: string, runId: string, group: object, item: object,
 *   relations: object[], blocks: object[], entities: object[],
 *   eventTitle?: string, eventSummary?: string,
 * }} ctx
 * @returns {Promise<{ undo: object, blocks: object[], block: object|null, relations: object[] }>}
 */
export async function acceptReviewItem(ctx) {
    const { loreId, runId, group, item, entities = [] } = ctx;
    if (!loreId || !group?.entityId) throw new Error("La reacción no tiene una ficha resuelta.");
    if (!item?.valid) throw new Error(item?.error || "Este cambio no pasó la validación.");
    let relations = [...(ctx.relations || [])];
    let undo = { kind: "none" };
    const stamp = {
        run_id: runId,
        event_title: String(ctx.eventTitle || "").slice(0, 160),
        at: Date.now(),
        by_entity_id: group.entityId,
    };

    if (item.kind === "state") {
        const target = entities.find((e) => e.id === item.targetId);
        const type = target?.entityType || item.targetType;
        const patch = statePatch(type, item.field, item.after);
        if (!patch) throw new Error(`«${item.title}» no aplica a esta ficha.`);
        await updateLoreFicha(loreId, item.targetId, patch);
        undo = { kind: "state", targetId: item.targetId, patch: statePatch(type, item.field, item.before) };
    } else if (item.kind === "relation_add" || item.kind === "relation_update") {
        const existing = findRelationForPair(relations, item.fromId, item.toId);
        const sameType = existing && (existing.relation_type || existing.relationType) === item.relationType;
        const stacked = sameType && item.kind === "relation_update" && Number.isFinite(item.delta);
        const strength = stacked
            ? resolveRelationStrength({
                relationType: item.relationType,
                fromEntityType: item.fromType,
                toEntityType: item.toType,
                strength: Number(existing.strength ?? 0) + item.delta,
            })
            : (item.after ?? defaultStrengthForRelation(item.relationType, item.fromType, item.toType));
        const provenance = { ...stamp, before: existing ? Number(existing.strength ?? 0) : null, after: strength };
        if (sameType) {
            await patchLoreRelation(loreId, existing.id, { strength, neural_lab: provenance });
            const prev = Number(existing.strength ?? 0);
            undo = { kind: "relation_patch", id: existing.id, strength: prev, applied: strength - prev, neural_lab: existing.neural_lab ?? null };
            relations = relations.map((row) => (row.id === existing.id ? { ...row, strength, neural_lab: provenance } : row));
        } else {
            const proposed = proposeLabRelation({
                fromId: item.fromId,
                toId: item.toId,
                fromType: item.fromType,
                toType: item.toType,
                relationType: item.relationType,
                strength,
                label: item.relationType === WIKI_RELATION_TYPES.OTRO ? String(item.label || "").slice(0, 80) : "",
                existing,
            });
            if (!proposed.ok) throw new Error(proposed.error);
            const id = await replaceLoreRelation(loreId, { ...proposed.row, replaceId: proposed.replaceId, neural_lab: provenance });
            undo = { kind: "relation_replace", id, previous: existing ? asRow(existing) : null };
            relations = relations.filter((row) => row.id !== proposed.replaceId);
            relations.push({ id, ...proposed.row, neural_lab: provenance });
        }
    } else if (item.kind === "relation_remove") {
        const existing = findRelationForPair(relations, item.fromId, item.toId);
        if (!existing?.id) throw new Error("Ese vínculo ya no existe.");
        await deleteLoreRelation(loreId, existing.id);
        undo = { kind: "relation_restore", previous: asRow(existing) };
        relations = relations.filter((row) => row.id !== existing.id);
    } else if (item.kind !== "reaction") {
        throw new Error("Este cambio no se puede aplicar.");
    }

    const meta = { runId, group, eventTitle: ctx.eventTitle, eventSummary: ctx.eventSummary };
    const body = item.kind === "reaction" ? reactionBody(group, entities) : "";
    const blocks = upsertNeuralBlock(ctx.blocks, meta, (block) => withItemEffect(block, item, body));
    await updateLoreFicha(loreId, group.entityId, { ai_impact_blocks: blocks });
    const blockId = neuralBlockId(runId, group.entityId);
    return {
        undo: { ...undo, itemKey: item.key, entityId: group.entityId, blockId },
        blocks,
        block: blocks.find((b) => b.id === blockId) || null,
        relations,
    };
}

/**
 * @param {{ loreId: string, runId: string, group: object, item: object, undo: object, blocks: object[], relations: object[] }} ctx
 * @returns {Promise<{ blocks: object[], block: object|null, relations: object[] }>}
 */
export async function undoReviewItem(ctx) {
    const { loreId, runId, group, item, undo } = ctx;
    let relations = [...(ctx.relations || [])];
    if (undo?.kind === "state" && undo.patch) {
        await updateLoreFicha(loreId, undo.targetId, undo.patch);
    } else if (undo?.kind === "relation_patch") {
        const live = relations.find((row) => row.id === undo.id);
        const strength = live && Number.isFinite(undo.applied)
            ? Math.max(-10, Math.min(10, Number(live.strength ?? 0) - undo.applied))
            : undo.strength;
        const laterStamp = live?.neural_lab && live.neural_lab.by_entity_id !== group.entityId ? live.neural_lab : null;
        await patchLoreRelation(loreId, undo.id, { strength, neural_lab: laterStamp || undo.neural_lab });
        relations = relations.map((row) => (row.id === undo.id ? { ...row, strength } : row));
    } else if (undo?.kind === "relation_replace") {
        const previous = undo.previous;
        if (previous) {
            const id = await replaceLoreRelation(loreId, { ...previous, replaceId: undo.id });
            relations = relations.filter((row) => row.id !== undo.id);
            relations.push({ id, ...previous });
        } else {
            await deleteLoreRelation(loreId, undo.id);
            relations = relations.filter((row) => row.id !== undo.id);
        }
    } else if (undo?.kind === "relation_restore" && undo.previous) {
        const id = await replaceLoreRelation(loreId, undo.previous);
        relations.push({ id, ...undo.previous });
    }
    const meta = { runId, group };
    const blocks = upsertNeuralBlock(ctx.blocks, meta, (block) => withoutItemEffect(block, item));
    await updateLoreFicha(loreId, group.entityId, { ai_impact_blocks: blocks });
    const blockId = neuralBlockId(runId, group.entityId);
    return { blocks, block: blocks.find((b) => b.id === blockId) || null, relations };
}
