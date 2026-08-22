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
    defaultStrengthForRelation,
    isStructuralRelation,
    resolveRelationStrength,
} from "../constants/wikiRelationTypes.js";
import { isForbiddenLanguageRelation } from "./resolveRelationStrengthChange.js";
import { AI_MODES } from "../constants/wiki/narrativeAiSchemas.js";
import {
    REACTION_ARCHETYPE,
    REACTION_ARCHETYPE_LABELS,
    NARRATIVE_STATE,
    NARRATIVE_STATE_LABELS,
    COLLECTIVE_ARCHETYPE,
} from "../constants/wiki/entityFieldSchemas.js";
import {
    isCharacterDead,
    resolveNarrativeAiConfig,
    shouldIncludeInAiImpacts,
    getPersonajeMeta,
} from "../constants/wiki/narrativeAiConfig.js";
import { resolveEntityByTitle, buildEntityTitleIndex, foldTitleText } from "./resolveEntityByTitle.js";

const KNOWN_NARRATIVE_STATE_VALUES = new Set(Object.values(NARRATIVE_STATE));
const KNOWN_COLLECTIVE_ARCHETYPE_VALUES = new Set(Object.values(COLLECTIVE_ARCHETYPE));
const KNOWN_REACTION_ARCHETYPE_VALUES = new Set(Object.values(REACTION_ARCHETYPE));

function foldEnumText(value) {
    return foldTitleText(value);
}

/**
 * Map LLM output (snake_case or Spanish label, with/without accents) to canonical archetype key.
 * @param {unknown} raw
 * @returns {string|null}
 */
function normalizeReactionArchetypeValue(raw) {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (!s) return null;
    if (s === "sin_arquetipo") return s;
    if (KNOWN_REACTION_ARCHETYPE_VALUES.has(s)) return s;

    const folded = foldEnumText(s);
    if (KNOWN_REACTION_ARCHETYPE_VALUES.has(folded)) return folded;

    for (const [key, label] of Object.entries(REACTION_ARCHETYPE_LABELS)) {
        if (foldEnumText(label) === folded) return key;
    }

    // Common LLM variants / English / truncated Spanish ("Guardia" vs "Guardián")
    const ALIASES = {
        guardian: REACTION_ARCHETYPE.GUARDIAN,
        guardiana: REACTION_ARCHETYPE.GUARDIAN,
        guardia: REACTION_ARCHETYPE.GUARDIAN,
        protector: REACTION_ARCHETYPE.GUARDIAN,
        protectora: REACTION_ARCHETYPE.GUARDIAN,
        politico: REACTION_ARCHETYPE.POLITICO,
        political: REACTION_ARCHETYPE.POLITICO,
        intimo: REACTION_ARCHETYPE.INTIMO,
        intimate: REACTION_ARCHETYPE.INTIMO,
        rival: REACTION_ARCHETYPE.RIVAL,
        pragmatico: REACTION_ARCHETYPE.PRAGMATICO,
        pragmatic: REACTION_ARCHETYPE.PRAGMATICO,
    };
    if (ALIASES[folded]) return ALIASES[folded];

    // Prefix stems: "guard…" → guardian, "polit…" → politico, etc.
    const STEMS = [
        [/^guardi/, REACTION_ARCHETYPE.GUARDIAN],
        [/^polit/, REACTION_ARCHETYPE.POLITICO],
        [/^intim/, REACTION_ARCHETYPE.INTIMO],
        [/^rival/, REACTION_ARCHETYPE.RIVAL],
        [/^pragmat/, REACTION_ARCHETYPE.PRAGMATICO],
    ];
    for (const [re, key] of STEMS) {
        if (re.test(folded)) return key;
    }

    return null;
}

/**
 * Map free-text / label narrativeState from the LLM onto the enum key.
 * Returns null if nothing matches.
 */
