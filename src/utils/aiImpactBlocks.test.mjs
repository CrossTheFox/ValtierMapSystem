import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    buildAiImpactBlockBody,
    buildRelationEffectsFromImpact,
    createAiImpactBlock,
    narrativeBodyOfBlock,
    relationEffectsOfBlock,
    sanitizeNarrativeImpactBody,
    stripPartnerImpactBoilerplate,
} from "./aiImpactBlocks.js";

describe("aiImpactBlocks narrative vs sync", () => {
    const impact = {
        entityTitle: "Rey Aldric",
        emotionalReaction: "Culpa y dolor.",
        narrativeHook: "Enfrenta a su hija.",
        entityResolved: { id: "a1", title: "Rey Aldric" },
        resolvedChanges: [
            {
                kind: "relation_update",
                valid: true,
                fromEntityTitle: "Princesa Elara",
                toEntityTitle: "Rey Aldric",
                fromEntity: { id: "e1", title: "Princesa Elara" },
                toEntity: { id: "a1", title: "Rey Aldric" },
                relationType: "descendiente_de",
                strengthDelta: -5,
            },
        ],
    };

    it("buildAiImpactBlockBody omits Sync lines", () => {
        const body = buildAiImpactBlockBody(impact);
        assert.match(body, /Culpa/);
        assert.doesNotMatch(body, /Sync/i);
        assert.doesNotMatch(body, /descendiente/);
    });

    it("createAiImpactBlock stores relationEffects apart from body", () => {
        const block = createAiImpactBlock(impact, { eventTitle: "Verdad" }, { entities: [] });
        assert.ok(block);
        assert.doesNotMatch(block.body, /Sync/i);
        assert.equal(block.relationEffects.length, 1);
        assert.equal(block.relationEffects[0].strengthDelta, -5);
    });

    it("primary body never uses Afectada por boilerplate", () => {
        const block = createAiImpactBlock(impact, { eventTitle: "La Falsa Partida" }, {
            forEntity: { id: "a1", title: "Rey Aldric" },
            entities: [],
        });
        assert.doesNotMatch(block.body, /Afectada por/i);
        assert.match(block.body, /Culpa/);
    });

    it("missing primaryId still treats title match as primary", () => {
        const loose = {
            ...impact,
            entityResolved: { title: "Rey Aldric" },
        };
        const block = createAiImpactBlock(loose, { eventTitle: "X" }, {
            forEntity: { id: "a1", title: "Rey Aldric" },
            entities: [],
        });
        assert.doesNotMatch(block.body, /Afectada por/i);
    });

    it("partner body keeps Afectada por context", () => {
        const block = createAiImpactBlock(impact, { eventTitle: "Verdad" }, {
            forEntity: { id: "e1", title: "Princesa Elara" },
            entities: [],
        });
        assert.match(block.body, /Afectada por/);
        assert.match(block.body, /Rey Aldric/);
    });

    it("display strips partner boilerplate on primary/legacy blocks", () => {
        const raw = "Afectada por «Verdad» (impacto de @[Elara](e1)).\nContexto: Culpa abrumadora.";
        assert.equal(
            narrativeBodyOfBlock({ body: raw, primaryEntityId: "e1", forEntityId: "e1" }),
            "Culpa abrumadora.",
        );
        assert.equal(stripPartnerImpactBoilerplate(raw), "Culpa abrumadora.");
        assert.match(
            narrativeBodyOfBlock({ body: raw, primaryEntityId: "a1", forEntityId: "e1" }),
            /Afectada por/,
        );
    });

    it("sanitize strips legacy Sync lines from editable body", () => {
        const raw = "Culpa abrumadora.\nSync @[Elara](e1) -> @[Aldric](a1): -5 (descendiente de)";
        const clean = sanitizeNarrativeImpactBody(raw);
        assert.equal(clean, "Culpa abrumadora.");
        assert.doesNotMatch(narrativeBodyOfBlock({ body: raw }), /Sync/i);
        const fx = relationEffectsOfBlock({ body: raw });
        assert.equal(fx.length, 1);
        assert.match(fx[0].legacyLabel, /Sync/);
    });

    it("buildRelationEffectsFromImpact maps deltas", () => {
        const fx = buildRelationEffectsFromImpact(impact);
        assert.equal(fx[0].fromTitle, "Princesa Elara");
        assert.equal(fx[0].strengthDelta, -5);
    });
});
