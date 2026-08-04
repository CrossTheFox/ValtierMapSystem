import { useState, useMemo, useEffect } from "react";
import { useSelector } from "react-redux";
import { Box, Divider, Chip, IconButton, Tooltip, Collapse } from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import PeopleIcon from "@mui/icons-material/People";
import MapIcon from "@mui/icons-material/Map";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import HubIcon from "@mui/icons-material/Hub";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import { CyberTitle, CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { WIKI_ENTITY_TYPE_LABELS, WIKI_ENTITY_TYPES } from "../../constants/wikiEntityTypes";
import { getEntityMeta } from "../../utils/wikiCustomFields";
import { ANY_MENTION_REGEX } from "../../utils/wikiSlug";
import {
    resolveWikiEntityImageCandidates,
    resolveWikiEntityImageSource,
} from "../../utils/resolveWikiEntityImage";
import { loadFirebaseAsset, getCachedUrl } from "../../../firebase/services/assetLoader";
import {
    CHARACTER_KIND_LABELS,
    REACTION_ARCHETYPE_LABELS,
    REACTION_ARCHETYPE_TOOLTIPS,
    NARRATIVE_STATE_LABELS,
    STRESS_RESPONSE_LABELS,
} from "../../constants/wiki/entityFieldSchemas";
import { formatTimelineDateLabel, TIMELINE_CALENDAR } from "../../utils/wikiTimeline";
import WikiMentionRenderer from "./WikiMentionRenderer";
import WikiCustomFieldsView from "./WikiCustomFieldsView";
import WikiFieldInfoTip from "./WikiFieldInfoTip";
import WikiAiImpactBlocks from "./WikiAiImpactBlocks";

/**
 * Read-only detail view for a wiki entity.
 * Layout: hero (title + portrait) → key facts → collapsible metadata → narrative body.
 */
export default function WikiEntityDetail({
    entity,
    entities = [],
    locations = {},
    onEntityClick,
    onOpenVttLocation,
    onOpenVttCharacter,
    onGoToPage,
    onOpenInNeuralLab,
    onEdit,
    onDelete,
    compact = false,
}) {
    const charactersById = useSelector((s) => s.world.charactersById ?? {});
    const [techSheetOpen, setTechSheetOpen] = useState(false);

    useEffect(() => {
        setTechSheetOpen(entity?.entityType === WIKI_ENTITY_TYPES.PERSONAJE);
    }, [entity?.id, entity?.entityType]);

    const vttCharacters = useMemo(() => {
        const list = [];
        Object.values(locations || {}).forEach((loc) =>
            (loc.characters || []).forEach((c) => list.push({ id: c.id, name: c.name, age: c.age }))
        );
        return list;
    }, [locations]);

    const meta = entity ? getEntityMeta(entity, entity.entityType) : {};
    const subtitle = useMemo(
        () => (entity ? buildSubtitle(entity, entities, vttCharacters) : null),
        [entity, entities, vttCharacters]
    );
    const showSummaryBlock = useMemo(
        () => (entity ? shouldShowSummaryBlock(entity.summary, subtitle) : false),
        [entity, entity?.summary, subtitle]
    );
    const keyFacts = useMemo(
        () => (entity ? buildKeyFacts(entity, meta, entities, vttCharacters, compact) : []),
        [entity, meta, entities, vttCharacters, compact]
    );
    const narrativeHighlights = useMemo(
        () => (entity?.entityType === WIKI_ENTITY_TYPES.PERSONAJE ? buildNarrativeHighlights(meta) : null),
        [entity?.entityType, meta]
    );
    const resolvedImagePaths = useMemo(
        () => (entity ? resolveWikiEntityImageCandidates(entity, locations, charactersById) : []),
        [entity, locations, charactersById]
    );
    const resolvedImageSource = useMemo(
        () => (entity ? resolveWikiEntityImageSource(entity, locations, charactersById) : null),
        [entity, locations, charactersById]
    );

    if (!entity) {
        return (
            <Box sx={{ p: compact ? 1.5 : 3 }}>
                <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: compact ? "0.75rem" : "0.85rem" }}>
                    Selecciona una ficha del listado para verla aquí.
                </CyberText>
            </Box>
        );
    }

    const isDmOnly = entity.visibility === "dm_only";
    const typeLabel = WIKI_ENTITY_TYPE_LABELS[entity.entityType] || entity.entityType;

    const isVttLinkedType =
        entity.entityType === WIKI_ENTITY_TYPES.PERSONAJE ||
        entity.entityType === WIKI_ENTITY_TYPES.LOCACION;

    const portraitW = compact ? 96 : 140;

    return (
        <Box sx={{ height: "100%", minHeight: 0, overflowY: "auto", boxSizing: "border-box", ...scrollbarSx }}>
            {/* ── Hero: identity + portrait ── */}
            <Box
                sx={{
                    px: compact ? 1.25 : 2,
                    pt: compact ? 1.25 : 1.75,
                    pb: compact ? 1 : 1.5,
                    borderBottom: `1px solid ${UI_COLORS.border}`,
                    bgcolor: `${UI_COLORS.accent}04`,
                }}
            >
                <Box sx={{ display: "flex", gap: compact ? 1.25 : 2, alignItems: "flex-start" }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        {/* Title + actions */}
                        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.25, mb: subtitle ? 0.35 : 0.5 }}>
                            <CyberTitle
                                variant="h5"
                                sx={{
                                    color: UI_COLORS.accent,
                                    fontSize: compact ? "0.95rem" : "1.25rem",
                                    lineHeight: 1.25,
                                    flex: 1,
                                    minWidth: 0,
                                    letterSpacing: "0.04em",
                                }}
                            >
                                {entity.title}
                            </CyberTitle>
                            <EntityActions
                                onOpenInNeuralLab={onOpenInNeuralLab}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                onGoToPage={onGoToPage}
                            />
                        </Box>

                        {/* Subtitle — role / tagline */}
                        {subtitle && (
                            <CyberText
                                sx={{
                                    fontSize: compact ? "0.78rem" : "0.88rem",
                                    color: UI_COLORS.textPrimary,
                                    lineHeight: 1.45,
                                    mb: 0.75,
                                    opacity: 0.92,
                                    fontStyle: "normal",
                                }}
                            >
                                {subtitle}
                            </CyberText>
                        )}

                        {/* Type + visibility + tags */}
                        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.5 }}>
                            <Chip
                                label={<CyberText sx={{ fontSize: "0.62rem", lineHeight: 1, fontWeight: 600 }}>{typeLabel}</CyberText>}
                                size="small"
                                sx={{
                                    bgcolor: `${UI_COLORS.accent}18`,
                                    border: `1px solid ${UI_COLORS.accent}55`,
                                    color: UI_COLORS.accent,
                                    height: 20,
                                    "& .MuiChip-label": { px: 0.85 },
                                }}
                            />
                            {isDmOnly ? (
                                <Chip
                                    icon={<LockIcon sx={{ fontSize: "0.7rem !important", color: `${UI_COLORS.accentStrong} !important` }} />}
                                    label={<CyberText sx={{ fontSize: "0.58rem", color: UI_COLORS.accentStrong }}>Solo DM</CyberText>}
                                    size="small"
                                    sx={{ bgcolor: `${UI_COLORS.accentStrong}11`, border: `1px solid ${UI_COLORS.accentStrong}44`, height: 20 }}
                                />
                            ) : (
                                <Chip
                                    icon={<PeopleIcon sx={{ fontSize: "0.7rem !important", color: `${UI_COLORS.anomaly} !important` }} />}
                                    label={<CyberText sx={{ fontSize: "0.58rem", color: UI_COLORS.anomaly }}>Jugadores</CyberText>}
                                    size="small"
                                    sx={{ bgcolor: `${UI_COLORS.anomaly}11`, border: `1px solid ${UI_COLORS.anomaly}44`, height: 20 }}
                                />
                            )}
                            {entity.tags?.map((tag) => (
                                <Chip
                                    key={tag}
                                    label={<CyberText sx={{ fontSize: "0.58rem" }}>{tag}</CyberText>}
                                    size="small"
                                    sx={{
                                        height: 18,
                                        bgcolor: UI_COLORS.backgroundPrimary,
                                        border: `1px solid ${UI_COLORS.border}`,
                                        color: UI_COLORS.textSecondary,
                                        "& .MuiChip-label": { px: 0.65 },
                                    }}
                                />
                            ))}
                        </Box>
                    </Box>

                    <EntityPortrait
                        imagePaths={resolvedImagePaths}
                        imageSource={resolvedImageSource}
                        title={entity.title}
                        width={portraitW}
                        compact={compact}
                    />
                </Box>

                {/* Key facts strip */}
                {keyFacts.length > 0 && (
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: `repeat(auto-fill, minmax(${compact ? 88 : 108}px, 1fr))`,
                            gap: compact ? 0.5 : 0.65,
                            mt: compact ? 1 : 1.25,
                        }}
                    >
                        {keyFacts.map(({ label, value, entityId, accent, tooltip }) => (
                            <KeyFactCell
                                key={label}
                                label={label}
                                value={value}
                                entityId={entityId}
                                accent={accent}
                                tooltip={tooltip}
                                onEntityClick={onEntityClick}
                                compact={compact}
                            />
                        ))}
                    </Box>
                )}

                {/* VTT quick link */}
                {(entity.linkedVttLocationId || entity.linkedVttCharacterId) && (
                    <Box sx={{ display: "flex", gap: 0.75, mt: compact ? 0.85 : 1, flexWrap: "wrap" }}>
                        {entity.linkedVttLocationId && (
                            <Chip
                                icon={<MapIcon sx={{ fontSize: "0.75rem !important", color: `${UI_COLORS.anomaly} !important` }} />}
                                label={<CyberText sx={{ fontSize: "0.62rem" }}>Mapa VTT</CyberText>}
                                size="small"
                                onClick={() => onOpenVttLocation?.(entity.linkedVttLocationId)}
                                sx={vttChipSx}
                            />
                        )}
                        {entity.linkedVttCharacterId && (
                            <Chip
                                icon={<PeopleIcon sx={{ fontSize: "0.75rem !important", color: `${UI_COLORS.anomaly} !important` }} />}
                                label={<CyberText sx={{ fontSize: "0.62rem" }}>Token VTT</CyberText>}
                                size="small"
                                onClick={() => onOpenVttCharacter?.(entity.linkedVttCharacterId)}
                                sx={vttChipSx}
                            />
                        )}
                    </Box>
                )}
            </Box>

            {/* Narrative memory — visible for personajes with IA personality data */}
            {narrativeHighlights && (
                <NarrativeMemoryStrip highlights={narrativeHighlights} compact={compact} />
            )}

            {/* ── Collapsible technical metadata ── */}
            <Box sx={{ px: compact ? 1.25 : 2, pt: compact ? 0.75 : 1 }}>
                <Box
                    component="button"
                    type="button"
                    onClick={() => setTechSheetOpen((v) => !v)}
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        width: "100%",
                        px: 0.5,
                        py: 0.4,
                        bgcolor: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: UI_COLORS.textSecondary,
                        fontFamily: "'Fira Sans', sans-serif",
                    }}
                >
                    <ExpandMoreIcon
                        sx={{
                            fontSize: "1rem",
                            transform: techSheetOpen ? "rotate(180deg)" : "rotate(0deg)",
                            transition: "transform 0.2s",
                        }}
                    />
                    <CyberTitle variant="caption" sx={{ fontSize: "0.55rem", letterSpacing: 1.4, color: UI_COLORS.textSecondary }}>
                        FICHA TÉCNICA
                    </CyberTitle>
                </Box>
                <Collapse in={techSheetOpen}>
                    <WikiCustomFieldsView
                        entity={entity}
                        entities={entities}
                        vttCharacters={vttCharacters}
                        onEntityClick={onEntityClick}
                    />
                </Collapse>
            </Box>

            {/* ── Narrative content ── */}
            <Box sx={{ px: compact ? 1.25 : 2, py: compact ? 1 : 1.5, pb: compact ? 2 : 3 }}>
                {showSummaryBlock && entity.summary && (
                    <Box
                        sx={{
                            bgcolor: `${UI_COLORS.accent}0a`,
                            border: `1px solid ${UI_COLORS.accent}22`,
                            borderLeft: `3px solid ${UI_COLORS.accent}`,
                            borderRadius: 1,
                            px: 1.5,
                            py: 1,
                            mb: 1.75,
                            fontStyle: "italic",
                            "& p": { m: 0, fontSize: compact ? "0.8rem" : "0.85rem", color: UI_COLORS.textPrimary, lineHeight: 1.65, fontStyle: "italic" },
                        }}
                    >
                        <WikiMentionRenderer
                            body={entity.summary}
                            onEntityClick={onEntityClick}
                            entities={entities}
                            locations={locations}
                        />
                    </Box>
                )}

                {entity.body ? (
                    <Box
                        sx={{
                            "& p, & li": {
                                color: UI_COLORS.textPrimary,
                                fontFamily: "'Fira Sans', sans-serif",
                                fontSize: compact ? "0.8rem" : "0.875rem",
                                lineHeight: 1.75,
                            },
                            "& p": { mb: 1.25 },
                        }}
                    >
                        <WikiMentionRenderer
                            body={entity.body}
                            onEntityClick={onEntityClick}
                            entities={entities}
                            locations={locations}
                        />
                    </Box>
                ) : !showSummaryBlock && !entity.summary ? (
                    <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "0.82rem", fontStyle: "italic" }}>
                        Sin contenido narrativo. Haz clic en Editar para añadir texto.
                    </CyberText>
                ) : null}

                <WikiAiImpactBlocks
                    entity={entity}
                    canManage={Boolean(onEdit)}
                    compact={compact}
                />

                {isVttLinkedType && !entity.linkedVttLocationId && !entity.linkedVttCharacterId && (
                    <Box sx={{ mt: 2, p: 1, border: `1px dashed ${UI_COLORS.border}`, borderRadius: 1 }}>
                        <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.textSecondary, lineHeight: 1.45 }}>
                            {entity.entityType === WIKI_ENTITY_TYPES.LOCACION
                                ? "Sin pin en el mapa VTT. Edita la ficha para enlazar un pin cuando exista."
                                : "Sin vínculo al token del mapa. Edita la ficha para enlazar el personaje jugable."}
                        </CyberText>
                    </Box>
                )}

                {(entity.linkedVttLocationId || entity.linkedVttCharacterId) && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 1.5 }}>
                        <MenuBookIcon sx={{ fontSize: "0.72rem", color: UI_COLORS.textSecondary }} />
                        <CyberText sx={{ fontSize: "0.65rem", color: UI_COLORS.textSecondary, lineHeight: 1.4 }}>
                            Las menciones @ en el texto también abren fichas y tokens del mapa.
                        </CyberText>
                    </Box>
                )}

                {entity.updatedAt && (
                    <Divider sx={{ bgcolor: UI_COLORS.border, my: 1.5 }} />
                )}
                {entity.updatedAt && (
                    <CyberText sx={{ fontSize: "0.62rem", color: UI_COLORS.textSecondary }}>
                        Actualizado: {new Date(entity.updatedAt).toLocaleString("es")}
                    </CyberText>
                )}
            </Box>
        </Box>
    );
}

