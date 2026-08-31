import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    buildAbilityAplusPatch,
    classifyAbilityDoc,
    convertRoll20ToAplusFormula,
    deriveAbilityFlavorText,
    looksLikeStructuredKitBody,
    parseAttackTickets,
    parseContentSections,
    parseHeaderMeta,
} from "./abilityContentParser.js";
import { deriveCritFormula } from "./abilityDamageD.js";
import { normalizeAbilityAplus } from "./abilityAplus.js";
import { sanitizeTagKeys } from "../constants/abilityKinds.js";

const ANCHOR_CONTENT = `Light: [1d[@{damage-die}]+@{fray}]
Heavy: [2d[@{damage-die}]+@{fray}] dwdwd w
Miss: [@{fray}]

Efecto: Cada Gema consumida otorga +1 Boon al ataque (máx. 2). Con la 3ª gema el ataque obtiene Divine y realiza [@{fray}] de daño adicional.

Narrativo: Cada gema consumida aumenta la estabilidad/control del hechizo lanzado, pero disminuye su efectividad/alcance.`;

describe("convertRoll20ToAplusFormula", () => {
    it("maps damage-die and fray tokens", () => {
        assert.equal(
            convertRoll20ToAplusFormula("1d[@{damage-die}]+@{fray}"),
            "1d[damageDie]+[fray]",
        );
        assert.equal(convertRoll20ToAplusFormula("@{fray}"), "[fray]");
    });
});

describe("parseHeaderMeta", () => {
    it("parses flexible 1|2 Actions as max=2 flex", () => {
        const meta = parseHeaderMeta("**Range 1** · 1|2 Actions\nLight: [1d8]");
        assert.equal(meta.actionCost, 2);
        assert.equal(meta.actionCostMin, 1);
        assert.equal(meta.actionCostFlex, true);
    });
});

describe("parseAttackTickets", () => {
    it("parses Anchor Light/Heavy/Miss and ignores trailing garbage", () => {
        const tickets = parseAttackTickets(ANCHOR_CONTENT);
        assert.equal(tickets.light, "1d[damageDie]+[fray]");
        assert.equal(tickets.heavy, "2d[damageDie]+[fray]");
        assert.equal(tickets.miss, "[fray]");
    });

    it("parses pipe-separated Damage | Miss & AoE (Verita's Cut)", () => {
        const tickets = parseAttackTickets(
            "Damage: [[1d@{damage-die}+@{fray}]] | Miss & AoE: [[@{fray}]]",
        );
        assert.equal(tickets.light, "1d[damageDie]+[fray]");
        assert.equal(tickets.miss, "[fray]");
        assert.equal(tickets.aoe, "[fray]");
    });
});

describe("parseContentSections", () => {
    it("splits Efecto and Narrativo for Anchor", () => {
        const { effects, narrative, preamble } = parseContentSections(ANCHOR_CONTENT);
        assert.equal(preamble, "");
        assert.equal(effects.length, 1);
        assert.equal(effects[0].label, "EFECTO");
        assert.match(effects[0].text, /Cada Gema consumida/);
        assert.match(effects[0].text, /\[fray\]/);
        assert.match(narrative, /estabilidad\/control/);
    });
});

describe("deriveCritFormula (three-tier)", () => {
    it("doubles max D between light and heavy tiers", () => {
        assert.equal(
            deriveCritFormula("1d[damageDie]+[fray]", "2d[damageDie]+[fray]"),
            "4d[damageDie]+[fray]",
        );
    });
});

