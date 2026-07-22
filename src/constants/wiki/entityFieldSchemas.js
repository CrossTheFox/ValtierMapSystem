/**
 * Per-entityType structured field enums + Spanish labels for the narrative wiki.
 *
 * These power the conditional customFields panels in WikiEntityEditor and the
 * read-only chips/sections in WikiEntityDetail. They are intentionally
 * decoupled from free Markdown (summary/body) — see campos-por-tipo-entidad.md.
 *
 * Convention: every enum has a `*_OPTIONS` array ({ value, label }) for selects.
 */

function toOptions(valueMap, labelMap) {
    return Object.values(valueMap).map((value) => ({
        value,
        label: labelMap[value] || value,
    }));
}

/* ------------------------------------------------------------------ */
/* Membership (shared: organizacion <-> personaje / VTT character)     */
/* ------------------------------------------------------------------ */

export const MEMBERSHIP_STATUS = {
    CONFIRMADO: "confirmado",
    SOSPECHADO: "sospechado",
};

export const MEMBERSHIP_STATUS_LABELS = {
    [MEMBERSHIP_STATUS.CONFIRMADO]: "Miembro confirmado",
    [MEMBERSHIP_STATUS.SOSPECHADO]: "Se sospecha que es miembro",
};

export const MEMBERSHIP_STATUS_OPTIONS = toOptions(MEMBERSHIP_STATUS, MEMBERSHIP_STATUS_LABELS);

/** Reference kind inside an organization member entry. */
export const MEMBER_REF_KIND = {
    VTT: "vtt", // playable character in `characters` collection
    WIKI: "wiki", // narrative wikiEntity personaje
};

/* ------------------------------------------------------------------ */
/* Especie                                                             */
/* ------------------------------------------------------------------ */

export const DIET = {
    HERBIVORO: "herbivoro",
    OMNIVORO: "omnivoro",
    CARNIVORO: "carnivoro",
    FOTOSINTETICO: "fotosintetico",
    HEMATOFAGO: "hematofago",
    ENERGIA: "energia",
    ESPECIAL: "especial",
};

export const DIET_LABELS = {
    [DIET.HERBIVORO]: "Herbívoro",
    [DIET.OMNIVORO]: "Omnívoro",
    [DIET.CARNIVORO]: "Carnívoro",
    [DIET.FOTOSINTETICO]: "Fotosintético",
    [DIET.HEMATOFAGO]: "Hematófago",
    [DIET.ENERGIA]: "Se alimenta de energía",
    [DIET.ESPECIAL]: "Especial / otro",
};

export const DIET_OPTIONS = toOptions(DIET, DIET_LABELS);

export const SIZE_CATEGORY = {
    DIMINUTO: "diminuto",
    PEQUENO: "pequeno",
    MEDIANO: "mediano",
    GRANDE: "grande",
    COLOSAL: "colosal",
};

export const SIZE_CATEGORY_LABELS = {
    [SIZE_CATEGORY.DIMINUTO]: "Diminuto",
    [SIZE_CATEGORY.PEQUENO]: "Pequeño",
    [SIZE_CATEGORY.MEDIANO]: "Mediano",
    [SIZE_CATEGORY.GRANDE]: "Grande",
    [SIZE_CATEGORY.COLOSAL]: "Colosal",
};

export const SIZE_CATEGORY_OPTIONS = toOptions(SIZE_CATEGORY, SIZE_CATEGORY_LABELS);

export const POPULATION_SCALE = {
    EXTINTO: "extinto",
    RARO: "raro",
    MINORIA: "minoria",
    COMUN: "comun",
    DOMINANTE: "dominante",
};

export const POPULATION_SCALE_LABELS = {
    [POPULATION_SCALE.EXTINTO]: "Extinto",
    [POPULATION_SCALE.RARO]: "Raro",
    [POPULATION_SCALE.MINORIA]: "Minoría",
    [POPULATION_SCALE.COMUN]: "Común",
    [POPULATION_SCALE.DOMINANTE]: "Dominante",
};

export const POPULATION_SCALE_OPTIONS = toOptions(POPULATION_SCALE, POPULATION_SCALE_LABELS);

/* ------------------------------------------------------------------ */
/* Personaje                                                           */
/* ------------------------------------------------------------------ */

export const CHARACTER_KIND = {
    HISTORICO: "historico",
    LEGENDARIO: "legendario",
    CONTEMPORANEO: "contemporaneo",
    DIVINO: "divino",
    CONSTRUCTO: "constructo",
    DESCONOCIDO: "desconocido",
};

