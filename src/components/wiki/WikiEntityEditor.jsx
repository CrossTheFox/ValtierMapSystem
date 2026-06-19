import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
    Box,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormHelperText,
    Chip,
    Divider,
    ToggleButton,
    ToggleButtonGroup,
} from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import PeopleIcon from "@mui/icons-material/People";
import { useDispatch, useSelector } from "react-redux";
import { CyberTitle, CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
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
import WikiCustomFieldsPanel from "./WikiCustomFieldsPanel";
import WikiCreationOrderHint from "./WikiCreationOrderHint";
import WikiImageUpload from "./WikiImageUpload";
import { saveWikiEntity, fetchWikiEntities } from "../../store/wikiSlice";
import { slugify } from "../../utils/wikiSlug";
import { buildMentionCandidates } from "../../utils/wikiNavigation";
import {
    reconcileOrgMembers,
    reconcilePersonajeMemberships,
} from "../../../firebase/services/membershipService";
import { linkWikiLocacionToVtt } from "../../../firebase/services/wikiVttLinkService";
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

const inputSx = {
    "& .MuiOutlinedInput-root": {
        bgcolor: UI_COLORS.backgroundPrimary,
        color: UI_COLORS.textPrimary,
        fontFamily: "'Fira Sans', sans-serif",
        fontSize: "0.85rem",
        "& fieldset": { borderColor: UI_COLORS.border },
        "&:hover fieldset": { borderColor: `${UI_COLORS.accent}88` },
        "&.Mui-focused fieldset": { borderColor: UI_COLORS.accent },
    },
    "& .MuiInputLabel-root": { color: UI_COLORS.textSecondary, fontFamily: "'Fira Sans', sans-serif", fontSize: "0.8rem" },
    "& .MuiInputLabel-root.Mui-focused": { color: UI_COLORS.accent },
};

const selectSx = {
    color: UI_COLORS.textPrimary,
    fontFamily: "'Fira Sans', sans-serif",
    fontSize: "0.82rem",
    bgcolor: UI_COLORS.backgroundPrimary,
    "& .MuiSelect-select": { color: UI_COLORS.textPrimary },
    "& .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.border },
    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: `${UI_COLORS.accent}88` },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.accent },
    "& .MuiSvgIcon-root": { color: UI_COLORS.textSecondary },
};

/** Todos los tipos narrativos son creables en el archivo (incl. locación). */
const EDITOR_ENTITY_TYPE_OPTIONS = WIKI_ENTITY_TYPE_OPTIONS;

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

/**
 * Inline entity editor (create or edit).
 * No nested dialogs — lives directly in the center panel of the overlay.
 */
