/**
 * validateAiResponse.js
 *
 * Validación determinista post-IA para ambos modos (situation / narrative_impact).
 * Principio G-KMS + CallSphere: nunca confiar en schema compliance del LLM solo.
 *
 * Cada función retorna:
 *   { ok: boolean, parsed, errors: string[], items: ValidatedItem[] }
 *
 * Para narrative_impact, cada ValidatedItem tiene además:
 *   { valid: boolean, fromEntityId, toEntityId, reason }
 * que alimenta directamente dispatch(addWikiRelation) o dispatch(removeWikiRelation).
 */

import {
    normalizeRelationType,
    validateRelationCreate,
    resolveRelationEndpoints,
    defaultStrengthForRelationType,
} from "../constants/wikiRelationTypes.js";
import { AI_MODES } from "../constants/wiki/narrativeAiSchemas.js";
import {
    REACTION_ARCHETYPE_LABELS,
    NARRATIVE_STATE,
    COLLECTIVE_ARCHETYPE,
} from "../constants/wiki/entityFieldSchemas.js";
import {
    isCharacterDead,
    resolveNarrativeAiConfig,
    shouldIncludeInAiImpacts,
} from "../constants/wiki/narrativeAiConfig.js";

const KNOWN_NARRATIVE_STATE_VALUES = new Set(Object.values(NARRATIVE_STATE));
const KNOWN_COLLECTIVE_ARCHETYPE_VALUES = new Set(Object.values(COLLECTIVE_ARCHETYPE));

// ── Parse helper ──────────────────────────────────────────────────────────────

function tryParseJson(raw) {
    if (typeof raw === "object" && raw !== null) return { ok: true, value: raw };
    const s = typeof raw === "string" ? raw.trim() : "";
    // Strip possible markdown code fences Gemini occasionally adds
    const clean = s.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
    if (!clean) {
        return { ok: false, error: "La respuesta está vacía." };
    }
    const looksTruncated = clean.startsWith("{") && !clean.endsWith("}") && !clean.endsWith("]}");
    try {
        return { ok: true, value: JSON.parse(clean) };
    } catch {
        if (looksTruncated) {
            return {
                ok: false,
                error: "La respuesta JSON está truncada (el modelo se quedó sin tokens de salida). "
                    + "Reintenta; si persiste, usa thinkingBudget: 0 o sube maxOutputTokens.",
            };
        }
        return { ok: false, error: "La respuesta no es JSON válido." };
    }
}

/** Normaliza alias comunes del LLM al schema acordado. */
function normalizeSituationPayload(value) {
    if (!value || typeof value !== "object") return value;
    if (Array.isArray(value.situations)) return value;
    if (Array.isArray(value.scenarios)) {
        return { ...value, situations: value.scenarios };
    }
    return value;
}

// ── Entity resolver ───────────────────────────────────────────────────────────

/**
 * Build a multi-strategy title → entity resolver from a list of entities.
 *
 * Resolution order (stops at first unambiguous match):
 *   1. Exact title (case-insensitive)
 *   2. starts-with or ends-with prefix/suffix (existing behaviour, kept)
 *   3. First-token match ("Felicia" → "Felicia Margalous") — unique only
 *   4. Last-token match ("Margalous" → "Felicia Margalous") — unique only
 *   5. Tag match — unique only
 *
 * Returns null when ambiguous (2+ candidates) to avoid silent wrong matches.
 */
function buildTitleMap(entities) {
    const exact     = new Map();
    const byFirst   = new Map();
    const byLast    = new Map();
    const byTag     = new Map();

    for (const e of entities) {
        if (!e.title) continue;
        const norm  = e.title.toLowerCase().trim();
        exact.set(norm, e);

        const parts = norm.split(/\s+/);
        const first = parts[0];
        const last  = parts[parts.length - 1];

        if (!byFirst.has(first)) byFirst.set(first, []);
        byFirst.get(first).push(e);

        if (last !== first) {
            if (!byLast.has(last)) byLast.set(last, []);
            byLast.get(last).push(e);
        }

        for (const tag of e.tags ?? []) {
            const t = tag.toLowerCase().trim();
            if (!byTag.has(t)) byTag.set(t, []);
            byTag.get(t).push(e);
        }
    }

    return {
        resolve(title) {
            if (!title) return null;
            const key = title.toLowerCase().trim();

            // 1 — exact
            if (exact.has(key)) return exact.get(key);

            // 2 — prefix / suffix (legacy)
            for (const [k, v] of exact) {
                if (k.startsWith(key) || key.startsWith(k)) return v;
            }

            // 3 — first token (unique)
            const fm = byFirst.get(key) ?? [];
            if (fm.length === 1) return fm[0];

            // 4 — last token (unique)
            const lm = byLast.get(key) ?? [];
            if (lm.length === 1) return lm[0];

            // 5 — tag (unique)
            const tm = byTag.get(key) ?? [];
            if (tm.length === 1) return tm[0];

            return null;
        },
    };
}

