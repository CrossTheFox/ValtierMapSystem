export { getPersonajeMeta, isCharacterDead, getExplicitlyMentionedEntityIds } from "./narrativeAiConfig.js";

// Re-exports de configuración
export {
    resolveNarrativeAiConfig,
    resolveNarrativeAiRules,
    defaultAiRulesFromPresets,
    DEFAULT_AI_GENERATION,
    AI_RULE_PRESETS,
    AI_CONFIG_CATEGORIES,
    AI_CONFIG_CATEGORY_LABELS,
    shouldIncludeInAiPropagation,
    shouldIncludeInAiImpacts,
    shouldIncludeInCollectiveImpacts,
    buildAiGuardrailsPrompt,
    resolveGenerationParams,
} from "./narrativeAiConfig.js";

/** @deprecated Usar defaultAiRulesFromPresets() */
export { defaultAiRulesFromPresets as DEFAULT_NARRATIVE_AI_RULES_FACTORY } from "./narrativeAiConfig.js";
