import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildEval01Package } from "./eval01Package.js";
import { buildLabReview, effectiveItem } from "./labImpactReview.js";

function ficha(id, entityType, title) {
    return { id, slug: id, entityType, title };
}

const entities = [
    ficha("serene", "personaje", "Reina Serene Alder"),
    ficha("aldric", "personaje", "Rey Aldric Alder"),
    ficha("elara", "personaje", "Princesa Elara Alder"),
    ficha("muerte-serene", "evento_historico", "Muerte de la Reina Serene"),
    ficha("cronica-corte-serene", "cronica", "Retratos de la Corte de Serene"),
    ficha("derecho-divino", "ideologia", "Derecho Divino de los Reyes"),
];

describe("buildEval01Package", () => {
    it("names the fichas that are not on the Lore", () => {
        const built = buildEval01Package({ entities: entities.slice(0, 2) });
        assert.equal(built.ok, false);
        assert.ok(built.missing.includes("Princesa Elara Alder"));
        assert.ok(built.missing.includes("Muerte de la Reina Serene"));
    });

    it("opens the five review items without a model call", () => {
        const built = buildEval01Package({ entities });
        assert.equal(built.ok, true);
        assert.equal(built.result.fixtureId, "eval-01");
        const review = buildLabReview(built.result, { entities, relations: [] });
        const items = review.items.filter((row) => row.kind !== "reaction" && row.kind !== "note");
        const [serene, rejected, fact, blockedPair] = items;
        assert.equal(serene.relationType, "enemigo_de");
        assert.equal(serene.valid, true);
        assert.equal(serene.after, 4);
        assert.equal(rejected.relationType, "enemigo_de");
        assert.equal(rejected.toTitle, "Rey Aldric Alder");
        assert.equal(rejected.valid, true);
        assert.equal(fact.relationType, "participo_en");
        assert.equal(fact.valid, true);
        assert.equal(fact.isStructural, true);
        assert.equal(fact.after, 0);
        assert.equal(blockedPair.valid, false);
        assert.match(blockedPair.error, /aliado_de/);
        const ghost = review.groups.find((group) => group.title?.includes?.("Fantasma") || group.entityTitle === "Reina Fantasma" || !group.entityId);
        assert.ok(review.groups.some((group) => !group.entityId));
        assert.ok(ghost || review.items.some((row) => !row.valid && /Fantasma|no está entre las fichas/i.test(row.error || "")));
    });

    it("finds Elara when the live slug is princesa-elara-alder", () => {
        const live = entities.map((row) => (
            row.id === "elara" ? { ...row, id: "elara-live", slug: "princesa-elara-alder" } : row
        ));
        const built = buildEval01Package({ entities: live });
        assert.equal(built.ok, true);
        const elara = built.result.impacts.find((row) => row.entityTitle === "Princesa Elara Alder");
        assert.equal(elara.entityId, "elara-live");
    });

    it("keeps a strength the DM typed before accept", () => {
        const built = buildEval01Package({ entities });
        const review = buildLabReview(built.result, { entities, relations: [] });
        const item = review.items.find((row) => row.relationType === "enemigo_de" && row.after === 4);
        const edited = effectiveItem(item, { [item.key]: { after: -8 } });
        assert.equal(edited.after, -8);
        assert.match(edited.detail, /−8|-8/);
    });
});
