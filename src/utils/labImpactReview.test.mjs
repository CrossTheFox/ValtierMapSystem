import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    REVIEW,
    buildLabReview,
    canFlip,
    effectiveItem,
    effectOfItem,
    reviewCounts,
    reviewMapChrome,
    upsertNeuralBlock,
    withItemEffect,
    withoutItemEffect,
    syncBlockInto,
} from "./labImpactReview.js";
import { explainImpactSeal } from "./impactSealGrade.js";

const aldric = { id: "aldric", title: "Aldric Venn", entityType: "personaje", narrative_state: "estable" };
const oren = { id: "oren", title: "Oren Sall", entityType: "personaje" };
const mara = { id: "mara", title: "Mara Venn", entityType: "personaje" };
const relations = [
    { id: "r1", fromEntityId: "aldric", toEntityId: "oren", relationType: "enemigo_de", strength: -3 },
];

/** «Lyra Venn muere en el muelle»: the guardian father turns furious and hunts Oren. */
const result = {
    eventTitle: "Lyra Venn muere en el muelle",
    impacts: [
        {
            entityTitle: "Aldric Venn",
            entityId: "aldric",
            entityResolved: aldric,
            valid: true,
            confidence: "alta",
            wave: 1,
            reactionArchetype: "guardian",
            emotionalReaction: "Aldric cierra el puerto y jura encontrar a quien dejó morir a su hija.",
            narrativeHook: "Pone precio a la cabeza de Oren.",
            personalityShift: { from: "estable", to: "furiosa", reason: "pierde a su hija" },
            resolvedChanges: [
                {
                    kind: "relation_update",
                    valid: true,
                    relationType: "enemigo_de",
                    strengthDelta: -5,
                    reason: "lo culpa del incendio",
                    fromEntity: aldric,
                    toEntity: oren,
                    resolvedEndpoints: { fromEntityId: "aldric", toEntityId: "oren" },
                },
                {
                    kind: "relation_add",
                    valid: true,
                    relationType: "aliado_de",
                    proposedStrength: 6,
                    fromEntity: aldric,
                    toEntity: mara,
                    resolvedEndpoints: { fromEntityId: "aldric", toEntityId: "mara" },
                },
                {
                    kind: "relation_add",
                    valid: false,
                    validationError: "Cambio 2: \"participo_en\" es hecho estructural — los impactos IA solo modifican vínculos de afinidad (Sync).",
                    relationType: "participo_en",
                },
                { kind: "dm_note", noteText: "Aldric podría contratar mercenarios." },
            ],
        },
        {
            entityTitle: "Personaje inventado",
            entityResolved: null,
            valid: false,
            validationErrors: ["Entidad \"Personaje inventado\" no encontrada en el contexto."],
            emotionalReaction: "Algo.",
            resolvedChanges: [],
        },
    ],
};

