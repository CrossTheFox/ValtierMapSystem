import { useEffect, useMemo, useRef, useState } from "react";
import ArchiveTimeline from "./ArchiveTimeline";
import { subscribeLore, updateLore } from "../../../../firebase/services/loreService";
import { subscribeSessionLogs, updateSessionLog } from "../../../../firebase/services/sessionLogService";
import {
    normalizeLoreSessions,
    replaceSessionArc,
    sessionToRow,
    withSessionEvent,
} from "../../../utils/loreSessions";
import {
    createLoreFicha,
    deleteLoreFicha,
    subscribeLoreFichas,
    updateLoreFicha,
    writeLoreFichaAt,
} from "../../../../firebase/services/loreFichaService";
import {
    createLoreArco,
    createLoreEra,
    deleteLoreTimelineItem,
    subscribeLoreArcos,
    subscribeLoreEras,
    updateLoreTimelineItem,
} from "../../../../firebase/services/loreTimelineService";
import { deleteLoreRelation, listLoreRelaciones } from "../../../../firebase/services/loreRelationService";
import { setFichaVisibility, subscribeFichaVisibilidad } from "../../../../firebase/services/labViewService";
import { publishTimelineView } from "../../../../firebase/services/timelineViewService";
import { relationsDroppedByIndex } from "../../../utils/loreIndexRelations";
import { publishedNodeCount, publishedTimeline } from "../../../utils/timelinePublish";
import { slugify, uniqueSlug } from "../../../utils/wikiSlug";
import {
    anchorFromFields,
    anchorToColumns,
    dropNodeLinks,
    dropPair,
    idList,
    layoutNum,
    linkToRow,
    linksAfterRetarget,
    neutroToRow,
    normalizeAnchor,
    normalizeLinks,
    normalizeNeutro,
    normalizePaints,
    paintsToRows,
    parseDZ,
    removalPatches,
    upsertLink,
    upsertLinks,
} from "../../../utils/archiveTimeline";

function fail(msg) {
    const err = new Error(msg);
    err.userMessage = msg;
    throw err;
}

function textFields(row) {
    return {
        summary: row.summary || "",
        body: row.body || "",
        people: idList(row.index_personajes ?? row.people),
        places: idList(row.index_lugares ?? row.places),
    };
}

function eraView(row) {
    return {
        id: row.id,
        title: row.title || "Sin título",
        ...textFields(row),
        start: row.start_year ?? row.start ?? null,
        end: row.end_year ?? row.end ?? null,
        layoutX: layoutNum(row.layout_x ?? row.layoutX),
        layoutY: layoutNum(row.layout_y ?? row.layoutY),
        store: row.store || "era",
    };
}

function arcoView(row) {
    return {
        id: row.id,
        title: row.title || "Sin título",
        ...textFields(row),
        color: row.color || "",
        start: row.start || null,
        end: row.end || null,
        eraIds: row.era_ids || row.eraIds || [],
        layoutX: layoutNum(row.layout_x ?? row.layoutX),
        layoutY: layoutNum(row.layout_y ?? row.layoutY),
        store: row.store || "arco",
    };
}

function eventView(row) {
    return {
        id: row.id,
        title: row.title || "Sin título",
        ...textFields(row),
        anchor: normalizeAnchor(row),
        layoutX: layoutNum(row.layout_x ?? row.layoutX),
        layoutY: layoutNum(row.layout_y ?? row.layoutY),
        store: row.store || "ficha",
    };
}

function mentionOf(row) {
    return { id: row.id, title: row.title || "Sin título", type: row.entity_type || row.type || "" };
}

function neutrosOf(lore) {
    return (Array.isArray(lore?.neutros) ? lore.neutros : []).map(normalizeNeutro).filter(Boolean);
}

/**
 * One Lore's line. The solar always reads this Lore, in the library and on a linked mesa.
 * Sessions live here. A campaign acta annexes one of them; it is not another node.
 */
