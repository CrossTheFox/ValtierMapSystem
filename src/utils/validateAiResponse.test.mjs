import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    validateSituationResponse,
    validateNarrativeImpactResponse,
    validateCascadeResponse,
    validateAiResponse,
} from "./validateAiResponse.js";
import { AI_MODES } from "../constants/wiki/narrativeAiSchemas.js";

// ── Fixtures Caso 01 (Zorgun / Oni / Felicia) ────────────────────────────────

const zorgun = {
    id: "z1",
    entityType: "personaje",
    title: "Zorgun Margalous",
    tags: ["margalous"],
};
const oni = {
    id: "o1",
    entityType: "personaje",
    title: "Oni Margalous",
    tags: ["margalous", "heredera"],
};
const felicia = {
    id: "f1",
    entityType: "personaje",
    title: "Felicia Margalous",
    tags: ["margalous"],
};
const idioma = {
    id: "l1",
    entityType: "idioma",
    title: "Arvek",
};

const contextEntities = [zorgun, oni, felicia];

const cascadeBase = {
    eventTitle: "Revelación del asesinato",
    eventSummary: "Se descubre que Zorgun mató a Felicia.",
    eventKind: "otro",
    impacts: [
        {
            wave: 1,
            entityTitle: "Oni Margalous",
            reactionArchetype: "intimo",
            emotionalReaction: "Shock y rabia.",
            narrativeHook: "Confronta a Zorgun.",
            changes: [],
            justificationPath: "Oni → descendiente_de → Felicia",
            confidence: "alta",
        },
        {
            wave: 1,
            entityTitle: "Zorgun Margalous",
            reactionArchetype: "guardian",
            emotionalReaction: "Defiende su decisión.",
            narrativeHook: "Cierra filas en la corte.",
            changes: [],
            justificationPath: "Zorgun → relacionado_con → Felicia",
            confidence: "alta",
        },
    ],
    proposedEvent: { shouldCreate: true, title: "Revelación", summary: "...", certainty: "canon" },
    blockedSuggestions: [],
    dmNotes: "",
};

// ── Situation ────────────────────────────────────────────────────────────────

describe("validateSituationResponse", () => {
    it("parses JSON wrapped in markdown fences", () => {
        const raw = '```json\n{"situations":[{"title":"T","hook":"H","stakes":"S","tone":"tension","involvedEntities":[],"dramaticQuestions":[],"dmNotes":"","confidence":"alta"}]}\n```';
        const r = validateSituationResponse(raw, contextEntities);
        assert.equal(r.ok, true);
        assert.equal(r.situations.length, 1);
    });

    it("rejects truncated JSON with descriptive error", () => {
        const raw = '{"situations":[{"title":"T"';
        const r = validateSituationResponse(raw, contextEntities);
        assert.equal(r.ok, false);
        assert.match(r.errors[0], /truncada/i);
    });

    it("flags invented entities and forces confidence baja", () => {
        const raw = {
            situations: [{
                title: "Escena",
                hook: "Gancho",
                stakes: "Stakes",
                tone: "tension",
                involvedEntities: [{ title: "Theron Inventado", role: "testigo", why: "n/a" }],
                dramaticQuestions: ["¿Quién?"],
                dmNotes: "",
                confidence: "alta",
            }],
        };
        const r = validateSituationResponse(raw, contextEntities);
        assert.equal(r.ok, false);
        assert.equal(r.situations[0].confidence, "baja");
        assert.equal(r.situations[0].involvedEntities[0]._invented, true);
    });

    it("resolves first-token match Oni → Oni Margalous", () => {
        const raw = {
            situations: [{
                title: "Escena",
                hook: "Gancho",
                stakes: "Stakes",
                tone: "tension",
                involvedEntities: [{ title: "Oni", role: "protagonista", why: "heredera" }],
                dramaticQuestions: [],
                dmNotes: "",
                confidence: "alta",
            }],
        };
        const r = validateSituationResponse(raw, contextEntities);
        assert.equal(r.ok, true);
        assert.equal(r.situations[0].involvedEntities[0]._resolved?.id, "o1");
    });
});

