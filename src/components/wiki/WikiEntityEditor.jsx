import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
    Box,
    TextField,
    FormHelperText,
    Chip,
    Divider,
    ToggleButton,
    ToggleButtonGroup,
    Grid,
} from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PeopleIcon from "@mui/icons-material/People";
import { useDispatch, useSelector } from "react-redux";
import { CyberTitle, CyberText } from "../customs/CustomTexts";
import { UI_COLORS, primaryButtonSx, secondaryButtonSx, ACTION_LABELS } from "../../constants/designSystem";
import {
    wikiEditorInputSx,
    wikiEditorScrollbarSx,
    wikiEditorIdentityCardSx,
    wikiEditorOptionalSectionSx,
} from "../../constants/wikiEditorStyles";
import {
    resolveWikiEntityImagePath,
    resolveWikiEntityImageSource,
} from "../../utils/resolveWikiEntityImage";
import { WIKI_ENTITY_TYPES, WIKI_ENTITY_TYPE_OPTIONS, WIKI_ENTITY_TYPE_LABELS } from "../../constants/wikiEntityTypes";
import {
    TIMELINE_BRANCH,
    buildTimelineCustomFields,
    getTimelineMeta,
} from "../../utils/wikiTimeline";
import {
    EVENT_KIND_OPTIONS,
    EVENT_CERTAINTY_OPTIONS,
} from "../../constants/wiki/entityFieldSchemas";
import {
    getEntityMeta,
    mergeCustomFields,
    hasCustomFieldPanel,
    getOrgMembers,
    getPersonajeMemberships,
} from "../../utils/wikiCustomFields";
import WikiMentionInput from "./WikiMentionInput";
import WikiVttLinkPicker from "./WikiVttLinkPicker";
import WikiDateInput from "./WikiDateInput";
import WikiSearchableSelect, { enumToSearchOptions } from "./WikiSearchableSelect";
import WikiCustomFieldsPanel from "./WikiCustomFieldsPanel";
import WikiCreationOrderHint from "./WikiCreationOrderHint";
import WikiImageUpload from "./WikiImageUpload";
import WikiAiImpactBlocks from "./WikiAiImpactBlocks";
import { saveWikiEntity, fetchWikiEntities } from "../../store/wikiSlice";
import { slugify } from "../../utils/wikiSlug";
import { buildMentionCandidates } from "../../utils/wikiNavigation";
import {
    reconcileOrgMembers,
    reconcilePersonajeMemberships,
} from "../../../firebase/services/membershipService";
import { linkWikiLocacionToVtt, linkWikiPersonajeToVtt } from "../../../firebase/services/wikiVttLinkService";
import {
    uploadWikiEntityImage,
    uploadWikiInlineImage,
    deleteWikiImage,
    deleteWikiImages,
} from "../../../firebase/services/wikiStorageService";
import {
    urlToWikiStoragePath,
    collectReferencedWikiPaths,
} from "../../utils/wikiPendingUploads";

const inputSx = wikiEditorInputSx;
const scrollbarSx = wikiEditorScrollbarSx;

const TIMELINE_BRANCH_OPTIONS = [
    { value: TIMELINE_BRANCH.LEFT, label: "Izquierda (paralelo)" },
    { value: TIMELINE_BRANCH.CENTER, label: "Centro" },
    { value: TIMELINE_BRANCH.RIGHT, label: "Derecha (paralelo)" },
];

/** Label contextual para el campo de imagen según tipo de entidad. */
const IMAGE_LABEL_BY_TYPE = {
    [WIKI_ENTITY_TYPES.PERSONAJE]: "Retrato / avatar del personaje",
    [WIKI_ENTITY_TYPES.LOCACION]: "Imagen de la locación (escudo, ciudad, mapa...)",
    [WIKI_ENTITY_TYPES.ORGANIZACION]: "Emblema / logo de la organización",
    [WIKI_ENTITY_TYPES.RELIQUIA]: "Imagen del objeto o reliquia",
    [WIKI_ENTITY_TYPES.ESPECIE]: "Ilustración de la especie",
    [WIKI_ENTITY_TYPES.IDEOLOGIA]: "Símbolo / icono de la ideología",
    [WIKI_ENTITY_TYPES.EVENTO_HISTORICO]: "Ilustración del evento",
    [WIKI_ENTITY_TYPES.CRONICA]: "Imagen decorativa de la crónica",
    [WIKI_ENTITY_TYPES.IDIOMA]: "Símbolo o muestra del idioma",
};