function EntityActions({ onOpenInNeuralLab, onEdit, onDelete, onGoToPage }) {
    const hasAny = onOpenInNeuralLab || onEdit || onDelete || onGoToPage;
    if (!hasAny) return null;

    return (
        <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0, gap: 0.125 }}>
            {onOpenInNeuralLab && (
                <Tooltip title="Explorar en NEURAL_LAB">
                    <IconButton size="small" onClick={onOpenInNeuralLab} sx={entityActionBtnSx(UI_COLORS.anomaly)}>
                        <HubIcon sx={{ fontSize: "0.9rem" }} />
                    </IconButton>
                </Tooltip>
            )}
            {onEdit && (
                <Tooltip title="Editar">
                    <IconButton size="small" onClick={onEdit} sx={entityActionBtnSx(UI_COLORS.accent)}>
                        <EditIcon sx={{ fontSize: "0.9rem" }} />
                    </IconButton>
                </Tooltip>
            )}
            {onDelete && (
                <Tooltip title="Eliminar ficha">
                    <IconButton size="small" onClick={onDelete} sx={entityActionBtnSx(UI_COLORS.accentStrong)}>
                        <DeleteIcon sx={{ fontSize: "0.9rem" }} />
                    </IconButton>
                </Tooltip>
            )}
            {onGoToPage && (
                <Tooltip title="Abrir ficha completa en el archivo">
                    <IconButton size="small" onClick={onGoToPage} sx={entityActionBtnSx(UI_COLORS.textSecondary)}>
                        <OpenInNewIcon sx={{ fontSize: "0.9rem" }} />
                    </IconButton>
                </Tooltip>
            )}
        </Box>
    );
}

