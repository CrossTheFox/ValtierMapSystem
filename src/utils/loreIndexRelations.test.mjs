import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { indexPatchesAfterDrop, relationsDroppedByIndex } from "./loreIndexRelations.js";

describe("lore index relations", () => {
    const node = "muerte";
    const relaciones = [
        { id: "p1", relation_type: "participo_en", from_ficha_id: "elara", to_ficha_id: node },
        { id: "p2", relation_type: "participo_en", from_ficha_id: "aldric", to_ficha_id: node },
        { id: "o1", relation_type: "ocurrio_en", from_ficha_id: node, to_ficha_id: "sala" },
        { id: "a1", relation_type: "aliado_de", from_ficha_id: "elara", to_ficha_id: "aldric" },
    ];

    it("drops the structural edge whose person or place left the index", () => {
        const dropped = relationsDroppedByIndex(relaciones, node, ["aldric"], []);
        assert.deepEqual(dropped.map((row) => row.id).sort(), ["o1", "p1"]);
    });

    it("strips the other endpoint from the index when the edge is removed", () => {
        const patches = indexPatchesAfterDrop(
            [
                { id: node, index_personajes: ["elara", "aldric"] },
                { id: "otro", index_personajes: ["elara"] },
            ],
            relaciones[0],
        );
        assert.deepEqual(patches, [
            { id: node, patch: { index_personajes: ["aldric"] } },
            { id: "otro", patch: { index_personajes: [] } },
        ]);
    });
});
