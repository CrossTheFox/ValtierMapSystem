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
    /** Pasa 1 del Two-pass cascade (AutoWorldBuilder §4.1, SENNA Examiner pattern).
     *  Evalúa quién se ve afectado y qué tipo de cambio predice, antes de que la Pasa 2
     *  genere los impacts completos. Usa gemini-2.5-flash-lite (tarea de clasificación). */
    CASCADE_SCOUT:    "cascade_scout",
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
8. AFINIDAD vs HECHO: solo propone vínculos de AFINIDAD (aliado/enemigo/miembro/vive_en/profesa/etc.). NUNCA propongas hechos estructurales (habla, participo_en, documenta, colinda_con, custodia, ni edges hacia idioma/evento/reliquia/especie/crónica).
9. NUNCA propongas relationType "habla" ni cambios sobre idiomas.
10. NUNCA modifiques personajes fallecidos salvo mención explícita en la instrucción.

AUTO-VERIFICACIÓN (hacer antes de responder):
- ¿fromEntityTitle y toEntityTitle existen en el contexto?
- ¿El relationType está en la lista de tipos válidos y es de afinidad (no estructural)?
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

PRESUPUESTO DE SALIDA (aplica SIEMPRE):
- emotionalReaction: ≤ 15 palabras. Solo la emoción dominante, sin elaboración.
- narrativeHook: ≤ 15 palabras. Solo el gancho jugable, sin contexto extra.
- changes[].reason: ≤ 8 palabras. Solo la causa directa.
- justificationPath: solo títulos separados por " → " (ej. "Oni → descendiente_de → Zorgun"). Sin frases.
- personalityShift.reason: ≤ 10 palabras.
- eventSummary: ≤ 25 palabras.
- dmNotes: ≤ 20 palabras (o string vacío si no hay nada crítico).
- ONDAS ≥ 2: emotionalReaction y narrativeHook pueden ser ≤ 8 palabras cada uno.
- NUNCA repitas información que ya está en otro campo del mismo objeto.

