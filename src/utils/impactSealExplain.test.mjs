import { test } from "node:test";
import assert from "node:assert/strict";
import { SEAL_GRADE, explainImpactSeal, explainOverallSeal } from "./impactSealGrade.js";

const change = (over = {}) => ({ kind: "relation_change", valid: true, ...over });
const impact = (over = {}) => ({
    entityTitle: "Ana",
    entityResolved: { id: "a" },
    valid: true,
    confidence: "alta",
    resolvedChanges: [change()],
    ...over,
});

test("OK impact explains that the ficha and its change are valid", () => {
    const why = explainImpactSeal(impact());
    assert.equal(why.grade, SEAL_GRADE.OK);
    assert.match(why.reasons[0].text, /Ficha encontrada/);
    assert.ok(why.reasons.some((r) => /Confianza alta/.test(r.text)));
});

test("medium confidence alone is a WARN and says the AI is unsure", () => {
    const why = explainImpactSeal(impact({ confidence: "media" }));
    assert.equal(why.grade, SEAL_GRADE.WARN);
    assert.ok(why.reasons.some((r) => /propia IA no está segura/.test(r.text)));
});

test("a repaired change is a WARN and names the repair in plain words", () => {
    const why = explainImpactSeal(impact({ resolvedChanges: [change({ repaired: true, repairNotes: ["relationType←grafo"] })] }));
    assert.equal(why.grade, SEAL_GRADE.WARN);
    assert.ok(why.reasons.some((r) => /se tomó del grafo/.test(r.text)));
});

test("an unknown entity or all-invalid changes is a FAIL with the reason", () => {
    const ghost = explainImpactSeal(impact({ entityResolved: null, entityTitle: "Fantasma" }));
    assert.equal(ghost.grade, SEAL_GRADE.FAIL);
    assert.match(ghost.reasons[0].text, /Fantasma/);

    const bad = explainImpactSeal(impact({ resolvedChanges: [change({ valid: false, validationError: "Cambio 1: tipo desconocido" })] }));
    assert.equal(bad.grade, SEAL_GRADE.FAIL);
    assert.ok(bad.reasons.some((r) => r.text === "tipo desconocido"));
});

test("dm_note changes never count as material", () => {
    const why = explainImpactSeal(impact({ resolvedChanges: [{ kind: "dm_note", valid: false }] }));
    assert.equal(why.grade, SEAL_GRADE.OK);
    assert.match(why.reasons[0].text, /solo propone texto/);
});

test("overall OK needs full coverage, no WARN and dominant high confidence", () => {
    const why = explainOverallSeal({ impacts: [impact(), impact({ entityResolved: { id: "b" }, entityTitle: "Ben" })] });
    assert.equal(why.grade, SEAL_GRADE.OK);
    assert.equal(why.pct, 100);
    assert.ok(why.reasons.every((r) => r.tone === SEAL_GRADE.OK));
});

test("overall WARN when one ficha is WARN, and the reason counts it", () => {
    const why = explainOverallSeal({ impacts: [impact(), impact({ entityResolved: { id: "b" }, confidence: "media" })] });
    assert.equal(why.grade, SEAL_GRADE.WARN);
    assert.ok(why.reasons.some((r) => /1 OK · 1 WARN · 0 FAIL/.test(r.text)));
});

test("overall FAIL below 55 % coverage or with nothing returned", () => {
    const fail = impact({ entityResolved: null });
    const why = explainOverallSeal({ impacts: [impact(), fail, fail] });
    assert.equal(why.grade, SEAL_GRADE.FAIL);
    assert.ok(why.reasons.some((r) => /Cobertura 33 %/.test(r.text)));

    const empty = explainOverallSeal({ impacts: [] });
    assert.equal(empty.grade, SEAL_GRADE.FAIL);
    assert.match(empty.reasons[0].text, /ninguna reacción/);
});

test("missing reactions are reported", () => {
    const why = explainOverallSeal({ impacts: [impact()], missingImpacts: [{}, {}] });
    assert.ok(why.reasons.some((r) => /Faltan 2 reacciones/.test(r.text)));
});
