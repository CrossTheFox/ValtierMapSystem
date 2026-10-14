import test from "node:test";
import assert from "node:assert/strict";
import { publishedNodeCount, publishedTimeline, stripHiddenMentions } from "./timelinePublish.js";

const data = {
    sun: { name: "Lore de prueba", summary: "Sol", now: "7036", layoutX: 1, layoutY: undefined },
    eras: [
        { id: "era1", title: "Era visible", people: ["p1", "p2"], places: ["l1"], body: "" },
        { id: "era2", title: "Era oculta" },
    ],
    arcs: [{ id: "arc1", title: "Arco", eraIds: ["era1", "era2"] }],
    events: [
        {
            id: "ev1",
            title: "Hecho",
            body: "Lo hizo @[Persona Visible](p1) con @[Persona Oculta](p2).",
            anchor: { precision: "inherited", parentId: "ev2", eraIds: ["era2"], arcIds: ["arc1"], bucketUnit: "era", bucketRef: "era2" },
        },
        { id: "ev2", title: "Hecho oculto", anchor: {} },
    ],
    neutrals: [{ id: "n1", title: "Oculto" }],
    sessions: [
        { id: "s1", title: "Sesión 1", body: "", recap: "@[Persona Oculta](p2)", eventIds: ["ev1", "ev2"], personajeIds: ["p1", "p2"] },
        { id: "s2", title: "Sesión idea" },
    ],
    actas: [
        { id: "a1", campaignId: "c1", title: "Acta", loreSessionId: "s1" },
        { id: "a2", campaignId: "c1", title: "Acta 2", loreSessionId: "s2" },
        { id: "a3", campaignId: "otra", title: "Otra mesa", loreSessionId: "s1" },
    ],
    campaigns: [{ id: "c1", name: "Mesa uno" }, { id: "otra", name: "Otra" }],
    mentions: [{ id: "p1", title: "Persona Visible" }, { id: "p2", title: "Persona Oculta" }, { id: "era1", title: "Era visible" }],
    links: [
        { kind: "agrupa", fromType: "lore", fromId: "L", toType: "era", toId: "era1" },
        { kind: "agrupa", fromType: "era", fromId: "era1", toType: "arco", toId: "arc1" },
        { kind: "sigue", fromType: "acontecimiento", fromId: "ev1", toType: "acontecimiento", toId: "ev2" },
        { kind: "agrupa", fromType: "lore", fromId: "L", toType: "era", toId: "era2" },
    ],
    paints: { era1: { color: "#ffffff" }, era2: { color: "#000000" } },
};

const vis = { era1: "players", arc1: "players", ev1: "players", s1: "players", p1: "players", p2: "dm_only", era2: "dm_only" };

test("only nodes marked players reach the projection", () => {
    const view = publishedTimeline(data, vis, "c1");
    assert.deepEqual(view.eras.map((r) => r.id), ["era1"]);
    assert.deepEqual(view.arcs.map((r) => r.id), ["arc1"]);
    assert.deepEqual(view.events.map((r) => r.id), ["ev1"]);
    assert.deepEqual(view.neutrals, []);
    assert.deepEqual(view.sessions.map((r) => r.id), ["s1"]);
    assert.equal(publishedNodeCount(view), 4);
});

test("references to hidden nodes are cut", () => {
    const view = publishedTimeline(data, vis, "c1");
    assert.deepEqual(view.eras[0].people, ["p1"]);
    assert.deepEqual(view.eras[0].places, []);
    assert.deepEqual(view.arcs[0].eraIds, ["era1"]);
    const anchor = view.events[0].anchor;
    assert.equal(anchor.parentId, null);
    assert.deepEqual(anchor.eraIds, []);
    assert.deepEqual(anchor.arcIds, ["arc1"]);
    assert.equal(anchor.bucketUnit, null);
    assert.equal(anchor.bucketRef, null);
    assert.deepEqual(view.sessions[0].eventIds, ["ev1"]);
    assert.deepEqual(view.sessions[0].personajeIds, ["p1"]);
    assert.deepEqual(view.mentions.map((m) => m.id), ["p1", "era1"]);
    assert.deepEqual(Object.keys(view.paints), ["era1"]);
    assert.equal(view.links.length, 2);
});

test("hidden mentions lose the link but keep the prose", () => {
    const view = publishedTimeline(data, vis, "c1");
    assert.equal(view.events[0].body, "Lo hizo @[Persona Visible](p1) con Persona Oculta.");
    assert.equal(view.sessions[0].recap, "Persona Oculta");
    assert.equal(stripHiddenMentions("@[A](x)", new Set(["x"])), "@[A](x)");
});

test("actas of this mesa only, annex cut when the lore session is hidden", () => {
    const view = publishedTimeline(data, vis, "c1");
    assert.deepEqual(view.actas.map((a) => [a.id, a.loreSessionId]), [["a1", "s1"], ["a2", ""]]);
    assert.deepEqual(view.campaigns, [{ id: "c1", name: "Mesa uno" }]);
});

test("nothing published means an empty line, and no undefined for Firestore", () => {
    const view = publishedTimeline(data, {}, "c1");
    assert.equal(publishedNodeCount(view), 0);
    assert.equal(view.sun.layoutY, null);
    assert.equal(view.sun.name, "Lore de prueba");
    assert.equal(JSON.stringify(view).includes("undefined"), false);
    assert.equal(publishedNodeCount(null), 0);
});
