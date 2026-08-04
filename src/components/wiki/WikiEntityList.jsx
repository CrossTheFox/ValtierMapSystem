import { useMemo } from "react";
import { Box, List, ListItemButton, ListItemText } from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import { CyberText, CyberTitle } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import {
    WIKI_ENTITY_TYPE_LABELS,
    WIKI_ARCHIVE_DISPLAY_ORDER,
    compareEntitiesByArchiveOrder,
} from "../../constants/wikiEntityTypes";
import { WikiToVttLinkBadge } from "./VttWikiLinkBadge";

/**
 * Sidebar entity list for the wiki overlay.
 */
export default function WikiEntityList({
    entities = [],
    selectedId,
    onSelect,
    compact = false,
    groupByType = false,
}) {
    const groupedSections = useMemo(() => {
        if (!groupByType) {
            return [{ type: null, label: null, items: [...entities].sort(compareEntitiesByArchiveOrder) }];
        }

        const byType = new Map();
        for (const entity of entities) {
            const type = entity.entityType || "unknown";
            if (!byType.has(type)) byType.set(type, []);
            byType.get(type).push(entity);
        }

        const sections = [];
        for (const type of WIKI_ARCHIVE_DISPLAY_ORDER) {
            const items = byType.get(type);
            if (!items?.length) continue;
            sections.push({
                type,
                label: WIKI_ENTITY_TYPE_LABELS[type] || type,
                items: items.sort((a, b) =>
                    (a.title || "").localeCompare(b.title || "", "es", { sensitivity: "base" })
                ),
            });
            byType.delete(type);
        }

        for (const [type, items] of byType.entries()) {
            sections.push({
                type,
                label: WIKI_ENTITY_TYPE_LABELS[type] || type,
                items: items.sort((a, b) =>
                    (a.title || "").localeCompare(b.title || "", "es", { sensitivity: "base" })
                ),
            });
        }

        return sections;
    }, [entities, groupByType]);

    return (
        <Box sx={{ overflowY: "auto", height: "100%", ...scrollbarSx }}>
            {entities.length === 0 ? (
                <CyberText sx={{ color: UI_COLORS.textSecondary, px: compact ? 1 : 2, py: compact ? 1 : 1.5, fontSize: compact ? "0.72rem" : "0.8rem" }}>
                    Sin resultados
                </CyberText>
            ) : (
                groupedSections.map(({ type, label, items }) => (
                    <Box key={type || "flat"}>
                        {label && (
                            <Box
                                sx={{
                                    position: "sticky",
                                    top: 0,
                                    zIndex: 1,
                                    px: compact ? 1 : 1.5,
                                    py: compact ? 0.35 : 0.5,
                                    bgcolor: `${UI_COLORS.backgroundSecondary}f2`,
                                    borderBottom: `1px solid ${UI_COLORS.border}`,
                                }}
                            >
                                <CyberTitle
                                    variant="caption"
                                    sx={{
                                        color: UI_COLORS.textSecondary,
                                        fontSize: compact ? "0.52rem" : "0.58rem",
                                        letterSpacing: 1.5,
                                        lineHeight: 1.2,
                                    }}
                                >
                                    {label.toUpperCase()} ({items.length})
                                </CyberTitle>
                            </Box>
                        )}
                        <List dense disablePadding>
                            {items.map((entity) => (
                                <EntityRow
                                    key={entity.id}
                                    entity={entity}
                                    selected={selectedId === entity.id}
                                    onSelect={onSelect}
                                    compact={compact}
                                    showType={!groupByType}
                                />
                            ))}
                        </List>
                    </Box>
                ))
            )}
        </Box>
    );
}

function EntityRow({ entity, selected, onSelect, compact = false, showType = true }) {
    const typeLabel = WIKI_ENTITY_TYPE_LABELS[entity.entityType] || entity.entityType;
    const isDmOnly = entity.visibility === "dm_only";

    return (
        <ListItemButton
            selected={selected}
            onClick={() => onSelect(entity)}
            sx={{
                px: compact ? 1 : 2,
                py: compact ? 0.45 : 0.75,
                borderLeft: selected ? `3px solid ${UI_COLORS.accent}` : "3px solid transparent",
                bgcolor: selected ? `${UI_COLORS.accent}11` : "transparent",
                "&:hover": { bgcolor: `${UI_COLORS.accent}0d` },
                "&.Mui-selected": { bgcolor: `${UI_COLORS.accent}11` },
                "&.Mui-selected:hover": { bgcolor: `${UI_COLORS.accent}1a` },
                transition: "background-color 0.15s, border-left-color 0.15s",
            }}
        >
            <ListItemText
                primary={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "nowrap" }}>
                        <CyberText
                            sx={{
                                fontSize: compact ? "0.74rem" : "0.82rem",
                                color: selected ? UI_COLORS.accent : UI_COLORS.textPrimary,
                                lineHeight: 1.3,
                                flex: 1,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                fontWeight: selected ? 600 : 400,
                            }}
                        >
                            {entity.title || "(sin título)"}
                        </CyberText>
                        {isDmOnly && (
                            <LockIcon sx={{ fontSize: "0.75rem", color: UI_COLORS.accentStrong, flexShrink: 0 }} />
                        )}
                        <WikiToVttLinkBadge entity={entity} compact={compact} />
                    </Box>
                }
                secondary={
                    showType ? (
                        <CyberText sx={{ fontSize: compact ? "0.58rem" : "0.65rem", color: UI_COLORS.textSecondary, lineHeight: 1.2 }}>
                            {typeLabel}
                        </CyberText>
                    ) : null
                }
                disableTypography
            />
        </ListItemButton>
    );
}

const scrollbarSx = {
    "&::-webkit-scrollbar": { width: "4px" },
    "&::-webkit-scrollbar-track": { background: UI_COLORS.backgroundPrimary },
    "&::-webkit-scrollbar-thumb": { backgroundColor: `${UI_COLORS.accent}66`, borderRadius: "4px" },
};
