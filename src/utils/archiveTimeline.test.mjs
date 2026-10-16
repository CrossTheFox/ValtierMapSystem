import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    addSessionSource,
    anchorFromFields,
    anchorSpan,
    anchorToColumns,
    anchorValid,
    dayList,
    eventYear,
    fmtWhen,
    isVagueAnchor,
    normalizeAnchor,
    orphanedChildAnchor,
    plainRecap,
    removalPatches,
    removeSessionSource,
    sessionDayLabel,
    sessionMarkDay,
    stretchedParentAnchor,
    canGroup,
    groupDirection,
    linkPorts,
    linksAfterRetarget,
    indexFacts,
    normalizeNeutro,
    rollupIndex,
    normalizePaints,
    paintsToRows,
    parallelIds,
    parallelRow,
    twinPorts,
    dropNodeLinks,
    dropPair,
    layoutNum,
    normalizeLinks,
    panelForest,
    upsertLink,
    wouldCycle,
} from "./archiveTimeline.js";

const none = () => undefined;

describe("normalizeAnchor", () => {
    it("reads the old mesa shape without rewriting it", () => {
        const old = { date: "7024-03", narrativeArcId: "arc1", branch: "left" };
        const a = normalizeAnchor(old);
        assert.equal(a.precision, "month");
        assert.equal(a.start, "7024-03");
        assert.deepEqual(a.arcIds, ["arc1"]);
        assert.deepEqual(old, { date: "7024-03", narrativeArcId: "arc1", branch: "left" });
    });
    it("reads biblioteca snake_case columns", () => {
        const a = normalizeAnchor({ precision: "era", bucket_unit: "era", bucket_ref: "e1", era_ids: ["e1"], arco_ids: [], parent_id: null });
        assert.equal(a.bucketUnit, "era");
        assert.deepEqual(a.eraIds, ["e1"]);
    });
});

describe("anchor", () => {
    it("needs at least one anchor to save", () => {
        assert.equal(anchorValid(anchorFromFields({ precision: "year", y: "" })), false);
        assert.equal(anchorValid(anchorFromFields({ precision: "year", y: "7024" })), true);
        assert.equal(anchorValid(anchorFromFields({ precision: "inherited", parentId: "" })), false);
        assert.equal(anchorValid(anchorFromFields({ precision: "year", arcIds: ["a"] })), true);
    });
    it("inherited child is drawn inside the parent span", () => {
        const parent = { id: "p", anchor: normalizeAnchor({ precision: "range", start: "7000", end: "7010" }) };
        const kid = { id: "k", anchor: normalizeAnchor({ precision: "inherited", parentId: "p" }) };
        const byId = (id) => (id === "p" ? parent : undefined);
        assert.deepEqual(anchorSpan(kid, byId, none).y0, 7000);
        assert.equal(eventYear(kid, byId, none).text, "");
    });
    it("a dated child outside the parent stretches it to a range", () => {
        const parent = { id: "p", anchor: normalizeAnchor({ precision: "year", start: "7000" }) };
        const kid = { id: "k", anchor: normalizeAnchor({ precision: "year", start: "7005", parentId: "p" }) };
        const next = stretchedParentAnchor(kid, parent, () => parent, none);
        assert.equal(next.precision, "range");
        assert.equal(next.start, "7000");
        assert.equal(next.end, "7005");
    });
    it("an orphaned inherited child keeps the span it was drawn in", () => {
        const kid = { anchor: normalizeAnchor({ precision: "inherited", parentId: "p" }) };
        const a = orphanedChildAnchor(kid, { y0: 7000, y1: 7010 });
        assert.equal(a.parentId, null);
        assert.equal(a.precision, "range");
        assert.equal(a.start, "7000");
    });
    it("formats D.Z. dates like the mock", () => {
        assert.equal(fmtWhen("7024-03-05"), "7024-mar-05 D.Z.");
        assert.equal(fmtWhen("7020", "7030"), "7020–7030 D.Z.");
    });
});