export const CHARACTER_KIND_LABELS = {
    [CHARACTER_KIND.HISTORICO]: "Histórico",
    [CHARACTER_KIND.LEGENDARIO]: "Legendario",
    [CHARACTER_KIND.CONTEMPORANEO]: "Contemporáneo",
    [CHARACTER_KIND.DIVINO]: "Divino",
    [CHARACTER_KIND.CONSTRUCTO]: "Constructo",
    [CHARACTER_KIND.DESCONOCIDO]: "Desconocido",
};

export const CHARACTER_KIND_OPTIONS = toOptions(CHARACTER_KIND, CHARACTER_KIND_LABELS);

/* ------------------------------------------------------------------ */
/* Locación                                                            */
/* ------------------------------------------------------------------ */

export const LOCATION_KIND = {
    PAIS: "pais",
    REGION: "region",
    CIUDAD: "ciudad",
    EDIFICIO: "edificio",
    DUNGEON: "dungeon",
    PLANO: "plano",
    PUNTO_INTERES: "punto_interes",
};

export const LOCATION_KIND_LABELS = {
    [LOCATION_KIND.PAIS]: "País",
    [LOCATION_KIND.REGION]: "Región",
    [LOCATION_KIND.CIUDAD]: "Ciudad",
    [LOCATION_KIND.EDIFICIO]: "Edificio",
    [LOCATION_KIND.DUNGEON]: "Mazmorra",
    [LOCATION_KIND.PLANO]: "Plano / dimensión",
    [LOCATION_KIND.PUNTO_INTERES]: "Punto de interés",
};

/** De lo más amplio a lo más concreto (plano → país → … → mazmorra). */
export const LOCATION_KIND_ORDER = [
    LOCATION_KIND.PLANO,
    LOCATION_KIND.PAIS,
    LOCATION_KIND.REGION,
    LOCATION_KIND.CIUDAD,
    LOCATION_KIND.PUNTO_INTERES,
    LOCATION_KIND.EDIFICIO,
    LOCATION_KIND.DUNGEON,
];

export const LOCATION_KIND_OPTIONS = LOCATION_KIND_ORDER.map((value) => ({
    value,
    label: LOCATION_KIND_LABELS[value],
}));

/** Escala local (un asentamiento: aldea → metrópoli). */
export const POPULATION_ORDER = {
    VACIO: "vacio",
    ALDEA: "aldea",
    PUEBLO: "pueblo",
    CIUDAD: "ciudad",
    METROPOLI: "metropoli",
    /** Varios núcleos urbanos grandes (región urbanizada). */
    CORREDOR_URBANO: "corredor_urbano",
    /** Estado / país habitado en conjunto. */
    NACION: "nacion",
    /** Imperio, continente o bloque civilizatorio. */
    IMPERIO: "imperio",
};

export const POPULATION_ORDER_LABELS = {
    [POPULATION_ORDER.VACIO]: "Deshabitado",
    [POPULATION_ORDER.ALDEA]: "Aldea",
    [POPULATION_ORDER.PUEBLO]: "Pueblo",
    [POPULATION_ORDER.CIUDAD]: "Ciudad",
    [POPULATION_ORDER.METROPOLI]: "Metrópoli",
    [POPULATION_ORDER.CORREDOR_URBANO]: "Corredor urbano (varias metrópolis)",
    [POPULATION_ORDER.NACION]: "Nación / estado",
    [POPULATION_ORDER.IMPERIO]: "Imperio / super-estado",
};

export const POPULATION_ORDER_OPTIONS = toOptions(POPULATION_ORDER, POPULATION_ORDER_LABELS);

/** Solo escala de asentamiento (ciudad, edificio, mazmorra, punto de interés). */
export const POPULATION_SETTLEMENT_OPTIONS = POPULATION_ORDER_OPTIONS.filter(
    ({ value }) =>
        value === POPULATION_ORDER.VACIO ||
        value === POPULATION_ORDER.ALDEA ||
        value === POPULATION_ORDER.PUEBLO ||
        value === POPULATION_ORDER.CIUDAD ||
        value === POPULATION_ORDER.METROPOLI
);

/** Tipos territoriales donde tiene sentido la escala macro (país, región, plano). */
export const POPULATION_MACRO_LOCATION_KINDS = new Set([
    LOCATION_KIND.PAIS,
    LOCATION_KIND.REGION,
    LOCATION_KIND.PLANO,
]);

/**
 * Opciones de población según el tipo de locación: asentamientos no ofrecen
 * «nación/imperio»; territorios sí incluyen la escala completa.
 * @param {string} [locationKind]
 */
