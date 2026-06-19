import { useMemo, useState } from "react";
import Fuse from "fuse.js";

const FUSE_OPTIONS = {
    keys: [
        { name: "title", weight: 3 },
        { name: "summary", weight: 2 },
        { name: "body", weight: 1 },
        { name: "tags", weight: 2 },
        { name: "entityType", weight: 1 },
        { name: "slug", weight: 1 },
    ],
    threshold: 0.35,
    includeScore: true,
    minMatchCharLength: 2,
};

/**
 * Wiki full-text search hook using Fuse.js.
 * @param {Array<object>} entries — normalized wiki entities to index
 * @returns {{ query, setQuery, results, isReady, typeFilter, setTypeFilter, tagFilter, setTagFilter, filteredEntities }}
 */
export function useWikiSearch(entries = []) {
    const [query, setQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const [tagFilter, setTagFilter] = useState("");

    const fuse = useMemo(
        () => (entries.length > 0 ? new Fuse(entries, FUSE_OPTIONS) : null),
        [entries]
    );

    const isReady = entries.length > 0 && !!fuse;

    const results = useMemo(() => {
        let base = entries;

        if (query.trim().length >= 2 && fuse) {
            base = fuse.search(query.trim()).map((r) => r.item);
        }

        if (typeFilter) {
            base = base.filter((e) => e.entityType === typeFilter);
        }

        if (tagFilter) {
            base = base.filter(
                (e) => Array.isArray(e.tags) && e.tags.some((t) => t.toLowerCase().includes(tagFilter.toLowerCase()))
            );
        }

        return base;
    }, [query, typeFilter, tagFilter, entries, fuse]);

    return {
        query,
        setQuery,
        results,
        isReady,
        typeFilter,
        setTypeFilter,
        tagFilter,
        setTagFilter,
    };
}

export default useWikiSearch;