// ── Narrative impact ─────────────────────────────────────────────────────────

describe("validateNarrativeImpactResponse", () => {
    it("rejects unknown relationType", () => {
        const raw = {
            summary: "Test",
            proposedRelations: [{
                action: "add",
                fromEntityTitle: "Zorgun Margalous",
                toEntityTitle: "Oni Margalous",
                relationType: "tipo_inventado",
                reason: "test",
                confidence: "alta",
            }],
            blockedSuggestions: [],
            dmNotes: "",
        };
        const r = validateNarrativeImpactResponse(raw, contextEntities);
        assert.equal(r.proposedRelations[0].valid, false);
        assert.match(r.proposedRelations[0].validationError, /desconocido/i);
    });

    it("rejects semantically invalid pair (idioma → personaje enemigo_de)", () => {
        const raw = {
            summary: "Test",
            proposedRelations: [{
                action: "add",
                fromEntityTitle: "Arvek",
                toEntityTitle: "Oni Margalous",
                relationType: "enemigo_de",
                reason: "test",
                confidence: "alta",
            }],
            blockedSuggestions: [],
            dmNotes: "",
        };
        const r = validateNarrativeImpactResponse(raw, [idioma, oni]);
        assert.equal(r.proposedRelations[0].valid, false);
        assert.match(r.proposedRelations[0].validationError, /no válida/i);
    });

    it("accepts valid personaje → personaje relacionado_con", () => {
        const raw = {
            summary: "Tregua familiar",
            proposedRelations: [{
                action: "add",
                fromEntityTitle: "Zorgun Margalous",
                toEntityTitle: "Oni Margalous",
                relationType: "relacionado_con",
                label: "distancia emocional",
                reason: "post-revelación",
                confidence: "alta",
            }],
            blockedSuggestions: [],
            dmNotes: "",
        };
        const r = validateNarrativeImpactResponse(raw, contextEntities);
        assert.equal(r.proposedRelations[0].valid, true);
        assert.ok(r.proposedRelations[0].resolvedEndpoints);
        assert.equal(r.proposedRelations[0].resolvedEndpoints.fromEntityId, "z1");
    });

    it("normalizes Spanish labels to snake_case relationType", () => {
        const raw = {
            summary: "Lealtad reforzada",
            proposedRelations: [{
                action: "add",
                fromEntityTitle: "Oni Margalous",
                toEntityTitle: "Zorgun Margalous",
                relationType: "Relacionado con",
                reason: "corrupción Zarken",
                confidence: "alta",
            }],
            blockedSuggestions: [],
            dmNotes: "",
        };
        const r = validateNarrativeImpactResponse(raw, contextEntities);
        assert.equal(r.proposedRelations[0].relationType, "relacionado_con");
        assert.equal(r.proposedRelations[0].valid, true);
    });
});

// ── CASCADE ──────────────────────────────────────────────────────────────────

