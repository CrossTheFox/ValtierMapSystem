/**
 * The mesa line a player may see: only nodes the DM marked "players" in
 * `campaigns/{id}/fichaVisibilidad`, the same flag the Neural Lab ego reads.
 * Everything that points at a hidden node is cut, so the projection never names it as a link.
 */

const MENTION_RE = /@\[([^\]]*)\]\(([^)]+)\)/g;

/** Hidden mentions become plain text: the DM wrote that prose on a node they published. */
export function stripHiddenMentions(text, visible) {
    return String(text || "").replace(MENTION_RE, (whole, title, id) => (visible.has(id) ? whole : title));
}

function keep(list, visible) {
    return (Array.isArray(list) ? list : []).filter((id) => visible.has(id));
}

function cardOf(row, visible) {
    return {
        ...row,
        summary: row.summary || "",
        body: stripHiddenMentions(row.body, visible),
        people: keep(row.people, visible),
        places: keep(row.places, visible),
        layoutX: row.layoutX ?? null,
        layoutY: row.layoutY ?? null,
    };
}

function anchorOf(anchor, visible) {
    const a = anchor || {};
    const hiddenBucket = a.bucketUnit === "era" && a.bucketRef && !visible.has(a.bucketRef);
    return {
        ...a,
        eraIds: keep(a.eraIds, visible),
        arcIds: keep(a.arcIds, visible),
        parentId: a.parentId && visible.has(a.parentId) ? a.parentId : null,
        bucketUnit: hiddenBucket ? null : (a.bucketUnit ?? null),
        bucketRef: hiddenBucket ? null : (a.bucketRef ?? null),
    };
}

/** Firestore rejects `undefined`; the solar treats a missing value and null the same. */
function plain(value) {
    return JSON.parse(JSON.stringify(value, (_, v) => (v === undefined ? null : v)));
}

/**
 * @param {object} data what `LoreTimeline` hands to the solar
 * @param {Record<string, string>} visibilityByFicha `fichaVisibilidad` of one campaign
 * @param {string} campaignId
 */
export function publishedTimeline(data, visibilityByFicha, campaignId) {
    const visible = new Set(
        Object.entries(visibilityByFicha || {})
            .filter(([, value]) => value === "players")
            .map(([id]) => id),
    );
    const show = (row) => row?.id && visible.has(row.id);
    const sessions = (data?.sessions || []).filter(show).map((row) => ({
        ...cardOf(row, visible),
        recap: stripHiddenMentions(row.recap, visible),
        eventIds: keep(row.eventIds, visible),
        personajeIds: keep(row.personajeIds, visible),
    }));
    const sessionIds = new Set(sessions.map((row) => row.id));
    const campaign = (data?.campaigns || []).find((row) => row.id === campaignId);
    return plain({
        sun: {
            name: data?.sun?.name || "Lore",
            summary: data?.sun?.summary || "",
            now: data?.sun?.now || "",
            layoutX: data?.sun?.layoutX ?? null,
            layoutY: data?.sun?.layoutY ?? null,
        },
        eras: (data?.eras || []).filter(show).map((row) => cardOf(row, visible)),
        arcs: (data?.arcs || []).filter(show).map((row) => ({ ...cardOf(row, visible), eraIds: keep(row.eraIds, visible) })),
        events: (data?.events || []).filter(show).map((row) => ({ ...cardOf(row, visible), anchor: anchorOf(row.anchor, visible) })),
        neutrals: (data?.neutrals || []).filter(show).map((row) => cardOf(row, visible)),
        sessions,
        actas: (data?.actas || [])
            .filter((row) => row.campaignId === campaignId)
            .map((row) => ({ ...row, loreSessionId: sessionIds.has(row.loreSessionId) ? row.loreSessionId : "" })),
        campaigns: [{ id: campaignId, name: campaign?.name || "Mesa" }],
        mentions: (data?.mentions || []).filter(show),
        links: (data?.links || []).filter((link) => (
            (link.fromType === "lore" || visible.has(link.fromId))
            && (link.toType === "lore" || visible.has(link.toId))
        )),
        paints: Object.fromEntries(Object.entries(data?.paints || {}).filter(([id]) => visible.has(id))),
    });
}

export function publishedNodeCount(view) {
    if (!view) return 0;
    return ["eras", "arcs", "events", "neutrals", "sessions"]
        .reduce((sum, key) => sum + (Array.isArray(view[key]) ? view[key].length : 0), 0);
}
