import { normalizeLinks, upsertLink } from "./archiveTimeline.js";

/** Lore session rows stored on the lore document until there is a table. */
export function normalizeLoreSessions(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map((row) => {
        if (!row || typeof row !== "object" || !row.id) return null;
        const layoutX = row.layout_x ?? row.layoutX;
        const layoutY = row.layout_y ?? row.layoutY;
        return {
            id: String(row.id),
            title: row.title || "Sin título",
            body: row.body || "",
            inGame: row.in_game || row.inGame || "",
            layoutX: layoutX == null || layoutX === "" ? null : Number(layoutX),
            layoutY: layoutY == null || layoutY === "" ? null : Number(layoutY),
            eventIds: idList(row.event_ids ?? row.eventIds),
            personajeIds: idList(row.personaje_ids ?? row.personajeIds),
        };
    }).filter(Boolean);
}

export function sessionToRow(session) {
    return {
        id: session.id,
        title: session.title || "Sin título",
        body: session.body || "",
        in_game: session.inGame || "",
        layout_x: session.layoutX ?? null,
        layout_y: session.layoutY ?? null,
        event_ids: idList(session.eventIds),
        personaje_ids: idList(session.personajeIds),
    };
}

/** Hang list only. Does not add an `agrupa` link. */
export function withSessionEvent(sessions, sessionId, eventId, mode) {
    return (sessions || []).map((session) => {
        if (session.id !== sessionId) return session;
        const ids = new Set(session.eventIds || []);
        if (mode === "drop") ids.delete(eventId);
        else ids.add(eventId);
        return { ...session, eventIds: [...ids] };
    });
}

/**
 * The diary arc is one `agrupa` from an arco to this lore session.
 * Other parents stay. Passing an empty arco id removes that arc link only.
 */
export function replaceSessionArc(rawLinks, sessionId, arcoId) {
    const links = normalizeLinks(rawLinks).filter((link) => !(
        link.kind === "agrupa"
        && link.toType === "sesion"
        && link.toId === sessionId
        && link.fromType === "arco"
    ));
    if (!arcoId) return links;
    const result = upsertLink(links, {
        kind: "agrupa",
        fromType: "arco",
        fromId: arcoId,
        toType: "sesion",
        toId: sessionId,
    });
    return result.ok ? result.links : links;
}

/** Arc shown in the diary: the solar `agrupa`, or the acta field if the session is not annexed. */
export function actaArcId(session, rawLinks) {
    if (session?.loreSessionId) {
        const linked = sessionArcId(rawLinks, session.loreSessionId);
        if (linked) return linked;
    }
    return session?.arcId || "";
}

/** Acontecimientos cited on the acta plus those hung on the annexed lore session. Does not draw `agrupa`. */
export function actaEventIds(session, loreSessions) {
    const lore = (loreSessions || []).find((row) => row.id === session?.loreSessionId);
    return idList([...(session?.eventIds || []), ...(lore?.eventIds || [])]);
}

export function sessionArcId(rawLinks, sessionId) {
    const hit = normalizeLinks(rawLinks).find((link) => (
        link.kind === "agrupa"
        && link.toType === "sesion"
        && link.toId === sessionId
        && link.fromType === "arco"
    ));
    return hit?.fromId || "";
}

function idList(raw) {
    if (!Array.isArray(raw)) return [];
    return [...new Set(raw.map((id) => String(id || "")).filter(Boolean))];
}