export function getPopulationOrderOptionsForLocationKind(locationKind) {
    if (!locationKind || POPULATION_MACRO_LOCATION_KINDS.has(locationKind)) {
        return POPULATION_ORDER_OPTIONS;
    }
    return POPULATION_SETTLEMENT_OPTIONS;
}

export function isMacroPopulationOrder(value) {
    return (
        value === POPULATION_ORDER.CORREDOR_URBANO ||
        value === POPULATION_ORDER.NACION ||
        value === POPULATION_ORDER.IMPERIO
    );
}

/* ------------------------------------------------------------------ */
/* Organización                                                        */
/* ------------------------------------------------------------------ */

export const ORGANIZATION_KIND = {
    GREMIO: "gremio",
    CASA_NOBLE: "casa_noble",
    MILITAR: "militar",
    PARA_MILITAR: "para_militar",
    RELIGIOSO: "religioso",
    CRIMINAL: "criminal",
    TERRORISTA: "terrorista",
    PSEUDO_TERRORISTA: "pseudo_terrorista",
    ESTATAL: "estatal",
    OTRO: "otro",
};

export const ORGANIZATION_KIND_LABELS = {
    [ORGANIZATION_KIND.GREMIO]: "Gremio",
    [ORGANIZATION_KIND.CASA_NOBLE]: "Casa noble",
    [ORGANIZATION_KIND.MILITAR]: "Militar",
    [ORGANIZATION_KIND.PARA_MILITAR]: "Para-militar",
    [ORGANIZATION_KIND.RELIGIOSO]: "Religioso",
    [ORGANIZATION_KIND.CRIMINAL]: "Criminal",
    [ORGANIZATION_KIND.TERRORISTA]: "Terrorista",
    [ORGANIZATION_KIND.PSEUDO_TERRORISTA]: "Pseudo-terrorista",
    [ORGANIZATION_KIND.ESTATAL]: "Estatal",
    [ORGANIZATION_KIND.OTRO]: "Otro",
};

export const ORGANIZATION_KIND_OPTIONS = toOptions(ORGANIZATION_KIND, ORGANIZATION_KIND_LABELS);

export const ORGANIZATION_SIZE = {
    CELULA: "celula",
    LOCAL: "local",
    REGIONAL: "regional",
    GLOBAL: "global",
};

export const ORGANIZATION_SIZE_LABELS = {
    [ORGANIZATION_SIZE.CELULA]: "Célula",
    [ORGANIZATION_SIZE.LOCAL]: "Local",
    [ORGANIZATION_SIZE.REGIONAL]: "Regional",
    [ORGANIZATION_SIZE.GLOBAL]: "Global",
};

export const ORGANIZATION_SIZE_OPTIONS = toOptions(ORGANIZATION_SIZE, ORGANIZATION_SIZE_LABELS);

/* ------------------------------------------------------------------ */
/* Evento histórico                                                    */
/* ------------------------------------------------------------------ */

export const EVENT_KIND = {
    BATALLA: "batalla",
    TRATADO: "tratado",
    CATACLISMO: "cataclismo",
    NACIMIENTO_LEGADO: "nacimiento_legado",
    DESCUBRIMIENTO: "descubrimiento",
    POLITICO: "politico",
    OTRO: "otro",
};

export const EVENT_KIND_LABELS = {
    [EVENT_KIND.BATALLA]: "Batalla",
    [EVENT_KIND.TRATADO]: "Tratado / pacto",
    [EVENT_KIND.CATACLISMO]: "Cataclismo",
    [EVENT_KIND.NACIMIENTO_LEGADO]: "Nacimiento / legado",
    [EVENT_KIND.DESCUBRIMIENTO]: "Descubrimiento",
    [EVENT_KIND.POLITICO]: "Político",
    [EVENT_KIND.OTRO]: "Otro",
};

export const EVENT_KIND_OPTIONS = toOptions(EVENT_KIND, EVENT_KIND_LABELS);

export const EVENT_CERTAINTY = {
    CANON: "canon",
    LEGENDARIO: "legendario",
    DISPUTADO: "disputado",
};

export const EVENT_CERTAINTY_LABELS = {
    [EVENT_CERTAINTY.CANON]: "Canónico",
    [EVENT_CERTAINTY.LEGENDARIO]: "Legendario",
    [EVENT_CERTAINTY.DISPUTADO]: "Disputado",
};

export const EVENT_CERTAINTY_OPTIONS = toOptions(EVENT_CERTAINTY, EVENT_CERTAINTY_LABELS);

