import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { labImpactChrome } from "./labImpactMarks.js";

describe("labImpactChrome", () => {
    it("marks the ficha and the edge with the same delta the queue shows", () => {
        const relations = [{
            id: "r1",
            fromEntityId: "a",
            toEntityId: "b",
            relationType: "aliado_de",
            strength: 4,
        }];
        const { marks, edgeDeltas } = labImpactChrome({
            impacts: [{
                entityId: "a",
                entityTitle: "Ana",
                valid: true,
                confidence: "alta",
                entityResolved: { id: "a", entityType: "personaje" },
                resolvedChanges: [{
                    kind: "relation_update",
                    valid: true,
                    relationType: "aliado_de",
                    strengthDelta: 3,
                    fromEntity: { id: "a", entityType: "personaje" },
                    toEntity: { id: "b", entityType: "personaje" },
                    resolvedEndpoints: { fromEntityId: "a", toEntityId: "b" },
                }],
            }],
        }, relations);

        assert.equal(marks.a.grade, "ok");
        assert.match(marks.a.label, /4 → 7 \(\+3\)/);
        assert.equal(edgeDeltas["a|b"].text, "+3");
        assert.equal(edgeDeltas["a|b"].color, "#3dd68c");
    });

    it("puts a state change on the ficha chip", () => {
        const { marks, edgeDeltas } = labImpactChrome({
            impacts: [{
                entityId: "lugar",
                valid: true,
                confidence: "alta",
                entityResolved: { id: "lugar" },
                resolvedChanges: [{
                    kind: "entity_state_update",
                    valid: true,
                    field: "narrativeState",
                    newValue: "alterado",
                }],
            }],
        });
        assert.match(marks.lugar.label, /estado alterado/);
        assert.equal(Object.keys(edgeDeltas).length, 0);
    });

    it("returns empty chrome when there is no result", () => {
        const chrome = labImpactChrome(null);
        assert.deepEqual(chrome.marks, {});
        assert.deepEqual(chrome.edgeDeltas, {});
    });
});
