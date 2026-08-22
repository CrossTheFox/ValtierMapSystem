import assert from "node:assert/strict";
import {
    buildEgoGraphDataset,
    buildGraphDataset,
} from "./wikiGraphEntities.js";

const a = { id: "a", entityType: "personaje", title: "A" };
const b = { id: "b", entityType: "personaje", title: "B" };
const c = { id: "c", entityType: "organizacion", title: "C" };
const d = { id: "d", entityType: "locacion", title: "D" };
const idioma = { id: "lang", entityType: "idioma", title: "Lang" };

const entities = [a, b, c, d, idioma];
const relations = [
    { id: "r1", fromEntityId: "a", toEntityId: "b" },
    { id: "r2", fromEntityId: "b", toEntityId: "c" },
    { id: "r3", fromEntityId: "c", toEntityId: "d" },
    { id: "r4", fromEntityId: "a", toEntityId: "lang" },
];

const full = buildGraphDataset(entities, relations);
assert.equal(full.graphEntities.length, 4); // idioma excluded
assert.ok(!full.graphEntityIds.has("lang"));

const ego0 = buildEgoGraphDataset(entities, relations, "a", 0);
assert.deepEqual(ego0.graphEntities.map((e) => e.id).sort(), ["a"]);
assert.equal(ego0.graphRelations.length, 0);

const ego1 = buildEgoGraphDataset(entities, relations, "a", 1);
assert.deepEqual(ego1.graphEntities.map((e) => e.id).sort(), ["a", "b"]);
assert.equal(ego1.graphRelations.length, 1);

const ego2 = buildEgoGraphDataset(entities, relations, "a", 2);
assert.deepEqual(ego2.graphEntities.map((e) => e.id).sort(), ["a", "b", "c"]);
assert.equal(ego2.graphRelations.length, 2);

const isolated = buildEgoGraphDataset(entities, relations, "missing", 2);
assert.equal(isolated.graphEntities.length, 0);

console.log("wikiGraphEntities.test.mjs: ok");
