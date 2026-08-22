/**
 * resolveWikiMentions.js
 *
 * Extracts entity name-candidates from free text and resolves them against the
 * full campaign wiki WITHOUT requiring exact title matches.
 *
 * Matching is delegated to resolveEntityByTitle (token / type-aware scoring).
 */

import { resolveEntityByTitle, buildEntityTitleIndex, foldTitleText } from "./resolveEntityByTitle.js";

/** Words that are never entity names when alone. */
const STOP_WORDS = new Set([
    "el", "la", "los", "las", "un", "una", "unos", "unas",
    "de", "del", "al", "a", "en", "con", "por", "para", "que",
    "y", "o", "u", "e", "ni", "pero", "sino", "aunque",
    "se", "le", "lo", "me", "te", "nos", "os", "su",
    "si", "no", "sí", "ya", "más", "muy", "tan", "bien",
    "es", "era", "fue", "son", "hay", "tiene", "va",
    "será", "irá", "hará", "tendrá", "habrá",
]);

/**
 * Extract candidate name tokens from free DJ text.
 * @param {string} text
 * @returns {string[]}
 */
export function extractNameCandidates(text) {
    if (!text?.trim()) return [];

    const candidates = new Set();

    for (const m of text.matchAll(/["']([^"']{2,50})["']/g)) {
        candidates.add(m[1].trim());
    }

    const capitalRun = /[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+(?:\s+[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+)*/g;
    for (const m of text.matchAll(capitalRun)) {
        const tok = m[0].trim();
        if (tok.length >= 3 && !STOP_WORDS.has(tok.toLowerCase())) {
            candidates.add(tok);
            const first = tok.split(" ")[0];
            if (first.length >= 3) candidates.add(first);
            // Also middle tokens for "Rey Aldric Alder" → "Aldric"
            for (const part of tok.split(/\s+/)) {
                if (part.length >= 3 && !STOP_WORDS.has(part.toLowerCase())) {
                    candidates.add(part);
                }
            }
        }
    }

    return [...candidates];
}

/**
 * @typedef {{ text: string, entity: object, matchType: string }} ResolvedMention
 * @typedef {{ text: string, candidates: object[] }} AmbiguousMention
 */

/**
 * @param {string}   text
 * @param {object[]} allEntities
 * @returns {{
 *   resolved: ResolvedMention[],
 *   ambiguous: AmbiguousMention[],
 *   unresolved: string[],
 * }}
 */
export function resolveWikiMentions(text, allEntities = []) {
    const candidates = extractNameCandidates(text);
    const index = buildEntityTitleIndex(allEntities);
    const seen = new Set();

    const resolved = [];
    const ambiguous = [];
    const unresolved = [];

    for (const cand of candidates) {
        const key = foldTitleText(cand);
        if (key.length < 3) continue;

        const { entity, matchType, ambiguous: amb } = resolveEntityByTitle(cand, allEntities, { index });

        if (amb.length > 1) {
            ambiguous.push({ text: cand, candidates: amb });
            continue;
        }

        if (entity) {
            if (!seen.has(entity.id)) {
                seen.add(entity.id);
                resolved.push({ text: cand, entity, matchType: matchType || "resolve" });
            }
            continue;
        }

        if (key.length >= 4) unresolved.push(cand);
    }

    return { resolved, ambiguous, unresolved };
}

/**
 * @param {string}   text
 * @param {object[]} allEntities
 * @returns {object[]}
 */
export function resolvedEntitiesFromText(text, allEntities = []) {
    const { resolved } = resolveWikiMentions(text, allEntities);
    return resolved.map((r) => r.entity);
}
