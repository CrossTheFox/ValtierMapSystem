import { ANY_MENTION_REGEX, slugify } from "./wikiSlug";

/** Lowercase without accents, for search. */
export const fold = (s = "") => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Fichas use the model's `title`; a mention resolves by id, then by slug or slugified title (legacy `@[slug]`).
 * @returns {{ index: number, length: number, label: string, id: string|null, ficha: object|null, st: "ok"|"lg"|"br" }[]}
 */
export function scanMentions(text, fichas, byId) {
    const out = [];
    const re = new RegExp(ANY_MENTION_REGEX.source, "g");
    let m;
    while ((m = re.exec(text || "")) !== null) {
        const [raw, label, id] = m;
        let ficha = id ? byId.get(id) || null : null;
        if (!ficha && !id) ficha = fichas.find((f) => f.slug === label || slugify(f.title || "") === slugify(label)) || null;
        out.push({ index: m.index, length: raw.length, label, id: id || null, ficha, st: !ficha ? "br" : id ? "ok" : "lg" });
    }
    return out;
}

export const maskMentions = (text) =>
    String(text || "").replace(new RegExp(ANY_MENTION_REGEX.source, "g"), (m) => " ".repeat(m.length));

export const plainOf = (text) =>
    String(text || "").replace(new RegExp(ANY_MENTION_REGEX.source, "g"), (_, label) => label).replace(/[#*_`>]/g, "");

/** Known ficha names that appear unlinked in plain text (mock `findNames`). */
export function findUnlinked(text, fichas, selfId = null) {
    const plain = maskMentions(text);
    const firstWords = new Map();
    for (const f of fichas) {
        const w = fold(String(f.title || "").split(/\s+/)[0]);
        firstWords.set(w, (firstWords.get(w) || 0) + 1);
    }
    const names = [];
    for (const f of fichas) {
        const t = String(f.title || "");
        if (t.length >= 4 && t.split(/\s+/).length <= 4) names.push({ f, name: t.replace(/\s*\(.*\)\s*$/, "") });
        if (f.entity_type === "personaje" && /\s/.test(t)) {
            const w = t.split(/\s+/)[0];
            if (w.length >= 5 && firstWords.get(fold(w)) === 1) names.push({ f, name: w });
        }
    }
    names.sort((a, b) => b.name.length - a.name.length);
    const taken = [];
    for (const n of names) {
        if (n.f.id === selfId || !n.name) continue;
        const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${escRe(n.name)})(?=$|[^\\p{L}\\p{N}])`, "gu");
        let m;
        while ((m = re.exec(plain)) !== null) {
            const start = m.index + m[1].length;
            const end = start + m[2].length;
            if (taken.some((t) => start < t.end && end > t.start)) continue;
            taken.push({ start, end, ficha: n.f, name: m[2] });
        }
    }
    return taken.sort((a, b) => a.start - b.start);
}

/** Excerpt around a mention (mock `excerptFor`), split so the caller can highlight the middle. */
export function excerptParts(text, mention, radius = 70) {
    const start = Math.max(0, mention.index - radius);
    const end = Math.min(text.length, mention.index + mention.length + radius);
    const before = plainOf(text.slice(start, mention.index).replace(/^[^\s@]*\]\([^)\s]*\)|^[^\s(]*\)/, "")).replace(/\s+/g, " ");
    const after = plainOf(text.slice(mention.index + mention.length, end).replace(/@\[[^\]]*(\]\([^)]*)?$|@$/, "")).replace(/\s+/g, " ");
    return { pre: start > 0 ? "…" : "", before, after, post: end < text.length ? "…" : "" };
}

/** Fichas whose body mentions `id`, with the excerpt of the first mention. */
export function backlinksOf(id, fichas, byId) {
    const out = [];
    for (const f of fichas) {
        if (f.id === id) continue;
        const text = f.body || "";
        const m = scanMentions(text, fichas, byId).find((x) => x.ficha && x.ficha.id === id);
        if (m) out.push({ src: f, excerpt: excerptParts(text, m) });
    }
    return out;
}

export function initialsOf(title = "") {
    const words = String(title).trim().split(/\s+/).filter(Boolean);
    return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || "?").slice(0, 2)).toUpperCase();
}
