/**
 * Tests for shared wiki title resolution + mention extraction.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WIKI_ENTITY_TYPES } from "../constants/wikiEntityTypes.js";
import { resolveEntityByTitle } from "./resolveEntityByTitle.js";
import { resolveWikiMentions, extractNameCandidates } from "./resolveWikiMentions.js";

const entities = [
    {
        id: "elara",
        title: "Princesa Elara Alder",
        entityType: WIKI_ENTITY_TYPES.PERSONAJE,
    },
    {
        id: "aldric",
        title: "Rey Aldric Alder",
        entityType: WIKI_ENTITY_TYPES.PERSONAJE,
    },
    {
        id: "serene",
        title: "Reina Serene Alder",
        entityType: WIKI_ENTITY_TYPES.PERSONAJE,
    },
    {
        id: "coronation",
        title: "Coronación de Aldric",
        entityType: WIKI_ENTITY_TYPES.EVENTO_HISTORICO,
    },
    {
        id: "guard",
        title: "Guardia Real de Solhaven",
        entityType: WIKI_ENTITY_TYPES.ORGANIZACION,
    },
    {
        id: "oni",
        title: "Oni Margalous",
        entityType: WIKI_ENTITY_TYPES.PERSONAJE,
        tags: ["oni"],
    },
];

describe("resolveEntityByTitle", () => {
    it("prefers personaje Rey Aldric over chronicle Coronación de Aldric for 'Aldric'", () => {
        const { entity, matchType, ambiguous } = resolveEntityByTitle("Aldric", entities);
        assert.equal(ambiguous.length, 0);
        assert.equal(entity?.id, "aldric");
        assert.ok(matchType);
    });

    it("resolves exact titles", () => {
        const { entity } = resolveEntityByTitle("Rey Aldric Alder", entities);
        assert.equal(entity?.id, "aldric");
    });

    it("resolves first name Felicia-style unique tokens", () => {
        const { entity } = resolveEntityByTitle("Oni", entities);
        assert.equal(entity?.id, "oni");
    });

    it("resolves prefix Rey Aldric → Rey Aldric Alder", () => {
        const { entity } = resolveEntityByTitle("Rey Aldric", entities);
        assert.equal(entity?.id, "aldric");
    });
});

describe("resolveWikiMentions", () => {
    it("maps Aldric in event text to the king, not the coronation chronicle", () => {
        const text = "Se descubre que Aldric, el padre de Elara, asesinó a Reina Serene";
        const { resolved, ambiguous } = resolveWikiMentions(text, entities);
        const titles = resolved.map((r) => r.entity.title);
        assert.ok(titles.includes("Rey Aldric Alder"), `got ${titles.join(", ")}`);
        assert.ok(!titles.includes("Coronación de Aldric"), `got ${titles.join(", ")}`);
        assert.ok(titles.includes("Princesa Elara Alder") || titles.includes("Reina Serene Alder"));
        assert.equal(ambiguous.filter((a) => a.text.toLowerCase() === "aldric").length, 0);
    });

    it("extracts middle name candidates from capital runs", () => {
        const cands = extractNameCandidates("Rey Aldric Alder traicionó a Elara");
        assert.ok(cands.some((c) => c === "Aldric"));
    });
});
