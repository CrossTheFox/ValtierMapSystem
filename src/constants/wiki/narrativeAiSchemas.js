/**
 * narrativeAiSchemas.js
 *
 * Contratos JSON, prompts y constantes de configuración para el laboratorio de IA narrativa.
 *
 * Modos:
 *   - "situation"        → propone 1-3 situaciones jugables (Ideas de escena)
 *   - "narrative_impact" → propone cambios en relaciones desde una instrucción (Ondas narrativas)
 *   - "cascade"          → propaga un evento por ondas BFS de personajes afectados (Onda catalizadora)
 *                          Basado en PANGeA (Buongiorno et al., 2024): arquetipos de personalidad
 *                          guían reacciones coherentes en múltiples NPCs.
 */

// ── Modos ─────────────────────────────────────────────────────────────────────

export const AI_MODES = {
    SITUATION:        "situation",
    NARRATIVE_IMPACT: "narrative_impact",
    CASCADE:          "cascade",
};

export const AI_MODE_LABELS = {
    [AI_MODES.SITUATION]:        "Ideas de escena",
    [AI_MODES.NARRATIVE_IMPACT]: "Ondas narrativas",
    [AI_MODES.CASCADE]:          "Evento narrativo",
};

export const AI_MODE_TOOLTIPS = {
    [AI_MODES.SITUATION]:
        "Genera 1–3 situaciones jugables (gancho, stakes, preguntas dramáticas) "
        + "basadas en la entidad ancla y su subgrafo. No modifica el wiki: solo inspira al DJ.",
    [AI_MODES.NARRATIVE_IMPACT]:
        "A partir de una instrucción (ej. «muere Zorgun»), propone cambios concretos "
        + "en relaciones del wiki. Cada cambio requiere confirmación del DJ antes de persistir.",
    [AI_MODES.CASCADE]:
        "Propaga un evento por ondas de personajes afectados (Evento narrativo). "
        + "La IA reacciona según el arquetipo, la personalidad y el estado narrativo de cada personaje (PANGeA). "
        + "Propone reacciones emocionales, cambios de estado, relaciones y eventos en la línea de tiempo. "
        + "Usa el slider de profundidad para controlar cuántas ondas se propagan.",
};

// ── Intenciones (modo situación) ─────────────────────────────────────────────

export const SITUATION_INTENTS = [
    { value: "conflicto",  label: "Conflicto",  tooltip: "Tensión activa: facciones enfrentadas, amenazas inminentes o traiciones." },
    { value: "misterio",   label: "Misterio",   tooltip: "Preguntas sin resolver, pistas ocultas o secretos que presionan la escena." },
    { value: "social",     label: "Social / Político", tooltip: "Negociación, diplomacia, reputación o maniobras de poder entre facciones." },
    { value: "combate",    label: "Combate",    tooltip: "Confrontación física o táctica directa; escala y stakes claros." },
    { value: "revelacion", label: "Revelación", tooltip: "Verdad que cambia la lectura de personajes, lugares o eventos pasados." },
];

// ── Proveedores ───────────────────────────────────────────────────────────────

export const AI_PROVIDERS = {
    GEMINI: "gemini",
    /** Misma API que el CLI (GEMINI_API_KEY); útil si Firebase AI Logic no tiene créditos. */
    GEMINI_DIRECT: "gemini_direct",
    OPENROUTER: "openrouter",
};

export const AI_PROVIDER_LABELS = {
    [AI_PROVIDERS.GEMINI]: "Gemini (Firebase)",
    [AI_PROVIDERS.GEMINI_DIRECT]: "Gemini API (local)",
    [AI_PROVIDERS.OPENROUTER]: "OpenRouter",
};

export const AI_PROVIDER_TOOLTIPS = {
    [AI_PROVIDERS.GEMINI]:
        "Firebase AI Logic: usa el proyecto Firebase (créditos prepago de AI Studio). "
        + "Requiere `npx firebase-tools init ailogic` una vez. Sin API key en el navegador.",
    [AI_PROVIDERS.GEMINI_DIRECT]:
        "Llama a generativelanguage.googleapis.com con tu API key. "
        + "Pégala en Lab IA → «Tu API key (Gemini)» o define VITE_GEMINI_API_KEY en .env.",
    [AI_PROVIDERS.OPENROUTER]:
        "Proxy REST a múltiples modelos. Requiere VITE_OPENROUTER_API_KEY. "
        + "Útil para comparar DeepSeek, GPT, etc.",
};

