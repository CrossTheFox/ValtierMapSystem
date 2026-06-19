/**
 * buildWikiContextPack.js
 *
 * Packages wiki entities, relations, and @mention backlinks into a structured
 * plain-text representation suitable for inclusion in an LLM prompt.
 *
 * Usage (no UI — pure utility):
 *
 *   import { buildWikiContextPack } from "../utils/buildWikiContextPack";
 *
 *   const pack = buildWikiContextPack(entities, relations, {
 *     focusEntityId: "abc123",   // optional: center context around one entity
 *     role: "dm",                // "dm" (all) | "player" (only visible entities)
 *     maxChars: 12000,           // soft character limit for the output
 *   });
 *   // pack.text  → full structured text for the prompt
 *   // pack.meta  → { entityCount, relationCount, truncated }
 */

import { WIKI_ENTITY_TYPE_LABELS } from "../constants/wikiEntityTypes";
import { WIKI_RELATION_TYPE_LABELS } from "../constants/wikiRelationTypes";
import { parseMentions, getBacklinkIds } from "./wikiSlug";

// ── Serializers ──────────────────────────────────────────────────────────────

function entityToText(entity) {
    const typeLabel = WIKI_ENTITY_TYPE_LABELS[entity.entityType] || entity.entityType;
    const lines = [
        `## ${entity.title} [${typeLabel}]`,
        entity.summary ? `> ${entity.summary}` : "",
        "",
    ];

    if (entity.body?.trim()) {
        lines.push(entity.body.trim());
        lines.push("");
    }

    if (entity.tags?.length) {
        lines.push(`Etiquetas: ${entity.tags.join(", ")}`);
    }

    return lines.filter((l) => l !== undefined).join("\n").trimEnd();
}

function relationsToText(relations, entities) {
    if (!relations.length) return "";

    const entityMap = new Map(entities.map((e) => [e.id, e.title]));

    const lines = relations.map((r) => {
        const fromTitle = entityMap.get(r.fromEntityId) ?? r.fromEntityId;
        const toTitle = entityMap.get(r.toEntityId) ?? r.toEntityId;
        const relLabel = WIKI_RELATION_TYPE_LABELS?.[r.relationType] ?? r.relationType ?? "relacionado con";
        const note = r.label ? ` (${r.label})` : "";
        return `- ${fromTitle} → [${relLabel}] → ${toTitle}${note}`;
    });

    return `## Relaciones entre entidades\n\n${lines.join("\n")}`;
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Build a context pack for LLM consumption.
 *
 * @param {object[]} entities  — wikiEntity[] (all accessible by role)
 * @param {object[]} relations — wikiRelation[] (all campaign relations)
 * @param {{ focusEntityId?: string, role?: string, maxChars?: number }} opts
 * @returns {{ text: string, meta: { entityCount: number, relationCount: number, truncated: boolean } }}
 */
export function buildWikiContextPack(entities = [], relations = [], opts = {}) {
    const { focusEntityId, role = "dm", maxChars = 12000 } = opts;

    // Filter by visibility if role is player
    const visibleEntities =
        role === "player"
            ? entities.filter((e) => e.visibility === "players")
            : entities;

    const visibleIds = new Set(visibleEntities.map((e) => e.id));

    // Filter relations to only those between visible entities
    const visibleRelations = relations.filter(
        (r) => visibleIds.has(r.fromEntityId) && visibleIds.has(r.toEntityId)
    );

    // If a focus entity is provided, prioritize it and its direct neighbors
    let orderedEntities = [...visibleEntities];
    if (focusEntityId && visibleIds.has(focusEntityId)) {
        const neighborIds = new Set();
        for (const r of visibleRelations) {
            if (r.fromEntityId === focusEntityId) neighborIds.add(r.toEntityId);
            if (r.toEntityId === focusEntityId) neighborIds.add(r.fromEntityId);
        }
        // Mention backlinks as neighbors too
        for (const id of getBacklinkIds(focusEntityId, visibleEntities)) {
            neighborIds.add(id);
        }

        const focus = visibleEntities.filter((e) => e.id === focusEntityId);
        const neighbors = visibleEntities.filter((e) => neighborIds.has(e.id) && e.id !== focusEntityId);
        const rest = visibleEntities.filter((e) => !neighborIds.has(e.id) && e.id !== focusEntityId);
        orderedEntities = [...focus, ...neighbors, ...rest];
    }

    const sections = [];

    sections.push(
        "# Contexto del archivo narrativo de campaña\n",
        `Total de fichas: ${visibleEntities.length} | Total de relaciones: ${visibleRelations.length}\n`
    );

    // Entities section
    const entityTexts = orderedEntities.map(entityToText);
    sections.push("---\n# Fichas narrativas\n");
    sections.push(...entityTexts);

    // Relations section
    if (visibleRelations.length > 0) {
        sections.push("\n---\n");
        sections.push(relationsToText(visibleRelations, visibleEntities));
    }

    let text = sections.join("\n\n");
    let truncated = false;

    if (text.length > maxChars) {
        text = text.slice(0, maxChars);
        // Avoid cutting mid-word
        const lastNewline = text.lastIndexOf("\n");
        if (lastNewline > maxChars * 0.9) text = text.slice(0, lastNewline);
        text += "\n\n[...contexto truncado por límite de caracteres]";
        truncated = true;
    }

    return {
        text,
        meta: {
            entityCount: visibleEntities.length,
            relationCount: visibleRelations.length,
            truncated,
        },
    };
}

/**
 * Convenience: build context focused on a specific entity.
 */
export function buildEntityFocusContext(entityId, entities, relations, role = "dm") {
    return buildWikiContextPack(entities, relations, { focusEntityId: entityId, role, maxChars: 8000 });
}