describe("validateCascadeResponse", () => {
    it("flags unknown reaction archetype", () => {
        const raw = {
            ...cascadeBase,
            impacts: [{
                wave: 1,
                entityTitle: "Oni Margalous",
                reactionArchetype: "arquetipo_falso",
                emotionalReaction: "x",
                narrativeHook: "x",
                changes: [],
                justificationPath: "x",
                confidence: "alta",
            }],
        };
        const r = validateCascadeResponse(raw, contextEntities);
        assert.equal(r.impacts[0].valid, false);
        assert.match(r.impacts[0].validationErrors[0], /Arquetipo desconocido/i);
    });

    it("flags impact with entity not in context", () => {
        const raw = {
            ...cascadeBase,
            impacts: [{
                wave: 1,
                entityTitle: "NPC Inventado",
                emotionalReaction: "x",
                narrativeHook: "x",
                changes: [],
                justificationPath: "x",
                confidence: "alta",
            }],
        };
        const r = validateCascadeResponse(raw, contextEntities);
        assert.equal(r.impacts[0].valid, false);
        assert.match(r.impacts[0].validationErrors[0], /no encontrada/i);
    });

    it("reports missingImpacts when required titles are absent", () => {
        const raw = {
            ...cascadeBase,
            impacts: [cascadeBase.impacts[0]], // only Oni, missing Zorgun
        };
        const r = validateCascadeResponse(raw, contextEntities, null, {
            requiredImpactTitles: ["Oni Margalous", "Zorgun Margalous"],
        });
        assert.deepEqual(r.missingImpacts, ["Zorgun Margalous"]);
        assert.equal(r.ok, false);
    });

    it("ok true when all required impacts present and valid", () => {
        const r = validateCascadeResponse(cascadeBase, contextEntities, null, {
            requiredImpactTitles: ["Oni Margalous", "Zorgun Margalous"],
            expectedWaves: {
                "Oni Margalous": 1,
                "Zorgun Margalous": 1,
            },
        });
        assert.equal(r.ok, true);
        assert.deepEqual(r.missingImpacts, []);
    });

    it("reports waveMismatches as warnings without blocking impact valid", () => {
        const raw = {
            ...cascadeBase,
            impacts: [
                { ...cascadeBase.impacts[0], wave: 2 },
                cascadeBase.impacts[1],
            ],
        };
        const r = validateCascadeResponse(raw, contextEntities, null, {
            requiredImpactTitles: ["Oni Margalous", "Zorgun Margalous"],
            expectedWaves: { "Oni Margalous": 1 },
        });
        assert.equal(r.waveMismatches.length, 1);
        assert.equal(r.waveMismatches[0].title, "Oni Margalous");
        assert.equal(r.waveMismatches[0].expected, 1);
        assert.equal(r.waveMismatches[0].got, 2);
    });

    it("normalizes Spanish relation labels in cascade changes", () => {
        const raw = {
            ...cascadeBase,
            impacts: [{
                ...cascadeBase.impacts[0],
                changes: [{
                    kind: "relation_update",
                    fromEntityTitle: "Oni Margalous",
                    toEntityTitle: "Zorgun Margalous",
                    relationType: "Relacionado con",
                    strengthDelta: 3,
                    reason: "lealtad exclusiva",
                }],
            }],
        };
        const r = validateCascadeResponse(raw, contextEntities);
        const change = r.impacts[0].resolvedChanges[0];
        assert.equal(change.relationType, "relacionado_con");
        assert.equal(change.valid, true);
    });
});

describe("validateAiResponse (unified)", () => {
    it("dispatches to CASCADE mode with options", () => {
        const r = validateAiResponse(
            AI_MODES.CASCADE,
            cascadeBase,
            contextEntities,
            null,
            { requiredImpactTitles: ["Oni Margalous", "Zorgun Margalous"] }
        );
        assert.equal(r.ok, true);
        assert.ok(Array.isArray(r.missingImpacts));
    });
});

// ── entity_state_update ───────────────────────────────────────────────────────

