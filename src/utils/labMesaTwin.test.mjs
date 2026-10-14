import { test } from "node:test";
import assert from "node:assert/strict";
import { mesaWikiTwin } from "./labMesaTwin.js";

const wiki = [
    { id: "w-ana", entityType: "personaje", title: "Ana Roble", linkedVttCharacterId: "c-ana" },
    { id: "w-ben", entityType: "personaje", title: "Benjamín Gris" },
    { id: "w-port", entityType: "locacion", title: "Puerto Norte", linkedVttLocationIds: ["loc-1"] },
    { id: "w-guild", entityType: "organizacion", title: "Gremio Azul" },
    { id: "w-ana-loc", entityType: "locacion", title: "Ana Roble" },
];

test("organizacion: mesa_source points straight at the wiki id", () => {
    const twin = mesaWikiTwin({ id: "f1", entityType: "organizacion", title: "Otro", mesaSource: "organizacion:w-guild" }, { wikiEntities: wiki });
    assert.equal(twin?.id, "w-guild");
});

test("personaje: mesa_source character resolves through linkedVttCharacterId", () => {
    const twin = mesaWikiTwin(
        { id: "f2", entityType: "personaje", title: "Nombre viejo", mesaSource: "character:c-ana" },
        { wikiEntities: wiki, characters: [{ id: "c-ana" }] },
    );
    assert.equal(twin?.id, "w-ana");
});

test("personaje: a character whose ficha_id is the Lore ficha also links", () => {
    const twin = mesaWikiTwin(
        { id: "f3", entityType: "personaje", title: "x" },
        { wikiEntities: wiki, characters: [{ id: "c-ana", ficha_id: "f3" }] },
    );
    assert.equal(twin?.id, "w-ana");
});

test("locacion: mesa_source location resolves through the pin link", () => {
    const twin = mesaWikiTwin(
        { id: "f4", entityType: "locacion", title: "x", mesaSource: "location:loc-1" },
        { wikiEntities: wiki, locations: { "loc-1": { id: "loc-1" } } },
    );
    assert.equal(twin?.id, "w-port");
});

test("fallback: same type and folded title, never across types", () => {
    assert.equal(mesaWikiTwin({ id: "f5", entityType: "personaje", title: "benjamin gris " }, { wikiEntities: wiki })?.id, "w-ben");
    assert.equal(mesaWikiTwin({ id: "f6", entityType: "locacion", title: "Ana Roble" }, { wikiEntities: wiki })?.id, "w-ana-loc");
    assert.equal(mesaWikiTwin({ id: "f7", entityType: "organizacion", title: "Ana Roble" }, { wikiEntities: wiki }), null);
});

test("no id or no match returns null", () => {
    assert.equal(mesaWikiTwin(null, { wikiEntities: wiki }), null);
    assert.equal(mesaWikiTwin({ id: "f8", entityType: "personaje", title: "Nadie" }, { wikiEntities: wiki }), null);
});
