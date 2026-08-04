/**
 * applyProposedWikiEvent.js
 *
 * Persists a CASCADE proposedEvent as evento_historico + participo_en relations.
 * Called from WikiCascadeResult after DM confirmation.
 */

import { slugify, uniqueSlug, buildMentionToken } from "./wikiSlug.js";
import { linkMentionsInText } from "./linkWikiMentions.js";
import { resolveCampaignNarrativeDate } from "../constants/wiki/campaignNarrativeDefaults.js";
import {
    WIKI_RELATION_TYPES,
    resolveRelationEndpoints,
    defaultStrengthForRelationType,
} from "../constants/wikiRelationTypes.js";
import { WIKI_ENTITY_TYPES } from "../constants/wikiEntityTypes.js";

function resolveEntityTitle(title, entities) {
    if (!title) return null;
    const key = title.toLowerCase().trim();

    const exact = entities.find((e) => e.title?.toLowerCase().trim() === key);
    if (exact) return exact;

    const byFirst = new Map();
    for (const e of entities) {
        if (!e.title) continue;
        const first = e.title.toLowerCase().trim().split(/\s+/)[0];
        if (!byFirst.has(first)) byFirst.set(first, []);
        byFirst.get(first).push(e);
    }
    const fm = byFirst.get(key) ?? [];
    if (fm.length === 1) return fm[0];

    for (const e of entities) {
        const norm = e.title?.toLowerCase().trim() ?? "";
        if (norm.startsWith(key) || key.startsWith(norm)) return e;
    }
    return null;
}

/**
 * @param {object} params
 * @param {Function} params.dispatch — Redux dispatch
 * @param {Function} params.saveWikiEntity — wikiSlice thunk
 * @param {Function} params.addWikiRelation — wikiSlice thunk
 * @param {string} params.campaignId
 * @param {string} params.uid
 * @param {object} params.proposedEvent — from validateCascadeResponse
 * @param {string} [params.fallbackEventKind] — result.eventKind
 * @param {object[]} params.entities — full campaign entities for title resolution
 * @param {{ narrativeDate?: string|null, narrativeCalendar?: string|null }} [params.narrativeSettings]
 * @returns {Promise<{ entityId: string, relationsCreated: number, unresolvedParticipants: string[] }>}
 */
export async function applyProposedWikiEvent({
    dispatch,
    saveWikiEntity,
    addWikiRelation,
    campaignId,
    uid,
    proposedEvent,
    fallbackEventKind,
    entities = [],
    narrativeSettings = null,
}) {
    if (!campaignId) throw new Error("campaignId requerido.");
    if (!proposedEvent?.shouldCreate || !proposedEvent.title?.trim()) {
        throw new Error("El evento propuesto no es válido para crear.");
    }

    const narrative = resolveCampaignNarrativeDate(campaignId, narrativeSettings);
    const existingSlugs = entities.map((e) => e.slug).filter(Boolean);
    const slug = uniqueSlug(slugify(proposedEvent.title), existingSlugs);

    const unresolvedParticipants = [];
    const resolvedParticipants = [];
    for (const participantTitle of proposedEvent.participants ?? []) {
        const participant = resolveEntityTitle(participantTitle, entities);
        if (!participant) {
            unresolvedParticipants.push(participantTitle);
            continue;
        }
        resolvedParticipants.push(participant);
    }

    const rawSummary = (proposedEvent.summary ?? "").trim();
    const summary = linkMentionsInText(rawSummary, entities);
    const participantLines = resolvedParticipants.map(
        (p) => `- ${buildMentionToken(p.title, p.id)}`
    );
    const unresolvedLines = unresolvedParticipants.map((t) => `- ${t} (sin resolver)`);
    const bodyParts = [];
    if (summary) bodyParts.push(summary);
    if (participantLines.length || unresolvedLines.length) {
        bodyParts.push(
            ["## Participantes", ...participantLines, ...unresolvedLines].join("\n")
        );
    }
    const body = linkMentionsInText(bodyParts.join("\n\n"), entities);

    const eventPayload = {
        entityType: WIKI_ENTITY_TYPES.EVENTO_HISTORICO,
        title: proposedEvent.title.trim(),
        summary,
        body,
        tags: ["ai-cascade"],
        visibility: "dm_only",
        slug,
        customFields: {
            timeline: {
                calendar: narrative?.calendar ?? "dz",
                date: narrative?.narrativeDate ?? "",
                branch: "center",
                isCore: false,
                anchorId: null,
                eventKind: proposedEvent.eventKind || fallbackEventKind || "otro",
                certainty: proposedEvent.certainty || "canon",
                narrativeArc: "",
                narrativeArcId: null,
            },
        },
    };

    const created = await dispatch(
        saveWikiEntity({ campaignId, entityId: null, data: eventPayload, uid })
    ).unwrap();

    const eventEntity = { id: created.id, entityType: WIKI_ENTITY_TYPES.EVENTO_HISTORICO, title: eventPayload.title };
    let relationsCreated = 0;

    for (const participant of resolvedParticipants) {
        const endpoints = resolveRelationEndpoints(
            participant,
            eventEntity,
            WIKI_RELATION_TYPES.PARTICIPO_EN
        );

        await dispatch(addWikiRelation({
            campaignId,
            uid,
            data: {
                fromEntityId: endpoints.fromEntityId,
                toEntityId: endpoints.toEntityId,
                relationType: WIKI_RELATION_TYPES.PARTICIPO_EN,
                label: "",
                strength: defaultStrengthForRelationType(WIKI_RELATION_TYPES.PARTICIPO_EN),
            },
        })).unwrap();

        relationsCreated += 1;
    }

    return {
        entityId: created.id,
        relationsCreated,
        unresolvedParticipants,
    };
}
