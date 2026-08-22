/**
 * Shared wiki title → entity resolution for mentions + AI validation.
 * Prefer exact / whole-word / personaje matches; never silently pick among ties.
 */

import { WIKI_ENTITY_TYPES } from "../constants/wikiEntityTypes.js";

const STOP_WORDS = new Set([
    "el", "la", "los", "las", "un", "una", "unos", "unas",
    "de", "del", "al", "a", "en", "con", "por", "para", "que",
    "y", "o", "u", "e", "ni", "pero", "sino", "aunque",
    "se", "le", "lo", "me", "te", "nos", "os", "su",
    "si", "no", "sí", "ya", "más", "muy", "tan", "bien",
    "es", "era", "fue", "son", "hay", "tiene",
    "rey", "reina", "princesa", "principe", "príncipe",
    "casa", "orden", "guardia", "gran", "san", "santa",
]);

const TYPE_RANK = {
    [WIKI_ENTITY_TYPES.PERSONAJE]: 100,
    [WIKI_ENTITY_TYPES.ORGANIZACION]: 70,
    [WIKI_ENTITY_TYPES.LOCACION]: 65,
    [WIKI_ENTITY_TYPES.IDEOLOGIA]: 50,
    [WIKI_ENTITY_TYPES.CRONICA]: 20,
    [WIKI_ENTITY_TYPES.EVENTO_HISTORICO]: 15,
};

/**
 * @param {string} value
 */
export function foldTitleText(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .trim();
}

/**
 * @param {string} title
 * @returns {string[]}
 */
export function titleTokens(title) {
    return foldTitleText(title)
        .split(/[^a-z0-9ñ]+/i)
        .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
}

/**
 * @param {object[]} entities
 */
export function buildEntityTitleIndex(entities = []) {
    const byExact = new Map();
    /** @type {Map<string, object[]>} */
    const byToken = new Map();
    /** @type {Map<string, object[]>} */
    const byTag = new Map();

    for (const e of entities) {
        if (!e?.title) continue;
        const norm = foldTitleText(e.title);
        byExact.set(norm, e);

        for (const tok of titleTokens(e.title)) {
            if (!byToken.has(tok)) byToken.set(tok, []);
            byToken.get(tok).push(e);
        }

        for (const tag of e.tags ?? []) {
            const t = foldTitleText(tag);
            if (t.length < 3) continue;
            if (!byTag.has(t)) byTag.set(t, []);
            byTag.get(t).push(e);
        }
    }

    return { byExact, byToken, byTag, all: entities.filter((e) => e?.title) };
}

/**
 * @param {object} entity
 * @param {string} key folded query
 * @param {string} matchType
 */
function scoreCandidate(entity, key, matchType) {
    const title = foldTitleText(entity.title);
    const tokens = titleTokens(entity.title);
    const typeBoost = TYPE_RANK[entity.entityType] ?? 30;
    // Prefer tighter titles (Rey Aldric Alder over long chronicle titles).
    const lengthPenalty = Math.min(40, title.length);

    let base = 0;
    switch (matchType) {
        case "exact":
            base = 1000;
            break;
        case "token_unique":
            base = 800;
            if (tokens[0] === key) base += 40;
            if (tokens[tokens.length - 1] === key) base += 20;
            break;
        case "tag":
            base = 500;
            break;
        case "prefix_unique":
            base = 450;
            break;
        case "word_substring":
            base = 300;
            break;
        default:
            base = 100;
    }

    return base + typeBoost - lengthPenalty;
}

/**
 * Resolve a free-text title / name fragment to a unique wiki entity.
 * @param {string} rawTitle
 * @param {object[]} entities
 * @param {{ index?: ReturnType<typeof buildEntityTitleIndex> }} [opts]
 * @returns {{ entity: object|null, matchType: string|null, ambiguous: object[] }}
 */
export function resolveEntityByTitle(rawTitle, entities = [], opts = {}) {
    const key = foldTitleText(rawTitle);
    if (!key || key.length < 2) {
        return { entity: null, matchType: null, ambiguous: [] };
    }

    const idx = opts.index ?? buildEntityTitleIndex(entities);

    if (idx.byExact.has(key)) {
        return { entity: idx.byExact.get(key), matchType: "exact", ambiguous: [] };
    }

    /** @type {Map<string, { entity: object, matchType: string, score: number }>} */
    const scored = new Map();
    const consider = (list, matchType) => {
        for (const e of list) {
            if (!e?.id) continue;
            const score = scoreCandidate(e, key, matchType);
            const prev = scored.get(e.id);
            if (!prev || score > prev.score) {
                scored.set(e.id, { entity: e, matchType, score });
            }
        }
    };

    const tokenHits = idx.byToken.get(key) ?? [];
    if (tokenHits.length) consider(tokenHits, "token_unique");

    const tagHits = idx.byTag.get(key) ?? [];
    if (tagHits.length) consider(tagHits, "tag");

    // Unique prefix/suffix on full title (legacy AI titles like "Rey Aldric")
    if (key.length >= 4) {
        const prefixHits = [];
        for (const [title, e] of idx.byExact) {
            if (title.startsWith(key) || key.startsWith(title)) prefixHits.push(e);
        }
        if (prefixHits.length) consider(prefixHits, "prefix_unique");
    }

    // Whole-word substring (avoid "Aldric"→random long titles without the word)
    if (key.length >= 4 && scored.size === 0) {
        const re = new RegExp(`(?:^|[^a-z0-9ñ])${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[^a-z0-9ñ]|$)`, "i");
        const wordHits = idx.all.filter((e) => re.test(foldTitleText(e.title)));
        if (wordHits.length) consider(wordHits, "word_substring");
    }

    const ranked = [...scored.values()].sort((a, b) => b.score - a.score || a.entity.title.localeCompare(b.entity.title));
    if (!ranked.length) {
        return { entity: null, matchType: null, ambiguous: [] };
    }

    const best = ranked[0];
    const tied = ranked.filter((r) => r.score === best.score);
    if (tied.length > 1) {
        return {
            entity: null,
            matchType: null,
            ambiguous: tied.map((t) => t.entity),
        };
    }

    return { entity: best.entity, matchType: best.matchType, ambiguous: [] };
}
