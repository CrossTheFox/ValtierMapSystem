import { WIKI_ENTITY_TYPES } from "../constants/wikiEntityTypes";

/**
 * Build a lookup map from glossary wiki entities.
 * Keys are lowercase term + aliases for case-insensitive matching.
 */
export function buildGlossaryLookup(entities = []) {
    const lookup = new Map();
    const glossaryEntities = entities.filter((e) => e.entityType === WIKI_ENTITY_TYPES.GLOSARIO);

    for (const entity of glossaryEntities) {
        const definition = entity.body?.trim() || entity.summary?.trim() || "";
        if (!definition) continue;

        const aliases = entity.customFields?.glosario?.aliases ?? entity.tags ?? [];
        const terms = [entity.title, ...aliases].filter(Boolean);

        for (const term of terms) {
            const key = term.toLowerCase().trim();
            if (!key || lookup.has(key)) continue;
            lookup.set(key, {
                term: entity.title,
                definition,
                entityId: entity.id,
            });
        }
    }

    return lookup;
}

/**
 * Find glossary terms in plain text (longest match first).
 * Returns non-overlapping matches sorted by position.
 */
export function findGlossaryMatches(text, lookup) {
    if (!text || !lookup?.size) return [];

    const keys = [...lookup.keys()].sort((a, b) => b.length - a.length);
    const matches = [];
    const used = new Set();

    for (let i = 0; i < text.length; i++) {
        if (used.has(i)) continue;
        for (const key of keys) {
            const slice = text.slice(i, i + key.length).toLowerCase();
            if (slice !== key) continue;
            const before = i > 0 ? text[i - 1] : " ";
            const after = i + key.length < text.length ? text[i + key.length] : " ";
            if (/\w/.test(before) || /\w/.test(after)) continue;
            matches.push({ start: i, end: i + key.length, key, entry: lookup.get(key) });
            for (let j = i; j < i + key.length; j++) used.add(j);
            break;
        }
    }

    return matches.sort((a, b) => a.start - b.start);
}