export default function LoreTimeline({
    loreId,
    campaignId = "",
    campaignName = "",
    canEdit = true,
    onOpenActa = null,
}) {
    const [pack, setPack] = useState({ lore: undefined, eras: undefined, arcos: undefined, fichas: undefined });
    const [actas, setActas] = useState([]);
    const [error, setError] = useState("");
    const packRef = useRef(pack);
    const actasRef = useRef(actas);
    useEffect(() => {
        packRef.current = pack;
        actasRef.current = actas;
    });

    useEffect(() => {
        const failSub = (which) => (err) => {
            console.error("LoreTimeline:", which, err);
            setError(which === "eras" || which === "arcos"
                ? "No se pudieron leer las eras y los arcos. Falta publicar las reglas de la línea."
                : "No se pudo leer la línea de este Lore.");
        };
        const unsubs = [
            subscribeLore(loreId, (lore) => setPack((p) => ({ ...p, lore })), failSub("lore")),
            subscribeLoreEras(loreId, (eras) => setPack((p) => ({ ...p, eras })), failSub("eras")),
            subscribeLoreArcos(loreId, (arcos) => setPack((p) => ({ ...p, arcos })), failSub("arcos")),
            subscribeLoreFichas(loreId, (fichas) => setPack((p) => ({ ...p, fichas })), failSub("fichas")),
        ];
        return () => unsubs.forEach((u) => u());
    }, [loreId]);

    const campaigns = useMemo(() => {
        const linked = (Array.isArray(pack.lore?.linked_campaigns) ? pack.lore.linked_campaigns : [])
            .filter((row) => row?.id)
            .map((row) => ({ id: String(row.id), name: row.name || "Mesa" }));
        if (!campaignId) return linked;
        const hit = linked.find((row) => row.id === campaignId);
        return [{ id: campaignId, name: hit?.name || campaignName || "Mesa" }];
    }, [pack.lore, campaignId, campaignName]);
    const campaignKey = campaigns.map((row) => row.id).join("|");

    useEffect(() => {
        if (!campaignKey) {
            setActas([]);
            return undefined;
        }
        const ids = campaignKey.split("|");
        const unsubs = ids.map((id) => subscribeSessionLogs(id, (rows) => {
            setActas((prev) => [
                ...prev.filter((row) => row.campaignId !== id),
                ...rows.map((row) => ({ ...row, campaignId: id })),
            ]);
        }, () => {}));
        return () => {
            unsubs.forEach((unsub) => unsub());
            setActas((prev) => prev.filter((row) => ids.includes(row.campaignId)));
        };
    }, [campaignKey]);

    const [visByCampaign, setVisByCampaign] = useState({});
    useEffect(() => {
        if (!canEdit || !campaignKey) return undefined;
        const ids = campaignKey.split("|");
        const unsubs = ids.map((id) => subscribeFichaVisibilidad(
            id,
            (map) => setVisByCampaign((prev) => ({ ...prev, [id]: map })),
            () => setVisByCampaign((prev) => {
                const next = { ...prev };
                delete next[id];
                return next;
            }),
        ));
        return () => {
            unsubs.forEach((unsub) => unsub());
            setVisByCampaign({});
        };
    }, [canEdit, campaignKey]);

    const ready = pack.lore !== undefined && pack.eras && pack.arcos && pack.fichas;
    const sessions = useMemo(
        () => normalizeLoreSessions(pack.lore?.sesiones),
        [pack.lore],
    );
    const fichas = pack.fichas || [];
    const fichaIds = useMemo(() => new Set(fichas.map((f) => f.id)), [fichas]);
    const eras = useMemo(() => [
        ...fichas.filter((f) => f.entity_type === "era").map((f) => eraView({ ...f, store: "ficha" })),
        ...(pack.eras || []).filter((row) => !fichaIds.has(row.id)).map(eraView),
    ], [fichas, pack.eras, fichaIds]);
    const arcs = useMemo(() => [
        ...fichas.filter((f) => f.entity_type === "arco").map((f) => arcoView({ ...f, store: "ficha" })),
        ...(pack.arcos || []).filter((row) => !fichaIds.has(row.id)).map(arcoView),
    ], [fichas, pack.arcos, fichaIds]);
    const events = useMemo(
        () => fichas.filter((f) => f.entity_type === "evento_historico").map((f) => eventView({ ...f, store: "ficha" })),
        [fichas],
    );
    const neutrals = useMemo(() => {
        const fromFicha = fichas.filter((f) => f.entity_type === "neutro").map((f) => ({
            ...normalizeNeutro(f),
            store: "ficha",
        }));
        const fromList = neutrosOf(pack.lore).filter((n) => !fichaIds.has(n.id)).map((n) => ({ ...n, store: "neutro" }));
        return [...fromFicha, ...fromList];
    }, [fichas, pack.lore, fichaIds]);
    const mentions = useMemo(() => fichas.map(mentionOf), [fichas]);

    const data = useMemo(() => {
        if (!ready || !pack.lore) return null;
        const now = pack.lore.present_dz || (pack.lore.present_year != null ? String(pack.lore.present_year) : "");
        return {
            scopeKey: `lore:${loreId}`,
            canEdit,
            sun: {
                name: pack.lore.name || "Lore",
                summary: pack.lore.summary || "",
                now,
                layoutX: layoutNum(pack.lore.layout_x),
                layoutY: layoutNum(pack.lore.layout_y),
            },
            eras,
            arcs,
            events,
            sessions: sessions.map((session) => ({
                ...session,
                date: "",
                recap: session.body,
            })),
            actas: actas.map((acta) => ({
                id: acta.id,
                campaignId: acta.campaignId,
                title: acta.title || "Sesión de mesa",
                loreSessionId: acta.loreSessionId || "",
            })),
            campaigns,
            neutrals,
            mentions,
            links: normalizeLinks(pack.lore.enlaces),
            paints: normalizePaints(pack.lore.pinturas),
        };
    }, [ready, pack.lore, loreId, canEdit, eras, arcs, events, neutrals, mentions, sessions, actas, campaigns]);

    const mesaVisibility = campaignId ? visByCampaign[campaignId] : null;
    const solarData = useMemo(
        () => (data && mesaVisibility ? { ...data, publish: { visible: mesaVisibility } } : data),
        [data, mesaVisibility],
    );

    const published = useRef({});
    useEffect(() => {
        const ids = Object.keys(visByCampaign);
        if (!data || !canEdit || !ids.length) return undefined;
        const timer = setTimeout(() => {
            ids.forEach((id) => {
                const view = publishedTimeline(data, visByCampaign[id], id);
                const key = JSON.stringify(view);
                if (published.current[id] === key) return;
                published.current[id] = key;
                publishTimelineView(id, view).catch((err) => {
                    published.current[id] = "";
                    console.warn("LoreTimeline: no se pudo publicar la línea de la mesa", id, err?.code || err);
                });
            });
        }, 1200);
        return () => clearTimeout(timer);
    }, [data, visByCampaign, canEdit]);

    const publishedCount = useMemo(
        () => (data && mesaVisibility ? publishedNodeCount(publishedTimeline(data, mesaVisibility, campaignId)) : null),
        [data, mesaVisibility, campaignId],
    );

    const actions = useMemo(() => {
        const current = () => {
            const p = packRef.current;
            const rows = p.fichas || [];
            const ids = new Set(rows.map((f) => f.id));
            return {
                eras: [
                    ...rows.filter((f) => f.entity_type === "era").map((f) => eraView({ ...f, store: "ficha" })),
                    ...(p.eras || []).filter((row) => !ids.has(row.id)).map(eraView),
                ],
                arcs: [
                    ...rows.filter((f) => f.entity_type === "arco").map((f) => arcoView({ ...f, store: "ficha" })),
                    ...(p.arcos || []).filter((row) => !ids.has(row.id)).map(arcoView),
                ],
                events: rows.filter((f) => f.entity_type === "evento_historico").map((f) => eventView({ ...f, store: "ficha" })),
            };
        };
        const fichaOf = (id) => (packRef.current.fichas || []).find((f) => f.id === id) || null;
        const storeOf = (id) => {
            if (fichaOf(id)) return "ficha";
            if ((packRef.current.eras || []).some((row) => row.id === id)) return "era";
            if ((packRef.current.arcos || []).some((row) => row.id === id)) return "arco";
            if (neutrosOf(packRef.current.lore).some((row) => row.id === id)) return "neutro";
            return null;
        };
        const slugFor = (title, fallback) => uniqueSlug(
            slugify(title) || fallback,
            (packRef.current.fichas || []).map((f) => f.slug).filter(Boolean),
        );
        const sesionesOf = () => normalizeLoreSessions(packRef.current.lore?.sesiones);
        const writeSesiones = async (rows) => {
            await updateLore(loreId, { sesiones: rows.map(sessionToRow) });
        };
        const saveSession = async (id, fields) => {
            const rows = sesionesOf();
            const prev = id ? rows.find((row) => row.id === id) : null;
            const nextId = prev?.id || crypto.randomUUID();
            const row = {
                id: nextId,
                title: fields.title ?? prev?.title ?? "Sesión",
                body: fields.body !== undefined ? fields.body : (prev?.body || ""),
                inGame: fields.inGame !== undefined ? fields.inGame : (prev?.inGame || ""),
                layoutX: fields.layoutX !== undefined ? fields.layoutX : (prev?.layoutX ?? null),
                layoutY: fields.layoutY !== undefined ? fields.layoutY : (prev?.layoutY ?? null),
                eventIds: fields.eventIds || prev?.eventIds || [],
                personajeIds: fields.personajeIds || prev?.personajeIds || [],
            };
            await writeSesiones(prev ? rows.map((item) => (item.id === nextId ? row : item)) : [...rows, row]);
            return nextId;
        };
        const patchStored = async (id, fields) => {
            const store = storeOf(id);
            const patch = {};
            if (fields.title !== undefined) patch.title = fields.title;
            if (fields.summary !== undefined) patch.summary = fields.summary || "";
            if (fields.body !== undefined) patch.body = fields.body || "";
            if (fields.people) patch.index_personajes = idList(fields.people);
            if (fields.places) patch.index_lugares = idList(fields.places);
            if (store === "ficha") {
                await updateLoreFicha(loreId, id, patch);
                return;
            }
            if (store === "era") {
                await updateLoreTimelineItem(loreId, "eras", id, patch);
                return;
            }
            if (store === "arco") {
                await updateLoreTimelineItem(loreId, "arcos", id, patch);
                return;
            }
            if (store === "neutro") {
                const rows = neutrosOf(packRef.current.lore).map((n) => (n.id === id ? {
                    ...n,
                    title: fields.title ?? n.title,
                    summary: fields.summary !== undefined ? (fields.summary || "") : n.summary,
                    body: fields.body !== undefined ? (fields.body || "") : n.body,
                    people: fields.people ? idList(fields.people) : n.people,
                    places: fields.places ? idList(fields.places) : n.places,
                } : n));
                await writeNeutros(rows);
            }
        };
        const applyArcPatch = (arc) => (
            storeOf(arc.id) === "ficha"
                ? updateLoreFicha(loreId, arc.id, { era_ids: arc.eraIds })
                : updateLoreTimelineItem(loreId, "arcos", arc.id, { era_ids: arc.eraIds })
        );
        const writeLinks = async (links) => {
            const lore = packRef.current.lore || {};
            packRef.current = { ...packRef.current, lore: { ...lore, enlaces: links.map(linkToRow) } };
            await updateLore(loreId, { enlaces: links.map(linkToRow) });
        };
        const writeNeutros = async (rows) => {
            const lore = packRef.current.lore || {};
            packRef.current = { ...packRef.current, lore: { ...lore, neutros: rows.map(neutroToRow) } };
            await updateLore(loreId, { neutros: rows.map(neutroToRow) });
        };
        const writePaints = async (paints) => {
            const lore = packRef.current.lore || {};
            const rows = paintsToRows(paints);
            packRef.current = { ...packRef.current, lore: { ...lore, pinturas: rows } };
            await updateLore(loreId, { pinturas: rows });
        };
        const shiftPaint = async (fromId, toId) => {
            if (!fromId || !toId || fromId === toId) return;
            const paints = normalizePaints(packRef.current.lore?.pinturas);
            if (!paints[fromId]) return;
            paints[toId] = paints[fromId];
            delete paints[fromId];
            await writePaints(paints);
        };
        const dropPaint = async (id) => {
            const paints = normalizePaints(packRef.current.lore?.pinturas);
            if (!paints[id]) return;
            delete paints[id];
            await writePaints(paints);
        };
        const layoutPatch = (fields) => (
            fields.layoutX == null ? {} : { layout_x: fields.layoutX, layout_y: fields.layoutY }
        );
        const saveNeutral = async (id, fields) => {
            if (!id) {
                return createLoreFicha(loreId, {
                    entity_type: "neutro",
                    title: fields.title || "Sin título",
                    summary: fields.summary || "",
                    body: fields.body || "",
                    slug: slugFor(fields.title, "neutro"),
                    index_personajes: idList(fields.people),
                    index_lugares: idList(fields.places),
                    ...layoutPatch(fields),
                });
            }
            if (storeOf(id) === "neutro") {
                const rows = neutrosOf(packRef.current.lore);
                const prev = rows.find((n) => n.id === id);
                const next = {
                    ...prev,
                    id,
                    title: fields.title || prev?.title || "Sin título",
                    summary: fields.summary !== undefined ? (fields.summary || "") : (prev?.summary || ""),
                    body: fields.body !== undefined ? (fields.body || "") : (prev?.body || ""),
                    people: fields.people ? idList(fields.people) : (prev?.people || []),
                    places: fields.places ? idList(fields.places) : (prev?.places || []),
                    layoutX: fields.layoutX !== undefined ? fields.layoutX : prev?.layoutX ?? null,
                    layoutY: fields.layoutY !== undefined ? fields.layoutY : prev?.layoutY ?? null,
                };
                await writeNeutros(rows.map((n) => (n.id === id ? next : n)));
                return id;
            }
            await updateLoreFicha(loreId, id, {
                title: fields.title || "Sin título",
                ...(fields.summary !== undefined ? { summary: fields.summary || "" } : {}),
                ...(fields.body !== undefined ? { body: fields.body || "" } : {}),
                ...layoutPatch(fields),
            });
            return id;
        };
        const nodeType = { neutro: "neutro", era: "era", arco: "arco", evento: "acontecimiento" };
        const api = {
            saveNow: async (now) => {
                const parsed = now ? parseDZ(now) : null;
                if (now && !parsed) fail("Ahora D.Z.: AAAA, AAAA-MM o AAAA-MM-DD.");
                await updateLore(loreId, {
                    present_dz: now || null,
                    present_year: parsed ? parsed.y : null,
                });
            },
            saveEra: async (id, fields) => {
                const row = {
                    title: fields.title,
                    summary: fields.summary || "",
                    ...(fields.body !== undefined ? { body: fields.body || "" } : {}),
                    start_year: fields.start ?? null,
                    end_year: fields.end ?? null,
                    ...(fields.people !== undefined ? { index_personajes: idList(fields.people) } : {}),
                    ...(fields.places !== undefined ? { index_lugares: idList(fields.places) } : {}),
                    ...layoutPatch(fields),
                };
                if (!id) {
                    return createLoreFicha(loreId, {
                        entity_type: "era",
                        ...row,
                        slug: slugFor(fields.title, "era"),
                    });
                }
                if (storeOf(id) === "ficha") {
                    await updateLoreFicha(loreId, id, row);
                    return id;
                }
                await updateLoreTimelineItem(loreId, "eras", id, row);
                return id;
            },
            saveArc: async (id, fields) => {
                const row = {
                    title: fields.title,
                    summary: fields.summary || "",
                    ...(fields.body !== undefined ? { body: fields.body || "" } : {}),
                    color: fields.color || null,
                    start: fields.start || null,
                    end: fields.end || null,
                    era_ids: fields.eraIds || [],
                    ...(fields.people !== undefined ? { index_personajes: idList(fields.people) } : {}),
                    ...(fields.places !== undefined ? { index_lugares: idList(fields.places) } : {}),
                    ...layoutPatch(fields),
                };
                if (!id) {
                    return createLoreFicha(loreId, {
                        entity_type: "arco",
                        ...row,
                        slug: slugFor(fields.title, "arco"),
                    });
                }
                if (storeOf(id) === "ficha") {
                    await updateLoreFicha(loreId, id, row);
                    return id;
                }
                await updateLoreTimelineItem(loreId, "arcos", id, row);
                return id;
            },
            saveEvent: async (id, fields) => {
                const cols = anchorToColumns(fields.anchor);
                const place = layoutPatch(fields);
                const text = {
                    title: fields.title,
                    summary: fields.summary || "",
                    ...(fields.body !== undefined ? { body: fields.body || "" } : {}),
                    ...(fields.people !== undefined ? { index_personajes: idList(fields.people) } : {}),
                    ...(fields.places !== undefined ? { index_lugares: idList(fields.places) } : {}),
                };
                if (id) {
                    await updateLoreFicha(loreId, id, { ...text, ...cols, ...place });
                    return id;
                }
                return createLoreFicha(loreId, {
                    entity_type: "evento_historico",
                    ...text,
                    slug: slugFor(fields.title, "acontecimiento"),
                    ...cols,
                    ...place,
                });
            },
            saveBody: async ({ id, body }) => {
                if (sesionesOf().some((row) => row.id === id)) {
                    await saveSession(id, { body });
                    return;
                }
                await patchStored(id, { body });
            },
            saveIndex: async ({ id, people, places }) => {
                const nextPeople = idList(people);
                const nextPlaces = idList(places);
                await patchStored(id, { people: nextPeople, places: nextPlaces });
                const rows = await listLoreRelaciones(loreId);
                const drop = relationsDroppedByIndex(rows, id, nextPeople, nextPlaces);
                await Promise.all(drop.map((row) => deleteLoreRelation(loreId, row.id)));
            },
            saveLayout: async (type, id, x, y) => {
                if (type === "sol") {
                    await updateLore(loreId, { layout_x: x, layout_y: y });
                    return;
                }
                if (type === "sesion") {
                    await saveSession(id, { layoutX: x, layoutY: y });
                    return;
                }
                const store = storeOf(id);
                if (store === "ficha" || type === "evento" || type === "asteroid") {
                    await updateLoreFicha(loreId, id, { layout_x: x, layout_y: y });
                    return;
                }
                if (store === "neutro" || type === "neutro") {
                    const rows = neutrosOf(packRef.current.lore).map((n) => (n.id === id ? { ...n, layoutX: x, layoutY: y } : n));
                    await writeNeutros(rows);
                    return;
                }
                if (store === "era" || type === "era") await updateLoreTimelineItem(loreId, "eras", id, { layout_x: x, layout_y: y });
                else if (store === "arco" || type === "arco") await updateLoreTimelineItem(loreId, "arcos", id, { layout_x: x, layout_y: y });
                else await updateLoreFicha(loreId, id, { layout_x: x, layout_y: y });
            },
            saveLink: async (next) => {
                const result = upsertLink(normalizeLinks(packRef.current.lore?.enlaces), next);
                if (!result.ok) fail(result.reason);
                await writeLinks(result.links);
            },
            saveLinks: async (rows) => {
                const result = upsertLinks(normalizeLinks(packRef.current.lore?.enlaces), rows);
                if (result.saved.length) await writeLinks(result.links);
                return result;
            },
            dropLink: async (aId, bId) => {
                await writeLinks(dropPair(normalizeLinks(packRef.current.lore?.enlaces), aId, bId));
            },
            savePaint: async (id, paint) => {
                const paints = normalizePaints(packRef.current.lore?.pinturas);
                paints[id] = paint;
                await writePaints(paints);
            },
            saveNeutral,
            convertNode: async ({ fromKind, id, toKind, fields }) => {
                const fichaType = { neutro: "neutro", era: "era", arco: "arco", evento: "evento_historico" }[toKind] || toKind;
                const solarType = nodeType[toKind] || toKind;
                const shared = {
                    entity_type: fichaType,
                    title: fields.title || "Sin título",
                    summary: fields.summary || "",
                    body: fields.body || "",
                    index_personajes: idList(fields.people),
                    index_lugares: idList(fields.places),
                    layout_x: fields.layoutX,
                    layout_y: fields.layoutY,
                    slug: slugFor(fields.title, toKind),
                };
                const fromStore = storeOf(id);
                if (fromStore === "ficha") {
                    await updateLoreFicha(loreId, id, shared);
                } else {
                    await writeLoreFichaAt(loreId, id, shared);
                    if (fromStore === "neutro") {
                        await writeNeutros(neutrosOf(packRef.current.lore).filter((n) => n.id !== id));
                    } else if (fromStore === "era" || fromKind === "era") {
                        await deleteLoreTimelineItem(loreId, "eras", id);
                    } else if (fromStore === "arco" || fromKind === "arco") {
                        await deleteLoreTimelineItem(loreId, "arcos", id);
                    }
                }
                const links = linksAfterRetarget(normalizeLinks(packRef.current.lore?.enlaces), id, id, solarType);
                await writeLinks(links);
                return id;
            },
            saveSession,
            placeSession: saveSession,
            hangSession: async (sessionId, eventId) => {
                await writeSesiones(withSessionEvent(sesionesOf(), sessionId, eventId, "add"));
            },
            unhangSession: async (sessionId, eventId) => {
                await writeSesiones(withSessionEvent(sesionesOf(), sessionId, eventId, "drop"));
            },
            annexSession: async (loreSessionId, campId, actaId) => {
                const rows = actasRef.current.filter((row) => row.campaignId === campId);
                await Promise.all(rows.map(async (acta) => {
                    const chosen = acta.id === actaId;
                    const has = acta.loreSessionId === loreSessionId;
                    if (chosen && !has) await updateSessionLog(campId, acta.id, { loreSessionId });
                    if (!chosen && has) await updateSessionLog(campId, acta.id, { loreSessionId: "" });
                }));
            },
            setSessionArc: async (loreSessionId, arcoId) => {
                const links = replaceSessionArc(packRef.current.lore?.enlaces, loreSessionId, arcoId);
                await updateLore(loreId, { enlaces: links.map(linkToRow) });
            },
            openActa: (actaId) => onOpenActa?.(actaId),
            setPublished: campaignId
                ? async (id, on) => { await setFichaVisibility(campaignId, id, on ? "players" : "dm_only"); }
                : null,
            remove: async (kind, id) => {
                if (kind === "sesion") {
                    await writeSesiones(sesionesOf().filter((row) => row.id !== id));
                    await writeLinks(dropNodeLinks(normalizeLinks(packRef.current.lore?.enlaces), id));
                    const pointed = actasRef.current.filter((row) => row.loreSessionId === id);
                    await Promise.all(pointed.map((acta) => updateSessionLog(acta.campaignId, acta.id, { loreSessionId: "" })));
                    return;
                }
                await dropPaint(id);
                const store = storeOf(id);
                const patches = kind === "neutro" ? { arcs: [], events: [] } : removalPatches(kind, id, current());
                if (store === "neutro") await writeNeutros(neutrosOf(packRef.current.lore).filter((n) => n.id !== id));
                else if (store === "ficha") await deleteLoreFicha(loreId, id);
                else if (store === "era" || kind === "era") await deleteLoreTimelineItem(loreId, "eras", id);
                else if (store === "arco" || kind === "arco") await deleteLoreTimelineItem(loreId, "arcos", id);
                await writeLinks(dropNodeLinks(normalizeLinks(packRef.current.lore?.enlaces), id));
                await Promise.all([
                    ...patches.arcs.map(applyArcPatch),
                    ...patches.events.map((ev) => updateLoreFicha(loreId, ev.id, anchorToColumns(ev.anchor))),
                ]);
            },
        };
        return api;
    }, [loreId, onOpenActa, campaignId]);

    const status = error ? "error" : ready ? (pack.lore ? "ready" : "error") : "loading";

    return (
        <ArchiveTimeline
            data={solarData}
            actions={actions}
            status={status}
            error={status === "error" && !error ? "No encontramos este Lore o no es tuyo." : error}
            note={campaignId
                ? "El tiempo es el del Lore. El acta de la mesa se anexa; no es otro nodo."
                : "Las sesiones se crean aquí. Sin campaña enlazada no hay acta a la que anexar."}
            publishedCount={publishedCount}
        />
    );
}
