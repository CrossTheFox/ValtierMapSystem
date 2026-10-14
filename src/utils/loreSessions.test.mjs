import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    actaArcId,
    actaEventIds,
    normalizeLoreSessions,
    replaceSessionArc,
    sessionArcId,
    sessionToRow,
    withSessionEvent,
} from "./loreSessions.js";

describe("lore sessions", () => {
    it("reads the stored row and writes it back", () => {
        const [session] = normalizeLoreSessions([{
            id: "s1",
            title: "Idea",
            body: "Todavía no ocurre",
            in_game: "7036-03-01",
            layout_x: 10,
            layout_y: 20,
            event_ids: ["e1"],
            personaje_ids: ["p1"],
        }]);
        assert.equal(session.body, "Todavía no ocurre");
        assert.deepEqual(sessionToRow(session).event_ids, ["e1"]);
    });

    it("hangs an acontecimiento without adding a link", () => {
        const next = withSessionEvent(
            [{ id: "s1", eventIds: [] }],
            "s1",
            "e1",
            "add",
        );
        assert.deepEqual(next[0].eventIds, ["e1"]);
    });

    it("replaces only the arc that groups the session", () => {
        const links = replaceSessionArc([
            { id: "old", kind: "agrupa", from_type: "arco", from_id: "a1", to_type: "sesion", to_id: "s1" },
            { id: "keep", kind: "sigue", from_type: "acontecimiento", from_id: "e1", to_type: "sesion", to_id: "s1" },
        ], "s1", "a2");
        assert.equal(sessionArcId(links, "s1"), "a2");
        assert.equal(links.some((link) => link.kind === "sigue"), true);
        assert.equal(links.some((link) => link.fromId === "a1"), false);
    });

    it("reads the diary arc from agrupa and the cited events from the acta", () => {
        const links = [
            { kind: "agrupa", fromType: "arco", fromId: "arco-1", toType: "sesion", toId: "lore-s" },
        ];
        const session = { loreSessionId: "lore-s", arcId: "", eventIds: ["acta-e"] };
        assert.equal(actaArcId(session, links), "arco-1");
        assert.deepEqual(
            actaEventIds(session, [{ id: "lore-s", eventIds: ["solar-e"] }]),
            ["acta-e", "solar-e"],
        );
        assert.equal(links.some((link) => link.toType === "acontecimiento"), false);
    });
});