export const CONFIDENCE_TOOLTIPS = {
    alta:  "Todas las entidades citadas existen en el subgrafo enviado a la IA y las relaciones referenciadas son plausibles.",
    media: "La situación es coherente pero algún detalle es inferido o el contexto era incompleto.",
    baja:  "Entidades inventadas o fuera del subgrafo; revisar antes de usar en mesa.",
};

export const TONE_LABELS = {
    tension: "Tensión",
    humor:   "Humor",
    misterio: "Misterio",
    combate: "Combate",
    intriga: "Intriga",
};

export const GEMINI_MODELS = [
    {
        value: "gemini-2.5-flash",
        label: "Gemini 2.5 Flash (recomendado)",
        tooltip: "Equilibrio calidad/velocidad. Recomendado para situaciones y ondas narrativas.",
    },
    {
        value: "gemini-2.5-flash-lite",
        label: "Gemini 2.5 Flash-Lite (más barato)",
        tooltip: "Más rápido y barato; puede perder matices en subgrafos grandes.",
    },
];

export const OPENROUTER_MODELS = [
    {
        value: "google/gemini-2.5-flash",
        label: "Gemini 2.5 Flash (via OR)",
        tooltip: "Mismo modelo vía OpenRouter; útil para comparar salida con Gemini directo.",
    },
    {
        value: "deepseek/deepseek-chat-v3-0324",
        label: "DeepSeek Chat V3",
        tooltip: "Alternativa económica; buena coherencia narrativa en español.",
    },
    {
        value: "openai/gpt-4.1-mini",
        label: "GPT-4.1 Mini",
        tooltip: "Modelo compacto de OpenAI; comparación de estilo y adherencia al schema.",
    },
];

// ── System prompts ────────────────────────────────────────────────────────────

export function buildSituationSystemPrompt() {
    return `Eres un asistente de preparación de sesiones para ICON TTRPG, campaña Valtia-01.

REGLAS ABSOLUTAS:
1. Usa SOLO entidades y relaciones del contexto proporcionado. Si una entidad no aparece en el contexto, NO la uses.
2. Si falta información, indícalo en dmNotes. Nunca inventes NPCs, ciudades ni organizaciones.
3. Las relaciones son hechos: "X → [vive_en] → Y" = residencia; "enemigo_de" = tensión activa.
4. Lore marcado como dm_only va solo en dmNotes, nunca en hook ni stakes.
5. Propón situaciones jugables: gancho claro, stakes concretos, 2-3 preguntas dramáticas.
6. Tono: cyberpunk gótico valtiense (domo, seis metrópolis, sangre Zarken, política imperial).
7. Responde ÚNICAMENTE con JSON válido según el esquema acordado. Nada antes ni después del JSON.
8. La clave raíz del JSON debe ser exactamente "situations" (array). No uses "scenarios" ni otros sinónimos.

AUTO-VERIFICACIÓN (hacer antes de responder):
- ¿Cada entidad en "involvedEntities" existe literalmente en el contexto? Si no, elimínala.
- ¿Cada "why" referencia una relación real del grafo (del contexto)? Si no, ajusta o baja confidence.
- ¿El JSON es válido y completo según el schema?`;
}

export function buildNarrativeImpactSystemPrompt(relationTypeList) {
    return `Eres un asistente narrativo para ICON TTRPG, campaña Valtia-01.
El DJ te dará una instrucción narrativa (ej. "haz que Engel muera", "Galathia y Mirage firman una tregua").
Tu tarea es proponer SOLO cambios en relaciones binarias entre entidades YA EXISTENTES en el contexto.

REGLAS ABSOLUTAS:
1. Solo usa entidades que aparezcan en el contexto. Nunca inventes entidades nuevas.
2. Solo usa estos identificadores exactos en relationType (snake_case, no etiquetas en español): ${relationTypeList}.
3. Si la instrucción requiere crear una entidad nueva (ej. un evento "Muerte de Engel"), ponlo en blockedSuggestions con reason.
4. Cada proposedRelation tiene un campo "reason" que explica qué relación del grafo la justifica.
5. Prefiere relaciones simples y directas. Máximo 5 proposedRelations por respuesta.
6. Si la instrucción es ambigua, interpreta la versión más dramática pero plausible dadas las relaciones existentes.
7. Responde ÚNICAMENTE con JSON válido según el esquema acordado. Nada antes ni después del JSON.

AUTO-VERIFICACIÓN (hacer antes de responder):
- ¿fromEntityTitle y toEntityTitle existen en el contexto?
- ¿El relationType está en la lista de tipos válidos?
- ¿La acción (add/remove/update) tiene sentido dado el estado actual del grafo?`;
}

