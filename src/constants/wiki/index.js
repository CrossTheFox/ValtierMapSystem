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
    SESSIONS: "sessions",
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
            "Archivo de mesa: personas (ficha VTT + nodo wiki) y lugares (artículo + pines en mapa), más orgs, especies, reliquias, idiomas e ideologías.",
        phase: "live",
    },
    {
        id: WIKI_AREA_IDS.TIMELINE,
        label: "TIMELINE",
        hint: "Hitos y arcos de la historia",
        description:
            "Línea temporal: eventos históricos y arcos narrativos definidos por el DM, ordenados en el tiempo. Útil para ver qué pasó antes de la campaña o en qué momento encaja un suceso.",
        phase: "live",
    },
        {
            id: WIKI_AREA_IDS.NEURAL_LAB,
            label: "NEURAL LAB",
            hint: "Circuito de relaciones + laboratorio IA (VTT)",
            description:
                "Superficie aparte del Archive: overview de todos los personajes en circuito Sync-Axis, foco al hacer click, y laboratorio de IA para el DJ.",
            phase: "live",
        },
    {
        id: WIKI_AREA_IDS.SESSIONS,
        label: "DIARIO",
        hint: "Bitácora de sesiones de la mesa",
        description:
            "Registra qué pasó en cada sesión. Los recaps alimentan el contexto del Lab IA para ideas más coherentes con la campaña.",
        phase: "live",
    },
];

/** Archive tab nav, in mock order. Chronicle is a codex ficha type, not a tab. */
export const WIKI_ARCHIVE_AREAS = [
    WIKI_AREA_IDS.CODEX,
    WIKI_AREA_IDS.TIMELINE,
    WIKI_AREA_IDS.SESSIONS,
    WIKI_AREA_IDS.NEURAL_LAB,
].map((id) => WIKI_AREAS.find((a) => a.id === id));

/** Intro shown when browsing the codex surface. */
export const WIKI_ARCHIVE_INTRO =
    "Archivo de la campaña. Una persona, una ficha; un lugar, un artículo y cero o más pines en el mapa. Busca y lee; @menciones enlazan otras fichas.";

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
    [WIKI_AREA_IDS.TIMELINE]: ["evento_historico", "era", "arco"],
    [WIKI_AREA_IDS.CODEX]: [
        "personaje",
        "locacion",
        "organizacion",
        "especie",
        "reliquia",
        "ideologia",
        "idioma",
        "glosario",
    ],
    [WIKI_AREA_IDS.NEURAL_LAB]: null,
    [WIKI_AREA_IDS.SESSIONS]: null,
};

/**
 * Normalize legacy / URL area ids to current registry ids.
 * @param {string|null|undefined} areaId
 * @returns {WikiAreaId|null}
 */
export function normalizeWikiAreaFilter(areaId) {
    if (!areaId) return WIKI_AREA_IDS.CODEX;
    if (areaId === "glossary") return WIKI_AREA_IDS.CODEX;
    if (areaId === "network" || areaId === WIKI_AREA_IDS.NEURAL_LAB) {
        return WIKI_AREA_IDS.NEURAL_LAB;
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

export {
    ARCHIVE_CASCADE_WRITES,
    linkedLocationIdsOf,
    locationLinkPatch,
    wikiEntityIdOfLocation,
    findWikiLocacionForPin,
    collectPinsForWikiLocation,
    findWikiPersonajeForCharacter,
} from "./archiveIdentity.js";
