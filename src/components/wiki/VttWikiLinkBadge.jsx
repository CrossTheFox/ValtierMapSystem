import { Box, Chip, Tooltip } from "@mui/material";
import MapIcon from "@mui/icons-material/Map";
import PeopleIcon from "@mui/icons-material/People";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import { CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { getWikiVttLinkKind } from "../../utils/wikiVttLinkLookup";

const chipBaseSx = {
    height: 18,
    flexShrink: 0,
    "& .MuiChip-label": { px: 0.6 },
    "& .MuiChip-icon": { ml: 0.4 },
};

const compactChipSx = {
    ...chipBaseSx,
    height: 16,
    "& .MuiChip-label": { px: 0.45 },
};

/**
 * Badge on a wiki entity row/detail — shows link to VTT token or map pin.
 */
export function WikiToVttLinkBadge({ entity, compact = false, onClick }) {
    const kind = getWikiVttLinkKind(entity);
    if (!kind) return null;

    const isCharacter = kind === "character";
    const label = isCharacter ? "TOKEN" : "PIN";
    const tooltip = isCharacter
        ? "Ficha anexada a un token VTT"
        : "Ficha anexada a un pin del mapa";

    return (
        <Tooltip title={tooltip} placement="top">
            <Chip
                size="small"
                icon={
                    isCharacter
                        ? <PeopleIcon sx={{ fontSize: "0.7rem !important", color: `${UI_COLORS.anomaly} !important` }} />
                        : <MapIcon sx={{ fontSize: "0.7rem !important", color: `${UI_COLORS.anomaly} !important` }} />
                }
                label={<CyberText sx={{ fontSize: compact ? "0.52rem" : "0.58rem", lineHeight: 1 }}>{label}</CyberText>}
                onClick={onClick}
                sx={{
                    ...(compact ? compactChipSx : chipBaseSx),
                    bgcolor: `${UI_COLORS.anomaly}12`,
                    border: `1px solid ${UI_COLORS.anomaly}55`,
                    color: UI_COLORS.anomaly,
                    cursor: onClick ? "pointer" : "default",
                }}
            />
        </Tooltip>
    );
}

/**
 * Badge on a VTT character/location row — shows link to wiki ficha.
 */
export function VttToWikiLinkBadge({ wikiEntity, compact = false, onClick }) {
    if (!wikiEntity) return null;

    const tooltip = `Ficha anexada: ${wikiEntity.title || wikiEntity.slug || "—"}`;

    return (
        <Tooltip title={tooltip} placement="top">
            <Chip
                size="small"
                icon={<MenuBookIcon sx={{ fontSize: "0.7rem !important", color: `${UI_COLORS.accent} !important` }} />}
                label={<CyberText sx={{ fontSize: compact ? "0.52rem" : "0.58rem", lineHeight: 1 }}>FICHA</CyberText>}
                onClick={onClick}
                sx={{
                    ...(compact ? compactChipSx : chipBaseSx),
                    bgcolor: `${UI_COLORS.accent}12`,
                    border: `1px solid ${UI_COLORS.accent}55`,
                    color: UI_COLORS.accent,
                    cursor: onClick ? "pointer" : "default",
                }}
            />
        </Tooltip>
    );
}

/** Tiny corner marker for roster thumbnails when a wiki ficha exists. */
export function VttToWikiLinkDot({ title }) {
    return (
        <Tooltip title={title ? `Ficha: ${title}` : "Ficha anexada en el archivo"} placement="top">
            <Box
                sx={{
                    position: "absolute",
                    bottom: 3,
                    left: 3,
                    zIndex: 2,
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    bgcolor: UI_COLORS.accent,
                    boxShadow: `0 0 6px ${UI_COLORS.accentGlow}`,
                    border: "1px solid rgba(255,255,255,0.35)",
                }}
            />
        </Tooltip>
    );
}
