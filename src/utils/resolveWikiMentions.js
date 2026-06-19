/**
 * resolveWikiMentions.js
 *
 * Extracts entity name-candidates from free text and resolves them against the
 * full campaign wiki WITHOUT requiring exact title matches.
 *
 * Match strategy (ordered by priority, stops at first success):
 *   1. Exact title match (case-insensitive, trimmed)
 *   2. First-token match: "Felicia" → "Felicia Margalous" (unique first name)
 *   3. Last-token match: "Margalous" → "Felicia Margalous" (unique surname/epithet)
 *   4. Alias/tag match: token appears in entity.tags[]
 *   5. Partial substring match inside title (only if unique)
 *
 * When a token matches 2+ entities at any step → ambiguous (returned separately
 * so the UI can show a disambiguation prompt).
 *
 * Based on PANGeA (Buongiorno et al., 2024): consistent character personality
 * requires the system to reliably ground NPC names mentioned by the user.
 *
 * Usage:
 *   import { resolveWikiMentions } from "./resolveWikiMentions";
 *   const { resolved, ambiguous, unresolved } = resolveWikiMentions(text, allEntities);
 */

// ── Token extraction ──────────────────────────────────────────────────────────

/** Words that are never entity names. */
const STOP_WORDS = new Set([
    "el", "la", "los", "las", "un", "una", "unos", "unas",
    "de", "del", "al", "a", "en", "con", "por", "para", "que",
    "y", "o", "u", "e", "ni", "pero", "sino", "aunque",
    "se", "le", "lo", "me", "te", "nos", "os", "su",
    "si", "no", "sí", "ya", "más", "muy", "tan", "bien",
    "es", "era", "fue", "son", "hay", "tiene", "va", "va",
    "será", "irá", "hará", "tendrá", "habrá",
]);

/**
 * Extract candidate name tokens from free DJ text.
 * Tries: capitalized words, multi-word sequences, quoted strings.
 *
 * @param {string} text
 * @returns {string[]}  — deduplicated list of candidate strings
 */