describe("classifyAbilityDoc", () => {
    it("marks Anchor as attack", () => {
        const c = classifyAbilityDoc({ type: "ability", content: ANCHOR_CONTENT });
        assert.equal(c.abilityKind, "attack");
        assert.equal(c.hasAttack, true);
        assert.equal(c.needsReview, false);
    });

    it("marks dome abilities as standard", () => {
        const c = classifyAbilityDoc({
            type: "ability",
            content: "**Range 4** · 2 Actions · **Blast 4**\n\nEnemigos en el área quedan Dazed+.",
        });
        assert.equal(c.abilityKind, "standard");
        assert.equal(c.hasAttack, false);
    });

    it("flags meridiano prose attacks for review (abilities only)", () => {
        const c = classifyAbilityDoc({
            type: "ability",
            content: "**Ranged Attack** vs un objetivo; daño light/heavy/miss según mesa.",
        });
        assert.equal(c.abilityKind, "attack");
        assert.ok(c.needsReview);
        assert.ok(c.reviewReasons.includes("attack-prose-without-tickets"));
    });

    it("does not treat mastery prose as attack", () => {
        const c = classifyAbilityDoc({
            type: "mastery",
            content: "tras un miss con Anchor, +1 boon al ranged Attack roll",
        });
        assert.equal(c.abilityKind, "standard");
        assert.equal(c.hasAttack, false);
    });
});

