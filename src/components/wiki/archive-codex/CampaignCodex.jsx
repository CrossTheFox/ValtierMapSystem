import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Box, Collapse } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ArchiveCodex from "./ArchiveCodex";
import WikiEntityEditor from "../WikiEntityEditor";
import WikiCustomFieldsView from "../WikiCustomFieldsView";
import WikiAiImpactBlocks from "../WikiAiImpactBlocks";
import ArchiveVttStrip from "../ArchiveVttStrip";
import { EntityPortrait } from "../WikiEntityDetail";
import DossierStructuralFacts from "../../characters/DossierStructuralFacts";
import DossierRelationTrack from "../../characters/DossierRelationTrack";
import { CyberTitle } from "../../customs/CustomTexts";
import { UI_COLORS } from "../../../constants/uiColors";
import { WIKI_ENTITY_TYPES } from "../../../constants/wikiEntityTypes";
import { CODEX_COPY, CODEX_ORDER } from "../../../constants/wiki/archiveCodex";
import { WIKI_RELATION_TYPE_LABELS } from "../../../constants/wikiRelationTypes";
import { dedupePersonajesByVttLink, linkedLocationIdsOf } from "../../../constants/wiki/archiveIdentity.js";
import { removeWikiEntity } from "../../../store/wikiSlice";
import { showSnackbar } from "../../../store/uiSlice";
import { resolveMentionClick } from "../../../utils/wikiNavigation";
import { isPlayerCharacter } from "../../../utils/characterRosterKind";
import {
    findVttCharacter,
    resolveWikiEntityImageCandidates,
    resolveWikiEntityImageSource,
} from "../../../utils/resolveWikiEntityImage";
import { getCachedUrl } from "../../../../firebase/services/assetLoader";
import { subscribeSessionLogs } from "../../../../firebase/services/sessionLogService";
import { scanMentions } from "../../../utils/archiveCodexText";
import { TYPO } from "../../../constants/designSystem";
import { useCampaignLoreFichas } from "../../../hooks/useCampaignLoreFichas";
import { mesaWikiTwin } from "../../../utils/labMesaTwin";
import { createLoreFicha, deleteLoreFicha, updateLoreFicha } from "../../../../firebase/services/loreFichaService";
import { slugify } from "../../../utils/wikiSlug";
import CodexEditor from "./CodexEditor";
import LorePersonalityPicker from "../LorePersonalityPicker";
import CodexStoryTabs from "./CodexStoryTabs";

const LAB_TYPES = new Set([WIKI_ENTITY_TYPES.PERSONAJE, WIKI_ENTITY_TYPES.LOCACION, WIKI_ENTITY_TYPES.ORGANIZACION]);

const VTT_TONE = UI_COLORS.anomaly;