describe("validateCascadeResponse – entity_state_update", () => {
    it("accepts a valid entity_state_update with known narrativeState", () => {
        const raw = {
            ...cascadeBase,
            impacts: [{
                ...cascadeBase.impacts[0],
                changes: [{
                    kind: "entity_state_update",
                    fromEntityTitle: "Oni Margalous",
                    field: "narrativeState",
                    newValue: "corrupta_zarken",
                    reason: "La sangre Zarken la corrompe.",
                }],
            }],
        };
        const r = validateCascadeResponse(raw, contextEntities);
        const change = r.impacts[0].resolvedChanges[0];
        assert.equal(change.kind, "entity_state_update");
        assert.equal(change.valid, true);
    });

    it("inherits impact entityTitle when fromEntityTitle is missing", () => {
        const raw = {
            ...cascadeBase,
            impacts: [{
                ...cascadeBase.impacts[0],
                changes: [{
                    kind: "entity_state_update",
                    // no fromEntityTitle — Gemini often omits it
                    field: "narrativeState",
                    newValue: "quebrada",
                    reason: "Colapso emocional.",
                }],
            }],
        };
        const r = validateCascadeResponse(raw, contextEntities);
        const change = r.impacts[0].resolvedChanges[0];
        assert.equal(change.valid, true);
        assert.equal(change.fromEntityTitle, "Oni Margalous");
    });

    it("normalizes free-text narrativeState to enum", () => {
        const raw = {
            ...cascadeBase,
            impacts: [{
                ...cascadeBase.impacts[0],
                changes: [{
                    kind: "entity_state_update",
                    fromEntityTitle: "Oni Margalous",
                    field: "narrativeState",
                    newValue: "Quebrantado por el dolor y la culpa",
                    reason: "x",
                }],
            }],
        };
        const r = validateCascadeResponse(raw, contextEntities);
        const change = r.impacts[0].resolvedChanges[0];
        assert.equal(change.valid, true);
        assert.equal(change.newValue, "quebrada");
    });

    it("rejects entity_state_update with unknown narrativeState value", () => {
        const raw = {
            ...cascadeBase,
            impacts: [{
                ...cascadeBase.impacts[0],
                changes: [{
                    kind: "entity_state_update",
                    fromEntityTitle: "Oni Margalous",
                    field: "narrativeState",
                    newValue: "estado_inventado",
                    reason: "x",
                }],
            }],
        };
        const r = validateCascadeResponse(raw, contextEntities);
        const change = r.impacts[0].resolvedChanges[0];
        assert.equal(change.valid, false);
        assert.match(change.validationError, /narrativeState desconocido/i);
    });

    it("rejects entity_state_update missing field or newValue", () => {
        const raw = {
            ...cascadeBase,
            impacts: [{
                ...cascadeBase.impacts[0],
                changes: [{
                    kind: "entity_state_update",
                    fromEntityTitle: "Oni Margalous",
                    // missing field and newValue
                    reason: "x",
                }],
            }],
        };
        const r = validateCascadeResponse(raw, contextEntities);
        const change = r.impacts[0].resolvedChanges[0];
        assert.equal(change.valid, false);
    });
});

// ── personalityShift ──────────────────────────────────────────────────────────

describe("validateCascadeResponse – personalityShift", () => {
    it("passes through valid personalityShift attached to an impact", () => {
        const raw = {
            ...cascadeBase,
            impacts: [{
                ...cascadeBase.impacts[0],
                personalityShift: {
                    from: "estable",
                    to: "corrupta_zarken",
                    reason: "Expuesta a la sangre Zarken por Zorgun.",
                },
                changes: [],
            }],
        };
        const r = validateCascadeResponse(raw, contextEntities);
        assert.ok(r.impacts[0].personalityShift);
        assert.equal(r.impacts[0].personalityShift.to, "corrupta_zarken");
    });
});

// ── collectiveImpacts ─────────────────────────────────────────────────────────

const galathia = { id: "g1", entityType: "locacion", title: "Galathia", tags: ["capital"] };

