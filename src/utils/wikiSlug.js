/**
 * Slug utilities for wiki entity mentions.
 * Slug format: lowercase, accents removed, spaces → hyphens, non-alphanumeric stripped.
 */

/**
 * Convert a title string into a URL-safe slug.
 * @param {string} title
 * @returns {string}
 */
export function slugify(title = "") {
    return title
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
}

/**
 * Given a base slug and an array of existing slugs, return a unique slug by
 * appending -2, -3, etc. when needed.
 * @param {string} base
 * @param {string[]} existingSlugs
 * @returns {string}
 */
export function uniqueSlug(base, existingSlugs = []) {
    if (!existingSlugs.includes(base)) return base;
    let n = 2;
    while (existingSlugs.includes(`${base}-${n}`)) n++;
    return `${base}-${n}`;
}

/**
 * Build a mention token that is stored in entity body text.
 * Format: @[Visible Title](entityId)
 * @param {string} title
 * @param {string} entityId
 * @returns {string}
 */
export function buildMentionToken(title, entityId) {
    return `@[${title}](${entityId})`;
}

/**
 * Regex to match mention tokens in body text.
 * Matches: @[Any Title](anyEntityId)
 */
export const MENTION_REGEX = /@\[([^\]]+)\]\(([^)]+)\)/g;

/**
 * Parse all mention tokens from a body string.
 * Returns an array of { title, entityId } objects.
 * @param {string} body
 * @returns {{ title: string, entityId: string }[]}
 */
export function parseMentions(body = "") {
    const results = [];
    const regex = new RegExp(MENTION_REGEX.source, "g");
    let match;
    while ((match = regex.exec(body)) !== null) {
        results.push({ title: match[1], entityId: match[2] });
    }
    return results;
}

/** Matches legacy seed tokens: @[slug] without (entityId). */
export const SLUG_MENTION_REGEX = /@\[([^\]]+)\](?!\()/g;

/**
 * Parse @[slug] tokens (no entityId suffix) from body/summary text.
 * @param {string} body
 * @returns {string[]} — raw slug strings from mention tokens
 */
export function parseSlugMentions(body = "") {
    const slugs = [];
    const regex = new RegExp(SLUG_MENTION_REGEX.source, "g");
    let match;
    while ((match = regex.exec(body)) !== null) {
        slugs.push(match[1].trim());
    }
    return slugs;
}

/**
 * Return all entity IDs that mention a given entityId in their body.
 * @param {string} entityId
 * @param {Array<{ id: string, body: string }>} allEntities
 * @returns {string[]} — IDs of entities that mention entityId
 */
export function getBacklinkIds(entityId, allEntities = []) {
    return allEntities
        .filter((e) => e.id !== entityId && e.body && parseMentions(e.body).some((m) => m.entityId === entityId))
        .map((e) => e.id);
}