function normalizeNarrativeStateValue(raw) {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (!s) return null;
    const folded = foldTitleText(s);
    if (KNOWN_NARRATIVE_STATE_VALUES.has(folded)) return folded;
    // Also accept raw lower before accent fold for snake_case enums
    const lower = s.toLowerCase();
    if (KNOWN_NARRATIVE_STATE_VALUES.has(lower)) return lower;

    for (const [key, label] of Object.entries(NARRATIVE_STATE_LABELS)) {
        if (foldTitleText(label) === folded) return key;
        // Label may be "Deprimida / en duelo" — match first segment
        const firstSeg = foldTitleText(String(label).split("/")[0]);
        if (firstSeg && firstSeg === folded) return key;
    }
    // Gemini often returns prose instead of the enum ("Quebrantado por el dolor…").
    const KEYWORD_MAP = [
        [/zarken|corrupt/, NARRATIVE_STATE.CORRUPTA_ZARKEN],
        [/quebrant|quebrada|disociad|colapso/, NARRATIVE_STATE.QUEBRADA],
        [/furios|iracun|\bira\b/, NARRATIVE_STATE.FURIOSA],
        [/duelo|deprim|apat[ií]a|triste/, NARRATIVE_STATE.DEPRIMIDA],
        [/obses/, NARRATIVE_STATE.OBSESIVA],
        [/paranoi/, NARRATIVE_STATE.PARANOICA],
        [/indiferent|blindad/, NARRATIVE_STATE.INDIFERENTE],
        [/estable|equilibrad/, NARRATIVE_STATE.ESTABLE],
    ];
    for (const [re, key] of KEYWORD_MAP) {
        if (re.test(folded)) return key;
    }
    return null;
}

function nonempty(v) {
    return typeof v === "string" ? v.trim() : v != null && v !== "" ? String(v).trim() : "";
}

/**
 * Infer relationType from existing edges between two entities (strongest |strength|).
 */
function inferRelationTypeBetween(fromEntity, toEntity, relations = []) {
    if (!fromEntity?.id || !toEntity?.id || !relations.length) return null;
    const matches = relations.filter(
        (r) =>
            (r.fromEntityId === fromEntity.id && r.toEntityId === toEntity.id)
            || (r.fromEntityId === toEntity.id && r.toEntityId === fromEntity.id)
    );
    if (!matches.length) return null;
    if (matches.length === 1) return normalizeRelationType(matches[0].relationType) ?? matches[0].relationType;
    matches.sort((a, b) => Math.abs(Number(b.strength ?? 0)) - Math.abs(Number(a.strength ?? 0)));
    return normalizeRelationType(matches[0].relationType) ?? matches[0].relationType;
}

/**
 * Repair common LLM omissions on a change object (mutates a shallow copy).
 * Returns { change, repairs: string[] }.
 */
function repairCascadeChange(rawCh, {
    impactEntityTitle = "",
    personalityShift = null,
    entityKind = null,
    contextMap,
    relations = [],
} = {}) {
    const ch = { ...rawCh };
    const repairs = [];
    const kind = ch.kind;

    if (kind === "entity_state_update") {
        if (!nonempty(ch.fromEntityTitle) && impactEntityTitle) {
            ch.fromEntityTitle = impactEntityTitle;
            repairs.push("fromEntityTitle←impacto");
        }
        if (!nonempty(ch.field)) {
            const fromPs = personalityShift?.to
                ? normalizeNarrativeStateValue(personalityShift.to)
                : null;
            const fromVal = normalizeNarrativeStateValue(ch.newValue);
            if (fromVal || fromPs) {
                ch.field = "narrativeState";
                repairs.push("field←narrativeState");
                if (!nonempty(ch.newValue) && fromPs) {
                    ch.newValue = fromPs;
                    repairs.push("newValue←personalityShift");
                }
            } else if (entityKind === "locacion" || entityKind === "organizacion") {
                if (nonempty(ch.newValue)) {
                    ch.field = "collectiveMood";
                    repairs.push("field←collectiveMood");
                }
            }
        }
        if (ch.field === "narrativeState" && nonempty(ch.newValue)) {
            const n = normalizeNarrativeStateValue(ch.newValue);
            if (n && n !== ch.newValue) {
                ch.newValue = n;
                repairs.push("newValue←enum");
            }
        }
    } else if (kind === "relation_add" || kind === "relation_update" || kind === "relation_remove") {
        if (!nonempty(ch.fromEntityTitle) && impactEntityTitle) {
            ch.fromEntityTitle = impactEntityTitle;
            repairs.push("fromEntityTitle←impacto");
        }
        if (!nonempty(ch.relationType)) {
            const fromE = nonempty(ch.fromEntityTitle) ? contextMap?.resolve(ch.fromEntityTitle) : null;
            const toE = nonempty(ch.toEntityTitle) ? contextMap?.resolve(ch.toEntityTitle) : null;
            const inferred = inferRelationTypeBetween(fromE, toE, relations);
            if (inferred) {
                ch.relationType = inferred;
                repairs.push(`relationType←grafo(${inferred})`);
            }
        } else {
            const n = normalizeRelationType(ch.relationType);
            if (n && n !== ch.relationType) {
                ch.relationType = n;
                repairs.push("relationType←canon");
            }
        }
    }

    return { change: ch, repairs };
}

