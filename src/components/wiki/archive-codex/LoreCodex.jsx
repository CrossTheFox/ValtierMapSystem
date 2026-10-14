import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ArchiveCodex from "./ArchiveCodex";
import {
    createLoreFicha,
    deleteLoreFicha,
    subscribeLoreFichas,
    updateLoreFicha,
    writeLoreFichaAt,
} from "../../../../firebase/services/loreFichaService";
import { subscribeLore, updateLore } from "../../../../firebase/services/loreService";
import {
    deleteLoreTimelineItem,
    subscribeLoreArcos,
    subscribeLoreEras,
    updateLoreTimelineItem,
} from "../../../../firebase/services/loreTimelineService";
import { deleteLoreRelation, subscribeLoreRelaciones } from "../../../../firebase/services/loreRelationService";
import { CODEX_TYPES } from "../../../constants/wiki/archiveCodex";
import { WIKI_RELATION_TYPE_LABELS, isAffinityRelation } from "../../../constants/wikiRelationTypes";
import { withRemovedAiImpactBlock, withUpdatedAiImpactBlock } from "../../../utils/aiImpactBlocks";
import LorePersonalityPicker from "../LorePersonalityPicker";
import SyncMeterReadout from "../SyncMeterReadout";
import AiImpactBlockList from "../AiImpactBlockList";
import CodexStoryTabs from "./CodexStoryTabs";
import {
    dropNodeLinks,
    idList,
    indexFacts,
    linkToRow,
    neutroToRow,
    normalizeLinks,
    normalizeNeutro,
    normalizePaints,
    paintsToRows,
    rollupIndex,
} from "../../../utils/archiveTimeline";
import { indexPatchesAfterDrop } from "../../../utils/loreIndexRelations";

const NODE_TYPES = new Set(["neutro", "era", "arco", "evento_historico"]);
const LAB_TYPES = new Set(["personaje", "locacion", "organizacion"]);

function StoryImpacts({ ficha, onUpdate }) {
    const [saving, setSaving] = useState(false);
    const blocks = Array.isArray(ficha.ai_impact_blocks) ? ficha.ai_impact_blocks : [];
    const writeBlocks = async (next) => {
        setSaving(true);
        try {
            await onUpdate(ficha.id, { ai_impact_blocks: next });
        } finally {
            setSaving(false);
        }
    };
    return (
        <AiImpactBlockList
            blocks={blocks}
            viewerIsDm
            canManage
            saving={saving}
            layout="continuation"
            onSaveBody={(blockId, body) => writeBlocks(withUpdatedAiImpactBlock({ aiImpactBlocks: blocks }, blockId, body).aiImpactBlocks)}
            onDelete={(blockId) => writeBlocks(withRemovedAiImpactBlock({ aiImpactBlocks: blocks }, blockId).aiImpactBlocks)}
        />
    );
}