// ── Situation validator ───────────────────────────────────────────────────────

/**
 * @param {unknown} raw        — raw string or object from AI
 * @param {object[]} contextEntities — entity list used to build subgraph
 * @returns {{ ok: boolean, parsed: object|null, errors: string[], situations: object[] }}
 */
export function validateSituationResponse(raw, contextEntities = [], allEntities = null) {
    const errors = [];
    const { ok, value: rawValue, error } = tryParseJson(raw);
    if (!ok) return { ok: false, parsed: null, errors: [error], situations: [] };

    const value = normalizeSituationPayload(rawValue);

    if (!Array.isArray(value?.situations)) {
        errors.push('El JSON no tiene campo "situations" (array).');
        return { ok: false, parsed: value, errors, situations: [] };
    }

    const titleMap = buildTitleMap(contextEntities);
    const campaignMap = allEntities ? buildTitleMap(allEntities) : null;
    const situations = [];

    for (const [i, sit] of value.situations.entries()) {
        const sitErrors = [];
        if (!sit.title)       sitErrors.push("Falta title.");
        if (!sit.hook)        sitErrors.push("Falta hook.");
        if (!sit.stakes)      sitErrors.push("Falta stakes.");
        if (!sit.confidence)  sitErrors.push("Falta confidence.");

        const resolvedEntities = [];
        for (const inv of sit.involvedEntities ?? []) {
            const entity = titleMap.resolve(inv.title);
            if (!entity) {
                const inCampaign = campaignMap?.resolve(inv.title);
                const hint = inCampaign
                    ? ` (existe en campaña pero no estaba en el subgrafo enviado a la IA)`
                    : "";
                sitErrors.push(`Entidad inventada: "${inv.title}" no existe en el contexto${hint}.`);
                resolvedEntities.push({ ...inv, _resolved: null, _invented: true, _inCampaign: Boolean(inCampaign) });
            } else {
                resolvedEntities.push({ ...inv, _resolved: entity, _invented: false, _inCampaign: true });
            }
        }

        const invented = resolvedEntities.filter((e) => e._invented);
        const confidence = invented.length > 0
            ? "baja"
            : (sit.confidence ?? "media");

        situations.push({
            ...sit,
            involvedEntities: resolvedEntities,
            confidence,
            _errors: sitErrors,
            _index: i,
        });
    }

    const hasInvented = situations.some((s) => s._errors.length > 0);
    return {
        ok: errors.length === 0 && !hasInvented,
        parsed: value,
        errors,
        situations,
    };
}

// ── Narrative impact validator ────────────────────────────────────────────────

/**
 * @param {unknown} raw
 * @param {object[]} contextEntities
 * @returns {{
 *   ok: boolean,
 *   parsed: object|null,
 *   errors: string[],
 *   summary: string,
 *   proposedRelations: ValidatedRelation[],
 *   blockedSuggestions: object[],
 *   dmNotes: string,
 * }}
 *
 * ValidatedRelation:
 *   { action, fromEntityTitle, toEntityTitle, relationType, label, strength, reason, confidence,
 *     valid: boolean, validationError?: string,
 *     fromEntity, toEntity,                        // resolved objects (if valid)
 *     resolvedEndpoints: { fromEntityId, toEntityId } | null }
 */
