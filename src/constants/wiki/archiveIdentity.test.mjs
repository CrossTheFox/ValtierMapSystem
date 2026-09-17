import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    ARCHIVE_CASCADE_WRITES,
    linkedLocationIdsOf,
    locationLinkPatch,
    wikiEntityIdOfLocation,
    locationMatchesWikiEntity,
    findWikiLocacionForPin,
    collectPinsForWikiLocation,
    findWikiPersonajeForCharacter,
} from "./archiveIdentity.js";

describe("archive identity contract", () => {
    it("cascade must not write VTT character/location docs", () => {
        assert.equal(ARCHIVE_CASCADE_WRITES.wikiEntities, true);
        assert.equal(ARCHIVE_CASCADE_WRITES.entityRelations, true);
        assert.equal(ARCHIVE_CASCADE_WRITES.characters, false);
        assert.equal(ARCHIVE_CASCADE_WRITES.locations, false);
    });

    it("merges legacy linkedVttLocationId with instance array (1:N)", () => {
        const entity = {
            linkedVttLocationId: "pin-a",
            linkedVttLocationIds: ["pin-b", "pin-a"],
        };
        assert.deepEqual(linkedLocationIdsOf(entity), ["pin-b", "pin-a"]);
        assert.deepEqual(locationLinkPatch(["pin-b", "pin-a", "pin-b"]), {
            linkedVttLocationIds: ["pin-b", "pin-a"],
            linkedVttLocationId: "pin-b",
        });
    });

    it("resolves pin via wikiEntityId first, then inverse list", () => {
        const place = {
            id: "wiki-umbral",
            entityType: "locacion",
            linkedVttLocationId: "pin-world",
            linkedVttLocationIds: ["pin-world", "pin-interior"],
        };
        const pin = { id: "pin-interior", wikiEntityId: "wiki-umbral", name: "Umbral" };
        const orphan = { id: "pin-other", name: "Otro" };

        assert.equal(wikiEntityIdOfLocation(pin), "wiki-umbral");
        assert.equal(locationMatchesWikiEntity(pin, place), true);
        assert.equal(locationMatchesWikiEntity(orphan, place), false);
        assert.equal(findWikiLocacionForPin(pin, [place])?.id, "wiki-umbral");
        assert.equal(findWikiLocacionForPin({ id: "pin-world" }, [place])?.id, "wiki-umbral");
        assert.equal(collectPinsForWikiLocation(place, { a: pin, b: orphan }).length, 1);
    });

    it("PERSONAJE lookup prefers narrativeEntityId", () => {
        const wiki = { id: "w1", entityType: "personaje", linkedVttCharacterId: "c1" };
        const other = { id: "w2", entityType: "personaje", linkedVttCharacterId: "c1" };
        assert.equal(
            findWikiPersonajeForCharacter({ narrativeEntityId: "w1" }, "c1", [other, wiki])?.id,
            "w1"
        );
        assert.equal(findWikiPersonajeForCharacter({}, "c1", [wiki])?.id, "w1");
    });
});
