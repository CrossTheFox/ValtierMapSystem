/**
 * Track and reconcile Firebase Storage paths for wiki images uploaded
 * during an edit session but not yet committed to Firestore.
 */

const WIKI_STORAGE_PREFIX = "wiki-images/";

/** Resolve a download URL or storage path to a wiki-images storage path. */
export function urlToWikiStoragePath(urlOrPath) {
    if (!urlOrPath || typeof urlOrPath !== "string") return null;
    if (urlOrPath.startsWith(WIKI_STORAGE_PREFIX)) return urlOrPath;

    try {
        const decoded = decodeURIComponent(urlOrPath);
        const match = decoded.match(/\/o\/([^?]+)/);
        if (!match) return null;
        const path = match[1].replace(/%2F/gi, "/");
        return path.startsWith(WIKI_STORAGE_PREFIX) ? path : null;
    } catch {
        return null;
    }
}

/** Extract image URLs from Markdown `![alt](url)` syntax. */
export function extractMarkdownImageUrls(markdown) {
    if (!markdown) return [];
    const urls = [];
    const re = /!\[[^\]]*\]\(([^)]+)\)/g;
    let m;
    while ((m = re.exec(markdown)) !== null) {
        const url = m[1]?.trim();
        if (url) urls.push(url);
    }
    return urls;
}

/** Collect wiki storage paths referenced in an entity draft. */
export function collectReferencedWikiPaths({ imageUrl, summary, body }) {
    const paths = new Set();
    const cover = urlToWikiStoragePath(imageUrl);
    if (cover) paths.add(cover);
    for (const field of [summary, body]) {
        for (const url of extractMarkdownImageUrls(field)) {
            const p = urlToWikiStoragePath(url);
            if (p) paths.add(p);
        }
    }
    return paths;
}