export function validateNarrativeImpactResponse(raw, contextEntities = []) {
    const errors = [];
    const { ok, value, error } = tryParseJson(raw);
    if (!ok) return {
        ok: false, parsed: null, errors: [error],
        summary: "", proposedRelations: [], blockedSuggestions: [], dmNotes: "",
    };

    if (!value?.proposedRelations && !value?.summary) {
        errors.push('El JSON no tiene campos "summary" ni "proposedRelations".');
        return {
            ok: false, parsed: value, errors,
            summary: "", proposedRelations: [], blockedSuggestions: [], dmNotes: "",
        };
    }

    const titleMap = buildTitleMap(contextEntities);
    const proposedRelations = [];

    for (const [i, rel] of (value.proposedRelations ?? []).entries()) {
        let validationError = null;

        // 1. Check known action
        if (!["add", "remove", "update"].includes(rel.action)) {
            validationError = `Acción desconocida: "${rel.action}".`;
        }

        // 2. Resolve entities
        const fromEntity = titleMap.resolve(rel.fromEntityTitle);
        const toEntity   = titleMap.resolve(rel.toEntityTitle);

        if (!validationError && !fromEntity) {
            validationError = `Entidad origen "${rel.fromEntityTitle}" no existe en el contexto.`;
        }
        if (!validationError && !toEntity) {
            validationError = `Entidad destino "${rel.toEntityTitle}" no existe en el contexto.`;
        }

        // 3. Check relation type (acepta etiquetas ES del LLM → snake_case)
        const relationType = normalizeRelationType(rel.relationType);
        if (!validationError && !relationType) {
            validationError = `Tipo de relación desconocido: "${rel.relationType}".`;
        }

        // 4. Semantic validation (only for add/update)
        let resolvedEndpoints = null;
        if (!validationError && rel.action !== "remove" && fromEntity && toEntity && relationType) {
            const isValid = validateRelationCreate(fromEntity, toEntity, relationType);
            if (!isValid) {
                validationError = `Relación "${relationType}" no válida entre ${fromEntity.entityType} y ${toEntity.entityType}.`;
            } else {
                resolvedEndpoints = resolveRelationEndpoints(fromEntity, toEntity, relationType);
            }
        }

        // For "remove", just resolve endpoints if entities exist
        if (!validationError && rel.action === "remove" && fromEntity && toEntity && relationType) {
            try {
                resolvedEndpoints = resolveRelationEndpoints(fromEntity, toEntity, relationType);
            } catch {
                resolvedEndpoints = { fromEntityId: fromEntity.id, toEntityId: toEntity.id };
            }
        }

        const strength = rel.strength !== undefined
            ? rel.strength
            : defaultStrengthForRelationType(relationType);

        proposedRelations.push({
            ...rel,
            relationType: relationType ?? rel.relationType,
            strength,
            label: rel.label ?? "",
            _index: i,
            valid: !validationError,
            validationError,
            fromEntity:        fromEntity ?? null,
            toEntity:          toEntity ?? null,
            resolvedEndpoints,
        });
    }

    return {
        ok: errors.length === 0,
        parsed: value,
        errors,
        summary:            value.summary ?? "",
        proposedRelations,
        blockedSuggestions: value.blockedSuggestions ?? [],
        dmNotes:            value.dmNotes ?? "",
    };
}

// ── CASCADE validator ─────────────────────────────────────────────────────────

/**
 * ValidatedImpact fields added by this validator:
 *   valid: boolean
 *   validationErrors: string[]
 *   entityResolved: object | null
 *   resolvedChanges: ValidatedChange[]
 *
 * ValidatedChange:
 *   { kind, reason, valid, validationError,
 *     fromEntity, toEntity, resolvedEndpoints, strengthDelta, newLabel, noteText }
 */
