import { Box, Chip } from "@mui/material";
import PlaceIcon from "@mui/icons-material/Place";
import PersonIcon from "@mui/icons-material/Person";
import GroupsIcon from "@mui/icons-material/Groups";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { WIKI_ENTITY_TYPES } from "../../constants/wikiEntityTypes";
import { NODE_COLORS_CSS } from "../../pixi/wikiGraph/wikiGraphTypes";

const TYPE_ICONS = {
    [WIKI_ENTITY_TYPES.LOCACION]: PlaceIcon,
    [WIKI_ENTITY_TYPES.PERSONAJE]: PersonIcon,
    [WIKI_ENTITY_TYPES.ORGANIZACION]: GroupsIcon,
    [WIKI_ENTITY_TYPES.RELIQUIA]: AutoAwesomeIcon,
};

/**
 * Chips de vínculos en tarjetas de la línea temporal.
 * @param {{ chips: { id: string, title: string, entityType: string }[], onChipClick?: (id: string) => void }} props
 */
export default function WikiTimelineLinkChips({ chips = [], onChipClick }) {
    if (!chips.length) return null;

    return (
        <Box
            sx={{ display: "flex", flexWrap: "wrap", gap: 0.4, mt: 0.75 }}
            onClick={(e) => e.stopPropagation()}
        >
            {chips.map((chip) => {
                const Icon = TYPE_ICONS[chip.entityType];
                const color = NODE_COLORS_CSS[chip.entityType] || UI_COLORS.accent;
                return (
                    <Chip
                        key={`${chip.id}-${chip.relationType}`}
                        size="small"
                        icon={Icon ? <Icon sx={{ fontSize: "0.72rem !important", color: `${color} !important` }} /> : undefined}
                        onClick={onChipClick ? () => onChipClick(chip.id) : undefined}
                        label={
                            <CyberText sx={{ fontSize: "0.58rem", maxWidth: 88, overflow: "hidden", textOverflow: "ellipsis" }}>
                                {chip.title}
                            </CyberText>
                        }
                        sx={{
                            height: 20,
                            maxWidth: 120,
                            bgcolor: `${color}14`,
                            border: `1px solid ${color}44`,
                            color,
                            cursor: onChipClick ? "pointer" : "default",
                            "& .MuiChip-label": { px: 0.5 },
                            "& .MuiChip-icon": { ml: 0.5 },
                        }}
                    />
                );
            })}
        </Box>
    );
}