/* ------------------------------------------------------------------ */
/* Reliquia                                                            */
/* ------------------------------------------------------------------ */

export const RELIC_KIND = {
    ARMA: "arma",
    ARMADURA: "armadura",
    JOYA: "joya",
    LIBRO: "libro",
    RELIQUIA_ICON: "reliquia_icon",
    MALDICION: "maldicion",
    OTRO: "otro",
};

export const RELIC_KIND_LABELS = {
    [RELIC_KIND.ARMA]: "Arma",
    [RELIC_KIND.ARMADURA]: "Armadura",
    [RELIC_KIND.JOYA]: "Joya / amuleto",
    [RELIC_KIND.LIBRO]: "Libro / tomo",
    [RELIC_KIND.RELIQUIA_ICON]: "Reliquia ICON",
    [RELIC_KIND.MALDICION]: "Maldición",
    [RELIC_KIND.OTRO]: "Otro",
};

export const RELIC_KIND_OPTIONS = toOptions(RELIC_KIND, RELIC_KIND_LABELS);

export const RELIC_POWER_TIER = {
    MENOR: "menor",
    MAYOR: "mayor",
    LEGENDARIA: "legendaria",
};

export const RELIC_POWER_TIER_LABELS = {
    [RELIC_POWER_TIER.MENOR]: "Menor",
    [RELIC_POWER_TIER.MAYOR]: "Mayor",
    [RELIC_POWER_TIER.LEGENDARIA]: "Legendaria",
};

export const RELIC_POWER_TIER_OPTIONS = toOptions(RELIC_POWER_TIER, RELIC_POWER_TIER_LABELS);

/* ------------------------------------------------------------------ */
/* Ideología                                                           */
/* ------------------------------------------------------------------ */

export const IDEOLOGY_KIND = {
    RELIGION: "religion",
    FILOSOFIA: "filosofia",
    CULTO: "culto",
    ETICA_PROFESIONAL: "etica_profesional",
    MOVIMIENTO: "movimiento",
};

export const IDEOLOGY_KIND_LABELS = {
    [IDEOLOGY_KIND.RELIGION]: "Religión",
    [IDEOLOGY_KIND.FILOSOFIA]: "Filosofía",
    [IDEOLOGY_KIND.CULTO]: "Culto",
    [IDEOLOGY_KIND.ETICA_PROFESIONAL]: "Ética profesional",
    [IDEOLOGY_KIND.MOVIMIENTO]: "Movimiento",
};

export const IDEOLOGY_KIND_OPTIONS = toOptions(IDEOLOGY_KIND, IDEOLOGY_KIND_LABELS);

export const IDEOLOGY_SPREAD = {
    LOCAL: "local",
    REGIONAL: "regional",
    UNIVERSAL: "universal",
    EXTINTO: "extinto",
};

export const IDEOLOGY_SPREAD_LABELS = {
    [IDEOLOGY_SPREAD.LOCAL]: "Local",
    [IDEOLOGY_SPREAD.REGIONAL]: "Regional",
    [IDEOLOGY_SPREAD.UNIVERSAL]: "Universal",
    [IDEOLOGY_SPREAD.EXTINTO]: "Extinto",
};

export const IDEOLOGY_SPREAD_OPTIONS = toOptions(IDEOLOGY_SPREAD, IDEOLOGY_SPREAD_LABELS);

/* ------------------------------------------------------------------ */
/* Crónica (migrado desde encyclopedia)                                */
/* ------------------------------------------------------------------ */

export const CRONICA_CATEGORY = {
    GENERAL: "general",
    HISTORIA: "historia",
    MITO: "mito",
    LEYENDA: "leyenda",
    DOCUMENTO: "documento",
    OTRO: "otro",
};

export const CRONICA_CATEGORY_LABELS = {
    [CRONICA_CATEGORY.GENERAL]: "General",
    [CRONICA_CATEGORY.HISTORIA]: "Historia",
    [CRONICA_CATEGORY.MITO]: "Mito",
    [CRONICA_CATEGORY.LEYENDA]: "Leyenda",
    [CRONICA_CATEGORY.DOCUMENTO]: "Documento / texto",
    [CRONICA_CATEGORY.OTRO]: "Otro",
};

export const CRONICA_CATEGORY_OPTIONS = toOptions(CRONICA_CATEGORY, CRONICA_CATEGORY_LABELS);