export function validateCascadeResponse(raw, contextEntities = [], allEntities = null, options = {}) {
    const {
        requiredImpactTitles = [],
        expectedWaves = {},
        aiRules = null,
        explicitMentionIds = [],
    } = options;
    const rules = resolveNarrativeAiConfig({ aiRules }).rules;
    const explicitIds = new Set(explicitMentionIds);
    const emptyCascade = {
        ok: false, parsed: null, errors: [],
        eventTitle: "", eventSummary: "", impacts: [],
        proposedEvent: null, blockedSuggestions: [], dmNotes: "",
        missingImpacts: [], extraImpacts: [], waveMismatches: [],
    };

    const errors = [];
    const { ok, value, error } = tryParseJson(raw);
    if (!ok) return { ...emptyCascade, errors: [error] };

    if (!value?.impacts) {
        errors.push('El JSON no tiene campo "impacts" (array).');
        return { ...emptyCascade, parsed: value, errors };
    }

    const contextMap = buildTitleMap(contextEntities);
    const campaignMap = allEntities ? buildTitleMap(allEntities) : null;

    const impacts = [];

    for (const [i, imp] of (value.impacts ?? []).entries()) {
        const impErrors = [];
        const entity = contextMap.resolve(imp.entityTitle);

        if (!entity) {
            const inCampaign = campaignMap?.resolve(imp.entityTitle);
            const hint = inCampaign ? " (existe en campaña pero no en el subgrafo)" : "";
            impErrors.push(`Entidad "${imp.entityTitle}" no encontrada en el contexto${hint}.`);
        } else if (
            isCharacterDead(entity)
            && !shouldIncludeInAiImpacts(entity, rules, { explicitIds })
            && (imp.changes?.length > 0 || imp.personalityShift)
        ) {
            impErrors.push(
                `"${imp.entityTitle}" está fallecido/a (fecha de muerte en ficha). `
                + "No se permiten cambios de relación ni de estado salvo mención explícita en el evento."
            );
        }

        // Validate reaction archetype if provided
        if (imp.reactionArchetype
            && !REACTION_ARCHETYPE_LABELS[imp.reactionArchetype]
            && imp.reactionArchetype !== "sin_arquetipo") {
            impErrors.push(`Arquetipo desconocido: "${imp.reactionArchetype}".`);
        }

        // Validate changes
        const resolvedChanges = [];
        for (const [j, ch] of (imp.changes ?? []).entries()) {
            let chErr = null;
            let fromEntity = null;
            let toEntity   = null;
            let resolvedEndpoints = null;

            if (ch.kind === "dm_note") {
                // No entity resolution needed
            } else if (ch.kind === "entity_state_update") {
                // Validate field and newValue for narrative state updates
                const targetEntity = ch.fromEntityTitle ? contextMap.resolve(ch.fromEntityTitle) : null;
                fromEntity = targetEntity;
                if (!targetEntity) {
                    chErr = `Cambio ${j}: entidad "${ch.fromEntityTitle}" no encontrada para state_update.`;
                } else if (!ch.field) {
                    chErr = `Cambio ${j}: entity_state_update requiere "field".`;
                } else if (!ch.newValue) {
                    chErr = `Cambio ${j}: entity_state_update requiere "newValue".`;
                } else if (ch.field === "narrativeState" && !KNOWN_NARRATIVE_STATE_VALUES.has(ch.newValue)) {
                    chErr = `Cambio ${j}: narrativeState desconocido "${ch.newValue}".`;
                } else if (ch.field === "collectiveMood") {
                    // Free text, no enum validation
                } else if (ch.field === "collectiveArchetype" && !KNOWN_COLLECTIVE_ARCHETYPE_VALUES.has(ch.newValue)) {
                    chErr = `Cambio ${j}: collectiveArchetype desconocido "${ch.newValue}".`;
                }
            } else {
                fromEntity = ch.fromEntityTitle ? contextMap.resolve(ch.fromEntityTitle) : null;
                toEntity   = ch.toEntityTitle   ? contextMap.resolve(ch.toEntityTitle)   : null;

                if (!ch.fromEntityTitle || !fromEntity) {
                    chErr = `Cambio ${j}: entidad origen "${ch.fromEntityTitle}" no encontrada.`;
                } else if (!ch.toEntityTitle || !toEntity) {
                    chErr = `Cambio ${j}: entidad destino "${ch.toEntityTitle}" no encontrada.`;
                } else if (ch.relationType) {
                    const relationType = normalizeRelationType(ch.relationType);
                    if (!relationType) {
                        chErr = `Cambio ${j}: tipo de relación desconocido "${ch.relationType}".`;
                    } else if (ch.kind !== "relation_remove") {
                        const isValid = validateRelationCreate(fromEntity, toEntity, relationType);
                        if (!isValid) {
                            chErr = `Cambio ${j}: "${relationType}" no válido entre `
                                + `${fromEntity.entityType} y ${toEntity.entityType}.`;
                        } else {
                            try {
                                resolvedEndpoints = resolveRelationEndpoints(fromEntity, toEntity, relationType);
                            } catch {
                                resolvedEndpoints = { fromEntityId: fromEntity.id, toEntityId: toEntity.id };
                            }
                        }
                    }

                    resolvedChanges.push({
                        ...ch,
                        relationType: relationType ?? ch.relationType,
                        valid: !chErr,
                        validationError: chErr,
                        fromEntity,
                        toEntity,
                        resolvedEndpoints,
                    });
                    continue;
                }
            }

            resolvedChanges.push({
                ...ch,
                valid: !chErr,
                validationError: chErr,
                fromEntity,
                toEntity,
                resolvedEndpoints,
            });
        }

        const hasChErrors   = resolvedChanges.some((c) => !c.valid);
        const allChInvalid  = resolvedChanges.length > 0 && resolvedChanges.every((c) => !c.valid);
        const computedConf  = (!entity || allChInvalid) ? "baja"
            : hasChErrors ? "media"
            : (imp.confidence ?? "media");

        impacts.push({
            ...imp,
            confidence:      computedConf,
            entityResolved:  entity ?? null,
            valid:           impErrors.length === 0,
            validationErrors: impErrors,
            resolvedChanges,
        });
    }

    const reportedTitles = new Set(
        impacts
            .map((imp) => imp.entityTitle?.toLowerCase().trim())
            .filter(Boolean)
    );
    const missingImpacts = requiredImpactTitles.filter(
        (title) => !reportedTitles.has(title.toLowerCase().trim())
    );

    const extraImpacts = impacts
        .filter((imp) => !imp.valid && imp.validationErrors?.some((e) => e.includes("no encontrada")))
        .map((imp) => imp.entityTitle);

    const waveMismatches = [];
    for (const imp of impacts) {
        const title = imp.entityTitle;
        if (!title) continue;
        const expected = expectedWaves[title]
            ?? expectedWaves[title.toLowerCase().trim()];
        if (expected != null && imp.wave != null && imp.wave !== expected) {
            waveMismatches.push({ title, expected, got: imp.wave });
        }
    }

    if (missingImpacts.length > 0) {
        errors.push(
            `Faltan impacts para: ${missingImpacts.join(", ")}.`
        );
    }

    // Validate collectiveImpacts (locacion / organizacion reactions)
    const collectiveImpacts = [];
    for (const [i, ci] of (value.collectiveImpacts ?? []).entries()) {
        const ciErrors = [];
        const entity = contextMap.resolve(ci.entityTitle);
        if (!entity) {
            ciErrors.push(`collectiveImpact ${i}: entidad "${ci.entityTitle}" no encontrada en el contexto.`);
        }
        if (!ci.entityKind || !["locacion", "organizacion"].includes(ci.entityKind)) {
            ciErrors.push(`collectiveImpact ${i}: entityKind inválido "${ci.entityKind}".`);
        }

        const resolvedChanges = [];
        for (const [j, ch] of (ci.changes ?? []).entries()) {
            let chErr = null;
            let fromEntity = null;
            let toEntity   = null;
            let resolvedEndpoints = null;

            if (ch.kind === "dm_note" || ch.kind === "entity_state_update") {
                // same lite validation as above
                if (ch.kind === "entity_state_update" && ch.field === "narrativeState"
                    && ch.newValue && !KNOWN_NARRATIVE_STATE_VALUES.has(ch.newValue)) {
                    chErr = `collectiveImpact ${i} cambio ${j}: narrativeState desconocido "${ch.newValue}".`;
                }
            } else if (ch.relationType) {
                fromEntity = ch.fromEntityTitle ? contextMap.resolve(ch.fromEntityTitle) : null;
                toEntity   = ch.toEntityTitle   ? contextMap.resolve(ch.toEntityTitle)   : null;
                const relationType = normalizeRelationType(ch.relationType);
                if (!relationType) {
                    chErr = `collectiveImpact ${i} cambio ${j}: relationType desconocido "${ch.relationType}".`;
                } else if (fromEntity && toEntity) {
                    try {
                        resolvedEndpoints = resolveRelationEndpoints(fromEntity, toEntity, relationType);
                    } catch {
                        resolvedEndpoints = { fromEntityId: fromEntity.id, toEntityId: toEntity.id };
                    }
                }
                resolvedChanges.push({
                    ...ch,
                    relationType: relationType ?? ch.relationType,
                    valid: !chErr,
                    validationError: chErr,
                    fromEntity,
                    toEntity,
                    resolvedEndpoints,
                });
                continue;
            }
            resolvedChanges.push({ ...ch, valid: !chErr, validationError: chErr, fromEntity, toEntity, resolvedEndpoints });
        }

        collectiveImpacts.push({
            ...ci,
            entityResolved:  entity ?? null,
            valid:           ciErrors.length === 0,
            validationErrors: ciErrors,
            resolvedChanges,
        });
    }

    return {
        ok: errors.length === 0 && impacts.every((im) => im.valid),
        parsed: value,
        errors,
        eventTitle:         value.eventTitle ?? "",
        eventSummary:       value.eventSummary ?? "",
        eventKind:          value.eventKind ?? "otro",
        impacts,
        collectiveImpacts,
        proposedEvent:      value.proposedEvent ?? null,
        blockedSuggestions: value.blockedSuggestions ?? [],
        dmNotes:            value.dmNotes ?? "",
        missingImpacts,
        extraImpacts,
        waveMismatches,
    };
}

// ── Unified entry point ───────────────────────────────────────────────────────

export function validateAiResponse(mode, raw, contextEntities, allEntities = null, options = null) {
    if (mode === AI_MODES.SITUATION) {
        return validateSituationResponse(raw, contextEntities, allEntities);
    }
    if (mode === AI_MODES.CASCADE) {
        return validateCascadeResponse(raw, contextEntities, allEntities, options ?? {});
    }
    return validateNarrativeImpactResponse(raw, contextEntities);
}