/**
 * Validate + resolve one cascade change (personaje or colectivo).
 */
function validateCascadeChange(rawCh, j, {
    impactEntityTitle,
    personalityShift = null,
    entityKind = null,
    contextMap,
    relations = [],
    errorPrefix = `Cambio ${j}`,
    aiRules = null,
    explicitIds = new Set(),
}) {
    const rules = resolveNarrativeAiConfig({ aiRules }).rules;
    const { change: ch, repairs } = repairCascadeChange(rawCh, {
        impactEntityTitle,
        personalityShift,
        entityKind,
        contextMap,
        relations,
    });

    let chErr = null;
    let fromEntity = null;
    let toEntity = null;
    let resolvedEndpoints = null;
    let relationType = nonempty(ch.relationType) ? normalizeRelationType(ch.relationType) : null;

    if (ch.kind === "dm_note") {
        // advisory only
    } else if (ch.kind === "entity_state_update") {
        const titleHint = nonempty(ch.fromEntityTitle) || impactEntityTitle;
        const targetEntity = titleHint ? contextMap.resolve(titleHint) : null;
        fromEntity = targetEntity;
        ch.fromEntityTitle = titleHint || ch.fromEntityTitle;
        if (!targetEntity) {
            chErr = `${errorPrefix}: entidad "${titleHint}" no encontrada para state_update.`;
        } else if (
            isCharacterDead(targetEntity)
            && !shouldIncludeInAiImpacts(targetEntity, rules, { explicitIds })
        ) {
            chErr = `${errorPrefix}: "${titleHint}" está fallecido/a — no se permiten cambios de estado.`;
        } else if (!nonempty(ch.field)) {
            chErr = `${errorPrefix}: entity_state_update requiere "field".`;
        } else if (!nonempty(ch.newValue)) {
            chErr = `${errorPrefix}: entity_state_update requiere "newValue".`;
        } else if (ch.field === "narrativeState") {
            const normalized = normalizeNarrativeStateValue(ch.newValue);
            if (!normalized) {
                chErr = `${errorPrefix}: narrativeState desconocido "${ch.newValue}".`;
            } else {
                ch.newValue = normalized;
            }
        } else if (ch.field === "collectiveMood") {
            // free text ok
        } else if (ch.field === "collectiveArchetype" && !KNOWN_COLLECTIVE_ARCHETYPE_VALUES.has(ch.newValue)) {
            chErr = `${errorPrefix}: collectiveArchetype desconocido "${ch.newValue}".`;
        }
    } else if (
        ch.kind === "relation_add"
        || ch.kind === "relation_update"
        || ch.kind === "relation_remove"
    ) {
        fromEntity = nonempty(ch.fromEntityTitle) ? contextMap.resolve(ch.fromEntityTitle) : null;
        toEntity = nonempty(ch.toEntityTitle) ? contextMap.resolve(ch.toEntityTitle) : null;

        if (!nonempty(ch.fromEntityTitle) || !fromEntity) {
            chErr = `${errorPrefix}: entidad origen "${ch.fromEntityTitle}" no encontrada.`;
        } else if (!nonempty(ch.toEntityTitle) || !toEntity) {
            chErr = `${errorPrefix}: entidad destino "${ch.toEntityTitle}" no encontrada.`;
        } else if (!nonempty(ch.relationType)) {
            chErr = `${errorPrefix}: tipo de relación requerido para ${ch.kind}.`;
        } else {
            relationType = normalizeRelationType(ch.relationType);
            if (!relationType) {
                chErr = `${errorPrefix}: tipo de relación desconocido "${ch.relationType}".`;
            } else if (isForbiddenLanguageRelation(relationType)) {
                chErr = `${errorPrefix}: no proponer relaciones de idioma (habla).`;
            } else if (isStructuralRelation({
                relationType,
                fromEntityType: fromEntity.entityType,
                toEntityType: toEntity.entityType,
            })) {
                chErr = `${errorPrefix}: "${relationType}" es hecho estructural — `
                    + "los impactos IA solo modifican vínculos de afinidad (Sync).";
            } else if (
                (isCharacterDead(fromEntity) && !shouldIncludeInAiImpacts(fromEntity, rules, { explicitIds }))
                || (isCharacterDead(toEntity) && !shouldIncludeInAiImpacts(toEntity, rules, { explicitIds }))
            ) {
                const deadTitle = isCharacterDead(fromEntity) && !shouldIncludeInAiImpacts(fromEntity, rules, { explicitIds })
                    ? fromEntity.title
                    : toEntity.title;
                chErr = `${errorPrefix}: "${deadTitle}" está fallecido/a — `
                    + "no se permiten cambios de relación salvo mención explícita en el evento.";
            } else if (ch.kind !== "relation_remove") {
                const isValid = validateRelationCreate(fromEntity, toEntity, relationType);
                if (!isValid) {
                    chErr = `${errorPrefix}: "${relationType}" no válido entre `
                        + `${fromEntity.entityType} y ${toEntity.entityType}.`;
                } else {
                    try {
                        resolvedEndpoints = resolveRelationEndpoints(fromEntity, toEntity, relationType);
                    } catch {
                        resolvedEndpoints = { fromEntityId: fromEntity.id, toEntityId: toEntity.id };
                    }
                }
            } else {
                try {
                    resolvedEndpoints = resolveRelationEndpoints(fromEntity, toEntity, relationType);
                } catch {
                    resolvedEndpoints = { fromEntityId: fromEntity.id, toEntityId: toEntity.id };
                }
            }
        }
    } else {
        chErr = `${errorPrefix}: kind desconocido "${ch.kind}".`;
    }

    return {
        ...ch,
        relationType: relationType ?? (nonempty(ch.relationType) ? ch.relationType : undefined),
        valid: !chErr,
        validationError: chErr,
        fromEntity,
        toEntity,
        resolvedEndpoints,
        repaired: repairs.length > 0,
        repairNotes: repairs,
    };
}

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
                    + "Reintenta con 3–4 ondas; el pack ahora prioriza vínculos. Si sigue, en Config IA sube el techo de salida.",
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
 * Title → entity map for AI validation.
 * Uses shared resolveEntityByTitle (unique matches; prefers personaje over crónica).
 * @param {object[]} entities
 */