/* ------------------------------------------------------------------ */
/* Arquetipo de reacción narrativa (personaje)                        */
/*                                                                    */
/* Basado en PANGeA (Buongiorno et al., 2024): los arquetipos de      */
/* personalidad guían la toma de decisiones coherente del PNJ a lo   */
/* largo de múltiples turnos narrativos. Adaptado al espacio          */
/* narrativo de Valtia-01 (5 arquetipos de reacción, no OCEAN).       */
/* ------------------------------------------------------------------ */

export const REACTION_ARCHETYPE = {
    GUARDIAN:    "guardian",
    POLITICO:    "politico",
    INTIMO:      "intimo",
    RIVAL:       "rival",
    PRAGMATICO:  "pragmatico",
};

export const REACTION_ARCHETYPE_LABELS = {
    [REACTION_ARCHETYPE.GUARDIAN]:   "Guardián",
    [REACTION_ARCHETYPE.POLITICO]:   "Político",
    [REACTION_ARCHETYPE.INTIMO]:     "Íntimo",
    [REACTION_ARCHETYPE.RIVAL]:      "Rival",
    [REACTION_ARCHETYPE.PRAGMATICO]: "Pragmático",
};

/**
 * Description sent to the LLM in the context pack to guide reaction generation.
 * These descriptions are intentionally terse and behavior-focused.
 */
export const REACTION_ARCHETYPE_AI_DESCRIPTIONS = {
    [REACTION_ARCHETYPE.GUARDIAN]:
        "Prioriza proteger a sus aliados. Ante un evento que los afecte, su primer impulso es "
        + "identificar amenazas, reforzar lazos de lealtad y actuar como escudo. "
        + "No le interesa el poder propio; le interesa la seguridad del grupo.",
    [REACTION_ARCHETYPE.POLITICO]:
        "Calcula el impacto en el equilibrio de poder antes de reaccionar emocionalmente. "
        + "Cada evento es una oportunidad o un riesgo para su facción. "
        + "Puede apoyar o sabotear según qué le convenga, incluso contra aliados.",
    [REACTION_ARCHETYPE.INTIMO]:
        "Los vínculos personales y la verdad emocional son su brújula. "
        + "Ante un evento significativo exige respuestas directas, confronta, llora o se rompe. "
        + "No tolera secretos entre personas que quiere; la lealtad es absoluta o no existe.",
    [REACTION_ARCHETYPE.RIVAL]:
        "Ve el éxito o la ventaja ajena como una derrota propia. "
        + "Ante un evento que beneficia a otro, busca contrarrestarlo, debilitarlo o "
        + "aprovechar la distracción para avanzar. La inquina puede ser suave (envidia) "
        + "o abierta (sabotaje, traición).",
    [REACTION_ARCHETYPE.PRAGMATICO]:
        "Toma decisiones basadas en coste-beneficio personal, sin apego emocional fuerte. "
        + "Puede cambiar de bando si la situación lo justifica. "
        + "No es cruel por defecto; simplemente no deja que los sentimientos nublen el juicio. "
        + "Sus cambios de relación son lentos pero definitivos.",
};

export const REACTION_ARCHETYPE_TOOLTIPS = {
    [REACTION_ARCHETYPE.GUARDIAN]:
        "Protege a sus aliados ante todo. Reacciona a amenazas con lealtad activa.",
    [REACTION_ARCHETYPE.POLITICO]:
        "Calcula poder antes que sentir. Cada evento es una oportunidad o un riesgo.",
    [REACTION_ARCHETYPE.INTIMO]:
        "Los vínculos personales son su brújula. Exige verdad, confronta, se rompe.",
    [REACTION_ARCHETYPE.RIVAL]:
        "Ve la ventaja ajena como derrota propia. Busca contrarrestar o aprovechar.",
    [REACTION_ARCHETYPE.PRAGMATICO]:
        "Coste-beneficio sin apego. Puede cambiar de bando si la lógica lo justifica.",
};

export const REACTION_ARCHETYPE_OPTIONS = toOptions(
    REACTION_ARCHETYPE, REACTION_ARCHETYPE_LABELS
);

/* ------------------------------------------------------------------ */
/* Estado narrativo del personaje                                      */
/* Mutable: cambia con eventos de campaña. Persiste en customFields.  */
/* ------------------------------------------------------------------ */

export const NARRATIVE_STATE = {
    ESTABLE:         "estable",
    DEPRIMIDA:       "deprimida",
    FURIOSA:         "furiosa",
    QUEBRADA:        "quebrada",
    OBSESIVA:        "obsesiva",
    CORRUPTA_ZARKEN: "corrupta_zarken",
    PARANOICA:       "paranoica",
    INDIFERENTE:     "indiferente",
    OTRO:            "otro",
};