function EntityPortrait({ imagePaths = [], imagePath, imageSource, title, width, compact }) {
    const paths = imagePaths.length ? imagePaths : (imagePath ? [imagePath] : []);
    const pathsKey = paths.join("|");
    const [pathIndex, setPathIndex] = useState(0);
    const [exhausted, setExhausted] = useState(false);
    const activePath = !exhausted ? (paths[pathIndex] ?? null) : null;

    useEffect(() => {
        setPathIndex(0);
        setExhausted(false);
    }, [pathsKey]);

    const [url, setUrl] = useState(null);

    const advanceOrExhaust = () => {
        setUrl(null);
        setPathIndex((i) => {
            if (i + 1 < paths.length) return i + 1;
            setExhausted(true);
            return i;
        });
    };

    useEffect(() => {
        if (!activePath) {
            setUrl(null);
            return;
        }
        if (activePath.startsWith("http")) {
            setUrl(activePath);
            return;
        }
        const cached = getCachedUrl(activePath);
        if (cached) {
            setUrl(cached);
            return;
        }
        let cancelled = false;
        loadFirebaseAsset(activePath)
            .then((loaded) => { if (!cancelled) setUrl(loaded); })
            .catch(() => { if (!cancelled) advanceOrExhaust(); });
        return () => { cancelled = true; };
    }, [activePath, pathsKey]);

    const sourceLabel =
        pathIndex > 0 || imageSource === "vtt_character" ? "VTT" :
        imageSource === "vtt_location" ? "MAPA" :
        null;
    const hasCandidate = paths.length > 0;

    return (
        <Box
            sx={{
                width,
                flexShrink: 0,
                aspectRatio: "3 / 4",
                borderRadius: 1,
                overflow: "hidden",
                border: `1px solid ${hasCandidate ? `${UI_COLORS.accent}44` : UI_COLORS.border}`,
                bgcolor: UI_COLORS.backgroundPrimary,
                boxShadow: hasCandidate ? `0 0 12px ${UI_COLORS.accentGlow}` : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
            }}
        >
            {url ? (
                <Box
                    component="img"
                    src={url}
                    alt={title}
                    onError={advanceOrExhaust}
                    sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
            ) : (
                <Box sx={{ textAlign: "center", px: 0.75 }}>
                    <ImageOutlinedIcon sx={{ fontSize: compact ? "1.4rem" : "1.8rem", color: `${UI_COLORS.textSecondary}55`, mb: 0.25 }} />
                    <CyberText sx={{ fontSize: "0.52rem", color: UI_COLORS.textSecondary, lineHeight: 1.3, display: "block" }}>
                        {hasCandidate && !exhausted ? "Cargando…" : "Sin imagen"}
                    </CyberText>
                </Box>
            )}
            {sourceLabel && url && (
                <Box
                    sx={{
                        position: "absolute",
                        bottom: 4,
                        right: 4,
                        px: 0.5,
                        py: 0.15,
                        borderRadius: 0.5,
                        bgcolor: "rgba(0,0,0,0.72)",
                        border: `1px solid ${UI_COLORS.anomaly}66`,
                    }}
                >
                    <CyberText sx={{ fontSize: "0.48rem", color: UI_COLORS.anomaly, letterSpacing: 0.8 }}>
                        {sourceLabel}
                    </CyberText>
                </Box>
            )}
        </Box>
    );
}

