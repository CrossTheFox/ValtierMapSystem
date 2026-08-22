import { WIKI_ENTITY_TYPES as T } from "./wikiEntityTypes.js";

/**
 * Tipos de relación entre entidades wiki.
 * La matriz `WIKI_RELATION_PAIR_MATRIX` define qué tipos son válidos por par origen→destino.
 * Ver `src/constants/wiki/wiki-relaciones-por-entidad.md`.
 */
export const WIKI_RELATION_TYPES = {
  ALIADO_DE: "aliado_de",
  ENEMIGO_DE: "enemigo_de",
  MIEMBRO_DE: "miembro_de",
  MIEMBRO_CONFIRMADO_DE: "miembro_confirmado_de",
  MIEMBRO_SOSPECHADO_DE: "miembro_sospechado_de",
  SEDE_EN: "sede_en",
  VIVE_EN: "vive_en",
  PERTENECIENTE_A: "perteneciente_a",
  CONTROLA: "controla",
  RELACIONADO_CON: "relacionado_con",
  ORIGEN_DE: "origen_de",
  OCURRIO_EN: "ocurrio_en",
  PARTICIPO_EN: "participo_en",
  DESENCADENO: "desencadeno",
  SUCESOR_DE: "sucesor_de",
  DESCENDIENTE_DE: "descendiente_de",
  COLINDA_CON: "colinda_con",
  HABITA_EN: "habita_en",
  PROFESA: "profesa",
  HABLA: "habla",
  VENERA: "venera",
  FUNDO: "fundo",
  CUSTODIA: "custodia",
  BUSCA: "busca",
  ES_BUSCADO_EN: "es_buscado_en",
  DOCUMENTA: "documenta",
  OTRO: "otro",
};

export const WIKI_RELATION_TYPE_LABELS = {
  [WIKI_RELATION_TYPES.ALIADO_DE]: "Aliado de",
  [WIKI_RELATION_TYPES.ENEMIGO_DE]: "Enemigo de",
  [WIKI_RELATION_TYPES.MIEMBRO_DE]: "Miembro de",
  [WIKI_RELATION_TYPES.MIEMBRO_CONFIRMADO_DE]: "Miembro confirmado de",
  [WIKI_RELATION_TYPES.MIEMBRO_SOSPECHADO_DE]: "Se sospecha que es miembro de",
  [WIKI_RELATION_TYPES.SEDE_EN]: "Sede en",
  [WIKI_RELATION_TYPES.VIVE_EN]: "Vive en",
  [WIKI_RELATION_TYPES.PERTENECIENTE_A]: "Perteneciente a",
  [WIKI_RELATION_TYPES.CONTROLA]: "Controla",
  [WIKI_RELATION_TYPES.RELACIONADO_CON]: "Relacionado con",
  [WIKI_RELATION_TYPES.ORIGEN_DE]: "Origen de",
  [WIKI_RELATION_TYPES.OCURRIO_EN]: "Ocurrió en",
  [WIKI_RELATION_TYPES.PARTICIPO_EN]: "Participó en",
  [WIKI_RELATION_TYPES.DESENCADENO]: "Desencadenó",
  [WIKI_RELATION_TYPES.SUCESOR_DE]: "Sucesor de",
  [WIKI_RELATION_TYPES.DESCENDIENTE_DE]: "Descendiente de",
  [WIKI_RELATION_TYPES.COLINDA_CON]: "Colinda con",
  [WIKI_RELATION_TYPES.HABITA_EN]: "Habita en",
  [WIKI_RELATION_TYPES.PROFESA]: "Profesa",
  [WIKI_RELATION_TYPES.HABLA]: "Habla",
  [WIKI_RELATION_TYPES.VENERA]: "Venera",
  [WIKI_RELATION_TYPES.FUNDO]: "Fundó",
  [WIKI_RELATION_TYPES.CUSTODIA]: "Custodia",
  [WIKI_RELATION_TYPES.BUSCA]: "Busca",
  [WIKI_RELATION_TYPES.ES_BUSCADO_EN]: "Es buscado en",
  [WIKI_RELATION_TYPES.DOCUMENTA]: "Documenta",
  [WIKI_RELATION_TYPES.OTRO]: "Otro",
};

/** Solo tipos definidos en `WIKI_RELATION_TYPES` (descarta valores legacy en Firestore). */
export const KNOWN_WIKI_RELATION_TYPE_VALUES = new Set(Object.values(WIKI_RELATION_TYPES));