REGLAS ABSOLUTAS:
1. Solo usa entidades que aparezcan en el contexto. Nunca inventes entidades.
2. El array "impacts" debe tener exactamente UN objeto por cada personaje listado en "Personajes que DEBEN tener un impacto" (no generes impacts para locaciones u organizaciones — esas van en collectiveImpacts). Prioridad: fidelidad a VÍNCULOS (tipo/fuerza/label) con el ancla; los datos concretos (relationType, strengthDelta) son más importantes que la prosa.
3. Máximo 2 objetos en "changes" por impacto (prioriza relation_update/add/remove sobre dm_note; añade entity_state_update solo si el estado cambia claramente).
4. Para cada change de tipo relation_*: NUNCA dejes relationType vacío — usa uno de: ${relationTypeList}. Incluye fromEntityTitle y toEntityTitle exactos del contexto.
5. Para entity_state_update: NUNCA dejes field vacío — usa "narrativeState" (personaje) o "collectiveMood" (locación/org). newValue DEBE ser un enum de la regla 11 (nunca prosa). fromEntityTitle = título del impacto.
6. strengthDelta: SOLO en vínculos de AFINIDAD (aliado/enemigo/miembro/vive_en/profesa/venera/controla/etc. entre personaje/org/locación/ideología). En relation_update es el CAMBIO numérico sobre el peso actual (ej. -3); en relation_add es el peso ABSOLUTO (−10..+10).
6b. NUNCA propongas hechos estructurales en changes (participo_en, documenta, colinda_con, custodia, habla, pertenencia, origen, desencadenó, ni edges hacia idioma/evento/reliquia/especie/crónica/glosario). Esos hechos son contexto, no impacto.
6c. NUNCA propongas relationType "habla" ni cambios sobre idiomas.
6d. NUNCA modifiques personajes fallecidos (fecha de muerte en ficha) salvo que el evento los nombre explícitamente.
7. Si el arquetipo indica indiferencia real (ej. "Pragmático" sin vínculo fuerte), el impacto puede ser mínimo (changes vacío).
8. Si el evento requiere crear una entidad nueva (ej. el hijo, el asesino), ponla en blockedSuggestions.
9. Responde ÚNICAMENTE con JSON válido según el esquema. Nada antes ni después del JSON.
10. "eventTitle" debe ser un título corto y concreto para el evento histórico propuesto.
11. Si el evento cambia el estado narrativo del personaje (narrativeState), incluye un objeto "personalityShift" con from/to/reason. "from" y "to" DEBEN ser enums exactos: estable, deprimida, furiosa, quebrada, obsesiva, corrupta_zarken, paranoica, indiferente, otro. Si NO hay cambio de estado, omite personalityShift por completo (no uses strings vacíos).
12. reactionArchetype DEBE ser uno de estos enums exactos (snake_case): guardian, politico, intimo, rival, pragmatico, sin_arquetipo. Nunca uses labels ("Guardián", "Guardia") ni string vacío. Si el contexto ya lista el arquetipo del personaje, cópialo tal cual; si es desconocido usa sin_arquetipo.
13. Si hay entidades colectivas en "Entidades colectivas con posible impacto", incluye su reacción en "collectiveImpacts" si el evento las afecta.
14. Campos del schema que no apliquen al kind: usa string vacío (""), nunca los omitas.
15. Relación existente: usa from/to en la MISMA dirección que el vínculo del grafo (ej. si Oni→Zorgun es descendiente_de, actualiza ESA arista; NUNCA inventes la inversa Zorgun→Oni descendiente_de). newLabel solo para tipo "otro"; en tipos conocidos deja newLabel="".

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
- ¿Cada relation_* tiene relationType no vacío + from/to del contexto?
- ¿Cada entity_state_update tiene field="narrativeState"|"collectiveMood" y newValue enum?
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
                    reactionArchetype: {
                        type: "string",
                        enum: ["guardian", "politico", "intimo", "rival", "pragmatico", "sin_arquetipo"],
                        description: "Enum PANGeA del personaje (copiar del contexto). sin_arquetipo si desconocido. Gemini no admite \"\" en enums.",
                    },
                    emotionalReaction: { type: "string" },
                    narrativeHook:     { type: "string" },
                    personalityShift: {
                        type: "object",
                        description: "Solo si el evento cambia narrativeState. Si no hay cambio, OMITIR este objeto (no uses strings vacíos).",
                        properties: {
                            from:   {
                                type: "string",
                                enum: ["estable", "deprimida", "furiosa", "quebrada", "obsesiva",
                                    "corrupta_zarken", "paranoica", "indiferente", "otro"],
                            },
                            to:     {
                                type: "string",
                                enum: ["estable", "deprimida", "furiosa", "quebrada", "obsesiva",
                                    "corrupta_zarken", "paranoica", "indiferente", "otro"],
                            },
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
                                fromEntityTitle: {
                                    type: "string",
                                    description: "Título exacto del origen. Obligatorio en relation_* y entity_state_update; \"\" si dm_note.",
                                },
                                toEntityTitle: {
                                    type: "string",
                                    description: "Título exacto del destino. Obligatorio en relation_*; \"\" si no aplica.",
                                },
                                relationType: {
                                    type: "string",
                                    description: "snake_case del tipo de vínculo. Obligatorio en relation_*; \"\" si no aplica.",
                                },
                                strengthDelta:   { type: "number" },
                                newLabel:        { type: "string" },
                                field: {
                                    type: "string",
                                    description: "entity_state_update: \"narrativeState\" o \"collectiveMood\". \"\" si no aplica.",
                                },
                                newValue: {
                                    type: "string",
                                    description: "Nuevo valor del field (enum narrativeState). \"\" si no aplica.",
                                },
                                noteText: { type: "string" },
                                reason:   { type: "string" },
                            },
                            required: [
                                "kind", "reason",
                                "fromEntityTitle", "toEntityTitle",
                                "relationType", "field", "newValue",
                            ],
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
                                fromEntityTitle: {
                                    type: "string",
                                    description: "Título exacto del origen. Obligatorio en relation_* y entity_state_update; \"\" si dm_note.",
                                },
                                toEntityTitle: {
                                    type: "string",
                                    description: "Título exacto del destino. Obligatorio en relation_*; \"\" si no aplica.",
                                },
                                relationType: {
                                    type: "string",
                                    description: "snake_case del tipo de vínculo. Obligatorio en relation_*; \"\" si no aplica.",
                                },
                                strengthDelta:   { type: "number" },
                                field: {
                                    type: "string",
                                    description: "entity_state_update: \"narrativeState\" o \"collectiveMood\". \"\" si no aplica.",
                                },
                                newValue: {
                                    type: "string",
                                    description: "Nuevo valor del field. \"\" si no aplica.",
                                },
                                noteText: { type: "string" },
                                reason:   { type: "string" },
                            },
                            required: [
                                "kind", "reason",
                                "fromEntityTitle", "toEntityTitle",
                                "relationType", "field", "newValue",
                            ],
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

// ── CASCADE SCOUT — Two-pass Pasa 1 ──────────────────────────────────────────
//
// Activado cuando expectedImpacts >= CASCADE_SCOUT_THRESHOLD.
// El Scout evalúa el grafo y genera un seed mínimo para que el Impact
// sepa exactamente a quién afectar y cómo. Inspirado en:
//   - AutoWorldBuilder (Chen et al., 2026): auditor separado del generador
//   - SENNA Examiner (Jørgensen et al., 2025): pre-evalúa antes del Narrator
//   - PANGeA multi-step prompting: cada paso es seed del siguiente