// ── Schemas JSON ──────────────────────────────────────────────────────────────

/**
 * Schema para Gemini responseSchema (Schema.object style) y para validación client-side.
 * Ambos modos usan el mismo formato de definición; el servicio lo adaptará al SDK concreto.
 */
export const SITUATION_RESPONSE_SCHEMA = {
    type: "object",
    properties: {
        situations: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    title:    { type: "string" },
                    hook:     { type: "string" },
                    stakes:   { type: "string" },
                    tone: {
                        type: "string",
                        enum: ["tension", "humor", "misterio", "combate", "intriga"],
                    },
                    involvedEntities: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                title:      { type: "string" },
                                role:       { type: "string" },
                                why:        { type: "string" },
                            },
                            required: ["title", "role", "why"],
                        },
                    },
                    dramaticQuestions: {
                        type: "array",
                        items: { type: "string" },
                    },
                    dmNotes:    { type: "string" },
                    confidence: { type: "string", enum: ["alta", "media", "baja"] },
                },
                required: ["title", "hook", "stakes", "tone", "involvedEntities",
                           "dramaticQuestions", "dmNotes", "confidence"],
            },
        },
    },
    required: ["situations"],
};

export const NARRATIVE_IMPACT_RESPONSE_SCHEMA = {
    type: "object",
    properties: {
        summary: { type: "string" },
        proposedRelations: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    action:          { type: "string", enum: ["add", "remove", "update"] },
                    fromEntityTitle: { type: "string" },
                    toEntityTitle:   { type: "string" },
                    relationType:    { type: "string" },
                    label:           { type: "string" },
                    strength:        { type: "number" },
                    reason:          { type: "string" },
                    confidence:      { type: "string", enum: ["alta", "media", "baja"] },
                },
                required: ["action", "fromEntityTitle", "toEntityTitle",
                           "relationType", "reason", "confidence"],
            },
        },
        blockedSuggestions: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    description: { type: "string" },
                    reason:      { type: "string" },
                },
                required: ["description", "reason"],
            },
        },
        dmNotes: { type: "string" },
    },
    required: ["summary", "proposedRelations", "blockedSuggestions", "dmNotes"],
};

// ── Helpers de prompt de usuario (user turn) ──────────────────────────────────

export function buildSituationUserPrompt(contextText, intent) {
    const intentLine = intent ? `\nIntención del DJ: ${intent}` : "";
    return `${contextText}${intentLine}

Propón 1-3 situaciones jugables basadas exclusivamente en las entidades y relaciones del contexto.`;
}

export function buildNarrativeImpactUserPrompt(contextText, instruction) {
    return `${contextText}

Instrucción del DJ: "${instruction}"

Propón los cambios de relaciones necesarios para ejecutar esta instrucción usando solo entidades del contexto.`;
}

// ── Modo CASCADE — Onda catalizadora ─────────────────────────────────────────
//
// Basado en PANGeA (Buongiorno et al., 2024): los arquetipos de personalidad
// de los NPCs guían reacciones narrativas coherentes cuando ocurre un evento.
// El contexto incluye ondas BFS pre-calculadas y el arquetipo de cada personaje.
// La IA solo rellena contenido; la topología de ondas viene del grafo real.

/**
 * @param {string} relationTypeList   — string CSV de tipos de relación válidos
 * @returns {string}
 */