describe("calendar", () => {
    it("a loose month takes no day cell", () => {
        const list = dayList(normalizeAnchor({ precision: "month", start: "7024-03" }));
        assert.deepEqual(list, [{ y: 7024, m: 3, month: true }]);
        assert.equal(list.some((d) => !d.month), false);
    });
    it("a vague bucket takes no cell", () => {
        const a = normalizeAnchor({ precision: "decade", bucketUnit: "decade", bucketRef: "7020" });
        assert.equal(isVagueAnchor(a), true);
        assert.deepEqual(dayList(a), []);
    });
    it("a day range lists each day", () => {
        assert.equal(dayList(normalizeAnchor({ precision: "range", start: "7024-03-30", end: "7024-04-02" })).length, 4);
    });
    it("session mark only for a full D.Z. day", () => {
        assert.equal(sessionMarkDay({ inGame: "7036-02" }), null);
        assert.equal(sessionMarkDay({ inGame: "7036" }), null);
        assert.equal(sessionMarkDay({ inGame: "7036-02-02" }).d, 2);
    });
});

describe("session contract", () => {
    it("the label shows the session day, not the host year", () => {
        assert.equal(sessionDayLabel({ inGame: "7036-02-02" }), "Día 7036-feb-02 D.Z.");
        assert.equal(sessionDayLabel({ inGame: "" }), "Sin fecha D.Z. en la sesión");
    });
    it("recap is plain text", () => {
        assert.equal(plainRecap("Vio a @[Testigo](abc) en @[plaza]."), "Vio a Testigo en plaza.");
    });
    it("hanging confirms people with source session:{id}; a manual probable keeps manual", () => {
        const before = [{ kind: "vtt", id: "c1", status: "probable", sources: ["manual"] }];
        const after = addSessionSource(before, "s1", [{ kind: "vtt", id: "c1" }, { kind: "vtt", id: "c2" }]);
        assert.equal(after[0].status, "confirmado");
        assert.deepEqual(after[0].sources, ["manual", "session:s1"]);
        assert.deepEqual(after[1], { kind: "vtt", id: "c2", status: "confirmado", sources: ["session:s1"] });
        assert.equal(before[0].status, "probable");
    });
    it("unhanging drops only that source and restores the manual status", () => {
        const hung = addSessionSource([{ kind: "vtt", id: "c1", status: "probable", sources: ["manual"] }], "s1", [{ kind: "vtt", id: "c1" }, { kind: "vtt", id: "c2" }]);
        const back = removeSessionSource(hung, "s1");
        assert.deepEqual(back, [{ kind: "vtt", id: "c1", status: "probable", sources: ["manual"] }]);
    });
    it("someone in two sessions stays after unhanging one", () => {
        const two = addSessionSource(addSessionSource([], "s1", [{ kind: "vtt", id: "c1" }]), "s2", [{ kind: "vtt", id: "c1" }]);
        assert.deepEqual(removeSessionSource(two, "s1")[0].sources, ["session:s2"]);
    });
});

describe("storage and deletes", () => {
    it("ficha columns round-trip through normalizeAnchor", () => {
        const a = anchorFromFields({ precision: "decade", y: "7020", eraIds: ["e1"], arcIds: ["a1"], parentId: "p" });
        const cols = anchorToColumns(a);
        assert.equal(cols.bucket_unit, "decade");
        assert.deepEqual(cols.arco_ids, ["a1"]);
        assert.deepEqual(normalizeAnchor(cols), a);
    });
    it("deleting an era frees arcos, members and an era bucket", () => {
        const eras = [{ id: "e1", start: 7000, end: 7050 }];
        const arcs = [{ id: "a1", eraIds: ["e1", "e2"] }];
        const events = [
            { id: "x", anchor: normalizeAnchor({ precision: "era", bucketUnit: "era", bucketRef: "e1", eraIds: ["e1"] }) },
            { id: "y", anchor: normalizeAnchor({ precision: "year", start: "7010" }) },
        ];
        const p = removalPatches("era", "e1", { eras, arcs, events });
        assert.deepEqual(p.arcs, [{ id: "a1", eraIds: ["e2"] }]);
        assert.equal(p.events.length, 1);
        assert.equal(p.events[0].anchor.bucketRef, null);
        assert.equal(p.events[0].anchor.precision, "year");
        assert.equal(anchorValid(p.events[0].anchor), false);
    });
    it("deleting a parent keeps an inherited child in the parent's span", () => {
        const events = [
            { id: "p", anchor: normalizeAnchor({ precision: "range", start: "7010", end: "7012" }) },
            { id: "c", anchor: normalizeAnchor({ precision: "inherited", parentId: "p" }) },
        ];
        const p = removalPatches("evento", "p", { events });
        assert.deepEqual(p.events, [{ id: "c", anchor: { ...events[1].anchor, parentId: null, precision: "range", start: "7010", end: "7012" } }]);
    });
});