function buildTitleMap(entities) {
    const index = buildEntityTitleIndex(entities);
    return {
        resolve(title) {
            const { entity } = resolveEntityByTitle(title, entities, { index });
            return entity;
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
export function validateNarrativeImpactResponse(raw, contextEntities = [], options = {}) {
    const {
        aiRules = null,
        explicitMentionIds = [],
    } = options;
    const rules = resolveNarrativeAiConfig({ aiRules }).rules;
    const explicitIds = new Set(explicitMentionIds);
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
        if (!validationError && isForbiddenLanguageRelation(relationType)) {
            validationError = "No proponer relaciones de idioma (habla).";
        }
        if (
            !validationError
            && fromEntity
            && toEntity
            && relationType
            && isStructuralRelation({
                relationType,
                fromEntityType: fromEntity.entityType,
                toEntityType: toEntity.entityType,
            })
        ) {
            validationError = `"${relationType}" es hecho estructural — solo se proponen vínculos de afinidad.`;
        }
        if (
            !validationError
            && fromEntity
            && isCharacterDead(fromEntity)
            && !shouldIncludeInAiImpacts(fromEntity, rules, { explicitIds })
        ) {
            validationError = `"${fromEntity.title}" está fallecido/a — no modificar relaciones.`;
        }
        if (
            !validationError
            && toEntity
            && isCharacterDead(toEntity)
            && !shouldIncludeInAiImpacts(toEntity, rules, { explicitIds })
        ) {
            validationError = `"${toEntity.title}" está fallecido/a — no modificar relaciones.`;
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

        const strength = resolveRelationStrength({
            relationType,
            fromEntityType: fromEntity?.entityType,
            toEntityType: toEntity?.entityType,
            strength: rel.strength !== undefined
                ? rel.strength
                : defaultStrengthForRelation(
                    relationType,
                    fromEntity?.entityType,
                    toEntity?.entityType
                ),
        });

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
        relations = [],
    } = options;
    const rules = resolveNarrativeAiConfig({ aiRules }).rules;
    const explicitIds = new Set(explicitMentionIds);
    const emptyCascade = {
        ok: false, parsed: null, errors: [],
        eventTitle: "", eventSummary: "", impacts: [],
        proposedEvent: null, blockedSuggestions: [], dmNotes: "",
        missingImpacts: [], extraImpacts: [], waveMismatches: [],
        invalidChangeTitles: [],
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

        let reactionArchetype = null;
        let archetypeRepaired = false;
        const storedArch = entity
            ? normalizeReactionArchetypeValue(getPersonajeMeta(entity).reactionArchetype)
            : null;
        const llmArch = normalizeReactionArchetypeValue(imp.reactionArchetype);
        if (storedArch) {
            // Ficha is source of truth for PANGeA badge; LLM may echo labels/variants.
            reactionArchetype = storedArch;
        } else if (llmArch) {
            reactionArchetype = llmArch;
        } else if (imp.reactionArchetype && imp.reactionArchetype !== "sin_arquetipo") {
            archetypeRepaired = true;
        }

        let personalityShiftRepaired = false;
        const personalityShift = (() => {
            const ps = imp.personalityShift;
            if (!ps?.to) return null;
            const to = normalizeNarrativeStateValue(ps.to);
            if (!to) {
                personalityShiftRepaired = true;
                return null;
            }
            const fromNorm = normalizeNarrativeStateValue(ps.from);
            const fromStored = entity
                ? normalizeNarrativeStateValue(getPersonajeMeta(entity).narrativeState)
                : null;
            return {
                ...ps,
                from: fromNorm || fromStored || (ps.from ? String(ps.from) : null),
                to,
                reason: typeof ps.reason === "string" ? ps.reason : "",
            };
        })();

        const resolvedChanges = (imp.changes ?? []).map((ch, j) =>
            validateCascadeChange(ch, j, {
                impactEntityTitle: imp.entityTitle,
                personalityShift,
                entityKind: null,
                contextMap,
                relations,
                errorPrefix: `Cambio ${j}`,
                aiRules: rules,
                explicitIds,
            })
        );

        const hasChErrors   = resolvedChanges.some((c) => !c.valid);
        const allChInvalid  = resolvedChanges.length > 0 && resolvedChanges.every((c) => !c.valid);
        let computedConf  = (!entity || allChInvalid) ? "baja"
            : hasChErrors ? "media"
            : (imp.confidence ?? "media");
        // Soft repairs (bad archetype / unparseable shift) never hard-fail — nudge confidence.
        if ((archetypeRepaired || personalityShiftRepaired) && computedConf === "alta") {
            computedConf = "media";
        }

        impacts.push({
            ...imp,
            reactionArchetype,
            archetypeRepaired: archetypeRepaired || undefined,
            personalityShiftRepaired: personalityShiftRepaired || undefined,
            confidence:      computedConf,
            entityId:        entity?.id ?? imp.entityId ?? null,
            entityResolved:  entity ?? null,
            valid:           impErrors.length === 0,
            validationErrors: impErrors,
            resolvedChanges,
            personalityShift,
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
            `Faltan reacciones para: ${missingImpacts.join(", ")}.`
        );
    }

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

        const resolvedChanges = (ci.changes ?? []).map((ch, j) =>
            validateCascadeChange(ch, j, {
                impactEntityTitle: ci.entityTitle,
                personalityShift: null,
                entityKind: ci.entityKind,
                contextMap,
                relations,
                errorPrefix: `collectiveImpact ${i} cambio ${j}`,
                aiRules: rules,
                explicitIds,
            })
        );

        collectiveImpacts.push({
            ...ci,
            entityId:        entity?.id ?? ci.entityId ?? null,
            entityResolved:  entity ?? null,
            valid:           ciErrors.length === 0,
            validationErrors: ciErrors,
            resolvedChanges,
        });
    }

    const invalidChangeTitles = [
        ...impacts
            .filter((imp) => (imp.resolvedChanges ?? []).some((c) => !c.valid))
            .map((imp) => imp.entityTitle)
            .filter(Boolean),
        ...collectiveImpacts
            .filter((ci) => (ci.resolvedChanges ?? []).some((c) => !c.valid))
            .map((ci) => ci.entityTitle)
            .filter(Boolean),
    ];

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
        invalidChangeTitles,
    };
}


// ── Reflexion retry helper ────────────────────────────────────────────────────

/**
 * Build a correction user-prompt for the Reflexion-lite retry (Shinn et al., 2023).
 *
 * @param {string[]} missingTitles — entityTitles missing and/or with invalid changes
 * @param {string}   originalContextText
 * @param {string}   eventText
 * @param {{ invalidChangeHints?: Array<{ entityTitle: string, errors: string[] }> }} [opts]
 * @returns {string}
 */
export function buildReflexionPrompt(missingTitles, originalContextText, eventText, opts = {}) {
    const titles = [...new Set([...(missingTitles ?? []), ...(opts.invalidChangeHints ?? []).map((h) => h.entityTitle)].filter(Boolean))];
    if (!titles.length) return originalContextText;
    const list = titles.join(", ");
    const hintLines = (opts.invalidChangeHints ?? [])
        .map((h) => `- ${h.entityTitle}: ${(h.errors ?? []).join("; ")}`)
        .filter(Boolean);
    const hintBlock = hintLines.length
        ? `\nErrores concretos a corregir en changes:\n${hintLines.join("\n")}\n`
        : "";
    return `${originalContextText}

Evento catalizador: "${eventText}"

CORRECCIÓN REQUERIDA: Regenera SOLO los impactos para: ${list}.
${hintBlock}
Reglas de corrección (obligatorias):
- Cada relation_* DEBE incluir relationType (snake_case), fromEntityTitle y toEntityTitle.
- Cada entity_state_update DEBE incluir field ("narrativeState" o "collectiveMood") y newValue (enum, no prosa).
- Usa el mismo formato JSON con "impacts" (y collectiveImpacts si aplica).
- NO omitas campos: si no aplican, usa string vacío "".
- NO repitas personajes fuera de esta lista.`;
}

// ── Unified entry point ───────────────────────────────────────────────────────

export function validateAiResponse(mode, raw, contextEntities, allEntities = null, options = null) {
    if (mode === AI_MODES.SITUATION) {
        return validateSituationResponse(raw, contextEntities, allEntities);
    }
    if (mode === AI_MODES.CASCADE) {
        return validateCascadeResponse(raw, contextEntities, allEntities, options ?? {});
    }
    return validateNarrativeImpactResponse(raw, contextEntities, options ?? {});
}