export function extractNameCandidates(text) {
    if (!text?.trim()) return [];

    const candidates = new Set();

    // Quoted strings first ("Felicia Margalous" or 'Zorgun')
    for (const m of text.matchAll(/["']([^"']{2,50})["']/g)) {
        candidates.add(m[1].trim());
    }

    // Capitalized runs: "Felicia Margalous", "Casa Margalous", "El Motor Zarken"
    const capitalRun = /[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+(?:\s+[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+)*/g;
    for (const m of text.matchAll(capitalRun)) {
        const tok = m[0].trim();
        if (tok.length >= 3 && !STOP_WORDS.has(tok.toLowerCase())) {
            candidates.add(tok);
            // Also add the first word alone as a shortcut token
            const first = tok.split(" ")[0];
            if (first.length >= 3) candidates.add(first);
        }
    }

    return [...candidates];
}

// ── Entity index ──────────────────────────────────────────────────────────────

function buildFullIndex(entities) {
    // exact title → entity (normalized)
    const byTitle    = new Map();
    // first token → entity[]
    const byFirst    = new Map();
    // last token → entity[]
    const byLast     = new Map();
    // tag → entity[]
    const byTag      = new Map();

    for (const e of entities) {
        if (!e.title) continue;
        const norm = e.title.toLowerCase().trim();
        byTitle.set(norm, e);

        const parts = norm.split(/\s+/);
        const first = parts[0];
        const last  = parts[parts.length - 1];

        if (!byFirst.has(first)) byFirst.set(first, []);
        byFirst.get(first).push(e);

        if (last !== first) {
            if (!byLast.has(last)) byLast.set(last, []);
            byLast.get(last).push(e);
        }

        for (const tag of e.tags ?? []) {
            const t = tag.toLowerCase().trim();
            if (!byTag.has(t)) byTag.set(t, []);
            byTag.get(t).push(e);
        }
    }

    return { byTitle, byFirst, byLast, byTag, all: entities };
}

// ── Core resolver ─────────────────────────────────────────────────────────────

/**
 * @typedef {{ text: string, entity: object, matchType: string }} ResolvedMention
 * @typedef {{ text: string, candidates: object[] }}               AmbiguousMention
 */

/**
 * Resolve free-text candidate tokens against the wiki.
 *
 * @param {string}   text        — DJ instruction text
 * @param {object[]} allEntities — full wikiEntity[] for the campaign
 * @returns {{
 *   resolved:   ResolvedMention[],
 *   ambiguous:  AmbiguousMention[],
 *   unresolved: string[],
 * }}
 */
export function resolveWikiMentions(text, allEntities = []) {
    const candidates = extractNameCandidates(text);
    const idx        = buildFullIndex(allEntities);
    const seen       = new Set(); // entity IDs already in resolved

    const resolved   = [];
    const ambiguous  = [];
    const unresolved = [];

    for (const cand of candidates) {
        const key = cand.toLowerCase().trim();

        // 1 — exact title
        if (idx.byTitle.has(key)) {
            const e = idx.byTitle.get(key);
            if (!seen.has(e.id)) {
                seen.add(e.id);
                resolved.push({ text: cand, entity: e, matchType: "exact" });
            }
            continue;
        }

        // 2 — first token (unique)
        const firstMatches = idx.byFirst.get(key) ?? [];
        if (firstMatches.length === 1) {
            const e = firstMatches[0];
            if (!seen.has(e.id)) {
                seen.add(e.id);
                resolved.push({ text: cand, entity: e, matchType: "first_token" });
            }
            continue;
        }
        if (firstMatches.length > 1) {
            ambiguous.push({ text: cand, candidates: firstMatches });
            continue;
        }

        // 3 — last token (unique)
        const lastMatches = idx.byLast.get(key) ?? [];
        if (lastMatches.length === 1) {
            const e = lastMatches[0];
            if (!seen.has(e.id)) {
                seen.add(e.id);
                resolved.push({ text: cand, entity: e, matchType: "last_token" });
            }
            continue;
        }
        if (lastMatches.length > 1) {
            ambiguous.push({ text: cand, candidates: lastMatches });
            continue;
        }

        // 4 — tag match (unique)
        const tagMatches = idx.byTag.get(key) ?? [];
        if (tagMatches.length === 1) {
            const e = tagMatches[0];
            if (!seen.has(e.id)) {
                seen.add(e.id);
                resolved.push({ text: cand, entity: e, matchType: "tag" });
            }
            continue;
        }
        if (tagMatches.length > 1) {
            ambiguous.push({ text: cand, candidates: tagMatches });
            continue;
        }

        // 5 — substring inside title (unique, min 3 chars, not too short relative to title)
        if (key.length >= 4) {
            const subMatches = allEntities.filter((e) => {
                const t = (e.title ?? "").toLowerCase();
                return t.includes(key) && t !== key;
            });
            if (subMatches.length === 1) {
                const e = subMatches[0];
                if (!seen.has(e.id)) {
                    seen.add(e.id);
                    resolved.push({ text: cand, entity: e, matchType: "substring" });
                }
                continue;
            }
        }

        // Not found
        if (key.length >= 4) {
            unresolved.push(cand);
        }
    }

    return { resolved, ambiguous, unresolved };
}

/**
 * Convenience: resolve and return only the flat list of unique entities found.
 * Used by buildCascadeContext to inject mentioned entities into BFS seed.
 *
 * @param {string}   text
 * @param {object[]} allEntities
 * @returns {object[]}  unique resolved wikiEntity objects
 */
export function resolvedEntitiesFromText(text, allEntities = []) {
    const { resolved } = resolveWikiMentions(text, allEntities);
    return resolved.map((r) => r.entity);
}
