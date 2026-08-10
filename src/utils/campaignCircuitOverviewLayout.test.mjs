import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    buildCampaignCharacterOverviewLayout,
    classifyWikiPersonajeKind,
    listCampaignPersonajeEntities,
} from "./campaignCircuitOverviewLayout.js";
import { CIRCUIT_HUB_X, CIRCUIT_HUB_Y } from "./circuitLayout.js";

describe("campaignCircuitOverviewLayout", () => {
    const entities = [
        { id: "n2", entityType: "personaje", title: "Zed NPC" },
        { id: "p2", entityType: "personaje", title: "Beta PJ", linkedVttCharacterId: "c2" },
        { id: "p1", entityType: "personaje", title: "Alpha PJ", linkedVttCharacterId: "c1" },
        { id: "n1", entityType: "personaje", title: "Ada NPC" },
        { id: "org", entityType: "organizacion", title: "Guild" },
    ];
    const charactersById = {
        c1: { id: "c1", name: "Alpha PJ", type: "pc" },
        c2: { id: "c2", name: "Beta PJ", type: "pc" },
    };

    it("lists only personajes sorted PJ then title", () => {
        const list = listCampaignPersonajeEntities(entities, charactersById);
        assert.deepEqual(
            list.map((x) => x.entity.id),
            ["p1", "p2", "n1", "n2"],
        );
        assert.equal(list[0].kind, "pj");
        assert.equal(list[2].kind, "npc");
    });

    it("builds stable overview coords (no hub)", () => {
        const a = buildCampaignCharacterOverviewLayout({ entities, charactersById });
        const b = buildCampaignCharacterOverviewLayout({ entities, charactersById });
        assert.equal(a.hubId, null);
        assert.equal(a.edges.length, 0);
        assert.equal(a.nodes.length, 4);
        assert.deepEqual(
            a.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y })),
            b.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y })),
        );
        const pj = a.nodes.filter((n) => n.overviewKind === "pj");
        const npc = a.nodes.filter((n) => n.overviewKind === "npc");
        assert.equal(pj.length, 2);
        assert.equal(npc.length, 2);
        // PJ closer to hub than NPC (inner oval)
        const pjDist = Math.hypot(pj[0].x - CIRCUIT_HUB_X, pj[0].y - CIRCUIT_HUB_Y);
        const npcDist = Math.hypot(npc[0].x - CIRCUIT_HUB_X, npc[0].y - CIRCUIT_HUB_Y);
        assert.ok(pjDist < npcDist);
    });

    it("classifies by linked VTT character", () => {
        assert.equal(
            classifyWikiPersonajeKind(
                { entityType: "personaje", linkedVttCharacterId: "c1", title: "X" },
                charactersById,
            ),
            "pj",
        );
    });

    it("applies saved positions over oval defaults", () => {
        const layout = buildCampaignCharacterOverviewLayout({
            entities,
            charactersById,
            positions: { p1: { x: 111, y: 222 } },
        });
        const p1 = layout.nodes.find((n) => n.id === "p1");
        const p2 = layout.nodes.find((n) => n.id === "p2");
        assert.equal(p1.x, 111);
        assert.equal(p1.y, 222);
        assert.equal(p1.positionSaved, true);
        assert.equal(p1.rankLabel, "PJ");
        assert.equal(p2.positionSaved, false);
        assert.ok(Number.isFinite(p2.x));
    });
});
