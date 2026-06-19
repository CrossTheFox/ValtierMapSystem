import { Box, Chip } from "@mui/material";
import { CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { MEMBERSHIP_STATUS } from "../../constants/wiki/entityFieldSchemas";

/**
 * Read-only narrative chips for a VTT playable character: species, species
 * narrative traits, and organization memberships (suspected ones styled
 * differently). Resolves names from the provided wikiEntities list.
 *
 * @param {{ character: object, wikiEntities?: object[], onOpenEntity?: (id:string)=>void }} props
 */
export default function CharacterNarrativeChips({ character, wikiEntities = [], onOpenEntity }) {
    if (!character) return null;

    const species = character.speciesEntityId
        ? wikiEntities.find((e) => e.id === character.speciesEntityId)
        : null;
    const traitTags = species?.customFields?.especie?.traitTags || [];
    const memberships = Array.isArray(character.organizationMemberships)
        ? character.organizationMemberships
        : [];

    if (!species && traitTags.length === 0 && memberships.length === 0) return null;

    const clickable = (id) => (onOpenEntity ? () => onOpenEntity(id) : undefined);

    return (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.6, alignItems: "center" }}>
            {species && (
                <Chip
                    size="small"
                    onClick={clickable(species.id)}
                    label={<CyberText sx={{ fontSize: "0.62rem" }}>{species.title}</CyberText>}
                    sx={{
                        height: 20,
                        bgcolor: `${UI_COLORS.accent}18`,
                        border: `1px solid ${UI_COLORS.accent}55`,
                        color: UI_COLORS.accent,
                        cursor: onOpenEntity ? "pointer" : "default",
                        "& .MuiChip-label": { px: 0.85 },
                    }}
                />
            )}

            {traitTags.map((t) => (
                <Chip
                    key={`trait-${t}`}
                    size="small"
                    label={<CyberText sx={{ fontSize: "0.58rem" }}>{t}</CyberText>}
                    sx={{
                        height: 18,
                        bgcolor: `${UI_COLORS.anomaly}14`,
                        border: `1px solid ${UI_COLORS.anomaly}40`,
                        color: UI_COLORS.anomaly,
                        "& .MuiChip-label": { px: 0.75 },
                    }}
                />
            ))}

            {memberships.map((m) => {
                const org = wikiEntities.find((e) => e.id === m.organizationEntityId);
                if (!org) return null;
                const suspected = m.status === MEMBERSHIP_STATUS.SOSPECHADO;
                const color = suspected ? UI_COLORS.accentStrong : UI_COLORS.textSecondary;
                return (
                    <Chip
                        key={`org-${m.organizationEntityId}`}
                        size="small"
                        onClick={clickable(org.id)}
                        label={
                            <CyberText sx={{ fontSize: "0.58rem", fontStyle: suspected ? "italic" : "normal" }}>
                                {suspected ? `¿${org.title}?` : org.title}
                                {m.role ? ` · ${m.role}` : ""}
                            </CyberText>
                        }
                        sx={{
                            height: 18,
                            bgcolor: `${color}14`,
                            border: `1px ${suspected ? "dashed" : "solid"} ${color}55`,
                            color,
                            cursor: onOpenEntity ? "pointer" : "default",
                            "& .MuiChip-label": { px: 0.75 },
                        }}
                    />
                );
            })}
        </Box>
    );
}
