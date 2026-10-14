import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box } from "@mui/material";
import { ARCHIVE_DIARY_SX } from "../../../constants/archiveDiaryStyles";
import { DZ_MON, linkToRow, normalizeLinks } from "../../../utils/archiveTimeline";
import { plainOf } from "../../../utils/archiveCodexText";
import { slugify, uniqueSlug } from "../../../utils/wikiSlug";
import { updateWikiEntity } from "../../../../firebase/services/wikiEntityService";
import { getLore, subscribeLore, updateLore } from "../../../../firebase/services/loreService";
import { createLoreFicha, subscribeLoreFichas } from "../../../../firebase/services/loreFichaService";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import {
    normalizeLoreSessions,
    actaArcId,
    actaEventIds,
    replaceSessionArc,
    sessionArcId,
    sessionToRow,
    withSessionEvent,
} from "../../../utils/loreSessions";
import {
    subscribeSessionLogs,
    createSessionLog,
    updateSessionLog,
    deleteSessionLog,
} from "../../../../firebase/services/sessionLogService";
import CyberTooltip from "../../customs/CyberTooltip";
import ArchiveIcon from "../archive-codex/ArchiveIcon";
import WikiMentionInput from "../WikiMentionInput";

const VALTIA_ZERO_ONE = "RfY23gcG7No5HcGddo1j";
const IN_GAME = /^\d{1,6}(-\d{2}(-\d{2})?)?$/;
const FULL_DAY = /^\d{1,6}-\d{2}-\d{2}$/;
const MONTH = /^\d{1,6}-\d{2}$/;
const ACTA = [
    ["no_tocada", "No tocada"],
    ["avanzada", "Avanzada"],
    ["completada", "Completada"],
    ["fallida", "Fallida"],
];
const SAVE_MS = 650;

