import { defaultAttackBlank, parseActionCostText } from "./abilityAplus.js";
import { ABILITY_KINDS, normalizeTraitMode, sanitizeTagKeys } from "../constants/abilityKinds.js";
import {
    deriveCritFormula,
    standardAttackPackets,
} from "./abilityDamageD.js";

/** Kit nodes migrated by the A+ backfill (everything except lore roots). */
export const KIT_NODE_TYPES = Object.freeze([
    "ability",
    "trait",
    "upgrade",
    "mastery",
    "ultimate",
]);

/** @typedef {{ light?: string, heavy?: string, crit?: string, miss?: string, aoe?: string }} AttackTickets */

const TICKET_LINE_RE =
    /^(Light|Ligero|Heavy|Pesado|Crit(?:ical)?|Miss(?:\s*&\s*AoE)?|Fallo|AoE|Damage|Ataque)\s*:\s*(.*)$/i;

const SECTION_START_RE =
    /^(Efectos?|Effect|Riesgo|Narrativo|Pasiva|Switch|Recall|Stance)\s*:\s*(.*)$/i;

const STRUCTURED_BODY_RE =
    /^(?:Light|Heavy|Crit|Miss|AoE|Ligero|Pesado|Fallo|Efectos?|Effect|Riesgo)\s*:/im;

const BOLD_EFFECT_RE = /^\*\*Effect:\*\*\s*(.*)$/i;

/**
 * Convert Roll20 @{token} / bracket syntax to A+ formula tokens.
 * @param {string|null|undefined} raw
 * @returns {string}
 */
export function convertRoll20ToAplusFormula(raw) {
    if (raw == null || raw === "") return "";
    let s = String(raw).trim();
    while (s.startsWith("[") && s.endsWith("]")) {
        s = s.slice(1, -1).trim();
    }
    s = s.replace(/@\{([a-zA-Z0-9_-]+)\}/g, (_full, key) => {
        const k = String(key).toLowerCase();
        if (k === "damage-die" || k === "damagedie") return "[damageDie]";
        if (k === "fray") return "[fray]";
        const camel = k.replace(/-([a-z])/g, (_m, c) => c.toUpperCase());
        return `[${camel}]`;
    });
    s = s.replace(/\s+/g, "");
    // Roll20 nests die size: 1d[@{damage-die}] → 1d[[damageDie]] after token pass — collapse.
    while (/\[\[[^\]]+\]\]/.test(s)) {
        s = s.replace(/\[\[([^\]]+)\]\]/g, "[$1]");
    }
    return s;
}

/**
 * Extract the first nested `[...]` roll body from a line tail.
 * @param {string} tail
 * @returns {string|null}
 */
export function extractFirstRollBracket(tail) {
    const text = String(tail || "");
    const idx = text.indexOf("[");
    if (idx < 0) return null;
    let depth = 0;
    for (let j = idx; j < text.length; j += 1) {
        if (text[j] === "[") depth += 1;
        else if (text[j] === "]") {
            depth -= 1;
            if (depth === 0) return text.slice(idx + 1, j).trim();
        }
    }
    return null;
}

/** @param {string} label */
function normalizeTicketKey(label) {
    const s = String(label || "").toLowerCase().replace(/\s+/g, "");
    if (s === "light" || s === "ligero" || s === "damage" || s === "ataque") return "light";
    if (s === "heavy" || s === "pesado") return "heavy";
    if (s === "crit" || s === "critical") return "crit";
    if (s === "miss" || s === "fallo" || s === "miss&aoe") return "miss";
    if (s === "aoe") return "aoe";
    return s;
}

/**
 * Parse Light/Heavy/Miss/AoE/Damage ticket lines from legacy ability content.
 * @param {string} content
 * @returns {AttackTickets}
 */