export const WIKI_RELATION_TYPE_OPTIONS = Object.values(WIKI_RELATION_TYPES).map((value) => ({
  value,
  label: WIKI_RELATION_TYPE_LABELS[value],
}));

/** @param {string} relationType */
export function isKnownRelationType(relationType) {
  return KNOWN_WIKI_RELATION_TYPE_VALUES.has(relationType);
}

function foldRelationTypeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * Convierte salidas del LLM (etiquetas ES o snake_case) al identificador canónico.
 * @param {string} raw
 * @returns {string|null}
 */
export function normalizeRelationType(raw) {
  if (!raw || typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (KNOWN_WIKI_RELATION_TYPE_VALUES.has(trimmed)) return trimmed;

  const folded = foldRelationTypeText(trimmed);
  if (KNOWN_WIKI_RELATION_TYPE_VALUES.has(folded)) return folded;

  for (const [value, label] of Object.entries(WIKI_RELATION_TYPE_LABELS)) {
    if (foldRelationTypeText(label) === folded) return value;
  }

  const slug = folded.replace(/[\s-]+/g, "_");
  if (KNOWN_WIKI_RELATION_TYPE_VALUES.has(slug)) return slug;

  return null;
}

/** Lista CSV de identificadores snake_case para prompts de IA. */
export function getAiRelationTypeList() {
  return Object.values(WIKI_RELATION_TYPES).join(", ");
}

export const WIKI_RELATION_STRENGTH_MIN = -10;
export const WIKI_RELATION_STRENGTH_MAX = 10;

/** Affinity (Sync Meter / strengthDelta) vs structural (hecho plano, strength=0). */
export const WIKI_RELATION_KIND = {
  AFFINITY: "affinity",
  STRUCTURAL: "structural",
};

/**
 * Entity types that never carry affinity (edges touching them are structural).
 * Dossier NAR Sync Meter excludes these as create targets.
 */
export const WIKI_STRUCTURAL_ENDPOINT_TYPES = new Set([
  T.IDIOMA,
  T.EVENTO_HISTORICO,
  T.CRONICA,
  T.ESPECIE,
  T.RELIQUIA,
  T.GLOSARIO,
]);

/** Entity types allowed as Sync Meter / Dossier creator targets. */
export const WIKI_AFFINITY_DOSSIER_TARGET_TYPES = new Set([
  T.PERSONAJE,
  T.ORGANIZACION,
  T.LOCACION,
  T.IDEOLOGIA,
]);

/**
 * Relation types that are always structural (no Sync Meter), regardless of endpoints.
 * AI must not propose `habla` / idioma changes.
 */
export const WIKI_ALWAYS_STRUCTURAL_RELATION_TYPES = new Set([
  WIKI_RELATION_TYPES.HABLA,
  WIKI_RELATION_TYPES.DOCUMENTA,
  WIKI_RELATION_TYPES.PARTICIPO_EN,
  WIKI_RELATION_TYPES.OCURRIO_EN,
  WIKI_RELATION_TYPES.COLINDA_CON,
  WIKI_RELATION_TYPES.PERTENECIENTE_A,
  WIKI_RELATION_TYPES.ORIGEN_DE,
  WIKI_RELATION_TYPES.DESENCADENO,
  WIKI_RELATION_TYPES.CUSTODIA,
  WIKI_RELATION_TYPES.HABITA_EN,
]);

export const WIKI_RELATION_DEFAULT_STRENGTH = {
  [WIKI_RELATION_TYPES.ALIADO_DE]: 7,
  [WIKI_RELATION_TYPES.ENEMIGO_DE]: -8,
  [WIKI_RELATION_TYPES.MIEMBRO_DE]: 5,
  [WIKI_RELATION_TYPES.MIEMBRO_CONFIRMADO_DE]: 5,
  [WIKI_RELATION_TYPES.MIEMBRO_SOSPECHADO_DE]: 1,
  [WIKI_RELATION_TYPES.SEDE_EN]: 0,
  [WIKI_RELATION_TYPES.VIVE_EN]: 0,
  [WIKI_RELATION_TYPES.PERTENECIENTE_A]: 0,
  [WIKI_RELATION_TYPES.CONTROLA]: 6,
  [WIKI_RELATION_TYPES.RELACIONADO_CON]: 0,
  [WIKI_RELATION_TYPES.ORIGEN_DE]: 0,
  [WIKI_RELATION_TYPES.OCURRIO_EN]: 0,
  [WIKI_RELATION_TYPES.PARTICIPO_EN]: 0,
  [WIKI_RELATION_TYPES.DESENCADENO]: 0,
  [WIKI_RELATION_TYPES.SUCESOR_DE]: 0,
  [WIKI_RELATION_TYPES.DESCENDIENTE_DE]: 0,
  [WIKI_RELATION_TYPES.COLINDA_CON]: 0,
  [WIKI_RELATION_TYPES.HABITA_EN]: 0,
  [WIKI_RELATION_TYPES.PROFESA]: 5,
  [WIKI_RELATION_TYPES.HABLA]: 0,
  [WIKI_RELATION_TYPES.VENERA]: 6,
  [WIKI_RELATION_TYPES.FUNDO]: 0,
  [WIKI_RELATION_TYPES.CUSTODIA]: 0,
  [WIKI_RELATION_TYPES.BUSCA]: 3,
  [WIKI_RELATION_TYPES.ES_BUSCADO_EN]: 2,
  [WIKI_RELATION_TYPES.DOCUMENTA]: 0,
  [WIKI_RELATION_TYPES.OTRO]: 0,
};

const R = WIKI_RELATION_TYPES;

/** @param {string} fromType @param {string} toType */
function pairKey(fromType, toType) {
  return `${fromType}::${toType}`;
}

/**
 * Classify an edge as affinity (valued Sync Meter) or structural (fact, strength=0).
 * @param {{ relationType?: string, fromEntityType?: string|null, toEntityType?: string|null }} args
 * @returns {'affinity'|'structural'}
 */
export function getRelationKind({ relationType, fromEntityType = null, toEntityType = null } = {}) {
  const type = relationType || "";
  if (WIKI_ALWAYS_STRUCTURAL_RELATION_TYPES.has(type)) {
    return WIKI_RELATION_KIND.STRUCTURAL;
  }
  if (
    (fromEntityType && WIKI_STRUCTURAL_ENDPOINT_TYPES.has(fromEntityType))
    || (toEntityType && WIKI_STRUCTURAL_ENDPOINT_TYPES.has(toEntityType))
  ) {
    return WIKI_RELATION_KIND.STRUCTURAL;
  }
  return WIKI_RELATION_KIND.AFFINITY;
}

/** @param {{ relationType?: string, fromEntityType?: string|null, toEntityType?: string|null }} args */
export function isStructuralRelation(args) {
  return getRelationKind(args) === WIKI_RELATION_KIND.STRUCTURAL;
}

/** @param {{ relationType?: string, fromEntityType?: string|null, toEntityType?: string|null }} args */
export function isAffinityRelation(args) {
  return getRelationKind(args) === WIKI_RELATION_KIND.AFFINITY;
}

/** Clamp −10…+10; structural edges always resolve to 0. */
export function resolveRelationStrength({
  relationType,
  fromEntityType = null,
  toEntityType = null,
  strength,
} = {}) {
  if (isStructuralRelation({ relationType, fromEntityType, toEntityType })) return 0;
  const n = Number(strength);
  if (Number.isNaN(n)) return 0;
  return Math.max(
    WIKI_RELATION_STRENGTH_MIN,
    Math.min(WIKI_RELATION_STRENGTH_MAX, Math.round(n))
  );
}

/**
 * Default strength for create UI / AI — 0 when structural.
 * @param {string} relationType
 * @param {string|null} [fromEntityType]
 * @param {string|null} [toEntityType]
 */
export function defaultStrengthForRelation(relationType, fromEntityType = null, toEntityType = null) {
  if (isStructuralRelation({ relationType, fromEntityType, toEntityType })) return 0;
  return WIKI_RELATION_DEFAULT_STRENGTH[relationType] ?? 0;
}

/** @param {string} entityType */
export function isAffinityDossierTargetType(entityType) {
  return WIKI_AFFINITY_DOSSIER_TARGET_TYPES.has(entityType);
}

/** @param {string} entityType */
export function isStructuralDossierTargetType(entityType) {
  return WIKI_STRUCTURAL_ENDPOINT_TYPES.has(entityType);
}

/**
 * Relation type options for Dossier NAR (affinity only).
 * @param {object} fromEntity
 * @param {object} toEntity
 */
export function getAffinityRelationTypeOptionsForContext(fromEntity, toEntity) {
  return getRelationTypeOptionsForContext(fromEntity, toEntity).filter((opt) =>
    isAffinityRelation({
      relationType: opt.value,
      fromEntityType: fromEntity?.entityType,
      toEntityType: toEntity?.entityType,
    })
  );
}

/**
 * Destinations allowed in Dossier creator (affinity targets with ≥1 affinity type).
 * @param {object} fromEntity
 * @param {object[]} entities
 */
export function filterAffinityRelatableEntities(fromEntity, entities = []) {
  if (!fromEntity?.entityType) return [];
  return entities.filter((candidate) => {
    if (!candidate || candidate.id === fromEntity.id) return false;
    if (!isAffinityDossierTargetType(candidate.entityType)) return false;
    return getAffinityRelationTypeOptionsForContext(fromEntity, candidate).length > 0;
  });
}

/**
 * Relation type options that resolve as structural (hecho, strength=0).
 * @param {object} fromEntity
 * @param {object} toEntity
 */
export function getStructuralRelationTypeOptionsForContext(fromEntity, toEntity) {
  return getRelationTypeOptionsForContext(fromEntity, toEntity).filter((opt) =>
    isStructuralRelation({
      relationType: opt.value,
      fromEntityType: fromEntity?.entityType,
      toEntityType: toEntity?.entityType,
    })
  );
}

/**
 * Destinations for Dossier HECHOS (structural endpoints only: idioma, evento…).
 * Orgs / lugares / personajes / ideologías van en RELACIONES (afinidad).
 * @param {object} fromEntity
 * @param {object[]} entities
 */
export function filterStructuralRelatableEntities(fromEntity, entities = []) {
  if (!fromEntity?.entityType) return [];
  return entities.filter((candidate) => {
    if (!candidate || candidate.id === fromEntity.id) return false;
    if (!isStructuralDossierTargetType(candidate.entityType)) return false;
    return getStructuralRelationTypeOptionsForContext(fromEntity, candidate).length > 0;
  });
}

/**
 * Tipos permitidos por par semántico (origen lógico → destino).
 * Locaciones: solo pasivas (no inician alianzas, búsquedas ni membresías).
 * Idioma: sin relaciones sociales.
 * Crónica: solo `documenta` saliente.
 */
const WIKI_RELATION_PAIR_MATRIX = {
  [`${T.PERSONAJE}::${T.PERSONAJE}`]: [
    R.ALIADO_DE, R.ENEMIGO_DE, R.SUCESOR_DE, R.DESCENDIENTE_DE, R.BUSCA, R.VENERA,
    R.DESENCADENO, R.RELACIONADO_CON, R.OTRO,
  ],
  [`${T.PERSONAJE}::${T.LOCACION}`]: [
    R.VIVE_EN, R.ES_BUSCADO_EN, R.CONTROLA, R.FUNDO, R.RELACIONADO_CON, R.OTRO,
  ],
  [`${T.PERSONAJE}::${T.ORGANIZACION}`]: [
    R.MIEMBRO_CONFIRMADO_DE, R.MIEMBRO_SOSPECHADO_DE, R.MIEMBRO_DE,
    R.RELACIONADO_CON, R.OTRO,
  ],
  [`${T.PERSONAJE}::${T.EVENTO_HISTORICO}`]: [
    R.PARTICIPO_EN, R.DESENCADENO, R.RELACIONADO_CON, R.OTRO,
  ],
  [`${T.PERSONAJE}::${T.RELIQUIA}`]: [R.BUSCA, R.RELACIONADO_CON, R.OTRO],
  [`${T.PERSONAJE}::${T.IDEOLOGIA}`]: [R.PROFESA, R.ENEMIGO_DE, R.RELACIONADO_CON, R.OTRO],
  [`${T.PERSONAJE}::${T.IDIOMA}`]: [R.HABLA, R.RELACIONADO_CON, R.OTRO],
  [`${T.PERSONAJE}::${T.ESPECIE}`]: [R.RELACIONADO_CON, R.OTRO],
  [`${T.PERSONAJE}::${T.CRONICA}`]: [R.OTRO],

  [`${T.ORGANIZACION}::${T.PERSONAJE}`]: [R.BUSCA, R.RELACIONADO_CON, R.OTRO],
  [`${T.ORGANIZACION}::${T.LOCACION}`]: [
    R.SEDE_EN, R.CONTROLA, R.FUNDO, R.RELACIONADO_CON, R.OTRO,
  ],
  [`${T.ORGANIZACION}::${T.ORGANIZACION}`]: [
    R.ALIADO_DE, R.ENEMIGO_DE, R.CONTROLA, R.SUCESOR_DE, R.FUNDO,
    R.RELACIONADO_CON, R.OTRO,
  ],
  [`${T.ORGANIZACION}::${T.EVENTO_HISTORICO}`]: [
    R.PARTICIPO_EN, R.DESENCADENO, R.RELACIONADO_CON, R.OTRO,
  ],
  [`${T.ORGANIZACION}::${T.RELIQUIA}`]: [R.BUSCA, R.CUSTODIA, R.RELACIONADO_CON, R.OTRO],
  [`${T.ORGANIZACION}::${T.IDEOLOGIA}`]: [
    R.PROFESA, R.ALIADO_DE, R.ENEMIGO_DE, R.RELACIONADO_CON, R.OTRO,
  ],
  [`${T.ORGANIZACION}::${T.IDIOMA}`]: [R.RELACIONADO_CON, R.OTRO],
  [`${T.ORGANIZACION}::${T.ESPECIE}`]: [R.RELACIONADO_CON, R.OTRO],
  [`${T.ORGANIZACION}::${T.CRONICA}`]: [],

  // Social affinity between places (cultural enmity / alliance) + geographic structure
  [`${T.LOCACION}::${T.LOCACION}`]: [
    R.PERTENECIENTE_A, R.COLINDA_CON, R.ALIADO_DE, R.ENEMIGO_DE, R.RELACIONADO_CON, R.OTRO,
  ],
  [`${T.LOCACION}::${T.PERSONAJE}`]: [R.VIVE_EN],
  [`${T.LOCACION}::${T.ORGANIZACION}`]: [R.SEDE_EN],
  [`${T.LOCACION}::${T.RELIQUIA}`]: [R.CUSTODIA, R.RELACIONADO_CON, R.OTRO],
  [`${T.LOCACION}::${T.IDEOLOGIA}`]: [R.RELACIONADO_CON, R.OTRO],
  [`${T.LOCACION}::${T.IDIOMA}`]: [R.RELACIONADO_CON, R.OTRO],
  [`${T.LOCACION}::${T.ESPECIE}`]: [R.RELACIONADO_CON, R.OTRO],
  [`${T.LOCACION}::${T.EVENTO_HISTORICO}`]: [],
  [`${T.LOCACION}::${T.CRONICA}`]: [],

  [`${T.EVENTO_HISTORICO}::${T.LOCACION}`]: [R.OCURRIO_EN, R.RELACIONADO_CON, R.OTRO],
  [`${T.EVENTO_HISTORICO}::${T.PERSONAJE}`]: [R.PARTICIPO_EN, R.RELACIONADO_CON, R.OTRO],
  [`${T.EVENTO_HISTORICO}::${T.ORGANIZACION}`]: [R.PARTICIPO_EN, R.RELACIONADO_CON, R.OTRO],
  [`${T.EVENTO_HISTORICO}::${T.EVENTO_HISTORICO}`]: [R.DESENCADENO, R.RELACIONADO_CON, R.OTRO],
  [`${T.EVENTO_HISTORICO}::${T.RELIQUIA}`]: [R.ORIGEN_DE, R.RELACIONADO_CON, R.OTRO],
  [`${T.EVENTO_HISTORICO}::${T.IDEOLOGIA}`]: [R.ORIGEN_DE, R.RELACIONADO_CON, R.OTRO],
  [`${T.EVENTO_HISTORICO}::${T.ESPECIE}`]: [R.RELACIONADO_CON, R.OTRO],
  [`${T.EVENTO_HISTORICO}::${T.IDIOMA}`]: [R.RELACIONADO_CON, R.OTRO],
  [`${T.EVENTO_HISTORICO}::${T.CRONICA}`]: [R.RELACIONADO_CON, R.OTRO],

  [`${T.RELIQUIA}::${T.LOCACION}`]: [R.ORIGEN_DE, R.RELACIONADO_CON, R.OTRO],
  [`${T.RELIQUIA}::${T.PERSONAJE}`]: [R.RELACIONADO_CON, R.OTRO],
  [`${T.RELIQUIA}::${T.ORGANIZACION}`]: [R.RELACIONADO_CON, R.OTRO],
  [`${T.RELIQUIA}::${T.EVENTO_HISTORICO}`]: [R.RELACIONADO_CON, R.OTRO],
  [`${T.RELIQUIA}::${T.RELIQUIA}`]: [R.RELACIONADO_CON, R.OTRO],
  [`${T.RELIQUIA}::${T.IDEOLOGIA}`]: [R.RELACIONADO_CON, R.OTRO],
  [`${T.RELIQUIA}::${T.IDIOMA}`]: [R.RELACIONADO_CON, R.OTRO],
  [`${T.RELIQUIA}::${T.ESPECIE}`]: [R.ORIGEN_DE, R.RELACIONADO_CON, R.OTRO],
  [`${T.RELIQUIA}::${T.CRONICA}`]: [R.OTRO],

  [`${T.IDEOLOGIA}::${T.IDEOLOGIA}`]: [R.ALIADO_DE, R.ENEMIGO_DE, R.RELACIONADO_CON, R.OTRO],
  [`${T.IDEOLOGIA}::${T.PERSONAJE}`]: [R.RELACIONADO_CON, R.OTRO],
  [`${T.IDEOLOGIA}::${T.ORGANIZACION}`]: [R.RELACIONADO_CON, R.OTRO],
  [`${T.IDEOLOGIA}::${T.LOCACION}`]: [R.RELACIONADO_CON, R.OTRO],
  [`${T.IDEOLOGIA}::${T.EVENTO_HISTORICO}`]: [R.RELACIONADO_CON, R.OTRO],
  [`${T.IDEOLOGIA}::${T.RELIQUIA}`]: [R.RELACIONADO_CON, R.OTRO],
  [`${T.IDEOLOGIA}::${T.ESPECIE}`]: [R.RELACIONADO_CON, R.OTRO],
  [`${T.IDEOLOGIA}::${T.IDIOMA}`]: [R.RELACIONADO_CON, R.OTRO],
  [`${T.IDEOLOGIA}::${T.CRONICA}`]: [],

  [`${T.ESPECIE}::${T.ESPECIE}`]: [
    R.ALIADO_DE, R.ENEMIGO_DE, R.DESCENDIENTE_DE, R.RELACIONADO_CON, R.OTRO,
  ],
  [`${T.ESPECIE}::${T.LOCACION}`]: [R.HABITA_EN, R.ORIGEN_DE, R.RELACIONADO_CON, R.OTRO],
  [`${T.ESPECIE}::${T.IDIOMA}`]: [R.RELACIONADO_CON, R.OTRO],
  [`${T.ESPECIE}::${T.IDEOLOGIA}`]: [R.RELACIONADO_CON, R.OTRO],
  [`${T.ESPECIE}::${T.PERSONAJE}`]: [R.RELACIONADO_CON, R.OTRO],
  [`${T.ESPECIE}::${T.ORGANIZACION}`]: [R.RELACIONADO_CON, R.OTRO],
  [`${T.ESPECIE}::${T.EVENTO_HISTORICO}`]: [R.RELACIONADO_CON, R.OTRO],
  [`${T.ESPECIE}::${T.RELIQUIA}`]: [R.RELACIONADO_CON, R.OTRO],
  [`${T.ESPECIE}::${T.CRONICA}`]: [],

  [`${T.IDIOMA}::${T.IDIOMA}`]: [R.ORIGEN_DE, R.RELACIONADO_CON, R.OTRO],
  [`${T.IDIOMA}::${T.IDEOLOGIA}`]: [R.RELACIONADO_CON, R.OTRO],
  [`${T.IDIOMA}::${T.ESPECIE}`]: [R.RELACIONADO_CON, R.OTRO],
  [`${T.IDIOMA}::${T.LOCACION}`]: [R.RELACIONADO_CON, R.OTRO],
  [`${T.IDIOMA}::${T.ORGANIZACION}`]: [R.RELACIONADO_CON, R.OTRO],
  [`${T.IDIOMA}::${T.EVENTO_HISTORICO}`]: [R.RELACIONADO_CON, R.OTRO],
  [`${T.IDIOMA}::${T.RELIQUIA}`]: [R.RELACIONADO_CON, R.OTRO],
  [`${T.IDIOMA}::${T.PERSONAJE}`]: [],
  [`${T.IDIOMA}::${T.CRONICA}`]: [],

  [`${T.CRONICA}::${T.PERSONAJE}`]: [R.DOCUMENTA],
  [`${T.CRONICA}::${T.LOCACION}`]: [R.DOCUMENTA],
  [`${T.CRONICA}::${T.ORGANIZACION}`]: [R.DOCUMENTA],
  [`${T.CRONICA}::${T.EVENTO_HISTORICO}`]: [R.DOCUMENTA],
  [`${T.CRONICA}::${T.RELIQUIA}`]: [R.DOCUMENTA],
  [`${T.CRONICA}::${T.IDEOLOGIA}`]: [R.DOCUMENTA],
  [`${T.CRONICA}::${T.IDIOMA}`]: [R.DOCUMENTA],
  [`${T.CRONICA}::${T.ESPECIE}`]: [R.DOCUMENTA],
  [`${T.CRONICA}::${T.CRONICA}`]: [],
};

/** Pares donde el usuario puede elegir desde cualquier lado (UI invierte dirección). */
const BIDIRECTIONAL_UI_PAIRS = new Set([
  pairKey(T.PERSONAJE, T.LOCACION), // vive_en
  pairKey(T.LOCACION, T.LOCACION), // perteneciente_a, colinda_con
  pairKey(T.ORGANIZACION, T.LOCACION), // sede_en
  pairKey(T.EVENTO_HISTORICO, T.PERSONAJE), // participo_en
  pairKey(T.EVENTO_HISTORICO, T.ORGANIZACION),
]);

/**
 * @param {string} fromType
 * @param {string} toType
 * @returns {string[]}
 */
export function getAllowedRelationTypes(fromType, toType) {
  if (!fromType || !toType || fromType === toType && fromType === T.CRONICA) return [];
  return WIKI_RELATION_PAIR_MATRIX[pairKey(fromType, toType)] ?? [];
}

/**
 * Opciones al crear relación desde `fromEntity` hacia `toEntity`.
 * Incluye tipos del par directo y, si aplica, del par inverso (p. ej. locación→personaje → vive_en).
 */
export function getRelationTypeOptionsForContext(fromEntity, toEntity) {
  const fromType = fromEntity?.entityType;
  const toType = toEntity?.entityType;
  if (!fromType || !toType || fromEntity?.id === toEntity?.id) return [];

  const direct = getAllowedRelationTypes(fromType, toType);
  const reverse = getAllowedRelationTypes(toType, fromType);
  const merged = new Set(direct);

  if (BIDIRECTIONAL_UI_PAIRS.has(pairKey(fromType, toType))) {
    reverse.forEach((t) => merged.add(t));
  }
  if (BIDIRECTIONAL_UI_PAIRS.has(pairKey(toType, fromType))) {
    reverse.forEach((t) => merged.add(t));
  }

  return WIKI_RELATION_TYPE_OPTIONS.filter(({ value }) => merged.has(value));
}

/**
 * ¿Puede existir al menos una relación entre estas dos fichas?
 * @param {object|null} fromEntity
 * @param {object|null} toEntity
 */
export function canRelateEntities(fromEntity, toEntity) {
  return getRelationTypeOptionsForContext(fromEntity, toEntity).length > 0;
}

/**
 * Entidades destino con al menos un tipo de relación válido respecto a `fromEntity`.
 * @param {object} fromEntity
 * @param {object[]} entities
 */
export function filterRelatableEntities(fromEntity, entities = []) {
  if (!fromEntity?.entityType) return [];
  return entities.filter(
    (candidate) => candidate.id !== fromEntity.id && canRelateEntities(fromEntity, candidate)
  );
}

/**
 * Valida tipo + par antes de persistir (tras elegir en UI, antes de `resolveRelationEndpoints`).
 */
export function validateRelationCreate(fromEntity, toEntity, relationType) {
  if (!fromEntity?.entityType || !toEntity?.entityType || !relationType) return false;
  if (!isKnownRelationType(relationType)) return false;
  const options = getRelationTypeOptionsForContext(fromEntity, toEntity);
  return options.some((o) => o.value === relationType);
}

export function defaultStrengthForRelationType(relationType) {
  return defaultStrengthForRelation(relationType);
}

const INCOMING_LABELS = {
  [R.VIVE_EN]: "Residente",
  [R.PERTENECIENTE_A]: "Sub-ubicación de",
  [R.SEDE_EN]: "Sede de",
  [R.OCURRIO_EN]: "Escenario de",
  [R.BUSCA]: "Buscado por",
  [R.PARTICIPO_EN]: "Participante en",
  [R.ES_BUSCADO_EN]: "Buscan aquí a",
  [R.DOCUMENTA]: "Documentado en",
  [R.CUSTODIA]: "Custodiado en",
  [R.HABITA_EN]: "Habitada por",
  [R.ORIGEN_DE]: "Procede de",
  [R.FUNDO]: "Fundado por",
  [R.CONTROLA]: "Controlado por",
  [R.PROFESA]: "Seguidor de",
  [R.VENERA]: "Venerado por",
  [R.DESENCADENO]: "Desencadenado por",
  [R.SUCESOR_DE]: "Predecesor de",
  [R.DESCENDIENTE_DE]: "Ancestro de",
};

/** Etiqueta según dirección de visualización en el panel. */
export function getRelationDisplayLabel(relationType, isOutgoing) {
  if (!isOutgoing && INCOMING_LABELS[relationType]) {
    return INCOMING_LABELS[relationType];
  }
  return WIKI_RELATION_TYPE_LABELS[relationType] || relationType;
}

/** Tipo sugerido al elegir destino en el editor. */
export function suggestRelationTypeForPair(fromEntity, toEntity) {
  const fromType = fromEntity?.entityType;
  const toType = toEntity?.entityType;
  const options = getRelationTypeOptionsForContext(fromEntity, toEntity);
  if (!options.length) return null;

  const preferred = [
    [T.PERSONAJE, T.LOCACION, R.VIVE_EN],
    [T.LOCACION, T.LOCACION, R.PERTENECIENTE_A],
    [T.ORGANIZACION, T.LOCACION, R.SEDE_EN],
    [T.PERSONAJE, T.ORGANIZACION, R.MIEMBRO_CONFIRMADO_DE],
    [T.PERSONAJE, T.EVENTO_HISTORICO, R.PARTICIPO_EN],
    [T.ORGANIZACION, T.EVENTO_HISTORICO, R.PARTICIPO_EN],
    [T.EVENTO_HISTORICO, T.LOCACION, R.OCURRIO_EN],
    [T.ESPECIE, T.LOCACION, R.HABITA_EN],
    [T.PERSONAJE, T.IDIOMA, R.HABLA],
    [T.PERSONAJE, T.IDEOLOGIA, R.PROFESA],
    [T.ORGANIZACION, T.IDEOLOGIA, R.PROFESA],
    [T.CRONICA, null, R.DOCUMENTA],
    [T.PERSONAJE, T.LOCACION, R.ES_BUSCADO_EN],
    [T.ORGANIZACION, T.PERSONAJE, R.BUSCA],
    [T.ORGANIZACION, T.RELIQUIA, R.CUSTODIA],
  ];

  for (const [f, t, rel] of preferred) {
    const typeMatch = fromType === f && (t === null || toType === t);
    if (typeMatch && options.some((o) => o.value === rel)) {
      return rel;
    }
  }

  return options[0].value;
}

/**
 * Dirección canónica al persistir (independiente del orden en que el DM eligió las fichas).
 * @returns {{ fromEntityId: string, toEntityId: string }}
 */
export function resolveRelationEndpoints(fromEntity, toEntity, relationType) {
  const fromType = fromEntity?.entityType;
  const toType = toEntity?.entityType;

  const flip = () => ({ fromEntityId: toEntity.id, toEntityId: fromEntity.id });

  if (relationType === R.VIVE_EN && fromType === T.LOCACION && toType === T.PERSONAJE) {
    return flip();
  }
  if (relationType === R.PERTENECIENTE_A && fromType === T.LOCACION && toType === T.LOCACION) {
    return flip();
  }
  if (relationType === R.SEDE_EN && fromType === T.LOCACION && toType === T.ORGANIZACION) {
    return flip();
  }
  if (
    relationType === R.PARTICIPO_EN
    && fromType === T.EVENTO_HISTORICO
    && (toType === T.PERSONAJE || toType === T.ORGANIZACION)
  ) {
    return flip();
  }
  if (relationType === R.BUSCA) {
    const seeker = new Set([T.PERSONAJE, T.ORGANIZACION]);
    const target = new Set([T.PERSONAJE, T.RELIQUIA]);
    if (!(seeker.has(fromType) && target.has(toType)) && seeker.has(toType) && target.has(fromType)) {
      return flip();
    }
  }

  return { fromEntityId: fromEntity.id, toEntityId: toEntity.id };
}

/** @param {string} relationType @param {string} fromType @param {string} toType */
export function isRelationValid(relationType, fromType, toType) {
  if (!isKnownRelationType(relationType)) return false;
  const allowed = getAllowedRelationTypes(fromType, toType);
  if (allowed.includes(relationType)) return true;
  if (BIDIRECTIONAL_UI_PAIRS.has(pairKey(fromType, toType))) {
    return getAllowedRelationTypes(toType, fromType).includes(relationType);
  }
  return false;
}