const era = (id) => ({ kind: "agrupa", fromType: "era", fromId: id, toType: "acontecimiento", toId: "x" });

describe("manual graph", () => {
    it("treats 0 as a placed coordinate and a blank as unplaced", () => {
        assert.equal(layoutNum(0), 0);
        assert.equal(layoutNum(null), null);
        assert.equal(layoutNum(""), null);
    });
    it("allows grouping only along the table", () => {
        assert.equal(canGroup("era", "era"), true);
        assert.equal(canGroup("arco", "acontecimiento"), true);
        assert.equal(canGroup("arco", "era"), false);
        assert.equal(canGroup("sesion", "acontecimiento"), true);
        assert.equal(canGroup("sesion", "sesion"), false);
        assert.equal(canGroup("lore", "era"), true);
        assert.equal(canGroup("era", "lore"), false);
    });
    it("meets a diagonal at the right of the source and the bottom of the target", () => {
        const ports = linkPorts({ x: 0, y: 200, r: 10 }, { x: 160, y: 40, r: 12 });
        assert.equal(ports.fromSide, "right");
        assert.equal(ports.toSide, "bottom");
        assert.equal(ports.x1, 10);
        assert.equal(ports.y1, 200);
        assert.equal(ports.x2, 160);
        assert.equal(ports.y2, 52);
    });
    it("meets a steep rise from the right into the bottom", () => {
        const ports = linkPorts({ x: 0, y: 0, r: 10 }, { x: 48, y: -220, r: 11 });
        assert.equal(ports.fromSide, "right");
        assert.equal(ports.toSide, "bottom");
        assert.equal(ports.x1, 10);
        assert.equal(ports.y1, 0);
        assert.equal(ports.x2, 48);
        assert.equal(ports.y2, -209);
    });
    it("keeps a horizontal line on the facing side centers", () => {
        const ports = linkPorts({ x: 0, y: 0, r: 10 }, { x: 120, y: 4, r: 8 });
        assert.equal(ports.fromSide, "right");
        assert.equal(ports.toSide, "left");
        assert.equal(ports.y1, 0);
        assert.equal(ports.x2, 112);
    });
    it("reads a stored row and keeps one link per pair", () => {
        const links = normalizeLinks([
            { kind: "sigue", from_type: "era", from_id: "a", to_type: "arco", to_id: "b" },
            { kind: "nope", from_type: "era", from_id: "a", to_type: "arco", to_id: "c" },
        ]);
        assert.equal(links.length, 1);
        assert.equal(links[0].fromId, "a");
        const next = upsertLink(links, { kind: "paralelo", fromType: "arco", fromId: "b", toType: "era", toId: "a" });
        assert.equal(next.ok, true);
        assert.equal(next.links.length, 1);
        assert.equal(next.links[0].kind, "paralelo");
        const loreLink = upsertLink([], { kind: "sigue", fromType: "lore", fromId: "sol", toType: "acontecimiento", toId: "e" });
        assert.equal(loreLink.ok, true);
        assert.equal(loreLink.links[0].fromId, "sol");
    });
    it("rejects a cycle on agrupa and sigue, and allows one on paralelo", () => {
        const chain = [
            { kind: "sigue", fromType: "era", fromId: "a", toType: "era", toId: "b", id: "1" },
            { kind: "sigue", fromType: "era", fromId: "b", toType: "era", toId: "c", id: "2" },
        ];
        assert.equal(wouldCycle(chain, "sigue", "c", "a"), true);
        assert.equal(upsertLink(chain, { kind: "sigue", fromType: "era", fromId: "c", toType: "era", toId: "a" }).ok, false);
        assert.equal(upsertLink(chain, { kind: "paralelo", fromType: "era", fromId: "c", toType: "era", toId: "a" }).ok, true);
        assert.equal(upsertLink([], { kind: "agrupa", fromType: "arco", fromId: "a", toType: "era", toId: "b" }).ok, false);
    });
    it("orders the panel by agrupa, sigue and paralelo", () => {
        const links = [
            { kind: "agrupa", fromType: "era", fromId: "p", toType: "acontecimiento", toId: "a", id: "1" },
            { kind: "agrupa", fromType: "era", fromId: "p", toType: "acontecimiento", toId: "b", id: "2" },
            { kind: "agrupa", fromType: "arco", fromId: "q", toType: "acontecimiento", toId: "a", id: "3" },
            { kind: "sigue", fromType: "acontecimiento", fromId: "a", toType: "acontecimiento", toId: "b", id: "4" },
            { kind: "paralelo", fromType: "acontecimiento", fromId: "b", toType: "acontecimiento", toId: "c", id: "5" },
            { kind: "agrupa", fromType: "era", fromId: "p", toType: "acontecimiento", toId: "c", id: "6" },
        ];
        const forest = panelForest(["p", "q", "a", "b", "c"], links, { p: "P", q: "Q", a: "A", b: "B", c: "C" });
        const roots = forest.map((step) => step.map((node) => node.id));
        assert.deepEqual(roots, [["p"], ["q"]]);
        const underP = forest[0][0].steps.map((step) => step.map((node) => node.id));
        assert.deepEqual(underP, [["a"], ["b", "c"]]);
        const underQ = forest[1][0].steps.map((step) => step.map((node) => node.id));
        assert.deepEqual(underQ, [["a"]]);
    });
    it("drops links that touch a deleted node", () => {
        const links = normalizeLinks([era("e"), { kind: "paralelo", from_type: "arco", from_id: "a", to_type: "arco", to_id: "b" }]);
        assert.equal(dropNodeLinks(links, "e").length, 1);
        assert.equal(dropNodeLinks(links, "a").length, 1);
        assert.equal(dropPair(links, "a", "b").length, 1);
        assert.equal(dropPair(links, "e", "x").length, 1);
        assert.equal(dropPair(links, "e", "a").length, 2);
    });
    it("lets a typed node group a neutral one, and not the other way", () => {
        assert.equal(canGroup("era", "neutro"), true);
        assert.equal(canGroup("acontecimiento", "neutro"), true);
        assert.equal(canGroup("sesion", "neutro"), false);
        assert.equal(canGroup("neutro", "acontecimiento"), false);
        assert.equal(groupDirection("acontecimiento", "era"), "ba");
        assert.equal(groupDirection("era", "era"), "ab");
        assert.equal(groupDirection("sesion", "neutro"), "");
    });
    it("accepts a link whose end is a neutral node", () => {
        const next = upsertLink([], { kind: "sigue", fromType: "neutro", fromId: "n", toType: "arco", toId: "a" });
        assert.equal(next.ok, true);
        assert.equal(next.links[0].fromType, "neutro");
    });
    it("seats a parallel set in one row and keeps the leftmost place", () => {
        const row = parallelRow([
            { id: "b", x: 200, y: 40, r: 10 },
            { id: "a", x: 20, y: 80, r: 10 },
            { id: "c", x: 90, y: 10, r: 10 },
        ], 40);
        assert.deepEqual(row.map((n) => n.id), ["a", "c", "b"]);
        assert.equal(row[0].x, 20);
        assert.equal(row[0].y, 80);
        assert.equal(row[1].y, 80);
        assert.equal(row[1].x, 20 + 10 + 10 + 40);
        assert.ok(row[2].x > row[1].x);
    });
    it("offsets a parallel stroke to both sides of the chord", () => {
        const [p, q] = twinPorts({ x1: 0, y1: 0, x2: 100, y2: 0, tx1: 1, ty1: 0, tx2: -1, ty2: 0 }, 3);
        assert.equal(p.y1, 3);
        assert.equal(q.y1, -3);
        assert.equal(p.x1, 0);
        assert.equal(q.x2, 100);
    });
    it("walks a parallel component and retargets links when a node changes type", () => {
        const links = [
            { kind: "paralelo", fromType: "acontecimiento", fromId: "a", toType: "acontecimiento", toId: "b", id: "1" },
            { kind: "paralelo", fromType: "acontecimiento", fromId: "b", toType: "neutro", toId: "n", id: "2" },
            { kind: "agrupa", fromType: "era", fromId: "e", toType: "neutro", toId: "n", id: "3" },
        ];
        assert.deepEqual(parallelIds(links, ["a"]).sort(), ["a", "b", "n"]);
        const moved = linksAfterRetarget(links, "n", "z", "acontecimiento");
        assert.equal(moved.find((l) => l.id === "2").toType, "acontecimiento");
        assert.equal(moved.find((l) => l.id === "3").toId, "z");
        const neutro = normalizeNeutro({ id: "n", title: "", layout_x: 4, layout_y: 0 });
        assert.equal(neutro.title, "Sin título");
        assert.equal(neutro.layoutX, 4);
        assert.equal(neutro.layoutY, 0);
        assert.deepEqual(neutro.people, []);
    });
    it("rolls indexes up the group and does not copy the parent down", () => {
        const links = [
            { kind: "agrupa", fromId: "era", toId: "a1" },
            { kind: "agrupa", fromId: "era", toId: "a2" },
            { kind: "agrupa", fromId: "a1", toId: "e1" },
            { kind: "agrupa", fromId: "a1", toId: "e2" },
            { kind: "agrupa", fromId: "a1", toId: "e3" },
            { kind: "agrupa", fromId: "a2", toId: "e4" },
            { kind: "agrupa", fromId: "a2", toId: "e5" },
        ];
        const own = {
            era: { people: ["pE"], places: [] },
            a1: { people: ["pA"], places: ["lA"] },
            a2: { people: [], places: [] },
            e1: { people: ["p1"], places: ["l1"] },
            e2: { people: ["p2", "p1"], places: [] },
            e3: { people: ["pA"], places: [] },
            e4: { people: ["p4"], places: [] },
            e5: { people: ["p5"], places: ["l5"] },
        };
        const of = (id) => own[id] || { people: [], places: [] };
        const arc1 = rollupIndex("a1", links, of);
        assert.deepEqual(arc1.people.sort(), ["p1", "p2", "pA"]);
        assert.deepEqual(arc1.places.sort(), ["l1", "lA"]);
        assert.deepEqual(arc1.inheritedPeople.sort(), ["p1", "p2"]);
        const arc2 = rollupIndex("a2", links, of);
        assert.deepEqual(arc2.people.sort(), ["p4", "p5"]);
        assert.ok(!arc2.people.includes("pE"));
        const era = rollupIndex("era", links, of);
        assert.deepEqual(era.people.sort(), ["p1", "p2", "p4", "p5", "pA", "pE"]);
        assert.deepEqual(era.places.sort(), ["l1", "l5", "lA"]);
        assert.deepEqual(era.inheritedPeople.sort(), ["p1", "p2", "p4", "p5", "pA"]);
    });
    it("shows an index on the node and back on the character", () => {
        const links = [{ kind: "agrupa", fromId: "era", toId: "arc" }];
        const fichas = [
            { id: "era", entity_type: "era", title: "Valtia 1", index_personajes: ["persona"] },
            { id: "arc", entity_type: "arco", title: "Arco", index_personajes: [], index_lugares: [] },
            { id: "persona", entity_type: "personaje", title: "Persona de prueba" },
        ];
        const onEra = indexFacts(fichas[0], fichas, links);
        assert.deepEqual(onEra.map((f) => [f.verb, f.title, f.inherited]), [["Indexa", "Persona de prueba", false]]);
        const onPerson = indexFacts(fichas[2], fichas, links);
        assert.deepEqual(onPerson.map((f) => [f.verb, f.title, f.inherited]), [["Indexado en", "Valtia 1", false]]);
        const child = { ...fichas[1], index_personajes: ["persona"] };
        const eraOnly = { ...fichas[0], index_personajes: [] };
        const set = [eraOnly, child, fichas[2]];
        const inherited = indexFacts(fichas[2], set, links);
        assert.deepEqual(inherited.map((f) => [f.title, f.inherited]).sort(), [["Arco", false], ["Valtia 1", true]]);
    });
    it("keeps a paint only when the hex and the radius are usable", () => {
        const paints = normalizePaints({
            sol: { color: "#F5C542", aura_color: "magenta", aura_radius: 80 },
            bad: { color: "gold", aura_radius: 4 },
        });
        assert.deepEqual(paints.sol, { color: "#f5c542", auraRadius: 80 });
        assert.equal(paints.bad, undefined);
        assert.deepEqual(paintsToRows(paints).sol, { color: "#f5c542", aura_radius: 80 });
    });
});
