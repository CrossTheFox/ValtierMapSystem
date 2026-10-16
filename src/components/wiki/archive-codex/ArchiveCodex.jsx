import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box } from "@mui/material";
import CyberTooltip from "../../customs/CyberTooltip";
import ArchiveIcon from "./ArchiveIcon";
import CodexEditor from "./CodexEditor";
import { CodexInline, CodexRich } from "./CodexRichText";
import { CodexTextContext } from "./codexTextContext";
import { ARCHIVE_CODEX_SX } from "../../../constants/archiveCodexStyles";
import { ARCHIVE_SPIN_SX } from "../../../constants/archiveChrome";
import { CODEX_COPY, CODEX_ORDER, CODEX_TYPES, codexTitleFallback } from "../../../constants/wiki/archiveCodex";
import { backlinksOf, findUnlinked, fold, initialsOf, scanMentions } from "../../../utils/archiveCodexText";
import { slugify, uniqueSlug } from "../../../utils/wikiSlug";

const P = "personaje";
const TOAST_MS = 2600;

function HelpDot({ text }) {
    return (
        <CyberTooltip title={text}>
            <span className="help-dot" tabIndex={0}>?</span>
        </CyberTooltip>
    );
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

function FichaIcon({ f, size = "" }) {
    if (!f) return <span className={`ticon ${size}`} style={{ "--c": "#777" }}>?</span>;
    if (f.entity_type === P) {
        return f.image_url
            ? <img className={`avatar ${size}`} src={f.image_url} alt="" />
            : <span className={`avatar ${size}`}>{initialsOf(f.title)}</span>;
    }
    const T = CODEX_TYPES[f.entity_type] || { code: "?", color: "#aaa" };
    return <span className={`ticon ${size}`} style={{ "--c": T.color }}>{T.code}</span>;
}

function Veil({ on, text, children }) {
    if (!on) return children ?? text;
    return <span className="id-glitch" data-label={text}>{text}</span>;
}

function Highlight({ title, q }) {
    const t = String(title || "");
    const needle = q.trim();
    const i = needle ? fold(t).indexOf(fold(needle)) : -1;
    if (i < 0) return t;
    return <>{t.slice(0, i)}<mark>{t.slice(i, i + needle.length)}</mark>{t.slice(i + needle.length)}</>;
}

function Tags({ list }) {
    if (!list?.length) return null;
    return list.map((t) => <span key={t.id} className={`tag ${t.id}`}>{t.label}</span>);
}

/**
 * Codex of the Archive mock (index · article · Dossier rail), data-source agnostic.
 * `fichas` use the model columns (`entity_type`, `title`, `summary`, `body`, `slug`, `image_url`).
 * Writes go through `onCreate` / `onUpdate` / `onDelete`; `deleteBlock` returns the stop message, if any.
 *
 * Selection and the edit surface can be controlled (`selectedId` / `surface`) so a host keeps deep links.
 * Table hosts plug in their own editor, Dossier rail, portrait, article blocks, VTT tags, veil and VTT mentions.
 */
export default function ArchiveCodex({
    fichas = [],
    loading = false,
    error = "",
    canEdit = false,
    emptyText = "Todavía no hay fichas.",
    onCreate,
    onUpdate,
    onDelete,
    deleteBlock,
    onOpenLab,
    labFor,
    indexTypes = null,
    indexFilter,
    selectedId,
    onSelectedChange,
    surface: surfaceProp,
    onSurfaceChange,
    renderEditor,
    renderRail,
    renderHeaderAside,
    renderArticleExtra,
    renderStory,
    tagsOf,
    isVeiled,
    external,
    createRequest = null,
}) {
    const byId = useMemo(() => new Map(fichas.map((f) => [f.id, f])), [fichas]);
    const fichasRef = useRef(fichas);
    useEffect(() => { fichasRef.current = fichas; }, [fichas]);

    const selControlled = selectedId !== undefined;
    const [selState, setSelState] = useState("");
    const selId = selControlled ? selectedId || "" : selState;
    const setSelId = useCallback((id) => {
        if (!selControlled) setSelState(id);
        onSelectedChange?.(id);
    }, [selControlled, onSelectedChange]);

    const surfControlled = surfaceProp !== undefined;
    const [surfState, setSurfState] = useState(null);
    const surface = surfControlled ? surfaceProp : surfState;
    const setSurface = useCallback((next) => {
        const value = typeof next === "function" ? next(surface) : next;
        if (value === surface) return;
        if (!surfControlled) setSurfState(value);
        onSurfaceChange?.(value);
    }, [surface, surfControlled, onSurfaceChange]);

    const [q, setQ] = useState("");
    const [type, setType] = useState("all");
    const [back, setBack] = useState([]);
    const [railOpen, setRailOpen] = useState(true);
    const [shutGroups, setShutGroups] = useState({});
    const [flashTarget, setFlashTarget] = useState(null);
    const [toast, setToast] = useState({ msg: "", on: false });
    const [confirm, setConfirm] = useState(null);
    const articleRef = useRef(null);
    const itemsRef = useRef(null);
    const toastTimer = useRef(null);

    const indexed = useMemo(
        () => (indexTypes || indexFilter
            ? fichas.filter((f) => (!indexTypes || indexTypes.includes(f.entity_type)) && (!indexFilter || indexFilter(f)))
            : fichas),
        [fichas, indexTypes, indexFilter],
    );
    const hub = useMemo(() => {
        const people = indexed.filter((f) => f.entity_type === P).sort((a, b) => a.title.localeCompare(b.title, "es"));
        return people[0] || indexed[0] || null;
    }, [indexed]);
    const current = selId ? byId.get(selId) || null : hub;
    const currentId = current?.id || "";
    const veilOf = useCallback((f) => !!(f && isVeiled?.(f)), [isVeiled]);
    const textCtx = useMemo(() => ({ isVeiled: isVeiled || null, external: external || null }), [isVeiled, external]);

    const showToast = useCallback((msg) => {
        clearTimeout(toastTimer.current);
        setToast({ msg, on: true });
        toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, on: false })), TOAST_MS);
    }, []);
    useEffect(() => () => clearTimeout(toastTimer.current), []);

    const matches = useMemo(() => {
        const needle = fold(q.trim());
        let list = indexed.filter((f) => type === "all" || f.entity_type === type);
        if (needle) {
            list = list
                .filter((f) => fold(f.title).includes(needle) || (f.slug || "").includes(needle) || fold(f.summary).includes(needle))
                .sort((a, b) => (fold(b.title).startsWith(needle) - fold(a.title).startsWith(needle))
                    || (fold(b.title).includes(needle) - fold(a.title).includes(needle)));
        }
        return list;
    }, [indexed, q, type]);

    const groups = useMemo(() => CODEX_ORDER
        .map((k) => [k, matches.filter((f) => f.entity_type === k).sort((a, b) => (q ? 0 : a.title.localeCompare(b.title, "es")))])
        .filter(([, g]) => g.length), [matches, q]);
    const visible = useMemo(() => groups.flatMap(([, g]) => g), [groups]);

    const goEntity = useCallback((id, { flash = null, push = true } = {}) => {
        if (!byId.has(id)) return;
        setSurface(null);
        if (push && currentId && currentId !== id) setBack((b) => [...b, currentId]);
        setSelId(id);
        setFlashTarget(flash ? { id: flash, n: Date.now() } : null);
        if (articleRef.current) articleRef.current.scrollTop = 0;
    }, [byId, currentId, setSelId, setSurface]);

    useEffect(() => {
        if (!flashTarget || !articleRef.current) return undefined;
        const el = articleRef.current.querySelector(`.art-body .mn[data-go="${CSS.escape(flashTarget.id)}"]`);
        if (!el) return undefined;
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        el.classList.remove("flash");
        void el.offsetWidth;
        el.classList.add("flash");
        const t = setTimeout(() => el.classList.remove("flash"), 1400);
        return () => clearTimeout(t);
    }, [flashTarget, selId]);

    useEffect(() => {
        itemsRef.current?.querySelector(".on")?.scrollIntoView({ block: "nearest" });
    }, [currentId, railOpen]);

    const commitDraft = useCallback(async (id, draft) => {
        const title = draft.title.trim() || codexTitleFallback(draft.entity_type);
        const others = fichasRef.current.filter((f) => f.id !== id).map((f) => f.slug).filter(Boolean);
        const data = {
            entity_type: draft.entity_type,
            title,
            summary: draft.summary,
            body: draft.body,
            slug: uniqueSlug(slugify(title) || "ficha", others),
        };
        if (["neutro", "era", "arco", "evento_historico"].includes(draft.entity_type)) {
            data.index_personajes = Array.isArray(draft.index_personajes) ? draft.index_personajes : [];
            data.index_lugares = Array.isArray(draft.index_lugares) ? draft.index_lugares : [];
        }
        if (draft.entity_type === "era") {
            const yearOrNull = (v) => {
                if (v === "" || v == null) return null;
                const n = Number(v);
                return Number.isFinite(n) ? n : null;
            };
            data.start_year = yearOrNull(draft.start_year);
            data.end_year = yearOrNull(draft.end_year);
        }
        if (draft.entity_type === "arco" || draft.entity_type === "evento_historico") {
            data.start = draft.start || null;
            data.end = draft.end || null;
        }
        if (id) {
            await onUpdate(id, data);
            return id;
        }
        return onCreate(data);
    }, [onCreate, onUpdate]);

    const startCreate = () => {
        if (!canEdit) return;
        setSurface({ kind: "create", key: `new-${Date.now()}`, entityType: P });
    };
    const createToken = createRequest?.token || 0;
    const bootSeen = useRef(0);
    useEffect(() => {
        if (!createToken || createToken === bootSeen.current || !canEdit || surfControlled) return;
        bootSeen.current = createToken;
        setSurfState({
            kind: "create",
            key: `boot-${createToken}`,
            entityType: createRequest?.entityType || P,
        });
    }, [createToken, canEdit, surfControlled, createRequest?.entityType]);
    const startEdit = (f) => setSurface({ kind: "edit", id: f.id, key: `ed-${f.id}-${Date.now()}` });

    const askDelete = (f) => {
        const block = deleteBlock?.(f);
        if (block) return showToast(block);
        setConfirm({
            text: CODEX_COPY.deleteConfirm(f.title),
            run: async () => {
                try {
                    await onDelete(f.id);
                    setSurface(null);
                    setBack((b) => b.filter((x) => x !== f.id));
                    setSelId("");
                } catch (err) {
                    console.error("Error eliminando ficha:", err);
                    showToast("No se pudo eliminar la ficha.");
                }
            },
        });
    };

    const onSearchKey = (ev) => {
        if (!visible.length) return;
        const i = visible.findIndex((f) => f.id === currentId);
        if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
            const next = visible[Math.min(Math.max(i + (ev.key === "ArrowDown" ? 1 : -1), 0), visible.length - 1)];
            setSurface(null);
            setSelId(next.id);
            ev.preventDefault();
        } else if (ev.key === "Enter" && currentId) {
            goEntity(currentId);
        }
    };

    const creating = surface?.kind === "create";
    const editing = surface?.kind === "edit";

    const typeCounts = [["all", "Todo"], ...CODEX_ORDER
        .filter((k) => indexed.some((f) => f.entity_type === k))
        .map((k) => [k, CODEX_TYPES[k].plural])];

    const indexHtml = railOpen ? (
        <>
            <div className="idx-tools">
                <IconBtn tip="Replegar índice" icon="chevL" onClick={() => setRailOpen(false)} />
                <span className="idx-title">Fichas</span>
                <span className="grow" />
                <HelpDot text={CODEX_COPY.groupHelp} />
                {canEdit && <IconBtn tip="Nueva ficha" icon="plus" className="plus" onClick={startCreate} />}
            </div>
            <div className="cx-search">
                <input
                    className="input search"
                    placeholder="Buscar ficha…"
                    value={q}
                    autoComplete="off"
                    aria-label="Buscar ficha"
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={onSearchKey}
                />
                <div className="chips" role="toolbar" aria-label="Filtrar por tipo">
                    {typeCounts.map(([k, label]) => (
                        <CyberTooltip key={k} title={label}>
                            <button
                                type="button"
                                className="chip ico"
                                style={{ "--c": k === "all" ? "#ff66ff" : CODEX_TYPES[k].color }}
                                aria-pressed={type === k}
                                aria-label={label}
                                onClick={() => setType(k)}
                            >
                                <ArchiveIcon name={k === "all" ? "all" : k} />
                            </button>
                        </CyberTooltip>
                    ))}
                </div>
            </div>
            <div className="cx-items scroll" ref={itemsRef}>
                {!indexed.length ? (
                    <div className="cx-void is-slim">
                        <span className="kicker">Códice</span>
                        <p className="lead">{emptyText}</p>
                    </div>
                ) : !matches.length ? (
                    <div className="cx-void is-slim">
                        <span className="kicker">Búsqueda</span>
                        <p className="lead">Nada con «{q}». Prueba con una palabra del resumen.</p>
                    </div>
                ) : groups.map(([k, g]) => {
                    const shut = !!shutGroups[k];
                    return (
                        <section key={k} className={`cx-group ${shut ? "is-shut" : ""}`}>
                            <button
                                type="button"
                                className="group-h"
                                aria-expanded={!shut}
                                onClick={() => setShutGroups((s) => ({ ...s, [k]: !s[k] }))}
                            >
                                <span className="chev"><ArchiveIcon name="chevD" /></span>
                                <span className="dot" style={{ background: CODEX_TYPES[k].color, color: CODEX_TYPES[k].color }} />
                                {CODEX_TYPES[k].plural}
                                <span className="n">{g.length}</span>
                            </button>
                            <div className="g-body"><div className="g-clip">
                                {k === P ? (
                                    <div className="pc-grid">
                                        {g.map((f) => {
                                            const veiled = veilOf(f);
                                            return (
                                                <button key={f.id} type="button" className={`pc-card ${f.id === currentId && !creating ? "on" : ""}`} onClick={() => goEntity(f.id)}>
                                                    <span className={`ph ${veiled ? "veil-img" : ""}`}>
                                                        {f.image_url ? <img src={f.image_url} alt="" /> : initialsOf(f.title)}
                                                        {tagsOf && <span className="corner bl"><Tags list={tagsOf(f).slice(0, 2)} /></span>}
                                                    </span>
                                                    <span className="nm"><Veil on={veiled} text={f.title}><Highlight title={f.title} q={q} /></Veil></span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : g.map((f) => {
                                    const veiled = veilOf(f);
                                    return (
                                        <button key={f.id} type="button" className={`cx-row ${f.id === currentId && !creating ? "on" : ""}`} onClick={() => goEntity(f.id)}>
                                            <FichaIcon f={f} size="sm" />
                                            <span className="tx">
                                                <span className="t"><Veil on={veiled} text={f.title}><Highlight title={f.title} q={q} /></Veil></span>
                                                <span className="s">{veiled ? "" : f.summary || "Sin resumen"}</span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div></div>
                        </section>
                    );
                })}
            </div>
        </>
    ) : (
        <CyberTooltip title="Índice">
            <button type="button" className="rail-tab" aria-label="Abrir índice" onClick={() => setRailOpen(true)}>
                <ArchiveIcon name="chevR" />
            </button>
        </CyberTooltip>
    );

    const closeSurface = () => setSurface(null);

    const renderArticle = () => {
        if (creating || editing) {
            if (renderEditor) {
                return (
                    <div className="cx-host" style={{ height: "100%" }}>
                        {renderEditor({ surface, ficha: editing ? byId.get(surface.id) || null : null, close: closeSurface })}
                    </div>
                );
            }
            return (
                <CodexEditor
                    key={surface.key}
                    initial={creating ? { entity_type: surface.entityType || P } : byId.get(surface.id) || {}}
                    fichaId={creating ? null : surface.id}
                    fichas={fichas}
                    byId={byId}
                    onCommit={commitDraft}
                    onCreated={(id) => {
                        setSelId(id);
                        setSurface((s) => (s && s.key === surface.key ? { ...s, kind: "edit", id } : s));
                    }}
                    onClose={closeSurface}
                    onError={() => showToast("No se pudo guardar la ficha.")}
                />
            );
        }
        if (!current) {
            return (
                <div className="art-view">
                    {indexed.length ? (
                        <div className="cx-void is-slim">
                            <span className="kicker">Códice</span>
                            <p className="lead">{CODEX_COPY.pickOne}</p>
                        </div>
                    ) : (
                        <div className="cx-void">
                            <span className="kicker">Códice</span>
                            <h2>Sin fichas</h2>
                            <p className="lead">{emptyText}</p>
                            {canEdit && <button type="button" className="btn pri" onClick={startCreate}>Nueva ficha</button>}
                        </div>
                    )}
                </div>
            );
        }
        const f = current;
        const veiled = veilOf(f);
        const prevAt = back.findLastIndex((id) => id !== f.id && byId.has(id));
        const prev = prevAt >= 0 ? byId.get(back[prevAt]) : null;
        const ms = scanMentions(f.body, fichas, byId);
        const legacy = ms.filter((m) => m.st === "lg").length;
        const broken = ms.filter((m) => m.st === "br" && !(m.id && external?.(m.id))).length;
        const unl = findUnlinked(f.body, fichas, f.id).length;
        const backs = backlinksOf(f.id, fichas, byId);
        const issues = [
            unl && `${unl} nombre${unl > 1 ? "s" : ""} sin enlazar`,
            legacy && `${legacy} ${legacy > 1 ? "menciones antiguas" : "mención antigua"}`,
            broken && `${broken} rota${broken > 1 ? "s" : ""}`,
        ].filter(Boolean);
        const T = CODEX_TYPES[f.entity_type];
        const aside = renderHeaderAside?.(f, veiled);
        return (
            <div className="art-view">
                {canEdit && (
                    <div className="edit-tools">
                        <IconBtn tip="Eliminar" icon="trash" onClick={() => askDelete(f)} />
                        <IconBtn tip="Editar" icon="pencil" className="pencil" pressed={false} onClick={() => startEdit(f)} />
                    </div>
                )}
                {prev && (
                    <button
                        type="button"
                        className="link back"
                        onClick={() => {
                            setBack((b) => b.slice(0, prevAt));
                            goEntity(prev.id, { push: false });
                        }}
                    >
                        ← {prev.title}
                    </button>
                )}
                <header className="art-head">
                    {!aside && <span className={veiled ? "veil-img" : ""}><FichaIcon f={f} size="xl" /></span>}
                    <div className="grow">
                        <div className="kicker" style={{ color: T?.color || "#aaa" }}>{T?.label || f.entity_type}</div>
                        <h1><Veil on={veiled} text={f.title} /></h1>
                        {f.summary && (
                            <p className="summary">
                                {veiled
                                    ? <Veil on text={f.summary} />
                                    : <CodexInline text={f.summary} fichas={fichas} byId={byId} onGo={goEntity} keyBase="sum" />}
                            </p>
                        )}
                        {tagsOf && <div className="tags"><Tags list={tagsOf(f)} /></div>}
                    </div>
                    {aside && <div className={`art-aside cx-host ${veiled ? "veil-img" : ""}`}>{aside}</div>}
                </header>
                {issues.length > 0 && canEdit && (
                    <div className="notice">
                        {issues.join(" · ")}
                        <button type="button" className="link" onClick={() => startEdit(f)}>Revisar</button>
                    </div>
                )}
                {(() => {
                    const bodyNode = (
                        <div className="art-body">
                            {f.body && f.body !== f.summary
                                ? <CodexRich text={f.body} fichas={fichas} byId={byId} onGo={goEntity} />
                                : (
                                    <div className="cx-void">
                                        <span className="kicker">{f.body ? "Cuerpo" : "Sinopsis"}</span>
                                        <p className="lead">{f.body
                                            ? "El cuerpo repite el resumen."
                                            : "Esta ficha todavía no tiene texto. Aquí va la sinopsis."}</p>
                                        {canEdit && !f.body && (
                                            <button type="button" className="btn" onClick={() => startEdit(f)}>Escribir</button>
                                        )}
                                    </div>
                                )}
                        </div>
                    );
                    const mentionsNode = (
                        <>
                            <div className="sec-h">Mencionado en <span className="n">{backs.length}</span></div>
                            {backs.length ? backs.map((b) => (
                                <div key={b.src.id} className="back-item">
                                    <FichaIcon f={b.src} size="sm" />
                                    <div className="grow">
                                        <div className="t"><Veil on={veilOf(b.src)} text={b.src.title} /></div>
                                        <div className="q">{b.excerpt.pre}{b.excerpt.before}<em>{f.title}</em>{b.excerpt.after}{b.excerpt.post}</div>
                                    </div>
                                    <button type="button" className="link" onClick={() => goEntity(b.src.id, { flash: f.id })}>Ir al párrafo</button>
                                </div>
                            )) : <div className="empty-note">Nadie menciona a {f.title} todavía.</div>}
                        </>
                    );
                    const story = renderStory?.(f, { body: bodyNode, mentions: mentionsNode });
                    if (story) return story;
                    return (
                        <>
                            {bodyNode}
                            {renderArticleExtra && <div className="art-extra cx-host">{renderArticleExtra(f)}</div>}
                            {mentionsNode}
                        </>
                    );
                })()}
            </div>
        );
    };

    const renderRailBody = () => {
        if (creating || (editing && !byId.has(surface.id))) return <div className="empty-note">{CODEX_COPY.newInRail}</div>;
        if (!current) return null;
        return (
            <>
                <div className="rail-head">Dossier</div>
                {renderRail ? <div className="cx-host rail-host">{renderRail(current, { go: goEntity })}</div> : (
                    <>
                        <section className="ds-card">
                            <div className="ds-h">Hechos <span className="n">0 estructurales</span><span className="grow" /><HelpDot text={CODEX_COPY.factsHelp} /></div>
                            <div className="ds-b"><div className="empty-note">{CODEX_COPY.noFacts}</div></div>
                        </section>
                        <section className="ds-card sync">
                            <div className="ds-h sync">Relaciones <span className="n">0 sync</span><span className="grow" /><HelpDot text={CODEX_COPY.affinityHelp} /></div>
                            <div className="ds-b"><div className="empty-note">{CODEX_COPY.noAffinity}</div></div>
                        </section>
                    </>
                )}
                {onOpenLab && (labFor ? labFor(current) : current.entity_type === P) && (
                    <button type="button" className="btn lab wide" onClick={() => onOpenLab(current.id)}>Ver en Neural Lab →</button>
                )}
            </>
        );
    };

    if (loading) {
        return (
            <Box sx={{ ...ARCHIVE_CODEX_SX, display: "grid", placeItems: "center" }}>
                <span className="muted"><Box component="span" sx={ARCHIVE_SPIN_SX} />Cargando fichas…</span>
            </Box>
        );
    }
    if (error) {
        return (
            <Box sx={{ ...ARCHIVE_CODEX_SX, display: "grid", placeItems: "center" }}>
                <span className="empty-note" role="alert">{error}</span>
            </Box>
        );
    }

    const fullEditor = (creating || editing) && !!renderEditor;

    return (
        <CodexTextContext.Provider value={textCtx}>
            <Box sx={ARCHIVE_CODEX_SX} className={`codex ${railOpen ? "" : "is-shut"}${!indexed.length && !creating && !editing ? " is-empty" : ""}`}>
                <div className="cx-index">{indexHtml}</div>
                <div className="cx-article scroll" ref={articleRef}>
                    <div className={`art-inner ${fullEditor ? "edit-full" : creating || editing ? "edit-surface" : ""}`}>{renderArticle()}</div>
                </div>
                <aside className="cx-rail scroll">{renderRailBody()}</aside>
                {confirm && (
                    <div className="confirm-back" onClick={() => setConfirm(null)}>
                        <div className="confirm" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
                            <div className="confirm-h">Eliminar ficha</div>
                            <p>{confirm.text}</p>
                            <div className="acts">
                                <button type="button" className="btn" onClick={() => setConfirm(null)} autoFocus>Cancelar</button>
                                <button type="button" className="btn pri" onClick={() => { const run = confirm.run; setConfirm(null); run(); }}>Eliminar</button>
                            </div>
                        </div>
                    </div>
                )}
                <div className={`toast ${toast.on ? "on" : ""}`} role="status" aria-live="polite">{toast.msg}</div>
            </Box>
        </CodexTextContext.Provider>
    );
}