function KeyFactCell({ label, value, entityId, accent, onEntityClick, compact, tooltip }) {
    const clickable = Boolean(entityId && onEntityClick);
    const color = accent || UI_COLORS.textPrimary;

    return (
        <Box
            sx={{
                px: compact ? 0.65 : 0.85,
                py: compact ? 0.45 : 0.55,
                bgcolor: UI_COLORS.backgroundPrimary,
                border: `1px solid ${UI_COLORS.border}`,
                borderRadius: 0.75,
                minWidth: 0,
            }}
        >
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.35, mb: 0.2 }}>
                <CyberText sx={{ fontSize: "0.52rem", color: UI_COLORS.textSecondary, letterSpacing: 0.8, lineHeight: 1.2 }}>
                    {label.toUpperCase()}
                </CyberText>
                {tooltip && <WikiFieldInfoTip title={tooltip} />}
            </Box>
            <CyberText
                onClick={clickable ? () => onEntityClick(entityId) : undefined}
                sx={{
                    fontSize: compact ? "0.72rem" : "0.78rem",
                    color: clickable ? UI_COLORS.accent : color,
                    lineHeight: 1.25,
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    cursor: clickable ? "pointer" : "default",
                    "&:hover": clickable ? { textDecoration: "underline", color: UI_COLORS.accentStrong } : {},
                }}
            >
                {value}
            </CyberText>
        </Box>
    );
}