export function parseAttackTickets(content) {
    /** @type {AttackTickets} */
    const tickets = {};
    const lines = String(content || "").split(/\r?\n/);
    for (const line of lines) {
        const segments = line.split(/\s*\|\s*/);
        for (const seg of segments) {
            const m = seg.trim().match(TICKET_LINE_RE);
            if (!m) continue;
            const key = normalizeTicketKey(m[1]);
            const bracket = extractFirstRollBracket(m[2]);
            const formula = convertRoll20ToAplusFormula(bracket || m[2]);
            if (!formula) continue;
            if (key === "miss" && /miss\s*&\s*aoe/i.test(m[1])) {
                tickets.miss = formula;
                tickets.aoe = tickets.aoe || formula;
            } else {
                tickets[key] = formula;
            }
        }
    }
    return tickets;
}

/**
 * Convert @{tokens} in prose to A+ `[token]` form for effects/description.
 * @param {string} text
 * @returns {string}
 */
export function convertRoll20TokensInText(text) {
    let s = String(text || "");
    s = s.replace(/\[@\{([a-zA-Z0-9_-]+)\}\]/g, (_full, key) => convertRoll20ToAplusFormula(`@{${key}}`));
    s = s.replace(/@\{([a-zA-Z0-9_-]+)\}/g, (_full, key) => {
        const k = String(key).toLowerCase();
        if (k === "damage-die" || k === "damagedie") return "[damageDie]";
        if (k === "fray") return "[fray]";
        const camel = k.replace(/-([a-z])/g, (_m, c) => c.toUpperCase());
        return `[${camel}]`;
    });
    while (/\[\[[^\]]+\]\]/.test(s)) {
        s = s.replace(/\[\[([^\]]+)\]\]/g, "[$1]");
    }
    return s;
}

/**
 * Strip attack ticket lines and rebuild a clean content body (optional hygiene).
 * @param {string} content
 * @returns {string}
 */
export function stripAttackTicketLines(content) {
    const kept = [];
    for (const line of String(content || "").split(/\r?\n/)) {
        const trimmed = line.trim();
        if (/^Attack:\s*\[1d20\]/i.test(trimmed)) continue;
        if (/^Tiradas?\s*:/i.test(trimmed)) continue;
        const segments = line.split(/\s*\|\s*/);
        const nonTicket = segments.filter((seg) => !TICKET_LINE_RE.test(seg.trim()));
        if (nonTicket.length) kept.push(nonTicket.join(" | "));
    }
    return kept.join("\n").trim();
}

/**
 * True when prose still embeds ticket/effect lines that belong in structured fields.
 * @param {string|null|undefined} text
 */
export function looksLikeStructuredKitBody(text) {
    const t = String(text || "").trim();
    if (!t) return false;
    if (STRUCTURED_BODY_RE.test(t)) return true;
    for (const line of t.split(/\r?\n/)) {
        if (TICKET_LINE_RE.test(line.trim())) return true;
    }
    return false;
}

/**
 * Flavor-only text for chat/dossier — preamble + narrative, never tickets/effects.
 * @param {Record<string, unknown>} [doc]
 */
export function deriveAbilityFlavorText(doc = {}) {
    for (const field of ["blurb", "description"]) {
        const value = String(doc[field] || "").trim();
        if (!value) continue;
        if (!looksLikeStructuredKitBody(value)) return value;
    }

    for (const field of ["blurb", "content", "description"]) {
        const value = String(doc[field] || "").trim();
        if (!value || !looksLikeStructuredKitBody(value)) continue;
        const sections = parseContentSections(value);
        const fromSections = [sections.preamble, sections.narrative].filter(Boolean).join("\n\n").trim();
        if (fromSections && !looksLikeStructuredKitBody(fromSections)) return fromSections;
        if (sections.narrative.trim()) return sections.narrative.trim();
    }

    for (const field of ["content", "blurb", "description"]) {
        const value = String(doc[field] || "").trim();
        if (value && !looksLikeStructuredKitBody(value)) return value;
    }
    return "";
}

/**
 * Patch blurb/description/effects/tags on docs that already have structured attack.
 * @param {Record<string, unknown>} doc
 */
