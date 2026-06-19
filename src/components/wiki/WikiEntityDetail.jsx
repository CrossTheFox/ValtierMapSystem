import { Box, Divider, Chip, IconButton, Tooltip } from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import PeopleIcon from "@mui/icons-material/People";
import LinkIcon from "@mui/icons-material/Link";
import MapIcon from "@mui/icons-material/Map";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import HubIcon from "@mui/icons-material/Hub";
import { CyberTitle, CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { WIKI_ENTITY_TYPE_LABELS, WIKI_ENTITY_TYPES } from "../../constants/wikiEntityTypes";
import WikiMentionRenderer from "./WikiMentionRenderer";
import WikiCustomFieldsView from "./WikiCustomFieldsView";

/**
 * Read-only detail view for a wiki entity.
 * Renders body as Markdown with mention links.
 *
 * `onGoToPage` — optional callback; when provided (e.g. from NEURAL_LAB view),
 *   shows a small icon button that navigates to the entity's native area/page.
 * `onOpenInNeuralLab` — optional; opens this entity in the NEURAL_LAB graph view.
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
    compact = false,
}) {
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

    const vttCharacters = [];
    Object.values(locations || {}).forEach((loc) =>
        (loc.characters || []).forEach((c) => vttCharacters.push({ id: c.id, name: c.name, age: c.age }))
    );
    const isVttLinkedType =
        entity.entityType === WIKI_ENTITY_TYPES.PERSONAJE ||
        entity.entityType === WIKI_ENTITY_TYPES.LOCACION;

    return (
        <Box sx={{ height: "100%", minHeight: 0, overflowY: "auto", pb: compact ? 2 : 3.5, boxSizing: "border-box", ...scrollbarSx }}>
            {/* Cover image — full-width banner when present */}
            {entity.imageUrl && (
                <Box
                    sx={{
                        width: "100%",
                        maxHeight: compact ? 112 : 200,
                        overflow: "hidden",
                        position: "relative",
                        flexShrink: 0,
                        lineHeight: 0,
                    }}
                >
                    <Box
                        component="img"
                        src={entity.imageUrl}
                        alt={entity.title}
                        sx={{
                            width: "100%",
                            maxHeight: compact ? 112 : 200,
                            objectFit: "cover",
                            display: "block",
                        }}
                    />
                    {/* Gradient fade bottom */}
                    <Box
                        sx={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: compact ? 36 : 60,
                            background: `linear-gradient(to bottom, transparent, ${UI_COLORS.backgroundSecondary})`,
                            pointerEvents: "none",
                        }}
                    />
                </Box>
            )}

            <Box sx={{ p: compact ? 1.25 : 2.5, pt: entity.imageUrl ? (compact ? 1 : 1.5) : (compact ? 1.25 : 2.5) }}>
            {/* Header */}
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: compact ? 1 : 1.5, flexWrap: "wrap" }}>
                <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <CyberTitle variant="h5" sx={{ color: UI_COLORS.accent, fontSize: compact ? "0.92rem" : "1.2rem", lineHeight: 1.3, mb: compact ? 0.25 : 0.5, flex: 1 }}>
                            {entity.title}
                        </CyberTitle>
                        {onOpenInNeuralLab && (
                            <Tooltip title="Explorar en NEURAL_LAB">
                                <IconButton
                                    size="small"
                                    onClick={onOpenInNeuralLab}
                                    sx={{
                                        color: UI_COLORS.textSecondary,
                                        mb: 0.5,
                                        "&:hover": { color: UI_COLORS.anomaly, bgcolor: `${UI_COLORS.anomaly}14` },
                                        transition: "color 0.15s",
                                    }}
                                >
                                    <HubIcon sx={{ fontSize: "0.9rem" }} />
                                </IconButton>
                            </Tooltip>
                        )}
                        {onGoToPage && (
                            <Tooltip title="Abrir ficha completa en el archivo">
                                <IconButton
                                    size="small"
                                    onClick={onGoToPage}
                                    sx={{
                                        color: UI_COLORS.textSecondary,
                                        mb: 0.5,
                                        "&:hover": { color: UI_COLORS.accent, bgcolor: `${UI_COLORS.accent}14` },
                                        transition: "color 0.15s",
                                    }}
                                >
                                    <OpenInNewIcon sx={{ fontSize: "0.9rem" }} />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                        <Chip
                            label={
                                <CyberText sx={{ fontSize: "0.65rem", lineHeight: 1 }}>{typeLabel}</CyberText>
                            }
                            size="small"
                            sx={{
                                bgcolor: `${UI_COLORS.accent}18`,
                                border: `1px solid ${UI_COLORS.accent}55`,
                                color: UI_COLORS.accent,
                                "& .MuiChip-label": { px: 1 },
                                height: 20,
                            }}
                        />
                        {isDmOnly ? (
                            <Chip
                                icon={<LockIcon sx={{ fontSize: "0.75rem !important", color: `${UI_COLORS.accentStrong} !important` }} />}
                                label={<CyberText sx={{ fontSize: "0.62rem", lineHeight: 1, color: UI_COLORS.accentStrong }}>Solo DM</CyberText>}
                                size="small"
                                sx={{ bgcolor: `${UI_COLORS.accentStrong}11`, border: `1px solid ${UI_COLORS.accentStrong}44`, height: 20, "& .MuiChip-label": { px: 0.5 } }}
                            />
                        ) : (
                            <Chip
                                icon={<PeopleIcon sx={{ fontSize: "0.75rem !important", color: `${UI_COLORS.anomaly} !important` }} />}
                                label={<CyberText sx={{ fontSize: "0.62rem", lineHeight: 1, color: UI_COLORS.anomaly }}>Jugadores</CyberText>}
                                size="small"
                                sx={{ bgcolor: `${UI_COLORS.anomaly}11`, border: `1px solid ${UI_COLORS.anomaly}44`, height: 20, "& .MuiChip-label": { px: 0.5 } }}
                            />
                        )}
                    </Box>
                </Box>
            </Box>

            {/* Tags */}
            {entity.tags?.length > 0 && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1.5 }}>
                    {entity.tags.map((tag) => (
                        <Chip
                            key={tag}
                            label={<CyberText sx={{ fontSize: "0.62rem", lineHeight: 1 }}>{tag}</CyberText>}
                            size="small"
                            sx={{
                                bgcolor: UI_COLORS.backgroundPrimary,
                                border: `1px solid ${UI_COLORS.border}`,
                                color: UI_COLORS.textSecondary,
                                height: 18,
                                "& .MuiChip-label": { px: 0.75 },
                            }}
                        />
                    ))}
                </Box>
            )}

            {/* Per-type structured metadata */}
            <WikiCustomFieldsView
                entity={entity}
                entities={entities}
                vttCharacters={vttCharacters}
                onEntityClick={onEntityClick}
            />

            {/* Summary — rendered with mention links */}
            {entity.summary && (
                <Box
                    sx={{
                        bgcolor: `${UI_COLORS.accent}0a`,
                        border: `1px solid ${UI_COLORS.accent}22`,
                        borderLeft: `3px solid ${UI_COLORS.accent}`,
                        borderRadius: 1,
                        px: 1.5,
                        py: 1,
                        mb: 2,
                        fontStyle: "italic",
                        "& p": { m: 0, fontSize: "0.85rem", color: UI_COLORS.textPrimary, lineHeight: 1.6, fontStyle: "italic" },
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

            {/* Body */}
            {entity.body ? (
                <Box
                    sx={{
                        "& p, & li": { color: UI_COLORS.textPrimary, fontFamily: "'Fira Sans', sans-serif", fontSize: "0.85rem" },
                    }}
                >
                    <WikiMentionRenderer
                        body={entity.body}
                        onEntityClick={onEntityClick}
                        entities={entities}
                        locations={locations}
                    />
                </Box>
            ) : (
                <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "0.82rem", fontStyle: "italic" }}>
                    Sin contenido. Haz clic en Editar para añadir texto.
                </CyberText>
            )}

            {/* VTT Links — open map dialogs */}
            {(entity.linkedVttLocationId || entity.linkedVttCharacterId) && (
                <>
                    <Divider sx={{ bgcolor: UI_COLORS.border, my: 2 }} />
                    <CyberTitle variant="caption" sx={{ color: UI_COLORS.textSecondary, letterSpacing: 2, fontSize: "0.6rem" }}>
                        VÍNCULOS_VTT — MAPA
                    </CyberTitle>
                    <Box sx={{ display: "flex", gap: 1, mt: 0.75, flexWrap: "wrap" }}>
                        {entity.linkedVttLocationId && (
                            <Chip
                                icon={<MapIcon sx={{ fontSize: "0.8rem !important", color: `${UI_COLORS.anomaly} !important` }} />}
                                label={<CyberText sx={{ fontSize: "0.65rem" }}>Abrir ubicación en mapa</CyberText>}
                                size="small"
                                onClick={() => onOpenVttLocation?.(entity.linkedVttLocationId)}
                                sx={{
                                    bgcolor: `${UI_COLORS.anomaly}11`,
                                    border: `1px solid ${UI_COLORS.anomaly}44`,
                                    color: UI_COLORS.anomaly,
                                    height: 24,
                                    cursor: onOpenVttLocation ? "pointer" : "default",
                                    "&:hover": onOpenVttLocation ? { bgcolor: `${UI_COLORS.anomaly}22` } : {},
                                    "& .MuiChip-label": { px: 0.75 },
                                }}
                            />
                        )}
                        {entity.linkedVttCharacterId && (
                            <Chip
                                icon={<PeopleIcon sx={{ fontSize: "0.8rem !important", color: `${UI_COLORS.anomaly} !important` }} />}
                                label={<CyberText sx={{ fontSize: "0.65rem" }}>Abrir personaje en mapa</CyberText>}
                                size="small"
                                onClick={() => onOpenVttCharacter?.(entity.linkedVttCharacterId)}
                                sx={{
                                    bgcolor: `${UI_COLORS.anomaly}11`,
                                    border: `1px solid ${UI_COLORS.anomaly}44`,
                                    color: UI_COLORS.anomaly,
                                    height: 24,
                                    cursor: onOpenVttCharacter ? "pointer" : "default",
                                    "&:hover": onOpenVttCharacter ? { bgcolor: `${UI_COLORS.anomaly}22` } : {},
                                    "& .MuiChip-label": { px: 0.75 },
                                }}
                            />
                        )}
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 1 }}>
                        <MenuBookIcon sx={{ fontSize: "0.75rem", color: UI_COLORS.textSecondary }} />
                        <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.textSecondary, lineHeight: 1.4 }}>
                            Las menciones @ a tokens del mapa también abren estos diálogos al hacer clic.
                        </CyberText>
                    </Box>
                </>
            )}

            {isVttLinkedType && !entity.linkedVttLocationId && !entity.linkedVttCharacterId && (
                <Box sx={{ mt: 2, p: 1, border: `1px dashed ${UI_COLORS.border}`, borderRadius: 1 }}>
                    <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.textSecondary, lineHeight: 1.45 }}>
                        {entity.entityType === WIKI_ENTITY_TYPES.LOCACION
                            ? "Sin pin en el mapa VTT (válido para regiones, países, etc.). Edita la ficha para enlazar un pin cuando exista, o hazlo desde el editor de ubicaciones VTT."
                            : "Sin vínculo al token del mapa. Edita la ficha para enlazar el personaje jugable y poder abrir su diálogo desde aquí o desde @menciones."}
                    </CyberText>
                </Box>
            )}

            {/* Audit */}
            {entity.updatedAt && (
                <CyberText sx={{ fontSize: "0.65rem", color: UI_COLORS.textSecondary, mt: 2 }}>
                    Actualizado: {new Date(entity.updatedAt).toLocaleString("es")}
                </CyberText>
            )}
            </Box> {/* end inner padding Box */}
        </Box>
    );
}

const scrollbarSx = {
    "&::-webkit-scrollbar": { width: "5px" },
    "&::-webkit-scrollbar-thumb": { backgroundColor: `${UI_COLORS.accent}66`, borderRadius: "3px" },
};
