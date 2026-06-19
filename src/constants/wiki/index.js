/**
 * Wiki engine — area registry and shared constants.
 *
 * Phase 4: Chronicle unified into wikiEntities as entityType "cronica".
 * All areas (Chronicle, Codex, Timeline, Neural Lab) open NarrativeWikiOverlay.
 */

export const WIKI_AREA_IDS = {
    LORE: "lore",
    TIMELINE: "timeline",
    CODEX: "codex",
    NEURAL_LAB: "neural_lab",
};

/** @typedef {'lore'|'timeline'|'codex'|'neural_lab'} WikiAreaId */

/**
 * @typedef {Object} WikiAreaMeta
 * @property {WikiAreaId} id
 * @property {string} label  — short uppercase HUD label
 * @property {string} hint   — one-line description for players
 * @property {string} description — paragraph for onboarding in the overlay
 * @property {string} phase  — 'live' | 'stub'
 */

/** @type {WikiAreaMeta[]} */
export const WIKI_AREAS = [
    {
        id: WIKI_AREA_IDS.LORE,
        label: "CHRONICLE",
        hint: "Lore desbloqueado por la campaña",
        description:
            "Crónica de la campaña: textos que el DJ va desbloqueando para los jugadores según avanza la historia.",
        phase: "live",
    },
    {
        id: WIKI_AREA_IDS.CODEX,
        label: "CODEX",
        hint: "Fichas, conceptos y entidades del mundo",
        description:
            "Códice unificado: personajes, locaciones, organizaciones, especies, reliquias, idiomas e ideologías. Fichas con texto libre, etiquetas, relaciones y vínculos al mapa.",
        phase: "live",
    },
    {
        id: WIKI_AREA_IDS.TIMELINE,
        label: "TIMELINE",
        hint: "Hitos y eras de la historia",
        description:
            "Línea temporal: eventos históricos, eras y hitos ordenados en el tiempo. Útil para ver qué pasó antes de la campaña o en qué momento encaja un suceso.",
        phase: "live",
    },
    {
        id: WIKI_AREA_IDS.NEURAL_LAB,
        label: "NEURAL_LAB",
        hint: "Grafo de relaciones + laboratorio IA",
        description:
            "Red neuronal de entidades conectadas por relaciones, junto al laboratorio de IA. Selecciona un nodo para ver su ficha y generar narrativa anclada.",
        phase: "live",
    },
];

/** Areas shown in the narrative archive tab nav (excludes Chronicle drawer-only area). */
export const WIKI_ARCHIVE_AREAS = WIKI_AREAS.filter((a) => a.id !== WIKI_AREA_IDS.LORE);

/** Intro shown when browsing the codex surface. */
export const WIKI_ARCHIVE_INTRO =
    "Archivo narrativo de la campaña. Busca por nombre o etiqueta y haz clic en una ficha para leerla. En el texto puedes enlazar otras fichas con @menciones.";

/** @type {WikiAreaId} */
export const DEFAULT_WIKI_AREA = WIKI_AREA_IDS.LORE;

/** Default surface when opening the narrative archive tab. */
export const DEFAULT_ARCHIVE_AREA = WIKI_AREA_IDS.CODEX;

/**
 * Maps each drawer area to the wikiEntity entityTypes it shows.
 * null means "show all".
 * @type {Record<WikiAreaId, string[]|null>}
 */
export const WIKI_AREA_ENTITY_TYPES = {
    [WIKI_AREA_IDS.LORE]: ["cronica"],
    [WIKI_AREA_IDS.TIMELINE]: ["evento_historico"],
    [WIKI_AREA_IDS.CODEX]: [
        "idioma",
        "ideologia",
        "personaje",
        "locacion",
        "organizacion",
        "especie",
        "reliquia",
    ],
    [WIKI_AREA_IDS.NEURAL_LAB]: null,
};

/**
 * Normalize legacy / URL area ids to current registry ids.
 * @param {string|null|undefined} areaId
 * @returns {WikiAreaId|null}
 */
export function normalizeWikiAreaFilter(areaId) {
    if (!areaId) return WIKI_AREA_IDS.CODEX;
    if (areaId === "glossary" || areaId === "network") {
        return areaId === "network" ? WIKI_AREA_IDS.NEURAL_LAB : WIKI_AREA_IDS.CODEX;
    }
    return areaId;
}

/**
 * Lookup helper — returns the WikiAreaMeta for a given id, or Chronicle as fallback.
 * @param {WikiAreaId} id
 * @returns {WikiAreaMeta}
 */
export function getWikiArea(id) {
    return WIKI_AREAS.find((a) => a.id === id) ?? WIKI_AREAS[0];
}

/**
 * Filter an entity array by wiki area.
 * If areaId is null/undefined or maps to null types, returns entities unchanged.
 * @param {object[]} entities
 * @param {WikiAreaId|null} areaId
 * @returns {object[]}
 */
export function filterEntitiesByWikiArea(entities, areaId) {
    const normalized = normalizeWikiAreaFilter(areaId);
    if (!normalized) return entities;
    const types = WIKI_AREA_ENTITY_TYPES[normalized];
    if (!types) return entities;
    return entities.filter((e) => types.includes(e.entityType));
}

/**
 * @param {string} entityType
 * @returns {WikiAreaId}
 */
export function getWikiAreaForEntityType(entityType) {
    if (!entityType) return WIKI_AREA_IDS.LORE;
    for (const [areaId, types] of Object.entries(WIKI_AREA_ENTITY_TYPES)) {
        if (types?.includes(entityType)) return areaId;
    }
    return WIKI_AREA_IDS.LORE;
}
