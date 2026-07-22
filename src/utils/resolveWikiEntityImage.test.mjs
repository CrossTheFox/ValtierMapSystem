import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    resolveWikiEntityImageCandidates,
    resolveWikiEntityImagePath,
} from "./resolveWikiEntityImage.js";

describe("resolveWikiEntityImageCandidates", () => {
    it("keeps VTT path after a broken wiki imageUrl", () => {
        const entity = {
            title: "Oni Margalous",
            entityType: "personaje",
            imageUrl: "/images/Oni_V2.png",
            linkedVttCharacterId: "oni-id",
        };
        const charactersById = {
            "oni-id": { id: "oni-id", name: "Oni Margalous", imageUrl: "/images/Oni.png" },
        };
        const paths = resolveWikiEntityImageCandidates(entity, {}, charactersById);
        assert.deepEqual(paths, ["/images/Oni_V2.png", "/images/Oni.png"]);
        assert.equal(resolveWikiEntityImagePath(entity, {}, charactersById), "/images/Oni_V2.png");
    });

    it("matches by title when link is missing", () => {
        const entity = {
            title: "Oni Margalous",
            entityType: "personaje",
        };
        const charactersById = {
            "oni-id": { id: "oni-id", name: "Oni Margalous", imageUrl: "/images/Oni.png" },
        };
        const paths = resolveWikiEntityImageCandidates(entity, {}, charactersById);
        assert.deepEqual(paths, ["/images/Oni.png"]);
    });
});