function RelationsRail({ ficha, fichas, relaciones, onOpen, onDrop }) {
    const rows = (relaciones || []).filter((r) => r.from_ficha_id === ficha.id || r.to_ficha_id === ficha.id);
    const marked = rows.filter((r) => r.neural_lab).length;
    return (
        <section className="ds-card sync">
            <div className="ds-h sync">
                Relaciones <span className="n">{rows.length}{marked ? ` · ${marked} Neural Lab` : ""}</span>
            </div>
            <div className="ds-b">
                {rows.length ? rows.map((r) => {
                    const outgoing = r.from_ficha_id === ficha.id;
                    const other = fichas.find((f) => f.id === (outgoing ? r.to_ficha_id : r.from_ficha_id));
                    const color = CODEX_TYPES[other?.entity_type]?.color || "#ffffff";
                    const affinity = isAffinityRelation({
                        relationType: r.relation_type,
                        fromEntityType: outgoing ? ficha.entity_type : other?.entity_type,
                        toEntityType: outgoing ? other?.entity_type : ficha.entity_type,
                    });
                    const n = Math.round(Number(r.strength) || 0);
                    const stamp = r.neural_lab;
                    return (
                        <div key={r.id} className="rel-row">
                            <button
                                type="button"
                                className="ix-fact"
                                style={{ "--c": color }}
                                onClick={() => other && onOpen?.(other.id)}
                                title={stamp ? `Neural Lab · «${stamp.event_title || "evento"}»${stamp.before != null ? ` · ${stamp.before} → ${stamp.after}` : ""}` : undefined}
                            >
                                <span className="verb">
                                    {outgoing ? "" : "← "}{WIKI_RELATION_TYPE_LABELS[r.relation_type] || r.relation_type}
                                    {stamp ? " · Neural Lab" : ""}
                                    {!affinity ? " · estructural" : ""}
                                </span>
                                <span className="who">{other?.title || "Ficha"}</span>
                            </button>
                            {affinity && (
                                <div className="cx-host rel-meter">
                                    <SyncMeterReadout strength={n} />
                                </div>
                            )}
                            {onDrop && (
                                <button
                                    type="button"
                                    aria-label={`Quitar ${WIKI_RELATION_TYPE_LABELS[r.relation_type] || r.relation_type} ${other?.title || ""}`}
                                    onClick={() => {
                                        const verb = WIKI_RELATION_TYPE_LABELS[r.relation_type] || r.relation_type;
                                        const who = other?.title || "esa ficha";
                                        if (window.confirm(`¿Quitar «${verb}» con ${who}?`)) onDrop(r);
                                    }}
                                    style={{
                                        flex: "none",
                                        color: "#ffffff",
                                        background: "transparent",
                                        border: "1px solid rgba(255,255,255,.28)",
                                        borderRadius: 3,
                                        cursor: "pointer",
                                        fontSize: 11,
                                        padding: "2px 6px",
                                    }}
                                >
                                    Quitar
                                </button>
                            )}
                        </div>
                    );
                }) : <div className="empty-note">Sin relaciones. Se crean en el Neural Lab.</div>}
            </div>
        </section>
    );
}

function besideSun() {
    const n = Date.now() % 5;
    return { layout_x: 772 + n * 36, layout_y: 528 + (n - 2) * 48 };
}

function asFicha(row, entityType, store) {
    return {
        id: row.id,
        entity_type: entityType,
        title: row.title || "Sin título",
        summary: row.summary || "",
        body: row.body || "",
        slug: row.slug || "",
        index_personajes: idList(row.index_personajes ?? row.people),
        index_lugares: idList(row.index_lugares ?? row.places),
        start_year: row.start_year ?? null,
        end_year: row.end_year ?? null,
        start: row.start || "",
        end: row.end || "",
        color: row.color || "",
        era_ids: row.era_ids || [],
        layout_x: row.layout_x ?? row.layoutX ?? null,
        layout_y: row.layout_y ?? row.layoutY ?? null,
        _store: store,
    };
}

function IndexRail({ ficha, fichas, links, onOpen }) {
    const facts = indexFacts(ficha, fichas, links);
    return (
        <section className="ds-card">
            <div className="ds-h">Hechos <span className="n">{facts.length} {facts.length === 1 ? "indexado" : "indexados"}</span></div>
            <div className="ds-b">
                {facts.length ? facts.map((fact) => {
                    const color = CODEX_TYPES[fact.type]?.color || "#ffffff";
                    return (
                        <button
                            type="button"
                            key={`${fact.verb}-${fact.id}-${fact.inherited ? "h" : "o"}`}
                            className="ix-fact"
                            style={{ "--c": color }}
                            onClick={() => onOpen?.(fact.id)}
                        >
                            <span className="verb">{fact.verb}{fact.inherited ? " · heredado" : ""}</span>
                            <span className="who">{fact.title}</span>
                        </button>
                    );
                }) : <div className="empty-note">Sin indexados. En el Timeline, el nodo elige personajes y lugares.</div>}
            </div>
        </section>
    );
}

function Indexed({ ficha, fichas, links }) {
    if (!NODE_TYPES.has(ficha.entity_type)) return null;
    const ownOf = (id) => {
        const row = fichas.find((f) => f.id === id);
        return { people: idList(row?.index_personajes), places: idList(row?.index_lugares) };
    };
    const roll = rollupIndex(ficha.id, links, ownOf);
    const name = (id) => fichas.find((f) => f.id === id)?.title || "Sin título";
    const chips = [];
    const push = (ids, cls) => ids.forEach((id, i) => chips.push({ key: `${cls}-${id}-${i}`, cls, title: name(id) }));
    push(idList(ficha.index_personajes), "");
    push(roll.inheritedPeople, "is-inherited");
    push(idList(ficha.index_lugares), "is-place");
    push(roll.inheritedPlaces, "is-place is-inherited");
    if (!chips.length) return null;
    return (
        <div className="ix-read">
            <div className="fl-l">Indexado</div>
            <div className="ix-list">
                {chips.map((c) => <span key={c.key} className={`ix-chip ${c.cls}`.trim()}>{c.title}</span>)}
            </div>
        </div>
    );
}

