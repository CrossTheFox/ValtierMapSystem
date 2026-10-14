import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    CODEX_HOLDS,
    containmentLinks,
    groupHulls,
    groupOffers,
    holdsOf,
    packGroupPositions,
} from "./labContainment.js";

const entities = [
    { id: "org", entityType: "organizacion", title: "Casa" },
    { id: "city", entityType: "locacion", title: "Mirage" },
    { id: "ward", entityType: "locacion", title: "Muelle" },
    { id: "pj", entityType: "personaje", title: "Ana" },
    { id: "npc", entityType: "personaje", title: "Bruno" },
];

describe("labContainment", () => {
    it("keeps membership and residence as the only people groups", () => {
        const orgHolds = holdsOf("organizacion").filter((row) => row.labGroup).map((row) => row.via);
        assert.deepEqual(orgHolds, ["miembro_confirmado_de", "miembro_de", "miembro_sospechado_de"]);
        const placeHolds = holdsOf("locacion").filter((row) => row.holds === "personaje");
        assert.equal(placeHolds[0].via, "vive_en");
        assert.equal(holdsOf("idioma")[0].labGroup, null);
        assert.equal(holdsOf("personaje").length, 0);
        assert.equal(CODEX_HOLDS.era.length, 0);
    });

    it("reads the holder from the canonical end of the verb", () => {
        const links = containmentLinks(entities, [
            { from_ficha_id: "pj", to_ficha_id: "org", relation_type: "miembro_confirmado_de" },
            { from_ficha_id: "npc", to_ficha_id: "city", relation_type: "vive_en" },
            { from_ficha_id: "ward", to_ficha_id: "city", relation_type: "perteneciente_a" },
            { from_ficha_id: "pj", to_ficha_id: "npc", relation_type: "aliado_de" },
        ]);
        const org = links.find((row) => row.childId === "pj" && row.group === "organizacion");
        const home = links.find((row) => row.childId === "npc");
        const ward = links.find((row) => row.childId === "ward");
        assert.equal(org.parentId, "org");
        assert.equal(home.parentId, "city");
        assert.equal(ward.parentId, "city");
        assert.equal(links.some((row) => row.relation === "aliado_de"), false);
    });

    it("packs members under their container and wraps the current places", () => {
        const relations = [
            { from_ficha_id: "pj", to_ficha_id: "org", relation_type: "miembro_de" },
        ];
        const moved = packGroupPositions(entities, relations, {}, "organizacion");
        assert.equal(moved.org.y < moved.pj.y, true);
        assert.equal(moved.org.x, moved.pj.x);
        const positions = { org: moved.org, pj: moved.pj };
        const hulls = groupHulls(entities, relations, positions, "organizacion");
        assert.equal(hulls.length, 1);
        assert.equal(hulls[0].memberIds.includes("pj"), true);
        assert.equal(hulls[0].w > 188, true);
    });

    it("offers one verb for the single container in the selection", () => {
        const members = groupOffers([
            entities[0],
            entities[3],
            entities[4],
        ]);
        assert.equal(members.length, 1);
        assert.equal(members[0].relation, "miembro_confirmado_de");
        assert.deepEqual(members[0].childIds, ["pj", "npc"]);
        const nested = groupOffers([entities[1], entities[2]]);
        assert.equal(nested[0].relation, "perteneciente_a");
        assert.equal(nested[0].parentId, "city");
        assert.deepEqual(nested[0].childIds, ["ward"]);
    });
});
