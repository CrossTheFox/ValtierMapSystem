/**
 * Configuración de IA narrativa por campaña (Firestore: aiRules + aiGeneration).
 */
import { WIKI_ENTITY_TYPES } from "../wikiEntityTypes";
import { CHARACTER_KIND, POPULATION_ORDER } from "./entityFieldSchemas";
import { resolvedEntitiesFromText } from "../../utils/resolveWikiMentions";

/** @param {object} entity */
export function getPersonajeMeta(entity) {
    return entity?.customFields?.personaje ?? {};
}

/** Personaje con fecha de muerte registrada (campo deathDate). */
export function isCharacterDead(entity) {
    if (!entity || entity.entityType !== WIKI_ENTITY_TYPES.PERSONAJE) return false;
    const deathDate = getPersonajeMeta(entity).deathDate;
    if (deathDate == null) return false;
    if (typeof deathDate === "string") return deathDate.trim().length > 0;
    return Boolean(deathDate);
}

/**
 * @param {string} text
 * @param {object[]} entities
 * @returns {Set<string>}
 */
export function getExplicitlyMentionedEntityIds(text = "", entities = []) {
    const mentioned = resolvedEntitiesFromText(text, entities);
    return new Set(mentioned.map((e) => e.id).filter(Boolean));
}

/** @typedef {{
 *   temperature: number,
 *   topP: number,
 *   maxOutputTokens: number|null,
 * }} AiGenerationParams */

/** @typedef {{
 *   rules: NarrativeAiRules,
 *   generation: AiGenerationParams,
 * }} NarrativeAiConfig */

export const AI_CONFIG_CATEGORIES = {
    VITAL:     "vital",
    ENTITY:    "entity",
    NARRATIVE: "narrative",
};

export const AI_CONFIG_CATEGORY_LABELS = {
    [AI_CONFIG_CATEGORIES.VITAL]:     "Estado vital y propagación",
    [AI_CONFIG_CATEGORIES.ENTITY]:    "Tipos de entidad",
    [AI_CONFIG_CATEGORIES.NARRATIVE]: "Prioridades narrativas",
};

/**
 * Presets toggleables por el DJ (booleanos en aiRules).
 * @type {Array<{ key: string, category: string, label: string, tooltip: string, default: boolean }>}
 */
export const AI_RULE_PRESETS = [
    {
        key:     "excludeDeadFromPropagation",
        category: AI_CONFIG_CATEGORIES.VITAL,
        label:   "Excluir fallecidos de propagación",
        tooltip: "Personajes con fecha de muerte no expanden ondas en el grafo ni en el contexto IA. "
            + "Pueden aparecer como referencia histórica.",
        default: true,
    },
    {
        key:     "excludeDeadFromImpacts",
        category: AI_CONFIG_CATEGORIES.VITAL,
        label:   "Sin impacts para fallecidos",
        tooltip: "La IA no debe proponer reacciones, cambios de estado ni relaciones que modifiquen "
            + "personajes con deathDate registrada.",
        default: true,
    },
    {
        key:     "allowDeadIfMentionedInEvent",
        category: AI_CONFIG_CATEGORIES.VITAL,
        label:   "Excepción si se nombran en el evento",
        tooltip: "Si el DJ escribe el nombre de un fallecido en la instrucción (revivificación, legado, "
            + "juicio postumo), se incluye según lo indicado.",
        default: true,
    },
    {
        key:     "excludeHistoricalFromReactions",
        category: AI_CONFIG_CATEGORIES.ENTITY,
        label:   "Históricos no reaccionan a eventos actuales",
        tooltip: "Personajes con tipo «Histórico» no reciben impacts en eventos contemporáneos "
            + "salvo mención explícita.",
        default: false,
    },
    {
        key:     "excludeDeitiesFromPropagation",
        category: AI_CONFIG_CATEGORIES.ENTITY,
        label:   "Deidades fuera de propagación casual",
        tooltip: "Personajes marcados como deidad no se incluyen en ondas salvo que sean ancla "
            + "o se mencionen en el evento.",
        default: false,
    },
    {
        key:     "excludeAbandonedLocations",
        category: AI_CONFIG_CATEGORIES.ENTITY,
        label:   "Locaciones deshabitadas sin impacto colectivo",
        tooltip: "Locaciones con población «Deshabitado» no aparecen en collectiveImpacts "
            + "salvo que el evento ocurra allí.",
        default: false,
    },
    {
        key:     "prioritizeVttLinkedCharacters",
        category: AI_CONFIG_CATEGORIES.NARRATIVE,
        label:   "Priorizar PJs jugables (VTT)",
        tooltip: "Personajes enlazados a token del mapa reciben reacciones más detalladas "
            + "y coherentes con la campaña activa.",
        default: true,
    },
    {
        key:     "respectStrongBonds",
        category: AI_CONFIG_CATEGORIES.NARRATIVE,
        label:   "Respetar vínculos fuertes (bondNotes)",
        tooltip: "Si un personaje tiene anclas emocionales (bondNotes) relevantes al evento, "
            + "la reacción debe ser intensa y coherente — nunca indiferente.",
        default: true,
    },
];

/** @type {AiGenerationParams} */
export const DEFAULT_AI_GENERATION = {
    temperature:       0.8,
    topP:              0.95,
    maxOutputTokens:   null,
};

/** Defaults booleanos derivados de presets. */
export function defaultAiRulesFromPresets() {
    /** @type {Record<string, boolean|string>} */
    const rules = {
        excludeDeadFromRelationChanges: true,
        customPromptRules: "",
    };
    for (const p of AI_RULE_PRESETS) {
        rules[p.key] = p.default;
    }
    return rules;
}

