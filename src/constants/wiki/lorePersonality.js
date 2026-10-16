/**
 * Personality of a Lore ficha, as the cascade reads it.
 * Lore fichas keep flat snake_case columns; the AI context reads
 * `customFields.personaje` / `customFields.locacion|organizacion` (buildSituationContext).
 */

import {
    COLLECTIVE_ARCHETYPE_AI_DESCRIPTIONS,
    COLLECTIVE_ARCHETYPE_LABELS,
    COLLECTIVE_ARCHETYPE_OPTIONS,
    NARRATIVE_STATE_LABELS,
    NARRATIVE_STATE_OPTIONS,
    NARRATIVE_STATE_TOOLTIPS,
    REACTION_ARCHETYPE_AI_DESCRIPTIONS,
    REACTION_ARCHETYPE_LABELS,
    REACTION_ARCHETYPE_OPTIONS,
    REACTION_ARCHETYPE_TOOLTIPS,
    STRESS_RESPONSE_AI_DESCRIPTIONS,
    STRESS_RESPONSE_LABELS,
    STRESS_RESPONSE_OPTIONS,
    STRESS_RESPONSE_TOOLTIPS,
} from "./entityFieldSchemas.js";

export const LORE_PERSONALITY_COLUMNS = [
    "reaction_archetype",
    "narrative_state",
    "stress_response",
    "narrative_traits",
    "bond_notes",
    "collective_archetype",
    "collective_mood",
];

export const MAX_NARRATIVE_TRAITS = 5;

export const PERSONALITY_AI_NOTE =
    "La IA recibe esta descripción tal cual en el contexto del impacto. "
    + "Por eso decide cómo reacciona la ficha ante el evento y qué vínculos mueve.";

export const COLLECTIVE_FIELD_HELP =
    "Cómo reacciona el lugar u organización como grupo. Cambia poco.";

export const COLLECTIVE_MOOD_FIELD_HELP =
    "Ánimo actual del grupo (texto libre). La IA puede proponer cambiarlo tras un evento.";

const pick = (options, labels, tooltips, ai) => options.map((opt) => ({
    value: opt.value,
    label: labels[opt.value] || opt.label,
    short: tooltips ? String(tooltips[opt.value] || "").replace(/^[^:]+:\s*/, "") : "",
    ai: ai ? ai[opt.value] || "" : "",
}));

export const REACTION_CHOICES = pick(
    REACTION_ARCHETYPE_OPTIONS, REACTION_ARCHETYPE_LABELS, REACTION_ARCHETYPE_TOOLTIPS, REACTION_ARCHETYPE_AI_DESCRIPTIONS,
);
export const STRESS_CHOICES = pick(
    STRESS_RESPONSE_OPTIONS, STRESS_RESPONSE_LABELS, STRESS_RESPONSE_TOOLTIPS, STRESS_RESPONSE_AI_DESCRIPTIONS,
);
export const STATE_CHOICES = pick(NARRATIVE_STATE_OPTIONS, NARRATIVE_STATE_LABELS, NARRATIVE_STATE_TOOLTIPS, null);
export const COLLECTIVE_CHOICES = pick(
    COLLECTIVE_ARCHETYPE_OPTIONS, COLLECTIVE_ARCHETYPE_LABELS, null, COLLECTIVE_ARCHETYPE_AI_DESCRIPTIONS,
);

/** @param {unknown} raw */
export function traitList(raw) {
    const list = Array.isArray(raw) ? raw : String(raw || "").split(/[\n;]/);
    return list.map((t) => String(t || "").trim()).filter(Boolean).slice(0, MAX_NARRATIVE_TRAITS);
}

/**
 * `customFields` for the AI from a Lore ficha row.
 * @param {object} row
 */
export function lorePersonalityCustomFields(row) {
    const collective = {
        collectiveArchetype: row?.collective_archetype || null,
        collectiveMood: row?.collective_mood || null,
    };
    return {
        narrativeState: row?.narrative_state || null,
        collectiveMood: row?.collective_mood || null,
        personaje: {
            reactionArchetype: row?.reaction_archetype || null,
            narrativeState: row?.narrative_state || null,
            stressResponse: row?.stress_response || null,
            narrativeTraits: traitList(row?.narrative_traits),
            bondNotes: row?.bond_notes || "",
        },
        locacion: collective,
        organizacion: collective,
    };
}

/** One line for the Codex: «Guardián · Venganza · Furiosa». */
export function personalitySummary(row) {
    if (row?.entity_type === "personaje" || row?.entityType === "personaje") {
        return [
            REACTION_ARCHETYPE_LABELS[row?.reaction_archetype],
            STRESS_RESPONSE_LABELS[row?.stress_response],
            NARRATIVE_STATE_LABELS[row?.narrative_state],
        ].filter(Boolean).join(" · ");
    }
    return [
        COLLECTIVE_ARCHETYPE_LABELS[row?.collective_archetype],
        row?.collective_mood,
    ].filter(Boolean).join(" · ");
}