export function buildCascadeSystemPrompt(relationTypeList) {
    return `Eres un asistente narrativo para ICON TTRPG, campaña Valtia-01.
El DJ describe un evento que ocurre sobre una entidad ancla (modo Evento narrativo).
El contexto incluye el subgrafo de personajes afectados, organizados en ONDAS (distancia en el grafo).
Cada personaje tiene ARQUETIPO DE REACCIÓN, ESTADO NARRATIVO, PATRÓN DE ESTRÉS y RASGOS NARRATIVOS
que definen cómo reacciona ante eventos externos. Úsalos para generar reacciones coherentes.

REGLAS ABSOLUTAS:
1. Solo usa entidades que aparezcan en el contexto. Nunca inventes entidades.
2. El array "impacts" debe tener exactamente UN objeto por cada personaje listado en "Personajes que DEBEN tener un impacto" (no generes impacts para locaciones u organizaciones — esas van en collectiveImpacts).
3. Para cada impacto, relationType debe ser uno de estos identificadores exactos (snake_case): ${relationTypeList}.
4. "justificationPath" debe ser una cadena de títulos reales del grafo: "A → relación → B → relación → C".
5. Si el arquetipo indica indiferencia real (ej. "Pragmático" sin vínculo fuerte), el impacto puede ser mínimo (changes vacío, emotionalReaction breve).
6. Si el evento requiere crear una entidad nueva (ej. el hijo, el asesino), ponla en blockedSuggestions.
7. Responde ÚNICAMENTE con JSON válido según el esquema. Nada antes ni después del JSON.
8. "eventTitle" debe ser un título corto y concreto para el evento histórico propuesto.
9. Si el evento cambia el estado narrativo del personaje (narrativeState), incluye un objeto "personalityShift" con from/to/reason.
10. Para entity_state_update: usa "field" = "narrativeState" (personaje) o "collectiveMood" (locacion/organizacion), y "newValue" como uno de los enums conocidos.
11. Si hay entidades colectivas en "Entidades colectivas con posible impacto", incluye su reacción en "collectiveImpacts" si el evento las afecta.

MEMORIA DE PERSONALIDAD (uso obligatorio cuando está disponible):
- narrativeState: estado emocional/narrativo actual del personaje.
- stressResponse: patrón de reacción ante trauma/pérdida — ÚSALO para determinar el tipo de reacción.
- narrativeTraits: rasgos estables que no cambian — guíate por ellos para tono y decisiones.
- bondNotes: anclas emocionales — vínculos que DEBEN reflejarse en la reacción si son relevantes.
- Regla de inferencia: si el personaje tiene vínculo descendiente_de/relacionado_con con fuerza ≥ 7 hacia el ancla, y el evento es una pérdida o traición, la reacción emocional es OBLIGATORIA y debe ser intensa.

ARQUETIPO DE REACCIÓN (guía de comportamiento):
- Guardián: protege a aliados, busca amenazas, refuerza lealtad.
- Político: calcula ventaja de facción antes que sentir; puede traicionar si conviene.
- Íntimo: los vínculos emocionales son primarios; exige verdad, confronta o se rompe. Incompatible con indiferencia ante pérdida de un ser querido.
- Rival: ve la ventaja ajena como derrota propia; busca contrarrestar o aprovechar.
- Pragmático: coste-beneficio frío; puede cambiar de bando sin drama.

AUTO-VERIFICACIÓN (antes de responder):
- ¿Cada entidad en "impacts" existe en el contexto?
- ¿Cada "fromEntityTitle" y "toEntityTitle" en changes existe en el contexto?
- ¿El arquetipo + stressResponse del personaje son coherentes con la reacción propuesta?
- ¿La onda asignada coincide con la distancia en el grafo indicada en el contexto?
- ¿Los personnajes con bondNotes relevantes tienen reacción emocional acorde?`;
}

export function buildCascadeUserPrompt(contextText, event, resolvedMentions = []) {
    const mentionLine = resolvedMentions.length > 0
        ? `\nPersonajes mencionados explícitamente: ${resolvedMentions.map((m) => m.entity.title).join(", ")}`
        : "";
    return `${contextText}${mentionLine}

Evento catalizador: "${event}"

Genera "eventTitle" y "eventSummary" resumiendo este evento.
Luego, para CADA personaje de la sección "Personajes que DEBEN tener un impacto", crea un objeto en "impacts" con reacción emocional, gancho narrativo y cambios de relación concretos según su arquetipo y el grafo.`;
}

// ── CASCADE response schema ───────────────────────────────────────────────────