function LoreGraphRail({ fichaId, relaciones, names, onOpen }) {
    const rows = (relaciones || []).filter((row) => row.from_ficha_id === fichaId || row.to_ficha_id === fichaId);
    if (!rows.length) {
        return (
            <Box sx={{ mt: 1.5, color: UI_COLORS.textSecondary, fontSize: "12px", fontFamily: TYPO.body }}>
                Sin relaciones en el Lore.
            </Box>
        );
    }
    return (
        <Box sx={{ mt: 1.5 }}>
            <CyberTitle variant="caption" sx={{ fontSize: "0.55rem", letterSpacing: 1.4, color: UI_COLORS.anomaly }}>
                RELACIONES
            </CyberTitle>
            <Box sx={{ display: "flex", flexDirection: "column", gap: "4px", mt: 0.75 }}>
                {rows.map((row) => {
                    const outgoing = row.from_ficha_id === fichaId;
                    const otherId = outgoing ? row.to_ficha_id : row.from_ficha_id;
                    const verb = WIKI_RELATION_TYPE_LABELS[row.relation_type] || row.relation_type;
                    return (
                        <Box
                            key={row.id}
                            component="button"
                            type="button"
                            onClick={() => onOpen?.(otherId)}
                            sx={{
                                display: "block",
                                width: "100%",
                                textAlign: "left",
                                color: "#ffffff",
                                background: "transparent",
                                border: `1px solid ${UI_COLORS.border}`,
                                borderRadius: "4px",
                                p: "6px 8px",
                                cursor: "pointer",
                                fontFamily: TYPO.body,
                            }}
                        >
                            <Box component="span" sx={{ display: "block", color: UI_COLORS.anomaly, fontSize: "11px" }}>
                                {outgoing ? "" : "← "}{verb}
                                {Number.isFinite(Number(row.strength)) ? ` · ${row.strength}` : ""}
                            </Box>
                            <Box component="span" sx={{ color: "#ffffff" }}>{names.get(otherId) || "Ficha"}</Box>
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
}

function toFicha(e, imageUrl) {
    return {
        id: e.id,
        entity_type: e.entityType,
        title: e.title || "",
        summary: e.summary || "",
        body: e.body || "",
        slug: e.slug || "",
        image_url: imageUrl,
        visibility: e.visibility,
        raw: e,
    };
}

function TechSheet({ entity, entities, vttCharacters, onEntityClick }) {
    const [open, setOpen] = useState(false);
    return (
        <Box sx={{ mt: 1.5 }}>
            <Box
                component="button"
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                sx={{
                    display: "flex", alignItems: "center", gap: 0.5, width: "100%", px: 0, py: 0.4,
                    bgcolor: "transparent", border: "none", cursor: "pointer", color: UI_COLORS.textSecondary,
                }}
            >
                <ExpandMoreIcon sx={{ fontSize: "1rem", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                <CyberTitle variant="caption" sx={{ fontSize: "0.55rem", letterSpacing: 1.4, color: UI_COLORS.anomaly }}>
                    FICHA TÉCNICA
                </CyberTitle>
            </Box>
            <Collapse in={open}>
                <WikiCustomFieldsView entity={entity} entities={entities} vttCharacters={vttCharacters} onEntityClick={onEntityClick} />
            </Collapse>
        </Box>
    );
}

function sessionTouches(session, fichaId, byId) {
    if (!fichaId) return false;
    if (session.arcId === fichaId) return true;
    if ((session.eventIds || []).includes(fichaId)) return true;
    if ((session.links || []).includes(fichaId)) return true;
    if ((session.acta || []).some((c) => c.id === fichaId)) return true;
    return scanMentions(session.recap || "", [], byId).some((m) => m.id === fichaId);
}

function DiaryTies({ fichaId, sessions, byId, onOpenDiary }) {
    const rows = sessions.filter((s) => sessionTouches(s, fichaId, byId));
    if (!rows.length) return null;
    return (
        <Box sx={{ mt: 2 }}>
            <Box component="span" className="kicker" sx={{ color: UI_COLORS.accent }}>En el diario</Box>
            <Box sx={{ display: "flex", flexDirection: "column", gap: "6px", mt: 1 }}>
                {rows.map((s) => (
                    <Box
                        key={s.id}
                        component="button"
                        type="button"
                        onClick={() => onOpenDiary?.(s.id)}
                        sx={{
                            display: "flex",
                            alignItems: "baseline",
                            gap: 1,
                            width: "100%",
                            textAlign: "left",
                            p: "8px 10px",
                            borderRadius: "4px",
                            border: `1px solid ${UI_COLORS.border}`,
                            background: "transparent",
                            color: "#ffffff",
                            cursor: "pointer",
                            fontFamily: TYPO.body,
                            "&:hover": { borderColor: UI_COLORS.accent },
                        }}
                    >
                        <Box component="span" sx={{ fontFamily: TYPO.mono, fontSize: "12px", color: UI_COLORS.anomaly, flex: "none" }}>
                            S{s.n || "·"}
                        </Box>
                        <Box component="span" sx={{ fontWeight: 600 }}>{s.title || "Sesión sin título"}</Box>
                        <Box component="span" sx={{ ml: "auto", color: UI_COLORS.textSecondary, fontSize: "12px", flex: "none" }}>
                            {s.sessionDate || ""}
                        </Box>
                    </Box>
                ))}
            </Box>
        </Box>
    );
}

/**
 * Mesa adapter of the Archive codex over `campaigns/{id}/wikiEntities`.
 * Selection and edit surface live in `ui.wikiOverlay` (deep links from Dossier / VTT keep working);
 * edit and create reuse `WikiEntityEditor` because it owns visibility, per-type fields, image and pins.
 */
export default function CampaignCodex({
    campaignId,
    readOnly,
    previewPlayer,
    editorKey,
    prefillData,
    onCreate,
    onSelect,
    onSurface,
    onSaved,
    onNavigateEntity,
    onOpenVttLocation,
    onOpenLab,
    onOpenDiary,
}) {
    const dispatch = useDispatch();
    const entities = useSelector((s) => s.wiki.entities);
    const wikiStatus = useSelector((s) => s.wiki.status);
    const wikiError = useSelector((s) => s.wiki.error);
    const locations = useSelector((s) => s.world.locations);
    const charactersById = useSelector((s) => s.world.charactersById);
    const { mode, entityId } = useSelector((s) => s.ui.wikiOverlay);
    const [sessions, setSessions] = useState([]);
    const lore = useCampaignLoreFichas(campaignId, Boolean(campaignId));

    useEffect(() => {
        if (!campaignId) return undefined;
        return subscribeSessionLogs(campaignId, setSessions);
    }, [campaignId]);

    const loreTwinByEntity = useMemo(() => {
        const map = new Map();
        if (!lore.fichas.length) return map;
        const characters = Object.values(charactersById || {}).filter((c) => !campaignId || c?.campaignId === campaignId);
        for (const row of lore.fichas) {
            const twin = mesaWikiTwin(
                { id: row.id, entityType: row.entity_type, title: row.title, mesaSource: row.mesa_source },
                { wikiEntities: entities, characters, locations },
            );
            if (twin && !map.has(twin.id)) map.set(twin.id, row);
        }
        return map;
    }, [lore.fichas, entities, charactersById, campaignId, locations]);

    const byId = useMemo(() => new Map(entities.map((e) => [e.id, e])), [entities]);
    const twinLoreIds = useMemo(
        () => new Set([...loreTwinByEntity.values()].map((row) => row.id)),
        [loreTwinByEntity],
    );
    const fichas = useMemo(() => {
        const wiki = entities.map((e) => {
            const path = resolveWikiEntityImageCandidates(e, locations, charactersById)
                .find((p) => p.startsWith("http") || getCachedUrl(p));
            return toFicha(e, path ? (path.startsWith("http") ? path : getCachedUrl(path)) : null);
        });
        const extra = lore.fichas
            .filter((row) => row?.id && !twinLoreIds.has(row.id) && !byId.has(row.id))
            .map((row) => toFicha({
                id: row.id,
                entityType: row.entity_type,
                title: row.title || "",
                summary: row.summary || "",
                body: row.body || "",
                slug: row.slug || "",
                visibility: "players",
                loreOnly: true,
            }, row.image_url || null));
        return [...wiki, ...extra];
    }, [entities, locations, charactersById, lore.fichas, twinLoreIds, byId]);
    const listedIds = useMemo(
        () => new Set(dedupePersonajesByVttLink(entities, charactersById).map((e) => e.id)),
        [entities, charactersById],
    );
    const indexFilter = useCallback((f) => {
        if (f.raw?.loreOnly) return true;
        if (f.entity_type === WIKI_ENTITY_TYPES.PERSONAJE) return listedIds.has(f.id);
        return true;
    }, [listedIds]);
    const loreNames = useMemo(() => {
        const names = new Map(entities.map((row) => [row.id, row.title || "Ficha"]));
        lore.fichas.forEach((row) => names.set(row.id, row.title || "Ficha"));
        loreTwinByEntity.forEach((row, wikiId) => names.set(wikiId, entities.find((e) => e.id === wikiId)?.title || row.title || "Ficha"));
        return names;
    }, [entities, lore.fichas, loreTwinByEntity]);

    const vttCharacters = useMemo(() => {
        const list = [];
        Object.values(locations || {}).forEach((loc) =>
            (loc.characters || []).forEach((c) => list.push({ id: c.id, name: c.name, age: c.age })));
        return list;
    }, [locations]);

    const openVttCharacter = useCallback((characterId) => {
        const locId = Object.values(locations || {}).find((loc) => loc.characters?.some((c) => c.id === characterId))?.id;
        if (locId) onOpenVttLocation(locId, 1);
    }, [locations, onOpenVttLocation]);

    const surface = useMemo(() => {
        if (readOnly) return null;
        if (mode === "create") return { kind: "create", key: editorKey };
        if (mode === "edit" && entityId) return { kind: "edit", id: entityId, key: editorKey };
        return null;
    }, [readOnly, mode, entityId, editorKey]);

    const handleSurfaceChange = useCallback((next) => {
        if (next?.kind === "create") onCreate();
        else onSurface(next);
    }, [onCreate, onSurface]);

    const handleSelected = useCallback((id) => {
        if (!id) {
            onSelect(null);
            return;
        }
        const ent = byId.get(id);
        const inLore = lore.fichas.some((row) => row.id === id);
        if (ent && !CODEX_ORDER.includes(ent.entityType) && !inLore) {
            onNavigateEntity(id);
            return;
        }
        if (ent || inLore) onSelect(id);
    }, [byId, lore.fichas, onSelect, onNavigateEntity]);

    const handleDelete = useCallback(async (id) => {
        const loreOnly = !byId.has(id) && lore.fichas.some((row) => row.id === id);
        if (loreOnly && lore.loreId) {
            await deleteLoreFicha(lore.loreId, id);
            dispatch(showSnackbar({ message: "Ficha eliminada.", severity: "success" }));
            return;
        }
        await dispatch(removeWikiEntity({ campaignId, entityId: id })).unwrap();
        dispatch(showSnackbar({ message: "Ficha eliminada.", severity: "success" }));
    }, [dispatch, campaignId, byId, lore.fichas, lore.loreId]);

    const deleteBlock = useCallback((f) => {
        const e = f.raw;
        if (e.entityType === WIKI_ENTITY_TYPES.PERSONAJE && e.linkedVttCharacterId
            && findVttCharacter(locations, e.linkedVttCharacterId, charactersById)) {
            return CODEX_COPY.deleteBlockedVtt(f.title);
        }
        if (linkedLocationIdsOf(e).some((id) => locations?.[id])) return CODEX_COPY.deleteBlockedPin(f.title);
        return null;
    }, [locations, charactersById]);

    const isVeiled = useCallback((f) => previewPlayer && f.visibility === "dm_only", [previewPlayer]);

    const tagsOf = useCallback((f) => {
        const e = f.raw;
        const out = [];
        if (isVeiled(f)) return out;
        if (e.entityType === WIKI_ENTITY_TYPES.PERSONAJE && e.linkedVttCharacterId) {
            const ch = findVttCharacter(locations, e.linkedVttCharacterId, charactersById);
            if (ch) out.push(isPlayerCharacter(ch) ? { id: "pj", label: "PJ" } : { id: "npc", label: "NPC" });
            out.push({ id: "vtt", label: "VTT" });
        }
        if (linkedLocationIdsOf(e).length) out.push({ id: "pin", label: "PIN" });
        if (!previewPlayer && e.visibility === "dm_only") out.push({ id: "dm", label: "DM" });
        return out;
    }, [locations, charactersById, previewPlayer, isVeiled]);

    const external = useCallback((id) => {
        const hit = resolveMentionClick(id, { entities, locations });
        if (!hit) return null;
        if (hit.type === "wiki") {
            return {
                label: hit.entity.title,
                color: UI_COLORS.accent,
                title: hit.entity.title,
                onGo: () => handleSelected(hit.entityId),
            };
        }
        const label = hit.type === "vtt-character"
            ? (vttCharacters.find((c) => c.id === hit.characterId)?.name || "Personaje VTT")
            : (locations?.[hit.locationId]?.name || "Locación VTT");
        return {
            label,
            color: VTT_TONE,
            title: "Abrir en la mesa",
            onGo: () => onOpenVttLocation(hit.locationId, hit.type === "vtt-character" ? 1 : 0),
        };
    }, [entities, locations, vttCharacters, onOpenVttLocation, handleSelected]);

    const renderEditor = useCallback(({ surface: s, close }) => {
        if (s.kind === "create" && lore.loreId) {
            const loreById = new Map(lore.fichas.map((row) => [row.id, row]));
            return (
                <CodexEditor
                    key={s.key}
                    fichas={lore.fichas}
                    byId={loreById}
                    initial={{ entity_type: "personaje", title: "", summary: "", body: "" }}
                    onClose={close}
                    onCreated={(id) => onSelect(id)}
                    onCommit={async (id, snapshot) => {
                        const data = { ...snapshot, slug: snapshot.slug || slugify(snapshot.title || "ficha") };
                        if (id) {
                            await updateLoreFicha(lore.loreId, id, data);
                            return id;
                        }
                        return createLoreFicha(lore.loreId, data);
                    }}
                />
            );
        }
        const loreRow = s.kind === "edit" ? lore.fichas.find((row) => row.id === s.id) : null;
        if (loreRow && !byId.has(s.id) && lore.loreId) {
            const loreById = new Map(lore.fichas.map((row) => [row.id, row]));
            return (
                <CodexEditor
                    key={s.key}
                    fichaId={loreRow.id}
                    initial={loreRow}
                    fichas={lore.fichas}
                    byId={loreById}
                    onClose={close}
                    onCommit={async (id, snapshot) => {
                        await updateLoreFicha(lore.loreId, id, snapshot);
                        return id;
                    }}
                />
            );
        }
        const editing = s.kind === "edit" ? byId.get(s.id) || null : null;
        return (
            <WikiEntityEditor
                key={s.key}
                entity={editing}
                campaignId={campaignId}
                prefillData={editing ? undefined : prefillData}
                onSaved={onSaved}
                onCancel={close}
            />
        );
    }, [byId, campaignId, prefillData, onSaved, onSelect, lore.fichas, lore.loreId]);

    const renderHeaderAside = useCallback((f) => {
        const e = f.raw;
        const paths = resolveWikiEntityImageCandidates(e, locations, charactersById);
        if (!paths.length) return null;
        return (
            <EntityPortrait
                imagePaths={paths}
                imageSource={resolveWikiEntityImageSource(e, locations, charactersById)}
                title={e.title}
                width={96}
                compact
            />
        );
    }, [locations, charactersById]);

    const livedExtras = useCallback((f) => {
        if (isVeiled(f)) return null;
        const e = byId.get(f.id) || f.raw;
        const vtt = e.entityType === WIKI_ENTITY_TYPES.PERSONAJE || e.entityType === WIKI_ENTITY_TYPES.LOCACION;
        return (
            <>
                {vtt && !f.raw?.loreOnly && (
                    <ArchiveVttStrip
                        entity={e}
                        locations={locations}
                        compact
                        readOnly={readOnly}
                        onOpenVttLocation={(id) => onOpenVttLocation(id, 0)}
                        onOpenVttCharacter={openVttCharacter}
                    />
                )}
                {!f.raw?.loreOnly && (
                    <TechSheet entity={e} entities={entities} vttCharacters={vttCharacters} onEntityClick={onNavigateEntity} />
                )}
                <DiaryTies fichaId={f.id} sessions={sessions} byId={byId} onOpenDiary={onOpenDiary} />
            </>
        );
    }, [byId, locations, entities, vttCharacters, isVeiled, onOpenVttLocation, openVttCharacter, onNavigateEntity, sessions, onOpenDiary, readOnly]);

    const renderStory = useCallback((f, slots) => {
        if (!LAB_TYPES.has(f.entity_type) || isVeiled(f)) return null;
        const e = byId.get(f.id) || f.raw;
        const twin = lore.loreId ? loreTwinByEntity.get(e.id) : null;
        return (
            <CodexStoryTabs
                fichaId={f.id}
                personality={twin ? (
                    <LorePersonalityPicker
                        row={twin}
                        entityType={twin.entity_type}
                        readOnly={readOnly}
                        defaultOpen={!readOnly}
                        onPatch={(patch) => updateLoreFicha(lore.loreId, twin.id, patch).catch((err) => console.warn("[Codex] no se guardó la personalidad", err))}
                    />
                ) : null}
            >
                {slots.body}
                {!f.raw?.loreOnly && <WikiAiImpactBlocks entity={e} canManage={!readOnly} layout="continuation" />}
                {livedExtras(f)}
                {slots.mentions}
            </CodexStoryTabs>
        );
    }, [byId, isVeiled, lore.loreId, loreTwinByEntity, readOnly, livedExtras]);

    const renderArticleExtra = useCallback((f) => {
        if (LAB_TYPES.has(f.entity_type)) return null;
        return (
            <>
                {livedExtras(f)}
                {!isVeiled(f) && !f.raw?.loreOnly && <WikiAiImpactBlocks entity={byId.get(f.id) || f.raw} canManage={!readOnly} compact />}
            </>
        );
    }, [livedExtras, isVeiled, byId, readOnly]);

    const renderRail = useCallback((f) => {
        const loreFichaId = loreTwinByEntity.get(f.id)?.id || (f.raw?.loreOnly ? f.id : "");
        if (loreFichaId) {
            return (
                <LoreGraphRail
                    fichaId={loreFichaId}
                    relaciones={lore.relaciones || []}
                    names={loreNames}
                    onOpen={handleSelected}
                />
            );
        }
        return (
            <>
                <DossierStructuralFacts entityId={f.id} campaignId={campaignId} canEdit={!readOnly} variant="fichaStrip" />
                <DossierRelationTrack entityId={f.id} campaignId={campaignId} canEdit={!readOnly} />
            </>
        );
    }, [campaignId, readOnly, loreTwinByEntity, lore.relaciones, loreNames, handleSelected]);

    const labFor = useCallback((f) => (
        f.entity_type === WIKI_ENTITY_TYPES.PERSONAJE
        || f.entity_type === WIKI_ENTITY_TYPES.LOCACION
        || f.entity_type === WIKI_ENTITY_TYPES.ORGANIZACION
    ), []);

    return (
        <ArchiveCodex
            fichas={fichas}
            loading={wikiStatus === "loading" && !entities.length}
            error={wikiStatus === "failed" ? wikiError || "No se pudo cargar el archivo." : ""}
            canEdit={!readOnly}
            emptyText={readOnly ? "Todavía no hay fichas visibles." : "Todavía no hay fichas."}
            onDelete={handleDelete}
            deleteBlock={deleteBlock}
            onOpenLab={readOnly ? undefined : onOpenLab}
            labFor={labFor}
            indexTypes={CODEX_ORDER}
            indexFilter={indexFilter}
            selectedId={entityId || ""}
            onSelectedChange={handleSelected}
            surface={surface}
            onSurfaceChange={handleSurfaceChange}
            renderEditor={renderEditor}
            renderRail={renderRail}
            renderHeaderAside={renderHeaderAside}
            renderArticleExtra={renderArticleExtra}
            renderStory={renderStory}
            tagsOf={tagsOf}
            isVeiled={isVeiled}
            external={external}
        />
    );
}
