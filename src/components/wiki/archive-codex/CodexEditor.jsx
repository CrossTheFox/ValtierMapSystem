import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WikiMentionInput from "../WikiMentionInput";
import CyberTooltip from "../../customs/CyberTooltip";
import ArchiveIcon from "./ArchiveIcon";
import {
    CODEX_AUTOSAVE_MS,
    CODEX_COPY,
    CODEX_FORM_ORDER,
    CODEX_SAVED_CLEAR_MS,
    CODEX_TYPES,
} from "../../../constants/wiki/archiveCodex";
import { findUnlinked, scanMentions } from "../../../utils/archiveCodexText";

function IndexPick({ label, options, ids, onToggle }) {
    const chosen = new Set(ids || []);
    const left = options.filter((o) => !chosen.has(o.id));
    return (
        <div className="fld">
            <span className="fl-t">{label}</span>
            <div className="ix-list">
                {(ids || []).map((id) => (
                    <button type="button" key={id} className="ix-chip" onClick={() => onToggle(id)}>
                        {(options.find((o) => o.id === id)?.title) || "Sin título"} ×
                    </button>
                ))}
            </div>
            {left.length > 0 && (
                <select className="select" value="" onChange={(e) => { if (e.target.value) onToggle(e.target.value); }}>
                    <option value="">Agregar…</option>
                    {left.map((o) => <option key={o.id} value={o.id}>{o.title || "Sin título"}</option>)}
                </select>
            )}
        </div>
    );
}

function HelpDot({ text }) {
    return (
        <CyberTooltip title={text}>
            <span className="help-dot" tabIndex={0}>?</span>
        </CyberTooltip>
    );
}

/**
 * Click-to-edit surface of one ficha (mock `entityEditorHtml`). Edits autosave after 650 ms and flush on leave.
 * The first save of a new ficha creates it; later saves update the same id.
 */
