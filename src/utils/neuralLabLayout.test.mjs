import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    normalizeNeuralLabPositions,
    parseNeuralLabLayout,
} from "./neuralLabLayout.js";

describe("neuralLabLayout normalize", () => {
    it("keeps finite rounded coords", () => {
        assert.deepEqual(
            normalizeNeuralLabPositions({
                a: { x: 10.4, y: 20.6 },
                b: { x: "bad", y: 1 },
                c: null,
            }),
            { a: { x: 10, y: 21 } },
        );
    });

    it("parses campaign layout field", () => {
        assert.deepEqual(
            parseNeuralLabLayout({
                neuralLabLayout: { positions: { e1: { x: 100, y: 200 } } },
            }),
            { positions: { e1: { x: 100, y: 200 } } },
        );
        assert.deepEqual(parseNeuralLabLayout(null), { positions: {} });
    });
});
