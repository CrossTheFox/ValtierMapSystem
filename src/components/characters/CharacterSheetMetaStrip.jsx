import { Box } from "@mui/material";

import CharacterNarrativeChips from "../wiki/CharacterNarrativeChips";
import { UI_COLORS } from "../../constants/uiColors";

/** Narrative chips only — classes live in the dialog header. */
export default function CharacterSheetMetaStrip({ character, wikiEntities = [] }) {
    if (!character) return null;

    const hasChips =
        character.speciesEntityId ||
        (character.organizationMemberships?.length > 0);

    if (!hasChips) return null;

    return (
        <Box
            sx={{
                flexShrink: 0,
                px: 2,
                py: 0.5,
                bgcolor: UI_COLORS.backgroundSecondary,
                borderBottom: `1px solid ${UI_COLORS.border}`,
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                flexWrap: "wrap",
                maxHeight: 40,
                overflow: "hidden",
            }}
        >
            <CharacterNarrativeChips character={character} wikiEntities={wikiEntities} />
        </Box>
    );
}