export default function CodexEditor({ initial, fichaId, fichas, byId, onCommit, onCreated, onClose, onError }) {
    const [draft, setDraft] = useState(() => ({
        entity_type: initial.entity_type || "personaje",
        title: initial.title || "",
        summary: initial.summary || "",
        body: initial.body || "",
        index_personajes: Array.isArray(initial.index_personajes) ? initial.index_personajes : [],
        index_lugares: Array.isArray(initial.index_lugares) ? initial.index_lugares : [],
        start_year: initial.start_year ?? "",
        end_year: initial.end_year ?? "",
        start: initial.start || "",
        end: initial.end || "",
    }));
    const [save, setSave] = useState("idle");
    const draftRef = useRef(draft);
    const idRef = useRef(fichaId || null);
    const dirtyRef = useRef(false);
    const timerRef = useRef(null);
    const clearRef = useRef(null);
    const chainRef = useRef(Promise.resolve());
    const mountedRef = useRef(true);
    const callbacks = useRef({ onCommit, onCreated, onError });
    useEffect(() => {
        callbacks.current = { onCommit, onCreated, onError };
    });

    const commit = useCallback(() => {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        if (!dirtyRef.current) return chainRef.current;
        dirtyRef.current = false;
        const snapshot = draftRef.current;
        chainRef.current = chainRef.current
            .then(async () => {
                const id = await callbacks.current.onCommit(idRef.current, snapshot);
                if (!idRef.current && id) {
                    idRef.current = id;
                    if (mountedRef.current) callbacks.current.onCreated?.(id);
                }
                if (!mountedRef.current) return;
                setSave("saved");
                clearTimeout(clearRef.current);
                clearRef.current = setTimeout(() => mountedRef.current && setSave("idle"), CODEX_SAVED_CLEAR_MS);
            })
            .catch((err) => {
                console.error("Error guardando ficha:", err);
                if (mountedRef.current) setSave("idle");
                callbacks.current.onError?.(err);
            });
        return chainRef.current;
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            clearTimeout(clearRef.current);
            commit();
        };
    }, [commit]);

    const patch = (key, value) => {
        const next = { ...draftRef.current, [key]: value };
        draftRef.current = next;
        setDraft(next);
        dirtyRef.current = true;
        setSave("pending");
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(commit, CODEX_AUTOSAVE_MS);
    };

    const selfId = fichaId || null;
    const isNode = ["neutro", "era", "arco", "evento_historico"].includes(draft.entity_type);
    const people = fichas.filter((f) => f.entity_type === "personaje" && f.id !== selfId);
    const places = fichas.filter((f) => f.entity_type === "locacion" && f.id !== selfId);
    const toggleIndex = (key, id) => {
        const cur = draftRef.current[key] || [];
        patch(key, cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
    };
    const mentionEntities = useMemo(
        () => fichas
            .filter((f) => f.id !== selfId)
            .map((f) => ({ ...f, entityType: CODEX_TYPES[f.entity_type]?.label || f.entity_type })),
        [fichas, selfId],
    );

    const ms = scanMentions(draft.body, fichas, byId);
    const broken = ms.filter((m) => m.st === "br").length;
    const legacy = ms.filter((m) => m.st === "lg").length;
    const unl = findUnlinked(draft.body, fichas, selfId).length;
    const linked = ms.length - broken;

    const tip = "Guardar y salir";
    return (
        <div className="ent-ed edit-surface">
            <div className="edit-tools">
                {save !== "idle" && (
                    <span className={`save-st ${save === "saved" ? "ok" : ""}`} role="status">
                        {save === "pending" ? "Guardando…" : "Guardado"}
                    </span>
                )}
                <CyberTooltip title={tip}>
                    <button
                        type="button"
                        className="icon-btn pencil"
                        aria-label={tip}
                        aria-pressed="true"
                        onClick={onClose}
                    >
                        <ArchiveIcon name="pencil" />
                    </button>
                </CyberTooltip>
            </div>
            <div className="ent-ed-h">{fichaId ? "Editar ficha" : "Nueva ficha"}</div>
            <label className="fld">
                <span className="fl-t">Título</span>
                <input
                    className="input title"
                    value={draft.title}
                    placeholder="Nombre de la ficha"
                    onChange={(e) => patch("title", e.target.value)}
                    onBlur={commit}
                    autoFocus={!fichaId}
                />
            </label>
            <p className="hint-line">{CODEX_COPY.formOrder}</p>
            <label className="fld">
                <span className="fl-t">Tipo</span>
                <select className="select" value={draft.entity_type} onChange={(e) => patch("entity_type", e.target.value)}>
                    {CODEX_FORM_ORDER.map((k) => (
                        <option key={k} value={k}>{CODEX_TYPES[k].label}</option>
                    ))}
                </select>
            </label>
            <label className="fld">
                <span className="fl-t">Resumen</span>
                <input
                    className="input"
                    value={draft.summary}
                    placeholder="Una línea"
                    onChange={(e) => patch("summary", e.target.value)}
                    onBlur={commit}
                />
            </label>
            {draft.entity_type === "era" && (
                <div className="ix-dates">
                    <label className="fld">
                        <span className="fl-t">Desde (año)</span>
                        <input className="input" value={draft.start_year} onChange={(e) => patch("start_year", e.target.value)} onBlur={commit} />
                    </label>
                    <label className="fld">
                        <span className="fl-t">Hasta (año)</span>
                        <input className="input" value={draft.end_year} onChange={(e) => patch("end_year", e.target.value)} onBlur={commit} />
                    </label>
                </div>
            )}
            {(draft.entity_type === "arco" || draft.entity_type === "evento_historico") && (
                <div className="ix-dates">
                    <label className="fld">
                        <span className="fl-t">Desde</span>
                        <input className="input" value={draft.start} placeholder="AAAA o AAAA-MM-DD" onChange={(e) => patch("start", e.target.value)} onBlur={commit} />
                    </label>
                    <label className="fld">
                        <span className="fl-t">Hasta</span>
                        <input className="input" value={draft.end} placeholder="Opcional" onChange={(e) => patch("end", e.target.value)} onBlur={commit} />
                    </label>
                </div>
            )}
            {isNode && (
                <>
                    <IndexPick label="Personajes" options={people} ids={draft.index_personajes} onToggle={(id) => toggleIndex("index_personajes", id)} />
                    <IndexPick label="Lugares" options={places} ids={draft.index_lugares} onToggle={(id) => toggleIndex("index_lugares", id)} />
                </>
            )}
            <div className="fl-l">Texto <HelpDot text={CODEX_COPY.bodyHelp} /></div>
            <div onBlur={commit}>
                <WikiMentionInput
                    value={draft.body}
                    onChange={(v) => patch("body", v)}
                    entities={mentionEntities}
                    rows={12}
                    placeholder={CODEX_COPY.bodyPlaceholder}
                />
            </div>
            <div className="cn-status">
                {linked} {linked === 1 ? "mención" : "menciones"}
                {unl > 0 && ` · ${unl} ${unl === 1 ? "nombre" : "nombres"} sin enlazar`}
                {legacy > 0 && ` · ${legacy} ${legacy === 1 ? "mención antigua" : "menciones antiguas"}`}
                {broken > 0 && <span className="bad">{` · ${broken} ${broken === 1 ? "rota" : "rotas"}`}</span>}
            </div>
        </div>
    );
}