function stripSummaryForDisplay(text) {
    if (!text) return "";
    return text
        .replace(new RegExp(ANY_MENTION_REGEX.source, "g"), (_, title) => title)
        .replace(/\*\*/g, "")
        .replace(/\*/g, "")
        .trim();
}

function buildSubtitle(entity, entities, vttCharacters) {
    const plain = stripSummaryForDisplay(entity.summary);
    if (plain) {
        const firstLine = plain.split(/\n+/)[0].trim();
        if (firstLine) return firstLine;
    }

    const meta = getEntityMeta(entity, entity.entityType);
    if (entity.entityType === WIKI_ENTITY_TYPES.PERSONAJE) {
        if (meta.occupation) return meta.occupation;
        if (meta.titles?.length) return meta.titles.join(" · ");
    }
    if (entity.entityType === WIKI_ENTITY_TYPES.LOCACION && meta.locationKind) {
        return null; // handled in key facts
    }
    if (entity.entityType === WIKI_ENTITY_TYPES.ORGANIZACION && meta.motto) {
        return meta.motto;
    }
    return null;
}

function shouldShowSummaryBlock(summary, subtitle) {
    if (!summary?.trim()) return false;
    const plain = stripSummaryForDisplay(summary);
    const firstLine = plain.split(/\n+/)[0]?.trim();
    if (!subtitle) return true;
    if (plain.includes("\n")) return true;
    if (plain.length > (subtitle.length + 40)) return true;
    return plain !== subtitle;
}

