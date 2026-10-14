import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    buildPlayerEgo,
    findRelationForPair,
    linkVerbChoices,
    proposeLabRelation,
} from "./labGraph.js";

describe("labGraph", () => {
    it("replaces the previous edge of a pair", () => {
        const existing = {
            id: "rel-1",
            from_ficha_id: "b",
            to_ficha_id: "a",
            relation_type: "enemigo_de",
        };
        const found = findRelationForPair([existing], "a", "b");
        assert.equal(found.id, "rel-1");
        const next = proposeLabRelation({
            fromId: "a",
            toId: "b",
            fromType: "personaje",
            toType: "personaje",
            relationType: "aliado_de",
            strength: 4,
            existing: found,
        });
        assert.equal(next.ok, true);
        assert.equal(next.replaceId, "rel-1");
        assert.equal(next.row.from_ficha_id, "a");
        assert.equal(next.row.relation_type, "aliado_de");
        assert.equal(next.row.strength, 4);
    });

    it("rejects a verb the pair matrix does not allow", () => {
        const next = proposeLabRelation({
            fromId: "a",
            toId: "b",
            fromType: "personaje",
            toType: "personaje",
            relationType: "vive_en",
            strength: 3,
        });
        assert.equal(next.ok, false);
    });

    it("offers the reverse direction when that pair has verbs", () => {
        const choices = linkVerbChoices("organizacion", "personaje");
        assert.equal(choices.direct.includes("miembro_confirmado_de"), false);
        assert.equal(choices.reverse.includes("miembro_confirmado_de"), true);
    });

    it("forces a structural verb to strength 0", () => {
        const next = proposeLabRelation({
            fromId: "a",
            toId: "b",
            fromType: "locacion",
            toType: "locacion",
            relationType: "colinda_con",
            strength: 9,
        });
        assert.equal(next.ok, true);
        assert.equal(next.row.strength, 0);
    });

    it("drops a hidden neighbor and always keeps the player's own ficha", () => {
        const fichas = [
            { id: "me", entity_type: "personaje", title: "Yo" },
            { id: "open", entity_type: "personaje", title: "Visible" },
            { id: "secret", entity_type: "personaje", title: "Oculto" },
            { id: "mine", entity_type: "locacion", title: "Mi lugar" },
        ];
        const relations = [
            { id: "r1", from_ficha_id: "me", to_ficha_id: "open", relation_type: "aliado_de", strength: 2 },
            { id: "r2", from_ficha_id: "me", to_ficha_id: "secret", relation_type: "enemigo_de", strength: -3 },
            { id: "r3", from_ficha_id: "me", to_ficha_id: "mine", relation_type: "vive_en", strength: 0 },
        ];
        const ego = buildPlayerEgo({
            fichas,
            relations,
            focusFichaId: "me",
            visibleFichaIds: ["open"],
            ownFichaIds: ["me", "mine"],
        });
        assert.deepEqual(ego.nodes.map((row) => row.id).sort(), ["me", "mine", "open"]);
        assert.deepEqual(ego.edges.map((row) => row.id).sort(), ["r1", "r3"]);
    });
});
