/**
 * Convert plain entity titles in free text into @[Title](id) mention tokens.
 * Does not invent entities; unresolved titles stay as plain text.
 */

import { buildMentionToken, MENTION_REGEX } from "./wikiSlug.js";

/**
 * Escape a string for use inside a RegExp.
 * @param {string} s
 */
function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replace known entity titles in `text` with mention tokens.
 * - Skips spans that are already `@[…](…)` tokens
 * - Matches titles case-insensitively
 * - Prefers longer titles first to avoid partial replacements
 *
 * @param {string} text
 * @param {Array<{ id?: string, title?: string }>} entities
 * @returns {string}
 */
export function linkMentionsInText(text, entities = []) {
    if (!text || typeof text !== "string") return text ?? "";
    if (!entities?.length) return text;

    const candidates = [];
    const seen = new Set();
    for (const e of entities) {
        const id = e?.id;
        const title = (e?.title ?? "").trim();
        if (!id || !title) continue;
        const key = title.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        candidates.push({ id, title, key });
    }
    if (!candidates.length) return text;

    candidates.sort((a, b) => b.title.length - a.title.length);

    // Protect existing mention tokens so we don't rewrite inside them.
    const placeholders = [];
    const protectedText = text.replace(new RegExp(MENTION_REGEX.source, "g"), (match) => {
        const idx = placeholders.length;
        placeholders.push(match);
        return `\u0000M${idx}\u0000`;
    });

    let out = protectedText;
    for (const { id, title } of candidates) {
        const token = buildMentionToken(title, id);
        const re = new RegExp(`(?<![\\w@])${escapeRegExp(title)}(?![\\w])`, "gi");
        out = out.replace(re, token);
    }

    return out.replace(/\u0000M(\d+)\u0000/g, (_, i) => placeholders[Number(i)] ?? "");
}
