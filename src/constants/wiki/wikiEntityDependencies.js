/**
 * Grafo de dependencias del archivo narrativo y órdenes recomendados para UI.
 * Fuente única: selects de tipo de ficha, hint de creación, jerarquía de locación.
 */

import {
    WIKI_ENTITY_TYPES,
    WIKI_ENTITY_TYPE_LABELS,
    WIKI_ENTITY_CREATION_ORDER,
} from "../wikiEntityTypes";
import { LOCATION_KIND, LOCATION_KIND_ORDER } from "./entityFieldSchemas";

/* ------------------------------------------------------------------ */
/* Orden de creación de tipos de ficha (de menos a más dependientes)   */
/* ------------------------------------------------------------------ */

/**
 * @typedef {{ entityType: string, order: number, label: string, note: string, dependsOn?: string[] }} WikiCreationStep
 */

export { WIKI_ENTITY_CREATION_ORDER };

export const WIKI_CREATION_ORDER_STEPS = [
    {
        entityType: WIKI_ENTITY_TYPES.IDIOMA,
        dependsOn: [],
        note: "Sin dependencias. Idiomas nativos (especie) e idioma predominante (locación) parten de aquí.",
    },
    {
        entityType: WIKI_ENTITY_TYPES.IDEOLOGIA,
        dependsOn: [WIKI_ENTITY_TYPES.IDIOMA],
        note: "Puede enlazar idioma litúrgico. La figura principal (personaje) puede añadirse después.",
    },
    {
        entityType: WIKI_ENTITY_TYPES.LOCACION,
        dependsOn: [WIKI_ENTITY_TYPES.IDIOMA, WIKI_ENTITY_TYPES.IDEOLOGIA],
        note: "Crear de macro a micro (plano → país → región → ciudad). Dominantes (especie/ideología/idioma): opcional al inicio; completar tras crear especies.",
        subOrder: "Plano → País → Región → Ciudad → Edificio / mazmorra / punto de interés",
    },
    {
        entityType: WIKI_ENTITY_TYPES.ESPECIE,
        dependsOn: [WIKI_ENTITY_TYPES.IDIOMA, WIKI_ENTITY_TYPES.LOCACION],
        note: "Idiomas nativos + mundo de origen (locación). Luego vuelve a las locaciones para especie dominante.",
    },
    {
        entityType: WIKI_ENTITY_TYPES.ORGANIZACION,
        dependsOn: [WIKI_ENTITY_TYPES.LOCACION],
        note: "Sede en locación. Integrantes (personaje o token VTT) se añaden después de crear personajes.",
    },
    {
        entityType: WIKI_ENTITY_TYPES.PERSONAJE,
        dependsOn: [
            WIKI_ENTITY_TYPES.ESPECIE,
            WIKI_ENTITY_TYPES.LOCACION,
            WIKI_ENTITY_TYPES.ORGANIZACION,
        ],
        note: "Especie, lugares de nacimiento/muerte y organizaciones (opcionales).",
    },
    {
        entityType: WIKI_ENTITY_TYPES.RELIQUIA,
        dependsOn: [WIKI_ENTITY_TYPES.PERSONAJE, WIKI_ENTITY_TYPES.LOCACION],
        note: "Creador, portador (personaje) y origen (locación).",
    },
    {
        entityType: WIKI_ENTITY_TYPES.EVENTO_HISTORICO,
        dependsOn: [
            WIKI_ENTITY_TYPES.LOCACION,
            WIKI_ENTITY_TYPES.PERSONAJE,
            WIKI_ENTITY_TYPES.ORGANIZACION,
        ],
        note: "Cierra el arco temporal; enlaza actores y lugares ya definidos.",
    },
];