function partsOf(session) {
    return (session?.participants || []).map((p) => (
        typeof p === "string" ? { id: "", name: p } : { id: p?.id || "", name: p?.name || "" }
    )).filter((p) => p.id || p.name);
}
function partKey(p) {
    return p.id || `n:${p.name}`;
}
function mesaLabel(date) {
    const m = String(date || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return "Sin fecha";
    return `${Number(m[3])} ${DZ_MON[Number(m[2]) - 1] || m[2]} ${m[1]}`;
}
function whenLine(session) {
    const from = mesaLabel(session.sessionDate);
    const to = session.dateTo && session.dateTo !== session.sessionDate ? mesaLabel(session.dateTo) : "";
    const played = to && to !== "Sin fecha" ? `${from} – ${to}` : from;
    const world = session.inGame ? `${session.inGame} D.Z.` : "Sin fecha D.Z.";
    return `${played} · ${world}`;
}
function actaStatus(status) {
    return ACTA.find(([id]) => id === status)?.[1] || String(status || "").replace(/_/g, " ");
}
function IconBtn({ tip, icon, onClick, className = "", pressed }) {
    return (
        <CyberTooltip title={tip}>
            <button type="button" className={`icon-btn ${className}`} aria-label={tip} aria-pressed={pressed} onClick={onClick}>
                <ArchiveIcon name={icon} />
            </button>
        </CyberTooltip>
    );
}
function presenceKind(session) {
    if ((session.eventIds || []).length) return "hung";
    if (FULL_DAY.test(String(session.inGame || "").trim())) return "cal";
    return "";
}
function presenceLabel(kind) {
    if (kind === "hung") return "Colgada";
    if (kind === "cal") return "Solo calendario";
    return "Sin marca";
}
function presenceText(session, nameOf, loreTitle = "") {
    const name = (session.eventIds || []).map(nameOf).find(Boolean);
    const game = String(session.inGame || "").trim();
    const n = session.n ?? "";
    const annexed = loreTitle ? ` El acta está anexada a «${loreTitle}».` : "";
    if (name && FULL_DAY.test(game)) return `Colgada de ${name}. El día D.Z. además deja la marca S${n} en el calendario.${annexed}`;
    if (name && MONTH.test(game)) return `Colgada de ${name}. La fecha in-game es un mes, no un día: el calendario no pinta celda.${annexed}`;
    if (name) return `Colgada de ${name}. Sin día D.Z., el calendario no pinta marca.${annexed}`;
    if (FULL_DAY.test(game)) return `Sin acontecimiento. El día D.Z. deja la marca S${n} en el calendario.${annexed}`;
    if (MONTH.test(game) || /^\d{1,6}$/.test(game)) return `Sin acontecimiento y sin día D.Z.: el calendario no pinta celda.${annexed}`;
    if (loreTitle) return `Sin acontecimiento y sin fecha D.Z.${annexed}`;
    return "Sin acontecimiento y sin fecha D.Z. La sesión vive solo en el Diario.";
}
function besideSun() {
    const n = Date.now() % 5;
    return { layout_x: 772 + n * 36, layout_y: 528 + (n - 2) * 48 };
}
function fichaIdsFor(participants, entities) {
    const ids = [];
    participants.forEach((p) => {
        if (!p.id) return;
        const ficha = entities.find((e) => e.linkedVttCharacterId === p.id);
        if (ficha && !ids.includes(ficha.id)) ids.push(ficha.id);
    });
    return ids;
}
function applyPlay(play, refs, src, mode) {
    let next = (play || []).map((row) => ({ ...row, sources: [...(row.sources || [])] }));
    refs.forEach((ref) => {
        const row = next.find((r) => r.ref === ref);
        if (mode === "add") {
            if (!row) next.push({ kind: "wiki", ref, status: "confirmado", sources: [src] });
            else if (!row.sources.includes(src)) row.sources = [...row.sources, src];
        } else if (row) {
            row.sources = row.sources.filter((s) => s !== src);
            if (!row.sources.length) next = next.filter((r) => r !== row);
        }
    });
    return next;
}

/**
 * Mesa Bitácora. An acta is not a Lore session and does not create one.
 * Annex points this acta at a session that already exists on the linked Lore.
 */
export default function ArchiveDiary({
    campaignId,
    readOnly = false,
    focusSessionId = null,
    uid = null,
    entities = [],
    charactersById = {},
    onOpenEntity,
}) {
    const locked = !campaignId || campaignId === VALTIA_ZERO_ONE;
    const canEdit = !readOnly && !locked;
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [q, setQ] = useState("");
    const [arcFilter, setArcFilter] = useState("");
    const [who, setWho] = useState("");
    const [sel, setSel] = useState("");
    const [editingId, setEditingId] = useState("");
    const [toast, setToast] = useState("");
    const [confirm, setConfirm] = useState(null);
    const toastTimer = useRef(null);
    const saveTimer = useRef(null);
    const pending = useRef(null);
    const sessionsRef = useRef([]);
    const focusSeen = useRef(null);
    const [loreId, setLoreId] = useState("");
    const [loreSessions, setLoreSessions] = useState([]);
    const [loreLinks, setLoreLinks] = useState([]);
    const [loreFichas, setLoreFichas] = useState([]);
    const loreRef = useRef({ id: "", sessions: [], links: [] });

    const showToast = useCallback((msg) => {
        clearTimeout(toastTimer.current);
        setToast(msg);
        toastTimer.current = setTimeout(() => setToast(""), 2800);
    }, []);

    useEffect(() => () => {
        clearTimeout(toastTimer.current);
        clearTimeout(saveTimer.current);
    }, []);

    useEffect(() => {
        if (!campaignId) return undefined;
        setLoading(true);
        return subscribeSessionLogs(campaignId, (rows) => {
            setSessions(rows);
            setLoading(false);
            setError("");
        }, (err) => {
            setLoading(false);
            setError(err?.message || "No se pudo leer el Diario.");
        });
    }, [campaignId]);

    useEffect(() => {
        if (!campaignId) return undefined;
        return onSnapshot(doc(db, "campaigns", campaignId), (snap) => {
            setLoreId(snap.exists() ? (snap.data().primary_lore_id || "") : "");
        }, () => setLoreId(""));
    }, [campaignId]);

    useEffect(() => {
        if (!loreId || readOnly) {
            setLoreSessions([]);
            setLoreLinks([]);
            setLoreFichas([]);
            loreRef.current = { id: "", sessions: [], links: [] };
            return undefined;
        }
        const unsubs = [
            subscribeLore(loreId, (lore) => {
                const sessions = normalizeLoreSessions(lore?.sesiones);
                const links = normalizeLinks(lore?.enlaces);
                loreRef.current = { id: loreId, sessions, links };
                setLoreSessions(sessions);
                setLoreLinks(links);
            }, () => {}),
            subscribeLoreFichas(loreId, (rows) => setLoreFichas(rows), () => {}),
        ];
        return () => unsubs.forEach((unsub) => unsub());
    }, [loreId, readOnly]);

    const byId = useMemo(() => new Map(entities.map((e) => [e.id, e])), [entities]);
    const visibleEntities = useMemo(
        () => entities.filter((e) => !readOnly || e.visibility !== "dm_only"),
        [entities, readOnly],
    );
    const nameOf = useCallback((id) => (
        byId.get(id)?.title || loreFichas.find((ficha) => ficha.id === id)?.title || ""
    ), [byId, loreFichas]);
    const charName = useCallback((id) => charactersById[id]?.name || "Sin nombre", [charactersById]);

    const arcIdOf = useCallback((session) => actaArcId(session, loreLinks), [loreLinks]);
    const eventIdsOf = useCallback((session) => actaEventIds(session, loreSessions), [loreSessions]);
    const arcTitle = useCallback((session) => {
        const id = arcIdOf(session);
        if (id) {
            return byId.get(id)?.title
                || loreFichas.find((ficha) => ficha.id === id)?.title
                || session.arc
                || "";
        }
        return session.arc || "";
    }, [arcIdOf, byId, loreFichas]);
    const arcColor = useCallback((session) => {
        const id = arcIdOf(session);
        const ent = id ? byId.get(id) : null;
        const lore = id ? loreFichas.find((ficha) => ficha.id === id) : null;
        return ent?.customFields?.arco?.color || ent?.customFields?.color || lore?.color || "#ff66aa";
    }, [arcIdOf, byId, loreFichas]);

    sessionsRef.current = sessions;
    const ranked = useMemo(() => [...sessions].sort((a, b) => (b.sessionDate || "").localeCompare(a.sessionDate || "") || (b.n || 0) - (a.n || 0)), [sessions]);

    const matches = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return ranked.filter((s) => {
            const key = arcIdOf(s) || (s.arc ? `t:${s.arc}` : "");
            if (arcFilter === "__none" && key) return false;
            if (arcFilter && arcFilter !== "__none" && key !== arcFilter) return false;
            const people = partsOf(s);
            if (who && !people.some((p) => partKey(p) === who)) return false;
            if (!needle) return true;
            const blob = [
                s.title, plainOf(s.recap || ""), s.sessionDate, s.dateTo, s.inGame, arcTitle(s),
                ...people.map((p) => p.name || charName(p.id)),
            ].join(" ").toLowerCase();
            return blob.includes(needle);
        });
    }, [ranked, q, arcFilter, who, arcTitle, charName, arcIdOf]);

    useEffect(() => {
        if (!focusSessionId || focusSeen.current === focusSessionId) return;
        if (!sessions.some((s) => s.id === focusSessionId)) return;
        focusSeen.current = focusSessionId;
        setSel(focusSessionId);
    }, [focusSessionId, sessions]);

    useEffect(() => {
        if (sel && (matches.some((s) => s.id === sel) || sessions.some((s) => s.id === sel))) return;
        if (matches[0]) setSel(matches[0].id);
    }, [matches, sel, sessions]);

    const open = sessions.find((s) => s.id === sel) || null;

    const arcs = useMemo(() => {
        const map = new Map();
        sessions.forEach((s) => {
            const key = arcIdOf(s) || (s.arc ? `t:${s.arc}` : "");
            if (!key || map.has(key)) return;
            map.set(key, { id: key, title: arcTitle(s) || "Sin título", color: key.startsWith("t:") ? "#aaaaaa" : arcColor(s) });
        });
        return [...map.values()].sort((a, b) => a.title.localeCompare(b.title, "es"));
    }, [sessions, arcTitle, arcColor, arcIdOf]);

    const people = useMemo(() => {
        const map = new Map();
        sessions.forEach((s) => partsOf(s).forEach((p) => {
            const key = partKey(p);
            if (!map.has(key)) map.set(key, p.name || charName(p.id));
        }));
        return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "es"));
    }, [sessions, charName]);

    const groups = useMemo(() => {
        const order = [];
        const map = new Map();
        matches.forEach((s) => {
            const key = arcIdOf(s) || (s.arc ? `t:${s.arc}` : "");
            if (!map.has(key)) { map.set(key, []); order.push(key); }
            map.get(key).push(s);
        });
        return order.map((key) => {
            const sample = map.get(key)[0];
            return {
                key,
                title: key ? arcTitle(sample) : "Sin arco",
                color: key && !key.startsWith("t:") ? arcColor(sample) : "#aaaaaa",
                items: map.get(key),
            };
        });
    }, [matches, arcTitle, arcColor, arcIdOf]);

    const guard = () => {
        if (locked) throw new Error("Valtia Zero One no se escribe en esta pasada.");
    };

    const patchSession = useCallback(async (session, patch) => {
        guard();
        await updateSessionLog(campaignId, session.id, patch);
    }, [campaignId, locked]);

    const writePlay = useCallback(async (entity, session, participants, mode) => {
        if (!entity) return;
        const refs = fichaIdsFor(participants, entities);
        if (!refs.length) return;
        const play = applyPlay(entity.customFields?.play, refs, `session:${session.id}`, mode);
        await updateWikiEntity(campaignId, entity.id, {
            customFields: { ...(entity.customFields || {}), play },
        }, uid);
    }, [campaignId, entities, uid]);

    const save = useCallback(async (session, draft) => {
        if (!canEdit || !session) return;
        const raw = String(draft.inGame || "").trim();
        if (raw && !IN_GAME.test(raw)) {
            showToast("Fecha D.Z.: AAAA, AAAA-MM o AAAA-MM-DD. No se escribió.");
            return;
        }
        await patchSession(session, {
            title: String(draft.title || "").trim() || "Sesión sin título",
            recap: draft.recap || "",
            sessionDate: draft.sessionDate || "",
            dateTo: draft.dateTo || "",
            inGame: raw,
            arcId: draft.arcId || "",
            arc: draft.arc || "",
            participants: draft.participants || [],
            links: draft.links || [],
            eventIds: draft.eventIds || [],
            acta: draft.acta || [],
            loreSessionId: draft.loreSessionId || "",
        });
    }, [canEdit, patchSession, showToast]);

    const queueSave = (session, draft) => {
        pending.current = { id: session.id, draft };
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            const job = pending.current;
            pending.current = null;
            if (!job) return;
            const live = sessionsRef.current.find((s) => s.id === job.id) || session;
            save(live, job.draft).catch((err) => showToast(err?.message || "No se pudo guardar la sesión."));
        }, SAVE_MS);
    };

    const absorb = (sessionId, patch) => {
        if (pending.current?.id !== sessionId) return;
        pending.current = { id: sessionId, draft: { ...pending.current.draft, ...patch } };
    };

    const createSession = async () => {
        if (!canEdit) return;
        const n = Math.max(0, ...sessions.map((s) => Number(s.n) || 0)) + 1;
        const today = new Date().toISOString().slice(0, 10);
        const id = await createSessionLog(campaignId, {
            title: `Sesión ${n}`,
            sessionDate: today,
            dateTo: today,
            loreSessionId: "",
            n,
        });
        setSel(id);
        setEditingId(id);
    };

    const removeSession = async (session) => {
        guard();
        for (const id of session.eventIds || []) {
            const ent = byId.get(id);
            if (ent) await writePlay(ent, session, partsOf(session), "drop");
        }
        await deleteSessionLog(campaignId, session.id);
        if (sel === session.id) setSel("");
        showToast("Sesión eliminada. El acontecimiento sigue en el Lore.");
    };

    const writeLoreSessions = async (rows) => {
        await updateLore(loreRef.current.id, { sesiones: rows.map(sessionToRow) });
    };

    const hangEvent = async (session, eventId) => {
        guard();
        const eventIds = [...new Set([...(session.eventIds || []), eventId])];
        await patchSession(session, { eventIds });
        absorb(session.id, { eventIds });
        if (!loreRef.current.id || !session.loreSessionId) return;
        const fresh = await getLore(loreRef.current.id);
        await writeLoreSessions(withSessionEvent(normalizeLoreSessions(fresh?.sesiones), session.loreSessionId, eventId, "add"));
    };

    const dropEvent = async (session, eventId) => {
        guard();
        const eventIds = (session.eventIds || []).filter((id) => id !== eventId);
        await patchSession(session, { eventIds });
        absorb(session.id, { eventIds });
        if (!loreRef.current.id || !session.loreSessionId) return;
        const fresh = await getLore(loreRef.current.id);
        await writeLoreSessions(withSessionEvent(normalizeLoreSessions(fresh?.sesiones), session.loreSessionId, eventId, "drop"));
    };

    const createFromSession = async (session, kind, name) => {
        guard();
        const title = name.trim();
        if (!title) return;
        if (!loreRef.current.id) {
            showToast("Enlaza un Lore en la Timeline. Esta sesión de mesa no crea una sesión del Lore.");
            return;
        }
        const slugs = loreFichas.map((ficha) => ficha.slug).filter(Boolean);
        const place = besideSun();
        if (kind === "arco") {
            const created = await createLoreFicha(loreRef.current.id, {
                entity_type: "arco",
                title,
                slug: uniqueSlug(slugify(title) || "arco", slugs),
                color: "#ff66aa",
                ...place,
            });
            if (session.loreSessionId) {
                const fresh = await getLore(loreRef.current.id);
                const links = replaceSessionArc(fresh?.enlaces, session.loreSessionId, created);
                await updateLore(loreRef.current.id, { enlaces: links.map(linkToRow) });
                showToast("Arco en el Lore. Agrupa la sesión anexada y no copia la noche a otros acontecimientos.");
            } else {
                showToast("Arco en el Lore, junto al sol. Anexa una sesión del Lore si quieres agruparla. No se dibuja sola.");
            }
            return;
        }
        if (kind === "evento") {
            const created = await createLoreFicha(loreRef.current.id, {
                entity_type: "evento_historico",
                title,
                slug: uniqueSlug(slugify(title) || "acontecimiento", slugs),
                ...place,
            });
            if (session.loreSessionId) {
                const fresh = await getLore(loreRef.current.id);
                await writeLoreSessions(withSessionEvent(normalizeLoreSessions(fresh?.sesiones), session.loreSessionId, created, "add"));
                showToast("Acontecimiento en el Lore, colgado de la sesión anexada. No hay línea.");
            } else {
                showToast("Acontecimiento en el Lore. Anexa una sesión para colgarlo. No se dibuja una línea.");
            }
            return;
        }
        const created = await createLoreFicha(loreRef.current.id, {
            entity_type: "mision",
            title,
            slug: uniqueSlug(slugify(title) || "mision", slugs),
            ...place,
        });
        const acta = [...(session.acta || [])];
        if (!acta.some((c) => c.id === created.id)) acta.push({ id: created.id, status: "no_tocada" });
        await patchSession(session, { acta });
        absorb(session.id, { acta });
        showToast("Misión en el Lore. En esta noche queda como No tocada.");
    };

    const openSession = sessions.find((s) => s.id === sel) || null;
    const editing = canEdit && !!openSession && editingId === openSession.id;
    const loreTitle = openSession
        ? (loreSessions.find((row) => row.id === openSession.loreSessionId)?.title || "")
        : "";

    return (
        <Box className="bitacora" sx={ARCHIVE_DIARY_SX}>
            {locked && (
                <p className="bt-note">Valtia Zero One no se escribe en esta pasada. El Diario queda en lectura.</p>
            )}
            <div className="bt-split">
                <aside className="bt-list">
                    <div className="idx-tools">
                        <span className="idx-title">Sesiones</span>
                        <span className="grow" />
                        {canEdit && (
                            <IconBtn
                                tip="Nueva sesión"
                                icon="plus"
                                className="plus"
                                onClick={() => createSession().catch((err) => showToast(err?.message || "No se pudo crear la sesión."))}
                            />
                        )}
                    </div>
                    <div className="bt-tools">
                        <input
                            className="input search"
                            type="search"
                            placeholder="Título, recap o fecha…"
                            aria-label="Buscar sesiones"
                            value={q}
                            onChange={(ev) => setQ(ev.target.value)}
                        />
                        <select className="select" aria-label="Filtrar por arco" value={arcFilter} onChange={(ev) => setArcFilter(ev.target.value)}>
                            <option value="">Todos los arcos</option>
                            {arcs.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
                            <option value="__none">Sin arco</option>
                        </select>
                        <select className="select" aria-label="Filtrar por participante" value={who} onChange={(ev) => setWho(ev.target.value)}>
                            <option value="">Cualquier participante</option>
                            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div className="bt-items">
                        {loading && <p className="bt-empty">Cargando el Diario…</p>}
                        {error && <p className="bt-empty" role="alert">{error}</p>}
                        {!loading && !error && !groups.length && (
                            <div className="cx-void is-slim">
                                <span className="kicker">Diario</span>
                                <p className="lead">{sessions.length ? `Nada con estos filtros.` : "Aún no hay sesiones."}</p>
                            </div>
                        )}
                        {groups.map((g) => (
                            <section key={g.key || "none"}>
                                <header className="bt-arc" style={{ "--arc": g.color }}>
                                    <span className="dot" />
                                    <b>{g.title}</b>
                                    <span className="meta">{g.items.length}</span>
                                </header>
                                {g.items.map((s) => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        className={`bt-pick ${s.id === sel ? "on" : ""}`}
                                        onClick={() => { setSel(s.id); setEditingId(""); }}
                                    >
                                        <span className="tx">
                                            <span className="t">{s.title || "Sesión sin título"}</span>
                                            <span className="s">S{s.n || "·"} · {mesaLabel(s.sessionDate)}{s.inGame ? ` · ${s.inGame}` : ""}</span>
                                        </span>
                                    </button>
                                ))}
                            </section>
                        ))}
                    </div>
                </aside>
                <section className="bt-sheet">
                    <div className={`art-inner${editing ? " is-edit" : ""}`}>
                        {!openSession && (
                            <div className="cx-void">
                                <span className="kicker">Diario</span>
                                <h2>Sin sesión abierta</h2>
                                <p className="lead">Elige una noche en la lista. El lápiz abre la edición.</p>
                                {canEdit && (
                                    <button type="button" className="btn pri" onClick={() => createSession().catch((err) => showToast(err?.message || "No se pudo crear la sesión."))}>
                                        Nueva sesión
                                    </button>
                                )}
                            </div>
                        )}
                        {openSession && editing && (
                            <SessionEditor
                                key={openSession.id}
                                session={openSession}
                                entities={visibleEntities}
                                charactersById={charactersById}
                                arcs={(loreId ? loreFichas.filter((ficha) => ficha.entity_type === "arco") : entities.filter((e) => e.entityType === "arco")).map((row) => ({ id: row.id, title: row.title }))}
                                loreId={loreId}
                                loreSessions={loreSessions}
                                loreLinks={loreLinks}
                                loreEvents={loreFichas.filter((ficha) => ficha.entity_type === "evento_historico")}
                                loreMissions={loreFichas.filter((ficha) => ficha.entity_type === "mision")}
                                onSave={(draft) => queueSave(openSession, draft)}
                                onClose={() => setEditingId("")}
                                onHang={(id) => hangEvent(openSession, id).catch((err) => showToast(err?.message || "No se pudo colgar."))}
                                onDrop={(id) => dropEvent(openSession, id).catch((err) => showToast(err?.message || "No se pudo soltar."))}
                                onPatch={(patch) => patchSession(openSession, patch).catch((err) => showToast(err?.message || "No se pudo guardar."))}
                                onArc={(loreSessionId, arcoId) => {
                                    getLore(loreId).then((fresh) => {
                                        const links = replaceSessionArc(fresh?.enlaces, loreSessionId, arcoId);
                                        return updateLore(loreId, { enlaces: links.map(linkToRow) });
                                    }).catch((err) => showToast(err?.message || "No se pudo agrupar el arco."));
                                }}
                                onPlay={(participants, mode) => {
                                    (openSession.eventIds || []).forEach((id) => {
                                        const ent = byId.get(id);
                                        if (ent) writePlay(ent, openSession, participants, mode).catch(() => {});
                                    });
                                }}
                                onCompose={(kind, name) => createFromSession(openSession, kind, name).catch((err) => showToast(err?.message || "No se pudo crear."))}
                                onOpenEntity={onOpenEntity}
                                nameOf={nameOf}
                                charName={charName}
                            />
                        )}
                        {openSession && !editing && (
                            <SessionArticle
                                session={{ ...openSession, arcId: arcIdOf(openSession), eventIds: eventIdsOf(openSession) }}
                                canEdit={canEdit}
                                arcName={arcTitle(openSession)}
                                loreTitle={loreTitle}
                                onEdit={() => setEditingId(openSession.id)}
                                onDelete={() => setConfirm(openSession)}
                                onOpenEntity={onOpenEntity}
                                nameOf={nameOf}
                                charName={charName}
                            />
                        )}
                    </div>
                </section>
            </div>
            {confirm && (
                <div className="confirm-back" onClick={() => setConfirm(null)}>
                    <div className="confirm" role="alertdialog" aria-modal="true" onClick={(ev) => ev.stopPropagation()}>
                        <div className="confirm-h">Eliminar sesión</div>
                        <p>¿Eliminar «{confirm.title || "esta sesión"}»? El acontecimiento del Lore se queda.</p>
                        <div className="acts">
                            <button type="button" className="btn" onClick={() => setConfirm(null)}>Cancelar</button>
                            <button type="button" className="btn pri" onClick={() => {
                                const target = confirm;
                                setConfirm(null);
                                removeSession(target).catch((err) => showToast(err?.message || "No se pudo eliminar."));
                            }}>Eliminar</button>
                        </div>
                    </div>
                </div>
            )}
            <div className={`toast ${toast ? "on" : ""}`} role="status">{toast}</div>
        </Box>
    );
}