describe("buildAbilityAplusPatch", () => {
    it("builds three-tier attack + effects for Anchor", () => {
        const result = buildAbilityAplusPatch({
            type: "ability",
            key: "judeth-ability-anchor",
            label: "ANCHOR",
            content: ANCHOR_CONTENT,
            abilityKind: "attack",
        });
        assert.equal(result.skip, false);
        assert.equal(result.patch.abilityKind, "attack");
        assert.equal(result.patch.hasAttack, true);
        assert.equal(result.patch.attack.damageOnHit.formula, "1d[damageDie]+[fray]");
        assert.equal(result.patch.attack.damageOnHeavy.formula, "2d[damageDie]+[fray]");
        assert.equal(result.patch.attack.damageOnCrit.formula, "4d[damageDie]+[fray]");
        assert.equal(result.patch.attack.damageOnMiss.formula, "[fray]");
        assert.equal(result.patch.effects.length, 1);
        assert.match(result.patch.content, /^Light: \[1d\[@\{damage-die\}\]/);
        assert.doesNotMatch(result.patch.content, /dwdwd/);
    });

    it("single-action attack omits heavy tier but derives crit from light", () => {
        const result = buildAbilityAplusPatch({
            type: "ability",
            content: "Condena · 1 Action · Melee\nAttack: [1d20]\nLight: [1d[@{damage-die}]+@{fray}]\nMiss: [@{fray}]",
            actionCost: 1,
        });
        assert.equal(result.patch.attack.damageOnHit.formula, "1d[damageDie]+[fray]");
        assert.equal(result.patch.attack.damageOnHeavy, undefined);
        assert.equal(result.patch.attack.damageOnCrit.formula, "2d[damageDie]+[fray]");
    });

    it("patches action cost flex on docs that already have attack object", () => {
        const result = buildAbilityAplusPatch({
            type: "ability",
            key: "judeth-ability-anchor",
            cost: "1–3 Z-Gems · 1|2 Actions",
            attack: { damageOnHit: { formula: "1d[damageDie]+[fray]" } },
        });
        assert.equal(result.skip, false);
        assert.equal(result.patch.actionCost, 2);
        assert.equal(result.patch.actionCostMin, 1);
        assert.equal(result.patch.actionCostFlex, true);
    });

    it("skips docs that already carry a structured attack object", () => {
        const result = buildAbilityAplusPatch({
            type: "ability",
            attack: { damageOnHit: { formula: "1d8" } },
        });
        assert.equal(result.skip, true);
        assert.equal(result.reason, "already-has-attack-object");
    });

    it("hygiene patch merges tagKeys and tags and drops homebrew", () => {
        const result = buildAbilityAplusPatch({
            type: "ability",
            attack: { damageOnHit: { formula: "2d[damageDie]" } },
            tagKeys: ["divine"],
            tags: ["attack", "homebrew", "risk"],
            description: "Solo narrativa.",
            blurb: "Solo narrativa.",
        });
        assert.equal(result.skip, false);
        assert.deepEqual(result.patch.tagKeys, ["divine", "attack", "risk"]);
        assert.deepEqual(result.patch.tags, result.patch.tagKeys);
    });

    it("hygiene patch strips structured blurb on docs with attack object", () => {
        const ANATHEMA_CONTENT = `Light: [2d[@{damage-die}]]
Heavy: [3d[@{damage-die}]]
Miss: [1d[@{damage-die}]]

Efecto: Cada Gema consumida otorga +3 de daño.
Riesgo: Al resolver, tira 1d6 por Gema.
Narrativo: Más gemas = más alcance y menos control.`;

        const result = buildAbilityAplusPatch({
            type: "ability",
            key: "judeth-ability-anathema",
            tagKeys: ["attack", "homebrew", "risk"],
            description: ANATHEMA_CONTENT,
            blurb: ANATHEMA_CONTENT,
            attack: {
                damageOnHit: { formula: "2d[damageDie]" },
                damageOnHeavy: { formula: "3d[damageDie]" },
                damageOnCrit: { formula: "6d[damageDie]" },
                damageOnMiss: { formula: "1d[damageDie]" },
            },
            effects: [
                { id: "fx1", lane: "mech", label: "EFECTO", text: "Cada Gema consumida otorga +3 de daño." },
                { id: "fx2", lane: "mech", label: "RIESGO", text: "Al resolver, tira 1d6 por Gema." },
            ],
        });
        assert.equal(result.skip, false);
        assert.equal(result.patch.blurb, "Más gemas = más alcance y menos control.");
        assert.equal(result.patch.description, result.patch.blurb);
        assert.deepEqual(result.patch.tagKeys, ["attack", "risk"]);
        assert.ok(looksLikeStructuredKitBody(ANATHEMA_CONTENT));
        assert.ok(!looksLikeStructuredKitBody(result.patch.blurb));
    });

    it("parses plural Efectos section", () => {
        const sections = parseContentSections(
            "Efectos: por cada gema sumas daño.\n\nRiesgo: tira 1d6.\n\nNarrativo: caos.",
        );
        assert.equal(sections.effects.length, 2);
        assert.equal(sections.effects[0].label, "EFECTO");
        assert.equal(sections.narrative, "caos.");
    });

    it("deriveAbilityFlavorText prefers clean blurb over structured content", () => {
        const flavor = deriveAbilityFlavorText({
            blurb: "Más gemas = más alcance.",
            content: "Light: [2d[damageDie]]\nEfecto: foo",
        });
        assert.equal(flavor, "Más gemas = más alcance.");
    });

    it("normalizeAbilityAplus never uses structured content as flavor", () => {
        const merged = normalizeAbilityAplus({
            label: "ANATHEMA",
            content: `Light: [2d[damageDie]]
Efecto: foo
Narrativo: solo narrativa.`,
            effects: [{ id: "fx1", lane: "mech", label: "EFECTO", text: "foo" }],
        });
        assert.equal(merged.blurb, "solo narrativa.");
        assert.equal(merged.description, "solo narrativa.");
    });

    it("sanitizeTagKeys drops homebrew", () => {
        assert.deepEqual(sanitizeTagKeys(["attack", "homebrew", "risk"]), ["attack", "risk"]);
    });

    it("skips class_root docs", () => {
        const result = buildAbilityAplusPatch({ type: "class_root", content: "Job lore" });
        assert.equal(result.skip, true);
        assert.equal(result.reason, "type:class_root");
    });

    it("migrates traits with inferred traitMode", () => {
        const result = buildAbilityAplusPatch({
            type: "trait",
            key: "judeth-trait-alternate-ending",
            label: "ALTERNATE ENDING",
            content: "Si un ataque falla, puedes gastar 1 Gema para relanzar.",
        });
        assert.equal(result.skip, false);
        assert.equal(result.patch.traitMode, "trigger");
        assert.equal(result.patch.abilityKind, "standard");
    });
});
