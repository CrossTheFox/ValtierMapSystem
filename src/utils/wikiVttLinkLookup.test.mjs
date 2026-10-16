import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    buildWikiVttLinkIndex,
    getWikiEntityForLocation,
    getWikiEntityForCharacter,
    hasWikiVttLink,
    getWikiVttLinkKind,
} from "./wikiVttLinkLookup.js";

describe("wiki VTT link lookup (1:N locations)", () => {
    const place = {
        id: "wiki-umbral",
        entityType: "locacion",
        linkedVttLocationId: "pin-world",
        linkedVttLocationIds: ["pin-world", "pin-interior"],
    };
    const pj = {
        id: "wiki-caelum",
        entityType: "personaje",
        linkedVttCharacterId: "c1",
    };

    it("indexes every pin id on a locacion", () => {
        const index = buildWikiVttLinkIndex([place, pj]);
        assert.equal(index.byLocationId.get("pin-world")?.id, "wiki-umbral");
        assert.equal(index.byLocationId.get("pin-interior")?.id, "wiki-umbral");
        assert.equal(index.byCharacterId.get("c1")?.id, "wiki-caelum");
        assert.equal(getWikiVttLinkKind(place), "location");
        assert.equal(hasWikiVttLink(place), true);
    });

    it("prefers location.wikiEntityId over the inverse index", () => {
        const index = buildWikiVttLinkIndex([place]);
        const pin = { id: "pin-interior", wikiEntityId: "wiki-umbral" };
        assert.equal(
            getWikiEntityForLocation(index, pin.id, pin, [place])?.id,
            "wiki-umbral"
        );
    });

    it("prefers character.narrativeEntityId", () => {
        const index = buildWikiVttLinkIndex([pj]);
        const byId = { w1: { id: "w1", entityType: "personaje" } };
        assert.equal(
            getWikiEntityForCharacter(index, "c1", { narrativeEntityId: "w1" }, byId)?.id,
            "w1"
        );
    });
});
