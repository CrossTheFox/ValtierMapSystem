import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box } from "@mui/material";
import { ARCHIVE_TIMELINE_SX } from "../../../constants/archiveTimelineStyles";
import { createSolarEngine } from "./solarEngine";
import ArchiveCalendar from "./ArchiveCalendar";

const TOAST_MS = 2600;
const EMPTY_CHROME = {
    filter: "todo", focus: "", panelOpen: true, searchOpen: false, q: "", eras: [], arcs: [],
    kinds: { planet: true, moon: true, asteroid: true, neutral: true, session: true },
};
const LENS = [
    ["planet", "Eras"],
    ["moon", "Arcos"],
    ["asteroid", "Acontecimientos"],
    ["neutral", "Neutros"],
    ["session", "Sesiones"],
];

function ToolIcon({ d }) {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={d} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}
const ICO = {
    search: "M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14ZM20 20l-3.5-3.5",
    filter: "M4 5h16l-6 7v6l-4 2v-8L4 5Z",
    redraw: "M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5",
    calendar: "M5 5h14v15H5V5ZM8 3v4M16 3v4M5 9h14",
    list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
};

function TimelineTools({ engineRef, view, chrome, note, onCalendar, publishedCount }) {
    const [pop, setPop] = useState(null);
    const searchRef = useRef(null);
    const wasOpen = useRef(false);
    const engine = () => engineRef.current;
    useEffect(() => {
        if (chrome.searchOpen && !wasOpen.current) searchRef.current?.focus();
        wasOpen.current = !!chrome.searchOpen;
    }, [chrome.searchOpen]);
    useEffect(() => {
        if (!pop) return undefined;
        const close = (ev) => {
            if (ev.target.closest?.(".tl-tools")) return;
            setPop(null);
        };
        document.addEventListener("pointerdown", close, true);
        return () => document.removeEventListener("pointerdown", close, true);
    }, [pop]);
    const togglePop = (id) => setPop((cur) => (cur === id ? null : id));
    const kindOn = (id) => chrome.kinds?.[id] !== false;
    const lensOff = LENS.some(([id]) => !kindOn(id));
    const pickFocus = (id) => engine()?.focusEra(chrome.focus === id ? "" : id);
    return (
        <div className="tl-tools" role="toolbar" aria-label="Herramientas de la línea" title={note || undefined}>
            {publishedCount != null && (
                <span
                    className={`tool-pub${publishedCount ? "" : " is-none"}`}
                    title="Nodos que los jugadores ven en su Timeline. Ábrelos y usa «Mesa» en la ficha para publicar u ocultar."
                >
                    <span className="k">Mesa</span>
                    <span className="v">{publishedCount ? `${publishedCount} publicado${publishedCount === 1 ? "" : "s"}` : "nada publicado"}</span>
                </span>
            )}
            <div className="tool-search">
                {chrome.searchOpen && (
                    <input
                        ref={searchRef}
                        className="solar-q"
                        type="search"
                        placeholder="Buscar…"
                        aria-label="Buscar en el grafo"
                        value={chrome.q}
                        onChange={(ev) => engine()?.setQuery(ev.target.value)}
                    />
                )}
                <button
                    type="button"
                    className="tool-btn"
                    aria-label="Buscar"
                    aria-pressed={chrome.searchOpen}
                    onClick={() => engine()?.toggleSearch()}
                >
                    <ToolIcon d={ICO.search} />
                </button>
            </div>
            <div className="tool-slot">
                <button
                    type="button"
                    className="tool-btn"
                    aria-label="Filtrar tipos, eras y arcos"
                    aria-pressed={lensOff || !!chrome.focus}
                    aria-expanded={pop === "filter"}
                    onClick={() => togglePop("filter")}
                >
                    <ToolIcon d={ICO.filter} />
                </button>
                {pop === "filter" && (
                    <div className="tool-pop" role="menu">
                        {LENS.map(([id, label]) => (
                            <button
                                key={id}
                                type="button"
                                role="menuitemcheckbox"
                                aria-pressed={kindOn(id)}
                                onClick={() => engine()?.toggleKind(id)}
                            >
                                {label}
                            </button>
                        ))}
                        <button type="button" role="menuitem" onClick={() => engine()?.setFilter("todo")}>Ver todo</button>
                        {!!chrome.eras?.length && <p className="tool-kicker">Solo una era</p>}
                        {(chrome.eras || []).map((era) => (
                            <button
                                key={era.id}
                                type="button"
                                role="menuitemradio"
                                aria-pressed={chrome.focus === era.id}
                                onClick={() => pickFocus(era.id)}
                            >
                                {era.title}
                            </button>
                        ))}
                        {!!chrome.arcs?.length && <p className="tool-kicker">Solo un arco</p>}
                        {(chrome.arcs || []).map((arc) => (
                            <button
                                key={arc.id}
                                type="button"
                                role="menuitemradio"
                                aria-pressed={chrome.focus === arc.id}
                                onClick={() => pickFocus(arc.id)}
                            >
                                {arc.title}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <button type="button" className="tool-btn" aria-label="Volver a dibujar" onClick={() => engine()?.redraw()}>
                <ToolIcon d={ICO.redraw} />
            </button>
            <button
                type="button"
                className="tool-btn"
                aria-label={view === "calendario" ? "Volver al grafo" : "Ir al calendario"}
                aria-pressed={view === "calendario"}
                onClick={onCalendar}
            >
                <ToolIcon d={ICO.calendar} />
            </button>
            <button
                type="button"
                className="tool-btn"
                aria-label={chrome.panelOpen ? "Replegar la línea" : "Desplegar la línea"}
                aria-pressed={chrome.panelOpen}
                onClick={() => engine()?.togglePanel()}
            >
                <ToolIcon d={ICO.list} />
            </button>
        </div>
    );
}

/**
 * Timeline area of the Archive (fase 4): the solar graph and the calendar over the same data.
 * Adapters (`CampaignTimeline`, `LoreTimeline`) own reads and writes; this only draws.
 * @param {{ data: object|null, actions: object, status: "loading"|"ready"|"error", error?: string, note?: string }} props
 */
export default function ArchiveTimeline({ data, actions, status, error = "", note = "", publishedCount = null }) {
    const hostRef = useRef(null);
    const engineRef = useRef(null);
    const toastTimer = useRef(null);
    const [view, setView] = useState("solar");
    const [toast, setToast] = useState({ msg: "", on: false });
    const [confirm, setConfirm] = useState(null);
    const [chrome, setChrome] = useState(EMPTY_CHROME);

    const showToast = useCallback((msg) => {
        clearTimeout(toastTimer.current);
        setToast({ msg, on: true });
        toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, on: false })), TOAST_MS);
    }, []);
    useEffect(() => () => clearTimeout(toastTimer.current), []);

    const ask = useCallback((msg) => new Promise((resolve) => setConfirm({ msg, resolve })), []);
    const answer = (ok) => {
        confirm?.resolve(ok);
        setConfirm(null);
    };

    useEffect(() => {
        const engine = createSolarEngine(hostRef.current);
        engineRef.current = engine;
        return () => {
            engine.destroy();
            engineRef.current = null;
        };
    }, []);

    const onChrome = useCallback((snap) => setChrome(snap), []);
    const openCalendar = useCallback(() => setView((cur) => (cur === "calendario" ? "solar" : "calendario")), []);
    const fullActions = useMemo(
        () => ({ ...actions, toast: showToast, confirm: ask, onChrome, openCalendar }),
        [actions, showToast, ask, onChrome, openCalendar],
    );
    useEffect(() => {
        if (status === "ready" && data) engineRef.current?.update(data, fullActions);
    }, [data, fullActions, status]);
    useEffect(() => {
        engineRef.current?.setActive(view === "solar");
    }, [view]);

    const ready = status === "ready" && !!data;
    const bare = ready && view === "solar" && data.canEdit && !(
        (data.eras?.length || 0)
        + (data.arcs?.length || 0)
        + (data.events?.length || 0)
        + (data.sessions?.length || 0)
        + (data.neutrals?.length || 0)
    );

    return (
        <Box sx={ARCHIVE_TIMELINE_SX} className="archive-tl">
            <div className="tl-host">
                {status === "loading" && <div className="empty-note">Cargando la línea…</div>}
                {status === "error" && <div className="empty-note" role="alert">{error || "No se pudo leer la línea."}</div>}
                <div ref={hostRef} className="solar-host" />
                {ready && view === "calendario" && (
                    <div className="tl-cal-layer">
                        <ArchiveCalendar
                            key={data.scopeKey}
                            data={data}
                            onSuggest={(prefill) => engineRef.current?.suggest(prefill)}
                            onSelect={(id) => engineRef.current?.select(id)}
                            onToast={showToast}
                            onOpenSession={(id) => actions.openSession?.(id)}
                        />
                    </div>
                )}
                {bare && (
                    <div className="tl-empty-start">
                        <p>El sol ya está. Todavía no hay nodos.</p>
                        <button type="button" className="btn pri" onClick={() => engineRef.current?.startBlank("neutral")}>
                            Crear entidad
                        </button>
                        <button type="button" className="btn" onClick={() => engineRef.current?.startBlank("sesion")}>
                            Sesión
                        </button>
                    </div>
                )}
                {ready && (
                    <TimelineTools
                        engineRef={engineRef}
                        view={view}
                        chrome={chrome}
                        note={note}
                        onCalendar={openCalendar}
                        publishedCount={publishedCount}
                    />
                )}
            </div>
            {confirm && (
                <div
                    className="confirm-back"
                    data-archive-confirm=""
                    onClick={() => answer(false)}
                    onKeyDown={(e) => {
                        if (e.key !== "Escape") return;
                        e.stopPropagation();
                        answer(false);
                    }}
                >
                    <div className="confirm" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
                        <div className="confirm-h">Confirmar</div>
                        <p>{confirm.msg}</p>
                        <div className="acts">
                            <button type="button" className="btn" onClick={() => answer(false)} autoFocus>Cancelar</button>
                            <button type="button" className="btn pri" onClick={() => answer(true)}>Aceptar</button>
                        </div>
                    </div>
                </div>
            )}
            <div className={`toast ${toast.on ? "on" : ""}`} role="status" aria-live="polite">{toast.msg}</div>
        </Box>
    );
}