export function buildHygienePatch(doc) {
    const type = String(doc.type || "");
    if (type === "class_root" || !KIT_NODE_TYPES.includes(type)) return {};

    /** @type {Record<string, unknown>} */
    const patch = {};
    const flavor = deriveAbilityFlavorText(doc);
    const curDesc = String(doc.description ?? "").trim();
    const curBlurb = String(doc.blurb ?? "").trim();
    if (flavor !== curDesc || flavor !== curBlurb) {
        patch.description = flavor;
        patch.blurb = flavor;
    }

    const content = String(doc.content || doc.description || "");
    const sections = parseContentSections(content);
    if ((!Array.isArray(doc.effects) || !doc.effects.length) && sections.effects.length) {
        patch.effects = sections.effects.map((fx, i) => ({
            id: `fx${i + 1}`,
            lane: fx.lane,
            label: fx.label,
            text: fx.text,
            statusCode: null,
            statusTarget: null,
        }));
    }

    const rawTagKeys = Array.isArray(doc.tagKeys) ? doc.tagKeys : [];
    const rawTags = Array.isArray(doc.tags) ? doc.tags : [];
    const mergedRaw = [...rawTagKeys, ...rawTags];
    if (mergedRaw.length) {
        const cleaned = sanitizeTagKeys(mergedRaw);
        const keysMatch = JSON.stringify(cleaned) === JSON.stringify(sanitizeTagKeys(rawTagKeys));
        const tagsMatch = JSON.stringify(cleaned) === JSON.stringify(sanitizeTagKeys(rawTags));
        if (!keysMatch || !tagsMatch) {
            patch.tagKeys = cleaned;
            patch.tags = cleaned;
        }
    }

    return patch;
}

/** @param {string} label */
function sectionMeta(label) {
    const s = String(label || "").toLowerCase();
    if (s === "efecto" || s === "efectos") return { lane: "mech", label: "EFECTO", kind: "effect" };
    if (s === "effect") return { lane: "plain", label: "EFFECT", kind: "effect" };
    if (s === "riesgo") return { lane: "mech", label: "RIESGO", kind: "effect" };
    if (s === "narrativo") return { kind: "narrative" };
    if (s === "pasiva" || s === "switch" || s === "recall" || s === "stance") {
        return { lane: "plain", label: s.toUpperCase(), kind: "effect" };
    }
    return { lane: "plain", label: String(label || "").toUpperCase(), kind: "effect" };
}

/**
 * Parse labeled sections (Efecto, Effect, Riesgo, Narrativo, **Effect:**, etc.).
 * @param {string} content
 * @returns {{ effects: Array<{ lane: string, label: string, text: string }>, narrative: string, preamble: string }}
 */
export function parseContentSections(content) {
    const text = stripAttackTicketLines(content).replace(/^Attack:\s*\[1d20\]\s*$/gim, "");
    /** @type {Array<{ lane: string, label: string, text: string }>} */
    const effects = [];
    let narrative = "";
    let preamble = "";
    let current = null;

    const flush = () => {
        if (!current) return;
        const body = convertRoll20TokensInText(current.text.join("\n").trim());
        if (!body) {
            current = null;
            return;
        }
        if (current.kind === "narrative") {
            narrative = narrative ? `${narrative}\n\n${body}` : body;
        } else {
            effects.push({ lane: current.lane, label: current.label, text: body });
        }
        current = null;
    };

    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trimEnd();
        const boldFx = line.match(BOLD_EFFECT_RE);
        if (boldFx) {
            flush();
            const meta = sectionMeta("effect");
            current = { ...meta, text: [boldFx[1].trim()] };
            continue;
        }

        const inlineFx = line.match(/\*\*Effect:\*\*\s*(.+)/i);
        if (inlineFx && !SECTION_START_RE.test(line)) {
            flush();
            const meta = sectionMeta("effect");
            current = { ...meta, text: [inlineFx[1].trim()] };
            continue;
        }

        const section = line.match(SECTION_START_RE);
        if (section) {
            flush();
            const meta = sectionMeta(section[1]);
            const rest = section[2].trim();
            current = { ...meta, text: rest ? [rest] : [] };
            continue;
        }

        if (!current) {
            preamble = preamble ? `${preamble}\n${line}` : line;
        } else {
            current.text.push(line);
        }
    }
    flush();

    // Catch remaining **Effect:** blocks embedded in preamble paragraphs.
    const extraFx = [];
    const preambleClean = preamble.replace(
        /\*\*Effect:\*\*\s*([^\n*]+(?:\n(?!\*\*)[^\n]*)*)/gi,
        (_full, body) => {
            extraFx.push({
                lane: "plain",
                label: "EFFECT",
                text: convertRoll20TokensInText(body.trim()),
            });
            return "";
        },
    ).trim();

    return {
        effects: [...effects, ...extraFx].filter((fx) => fx.text),
        narrative: narrative.trim(),
        preamble: preambleClean.trim(),
    };
}

