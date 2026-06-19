import assert from "node:assert/strict";
import {
    getRelationTypeOptionsForContext,
    canRelateEntities,
    filterRelatableEntities,
    validateRelationCreate,
    isRelationValid,
    isKnownRelationType,
    normalizeRelationType,
    WIKI_RELATION_TYPES,
} from "./wikiRelationTypes.js";

const idioma = { id: "l1", entityType: "idioma", title: "Arvek" };
const ideologia = { id: "i1", entityType: "ideologia", title: "Culto" };
const personaje = { id: "p1", entityType: "personaje", title: "Kael" };
const org = { id: "o1", entityType: "organizacion", title: "Guardia" };

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
const pool = [idioma, ideologia, personaje, org];
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

console.log("wikiRelationTypes.test.mjs: ok");