/**
 * Codex over `lores/{loreId}/fichas`. Neutro, era, arco and acontecimiento are the same row the solar draws.
 * Legacy eras, arcos and neutros still show until they are edited into a ficha.
 */
export default function LoreCodex({ loreId, onOpenLab, createRequest = null }) {
    const [state, setState] = useState({
        status: "loading", fichas: [], eras: [], arcos: [], relaciones: [], lore: null, error: "",
    });
    const stateRef = useRef(state);
    useEffect(() => { stateRef.current = state; });

    useEffect(() => {
        const fail = (err) => {
            console.error("LoreCodex:", err);
            setState((s) => ({ ...s, status: "error", error: "No se pudieron cargar las fichas de este Lore." }));
        };
        const unsubs = [
            subscribeLore(loreId, (lore) => setState((s) => ({ ...s, status: "ready", lore, error: "" })), fail),
            subscribeLoreEras(loreId, (eras) => setState((s) => ({ ...s, eras })), fail),
            subscribeLoreArcos(loreId, (arcos) => setState((s) => ({ ...s, arcos })), fail),
            subscribeLoreFichas(loreId, (fichas) => setState((s) => ({ ...s, status: "ready", fichas, error: "" })), fail),
            subscribeLoreRelaciones(loreId, (relaciones) => setState((s) => ({ ...s, relaciones })), (err) => console.warn("LoreCodex relaciones:", err)),
        ];
        return () => unsubs.forEach((unsub) => unsub());
    }, [loreId]);

    const fichas = useMemo(() => {
        const live = (state.fichas || []).map((f) => ({ ...f, _store: "ficha" }));
        const ids = new Set(live.map((f) => f.id));
        const extra = [];
        for (const row of state.eras || []) {
            if (!ids.has(row.id)) extra.push(asFicha(row, "era", "era"));
        }
        for (const row of state.arcos || []) {
            if (!ids.has(row.id)) extra.push(asFicha(row, "arco", "arco"));
        }
        for (const row of (Array.isArray(state.lore?.neutros) ? state.lore.neutros : []).map(normalizeNeutro).filter(Boolean)) {
            if (!ids.has(row.id)) extra.push(asFicha(row, "neutro", "neutro"));
        }
        return [...live, ...extra];
    }, [state.fichas, state.eras, state.arcos, state.lore]);
    const links = useMemo(() => normalizeLinks(state.lore?.enlaces), [state.lore]);

    const onCreate = useCallback((data) => {
        const place = NODE_TYPES.has(data.entity_type) && data.layout_x == null ? besideSun() : {};
        return createLoreFicha(loreId, { ...data, ...place });
    }, [loreId]);

    const onUpdate = useCallback(async (id, patch) => {
        const row = fichas.find((f) => f.id === id);
        const store = row?._store || "ficha";
        const same = store === "ficha" || store === patch.entity_type || (store === "neutro" && patch.entity_type === "neutro");
        if (store === "ficha") {
            await updateLoreFicha(loreId, id, patch);
            return;
        }
        if (same && store === "era") {
            await updateLoreTimelineItem(loreId, "eras", id, {
                title: patch.title,
                summary: patch.summary ?? "",
                body: patch.body ?? "",
                start_year: patch.start_year ?? null,
                end_year: patch.end_year ?? null,
                index_personajes: idList(patch.index_personajes),
                index_lugares: idList(patch.index_lugares),
            });
            return;
        }
        if (same && store === "arco") {
            await updateLoreTimelineItem(loreId, "arcos", id, {
                title: patch.title,
                summary: patch.summary ?? "",
                body: patch.body ?? "",
                start: patch.start || null,
                end: patch.end || null,
                index_personajes: idList(patch.index_personajes),
                index_lugares: idList(patch.index_lugares),
            });
            return;
        }
        if (same && store === "neutro") {
            const rows = (Array.isArray(stateRef.current.lore?.neutros) ? stateRef.current.lore.neutros : [])
                .map(normalizeNeutro)
                .filter(Boolean)
                .map((n) => (n.id === id ? {
                    ...n,
                    title: patch.title,
                    summary: patch.summary ?? "",
                    body: patch.body ?? "",
                    people: idList(patch.index_personajes),
                    places: idList(patch.index_lugares),
                } : n));
            await updateLore(loreId, { neutros: rows.map(neutroToRow) });
            return;
        }
        await writeLoreFichaAt(loreId, id, {
            ...patch,
            layout_x: row?.layout_x ?? null,
            layout_y: row?.layout_y ?? null,
            ...(row?.color ? { color: row.color } : {}),
            ...(row?.era_ids ? { era_ids: row.era_ids } : {}),
        });
        if (store === "era") await deleteLoreTimelineItem(loreId, "eras", id);
        else if (store === "arco") await deleteLoreTimelineItem(loreId, "arcos", id);
        else if (store === "neutro") {
            const rows = (Array.isArray(stateRef.current.lore?.neutros) ? stateRef.current.lore.neutros : [])
                .map(normalizeNeutro)
                .filter((n) => n && n.id !== id);
            await updateLore(loreId, { neutros: rows.map(neutroToRow) });
        }
    }, [fichas, loreId]);

    const onDelete = useCallback(async (id) => {
        const row = fichas.find((f) => f.id === id);
        const store = row?._store || "ficha";
        if (store === "ficha") await deleteLoreFicha(loreId, id);
        else if (store === "era") await deleteLoreTimelineItem(loreId, "eras", id);
        else if (store === "arco") await deleteLoreTimelineItem(loreId, "arcos", id);
        else if (store === "neutro") {
            const rows = (Array.isArray(stateRef.current.lore?.neutros) ? stateRef.current.lore.neutros : [])
                .map(normalizeNeutro)
                .filter((n) => n && n.id !== id);
            await updateLore(loreId, { neutros: rows.map(neutroToRow) });
        }
        const lore = stateRef.current.lore || {};
        const paints = normalizePaints(lore.pinturas);
        const hadPaint = !!paints[id];
        if (hadPaint) delete paints[id];
        const links = dropNodeLinks(normalizeLinks(lore.enlaces), id);
        await updateLore(loreId, {
            enlaces: links.map(linkToRow),
            ...(hadPaint ? { pinturas: paintsToRows(paints) } : {}),
        });
    }, [fichas, loreId]);

    const renderStory = useCallback((f, slots) => {
        if (!(LAB_TYPES.has(f.entity_type) && f._store === "ficha")) return null;
        return (
            <CodexStoryTabs
                fichaId={f.id}
                personality={(
                    <LorePersonalityPicker
                        row={f}
                        entityType={f.entity_type}
                        defaultOpen
                        onPatch={(patch) => onUpdate(f.id, patch).catch((err) => console.warn("[Codex] no se guardó la personalidad", err))}
                    />
                )}
            >
                {slots.body}
                <StoryImpacts ficha={f} onUpdate={onUpdate} />
                {slots.mentions}
            </CodexStoryTabs>
        );
    }, [onUpdate]);
    const renderArticleExtra = useCallback((f) => (LAB_TYPES.has(f.entity_type) && f._store === "ficha"
        ? null
        : <Indexed ficha={f} fichas={fichas} links={links} />
    ), [fichas, links]);
    const dropRelation = useCallback(async (relation) => {
        await deleteLoreRelation(loreId, relation.id);
        const patches = indexPatchesAfterDrop(fichas, relation);
        await Promise.all(patches.map(({ id, patch }) => onUpdate(id, patch)));
    }, [loreId, fichas, onUpdate]);

    const renderRail = useCallback((f, api) => (
        <>
            <IndexRail ficha={f} fichas={fichas} links={links} onOpen={api?.go} />
            {LAB_TYPES.has(f.entity_type) && (
                <RelationsRail ficha={f} fichas={fichas} relaciones={state.relaciones} onOpen={api?.go} onDrop={dropRelation} />
            )}
        </>
    ), [fichas, links, state.relaciones, dropRelation]);

    return (
        <ArchiveCodex
            fichas={fichas}
            loading={state.status === "loading"}
            error={state.error}
            canEdit
            emptyText="Este Lore todavía no tiene fichas."
            onCreate={onCreate}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onOpenLab={onOpenLab}
            labFor={(f) => f.entity_type === "personaje" || f.entity_type === "locacion" || f.entity_type === "organizacion"}
            createRequest={createRequest}
            renderArticleExtra={renderArticleExtra}
            renderStory={renderStory}
            renderRail={renderRail}
        />
    );
}
