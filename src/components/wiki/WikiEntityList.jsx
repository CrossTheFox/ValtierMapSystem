import { Box, List, ListItemButton, ListItemText } from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import { CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { WIKI_ENTITY_TYPE_LABELS } from "../../constants/wikiEntityTypes";

/**
 * Sidebar entity list for the wiki overlay.
 */
export default function WikiEntityList({
    entities = [],
    selectedId,
    onSelect,
    compact = false,
}) {
    return (
        <Box sx={{ overflowY: "auto", height: "100%", ...scrollbarSx }}>
            {entities.length === 0 ? (
                <CyberText sx={{ color: UI_COLORS.textSecondary, px: compact ? 1 : 2, py: compact ? 1 : 1.5, fontSize: compact ? "0.72rem" : "0.8rem" }}>
                    Sin resultados
                </CyberText>
            ) : (
                <List dense disablePadding>
                    {entities.map((entity) => (
                        <EntityRow
                            key={entity.id}
                            entity={entity}
                            selected={selectedId === entity.id}
                            onSelect={onSelect}
                            compact={compact}
                        />
                    ))}
                </List>
            )}
        </Box>
    );
}

function EntityRow({ entity, selected, onSelect, compact = false }) {
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
                    </Box>
                }
                secondary={
                    <CyberText sx={{ fontSize: compact ? "0.58rem" : "0.65rem", color: UI_COLORS.textSecondary, lineHeight: 1.2 }}>
                        {typeLabel}
                    </CyberText>
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