/**
 * @param {{ aiRules?: object|null, aiGeneration?: object|null }|null} [fromStore]
 * @returns {NarrativeAiConfig}
 */
export function resolveNarrativeAiConfig(fromStore = null) {
    const defaults = defaultAiRulesFromPresets();
    const rules = {
        ...defaults,
        ...(fromStore?.aiRules ?? {}),
    };
    const generation = {
        ...DEFAULT_AI_GENERATION,
        ...(fromStore?.aiGeneration ?? {}),
    };
    if (generation.maxOutputTokens != null) {
        generation.maxOutputTokens = Number(generation.maxOutputTokens) || null;
    }
    return { rules, generation };
}

/** Compat: devuelve solo reglas. */
export function resolveNarrativeAiRules(fromStore = null) {
    return resolveNarrativeAiConfig(fromStore).rules;
}

/**
 * @param {object} entity
 * @param {object} rules
 * @param {{ explicitIds?: Set<string> }} [ctx]
 */
export function shouldIncludeInAiPropagation(entity, rules, { explicitIds = new Set() } = {}) {
    if (!entity) return false;

    if (isCharacterDead(entity)) {
        if (!rules.excludeDeadFromPropagation) return true;
        if (rules.allowDeadIfMentionedInEvent && explicitIds.has(entity.id)) return true;
        return false;
    }

    if (entity.entityType === WIKI_ENTITY_TYPES.PERSONAJE) {
        const meta = getPersonajeMeta(entity);
        if (rules.excludeDeitiesFromPropagation && meta.isDeity && !explicitIds.has(entity.id)) {
            return false;
        }
    }

    return true;
}

/**
 * @param {object} entity
 * @param {object} rules
 * @param {{ explicitIds?: Set<string> }} [ctx]
 */
export function shouldIncludeInAiImpacts(entity, rules, { explicitIds = new Set() } = {}) {
    if (!entity) return false;
    if (!shouldIncludeInAiPropagation(entity, rules, { explicitIds })) return false;

    if (isCharacterDead(entity)) {
        if (!rules.excludeDeadFromImpacts) return true;
        if (rules.allowDeadIfMentionedInEvent && explicitIds.has(entity.id)) return true;
        return false;
    }

    if (entity.entityType === WIKI_ENTITY_TYPES.PERSONAJE && rules.excludeHistoricalFromReactions) {
        const kind = getPersonajeMeta(entity).characterKind;
        if (kind === CHARACTER_KIND.HISTORICO && !explicitIds.has(entity.id)) return false;
    }

    return true;
}

/**
 * @param {object} entity — locación u organización
 * @param {object} rules
 */
export function shouldIncludeInCollectiveImpacts(entity, rules) {
    if (!entity || !rules.excludeAbandonedLocations) return true;
    if (entity.entityType !== WIKI_ENTITY_TYPES.LOCACION) return true;
    const pop = entity.customFields?.locacion?.populationOrder;
    return pop !== POPULATION_ORDER.VACIO;
}

/**
 * Bloque completo para system prompt: presets activos + custom + contexto dinámico.
 * @param {object} rules
 * @param {{ deadTitles?: string[], explicitDeadTitles?: string[] }} [ctx]
 */
export function buildAiGuardrailsPrompt(rules, { deadTitles = [], explicitDeadTitles = [] } = {}) {
    const lines = ["REGLAS DE CAMPAÑA (configuradas por el DJ):"];

    for (const preset of AI_RULE_PRESETS) {
        if (rules[preset.key]) {
            lines.push(`- ${preset.label}: ${preset.tooltip.split(".")[0]}.`);
        }
    }

    if (rules.excludeDeadFromImpacts || rules.excludeDeadFromRelationChanges) {
        lines.push(
            "- Personajes con fecha de muerte están FALLECIDOS: no generes impacts ni proposedRelations "
            + "que los modifiquen salvo excepción configurada."
        );
    }

    if (rules.prioritizeVttLinkedCharacters) {
        lines.push(
            "- Personajes con token VTT enlazado son PJs activos: prioriza reacciones detalladas y jugables."
        );
    }

    if (rules.respectStrongBonds) {
        lines.push(
            "- Si bondNotes conecta a un personaje con el evento, la reacción emocional es obligatoria e intensa."
        );
    }

    if (deadTitles.length) {
        lines.push(`Fallecidos en contexto (solo referencia): ${deadTitles.join(", ")}.`);
    }
    if (explicitDeadTitles.length) {
        lines.push(`Fallecidos mencionados en el evento: ${explicitDeadTitles.join(", ")}.`);
    }

    const custom = rules.customPromptRules?.trim();
    if (custom) {
        lines.push("", "INSTRUCCIONES PERSONALIZADAS DEL DJ:");
        lines.push(custom);
    }

    return lines.join("\n");
}

/**
 * @param {AiGenerationParams} generation
 * @param {string} mode
 */
export function resolveGenerationParams(generation, mode) {
    const cascadeDefault = 8192;
    const defaultDefault = 4096;
    const modeDefault = mode === "cascade" ? cascadeDefault : defaultDefault;
    return {
        temperature:     generation.temperature ?? DEFAULT_AI_GENERATION.temperature,
        topP:            generation.topP ?? DEFAULT_AI_GENERATION.topP,
        maxOutputTokens: generation.maxOutputTokens ?? modeDefault,
    };
}