/**
 * @param {string} content
 * @returns {{ range: string|null, aoe: string|null, actionCost: number|null, actionCostMin: number|null, actionCostFlex: boolean }}
 */
export function parseHeaderMeta(content) {
    const head = String(content || "").split(/\r?\n/).slice(0, 6).join("\n");
    const rangeBold = head.match(/\*\*Range\s+([^*]+)\*\*/i);
    const rangePlain = head.match(/\bRange\s+([\d–\-]+)/i);
    const blast = head.match(/\*\*Blast\s+(\d+)\*\*/i);
    const parsed = parseActionCostText(head);

    return {
        range: (rangeBold?.[1] || rangePlain?.[1] || null)?.trim() || null,
        aoe: blast ? `Blast ${blast[1]}` : null,
        actionCost: parsed?.actionCost ?? null,
        actionCostMin: parsed?.actionCostMin ?? null,
        actionCostFlex: Boolean(parsed?.actionCostFlex),
    };
}

/**
 * @param {string} content
 * @returns {boolean}
 */
export function detectAutoHit(content) {
    const c = String(content || "");
    return /\bautohit\b/i.test(c)
        || /\bauto[\s-]?hit\b/i.test(c)
        || /\bno\s+(?:requiere|necesita)\s+(?:tirada|roll)\s+de\s+ataque\b/i.test(c);
}

/**
 * Infer trait activation mode from prose (traits only).
 * @param {string} content
 * @param {Record<string, unknown>} [doc]
 */
export function inferTraitMode(content, doc = {}) {
    if (doc.traitMode) {
        return {
            mode: normalizeTraitMode(doc.traitMode),
            inferred: false,
            needsReview: false,
        };
    }
    const c = String(content || "").toLowerCase();
    if (/\binterrupt\b|\binterrumpe/i.test(c)) {
        return { mode: "interrupt", inferred: true, needsReview: false };
    }
    if (
        /\b(?:cuando|when|si un ataque|si falla|al (?:acertar|fallar|inicio|final)|tras un|antes o después|1×\/ronda|por ronda|1 vez por combate|terminas turno)\b/i.test(c)
    ) {
        return { mode: "trigger", inferred: true, needsReview: false };
    }
    if (/\b(?:rescue|prowl|diaga|bless|teletransporte)\b/i.test(c)) {
        return { mode: "active", inferred: true, needsReview: false };
    }
    if (/\b(?:\d+\s*actions?|1\|2 actions|gasta.*acción|stance:|activa:|activable)\b/i.test(c)) {
        return { mode: "active", inferred: true, needsReview: false };
    }
    if (/\b(?:pasiv|mientras|siempre|aura|armor\s*\d|dodge|slip|prowl)\b/i.test(c)) {
        return { mode: "passive", inferred: true, needsReview: false };
    }
    return { mode: "passive", inferred: true, needsReview: true };
}

/**
 * LB resolve chip — only set when explicit in doc or clearly parseable.
 * @param {string} content
 * @param {Record<string, unknown>} [doc]
 */
export function inferResolveCost(content, doc = {}) {
    if (doc.resolveCost != null && doc.resolveCost !== "") {
        const n = Number(doc.resolveCost);
        return { value: Number.isFinite(n) ? n : null, inferred: false, needsReview: false };
    }
    const m = String(content || "").match(/\bresolve\s*(?:cost)?\s*[:=]?\s*(\d+)/i);
    if (m) {
        return { value: Number(m[1]), inferred: true, needsReview: false };
    }
    if (/\bresolve\b/i.test(content)) {
        return { value: null, inferred: true, needsReview: true };
    }
    return { value: null, inferred: false, needsReview: false };
}