/** Todos los tipos narrativos son creables en el archivo (incl. locación). */
const EDITOR_ENTITY_TYPE_OPTIONS = WIKI_ENTITY_TYPE_OPTIONS;

function EditorSection({ title, children, sx = {}, variant = "default" }) {
    const isOptional = variant === "optional";
    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 1.25,
                ...(isOptional ? wikiEditorOptionalSectionSx : {}),
                ...sx,
            }}
        >
            {title && (
                <CyberTitle
                    variant="caption"
                    sx={{
                        color: isOptional ? UI_COLORS.textSecondary : UI_COLORS.accent,
                        fontSize: isOptional ? "0.6rem" : "0.65rem",
                        letterSpacing: 2,
                    }}
                >
                    {title}
                </CyberTitle>
            )}
            {children}
        </Box>
    );
}

/**
 * Inline entity editor (create or edit).
 * No nested dialogs — lives directly in the center panel of the overlay.
 */
export default function WikiEntityEditor({ entity, campaignId, onSaved, onCancel, prefillData = {} }) {
    const dispatch = useDispatch();
    const uid = useSelector((s) => s.player.profile?.uid);
    const entities = useSelector((s) => s.wiki.entities);
    const locations = useSelector((s) => s.world.locations);
    const charactersById = useSelector((s) => s.world.charactersById ?? {});

    const mentionCandidates = buildMentionCandidates(entities, locations, entity?.id);

    const vttCharacters = useMemo(() => {
        const out = [];
        Object.values(locations || {}).forEach((loc) => {
            (loc.characters || []).forEach((c) => out.push({ id: c.id, name: c.name || "(sin nombre)" }));
        });
        return out;
    }, [locations]);

    const isNew = !entity?.id;

    const typeOptions = useMemo(() => {
        if (
            !isNew &&
            entity?.entityType &&
            !EDITOR_ENTITY_TYPE_OPTIONS.some((o) => o.value === entity.entityType)
        ) {
            return [
                ...EDITOR_ENTITY_TYPE_OPTIONS,
                { value: entity.entityType, label: WIKI_ENTITY_TYPE_LABELS[entity.entityType] || entity.entityType },
            ];
        }
        return EDITOR_ENTITY_TYPE_OPTIONS;
    }, [isNew, entity?.entityType]);

    const [form, setForm] = useState({
        entityType: entity?.entityType || prefillData.entityType || "",
        title: entity?.title || prefillData.title || "",
        summary: entity?.summary || prefillData.summary || "",
        body: entity?.body || prefillData.body || "",
        tags: entity?.tags || prefillData.tags || [],
        visibility: entity?.visibility || prefillData.visibility || "dm_only",
        slug: entity?.slug || prefillData.slug || "",
        imageUrl: entity?.imageUrl || prefillData.imageUrl || "",
        linkedVttLocationId: entity?.linkedVttLocationId || prefillData.linkedVttLocationId || null,
        linkedVttCharacterId: entity?.linkedVttCharacterId || prefillData.linkedVttCharacterId || null,
        customFields: entity?.customFields || prefillData.customFields || {},
    });
    const [tagInput, setTagInput] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    /** Storage paths uploaded this session; deleted on cancel unless referenced after save. */
    const pendingPathsRef = useRef(new Set());
    const committedRef = useRef(false);
    const releasedRef = useRef(false);

    const registerPendingPath = useCallback((path) => {
        if (path) pendingPathsRef.current.add(path);
    }, []);

    const dropPendingPath = useCallback((path) => {
        if (path) pendingPathsRef.current.delete(path);
    }, []);

    const releasePendingUploads = useCallback(async () => {
        if (releasedRef.current) return;
        releasedRef.current = true;
        const paths = [...pendingPathsRef.current];
        pendingPathsRef.current.clear();
        await deleteWikiImages(paths);
    }, []);

    useEffect(() => {
        pendingPathsRef.current = new Set();
        committedRef.current = false;
        releasedRef.current = false;
    }, [entity?.id, campaignId]);

    const commitPendingUploads = useCallback(async (draft) => {
        const referenced = collectReferencedWikiPaths(draft);
        const toDelete = [...pendingPathsRef.current].filter((p) => !referenced.has(p));
        pendingPathsRef.current.clear();
        await deleteWikiImages(toDelete);
    }, []);

    const discardPendingPath = useCallback(async (urlOrPath) => {
        const path = urlToWikiStoragePath(urlOrPath);
        if (!path || !pendingPathsRef.current.has(path)) return;
        dropPendingPath(path);
        await deleteWikiImage(path);
    }, [dropPendingPath]);

    useEffect(() => {
        return () => {
            if (!committedRef.current) {
                releasePendingUploads();
            }
        };
    }, [releasePendingUploads]);

    // Upload cover image for this entity
    const handleUploadEntityImage = useCallback(
        async (file) => {
            const result = await uploadWikiEntityImage(campaignId, entity?.id, file);
            registerPendingPath(result.path);
            return result;
        },
        [campaignId, entity?.id, registerPendingPath]
    );

    // Upload an inline image for markdown body
    const handleUploadInlineImage = useCallback(
        async (file) => {
            const result = await uploadWikiInlineImage(campaignId, file);
            registerPendingPath(result.path);
            return result;
        },
        [campaignId, registerPendingPath]
    );

    const handleCancel = useCallback(async () => {
        await releasePendingUploads();
        onCancel?.();
    }, [releasePendingUploads, onCancel]);

    // Auto-generate slug from title when creating
    useEffect(() => {
        if (isNew && form.title) {
            setForm((prev) => ({ ...prev, slug: slugify(form.title) }));
        }
    }, [form.title, isNew]);

    const set = useCallback((field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value })), []);
    const setDirect = useCallback((field, value) => setForm((prev) => ({ ...prev, [field]: value })), []);

    const handleCoverImageChange = useCallback(
        async (url) => {
            if (form.imageUrl && form.imageUrl !== url) {
                await discardPendingPath(form.imageUrl);
            }
            setDirect("imageUrl", url || "");
        },
        [form.imageUrl, discardPendingPath, setDirect]
    );

    const handleTagAdd = () => {
        const tag = tagInput.trim();
        if (tag && !form.tags.includes(tag)) {
            setForm((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
        }
        setTagInput("");
    };

    const handleTagDelete = (tag) => setForm((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));

    const handleVttLink = ({ linkedVttLocationId, linkedVttCharacterId }) => {
        setForm((prev) => ({ ...prev, linkedVttLocationId, linkedVttCharacterId }));
    };

    const isTimelineEvent = form.entityType === WIKI_ENTITY_TYPES.EVENTO_HISTORICO;
    const timelineMeta = getTimelineMeta({ customFields: form.customFields });
    const narrativeArcs = useSelector((s) => s.wiki.narrativeSettings?.narrativeArcs || []);
    const arcSelectOptions = useMemo(
        () => [
            { value: "", label: "Sin arco" },
            ...narrativeArcs.map((a) => ({ value: a.id, label: a.label })),
        ],
        [narrativeArcs],
    );

    const setTimelineField = useCallback((field, value) => {
        setForm((prev) => ({
            ...prev,
            customFields: {
                ...prev.customFields,
                ...buildTimelineCustomFields({
                    ...getTimelineMeta({ customFields: prev.customFields }),
                    [field]: value,
                }),
            },
        }));
    }, []);

    const setTimelineArc = useCallback((arcId) => {
        const id = arcId || null;
        const label = id
            ? (narrativeArcs.find((a) => a.id === id)?.label || "")
            : "";
        setForm((prev) => ({
            ...prev,
            customFields: {
                ...prev.customFields,
                ...buildTimelineCustomFields({
                    ...getTimelineMeta({ customFields: prev.customFields }),
                    narrativeArcId: id,
                    narrativeArc: label,
                }),
            },
        }));
    }, [narrativeArcs]);

    // Generic per-type structured fields (especie, personaje, locacion, etc.)
    const entityMeta = getEntityMeta({ customFields: form.customFields }, form.entityType);
    const showCustomPanel =
        hasCustomFieldPanel(form.entityType) && form.entityType !== WIKI_ENTITY_TYPES.EVENTO_HISTORICO;

    const showVttLink =
        form.entityType === WIKI_ENTITY_TYPES.LOCACION ||
        form.entityType === WIKI_ENTITY_TYPES.PERSONAJE;

    const imageFallback = useMemo(() => {
        // Always compute VTT fallback so a broken wiki imageUrl can still preview.
        const draft = { ...entity, ...form, imageUrl: "" };
        const path = resolveWikiEntityImagePath(draft, locations, charactersById);
        if (!path) return null;
        return {
            path,
            source: resolveWikiEntityImageSource(draft, locations, charactersById),
        };
    }, [entity, form, locations, charactersById]);

    const imageVariant =
        form.entityType === WIKI_ENTITY_TYPES.PERSONAJE ||
        form.entityType === WIKI_ENTITY_TYPES.ESPECIE
            ? "portrait"
            : "banner";

    const setMetaField = useCallback((field, value) => {
        setForm((prev) => ({
            ...prev,
            customFields: mergeCustomFields(prev.customFields, prev.entityType, { [field]: value }),
        }));
    }, []);

    const handleSave = async () => {
        if (!form.title.trim()) { setError("El título es obligatorio."); return; }
        if (!form.entityType) { setError("Selecciona un tipo de entidad."); return; }
        if (isTimelineEvent && !timelineMeta.date.trim()) {
            setError("Los eventos históricos requieren una fecha (año, año-mes o año-mes-día).");
            return;
        }
        setSaving(true);
        setError("");
        try {
            const result = await dispatch(saveWikiEntity({
                campaignId,
                entityId: entity?.id || null,
                data: form,
                uid,
            }));
            if (result.error) throw new Error(result.error.message);

            // Propagate membership arrays to counterpart docs (best-effort).
            const savedId = result.payload?.id || entity?.id;
            if (savedId && campaignId) {
                if (form.entityType === WIKI_ENTITY_TYPES.ORGANIZACION) {
                    await reconcileOrgMembers(
                        campaignId,
                        savedId,
                        getOrgMembers(entity),
                        getOrgMembers({ customFields: form.customFields })
                    );
                } else if (form.entityType === WIKI_ENTITY_TYPES.PERSONAJE) {
                    await reconcilePersonajeMemberships(
                        campaignId,
                        savedId,
                        getPersonajeMemberships(entity),
                        getPersonajeMemberships({ customFields: form.customFields })
                    );
                }
            }

            if (
                savedId &&
                campaignId &&
                form.entityType === WIKI_ENTITY_TYPES.LOCACION
            ) {
                await linkWikiLocacionToVtt(
                    campaignId,
                    savedId,
                    form.linkedVttLocationId || null,
                    uid
                );
                dispatch(fetchWikiEntities({ campaignId }));
            }

            if (
                savedId &&
                campaignId &&
                form.entityType === WIKI_ENTITY_TYPES.PERSONAJE
            ) {
                await linkWikiPersonajeToVtt(
                    campaignId,
                    savedId,
                    form.linkedVttCharacterId || null,
                    uid
                );
                dispatch(fetchWikiEntities({ campaignId }));
            }

            committedRef.current = true;
            await commitPendingUploads(form);

            onSaved && onSaved(result.payload);
        } catch (e) {
            setError(e.message || "Error al guardar.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box
            sx={{
                height: "100%",
                minHeight: 0,
                overflowY: "auto",
                p: 2,
                pb: 3,
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
                ...scrollbarSx,
            }}
        >
            <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1.5, flexWrap: "wrap" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", flex: 1, minWidth: 0 }}>
                    <CyberTitle variant="h6" sx={{ color: UI_COLORS.accent, fontSize: "0.95rem", flexShrink: 0 }}>
                        {isNew ? "NUEVA_FICHA" : "EDITAR_FICHA"}
                    </CyberTitle>
                    {onCancel && (
                        <Box
                            component="button"
                            type="button"
                            onClick={onCancel}
                            sx={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 0.5,
                                px: 1,
                                py: 0.35,
                                bgcolor: "transparent",
                                border: `1px solid ${UI_COLORS.border}`,
                                borderRadius: 1,
                                color: UI_COLORS.textSecondary,
                                cursor: "pointer",
                                fontFamily: "'Fira Sans', sans-serif",
                                transition: "border-color 0.15s, color 0.15s",
                                "&:hover": { borderColor: UI_COLORS.accent, color: UI_COLORS.accent },
                            }}
                        >
                            <ArrowBackIcon sx={{ fontSize: "0.85rem" }} />
                            <CyberText sx={{ fontSize: "0.75rem", fontWeight: 600, color: "inherit" }}>
                                {entity ? ACTION_LABELS.back : ACTION_LABELS.backToList}
                            </CyberText>
                        </Box>
                    )}
                </Box>
                {isNew && <WikiCreationOrderHint currentEntityType={form.entityType} />}
            </Box>

            <Divider sx={{ bgcolor: UI_COLORS.border }} />

            <Box sx={wikiEditorIdentityCardSx}>
                <CyberTitle variant="caption" sx={{ color: UI_COLORS.textSecondary, fontSize: "0.6rem", letterSpacing: 2 }}>
                    IDENTIFICACIÓN
                </CyberTitle>
                <Grid container spacing={1.5} alignItems="flex-start">
                <Grid size={{ xs: 12, md: showVttLink ? 8 : 9 }}>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
                        <Box sx={{ display: "flex", gap: 1.25, flexWrap: "wrap" }}>
                            <WikiSearchableSelect
                                label="Tipo *"
                                value={form.entityType}
                                onChange={(v) => v && setDirect("entityType", v)}
                                options={typeOptions.map(({ value, label }) => ({ value, label }))}
                                minWidth={150}
                                clearable={false}
                            />

                            <TextField
                                required
                                label="Título *"
                                value={form.title}
                                onChange={set("title")}
                                size="small"
                                sx={{ ...inputSx, flex: 1, minWidth: 160 }}
                            />
                        </Box>

                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                            <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.textSecondary, flexShrink: 0 }}>
                                Visibilidad
                            </CyberText>
                            <ToggleButtonGroup
                                value={form.visibility}
                                exclusive
                                onChange={(_, v) => v && setDirect("visibility", v)}
                                size="small"
                                sx={{ bgcolor: UI_COLORS.backgroundPrimary }}
                            >
                                <ToggleButton
                                    value="dm_only"
                                    sx={{
                                        color: form.visibility === "dm_only" ? UI_COLORS.accentStrong : UI_COLORS.textSecondary,
                                        border: `1px solid ${UI_COLORS.border}`,
                                        bgcolor: form.visibility === "dm_only" ? `${UI_COLORS.accentStrong}18` : "transparent",
                                        "&.Mui-selected": { bgcolor: `${UI_COLORS.accentStrong}22`, color: UI_COLORS.accentStrong },
                                    }}
                                >
                                    <LockIcon sx={{ fontSize: "0.8rem", mr: 0.4 }} />
                                    <CyberText sx={{ fontSize: "0.68rem", color: "inherit" }}>Solo DM</CyberText>
                                </ToggleButton>
                                <ToggleButton
                                    value="players"
                                    sx={{
                                        color: form.visibility === "players" ? UI_COLORS.anomaly : UI_COLORS.textSecondary,
                                        border: `1px solid ${UI_COLORS.border}`,
                                        bgcolor: form.visibility === "players" ? `${UI_COLORS.anomaly}18` : "transparent",
                                        "&.Mui-selected": { bgcolor: `${UI_COLORS.anomaly}22`, color: UI_COLORS.anomaly },
                                    }}
                                >
                                    <PeopleIcon sx={{ fontSize: "0.8rem", mr: 0.4 }} />
                                    <CyberText sx={{ fontSize: "0.68rem", color: "inherit" }}>Jugadores</CyberText>
                                </ToggleButton>
                            </ToggleButtonGroup>
                        </Box>
                    </Box>
                </Grid>

                <Grid size={{ xs: 12, md: showVttLink ? 4 : 3 }}>
                    <WikiImageUpload
                        value={form.imageUrl || null}
                        fallbackPath={imageFallback?.path || null}
                        fallbackSource={imageFallback?.source || null}
                        onChange={handleCoverImageChange}
                        uploadImage={handleUploadEntityImage}
                        label={IMAGE_LABEL_BY_TYPE[form.entityType] || "Imagen de portada"}
                        variant={imageVariant}
                    />
                </Grid>
            </Grid>
            </Box>

            {showVttLink && (
                <EditorSection title="VÍNCULO VTT (OPCIONAL)" variant="optional">
                    <WikiVttLinkPicker
                        entityType={form.entityType}
                        linkedVttLocationId={form.linkedVttLocationId}
                        linkedVttCharacterId={form.linkedVttCharacterId}
                        onChange={handleVttLink}
                    />
                </EditorSection>
            )}

            {isTimelineEvent && (
                <Box
                    sx={{
                        p: 1.5,
                        bgcolor: `${UI_COLORS.anomaly}08`,
                        border: `1px solid ${UI_COLORS.anomaly}33`,
                        borderRadius: 1,
                        display: "flex",
                        flexDirection: "column",
                        gap: 1.5,
                    }}
                >
                    <CyberTitle variant="caption" sx={{ color: UI_COLORS.anomaly, letterSpacing: 2, fontSize: "0.65rem" }}>
                        LÍNEA TEMPORAL — CALENDARIO D.Z.
                    </CyberTitle>
                    <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "flex-start" }}>
                        <WikiDateInput
                            value={timelineMeta.date}
                            onChange={(v) => setTimelineField("date", v)}
                            required
                        />
                        <WikiSearchableSelect
                            label="Rama"
                            value={timelineMeta.branch}
                            onChange={(v) => setTimelineField("branch", v)}
                            options={TIMELINE_BRANCH_OPTIONS}
                            minWidth={140}
                            clearable={false}
                        />
                        <WikiSearchableSelect
                            label="Arco narrativo"
                            value={
                                timelineMeta.narrativeArcId
                                || narrativeArcs.find((a) => a.label === timelineMeta.narrativeArc)?.id
                                || ""
                            }
                            onChange={setTimelineArc}
                            options={arcSelectOptions}
                            minWidth={180}
                            clearable
                            placeholder={
                                narrativeArcs.length
                                    ? "Elegir arco…"
                                    : "Crea arcos en TIMELINE (DM)"
                            }
                        />
                        <WikiSearchableSelect
                            label="Tema"
                            value={timelineMeta.eventKind || "otro"}
                            onChange={(v) => setTimelineField("eventKind", v)}
                            options={enumToSearchOptions(EVENT_KIND_OPTIONS)}
                            minWidth={150}
                            clearable={false}
                        />
                        <WikiSearchableSelect
                            label="Certeza"
                            value={timelineMeta.certainty || "canon"}
                            onChange={(v) => setTimelineField("certainty", v)}
                            options={enumToSearchOptions(EVENT_CERTAINTY_OPTIONS)}
                            minWidth={140}
                            clearable={false}
                        />
                    </Box>
                    {timelineMeta.isCore && (
                        <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.anomaly }}>
                            Este es el evento núcleo de la campaña.
                        </CyberText>
                    )}
                    <FormHelperText sx={{ color: UI_COLORS.textSecondary, fontFamily: "'Fira Sans', sans-serif", fontSize: "0.68rem", m: 0 }}>
                        Orden: de más antiguo (arriba) a más reciente (abajo). Misma fecha + rama izq/der = eventos paralelos.
                    </FormHelperText>
                </Box>
            )}

            {/* Per-type structured fields (especie, personaje, locacion, organizacion, reliquia, ideologia) */}
            {showCustomPanel && (
                <WikiCustomFieldsPanel
                    entityType={form.entityType}
                    meta={entityMeta}
                    onField={setMetaField}
                    entities={entities}
                    vttCharacters={vttCharacters}
                    editingEntityId={entity?.id}
                />
            )}

            <EditorSection title="CONTENIDO NARRATIVO">
                <WikiMentionInput
                    label="Resumen (Markdown + @menciones)"
                    value={form.summary}
                    onChange={(v) => setDirect("summary", v)}
                    entities={mentionCandidates}
                    rows={2}
                    placeholder="Una o dos líneas que resuman la ficha…"
                />
                <WikiMentionInput
                    label="Cuerpo (Markdown + @menciones · arrastra imágenes)"
                    value={form.body}
                    onChange={(v) => setDirect("body", v)}
                    entities={mentionCandidates}
                    rows={8}
                    uploadImage={handleUploadInlineImage}
                />
                {entity?.id && (
                    <Box sx={{ mt: 1.5 }}>
                        <WikiAiImpactBlocks entity={entity} canManage />
                    </Box>
                )}
            </EditorSection>

            <EditorSection title="ETIQUETAS Y SLUG">
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "flex-start" }}>
                    <TextField
                        label="Añadir etiqueta"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleTagAdd())}
                        size="small"
                        sx={{ ...inputSx, flex: 1, minWidth: 140 }}
                    />
                    <Box
                        component="button"
                        type="button"
                        onClick={handleTagAdd}
                        sx={{
                            px: 1.25, py: 0.65, bgcolor: `${UI_COLORS.accent}11`, border: `1px solid ${UI_COLORS.accent}55`,
                            borderRadius: 1, color: UI_COLORS.accent, cursor: "pointer", fontFamily: "'Fira Sans', sans-serif",
                            fontSize: "0.72rem", "&:hover": { bgcolor: `${UI_COLORS.accent}22` },
                        }}
                    >
                        + Tag
                    </Box>
                    <TextField
                        label="Slug (@menciones)"
                        value={form.slug}
                        onChange={set("slug")}
                        size="small"
                        placeholder="auto-generado"
                        sx={{ ...inputSx, flex: 1, minWidth: 160 }}
                    />
                </Box>
                {form.tags.length > 0 && (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {form.tags.map((tag) => (
                            <Chip
                                key={tag}
                                label={tag}
                                onDelete={() => handleTagDelete(tag)}
                                size="small"
                                sx={{
                                    bgcolor: UI_COLORS.backgroundPrimary,
                                    border: `1px solid ${UI_COLORS.border}`,
                                    color: UI_COLORS.textSecondary,
                                    height: 22,
                                    fontSize: "0.65rem",
                                    "& .MuiChip-label": { px: 0.75, color: UI_COLORS.textPrimary },
                                    "& .MuiChip-deleteIcon": { color: UI_COLORS.textSecondary, fontSize: "0.8rem" },
                                }}
                            />
                        ))}
                    </Box>
                )}
            </EditorSection>

            {error && (
                <CyberText sx={{ color: UI_COLORS.accentStrong, fontSize: "0.8rem" }}>{error}</CyberText>
            )}

            {/* Actions — sticky footer */}
            <Box
                sx={{
                    position: "sticky",
                    bottom: 0,
                    zIndex: 2,
                    display: "flex",
                    gap: 1,
                    pt: 1.5,
                    pb: 0.5,
                    mt: "auto",
                    flexShrink: 0,
                    background: `linear-gradient(to top, ${UI_COLORS.backgroundSecondary} 75%, transparent)`,
                    borderTop: `1px solid ${UI_COLORS.border}`,
                }}
            >
                <Box
                    component="button"
                    onClick={handleSave}
                    disabled={saving}
                    sx={{
                        ...primaryButtonSx,
                        cursor: saving ? "wait" : "pointer",
                    }}
                >
                    <CyberText sx={{ fontSize: "0.8rem", fontWeight: 600 }}>
                        {saving ? "GUARDANDO..." : ACTION_LABELS.primary}
                    </CyberText>
                </Box>
                <Box
                    component="button"
                    onClick={handleCancel}
                    sx={secondaryButtonSx}
                >
                    <CyberText sx={{ fontSize: "0.8rem" }}>{ACTION_LABELS.secondary}</CyberText>
                </Box>
            </Box>
        </Box>
    );
}