/** Referencias entre fichas por namespace `customFields` (y vínculos VTT). */
export const WIKI_ENTITY_FIELD_DEPENDENCIES = {
    [WIKI_ENTITY_TYPES.IDIOMA]: { refs: [], referencedBy: ["especie", "ideologia", "locacion"] },
    [WIKI_ENTITY_TYPES.IDEOLOGIA]: {
        refs: [
            { field: "holyLanguageEntityId", target: WIKI_ENTITY_TYPES.IDIOMA },
            { field: "primaryDeityFigureEntityId", target: WIKI_ENTITY_TYPES.PERSONAJE, optional: true },
        ],
        referencedBy: ["locacion"],
    },
    [WIKI_ENTITY_TYPES.LOCACION]: {
        refs: [
            { field: "parentLocationEntityId", target: WIKI_ENTITY_TYPES.LOCACION, note: "Padre más amplio (macro → micro)" },
            { field: "dominantLanguageEntityId", target: WIKI_ENTITY_TYPES.IDIOMA, optional: true },
            { field: "dominantIdeologyEntityId", target: WIKI_ENTITY_TYPES.IDEOLOGIA, optional: true },
            { field: "dominantSpeciesEntityId", target: WIKI_ENTITY_TYPES.ESPECIE, optional: true },
            { field: "linkedVttLocationId", target: "vtt:locations", optional: true },
        ],
        referencedBy: ["locacion", "especie", "organizacion", "personaje", "reliquia", "evento_historico"],
    },
    [WIKI_ENTITY_TYPES.ESPECIE]: {
        refs: [
            { field: "homeworldEntityId", target: WIKI_ENTITY_TYPES.LOCACION, optional: true },
            { field: "languageEntityIds", target: WIKI_ENTITY_TYPES.IDIOMA, optional: true },
        ],
        referencedBy: ["locacion", "personaje"],
    },
    [WIKI_ENTITY_TYPES.ORGANIZACION]: {
        refs: [
            { field: "headquartersEntityId", target: WIKI_ENTITY_TYPES.LOCACION, optional: true },
            { field: "members", target: "personaje|vtt", optional: true },
        ],
        referencedBy: ["personaje"],
    },
    [WIKI_ENTITY_TYPES.PERSONAJE]: {
        refs: [
            { field: "speciesEntityId", target: WIKI_ENTITY_TYPES.ESPECIE, optional: true },
            { field: "birthPlaceEntityId", target: WIKI_ENTITY_TYPES.LOCACION, optional: true },
            { field: "deathPlaceEntityId", target: WIKI_ENTITY_TYPES.LOCACION, optional: true },
            { field: "organizations", target: WIKI_ENTITY_TYPES.ORGANIZACION, optional: true },
            { field: "linkedVttCharacterId", target: "vtt:characters", optional: true },
        ],
        referencedBy: ["ideologia", "reliquia", "organizacion"],
    },
    [WIKI_ENTITY_TYPES.RELIQUIA]: {
        refs: [
            { field: "creatorEntityId", target: WIKI_ENTITY_TYPES.PERSONAJE, optional: true },
            { field: "currentHolderEntityId", target: WIKI_ENTITY_TYPES.PERSONAJE, optional: true },
            { field: "originLocationEntityId", target: WIKI_ENTITY_TYPES.LOCACION, optional: true },
        ],
        referencedBy: [],
    },
    [WIKI_ENTITY_TYPES.EVENTO_HISTORICO]: {
        refs: [{ field: "timeline.*", target: "varios", optional: true }],
        referencedBy: [],
    },
};

export function getWikiCreationOrderChain() {
    return WIKI_CREATION_ORDER_STEPS.map((step, i) => ({
        ...step,
        index: i + 1,
        label: WIKI_ENTITY_TYPE_LABELS[step.entityType] || step.entityType,
    }));
}

/* ------------------------------------------------------------------ */
/* Jerarquía de locación (macro → micro)                               */
/* ------------------------------------------------------------------ */

/** Menor = más amplio (plano/país); mayor = más concreto (edificio). */
export const LOCATION_KIND_RANK = {
    [LOCATION_KIND.PLANO]: 0,
    [LOCATION_KIND.PAIS]: 1,
    [LOCATION_KIND.REGION]: 2,
    [LOCATION_KIND.CIUDAD]: 3,
    [LOCATION_KIND.PUNTO_INTERES]: 4,
    [LOCATION_KIND.EDIFICIO]: 5,
    [LOCATION_KIND.DUNGEON]: 5,
};

export { LOCATION_KIND_ORDER };

/**
 * Padres válidos: solo locaciones más amplias que el hijo.
 * @param {object[]} entities — wikiEntities
 * @param {string} [childLocationKind]
 * @param {string} [excludeEntityId] — no listar la ficha que se edita
 */
export function filterParentLocationCandidates(entities, childLocationKind, excludeEntityId) {
    const childRank =
        childLocationKind != null && childLocationKind in LOCATION_KIND_RANK
            ? LOCATION_KIND_RANK[childLocationKind]
            : 99;

    return entities.filter((e) => {
        if (e.entityType !== WIKI_ENTITY_TYPES.LOCACION || e.id === excludeEntityId) return false;
        const parentKind = e.customFields?.locacion?.locationKind;
        if (!parentKind) return true;
        const parentRank = LOCATION_KIND_RANK[parentKind] ?? 0;
        return parentRank < childRank;
    });
}
