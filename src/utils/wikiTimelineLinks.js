import { WIKI_RELATION_TYPES } from "../constants/wikiRelationTypes";
import { WIKI_ENTITY_TYPES } from "../constants/wikiEntityTypes";
import { EVENT_KIND_LABELS } from "../constants/wiki/entityFieldSchemas";
import { getTimelineMeta, resolveEventArc } from "./wikiTimeline";

const R = WIKI_RELATION_TYPES;
const CHIP_TYPES = new Set([
    WIKI_ENTITY_TYPES.LOCACION,
    WIKI_ENTITY_TYPES.PERSONAJE,
    WIKI_ENTITY_TYPES.ORGANIZACION,
    WIKI_ENTITY_TYPES.RELIQUIA,
]);

const MAX_LINK_CHIPS = 4;

/**
 * Vínculos narrativos de un evento para chips en la línea temporal.
 * @returns {{ id: string, title: string, entityType: string, relationType: string }[]}
 */
export function buildEventLinkChips(eventId, relations = [], entities = []) {
    if (!eventId) return [];
    const byId = new Map(entities.map((e) => [e.id, e]));
    const chips = [];
    const seen = new Set();

    const push = (entity, relationType) => {
        if (!entity || !CHIP_TYPES.has(entity.entityType)) return;
        const key = `${entity.id}|${relationType}`;
        if (seen.has(key)) return;
        seen.add(key);
        chips.push({
            id: entity.id,
            title: entity.title || entity.slug || "Sin título",
            entityType: entity.entityType,
            relationType,
        });
    };

    for (const rel of relations) {
        if (rel.fromEntityId === eventId && rel.relationType === R.OCURRIO_EN) {
            push(byId.get(rel.toEntityId), R.OCURRIO_EN);
        }
        if (rel.toEntityId === eventId && rel.relationType === R.PARTICIPO_EN) {
            push(byId.get(rel.fromEntityId), R.PARTICIPO_EN);
        }
    }

    return chips.slice(0, MAX_LINK_CHIPS);
}

/**
 * Eventos desencadenados por este (flechas causales).
 * @returns {{ targetId: string, title: string }[]}
 */
export function buildEventCausalTargets(eventId, relations = [], entities = []) {
    if (!eventId) return [];
    const byId = new Map(entities.map((e) => [e.id, e]));
    return relations
        .filter((rel) => rel.fromEntityId === eventId && rel.relationType === R.DESENCADENO)
        .map((rel) => {
            const ent = byId.get(rel.toEntityId);
            return ent
                ? { targetId: ent.id, title: ent.title || "Evento" }
                : null;
        })
        .filter(Boolean);
}

/**
 * Opciones de filtro derivadas de relaciones existentes en la timeline.
 * @param {object[]} timelineEntities
 * @param {object[]} relations
 * @param {object[]} allEntities
 * @param {{ id: string, label: string }[]} [arcCatalog]
 */
export function buildTimelineFilterOptions(
    timelineEntities = [],
    relations = [],
    allEntities = [],
    arcCatalog = [],
) {
    const eventIds = new Set(timelineEntities.map((e) => e.id));
    const byId = new Map(allEntities.map((e) => [e.id, e]));
    const locaciones = new Map();
    const personajes = new Map();
    const organizaciones = new Map();
    const eventKinds = new Set();
    const narrativeArcs = new Map();

    for (const a of arcCatalog) {
        if (a?.id) narrativeArcs.set(a.id, a.label || a.id);
    }

    for (const ent of timelineEntities) {
        const meta = getTimelineMeta(ent);
        if (meta.eventKind) eventKinds.add(meta.eventKind);
        const resolved = resolveEventArc(ent, arcCatalog);
        if (resolved.arcId) {
            narrativeArcs.set(resolved.arcId, resolved.label);
        } else if (resolved.label) {
            narrativeArcs.set(`label:${resolved.label}`, resolved.label);
        }
    }

    for (const rel of relations) {
        const isEventFrom = eventIds.has(rel.fromEntityId);
        const isEventTo = eventIds.has(rel.toEntityId);
        if (!isEventFrom && !isEventTo) continue;

        if (isEventFrom && rel.relationType === R.OCURRIO_EN) {
            const loc = byId.get(rel.toEntityId);
            if (loc?.entityType === WIKI_ENTITY_TYPES.LOCACION) {
                locaciones.set(loc.id, loc.title);
            }
        }
        if (isEventTo && rel.relationType === R.PARTICIPO_EN) {
            const actor = byId.get(rel.fromEntityId);
            if (actor?.entityType === WIKI_ENTITY_TYPES.PERSONAJE) {
                personajes.set(actor.id, actor.title);
            }
            if (actor?.entityType === WIKI_ENTITY_TYPES.ORGANIZACION) {
                organizaciones.set(actor.id, actor.title);
            }
        }
    }

    const sortEntries = (map) =>
        [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "es")).map(([id, title]) => ({ id, title }));

    return {
        locaciones: sortEntries(locaciones),
        personajes: sortEntries(personajes),
        organizaciones: sortEntries(organizaciones),
        eventKinds: [...eventKinds].map((k) => ({
            id: k,
            title: EVENT_KIND_LABELS[k] || k,
        })),
        narrativeArcs: sortEntries(narrativeArcs),
    };
}

/**
 * @typedef {'all'|'locacion'|'personaje'|'organizacion'|'tema'|'arco'} TimelineFilterLens
 */

/**
 * @param {object[]} timelineEntities
 * @param {object[]} relations
 * @param {{ lens: TimelineFilterLens, targetId?: string|null, arcs?: { id: string, label: string }[] }} filter
 * @returns {Set<string>} event ids that match (empty = show all when lens is all)
 */
export function getTimelineFilterMatchIds(timelineEntities, relations, filter) {
    const { lens, targetId, arcs = [] } = filter;
    if (lens === "all" || !targetId) {
        return new Set(timelineEntities.map((e) => e.id));
    }

    const eventIds = new Set(timelineEntities.map((e) => e.id));
    const matched = new Set();

    if (lens === "tema") {
        for (const ent of timelineEntities) {
            if (getTimelineMeta(ent).eventKind === targetId) matched.add(ent.id);
        }
        return matched;
    }

    if (lens === "arco") {
        const legacyLabel = targetId.startsWith("label:") ? targetId.slice(6) : null;
        for (const ent of timelineEntities) {
            const resolved = resolveEventArc(ent, arcs);
            if (legacyLabel) {
                if (resolved.label === legacyLabel) matched.add(ent.id);
            } else if (resolved.arcId === targetId || resolved.label === targetId) {
                matched.add(ent.id);
            }
        }
        return matched;
    }

    for (const rel of relations) {
        if (lens === "locacion" && rel.relationType === R.OCURRIO_EN) {
            if (eventIds.has(rel.fromEntityId) && rel.toEntityId === targetId) {
                matched.add(rel.fromEntityId);
            }
        }
        if ((lens === "personaje" || lens === "organizacion") && rel.relationType === R.PARTICIPO_EN) {
            if (eventIds.has(rel.toEntityId) && rel.fromEntityId === targetId) {
                matched.add(rel.toEntityId);
            }
        }
    }

    return matched;
}
