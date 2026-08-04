/**
 * DOM HUD overlay for NEURAL_LAB graph — visual design from narrative-neural-lab mockup.
 * Static chrome only (legend, selection card, zoom). Animations stay in Pixi.
 */

import { useMemo, useState } from "react";
import { Box, IconButton } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import CropFreeIcon from "@mui/icons-material/CropFree";
import CloseIcon from "@mui/icons-material/Close";
import { CyberTitle, CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { NODE_COLORS_CSS } from "../../pixi/wikiGraph/wikiGraphTypes";
import { WIKI_ENTITY_TYPE_LABELS, WIKI_ENTITY_TYPES } from "../../constants/wikiEntityTypes";

const HUD_BG = "rgba(10,10,20,0.85)";

const HUD_PANEL_SX = {
    bgcolor: HUD_BG,
    backdropFilter: "blur(12px)",
    border: `1px solid ${UI_COLORS.border}`,
    borderRadius: "8px",
};

/** Types shown in the fixed legend (matches mockup priority). */
const LEGEND_TYPES = [
    WIKI_ENTITY_TYPES.PERSONAJE,
    WIKI_ENTITY_TYPES.LOCACION,
    WIKI_ENTITY_TYPES.ORGANIZACION,
    WIKI_ENTITY_TYPES.ESPECIE,
    WIKI_ENTITY_TYPES.RELIQUIA,
    WIKI_ENTITY_TYPES.EVENTO_HISTORICO,
    WIKI_ENTITY_TYPES.IDEOLOGIA,
    WIKI_ENTITY_TYPES.CRONICA,
];

const hudCodeFont = "'Fira Code', monospace";

function isTypeHidden(type, hiddenTypes, soloType) {
    if (soloType) return type !== soloType;
    if (!hiddenTypes) return false;
    if (hiddenTypes instanceof Set) return hiddenTypes.has(type);
    return hiddenTypes.includes?.(type) ?? false;
}

export default function WikiGraphHud({
    entities = [],
    relations = [],
    selectedEntity = null,
    hiddenTypes = null,
    soloType = null,
    onToggleType,
    onSoloType,
    onClearSolo,
    onZoomIn,
    onZoomOut,
    onResetView,
    onClearSelection,
    onOpenEntityDetail,
}) {
    const [hoveredType, setHoveredType] = useState(null);

    const typeCounts = useMemo(() => {
        const counts = {};
        for (const e of entities) {
            counts[e.entityType] = (counts[e.entityType] ?? 0) + 1;
        }
        return counts;
    }, [entities]);

    const selectedRelCount = useMemo(() => {
        if (!selectedEntity?.id) return 0;
        return relations.filter(
            (r) => r.fromEntityId === selectedEntity.id || r.toEntityId === selectedEntity.id
        ).length;
    }, [relations, selectedEntity]);

    const legendRows = LEGEND_TYPES.filter((t) => (typeCounts[t] ?? 0) > 0);

    return (
        <>
            {/* Bottom-right: zoom controls (horizontal) */}
            <Box
                sx={{
                    position: "absolute",
                    right: 12,
                    bottom: 16,
                    zIndex: 4,
                    display: "flex",
                    flexDirection: "row",
                    gap: 0.5,
                }}
            >
                {[
                    { icon: <RemoveIcon sx={{ fontSize: "1.1rem" }} />, title: "Alejar", onClick: onZoomOut },
                    { icon: <CropFreeIcon sx={{ fontSize: "0.95rem" }} />, title: "Restablecer vista", onClick: onResetView },
                    { icon: <AddIcon sx={{ fontSize: "1.1rem" }} />, title: "Acercar", onClick: onZoomIn },
                ].map(({ icon, title, onClick }) => (
                    <IconButton
                        key={title}
                        size="small"
                        title={title}
                        onClick={onClick}
                        sx={{
                            width: 32,
                            height: 32,
                            ...HUD_PANEL_SX,
                            borderRadius: "6px",
                            color: UI_COLORS.textSecondary,
                            "&:hover": { color: UI_COLORS.accent, borderColor: UI_COLORS.accent },
                        }}
                    >
                        {icon}
                    </IconButton>
                ))}
            </Box>

            {/* Bottom-left: selection + legend */}
            <Box
                sx={{
                    position: "absolute",
                    bottom: 16,
                    left: 16,
                    zIndex: 4,
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    maxWidth: 260,
                    pointerEvents: "auto",
                }}
            >
                {selectedEntity && (
                    <Box sx={{ ...HUD_PANEL_SX, p: 1.25 }}>
                        <CyberText
                            sx={{
                                fontFamily: hudCodeFont,
                                fontSize: "0.58rem",
                                color: UI_COLORS.textSecondary,
                                letterSpacing: 1,
                                mb: 0.75,
                            }}
                        >
                            // NODO SELECCIONADO
                        </CyberText>
                        <CyberTitle
                            sx={{
                                fontSize: "0.75rem",
                                color: UI_COLORS.accent,
                                letterSpacing: 1,
                                mb: 0.5,
                                lineHeight: 1.3,
                            }}
                        >
                            {(selectedEntity.title || "").toUpperCase()}
                        </CyberTitle>
                        <Box
                            component="span"
                            sx={{
                                display: "inline-block",
                                fontFamily: hudCodeFont,
                                fontSize: "0.58rem",
                                px: 0.75,
                                py: 0.2,
                                borderRadius: "3px",
                                border: `1px solid ${NODE_COLORS_CSS[selectedEntity.entityType] ?? UI_COLORS.accent}66`,
                                color: NODE_COLORS_CSS[selectedEntity.entityType] ?? UI_COLORS.accent,
                                mb: 0.75,
                            }}
                        >
                            {(WIKI_ENTITY_TYPE_LABELS[selectedEntity.entityType] ?? selectedEntity.entityType).toUpperCase()}
                        </Box>
                        <CyberText sx={{ fontSize: "0.7rem", color: UI_COLORS.textSecondary, display: "block" }}>
                            {selectedRelCount} relaciones
                            {selectedEntity.summary ? ` · ${selectedEntity.summary.slice(0, 48)}${selectedEntity.summary.length > 48 ? "…" : ""}` : ""}
                        </CyberText>
                        <Box sx={{ display: "flex", gap: 0.75, mt: 1 }}>
                            {onOpenEntityDetail && (
                                <Box
                                    component="button"
                                    type="button"
                                    onClick={onOpenEntityDetail}
                                    sx={{
                                        flex: 1,
                                        py: 0.5,
                                        borderRadius: "4px",
                                        border: `1px solid ${UI_COLORS.accent}66`,
                                        bgcolor: `${UI_COLORS.accent}14`,
                                        color: UI_COLORS.accent,
                                        fontFamily: hudCodeFont,
                                        fontSize: "0.58rem",
                                        cursor: "pointer",
                                        "&:hover": { bgcolor: `${UI_COLORS.accent}22` },
                                    }}
                                >
                                    Ver ficha
                                </Box>
                            )}
                            {onClearSelection && (
                                <IconButton
                                    size="small"
                                    title="Deseleccionar"
                                    onClick={onClearSelection}
                                    sx={{
                                        width: 28,
                                        height: 28,
                                        border: `1px solid ${UI_COLORS.border}`,
                                        borderRadius: "4px",
                                        color: UI_COLORS.textSecondary,
                                        "&:hover": { color: UI_COLORS.anomaly, borderColor: UI_COLORS.anomaly },
                                    }}
                                >
                                    <CloseIcon sx={{ fontSize: "0.85rem" }} />
                                </IconButton>
                            )}
                        </Box>
                    </Box>
                )}

                {legendRows.length > 0 && (
                    <Box sx={{ ...HUD_PANEL_SX, p: 1.25 }}>
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                            <CyberText
                                sx={{
                                    fontFamily: hudCodeFont,
                                    fontSize: "0.58rem",
                                    color: UI_COLORS.textSecondary,
                                    letterSpacing: 2,
                                }}
                            >
                                // TIPOS
                            </CyberText>
                            {soloType && onClearSolo && (
                                <Box
                                    component="button"
                                    type="button"
                                    onClick={onClearSolo}
                                    sx={{
                                        border: "none",
                                        bgcolor: "transparent",
                                        color: UI_COLORS.anomaly,
                                        fontFamily: hudCodeFont,
                                        fontSize: "0.55rem",
                                        cursor: "pointer",
                                        letterSpacing: 1,
                                        p: 0,
                                        "&:hover": { color: UI_COLORS.accent },
                                    }}
                                >
                                    TODOS
                                </Box>
                            )}
                        </Box>
                        {legendRows.map((type) => {
                            const color = NODE_COLORS_CSS[type] ?? UI_COLORS.textSecondary;
                            const hidden = isTypeHidden(type, hiddenTypes, soloType);
                            const isSolo = soloType === type;
                            const isHover = hoveredType === type;
                            return (
                                <Box
                                    key={type}
                                    onMouseEnter={() => setHoveredType(type)}
                                    onMouseLeave={() => setHoveredType(null)}
                                    onClick={() => onToggleType?.(type)}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        onSoloType?.(type);
                                    }}
                                    title="Click: mostrar/ocultar · Click derecho: aislar tipo"
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 0.85,
                                        mb: 0.5,
                                        px: 0.5,
                                        py: 0.25,
                                        mx: -0.5,
                                        borderRadius: "4px",
                                        cursor: "pointer",
                                        opacity: hidden ? 0.35 : 1,
                                        outline: isSolo ? `1px solid ${color}` : "none",
                                        bgcolor: isHover ? `${color}18` : "transparent",
                                        transition: "background-color 0.15s, opacity 0.15s",
                                        "&:hover": {
                                            bgcolor: `${color}22`,
                                        },
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: 10,
                                            height: 10,
                                            borderRadius: "50%",
                                            bgcolor: color,
                                            flexShrink: 0,
                                            boxShadow: isHover || isSolo
                                                ? `0 0 10px ${color}, 0 0 4px ${color}`
                                                : `0 0 5px ${color}`,
                                            transform: isHover ? "scale(1.15)" : "none",
                                            transition: "box-shadow 0.15s, transform 0.15s",
                                        }}
                                    />
                                    <CyberText
                                        sx={{
                                            fontFamily: hudCodeFont,
                                            fontSize: "0.65rem",
                                            color: hidden ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.7)",
                                            flex: 1,
                                            textDecoration: hidden ? "line-through" : "none",
                                        }}
                                    >
                                        {WIKI_ENTITY_TYPE_LABELS[type] ?? type}
                                    </CyberText>
                                    <CyberText
                                        sx={{
                                            fontFamily: hudCodeFont,
                                            fontSize: "0.58rem",
                                            color: UI_COLORS.textSecondary,
                                        }}
                                    >
                                        {typeCounts[type]}
                                    </CyberText>
                                </Box>
                            );
                        })}
                    </Box>
                )}
            </Box>
        </>
    );
}

/** Shared helper for filtering graph entities by legend state. */
export function filterEntitiesByLegend(entities, hiddenTypes, soloType) {
    if (!entities?.length) return [];
    return entities.filter((e) => !isTypeHidden(e.entityType, hiddenTypes, soloType));
}