export const NARRATIVE_STATE_LABELS = {
    [NARRATIVE_STATE.ESTABLE]:         "Estable",
    [NARRATIVE_STATE.DEPRIMIDA]:       "Deprimida / en duelo",
    [NARRATIVE_STATE.FURIOSA]:         "Furiosa / iracunda",
    [NARRATIVE_STATE.QUEBRADA]:        "Quebrada / disociada",
    [NARRATIVE_STATE.OBSESIVA]:        "Obsesiva",
    [NARRATIVE_STATE.CORRUPTA_ZARKEN]: "Corrupta (sangre Zarken)",
    [NARRATIVE_STATE.PARANOICA]:       "Paranoica",
    [NARRATIVE_STATE.INDIFERENTE]:     "Indiferente / blindada",
    [NARRATIVE_STATE.OTRO]:            "Otro",
};

export const NARRATIVE_STATE_OPTIONS = toOptions(NARRATIVE_STATE, NARRATIVE_STATE_LABELS);

/** UI: qué significa cada estado y cómo lo usa la IA. */
export const NARRATIVE_STATE_TOOLTIPS = {
    [NARRATIVE_STATE.ESTABLE]:
        "Emocionalmente equilibrado/a. Reacciona con proporción al evento, sin filtro de crisis activa.",
    [NARRATIVE_STATE.DEPRIMIDA]:
        "En duelo o apatía. Minimiza acciones, evita conflictos; la IA tenderá a reacciones contenidas o melancólicas.",
    [NARRATIVE_STATE.FURIOSA]:
        "Ira activa. Confronta, exige respuestas, puede escalar conflictos antes de reflexionar.",
    [NARRATIVE_STATE.QUEBRADA]:
        "Disociación o colapso emocional. Respuestas erráticas, silencio prolongado o decisiones impulsivas.",
    [NARRATIVE_STATE.OBSESIVA]:
        "Fijación en una meta o persona. Filtra todo el evento a través de esa obsesión.",
    [NARRATIVE_STATE.CORRUPTA_ZARKEN]:
        "Influencia oscura / sangre Zarken. La IA puede proponer traiciones o poder prohibido como salida.",
    [NARRATIVE_STATE.PARANOICA]:
        "Desconfianza extrema. Interpreta el evento como amenaza personal o conspiración.",
    [NARRATIVE_STATE.INDIFERENTE]:
        "Blindaje emocional. Impacto mínimo salvo que el evento toque anclas emocionales directas.",
    [NARRATIVE_STATE.OTRO]:
        "Estado no listado; describe el matiz en rasgos o anclas para que la IA lo respete.",
};

export const NARRATIVE_PERSONALITY_SECTION_HELP =
    "Opcional. Guía a la IA en modo Evento narrativo (PANGeA): define CÓMO reacciona el personaje "
    + "ante impactos, no qué dice en la ficha. Combina arquetipo (tendencia estable) + estado actual "
    + "(mutable tras eventos de campaña).";

export const REACTION_ARCHETYPE_FIELD_HELP =
    "Tendencia estable de toma de decisiones. No cambia cada sesión; el estado narrativo sí. "
    + "Pasa el cursor sobre cada opción para ver su comportamiento.";

export const NARRATIVE_STATE_FIELD_HELP =
    "Estado emocional actual del personaje en la campaña. Actualízalo tras duelos, traiciones "
    + "o victorias: la IA lo prioriza sobre el arquetipo al generar reacciones.";

export const STRESS_RESPONSE_FIELD_HELP =
    "Patrón ante trauma o pérdida grave (no el día a día). La IA lo usa cuando el evento "
    + "simula un golpe emocional fuerte: duelo, traición, muerte de un vínculo, etc.";

export const NARRATIVE_TRAITS_FIELD_HELP =
    "Rasgos estables de «voz» y comportamiento (máx. 5). No son stats de combate. "
    + "Ejemplos útiles: «lealtad filial extrema», «desconfía de la magia divina», "
    + "«nunca miente a sus hijos», «habla en tercera persona bajo estrés», "
    + "«obsesionado con cumplir el deber», «perdona enemigos pero no traidores». "
    + "Evita repetir el arquetipo («es pragmático») o rasgos mecánicos («fuerza 18»).";

export const BOND_NOTES_FIELD_HELP =
    "Anclas emocionales concretas: personas, lugares o promesas que DEBEN pesar en la reacción "
    + "si el evento las toca. Ej.: «Felicia era su único pilar; sin ella sella el dolor con deber». "
    + "«Protegerá a Oni aunque traicione la corona». «La ciudad de Mirage es sagrada: no negocia su caída». "
    + "Útil para que la IA no ignore vínculos ya escritos en lore.";