export const CASCADE_RESPONSE_SCHEMA = {
    type: "object",
    properties: {
        eventTitle:   { type: "string" },
        eventSummary: { type: "string" },
        eventKind: {
            type: "string",
            enum: ["batalla", "tratado", "cataclismo", "nacimiento_legado",
                   "descubrimiento", "politico", "otro"],
        },
        impacts: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    wave:              { type: "number" },
                    entityTitle:       { type: "string" },
                    reactionArchetype: { type: "string" },
                    emotionalReaction: { type: "string" },
                    narrativeHook:     { type: "string" },
                    personalityShift: {
                        type: "object",
                        description: "Cambio en el estado narrativo del personaje, si el evento lo justifica.",
                        properties: {
                            from:   { type: "string" },
                            to:     { type: "string" },
                            reason: { type: "string" },
                        },
                        required: ["from", "to", "reason"],
                    },
                    changes: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                kind: {
                                    type: "string",
                                    enum: ["relation_add", "relation_update",
                                           "relation_remove", "entity_state_update", "dm_note"],
                                },
                                fromEntityTitle: { type: "string" },
                                toEntityTitle:   { type: "string" },
                                relationType:    { type: "string" },
                                strengthDelta:   { type: "number" },
                                newLabel:        { type: "string" },
                                // entity_state_update fields:
                                field:    { type: "string" },
                                newValue: { type: "string" },
                                // dm_note fields:
                                noteText: { type: "string" },
                                reason:   { type: "string" },
                            },
                            required: ["kind", "reason"],
                        },
                    },
                    justificationPath: { type: "string" },
                    confidence:        { type: "string", enum: ["alta", "media", "baja"] },
                },
                required: ["wave", "entityTitle", "emotionalReaction",
                           "narrativeHook", "changes", "justificationPath", "confidence"],
            },
        },
        collectiveImpacts: {
            type: "array",
            description: "Reacciones de locaciones u organizaciones colectivas afectadas (ondas 2+).",
            items: {
                type: "object",
                properties: {
                    wave:              { type: "number" },
                    entityTitle:       { type: "string" },
                    entityKind:        { type: "string", enum: ["locacion", "organizacion"] },
                    collectiveReaction: { type: "string" },
                    narrativeHook:     { type: "string" },
                    changes: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                kind: {
                                    type: "string",
                                    enum: ["relation_add", "relation_update",
                                           "relation_remove", "entity_state_update", "dm_note"],
                                },
                                fromEntityTitle: { type: "string" },
                                toEntityTitle:   { type: "string" },
                                relationType:    { type: "string" },
                                strengthDelta:   { type: "number" },
                                field:    { type: "string" },
                                newValue: { type: "string" },
                                noteText: { type: "string" },
                                reason:   { type: "string" },
                            },
                            required: ["kind", "reason"],
                        },
                    },
                    confidence: { type: "string", enum: ["alta", "media", "baja"] },
                },
                required: ["wave", "entityTitle", "entityKind",
                           "collectiveReaction", "narrativeHook", "changes", "confidence"],
            },
        },
        proposedEvent: {
            type: "object",
            properties: {
                shouldCreate:  { type: "boolean" },
                title:         { type: "string" },
                eventKind:     { type: "string" },
                summary:       { type: "string" },
                participants:  { type: "array", items: { type: "string" } },
                certainty:     { type: "string", enum: ["canon", "legendario", "disputado"] },
            },
            required: ["shouldCreate"],
        },
        blockedSuggestions: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    description: { type: "string" },
                    reason:      { type: "string" },
                },
                required: ["description", "reason"],
            },
        },
        dmNotes: { type: "string" },
    },
    required: ["eventTitle", "eventSummary", "impacts",
               "proposedEvent", "blockedSuggestions", "dmNotes"],
};

// ── CASCADE wave configuration ────────────────────────────────────────────────

/**
 * Controls how many entities the BFS wave expansion considers per wave,
 * and the context size sent to the model.
 */
export const CASCADE_CONTEXT_OPTS = {
    maxDepth:      3,
    maxEntities:   60,
    maxRelations:  100,
    maxChars:      22000,
    maxWaves:      3,
    maxImpactsPerWave: 10,
};

/**
 * Returns context opts scaled for a given propagation depth (2–8).
 * Larger depth → more entities, relations and context chars sent to the LLM.
 *
 * @param {number} depth — integer 2–8
 */
export function cascadeOptsForDepth(depth = 4) {
    const d = Math.max(1, Math.min(8, Math.round(depth)));
    return {
        maxDepth:          d,
        maxWaves:          d,
        maxEntities:       20 + d * 10,    // 40–100
        maxRelations:      30 + d * 15,    // 60–150
        maxChars:          12000 + d * 2500, // 17k–32k
        maxImpactsPerWave: 12,
    };
}

/**
 * Relation types that trigger cascade consideration (wave 1 = these types on the anchor).
 * Higher priority = more likely to appear in wave 1.
 */
export const CASCADE_WAVE_RELATION_WEIGHTS = {
    aliado_de:             { wave: 1, decay: 0.9 },
    enemigo_de:            { wave: 1, decay: 1.0 },
    descendiente_de:       { wave: 1, decay: 1.0 },
    miembro_confirmado_de: { wave: 1, decay: 0.7 },
    controla:              { wave: 1, decay: 0.8 },
    relacionado_con:       { wave: 2, decay: 0.5 },
    vive_en:               { wave: 2, decay: 0.4 },
    sede_en:               { wave: 2, decay: 0.4 },
    miembro_sospechado_de: { wave: 2, decay: 0.4 },
    miembro_de:            { wave: 2, decay: 0.4 },
    participo_en:          { wave: 3, decay: 0.3 },
    ocurrio_en:            { wave: 3, decay: 0.2 },
};