function buildKeyFacts(entity, meta, entities, vttCharacters, compact = false) {
    const facts = [];
    const T = WIKI_ENTITY_TYPES;
    const resolveTitle = (id) => entities.find((e) => e.id === id)?.title || null;
    const limit = compact ? 6 : 10;

    if (entity.entityType === T.PERSONAJE) {
        if (meta.characterKind) {
            facts.push({ label: "Tipo", value: CHARACTER_KIND_LABELS[meta.characterKind] || meta.characterKind });
        }
        if (meta.speciesEntityId) {
            const title = resolveTitle(meta.speciesEntityId);
            if (title) facts.push({ label: "Especie", value: title, entityId: meta.speciesEntityId, accent: UI_COLORS.anomaly });
        }
        const vtt = entity.linkedVttCharacterId
            ? vttCharacters.find((c) => c.id === entity.linkedVttCharacterId)
            : null;
        if (vtt?.age != null && vtt.age !== "") {
            facts.push({ label: "Edad", value: String(vtt.age) });
        }
        if (meta.birthDate) {
            facts.push({ label: "Nacimiento", value: formatTimelineDateLabel(meta.birthDate, TIMELINE_CALENDAR.DZ) });
        }
        if (meta.deathDate) {
            facts.push({ label: "Muerte", value: formatTimelineDateLabel(meta.deathDate, TIMELINE_CALENDAR.DZ), accent: UI_COLORS.accentStrong });
        }
        if (meta.birthPlaceEntityId) {
            const title = resolveTitle(meta.birthPlaceEntityId);
            if (title) facts.push({ label: "Origen", value: title, entityId: meta.birthPlaceEntityId, accent: UI_COLORS.anomaly });
        }
        if (meta.activeEraLabel) {
            facts.push({ label: "Era", value: meta.activeEraLabel });
        }
        if (meta.occupation) {
            facts.push({ label: "Ocupación", value: meta.occupation });
        }
        if (meta.reactionArchetype && REACTION_ARCHETYPE_LABELS[meta.reactionArchetype]) {
            facts.push({
                label: "Arquetipo",
                value: REACTION_ARCHETYPE_LABELS[meta.reactionArchetype],
                accent: UI_COLORS.anomaly,
                tooltip: REACTION_ARCHETYPE_TOOLTIPS[meta.reactionArchetype],
            });
        }
        const orgs = Array.isArray(meta.organizations) ? meta.organizations : [];
        if (orgs.length === 1) {
            const o = orgs[0];
            const title = resolveTitle(o.organizationEntityId);
            if (title) {
                const role = o.role ? ` · ${o.role}` : "";
                facts.push({
                    label: "Organización",
                    value: `${title}${role}`,
                    entityId: o.organizationEntityId,
                });
            }
        } else if (orgs.length > 1) {
            facts.push({ label: "Organizaciones", value: `${orgs.length} vinculadas` });
        }
        if (meta.isDeity) {
            facts.push({ label: "Naturaleza", value: "Deidad", accent: UI_COLORS.accentStrong });
        }
    }

    if (entity.entityType === T.LOCACION) {
        if (meta.parentLocationEntityId) {
            const title = resolveTitle(meta.parentLocationEntityId);
            if (title) facts.push({ label: "Región", value: title, entityId: meta.parentLocationEntityId });
        }
        if (meta.dominantSpeciesEntityId) {
            const title = resolveTitle(meta.dominantSpeciesEntityId);
            if (title) facts.push({ label: "Especie", value: title, entityId: meta.dominantSpeciesEntityId, accent: UI_COLORS.anomaly });
        }
    }

    if (entity.entityType === T.ORGANIZACION) {
        if (meta.headquartersEntityId) {
            const title = resolveTitle(meta.headquartersEntityId);
            if (title) facts.push({ label: "Sede", value: title, entityId: meta.headquartersEntityId });
        }
        const members = Array.isArray(meta.members) ? meta.members : [];
        if (members.length > 0) {
            facts.push({ label: "Integrantes", value: `${members.length}` });
        }
    }

    if (entity.entityType === T.ESPECIE && meta.homeworldEntityId) {
        const title = resolveTitle(meta.homeworldEntityId);
        if (title) facts.push({ label: "Origen", value: title, entityId: meta.homeworldEntityId });
    }

    if (entity.entityType === T.RELIQUIA && meta.currentHolderEntityId) {
        const title = resolveTitle(meta.currentHolderEntityId);
        if (title) facts.push({ label: "Portador", value: title, entityId: meta.currentHolderEntityId });
    }

    return facts.slice(0, limit);
}