/** Número mínimo de impacts esperados para activar el two-pass Scout. */
export const CASCADE_SCOUT_THRESHOLD = 5;

/** Modelo para Pasa 1 (tarea de clasificación, no de elaboración narrativa). */
export const CASCADE_SCOUT_MODEL_ID = "gemini-2.5-flash-lite";

/**
 * System prompt mínimo para el Scout.
 * Propósito: identificar y clasificar impactos, NO elaborar narrativa.
 */
export function buildCascadeScoutSystemPrompt() {
    return `Eres un evaluador de impacto narrativo para ICON TTRPG, campaña Valtia-01.
Se te da un evento, una entidad ancla y una lista de personajes posiblemente afectados con sus vínculos.
Para cada personaje de la lista, predice brevemente cómo le afecta el evento.

REGLAS ABSOLUTAS:
1. Genera exactamente un objeto por cada personaje de la lista "Personajes a evaluar". No omitas ninguno.
2. Solo usa personajes que aparezcan en la lista. Nunca inventes entidades.
3. emotionalKeyword: 2-3 palabras (ej. "angustia intensa", "calculada frialdad", "indiferencia táctica").
4. topChangeType: elige solo uno: relation_update, relation_add, relation_remove, entity_state_update, none.
5. topChangeDesc: ≤ 15 palabras que describan el cambio principal (o "sin cambio" si topChangeType es none).
6. wave: copia la onda del personaje tal como aparece en la lista (no la cambies).
7. Responde ÚNICAMENTE con JSON válido según el esquema. Nada antes ni después del JSON.`;
}

/**
 * User prompt para el Scout.
 */
export function buildCascadeScoutUserPrompt(scoutContextText, event) {
    return `${scoutContextText}

Evento catalizador: "${event}"

Para CADA personaje de la lista anterior, evalúa cómo le afecta este evento y devuelve exactamente un objeto en el array "impacts".`;
}

/**
 * Schema mínimo para el Scout (Pasa 1).
 * Intencionalmente pequeño: el modelo solo clasifica, no elabora.
 */
export const CASCADE_SCOUT_RESPONSE_SCHEMA = {
    type: "object",
    properties: {
        impacts: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    entityTitle:      { type: "string" },
                    wave:             { type: "number" },
                    emotionalKeyword: { type: "string" },
                    topChangeType: {
                        type: "string",
                        enum: ["relation_update", "relation_add", "relation_remove",
                               "entity_state_update", "none"],
                    },
                    topChangeDesc: { type: "string" },
                },
                required: ["entityTitle", "wave", "emotionalKeyword", "topChangeType", "topChangeDesc"],
            },
        },
    },
    required: ["impacts"],
};

// ── CASCADE wave configuration ────────────────────────────────────────────────

/**
 * Controls how many entities the BFS wave expansion considers per wave,
 * and the context size sent to the model.
 */
export const CASCADE_CONTEXT_OPTS = {
    maxDepth:      3,
    maxEntities:   36,
    maxRelations:  48,
    maxChars:      14000,
    maxWaves:      3,
    maxImpactsPerWave: 4,
    /** Hard cap on characters that MUST appear in "impacts" (relation-first packing). */
    maxTotalImpacts: 12,
};

/**
 * Returns context opts scaled for a given propagation depth (1–8).
 * Depth expands reach, but growth is intentional soft so long campaigns stay token-sane.
 * Prefer depth 3–4 in play; 6–8 is experimental.
 *
 * @param {number} depth — integer 1–8
 */
export function cascadeOptsForDepth(depth = 3) {
    const d = Math.max(1, Math.min(8, Math.round(depth)));
    return {
        maxDepth:          d,
        maxWaves:          d,
        // depth 3 → 30 ents / 40 rels; depth 8 → 60 / 80 (antes 100 / 150)
        maxEntities:       12 + d * 6,
        maxRelations:      16 + d * 8,
        maxChars:          7000 + d * 1200,
        maxImpactsPerWave: 4,
        maxTotalImpacts:   Math.min(12, 4 + d),
    };
}

/**
 * Relation types that trigger cascade consideration (wave 1 = these types on the anchor).
 * Higher priority = more likely to appear in wave 1.
 * Only AFFINITY edges expand waves (`isAffinityRelation` filter in computeWaveMap);
 * always-structural types (participo_en, ocurrio_en, habla, …) never deepen órbitas/impactos.
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
};