describe("buildLabReview", () => {
    const review = buildLabReview(result, { relations, entities: [aldric, oren, mara] });
    const father = review.groups[0];

    it("splits the father's reaction into reviewable items", () => {
        const kinds = father.items.map((item) => item.kind);
        assert.deepEqual(kinds, ["reaction", "state", "relation_update", "relation_add", "relation_add", "note"]);
        assert.equal(father.items[1].detail, "Estable → Furiosa / iracunda");
        assert.equal(father.items[2].detail, "-3 → -8 (-5)");
        assert.equal(father.items[3].isNew, true);
    });

    it("blocks the invalid change and explains why", () => {
        const bad = father.items[4];
        assert.equal(bad.valid, false);
        assert.match(bad.error, /hecho estructural/);
        assert.doesNotMatch(bad.error, /^Cambio/);
    });

    it("blocks every item of a ficha the AI made up", () => {
        const ghost = review.groups[1];
        assert.equal(ghost.seal.grade, "fail");
        assert.ok(ghost.items.every((item) => !item.valid));
        assert.match(ghost.items[0].error, /no está entre las fichas/);
    });

    it("turns a state change that changes nothing into a note", () => {
        const port = { id: "port", title: "Puerto Gris", entityType: "locacion", collective_mood: "tenso" };
        const same = buildLabReview({
            impacts: [],
            collectiveImpacts: [{
                entityTitle: "Puerto Gris",
                entityResolved: port,
                valid: true,
                confidence: "alta",
                resolvedChanges: [{ kind: "entity_state_update", valid: true, field: "collectiveMood", newValue: "Tenso", fromEntity: port }],
            }],
        }, { entities: [port] });
        const item = same.groups[0].items.find((row) => row.kind === "state");
        assert.equal(item.valid, false);
        assert.equal(item.advisory, true);
        assert.match(item.note, /Sin cambio/);
        assert.equal(reviewCounts(same.groups[0].items, {}).total, 0);
    });

    it("warns when the AI re-adds an existing edge with the sign flipped", () => {
        const flip = buildLabReview({
            impacts: [{
                entityTitle: "Aldric Venn",
                entityResolved: aldric,
                valid: true,
                confidence: "alta",
                resolvedChanges: [{
                    kind: "relation_add", valid: true, relationType: "enemigo_de", strengthDelta: 2,
                    fromEntity: aldric, toEntity: oren,
                    resolvedEndpoints: { fromEntityId: "aldric", toEntityId: "oren" },
                }],
            }],
        }, { relations, entities: [aldric, oren] });
        const item = flip.groups[0].items.find((row) => row.kind === "relation_add");
        assert.equal(item.before, -3);
        assert.equal(item.after, 2);
        assert.equal(item.warnings.length, 2);
        assert.match(item.warnings[0], /ya existe con peso -3/);
        assert.match(item.warnings[1], /invirtió el signo/);
        assert.deepEqual(father.items[2].warnings, []);
    });

    it("flags two reactions that move the same edge", () => {
        const both = buildLabReview({
            impacts: [
                {
                    entityTitle: "Aldric Venn", entityResolved: aldric, valid: true, confidence: "alta",
                    resolvedChanges: [{
                        kind: "relation_update", valid: true, relationType: "enemigo_de", strengthDelta: -4,
                        fromEntity: aldric, toEntity: oren, resolvedEndpoints: { fromEntityId: "aldric", toEntityId: "oren" },
                    }],
                },
                {
                    entityTitle: "Oren Sall", entityResolved: oren, valid: true, confidence: "alta",
                    resolvedChanges: [{
                        kind: "relation_update", valid: true, relationType: "enemigo_de", strengthDelta: 2,
                        fromEntity: oren, toEntity: aldric, resolvedEndpoints: { fromEntityId: "oren", toEntityId: "aldric" },
                    }],
                },
            ],
        }, { relations, entities: [aldric, oren] });
        const [a, o] = both.groups.map((g) => g.items.find((row) => row.kind === "relation_update"));
        assert.match(a.warnings.at(-1), /Oren Sall también mueve este vínculo/);
        assert.match(o.warnings.at(-1), /Aldric Venn también mueve este vínculo/);
        assert.equal(a.delta, -4);
        assert.equal(o.delta, 2);
    });

    it("warns when an enemy adjustment softens the enmity, and the DM can flip it", () => {
        const soft = buildLabReview({
            impacts: [{
                entityTitle: "Aldric Venn", entityResolved: aldric, valid: true, confidence: "alta",
                resolvedChanges: [{
                    kind: "relation_update", valid: true, relationType: "enemigo_de", strengthDelta: 3,
                    fromEntity: aldric, toEntity: oren, resolvedEndpoints: { fromEntityId: "aldric", toEntityId: "oren" },
                }],
            }],
        }, { relations, entities: [aldric, oren] });
        const item = soft.groups[0].items.find((row) => row.kind === "relation_update");
        assert.equal(item.detail, "-3 → 0 (+3)");
        assert.match(item.warnings[0], /la enemistad baja/);
        assert.ok(canFlip(item));
        const fixed = effectiveItem(item, { [item.key]: { flipped: true } });
        assert.equal(fixed.after, -6);
        assert.equal(fixed.delta, -3);
        assert.equal(fixed.detail, "-3 → -6 (-3)");
        assert.deepEqual(fixed.warnings, []);
        assert.equal(effectOfItem(fixed).dmFlipped, true);
        const chrome = reviewMapChrome(soft, { [item.key]: { flipped: true } });
        assert.equal(chrome.edgeDeltas["aldric|oren"].text, "-3");
    });

    it("counts decisions and leaves notes out", () => {
        const decisions = { [father.items[0].key]: { status: REVIEW.ACCEPTED }, [father.items[2].key]: { status: REVIEW.REJECTED } };
        const counts = reviewCounts(father.items, decisions);
        assert.deepEqual(counts, { total: 4, pending: 2, accepted: 1, rejected: 1, blocked: 1 });
    });

    it("paints chips, deltas and a ghost for the new pair", () => {
        const chrome = reviewMapChrome(review, {});
        assert.equal(chrome.marks.aldric.grade, "warn");
        assert.equal(chrome.edgeDeltas["aldric|oren"].text, "-5");
        assert.equal(chrome.ghosts.length, 1);
        assert.equal(chrome.ghosts[0].key, "aldric|mara");
        const decided = Object.fromEntries(father.items.filter((i) => i.valid).map((i) => [i.key, { status: REVIEW.ACCEPTED }]));
        const after = reviewMapChrome(review, decided);
        assert.equal(after.marks.aldric.status, REVIEW.ACCEPTED);
        assert.equal(after.edgeDeltas["aldric|oren"].text, "✓ -5");
        assert.equal(after.ghosts.length, 0);
    });
});