export const NARRATIVE_TRAITS_EXAMPLES = [
    "lealtad filial extrema",
    "desconfía de magia divina",
    "nunca miente a sus hijos",
    "obsesionado con el deber",
    "perdona enemigos, no traidores",
];

/* ------------------------------------------------------------------ */
/* Patrón de respuesta al estrés / trauma                             */
/* ------------------------------------------------------------------ */

export const STRESS_RESPONSE = {
    LUTO_CERRADO:    "luto_cerrado",
    LUTO_VOLCANICO:  "luto_volcanico",
    VENGANZA:        "venganza",
    COLAPSO:         "colapso",
    CORRUPCION:      "corrupcion",
    PRAGMATICO:      "pragmatico",
    DISOCIACION:     "disociacion",
};

export const STRESS_RESPONSE_LABELS = {
    [STRESS_RESPONSE.LUTO_CERRADO]:   "Luto cerrado (se encierra)",
    [STRESS_RESPONSE.LUTO_VOLCANICO]: "Luto volcánico (explota o rompe)",
    [STRESS_RESPONSE.VENGANZA]:       "Venganza activa",
    [STRESS_RESPONSE.COLAPSO]:        "Colapso / rendición",
    [STRESS_RESPONSE.CORRUPCION]:     "Corrupción / transformación oscura",
    [STRESS_RESPONSE.PRAGMATICO]:     "Pragmático (procesa y sigue)",
    [STRESS_RESPONSE.DISOCIACION]:    "Disociación / negación",
};

export const STRESS_RESPONSE_OPTIONS = toOptions(STRESS_RESPONSE, STRESS_RESPONSE_LABELS);

/** UI: tooltips para el editor (versión legible de las descripciones IA). */
export const STRESS_RESPONSE_TOOLTIPS = {
    [STRESS_RESPONSE.LUTO_CERRADO]:
        "Se encierra y procesa en silencio. Puede actuar meses después, sin confrontar de inmediato.",
    [STRESS_RESPONSE.LUTO_VOLCANICO]:
        "Explota hacia afuera: confrontación, rupturas o acciones impulsivas antes de pensar.",
    [STRESS_RESPONSE.VENGANZA]:
        "Convierte el dolor en misión de retribución; puede sacrificar otros vínculos para cumplirla.",
    [STRESS_RESPONSE.COLAPSO]:
        "Se paraliza o cede el control; otros deciden por él/ella hasta recuperarse.",
    [STRESS_RESPONSE.CORRUPCION]:
        "El trauma abre la puerta a poder o valores oscuros que antes rechazaba.",
    [STRESS_RESPONSE.PRAGMATICO]:
        "Procesa y sigue; puede parecer frío pero sigue siendo funcional.",
    [STRESS_RESPONSE.DISOCIACION]:
        "Niega o minimiza el evento hasta que un detonador secundario lo rompe.",
};

/** IA: descripción breve del patrón de estrés, incluida en el prompt. */
export const STRESS_RESPONSE_AI_DESCRIPTIONS = {
    [STRESS_RESPONSE.LUTO_CERRADO]:
        "Ante una pérdida, se retira, bloquea la emoción externamente y procesa en soledad. "
        + "No confronta; rumiará hasta actuar meses después.",
    [STRESS_RESPONSE.LUTO_VOLCANICO]:
        "La emoción explota hacia afuera: confrontación directa, destrucción de relaciones o "
        + "acciones impulsivas antes de poder procesar racionalmente.",
    [STRESS_RESPONSE.VENGANZA]:
        "Canaliza el dolor en una meta concreta de retribución. El duelo se convierte en misión; "
        + "puede sacrificar vínculos secundarios para cumplirla.",
    [STRESS_RESPONSE.COLAPSO]:
        "La carga emocional supera la capacidad de acción; se paraliza, cede el control o "
        + "permite que otros decidan por él/ella.",
    [STRESS_RESPONSE.CORRUPCION]:
        "El trauma abre la puerta a una transformación oscura: adopta valores o poderes que antes "
        + "rechazaba, generalmente ligados a sangre, magia prohibida o traición.",
    [STRESS_RESPONSE.PRAGMATICO]:
        "Procesa con rapidez y sigue adelante. No niega el dolor, pero no lo deja dominar sus decisiones; "
        + "puede parecer frío pero es funcional.",
    [STRESS_RESPONSE.DISOCIACION]:
        "Se disocia de la realidad del evento: actúa con normalidad, niega o minimiza, hasta que "
        + "un detonador secundario lo rompe.",
};