/**
 * Heuristic: should this kit node be an attack card?
 * @param {Record<string, unknown>} doc
 * @returns {{ abilityKind: string, hasAttack: boolean, tickets: AttackTickets, needsReview: boolean, reviewReasons: string[] }}
 */
export function classifyAbilityDoc(doc) {
    const docType = String(doc.type || "ability");
    const content = String(doc.content || doc.description || "");
    const tickets = parseAttackTickets(content);
    const hasTicketFormulas = Boolean(tickets.light || tickets.heavy || tickets.miss || tickets.aoe);
    /** @type {string[]} */
    const reviewReasons = [];

    const hasAttackRollLine = /^Attack:\s*\[1d20\]/im.test(content);
    const hasDamageLine = /\bDamage:\s*\[/i.test(content);
    const proseAttack =
        /\bRanged Attack\b/i.test(content)
        || /\bMelee Attack\b/i.test(content)
        || /\blight\/heavy\/miss\b/i.test(content);
    const shortAttackVerb = /\bAtaca\b/i.test(content) && content.length < 220;

    const strictType = docType !== "ability";
    const zoneAbility =
        /\b(?:Burst|Blast)\s+\d+\b/i.test(content)
        && !hasTicketFormulas
        && !hasAttackRollLine
        && !hasDamageLine;
    const stanceAbility =
        (/\bStance:\b/i.test(content) || /\*\*Switch:\*\*/i.test(content))
        && !hasTicketFormulas;

    let isAttack = false;
    if (hasTicketFormulas || hasAttackRollLine || hasDamageLine) {
        isAttack = true;
    } else if (!strictType && proseAttack && !zoneAbility && !stanceAbility) {
        isAttack = true;
        reviewReasons.push("attack-prose-without-tickets");
    } else if (!strictType && shortAttackVerb && !zoneAbility && !stanceAbility) {
        isAttack = true;
        reviewReasons.push("attack-verb-without-tickets");
    }

    if (isAttack && !detectAutoHit(content) && !tickets.miss && hasTicketFormulas) {
        reviewReasons.push("missing-miss-ticket");
    }

    if (doc.abilityKind === ABILITY_KINDS.ATTACK && !isAttack) {
        reviewReasons.push("kind-attack-but-no-attack-signals");
    }

    return {
        abilityKind: isAttack ? ABILITY_KINDS.ATTACK : ABILITY_KINDS.STANDARD,
        hasAttack: isAttack,
        tickets,
        needsReview: reviewReasons.length > 0,
        reviewReasons,
    };
}

/**
 * @param {AttackTickets} tickets
 * @param {Record<string, unknown>|null|undefined} existingAttack
 * @param {string} content
 * @param {{ actionCost?: number|string|null, allowsHeavy?: boolean }} [meta]
 */
export function buildAttackObject(tickets, existingAttack = null, content = "", meta = {}) {
    const base = existingAttack && typeof existingAttack === "object"
        ? existingAttack
        : defaultAttackBlank();
    const defaults = standardAttackPackets();
    const autoHit = Boolean(base.autoHit) || detectAutoHit(content);

    const lightFormula = tickets.light || tickets.damage || base.damageOnHit?.formula || defaults.damageOnHit.formula;
    const allowsHeavy = meta.allowsHeavy !== false
        && (Boolean(tickets.heavy)
            || /\b1\s*\|\s*2\s+actions?\b/i.test(content)
            || /\b2\s+actions?\b/i.test(content)
            || Number(meta.actionCost) >= 2);
    const heavyFormula = tickets.heavy
        || (allowsHeavy ? (base.damageOnHeavy?.formula || defaults.damageOnHeavy.formula) : null);
    const critFormula = tickets.crit
        || deriveCritFormula(lightFormula, heavyFormula || "")
        || base.damageOnCrit?.formula
        || defaults.damageOnCrit.formula;

    const attack = {
        autoHit,
        toHit: { boons: Number(base.toHit?.boons) || 0 },
        damageOnHit: { formula: lightFormula },
        damageOnCrit: { formula: critFormula },
        damageOnMiss: {
            formula: tickets.miss || base.damageOnMiss?.formula || defaults.damageOnMiss.formula,
        },
    };

    if (heavyFormula) {
        attack.damageOnHeavy = { formula: heavyFormula };
    }

    if (autoHit) {
        attack.damageOnMiss = { formula: "" };
    }

    const aoeFormula = tickets.aoe || base.damageAoe?.formula;
    if (aoeFormula) {
        attack.damageAoe = { formula: aoeFormula };
    }

    return attack;
}

/**
 * Build Firestore patch for A+ fields from a legacy kit node document.
 * @param {Record<string, unknown>} doc
 * @param {{ force?: boolean, preserveStructuredAttack?: boolean }} [opts]
 */
export function buildAbilityAplusPatch(doc, opts = {}) {
    const type = String(doc.type || "");
    if (type === "class_root") {
        return { skip: true, reason: "type:class_root" };
    }
    if (!KIT_NODE_TYPES.includes(type)) {
        return { skip: true, reason: `type:${type || "unknown"}` };
    }

    const content = String(doc.content || doc.description || "");
    const classification = classifyAbilityDoc(doc);
    const sections = parseContentSections(content);
    const header = parseHeaderMeta(content);

    const hasStructuredAttack =
        doc.attack
        && typeof doc.attack === "object"
        && (
            doc.attack.damageOnHit?.formula
            || doc.attack.damageOnCrit?.formula
            || doc.attack.damageOnMiss?.formula
        );

    if (hasStructuredAttack && !opts.force) {
        const hygienePatch = buildHygienePatch(doc);
        const costPatch = {};
        const costParsed = doc.cost ? parseActionCostText(String(doc.cost)) : null;
        const flexSource = costParsed?.actionCostFlex ? costParsed : (header.actionCostFlex ? header : null);
        if (flexSource && !doc.actionCostFlex) {
            costPatch.actionCost = flexSource.actionCost;
            costPatch.actionCostMin = flexSource.actionCostMin ?? 1;
            costPatch.actionCostFlex = true;
        }
        const patch = { ...costPatch, ...hygienePatch };
        if (!Object.keys(patch).length) {
            return {
                skip: true,
                reason: "already-has-attack-object",
                classification,
            };
        }
        return {
            skip: false,
            patch,
            classification,
            docType: type,
            needsReview: false,
            reviewReasons: [],
        };
    }

    /** @type {string[]} */
    const reviewReasons = [...classification.reviewReasons];

    /** @type {Record<string, unknown>} */
    const patch = {
        abilityKind: classification.abilityKind,
        hasAttack: classification.hasAttack,
    };

    if (classification.hasAttack) {
        patch.attack = buildAttackObject(
            classification.tickets,
            opts.preserveStructuredAttack ? doc.attack : null,
            content,
            { actionCost: header.actionCost ?? doc.actionCost },
        );
    } else {
        patch.attack = null;
    }

    const effectRows = sections.effects.map((fx, i) => ({
        id: `fx${i + 1}`,
        lane: fx.lane,
        label: fx.label,
        text: fx.text,
        statusCode: null,
        statusTarget: null,
    }));

    if (effectRows.length) {
        patch.effects = effectRows;
    } else if (!Array.isArray(doc.effects) || !doc.effects.length) {
        patch.effects = [];
    }

    const rawTagKeys = Array.isArray(doc.tagKeys) ? doc.tagKeys : [];
    const rawTags = Array.isArray(doc.tags) ? doc.tags : [];
    const mergedRaw = [...rawTagKeys, ...rawTags];
    if (mergedRaw.length) {
        patch.tagKeys = sanitizeTagKeys(mergedRaw);
        patch.tags = patch.tagKeys;
    }

    const flavor = deriveAbilityFlavorText({
        ...doc,
        content,
        effects: effectRows.length ? effectRows : doc.effects,
    });
    patch.description = flavor;
    patch.blurb = flavor;

    if (header.range && doc.range == null) patch.range = header.range;
    if (header.aoe && doc.aoe == null) patch.aoe = header.aoe;
    if (header.actionCost != null && doc.actionCost == null) patch.actionCost = header.actionCost;
    if (header.actionCostMin != null && doc.actionCostMin == null) patch.actionCostMin = header.actionCostMin;
    if (header.actionCostFlex && doc.actionCostFlex == null) patch.actionCostFlex = true;

    const costParsed = doc.cost ? parseActionCostText(String(doc.cost)) : null;
    if (costParsed) {
        if (doc.actionCost == null) patch.actionCost = costParsed.actionCost;
        if (doc.actionCostMin == null) patch.actionCostMin = costParsed.actionCostMin;
        if (doc.actionCostFlex == null && costParsed.actionCostFlex) patch.actionCostFlex = true;
    }

    if (type === "trait") {
        const traitMode = inferTraitMode(content, doc);
        if (!doc.traitMode) patch.traitMode = traitMode.mode;
        if (traitMode.needsReview) reviewReasons.push("trait-mode-inferred");
    }

    if (type === "ultimate") {
        const resolve = inferResolveCost(content, doc);
        if (resolve.value != null && doc.resolveCost == null) {
            patch.resolveCost = resolve.value;
        } else if (doc.resolveCost == null) {
            patch.resolveCost = 3;
        }
        if (resolve.needsReview) reviewReasons.push("resolve-cost-inferred");
    }

    if (classification.hasAttack && classification.tickets.light) {
        const ticketsOut = {
            ...classification.tickets,
            crit: classification.tickets.crit
                || (patch.attack && typeof patch.attack === "object" ? patch.attack.damageOnCrit?.formula : null),
        };
        patch.content = rebuildAttackContent({
            tickets: ticketsOut,
            effects: effectRows,
            narrative: sections.narrative,
            preamble: sections.preamble,
        });
    } else if (classification.hasAttack) {
        patch.content = convertRoll20TokensInText(stripAttackTicketLines(content));
    }

    return {
        skip: false,
        patch,
        classification,
        docType: type,
        needsReview: reviewReasons.length > 0,
        reviewReasons: [...new Set(reviewReasons)],
    };
}

/**
 * Canonical Spanish/VTT content for attack abilities with structured tickets.
 * @param {{ tickets: AttackTickets, effects: Array<{ label: string, text: string }>, narrative: string, preamble: string }} parts
 */
export function rebuildAttackContent(parts) {
    const lines = [];
    if (parts.preamble) lines.push(parts.preamble, "");

    const toRoll20Bracket = (formula) => {
        let s = String(formula || "");
        s = s.replace(/(\d*)d\[damageDie\]/gi, "$1d[@{damage-die}]");
        s = s.replace(/\[fray\]/gi, "@{fray}");
        s = s.replace(/\[damageDie\]/gi, "[@{damage-die}]");
        if (s === "@{fray}") return "[@{fray}]";
        return `[${s}]`;
    };

    if (parts.tickets.light) lines.push(`Light: ${toRoll20Bracket(parts.tickets.light)}`);
    if (parts.tickets.heavy) lines.push(`Heavy: ${toRoll20Bracket(parts.tickets.heavy)}`);
    if (parts.tickets.crit) lines.push(`Crit: ${toRoll20Bracket(parts.tickets.crit)}`);
    if (parts.tickets.miss) lines.push(`Miss: ${toRoll20Bracket(parts.tickets.miss)}`);
    if (parts.tickets.aoe && parts.tickets.aoe !== parts.tickets.miss) {
        lines.push(`AoE: ${toRoll20Bracket(parts.tickets.aoe)}`);
    }
    if (lines.length) lines.push("");

    for (const fx of parts.effects) {
        const label = fx.label === "EFECTO" ? "Efecto" : fx.label === "RIESGO" ? "Riesgo" : fx.label;
        lines.push(`${label}: ${fx.text}`);
    }
    if (parts.narrative) {
        if (parts.effects.length) lines.push("");
        lines.push(`Narrativo: ${parts.narrative}`);
    }
    return lines.join("\n").trim();
}