describe("explainImpactSeal", () => {
    it("says why a mixed reaction is WARN", () => {
        const seal = explainImpactSeal(result.impacts[0]);
        assert.equal(seal.grade, "warn");
        assert.ok(seal.reasons.some((r) => /1 de 3 cambios/.test(r.text)));
        assert.ok(seal.reasons.some((r) => /hecho estructural/.test(r.text)));
    });

    it("says why a clean reaction is OK", () => {
        const seal = explainImpactSeal({
            ...result.impacts[0],
            resolvedChanges: result.impacts[0].resolvedChanges.slice(0, 2),
        });
        assert.equal(seal.grade, "ok");
        assert.match(seal.reasons[0].text, /2 cambios son válidos/);
        assert.ok(seal.reasons.some((r) => /Confianza alta/.test(r.text)));
    });

    it("blames self-declared medium confidence on the AI", () => {
        const seal = explainImpactSeal({ ...result.impacts[0], confidence: "media", resolvedChanges: [] });
        assert.equal(seal.grade, "warn");
        assert.ok(seal.reasons.some((r) => /la propia IA/.test(r.text)));
    });
});

describe("neural lab block", () => {
    const review = buildLabReview(result, { relations, entities: [aldric, oren, mara] });
    const group = review.groups[0];
    const meta = { runId: "run1", group, eventTitle: result.eventTitle };

    it("grows with each accepted item and disappears when emptied", () => {
        let blocks = [{ id: "old", body: "previo" }];
        blocks = upsertNeuralBlock(blocks, meta, (b) => withItemEffect(b, group.items[0], "Aldric cierra el puerto."));
        blocks = upsertNeuralBlock(blocks, meta, (b) => withItemEffect(b, group.items[2]));
        assert.equal(blocks.length, 2);
        const block = blocks[0];
        assert.equal(block.source, "neural_lab");
        assert.equal(block.seal, "warn");
        assert.equal(block.relationEffects[0].before, -3);
        assert.equal(block.relationEffects[0].after, -8);
        blocks = upsertNeuralBlock(blocks, meta, (b) => withoutItemEffect(b, group.items[0]));
        blocks = upsertNeuralBlock(blocks, meta, (b) => withoutItemEffect(b, group.items[2]));
        assert.deepEqual(blocks.map((b) => b.id), ["old"]);
    });

    it("mirrors a block into another list without reordering", () => {
        const list = [{ id: "a" }, { id: "nl-run1-aldric", body: "x" }];
        assert.deepEqual(syncBlockInto(list, "nl-run1-aldric", { id: "nl-run1-aldric", body: "y" }).map((b) => b.body), [undefined, "y"]);
        assert.deepEqual(syncBlockInto(list, "nl-run1-aldric", null).map((b) => b.id), ["a"]);
    });
});
