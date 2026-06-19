export const WIKI_ENTITY_TYPES = {
    PERSONAJE: "personaje",
    LOCACION: "locacion",
    ORGANIZACION: "organizacion",
    EVENTO_HISTORICO: "evento_historico",
    RELIQUIA: "reliquia",
    IDEOLOGIA: "ideologia",
    IDIOMA: "idioma",
    ESPECIE: "especie",
    /** Crónica — lore narrativo desbloqueable (migrado desde `encyclopedia`). */
    CRONICA: "cronica",
};

/** Etiquetas en español para la UI. */
export const WIKI_ENTITY_TYPE_LABELS = {
    [WIKI_ENTITY_TYPES.PERSONAJE]: "Personaje",
    [WIKI_ENTITY_TYPES.LOCACION]: "Locación",
    [WIKI_ENTITY_TYPES.ORGANIZACION]: "Organización",
    [WIKI_ENTITY_TYPES.EVENTO_HISTORICO]: "Evento histórico",
    [WIKI_ENTITY_TYPES.RELIQUIA]: "Reliquia",
    [WIKI_ENTITY_TYPES.IDEOLOGIA]: "Ideología",
    [WIKI_ENTITY_TYPES.IDIOMA]: "Idioma",
    [WIKI_ENTITY_TYPES.ESPECIE]: "Especie",
    [WIKI_ENTITY_TYPES.CRONICA]: "Crónica",
};

/**
 * Orden de creación por dependencias (ver wikiEntityDependencies.js).
 * Debe vivir aquí para evitar import circular con ese módulo.
 */
export const WIKI_ENTITY_CREATION_ORDER = [
    WIKI_ENTITY_TYPES.IDIOMA,
    WIKI_ENTITY_TYPES.IDEOLOGIA,
    WIKI_ENTITY_TYPES.LOCACION,
    WIKI_ENTITY_TYPES.ESPECIE,
    WIKI_ENTITY_TYPES.ORGANIZACION,
    WIKI_ENTITY_TYPES.PERSONAJE,
    WIKI_ENTITY_TYPES.RELIQUIA,
    WIKI_ENTITY_TYPES.EVENTO_HISTORICO,
];

/** Tipos que aparecen en el editor general (cronica se gestiona por su propio flujo). */
export const WIKI_EDITOR_CREATION_ORDER = WIKI_ENTITY_CREATION_ORDER;

/** Array ordenado por dependencias (idioma → … → evento) para selects del editor. Excluye crónica. */
export const WIKI_ENTITY_TYPE_OPTIONS = WIKI_ENTITY_CREATION_ORDER.map((value) => ({
    value,
    label: WIKI_ENTITY_TYPE_LABELS[value],
}));

/** Tipo `entityType` inferido desde categoría de entrada encyclopedia legacy. */
export function inferEntityTypeFromLoreCategory(category = "") {
    const cat = category.toLowerCase();
    if (cat.includes("personaje") || cat.includes("npc") || cat.includes("pj")) return WIKI_ENTITY_TYPES.PERSONAJE;
    if (cat.includes("lugar") || cat.includes("locaci") || cat.includes("ciudad") || cat.includes("region")) return WIKI_ENTITY_TYPES.LOCACION;
    if (cat.includes("organizaci") || cat.includes("gremio") || cat.includes("faccion")) return WIKI_ENTITY_TYPES.ORGANIZACION;
    if (cat.includes("evento") || cat.includes("historia")) return WIKI_ENTITY_TYPES.EVENTO_HISTORICO;
    if (cat.includes("reliquia") || cat.includes("artefacto")) return WIKI_ENTITY_TYPES.RELIQUIA;
    if (cat.includes("ideolog") || cat.includes("religion") || cat.includes("culto")) return WIKI_ENTITY_TYPES.IDEOLOGIA;
    if (cat.includes("idioma") || cat.includes("lengua")) return WIKI_ENTITY_TYPES.IDIOMA;
    if (cat.includes("especie") || cat.includes("raza")) return WIKI_ENTITY_TYPES.ESPECIE;
    return WIKI_ENTITY_TYPES.PERSONAJE;
}
