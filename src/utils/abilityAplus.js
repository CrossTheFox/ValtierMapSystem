import { ABILITY_KINDS, normalizeAbilityKind, normalizeTraitMode, sanitizeTagKeys } from "../constants/abilityKinds.js";

/**
 * Blank attack shape used when `hasAttack` is true but the doc has no `attack` field yet.
 * @returns {{ autoHit: boolean, toHit: { boons: number }, damageOnHit: { formula: string }, damageOnMiss: { formula: string }, damageOnCrit: { formula: string } }}
 */
export function defaultAttackBlank() {
    return {
        autoHit: false,
        toHit: { boons: 0 },
        damageOnHit: { formula: "[damageDie]+[fray]" },
        damageOnMiss: { formula: "[fray]" },
        damageOnCrit: { formula: "2[damageDie]" },
    };
}

function normalizeEffectRow(raw, i) {
    if (!raw || typeof raw !== "object") return null;
    const lane = raw.lane === "hit" || raw.lane === "mech" || raw.lane === "plain" ? raw.lane : "plain";
    return {
        id: String(raw.id || `fx${i}`),
        lane,
        label: String(raw.label ?? (lane === "hit" ? "ON HIT" : lane === "mech" ? "MECH" : "")),
        text: String(raw.text || raw.content || ""),
        statusCode: raw.statusCode != null ? String(raw.statusCode) : null,
        statusTarget: raw.statusTarget != null ? String(raw.statusTarget) : null,
    };
}

function normalizePacket(raw) {
    if (!raw || typeof raw !== "object") return null;
    return { formula: String(raw.formula ?? "") };
}

function normalizeAttack(raw, hasAttack) {
    if (raw && typeof raw === "object") {
        return {
            autoHit: Boolean(raw.autoHit),
            toHit: { boons: Number(raw.toHit?.boons) || 0 },
            damageOnHit: normalizePacket(raw.damageOnHit),
            damageOnMiss: normalizePacket(raw.damageOnMiss),
            damageOnCrit: normalizePacket(raw.damageOnCrit),
            damageAoe: normalizePacket(raw.damageAoe),
        };
    }
    return hasAttack ? defaultAttackBlank() : null;
}

function normalizeUnlockCostAP(raw) {
    if (raw == null || raw === "") return null;
    const n = Math.floor(Number(raw));
    return Number.isFinite(n) && n > 0 ? n : null;
}

const ACTION_COST_WORDS = ["free", "interrupt", "superheavy"];

/** `actionCost` is usually numeric (1, 2…) but the CORE chip enum also allows the
 * free/interrupt/superheavy keywords — preserve those instead of coercing to NaN. */
function normalizeActionCost(raw) {
    if (raw == null || raw === "") return 1;
    if (typeof raw === "string" && ACTION_COST_WORDS.includes(raw.toLowerCase())) {
        return raw.toLowerCase();
    }
    const n = Number(raw);
    return Number.isFinite(n) ? n : 1;
}

/**
 * Blank-safe A+ normalizer — mirrors the "Normalizer (Fase 03)" table in
 * `docs/architecture/phase-01-dossier-kit/ABILITY-FIRESTORE-SCHEMA.md`.
 * Never mutates the input; safe on partial/leftover docs (missing A+ fields).
 * @param {Record<string, unknown>|null|undefined} raw
 */
export function normalizeAbilityAplus(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    const abilityKind = normalizeAbilityKind(src.abilityKind);
    const hasAttack = src.hasAttack != null ? Boolean(src.hasAttack) : abilityKind === ABILITY_KINDS.ATTACK;
    const rawEffects = Array.isArray(src.effects) ? src.effects : [];
    const tags = sanitizeTagKeys(Array.isArray(src.tags) ? src.tags : src.tagKeys);
    const title = String(src.title || src.label || "NEW ABILITY");
    const description = String(src.description ?? src.content ?? src.blurb ?? "");

    return {
        id: String(src.id || src.key || ""),
        key: String(src.key || src.id || ""),
        title,
        label: title,
        description,
        blurb: description,
        hasAttack,
        abilityKind,
        actionCost: normalizeActionCost(src.actionCost),
        range: src.range ?? null,
        aoe: src.aoe ?? null,
        tags,
        tagKeys: tags,
        effects: rawEffects.map(normalizeEffectRow).filter(Boolean),
        attack: normalizeAttack(src.attack, hasAttack),
        traitMode: normalizeTraitMode(src.traitMode),
        traitCategory: src.traitCategory ?? null,
        resolveCost: src.resolveCost != null && src.resolveCost !== "" ? Number(src.resolveCost) : null,
        talents: Array.isArray(src.talents) ? src.talents : [],
        mastery: src.mastery ?? null,
        unlockCostAP: normalizeUnlockCostAP(src.unlockCostAP),
    };
}