/* ------------------------------------------------------------------ */
/* Arquetipo colectivo de locaciones y organizaciones                  */
/* Para guiar reacciones colectivas en el modo Evento narrativo.       */
/* ------------------------------------------------------------------ */

export const COLLECTIVE_ARCHETYPE = {
    LEAL_DINASTIA:          "leal_dinastia",
    PARANOICA:              "paranoica",
    COMERCIAL_PRAGMATICA:   "comercial_pragmatica",
    FANATICA:               "fanatica",
    ANARQUICA:              "anarquica",
    JERARQUICA_LEAL:        "jerarquica_leal",
    FRAGMENTADA:            "fragmentada",
    EXPANSIONISTA:          "expansionista",
    CLANDESTINA:            "clandestina",
};

export const COLLECTIVE_ARCHETYPE_LABELS = {
    [COLLECTIVE_ARCHETYPE.LEAL_DINASTIA]:        "Leal a la dinastía",
    [COLLECTIVE_ARCHETYPE.PARANOICA]:            "Paranoica / desconfiada",
    [COLLECTIVE_ARCHETYPE.COMERCIAL_PRAGMATICA]: "Comercial / pragmática",
    [COLLECTIVE_ARCHETYPE.FANATICA]:             "Fanática / dogmática",
    [COLLECTIVE_ARCHETYPE.ANARQUICA]:            "Anárquica / caótica",
    [COLLECTIVE_ARCHETYPE.JERARQUICA_LEAL]:      "Jerárquica leal",
    [COLLECTIVE_ARCHETYPE.FRAGMENTADA]:          "Fragmentada / en crisis",
    [COLLECTIVE_ARCHETYPE.EXPANSIONISTA]:        "Expansionista",
    [COLLECTIVE_ARCHETYPE.CLANDESTINA]:          "Clandestina / secreta",
};

export const COLLECTIVE_ARCHETYPE_OPTIONS = toOptions(
    COLLECTIVE_ARCHETYPE, COLLECTIVE_ARCHETYPE_LABELS
);

/** IA: descripción terse del temperamento colectivo para el prompt. */
export const COLLECTIVE_ARCHETYPE_AI_DESCRIPTIONS = {
    [COLLECTIVE_ARCHETYPE.LEAL_DINASTIA]:
        "Cierra filas ante amenazas al orden dinástico; prioriza estabilidad del trono sobre individuo.",
    [COLLECTIVE_ARCHETYPE.PARANOICA]:
        "Sospecha de cambios externos; tiende a cerrar fronteras, purgas o movimientos secretos.",
    [COLLECTIVE_ARCHETYPE.COMERCIAL_PRAGMATICA]:
        "Evalúa el impacto económico primero; puede cambiar de bando si el precio es correcto.",
    [COLLECTIVE_ARCHETYPE.FANATICA]:
        "Interpreta eventos en clave religiosa o ideológica; reacciones absolutas, poco margen de duda.",
    [COLLECTIVE_ARCHETYPE.ANARQUICA]:
        "El poder central es débil; cada actor aprovecha el caos para expandir su esfera.",
    [COLLECTIVE_ARCHETYPE.JERARQUICA_LEAL]:
        "La cadena de mando se respeta; reacciones en bloque coordinado desde arriba.",
    [COLLECTIVE_ARCHETYPE.FRAGMENTADA]:
        "Facciones internas en tensión; un evento grande puede desencadenar cisma.",
    [COLLECTIVE_ARCHETYPE.EXPANSIONISTA]:
        "Ve cada evento como oportunidad de ganar territorio, recursos o influencia.",
    [COLLECTIVE_ARCHETYPE.CLANDESTINA]:
        "Opera en las sombras; el evento público es pretexto para maniobras ocultas.",
};

/**
 * Default cronica customFields.
 * `isLocked`: si el texto está bloqueado para jugadores hasta que el DJ lo desbloquee.
 * `unlockGoal`: descripción de la condición para desbloquear.
 * `legacyEncyclopediaId`: trazabilidad post-migración (null si creado directamente).
 */
export function defaultGlosarioFields() {
    return {
        glosario: {
            aliases: [],
        },
    };
}

export function defaultCronicaFields() {
    return {
        cronica: {
            category: CRONICA_CATEGORY.GENERAL,
            isLocked: false,
            unlockGoal: "",
            legacyEncyclopediaId: null,
        },
    };
}
