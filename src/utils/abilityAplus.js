import { ABILITY_KINDS, normalizeAbilityKind, normalizeTraitMode, sanitizeTagKeys } from "../constants/abilityKinds.js";
import { deriveCritFormula, standardAttackPackets } from "./abilityDamageD.js";
import { deriveAbilityFlavorText } from "./abilityContentParser.js";

/**
 * Blank attack shape — three-tier ICON model (LIGHT / HEAVY / CRIT / MISS).
 */
export function defaultAttackBlank() {
    const packets = standardAttackPackets();
    return {
        autoHit: false,
        toHit: { boons: 0 },
        ...packets,
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
    const formula = String(raw.formula ?? "");
    return formula ? { formula } : null;
}

/**
 * Legacy docs stored Roll20 Heavy line in `damageOnCrit`. Remap to three-tier shape.
 * @param {{ damageOnHit?: { formula?: string }, damageOnHeavy?: { formula?: string }, damageOnCrit?: { formula?: string } }} raw
 */
function migrateLegacyAttackPackets(raw) {
    const light = raw.damageOnHit?.formula;
    const heavy = raw.damageOnHeavy?.formula;
    const crit = raw.damageOnCrit?.formula;
    if (heavy) {
        return {
            damageOnHit: light ? { formula: light } : null,
            damageOnHeavy: { formula: heavy },
            damageOnCrit: crit
                ? { formula: crit }
                : { formula: deriveCritFormula(light, heavy) },
        };
    }
    if (light && crit && !heavy) {
        return {
            damageOnHit: { formula: light },
            damageOnHeavy: { formula: crit },
            damageOnCrit: { formula: deriveCritFormula(light, crit) },
        };
    }
    return {
        damageOnHit: light ? { formula: light } : null,
        damageOnHeavy: null,
        damageOnCrit: crit ? { formula: crit } : null,
    };
}

function normalizeAttack(raw, hasAttack) {
    if (raw && typeof raw === "object") {
        const migrated = migrateLegacyAttackPackets(raw);
        const attack = {
            autoHit: Boolean(raw.autoHit),
            toHit: { boons: Number(raw.toHit?.boons) || 0 },
            damageOnHit: normalizePacket(migrated.damageOnHit) || normalizePacket(raw.damageOnHit),
            damageOnHeavy: normalizePacket(migrated.damageOnHeavy),
            damageOnCrit: normalizePacket(migrated.damageOnCrit) || normalizePacket(raw.damageOnCrit),
            damageOnMiss: normalizePacket(raw.damageOnMiss),
            damageAoe: normalizePacket(raw.damageAoe),
        };
        if (!attack.damageOnCrit?.formula && attack.damageOnHit?.formula) {
            attack.damageOnCrit = {
                formula: deriveCritFormula(
                    attack.damageOnHit.formula,
                    attack.damageOnHeavy?.formula || "",
                ),
            };
        }
        return attack;
    }
    return hasAttack ? defaultAttackBlank() : null;
}

function normalizeUnlockCostAP(raw) {
    if (raw == null || raw === "") return null;
    const n = Math.floor(Number(raw));
    return Number.isFinite(n) && n > 0 ? n : null;
}

const ACTION_COST_WORDS = ["free", "interrupt", "superheavy"];

/**
 * Parse action cost from header line or legacy `cost` field (`1|2 Actions`, `1/2 Actions`).
 * @param {string|null|undefined} text
 * @returns {{ actionCost: number, actionCostMin: number, actionCostFlex: boolean }|null}
 */
export function parseActionCostText(text) {
    const s = String(text || "");
    const pipe = s.match(/(\d)\s*[|/]\s*(\d)\s+Actions?/i);
    if (pipe) {
        const min = Number(pipe[1]);
        const max = Number(pipe[2]);
        return { actionCost: max, actionCostMin: min, actionCostFlex: min < max };
    }
    const single = s.match(/\b(\d+)\s+Actions?\b/i);
    if (single) {
        const n = Number(single[1]);
        return { actionCost: n, actionCostMin: n, actionCostFlex: false };
    }
    const actionWord = s.match(/\b1\s*Action\b/i);
    if (actionWord) return { actionCost: 1, actionCostMin: 1, actionCostFlex: false };
    return null;
}

function normalizeActionCost(raw) {
    if (raw == null || raw === "") return 1;
    if (typeof raw === "string" && ACTION_COST_WORDS.includes(raw.toLowerCase())) {
        return raw.toLowerCase();
    }
    const n = Number(raw);
    return Number.isFinite(n) ? n : 1;
}

/**
 * Parse `1|2 Actions` from legacy `cost` field.
 * @param {string|null|undefined} text
 */
export function parseActionCostFromCostField(text) {
    return parseActionCostText(text);
}

/**
 * @param {Record<string, unknown>} src
 * @returns {{ actionCost: number|string, actionCostMin: number, actionCostFlex: boolean }}
 */
export function normalizeActionCostFields(src) {
    const fromCost = src.cost ? parseActionCostText(String(src.cost)) : null;
    const fromContent = src.content || src.description
        ? parseActionCostText(String(src.content || src.description).split(/\r?\n/).slice(0, 6).join("\n"))
        : null;
    const inferred = fromCost?.actionCostFlex ? fromCost : (fromContent?.actionCostFlex ? fromContent : fromCost || fromContent);

    let actionCost = src.actionCost != null && src.actionCost !== ""
        ? normalizeActionCost(src.actionCost)
        : (inferred?.actionCost ?? 1);
    let actionCostMin = src.actionCostMin != null && src.actionCostMin !== ""
        ? Math.max(1, Math.floor(Number(src.actionCostMin) || 1))
        : (inferred?.actionCostMin ?? 1);
    let actionCostFlex = src.actionCostFlex != null
        ? Boolean(src.actionCostFlex)
        : Boolean(inferred?.actionCostFlex);

    if (actionCost === "superheavy") {
        actionCostMin = 2;
        actionCostFlex = false;
    } else if (actionCostFlex && typeof actionCost === "number") {
        actionCostMin = Math.min(actionCostMin, actionCost);
    } else if (typeof actionCost === "number") {
        actionCostMin = actionCost;
        actionCostFlex = false;
    }

    return { actionCost, actionCostMin, actionCostFlex };
}

/** Default actions spent when Play dialog is skipped. */
export function inferDefaultActionsSpent(node) {
    if (!node) return 1;
    if (node.actionCostFlex) return node.actionCostMin ?? 1;
    const c = node.actionCost;
    if (c === "superheavy") return 2;
    if (typeof c === "number" && c >= 2) return c;
    return 1;
}

/**
 * Patch to toggle attack mode on a kit node (dossier edit).
 * @param {boolean} enable
 */
export function toggleHasAttackPatch(enable) {
    if (enable) {
        return {
            hasAttack: true,
            abilityKind: ABILITY_KINDS.ATTACK,
            attack: defaultAttackBlank(),
        };
    }
    return {
        hasAttack: false,
        abilityKind: ABILITY_KINDS.STANDARD,
        attack: null,
    };
}

/**
 * Whether Play should open the launch dialog (actions and/or boons).
 * @param {Record<string, unknown>|null|undefined} merged
 * @param {{ kind?: string }} [opts]
 */
export function needsPlayLaunchDialog(merged, opts = {}) {
    if (opts.kind === "trait") return false;
    if (!merged) return false;
    if (merged.actionCostFlex) return true;
    if (merged.hasAttack && merged.attack && !merged.attack.autoHit) return true;
    return false;
}

/**
 * Props for PlayLaunchDialog sections.
 * @param {Record<string, unknown>|null|undefined} merged
 */
export function getPlayLaunchDialogProps(merged) {
    const flex = Boolean(merged?.actionCostFlex);
    const maxCost = merged?.actionCost === "superheavy"
        ? 2
        : (typeof merged?.actionCost === "number" ? merged.actionCost : 1);
    const minCost = merged?.actionCostMin ?? 1;
    const showActions = flex || (maxCost >= 2 && minCost < maxCost);
    const showBoons = Boolean(merged?.hasAttack && merged?.attack && !merged.attack.autoHit);
    return {
        showActions,
        showBoons,
        actionMin: minCost,
        actionMax: flex ? maxCost : maxCost,
        defaultActionsSpent: flex ? minCost : maxCost,
    };
}

/**
 * Blank-safe A+ normalizer.
 * @param {Record<string, unknown>|null|undefined} raw
 */
export function normalizeAbilityAplus(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    const abilityKind = normalizeAbilityKind(src.abilityKind);
    const hasAttack = src.hasAttack != null ? Boolean(src.hasAttack) : abilityKind === ABILITY_KINDS.ATTACK;
    const rawEffects = Array.isArray(src.effects) ? src.effects : [];
    const tags = sanitizeTagKeys([
        ...(Array.isArray(src.tagKeys) ? src.tagKeys : []),
        ...(Array.isArray(src.tags) ? src.tags : []),
    ]);
    const title = String(src.title || src.label || "NEW ABILITY");
    const description = deriveAbilityFlavorText({ ...src, tags, tagKeys: tags });
    const actionFields = normalizeActionCostFields(src);

    return {
        id: String(src.id || src.key || ""),
        key: String(src.key || src.id || ""),
        title,
        label: title,
        description,
        blurb: description,
        hasAttack,
        abilityKind,
        actionCost: actionFields.actionCost,
        actionCostMin: actionFields.actionCostMin,
        actionCostFlex: actionFields.actionCostFlex,
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