describe("validateCascadeResponse – collectiveImpacts", () => {
    // galathia is included in contextEntities for collective impact tests
    const contextWithGalathia = [...contextEntities, galathia];

    it("validates a valid collective impact for a locacion", () => {
        const raw = {
            ...cascadeBase,
            collectiveImpacts: [{
                wave: 2,
                entityTitle: "Galathia",
                entityKind: "locacion",
                collectiveReaction: "Pánico en las calles.",
                narrativeHook: "Se cierra el mercado principal.",
                changes: [],
                confidence: "media",
            }],
        };
        const r = validateCascadeResponse(raw, contextWithGalathia);
        assert.equal(r.collectiveImpacts.length, 1);
        assert.equal(r.collectiveImpacts[0].valid, true);
        assert.equal(r.collectiveImpacts[0].entityTitle, "Galathia");
    });

    it("flags collective impact referencing unknown entity", () => {
        const raw = {
            ...cascadeBase,
            collectiveImpacts: [{
                wave: 2,
                entityTitle: "Ciudad Inventada",
                entityKind: "locacion",
                collectiveReaction: "Indiferencia.",
                changes: [],
                confidence: "baja",
            }],
        };
        const r = validateCascadeResponse(raw, contextWithGalathia);
        assert.equal(r.collectiveImpacts[0].valid, false);
        assert.match(r.collectiveImpacts[0].validationErrors[0], /no encontrada/i);
    });

    it("flags collective impact on a personaje entity (wrong entityKind)", () => {
        const raw = {
            ...cascadeBase,
            collectiveImpacts: [{
                wave: 2,
                entityTitle: "Oni Margalous",
                entityKind: "personaje",
                collectiveReaction: "Reacción individual.",
                changes: [],
                confidence: "alta",
            }],
        };
        const r = validateCascadeResponse(raw, contextWithGalathia);
        assert.equal(r.collectiveImpacts[0].valid, false);
        assert.match(r.collectiveImpacts[0].validationErrors[0], /entityKind inválido/i);
    });

    it("marks collective relation_* without relationType as invalid (not silently valid)", () => {
        const raw = {
            ...cascadeBase,
            collectiveImpacts: [{
                wave: 2,
                entityTitle: "Galathia",
                entityKind: "locacion",
                collectiveReaction: "Tensión.",
                narrativeHook: "x",
                changes: [{
                    kind: "relation_update",
                    fromEntityTitle: "Zorgun Margalous",
                    toEntityTitle: "Galathia",
                    reason: "Abdicación.",
                }],
                confidence: "media",
            }],
        };
        const r = validateCascadeResponse(raw, contextWithGalathia);
        const ch = r.collectiveImpacts[0].resolvedChanges[0];
        assert.equal(ch.valid, false);
        assert.match(ch.validationError, /relationType/i);
        assert.ok(r.invalidChangeTitles.includes("Galathia"));
    });
});

describe("validateCascadeResponse – repair omissions", () => {
    it("infers field=narrativeState when only newValue enum is present", () => {
        const raw = {
            ...cascadeBase,
            impacts: [{
                ...cascadeBase.impacts[0],
                changes: [{
                    kind: "entity_state_update",
                    fromEntityTitle: "Oni Margalous",
                    newValue: "quebrada",
                    reason: "Colapso.",
                }],
            }],
        };
        const r = validateCascadeResponse(raw, contextEntities);
        const ch = r.impacts[0].resolvedChanges[0];
        assert.equal(ch.valid, true);
        assert.equal(ch.field, "narrativeState");
        assert.equal(ch.newValue, "quebrada");
        assert.equal(ch.repaired, true);
    });

    it("infers field+newValue from personalityShift when state_update is bare", () => {
        const raw = {
            ...cascadeBase,
            impacts: [{
                ...cascadeBase.impacts[0],
                personalityShift: { from: "estable", to: "furiosa", reason: "Ira." },
                changes: [{
                    kind: "entity_state_update",
                    reason: "Estado.",
                }],
            }],
        };
        const r = validateCascadeResponse(raw, contextEntities);
        const ch = r.impacts[0].resolvedChanges[0];
        assert.equal(ch.valid, true);
        assert.equal(ch.field, "narrativeState");
        assert.equal(ch.newValue, "furiosa");
        assert.equal(ch.fromEntityTitle, "Oni Margalous");
    });

    it("infers relationType from existing graph edge when omitted", () => {
        const relations = [{
            id: "r1",
            fromEntityId: "o1",
            toEntityId: "z1",
            relationType: "descendiente_de",
            strength: 9,
        }];
        const raw = {
            ...cascadeBase,
            impacts: [{
                ...cascadeBase.impacts[0],
                changes: [{
                    kind: "relation_update",
                    fromEntityTitle: "Oni Margalous",
                    toEntityTitle: "Zorgun Margalous",
                    strengthDelta: -5,
                    reason: "Ruptura.",
                }],
            }],
        };
        const r = validateCascadeResponse(raw, contextEntities, null, { relations });
        const ch = r.impacts[0].resolvedChanges[0];
        assert.equal(ch.valid, true);
        assert.equal(ch.relationType, "descendiente_de");
        assert.equal(ch.repaired, true);
        assert.deepEqual(r.invalidChangeTitles, []);
    });
});
