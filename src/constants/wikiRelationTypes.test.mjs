import assert from "node:assert/strict";
import {
    getRelationTypeOptionsForContext,
    canRelateEntities,
    filterRelatableEntities,
    filterAffinityRelatableEntities,
    filterStructuralRelatableEntities,
    getAffinityRelationTypeOptionsForContext,
    getStructuralRelationTypeOptionsForContext,
    validateRelationCreate,
    isRelationValid,
    isKnownRelationType,
    normalizeRelationType,
    getRelationKind,
    isAffinityRelation,
    isStructuralRelation,
    resolveRelationStrength,
    defaultStrengthForRelation,
    WIKI_RELATION_TYPES,
    WIKI_RELATION_KIND,
} from "./wikiRelationTypes.js";

const idioma = { id: "l1", entityType: "idioma", title: "Arvek" };
const ideologia = { id: "i1", entityType: "ideologia", title: "Culto" };
const personaje = { id: "p1", entityType: "personaje", title: "Kael" };
const org = { id: "o1", entityType: "organizacion", title: "Guardia" };
const loc = { id: "x1", entityType: "locacion", title: "Puerto" };
const evento = { id: "e1", entityType: "evento_historico", title: "Masacre" };
const reliquia = { id: "r1", entityType: "reliquia", title: "Espada" };

// Idioma: sin relaciones sociales
const idiomaToIdeologia = getRelationTypeOptionsForContext(idioma, ideologia).map((o) => o.value);
assert.deepEqual(idiomaToIdeologia, ["relacionado_con", "otro"]);
assert.ok(!idiomaToIdeologia.includes(WIKI_RELATION_TYPES.ENEMIGO_DE));

// Idioma → personaje: ninguna (habla es personaje → idioma)
assert.equal(getRelationTypeOptionsForContext(idioma, personaje).length, 0);
assert.equal(canRelateEntities(idioma, personaje), false);

// Personaje → idioma: habla
assert.ok(
    getRelationTypeOptionsForContext(personaje, idioma).some((o) => o.value === WIKI_RELATION_TYPES.HABLA)
);

// Filtro de destinos
const pool = [idioma, ideologia, personaje, org, loc, evento, reliquia];
const fromIdioma = filterRelatableEntities(idioma, pool).map((e) => e.id);
assert.ok(!fromIdioma.includes(personaje.id), "idioma no puede relacionarse con personaje");
assert.ok(fromIdioma.includes(ideologia.id));

// Validación al crear
assert.equal(validateRelationCreate(idioma, ideologia, WIKI_RELATION_TYPES.RELACIONADO_CON), true);
assert.equal(validateRelationCreate(idioma, ideologia, WIKI_RELATION_TYPES.ENEMIGO_DE), false);
assert.equal(validateRelationCreate(idioma, personaje, WIKI_RELATION_TYPES.HABLA), false);

// Tipos legacy rechazados
assert.equal(isKnownRelationType("enemigo_de"), true);
assert.equal(isKnownRelationType("miembro_de_faccion"), false);
assert.equal(isRelationValid("miembro_de_faccion", "personaje", "organizacion"), false);

assert.equal(normalizeRelationType("relacionado_con"), "relacionado_con");
assert.equal(normalizeRelationType("Relacionado con"), "relacionado_con");
assert.equal(normalizeRelationType("Controla"), "controla");
assert.equal(normalizeRelationType("tipo_inventado"), null);

