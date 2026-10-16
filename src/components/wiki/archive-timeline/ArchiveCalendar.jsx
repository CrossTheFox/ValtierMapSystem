import React, { useMemo, useState } from "react";
import { DZ_MON, dayList, eraHi, fmtDZ, isVagueAnchor, parseDZ, sessionMarkDay } from "../../../utils/archiveTimeline";

function utcDay(y, m, d) {
    const dt = new Date(0);
    dt.setUTCFullYear(y, m - 1, d);
    return dt;
}

const partsOf = (dt) => ({ y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() });

/** First month to show: the present D.Z., else the first dated acontecimiento, else the first session day. */
function initialFocus(data) {
    const now = parseDZ(data.sun?.now);
    if (now) return { y: now.y, m: now.m || 1, d: now.d || 1 };
    for (const ev of data.events) {
        const first = dayList(ev.anchor)[0];
        if (first) return { y: first.y, m: first.m, d: first.d || 1 };
    }
    for (const s of data.sessions) {
        const p = sessionMarkDay(s);
        if (p) return { y: p.y, m: p.m, d: p.d };
    }
    const era = data.eras.find((e) => Number.isFinite(Number(e.start)));
    return { y: era ? Number(era.start) : 1, m: 1, d: 1 };
}

const sameDay = (a, b) => a.y === b.y && a.m === b.m && a.d === b.d;

/**
 * Mock `renderCalendario`: month / week / day grids. Only day or month precision and the session's
 * own D.Z. day (`inGame`) take a cell; a vague anchor stays on the solar.
 */
export default function ArchiveCalendar({ data, onSuggest, onSelect, onToast, onOpenSession }) {
    const [mode, setMode] = useState("mes");
    const [focus, setFocus] = useState(() => initialFocus(data));
    const canEdit = !!data.canEdit;
    const { y, m } = focus;

    const days = useMemo(() => {
        if (mode === "dia") return [{ ...focus }];
        if (mode === "semana") {
            const anchor = utcDay(focus.y, focus.m, focus.d);
            const monday = new Date(anchor);
            monday.setUTCDate(anchor.getUTCDate() - ((anchor.getUTCDay() + 6) % 7));
            return Array.from({ length: 7 }, (_, i) => {
                const dt = new Date(monday);
                dt.setUTCDate(monday.getUTCDate() + i);
                return partsOf(dt);
            });
        }
        const n = utcDay(focus.y, focus.m + 1, 0).getUTCDate();
        return Array.from({ length: n }, (_, i) => ({ y: focus.y, m: focus.m, d: i + 1 }));
    }, [mode, focus]);

    const lists = useMemo(() => new Map(data.events.map((ev) => [ev.id, dayList(ev.anchor)])), [data.events]);
    const monthEvents = data.events.filter((ev) => lists.get(ev.id).some((x) => x.month && x.y === y && x.m === m));
    const vague = data.events.filter((ev) => isVagueAnchor(ev.anchor)).length;
    const onDay = (ev, day) => lists.get(ev.id).some((x) => !x.month && sameDay(x, day));
    const rangeCls = (ev, i) => {
        const set = new Set(lists.get(ev.id).filter((x) => !x.month).map((x) => fmtDZ(x.y, x.m, x.d)));
        const key = (k) => fmtDZ(days[k].y, days[k].m, days[k].d);
        const prev = i > 0 && i % 7 !== 0 && set.has(key(i - 1));
        const next = i + 1 < days.length && i % 7 !== 6 && set.has(key(i + 1));
        return `${prev ? "rng-l" : ""} ${next ? "rng-r" : ""}`.trim();
    };
    const inEra = (yy) => data.eras.some((er) => {
        const s = Number(er.start);
        return Number.isFinite(s) && yy >= s && yy <= eraHi(er);
    });
    const dayHits = days.some((day) => data.events.some((ev) => onDay(ev, day)));

    const pan = (dir) => {
        const step = mode === "dia" ? dir : mode === "semana" ? dir * 7 : 0;
        if (step) setFocus(partsOf(utcDay(focus.y, focus.m, focus.d + step)));
        else setFocus({ ...partsOf(utcDay(focus.y, focus.m + dir, 1)) });
    };
    const suggest = (day) => {
        if (!canEdit) return;
        onSuggest({ precision: "day", y: String(day.y), m: String(day.m), d: String(day.d) });
    };

    const label = mode === "mes"
        ? `${DZ_MON[m - 1]} ${y}`
        : mode === "semana" ? `Semana · ${fmtDZ(days[0].y, days[0].m, days[0].d)}` : fmtDZ(y, m, days[0].d);

    return (
        <div className="tl-cal">
            <div className="tl-bar">
                <div className="tbg" role="group" aria-label="Grano civil">
                    {[["mes", "Mes"], ["semana", "Semana"], ["dia", "Día"]].map(([id, lab]) => (
                        <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id)}>{lab}</button>
                    ))}
                </div>
                <button type="button" className="btn" aria-label="Periodo anterior" onClick={() => pan(-1)}>←</button>
                <span className="mono">{label} D.Z.</span>
                <button type="button" className="btn" aria-label="Periodo siguiente" onClick={() => pan(1)}>→</button>
                <span className="help">
                    Entran la precisión de mes o día y el día D.Z. de cada sesión como marca. Un acontecimiento vago no ocupa celda. El fondo se tiñe si el día cae en una era.
                </span>
            </div>
            <div className="cal-scroll">
                {monthEvents.length > 0 && <div className="hint-line">Este mes: {monthEvents.map((ev) => ev.title).join(" · ")}</div>}
                {mode === "mes" && !monthEvents.length && !dayHits && <div className="empty-note">Sin acontecimientos en este mes.</div>}
                {vague > 0 && <div className="hint-line">{vague} acontecimiento{vague > 1 ? "s" : ""} vago{vague > 1 ? "s" : ""} siguen en el lienzo.</div>}
                <div className="cal-grid">
                    {days.map((day, i) => {
                        const key = fmtDZ(day.y, day.m, day.d);
                        const evs = data.events.filter((ev) => onDay(ev, day));
                        const marks = data.sessions.filter((s) => {
                            const p = sessionMarkDay(s);
                            return p && sameDay(p, day);
                        });
                        return (
                            <div
                                key={key}
                                className={`cal-day ${inEra(day.y) ? "era" : ""} ${canEdit ? "" : "ro"}`}
                                tabIndex={0}
                                role={canEdit ? "button" : undefined}
                                aria-label={`Día ${key}`}
                                onClick={() => suggest(day)}
                                onKeyDown={(e) => {
                                    if (e.key !== "Enter" && e.key !== " ") return;
                                    if (e.target !== e.currentTarget) return;
                                    e.preventDefault();
                                    suggest(day);
                                }}
                            >
                                <span className="n">{key}</span>
                                {evs.map((ev) => (
                                    <button
                                        key={ev.id}
                                        type="button"
                                        className={`tl-card ${rangeCls(ev, i)}`}
                                        onClick={(e) => { e.stopPropagation(); onSelect(ev.id); }}
                                    >
                                        <span className="t">{ev.title}</span>
                                    </button>
                                ))}
                                {marks.map((s) => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        className="tl-mark"
                                        aria-label={`Marca de mesa, sesión ${s.n}`}
                                        title={s.title}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onToast("Marca de mesa, no es ficha.");
                                            onOpenSession?.(s.id);
                                        }}
                                    >
                                        S{s.n}
                                    </button>
                                ))}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
