import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    buildCampaignCharacterOverviewLayout,
    classifyWikiPersonajeKind,
    computeOverviewRelationWaves,
    dedupePersonajeEntities,
    listCampaignPersonajeEntities,
    placeInSquareGrid,
} from "./campaignCircuitOverviewLayout.js";

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
        const { items } = listCampaignPersonajeEntities(entities, charactersById);
        assert.deepEqual(
            items.map((x) => x.entity.id),
            ["p1", "p2", "n1", "n2"],
        );
        assert.equal(items[0].kind, "pj");
        assert.equal(items[2].kind, "npc");
    });

    it("dedupes same title and same VTT link", () => {
        const dupes = [
            { id: "a1", entityType: "personaje", title: "Caelum" },
            {
                id: "a2",
                entityType: "personaje",
                title: "Caelum",
                linkedVttCharacterId: "pc1",
                visibility: "players",
            },
            {
                id: "b1",
                entityType: "personaje",
                title: "Other",
                linkedVttCharacterId: "pc2",
            },
            {
                id: "b2",
                entityType: "personaje",
                title: "Other Alt",
                linkedVttCharacterId: "pc2",
            },
        ];
        const { entities: kept, aliasToCanonical } = dedupePersonajeEntities(dupes);
        assert.equal(kept.length, 2);
        assert.ok(kept.some((e) => e.id === "a2"));
        assert.equal(aliasToCanonical.get("a1"), "a2");
        assert.equal(aliasToCanonical.get("b1") || aliasToCanonical.get("b2"), "b1");
        assert.equal(kept.filter((e) => e.linkedVttCharacterId === "pc2").length, 1);
        assert.equal(aliasToCanonical.get("b2"), "b1");
    });

    it("builds stable square grid (no hub)", () => {
        const a = buildCampaignCharacterOverviewLayout({ entities, charactersById });
        const b = buildCampaignCharacterOverviewLayout({ entities, charactersById });
        assert.equal(a.hubId, null);
        assert.equal(a.nodes.length, 4);
        assert.deepEqual(
            a.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y })),
            b.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y })),
        );
        // Reading order: PJ block then NPC, alphabetical within
        assert.deepEqual(
            a.nodes.map((n) => n.id),
            ["p1", "p2", "n1", "n2"],
        );
        // Grid: with 4 nodes and ≥3 cols, first 3 share a row; 4th wraps
        assert.equal(a.nodes[0].y, a.nodes[1].y);
        assert.equal(a.nodes[0].y, a.nodes[2].y);
        assert.ok(a.nodes[3].y > a.nodes[0].y);
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

    it("applies saved positions over grid defaults", () => {
        const layout = buildCampaignCharacterOverviewLayout({
            entities,
            charactersById,
            positions: { p1: { x: 111, y: 222 } },
        });
        const p1 = layout.nodes.find((n) => n.id === "p1");
        assert.equal(p1.x, 111);
        assert.equal(p1.y, 222);
        assert.equal(p1.positionSaved, true);
    });

    it("placeInSquareGrid is roughly square", () => {
        const items = Array.from({ length: 9 }, (_, i) => ({ entity: { id: String(i) } }));
        const placed = placeInSquareGrid(items, { cols: 3, originX: 0, originY: 0 });
        assert.equal(placed.length, 9);
        assert.equal(placed[0].x, 0);
        assert.equal(placed[2].x, placed[0].x + 2 * (148 + 52));
        assert.equal(placed[3].y, placed[0].y + (136 + 44));
    });

    it("filters by kind and search", () => {
        const onlyPj = buildCampaignCharacterOverviewLayout({
            entities,
            charactersById,
            kindFilter: "pj",
        });
        assert.equal(onlyPj.nodes.length, 2);
        const search = buildCampaignCharacterOverviewLayout({
            entities,
            charactersById,
            searchQuery: "ada",
        });
        assert.equal(search.nodes.length, 1);
        assert.equal(search.nodes[0].id, "n1");
    });

    it("includes all affinity edges and highlights the impact path", () => {
        const relations = [
            { id: "r1", fromEntityId: "p1", toEntityId: "n1", relationType: "aliado_de" },
            { id: "r2", fromEntityId: "n1", toEntityId: "n2", relationType: "aliado_de" },
        ];
        const layout = buildCampaignCharacterOverviewLayout({
            entities,
            charactersById,
            relations,
            selectedId: "p1",
            labDepth: 3,
        });
        assert.equal(layout.edges.length, 2);
        const hot = layout.edges.filter((e) => e.traceClass === "impact");
        const dim = layout.edges.filter((e) => e.traceClass === "secondary");
        assert.equal(hot.length, 2);
        assert.equal(dim.length, 0);
        assert.ok(hot.every((e) => e.layer === "front"));
        assert.ok(layout.litIds.has("p1"));
        assert.ok(layout.litIds.has("n1"));
        assert.ok(layout.litIds.has("n2"));
    });

    it("caps impact path at labDepth", () => {
        const relations = [
            { id: "r1", fromEntityId: "p1", toEntityId: "n1", relationType: "aliado_de" },
            { id: "r2", fromEntityId: "n1", toEntityId: "n2", relationType: "aliado_de" },
        ];
        const layout = buildCampaignCharacterOverviewLayout({
            entities,
            charactersById,
            relations,
            selectedId: "p1",
            labDepth: 1,
        });
        const hot = layout.edges.filter((e) => e.traceClass === "impact");
        const dim = layout.edges.filter((e) => e.traceClass === "secondary");
        assert.equal(hot.length, 1);
        assert.equal(dim.length, 1);
        assert.ok(layout.litIds.has("p1"));
        assert.ok(layout.litIds.has("n1"));
        assert.equal(layout.litIds.has("n2"), false);
    });

    it("maps wave edges through title-duplicate aliases", () => {
        const ents = [
            { id: "keep", entityType: "personaje", title: "Caelum", linkedVttCharacterId: "c1" },
            { id: "dup", entityType: "personaje", title: "Caelum" },
            { id: "friend", entityType: "personaje", title: "Friend" },
        ];
        const relations = [
            { id: "r1", fromEntityId: "dup", toEntityId: "friend", relationType: "aliado_de" },
        ];
        const { waves } = computeOverviewRelationWaves("keep", ents, relations, 2);
        assert.equal(waves[0].nodeIds[0], "keep");
        assert.deepEqual(waves[1].nodeIds, ["friend"]);
    });
});