function SessionArticle({ session, canEdit, arcName, loreTitle, onEdit, onDelete, onOpenEntity, nameOf, charName }) {
    const people = partsOf(session);
    const kind = presenceKind(session);
    const events = (session.eventIds || []).map((id) => ({ id, title: nameOf(id) })).filter((e) => e.title);
    const links = (session.links || []).map((id) => ({ id, title: nameOf(id) })).filter((e) => e.title);
    const acta = (session.acta || []).filter((c) => c?.id);
    const recap = plainOf(session.recap || "").trim();
    const who = people.map((p) => p.name || charName(p.id)).filter(Boolean);
    return (
        <article className="art-view" id={`ds-${session.id}`}>
            {canEdit && (
                <div className="edit-tools">
                    <IconBtn tip="Eliminar" icon="trash" onClick={onDelete} />
                    <IconBtn tip="Editar" icon="pencil" className="pencil" pressed={false} onClick={onEdit} />
                </div>
            )}
            <header className="art-head">
                <div className="grow">
                    <div className="kicker">Sesión {session.n || "·"}</div>
                    <h1>{session.title || "Sesión sin título"}</h1>
                    <p className="summary">{whenLine(session)}</p>
                    <div className="tags">
                        {arcName ? <span className="tag">{arcName}</span> : null}
                        <span className={`tag ${kind}`}>{presenceLabel(kind)}</span>
                        {loreTitle ? <span className="tag">Lore · {loreTitle}</span> : null}
                    </div>
                </div>
            </header>
            <div className="art-body">
                {recap
                    ? recap.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)
                    : (
                        <div className="cx-void">
                            <span className="kicker">Recap</span>
                            <p className="lead">Esta sesión todavía no cuenta la noche.</p>
                            {canEdit && <button type="button" className="btn" onClick={onEdit}>Escribir</button>}
                        </div>
                    )}
            </div>
            <p className="bt-note-line">{presenceText(session, nameOf, loreTitle)}</p>
            {!!who.length && (
                <>
                    <div className="sec-h">Participantes <span className="n">{who.length}</span></div>
                    <p className="bt-prose">{who.join(", ")}</p>
                </>
            )}
            {!!links.length && (
                <>
                    <div className="sec-h">Vínculos <span className="n">{links.length}</span></div>
                    <ul className="bt-lines">
                        {links.map((e) => (
                            <li key={e.id}>
                                <button type="button" className="link" onClick={() => onOpenEntity?.(e.id)}>{e.title}</button>
                            </li>
                        ))}
                    </ul>
                </>
            )}
            {!!events.length && (
                <>
                    <div className="sec-h">Acontecimientos <span className="n">{events.length}</span></div>
                    <ul className="bt-lines">
                        {events.map((e) => (
                            <li key={e.id}>
                                <button type="button" className="link" onClick={() => onOpenEntity?.(e.id)}>{e.title}</button>
                            </li>
                        ))}
                    </ul>
                </>
            )}
            {!!acta.length && (
                <>
                    <div className="sec-h">Misiones <span className="n">{acta.length}</span></div>
                    <ul className="bt-lines">
                        {acta.map((c) => (
                            <li key={c.id}>
                                <button type="button" className="link" onClick={() => onOpenEntity?.(c.id)}>{nameOf(c.id) || "Misión"}</button>
                                <span className="muted"> · {actaStatus(c.status)}</span>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </article>
    );
}

function SessionEditor({
    session, entities, charactersById, arcs, loreId, loreSessions, loreLinks, loreEvents, loreMissions,
    onSave, onClose, onHang, onDrop, onPatch, onArc, onPlay, onCompose, onOpenEntity, nameOf, charName,
}) {
    const [draft, setDraft] = useState(() => ({
        title: session.title || "",
        recap: session.recap || "",
        sessionDate: session.sessionDate || "",
        dateTo: session.dateTo || "",
        inGame: session.inGame || "",
        arcId: session.arcId || "",
        arc: session.arc || "",
        loreSessionId: session.loreSessionId || "",
        participants: partsOf(session),
        links: [...(session.links || [])],
        eventIds: [...(session.eventIds || [])],
        acta: [...(session.acta || [])],
    }));
    const [compose, setCompose] = useState("");
    const [composeName, setComposeName] = useState("");
    const serverArc = useRef(session.arcId || "");
    const serverEvents = useRef(new Set(session.eventIds || []));
    const serverActa = useRef(new Set((session.acta || []).map((c) => c.id)));
    const patch = (next) => {
        setDraft(next);
        onSave(next);
    };
    useEffect(() => {
        if ((session.arcId || "") === serverArc.current) return;
        serverArc.current = session.arcId || "";
        setDraft((d) => ({ ...d, arcId: session.arcId || "", arc: session.arc || "" }));
    }, [session.arcId, session.arc]);
    useEffect(() => {
        const next = new Set(session.eventIds || []);
        const prev = serverEvents.current;
        const added = [...next].filter((id) => !prev.has(id));
        const removed = [...prev].filter((id) => !next.has(id));
        serverEvents.current = next;
        if (!added.length && !removed.length) return;
        setDraft((d) => ({
            ...d,
            eventIds: [...new Set([...d.eventIds.filter((id) => !removed.includes(id)), ...added])],
        }));
    }, [session.eventIds]);
    useEffect(() => {
        const next = new Set((session.acta || []).map((c) => c.id));
        const prev = serverActa.current;
        const added = (session.acta || []).filter((c) => !prev.has(c.id));
        const removed = [...prev].filter((id) => !next.has(id));
        serverActa.current = next;
        if (!added.length && !removed.length) return;
        setDraft((d) => ({
            ...d,
            acta: [...d.acta.filter((c) => !removed.includes(c.id)), ...added.filter((c) => !d.acta.some((row) => row.id === c.id))],
        }));
    }, [session.acta]);
    const game = String(draft.inGame || "").trim();
    const hint = FULL_DAY.test(game)
        ? `Fecha sugerida para el acontecimiento: ${game} D.Z.`
        : "Sin fecha D.Z. válida, el acontecimiento no ocupa una celda.";
    const takenPart = new Set(draft.participants.map((p) => p.id).filter(Boolean));
    const charOptions = Object.values(charactersById || {}).filter((c) => c?.id && !takenPart.has(c.id));
    const loreSession = (loreSessions || []).find((row) => row.id === draft.loreSessionId) || null;
    const hungIds = loreSession ? (loreSession.eventIds || []) : draft.eventIds;
    const arcValue = loreSession ? sessionArcId(loreLinks, loreSession.id) : draft.arcId;
    const linkOptions = entities.filter((e) => !draft.links.includes(e.id));
    const eventSource = loreId ? (loreEvents || []) : entities.filter((e) => e.entityType === "evento_historico");
    const eventOptions = eventSource.filter((e) => !hungIds.includes(e.id));
    const missionSource = loreId ? (loreMissions || []) : entities.filter((e) => e.entityType === "mision");
    const missionOptions = missionSource.filter((e) => !draft.acta.some((c) => c.id === e.id));
    const arcOptions = arcs.filter((a) => a.id);

    return (
        <div className="ent-ed" id={`ds-${session.id}`}>
            <div className="edit-tools">
                <IconBtn tip="Listo" icon="pencil" className="pencil" pressed onClick={onClose} />
            </div>
            <div className="ent-ed-h">Editar sesión</div>
            <div className="ed-split">
                <div className="ed-main">
                    <label className="fld">
                        <span className="fl-t">Título</span>
                        <input className="input title" aria-label="Título" value={draft.title} onChange={(ev) => patch({ ...draft, title: ev.target.value })} />
                    </label>
                    <div className="ed-dates">
                        <label className="fld">
                            <span className="fl-t">Fecha</span>
                            <input className="input" type="date" aria-label="Fecha de mesa" value={draft.sessionDate} onChange={(ev) => patch({ ...draft, sessionDate: ev.target.value })} />
                        </label>
                        <label className="fld">
                            <span className="fl-t">Hasta</span>
                            <input className="input" type="date" aria-label="Fin de la mesa" value={draft.dateTo} onChange={(ev) => patch({ ...draft, dateTo: ev.target.value })} />
                        </label>
                        <label className="fld">
                            <span className="fl-t">D.Z.</span>
                            <input className="input" aria-label="Fecha D.Z." placeholder="7036-02-02" value={draft.inGame} onChange={(ev) => patch({ ...draft, inGame: ev.target.value })} />
                        </label>
                    </div>
                    <div className="bt-sec">
                        <div className="sec-h">Recap</div>
                        <WikiMentionInput
                            value={draft.recap}
                            entities={entities}
                            rows={12}
                            placeholder="Qué pasó en la sesión…"
                            onChange={(recap) => patch({ ...draft, recap })}
                        />
                    </div>
                </div>
                <div className="ed-side">
                    <div className="ed-pair">
                        <label className="fld">
                            <span className="fl-t">Sesión del Lore</span>
                            <select
                                className="select"
                                aria-label="Sesión del Lore"
                                value={draft.loreSessionId}
                                onChange={(ev) => patch({ ...draft, loreSessionId: ev.target.value })}
                            >
                                <option value="">Sin anexar</option>
                                {(loreSessions || []).map((row) => (
                                    <option key={row.id} value={row.id}>{row.title || "Sin título"}</option>
                                ))}
                            </select>
                        </label>
                        <label className="fld">
                            <span className="fl-t">Arco</span>
                            <select
                                className="select"
                                aria-label="Arco"
                                value={arcValue}
                                onChange={(ev) => {
                                    const arcId = ev.target.value;
                                    if (loreSession) {
                                        onArc?.(loreSession.id, arcId);
                                        return;
                                    }
                                    const arc = arcOptions.find((a) => a.id === arcId);
                                    patch({ ...draft, arcId, arc: arc?.title || "" });
                                }}
                            >
                                <option value="">Sin arco</option>
                                {arcOptions.map((a) => <option key={a.id} value={a.id}>{a.title || "Sin título"}</option>)}
                            </select>
                        </label>
                    </div>
                    {!loreId && <p className="bt-hint">Sin Lore enlazado. Esta acta no entra en la Timeline.</p>}
                    {!!loreId && !(loreSessions || []).length && <p className="bt-hint">El Lore todavía no tiene sesiones. Se crean en la Timeline.</p>}
                    {loreSession && <p className="bt-hint">Idea del Lore: {plainOf(loreSession.body || "") || "Sin idea."}</p>}
                    <div className="bt-sec">
                        <div className="sec-h">Participantes <span className="n">{draft.participants.length}</span></div>
                        <div className="chips">
                            {draft.participants.map((p) => (
                                <span key={partKey(p)} className="chip on">
                                    {p.name || charName(p.id)}
                                    <button type="button" className="x" aria-label={`Quitar ${p.name || charName(p.id)}`} onClick={() => {
                                        const participants = draft.participants.filter((x) => partKey(x) !== partKey(p));
                                        patch({ ...draft, participants });
                                        onPlay([p], "drop");
                                    }}>×</button>
                                </span>
                            ))}
                            <select className="select slim" aria-label="Agregar instancia" value="" onChange={(ev) => {
                                const id = ev.target.value;
                                if (!id) return;
                                const name = charactersById[id]?.name || "Sin nombre";
                                const participants = [...draft.participants, { id, name }];
                                patch({ ...draft, participants });
                                onPlay([{ id, name }], "add");
                            }}>
                                <option value="">+ instancia…</option>
                                {charOptions.map((c) => <option key={c.id} value={c.id}>{c.name || "Sin nombre"}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="bt-sec">
                        <div className="sec-h">Vínculos <span className="n">{draft.links.length}</span></div>
                        <div className="chips">
                            {draft.links.map((id) => (
                                <span key={id} className="chip on">
                                    <button type="button" className="chip hit" onClick={() => onOpenEntity?.(id)}>{nameOf(id) || "Ficha"}</button>
                                    <button type="button" className="x" aria-label={`Quitar ${nameOf(id)}`} onClick={() => patch({ ...draft, links: draft.links.filter((x) => x !== id) })}>×</button>
                                </span>
                            ))}
                            <select className="select slim" aria-label="Agregar ficha" value="" onChange={(ev) => {
                                const id = ev.target.value;
                                if (id) patch({ ...draft, links: [...draft.links, id] });
                            }}>
                                <option value="">+ ficha…</option>
                                {linkOptions.map((e) => <option key={e.id} value={e.id}>{e.title || "Sin título"}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="bt-sec">
                        <div className="sec-h">Acontecimientos <span className="n">{hungIds.length}</span></div>
                        <p className="bt-hint">{presenceText({ ...session, ...draft, eventIds: hungIds }, nameOf, loreSession?.title || "")}</p>
                        <div className="chips">
                            {hungIds.map((id) => (
                                <span key={id} className="chip on">
                                    <button type="button" className="chip hit" onClick={() => onOpenEntity?.(id)}>{nameOf(id) || "Acontecimiento"}</button>
                                    <button type="button" className="x" aria-label={`Quitar ${nameOf(id)}`} onClick={() => {
                                        if (!loreSession) patch({ ...draft, eventIds: draft.eventIds.filter((x) => x !== id) });
                                        onDrop(id);
                                    }}>×</button>
                                </span>
                            ))}
                            <select className="select slim" aria-label="Agregar acontecimiento" value="" onChange={(ev) => {
                                const id = ev.target.value;
                                if (!id) return;
                                if (!loreSession) patch({ ...draft, eventIds: [...draft.eventIds, id] });
                                onHang(id);
                            }}>
                                <option value="">+ acontecimiento…</option>
                                {eventOptions.map((e) => <option key={e.id} value={e.id}>{e.title || "Sin título"}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="bt-sec">
                        <div className="sec-h">Misiones <span className="n">{draft.acta.length}</span></div>
                        {draft.acta.map((c) => (
                            <div key={c.id} className="acta-row">
                                <label className="fld">
                                    <span className="fl-t">{nameOf(c.id) || "misión"}</span>
                                    <select className="select" aria-label={`Estado de ${nameOf(c.id) || "misión"}`} value={c.status} onChange={(ev) => {
                                        const acta = draft.acta.map((row) => (row.id === c.id ? { ...row, status: ev.target.value } : row));
                                        patch({ ...draft, acta });
                                        onPatch({ acta });
                                    }}>
                                        {ACTA.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                                    </select>
                                </label>
                                <button type="button" className="btn" onClick={() => patch({ ...draft, acta: draft.acta.filter((row) => row.id !== c.id) })}>Quitar</button>
                            </div>
                        ))}
                        <select className="select slim" aria-label="Agregar misión" value="" onChange={(ev) => {
                            const id = ev.target.value;
                            if (!id) return;
                            const acta = [...draft.acta, { id, status: "no_tocada" }];
                            patch({ ...draft, acta });
                        }}>
                            <option value="">+ misión…</option>
                            {missionOptions.map((e) => <option key={e.id} value={e.id}>{e.title || "Sin título"}</option>)}
                        </select>
                    </div>
                    <div className="bt-sec">
                        <div className="sec-h">Crear en el Lore</div>
                        <div className="ed-actions">
                            <button type="button" className="btn" onClick={() => { setCompose(compose === "arco" ? "" : "arco"); setComposeName(""); }}>Nuevo arco</button>
                            <button type="button" className="btn" onClick={() => { setCompose(compose === "evento" ? "" : "evento"); setComposeName(""); }}>Nuevo acontecimiento</button>
                            <button type="button" className="btn" onClick={() => { setCompose(compose === "mision" ? "" : "mision"); setComposeName(""); }}>Nueva misión</button>
                        </div>
                        <p className="bt-hint">{hint}</p>
                        {compose && (
                            <div className="bt-compose">
                                <input
                                    className="input"
                                    aria-label="Nombre"
                                    placeholder={compose === "arco" ? "Arco nuevo" : compose === "evento" ? "Acontecimiento nuevo" : "Misión nueva"}
                                    value={composeName}
                                    onChange={(ev) => setComposeName(ev.target.value)}
                                />
                                <button type="button" className="btn pri" onClick={() => { onCompose(compose, composeName); setCompose(""); setComposeName(""); }}>Crear</button>
                                <button type="button" className="btn" onClick={() => setCompose("")}>Cancelar</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