function buildNarrativeHighlights(meta) {
    const traits = Array.isArray(meta.narrativeTraits) ? meta.narrativeTraits : [];
    const hasAny =
        meta.narrativeState || meta.stressResponse || traits.length > 0 || meta.bondNotes;
    if (!hasAny) return null;
    return {
        state: meta.narrativeState ? NARRATIVE_STATE_LABELS[meta.narrativeState] : null,
        stress: meta.stressResponse ? STRESS_RESPONSE_LABELS[meta.stressResponse] : null,
        traits,
        bondNotes: meta.bondNotes || null,
    };
}

function NarrativeMemoryStrip({ highlights, compact }) {
    if (!highlights) return null;
    return (
        <Box
            sx={{
                mx: compact ? 1.25 : 2,
                mt: compact ? 0.75 : 1,
                mb: compact ? 0.5 : 0.75,
                p: compact ? 1 : 1.25,
                bgcolor: `${UI_COLORS.anomaly}08`,
                border: `1px solid ${UI_COLORS.anomaly}33`,
                borderLeft: `3px solid ${UI_COLORS.anomaly}`,
                borderRadius: 1,
            }}
        >
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.75 }}>
                <CyberTitle variant="caption" sx={{ fontSize: "0.58rem", letterSpacing: 1.4, color: UI_COLORS.anomaly }}>
                    MEMORIA DE PERSONALIDAD (IA)
                </CyberTitle>
                <WikiFieldInfoTip title="Estado emocional actual, patrón de estrés y vínculos que guían las reacciones del personaje en eventos narrativos." />
            </Box>
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: compact ? "1fr" : "repeat(auto-fill, minmax(140px, 1fr))",
                    gap: 0.65,
                }}
            >
                {highlights.state && (
                    <KeyFactCell label="Estado" value={highlights.state} accent={UI_COLORS.anomaly} compact={compact} />
                )}
                {highlights.stress && (
                    <KeyFactCell label="Estrés" value={highlights.stress} compact={compact} />
                )}
            </Box>
            {highlights.traits.length > 0 && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.75 }}>
                    {highlights.traits.map((t) => (
                        <Chip
                            key={t}
                            size="small"
                            label={<CyberText sx={{ fontSize: "0.6rem" }}>{t}</CyberText>}
                            sx={{
                                height: 20,
                                bgcolor: `${UI_COLORS.accent}14`,
                                border: `1px solid ${UI_COLORS.accent}44`,
                                color: UI_COLORS.accent,
                            }}
                        />
                    ))}
                </Box>
            )}
            {highlights.bondNotes && (
                <CyberText sx={{ fontSize: compact ? "0.75rem" : "0.8rem", color: UI_COLORS.textPrimary, mt: 0.85, lineHeight: 1.55, fontStyle: "italic" }}>
                    «{highlights.bondNotes}»
                </CyberText>
            )}
        </Box>
    );
}

const vttChipSx = {
    bgcolor: `${UI_COLORS.anomaly}11`,
    border: `1px solid ${UI_COLORS.anomaly}44`,
    color: UI_COLORS.anomaly,
    height: 22,
    cursor: "pointer",
    "&:hover": { bgcolor: `${UI_COLORS.anomaly}22` },
    "& .MuiChip-label": { px: 0.65 },
};

const scrollbarSx = {
    "&::-webkit-scrollbar": { width: "5px" },
    "&::-webkit-scrollbar-thumb": { backgroundColor: `${UI_COLORS.accent}66`, borderRadius: "3px" },
};

function entityActionBtnSx(color) {
    return {
        color: UI_COLORS.textSecondary,
        p: 0.35,
        "&:hover": { color, bgcolor: `${color}14` },
        transition: "color 0.15s, background-color 0.15s",
    };
}