export default function WikiEntityEditor({ entity, campaignId, onSaved, onCancel, prefillData = {} }) {
    const dispatch = useDispatch();
    const uid = useSelector((s) => s.player.profile?.uid);
    const entities = useSelector((s) => s.wiki.entities);
    const locations = useSelector((s) => s.world.locations);

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

    // Generic per-type structured fields (especie, personaje, locacion, etc.)
    const entityMeta = getEntityMeta({ customFields: form.customFields }, form.entityType);
    const showCustomPanel =
        hasCustomFieldPanel(form.entityType) && form.entityType !== WIKI_ENTITY_TYPES.EVENTO_HISTORICO;

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
                form.entityType === WIKI_ENTITY_TYPES.LOCACION &&
                form.linkedVttLocationId
            ) {
                await linkWikiLocacionToVtt(
                    campaignId,
                    savedId,
                    form.linkedVttLocationId,
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
                p: 2.5,
                pb: 3.5,
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                gap: 2,
                ...scrollbarSx,
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 2,
                    flexWrap: "wrap",
                }}
            >
                <CyberTitle variant="h6" sx={{ color: UI_COLORS.accent, fontSize: "1rem", flexShrink: 0 }}>
                    {isNew ? "NUEVA_FICHA" : "EDITAR_FICHA"}
                </CyberTitle>
                {isNew && <WikiCreationOrderHint currentEntityType={form.entityType} />}
            </Box>

            <Divider sx={{ bgcolor: UI_COLORS.border }} />

            {/* Type + title */}
            <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel sx={{ color: UI_COLORS.textSecondary, fontSize: "0.8rem" }}>Tipo *</InputLabel>
                    <Select
                        required
                        value={form.entityType}
                        onChange={set("entityType")}
                        label="Tipo *"
                        sx={selectSx}
                        MenuProps={{
                            PaperProps: {
                                sx: {
                                    bgcolor: UI_COLORS.backgroundSecondary,
                                    color: UI_COLORS.textPrimary,
                                },
                            },
                        }}
                    >
                        {typeOptions.map(({ value, label }) => (
                            <MenuItem key={value} value={value} sx={{ color: UI_COLORS.textPrimary }}>
                                <CyberText sx={{ fontSize: "0.82rem" }}>{label}</CyberText>
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <TextField
                    required
                    label="Título *"
                    value={form.title}
                    onChange={set("title")}
                    size="small"
                    sx={{ ...inputSx, flex: 1, minWidth: 180 }}
                />
            </Box>

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
                        <FormControl size="small" sx={{ minWidth: 140 }}>
                            <InputLabel sx={{ color: UI_COLORS.textSecondary, fontSize: "0.8rem" }}>Rama</InputLabel>
                            <Select
                                value={timelineMeta.branch}
                                onChange={(e) => setTimelineField("branch", e.target.value)}
                                label="Rama"
                                sx={selectSx}
                                MenuProps={{
                                    PaperProps: {
                                        sx: { bgcolor: UI_COLORS.backgroundSecondary, color: UI_COLORS.textPrimary },
                                    },
                                }}
                            >
                                <MenuItem value={TIMELINE_BRANCH.LEFT}>
                                    <CyberText sx={{ fontSize: "0.82rem" }}>Izquierda (paralelo)</CyberText>
                                </MenuItem>
                                <MenuItem value={TIMELINE_BRANCH.CENTER}>
                                    <CyberText sx={{ fontSize: "0.82rem" }}>Centro</CyberText>
                                </MenuItem>
                                <MenuItem value={TIMELINE_BRANCH.RIGHT}>
                                    <CyberText sx={{ fontSize: "0.82rem" }}>Derecha (paralelo)</CyberText>
                                </MenuItem>
                            </Select>
                        </FormControl>
                        <TextField
                            label="Arco narrativo"
                            value={timelineMeta.narrativeArc || ""}
                            onChange={(e) => setTimelineField("narrativeArc", e.target.value)}
                            size="small"
                            placeholder="Ej. Post-Diluvio, Guerras…"
                            sx={{ ...inputSx, minWidth: 180, flex: 1 }}
                        />
                        <FormControl size="small" sx={{ minWidth: 150 }}>
                            <InputLabel sx={{ color: UI_COLORS.textSecondary, fontSize: "0.8rem" }}>Tema</InputLabel>
                            <Select
                                value={timelineMeta.eventKind || "otro"}
                                onChange={(e) => setTimelineField("eventKind", e.target.value)}
                                label="Tema"
                                sx={selectSx}
                                MenuProps={{
                                    PaperProps: {
                                        sx: { bgcolor: UI_COLORS.backgroundSecondary, color: UI_COLORS.textPrimary },
                                    },
                                }}
                            >
                                {EVENT_KIND_OPTIONS.map(({ value, label }) => (
                                    <MenuItem key={value} value={value}>
                                        <CyberText sx={{ fontSize: "0.82rem" }}>{label}</CyberText>
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 140 }}>
                            <InputLabel sx={{ color: UI_COLORS.textSecondary, fontSize: "0.8rem" }}>Certeza</InputLabel>
                            <Select
                                value={timelineMeta.certainty || "canon"}
                                onChange={(e) => setTimelineField("certainty", e.target.value)}
                                label="Certeza"
                                sx={selectSx}
                                MenuProps={{
                                    PaperProps: {
                                        sx: { bgcolor: UI_COLORS.backgroundSecondary, color: UI_COLORS.textPrimary },
                                    },
                                }}
                            >
                                {EVENT_CERTAINTY_OPTIONS.map(({ value, label }) => (
                                    <MenuItem key={value} value={value}>
                                        <CyberText sx={{ fontSize: "0.82rem" }}>{label}</CyberText>
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
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

            {/* Cover image upload */}
            <WikiImageUpload
                value={form.imageUrl}
                onChange={handleCoverImageChange}
                uploadImage={handleUploadEntityImage}
                label={IMAGE_LABEL_BY_TYPE[form.entityType] || "Imagen de portada (opcional)"}
                helperText="Arrastra un archivo o haz clic · Se usa como avatar en el grafo y en la ficha."
            />

            {/* Summary with mention support */}
            <WikiMentionInput
                label="Resumen corto (Markdown + @menciones)"
                value={form.summary}
                onChange={(v) => setDirect("summary", v)}
                entities={mentionCandidates}
                rows={2}
                placeholder="Una descripción de una o dos líneas..."
            />

            {/* Body with mention autocomplete + inline image drop */}
            <WikiMentionInput
                label="Contenido (Markdown + @menciones · arrastra imágenes aquí)"
                value={form.body}
                onChange={(v) => setDirect("body", v)}
                entities={mentionCandidates}
                rows={10}
                uploadImage={handleUploadInlineImage}
            />

            {/* Visibility toggle */}
            <Box>
                <CyberText sx={{ fontSize: "0.75rem", color: UI_COLORS.textSecondary, mb: 0.5 }}>
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
                            "&.Mui-selected": {
                                bgcolor: `${UI_COLORS.accentStrong}22`,
                                color: UI_COLORS.accentStrong,
                            },
                        }}
                    >
                        <LockIcon sx={{ fontSize: "0.85rem", mr: 0.5 }} />
                        <CyberText sx={{ fontSize: "0.72rem" }}>Solo DM</CyberText>
                    </ToggleButton>
                    <ToggleButton
                        value="players"
                        sx={{
                            color: form.visibility === "players" ? UI_COLORS.anomaly : UI_COLORS.textSecondary,
                            border: `1px solid ${UI_COLORS.border}`,
                            bgcolor: form.visibility === "players" ? `${UI_COLORS.anomaly}18` : "transparent",
                            "&.Mui-selected": {
                                bgcolor: `${UI_COLORS.anomaly}22`,
                                color: UI_COLORS.anomaly,
                            },
                        }}
                    >
                        <PeopleIcon sx={{ fontSize: "0.85rem", mr: 0.5 }} />
                        <CyberText sx={{ fontSize: "0.72rem" }}>Jugadores</CyberText>
                    </ToggleButton>
                </ToggleButtonGroup>
                <FormHelperText sx={{ color: UI_COLORS.textSecondary, fontFamily: "'Fira Sans', sans-serif", fontSize: "0.68rem", mt: 0.25 }}>
                    «Solo DM» oculta la ficha a los jugadores en su archivo.
                </FormHelperText>
            </Box>

            {/* Tags */}
            <Box>
                <Box sx={{ display: "flex", gap: 1, mb: 0.75 }}>
                    <TextField
                        label="Añadir etiqueta"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleTagAdd())}
                        size="small"
                        sx={{ ...inputSx, flex: 1 }}
                    />
                    <Box
                        component="button"
                        onClick={handleTagAdd}
                        sx={{
                            px: 1.5, py: 0.5, bgcolor: `${UI_COLORS.accent}11`, border: `1px solid ${UI_COLORS.accent}55`,
                            borderRadius: 1, color: UI_COLORS.accent, cursor: "pointer", fontFamily: "'Fira Sans', sans-serif",
                            fontSize: "0.75rem", "&:hover": { bgcolor: `${UI_COLORS.accent}22` },
                        }}
                    >
                        + Tag
                    </Box>
                </Box>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {form.tags.map((tag) => (
                        <Chip
                            key={tag}
                            label={<CyberText sx={{ fontSize: "0.65rem" }}>{tag}</CyberText>}
                            onDelete={() => handleTagDelete(tag)}
                            size="small"
                            sx={{
                                bgcolor: UI_COLORS.backgroundPrimary,
                                border: `1px solid ${UI_COLORS.border}`,
                                color: UI_COLORS.textSecondary,
                                height: 22,
                                "& .MuiChip-label": { px: 0.75 },
                                "& .MuiChip-deleteIcon": { color: UI_COLORS.textSecondary, fontSize: "0.8rem" },
                            }}
                        />
                    ))}
                </Box>
            </Box>

            {/* Slug */}
            <TextField
                label="Slug (para @menciones)"
                value={form.slug}
                onChange={set("slug")}
                size="small"
                placeholder="auto-generado"
                sx={inputSx}
            />

            {/* VTT links (opcional: pin de mapa o token; no obligatorio para locaciones narrativas) */}
            {(form.entityType === WIKI_ENTITY_TYPES.LOCACION ||
                form.entityType === WIKI_ENTITY_TYPES.PERSONAJE) && (
                <>
                    <Divider sx={{ bgcolor: UI_COLORS.border }} />
                    <CyberTitle variant="caption" sx={{ color: UI_COLORS.textSecondary, fontSize: "0.65rem", letterSpacing: 2 }}>
                        VÍNCULO VTT (OPCIONAL)
                    </CyberTitle>
                    <WikiVttLinkPicker
                        entityType={form.entityType}
                        linkedVttLocationId={form.linkedVttLocationId}
                        linkedVttCharacterId={form.linkedVttCharacterId}
                        onChange={handleVttLink}
                    />
                </>
            )}

            {/* Error */}
            {error && (
                <CyberText sx={{ color: UI_COLORS.accentStrong, fontSize: "0.8rem" }}>{error}</CyberText>
            )}

            {/* Actions */}
            <Box sx={{ display: "flex", gap: 1, pt: 1, flexShrink: 0 }}>
                <Box
                    component="button"
                    onClick={handleSave}
                    disabled={saving}
                    sx={{
                        flex: 1, px: 2, py: 0.75, bgcolor: `${UI_COLORS.accent}18`, border: `1px solid ${UI_COLORS.accent}`,
                        borderRadius: 1, color: UI_COLORS.accent, cursor: saving ? "wait" : "pointer",
                        fontFamily: "'Fira Sans', sans-serif", fontSize: "0.8rem", letterSpacing: 1,
                        transition: "background-color 0.15s",
                        "&:hover:not(:disabled)": { bgcolor: `${UI_COLORS.accent}28` },
                        "&:disabled": { opacity: 0.5 },
                    }}
                >
                    <CyberText sx={{ fontSize: "0.8rem", fontWeight: 600 }}>
                        {saving ? "GUARDANDO..." : "GUARDAR"}
                    </CyberText>
                </Box>
                <Box
                    component="button"
                    onClick={handleCancel}
                    sx={{
                        px: 2, py: 0.75, bgcolor: "transparent", border: `1px solid ${UI_COLORS.border}`,
                        borderRadius: 1, color: UI_COLORS.textSecondary, cursor: "pointer",
                        fontFamily: "'Fira Sans', sans-serif", fontSize: "0.8rem",
                        "&:hover": { borderColor: UI_COLORS.textSecondary, color: UI_COLORS.textPrimary },
                    }}
                >
                    <CyberText sx={{ fontSize: "0.8rem" }}>CANCELAR</CyberText>
                </Box>
            </Box>
        </Box>
    );
}

const scrollbarSx = {
    "&::-webkit-scrollbar": { width: "5px" },
    "&::-webkit-scrollbar-thumb": { backgroundColor: `${UI_COLORS.accent}66`, borderRadius: "3px" },
};