// Affinity vs structural
assert.equal(
    getRelationKind({
        relationType: WIKI_RELATION_TYPES.ALIADO_DE,
        fromEntityType: "personaje",
        toEntityType: "personaje",
    }),
    WIKI_RELATION_KIND.AFFINITY
);
assert.equal(
    getRelationKind({
        relationType: WIKI_RELATION_TYPES.MIEMBRO_DE,
        fromEntityType: "personaje",
        toEntityType: "organizacion",
    }),
    WIKI_RELATION_KIND.AFFINITY
);
assert.equal(
    getRelationKind({
        relationType: WIKI_RELATION_TYPES.VIVE_EN,
        fromEntityType: "personaje",
        toEntityType: "locacion",
    }),
    WIKI_RELATION_KIND.AFFINITY
);
assert.equal(
    getRelationKind({
        relationType: WIKI_RELATION_TYPES.HABLA,
        fromEntityType: "personaje",
        toEntityType: "idioma",
    }),
    WIKI_RELATION_KIND.STRUCTURAL
);
assert.equal(
    getRelationKind({
        relationType: WIKI_RELATION_TYPES.PARTICIPO_EN,
        fromEntityType: "personaje",
        toEntityType: "evento_historico",
    }),
    WIKI_RELATION_KIND.STRUCTURAL
);
assert.equal(
    getRelationKind({
        relationType: WIKI_RELATION_TYPES.BUSCA,
        fromEntityType: "personaje",
        toEntityType: "reliquia",
    }),
    WIKI_RELATION_KIND.STRUCTURAL
);
assert.equal(
    getRelationKind({
        relationType: WIKI_RELATION_TYPES.BUSCA,
        fromEntityType: "personaje",
        toEntityType: "personaje",
    }),
    WIKI_RELATION_KIND.AFFINITY
);
assert.equal(
    getRelationKind({
        relationType: WIKI_RELATION_TYPES.DESENCADENO,
        fromEntityType: "personaje",
        toEntityType: "personaje",
    }),
    WIKI_RELATION_KIND.STRUCTURAL
);
assert.ok(
    isAffinityRelation({
        relationType: WIKI_RELATION_TYPES.ENEMIGO_DE,
        fromEntityType: "locacion",
        toEntityType: "locacion",
    })
);
assert.ok(
    isStructuralRelation({
        relationType: WIKI_RELATION_TYPES.COLINDA_CON,
        fromEntityType: "locacion",
        toEntityType: "locacion",
    })
);

assert.equal(
    resolveRelationStrength({
        relationType: WIKI_RELATION_TYPES.HABLA,
        fromEntityType: "personaje",
        toEntityType: "idioma",
        strength: 7,
    }),
    0
);
assert.equal(
    resolveRelationStrength({
        relationType: WIKI_RELATION_TYPES.ALIADO_DE,
        fromEntityType: "personaje",
        toEntityType: "personaje",
        strength: 7,
    }),
    7
);
assert.equal(
    defaultStrengthForRelation(WIKI_RELATION_TYPES.PARTICIPO_EN, "personaje", "evento_historico"),
    0
);

// Dossier affinity pool excludes structural endpoints
const affinityPool = filterAffinityRelatableEntities(personaje, pool).map((e) => e.id);
assert.ok(affinityPool.includes(org.id));
assert.ok(affinityPool.includes(ideologia.id));
assert.ok(affinityPool.includes(loc.id));
assert.ok(!affinityPool.includes(idioma.id));
assert.ok(!affinityPool.includes(evento.id));
assert.ok(!affinityPool.includes(reliquia.id));

const pjOrgTypes = getAffinityRelationTypeOptionsForContext(personaje, org).map((o) => o.value);
assert.ok(pjOrgTypes.includes(WIKI_RELATION_TYPES.MIEMBRO_DE));
assert.ok(!pjOrgTypes.includes(WIKI_RELATION_TYPES.HABLA));

// Structural pool: idioma / evento / reliquia only — not affinity targets
const structuralPool = filterStructuralRelatableEntities(personaje, pool).map((e) => e.id);
assert.ok(structuralPool.includes(idioma.id));
assert.ok(structuralPool.includes(evento.id));
assert.ok(structuralPool.includes(reliquia.id));
assert.ok(!structuralPool.includes(org.id));
assert.ok(!structuralPool.includes(loc.id));
assert.ok(!structuralPool.includes(ideologia.id));
const pjIdiomaStruct = getStructuralRelationTypeOptionsForContext(personaje, idioma).map((o) => o.value);
assert.ok(pjIdiomaStruct.includes(WIKI_RELATION_TYPES.HABLA));
assert.ok(!getAffinityRelationTypeOptionsForContext(personaje, idioma).length);

console.log("wikiRelationTypes.test.mjs: ok");
