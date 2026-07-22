import { Box } from "@mui/material";

import CharacterSheetMetaStrip from "./CharacterSheetMetaStrip";
import CharacterSheetTabs, { normalizeSheetTab } from "./CharacterSheetTabs";
import CharIdentityTab from "./CharIdentityTab";
import CharKitTab from "./CharKitTab";
import { CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";

const TXT = { color: UI_COLORS.textPrimary };

export default function CharacterSheetBody({
    character,
    activeTab,
    onTabChange,
    statDefinitions = [],
    maxStat = 6,
    wikiEntities = [],
}) {
    const tab = normalizeSheetTab(activeTab);
    const kitFill = tab === "KIT";

    if (!character) {
        return (
            <Box sx={{ p: 4 }}>
                <CyberText sx={TXT}>No characters found.</CyberText>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                minHeight: 0,
                bgcolor: UI_COLORS.backgroundPrimary || "#12121a",
                overflow: "hidden",
            }}
        >
            <CharacterSheetMetaStrip character={character} wikiEntities={wikiEntities} />
            <CharacterSheetTabs value={tab} onChange={onTabChange} />

            <Box
                sx={{
                    flex: 1,
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                    overflow: kitFill ? "hidden" : "auto",
                    ...(!kitFill ? CYBER_SCROLL_STYLE : {}),
                }}
            >
                {tab === "IDENTIDAD" && (
                    <CharIdentityTab
                        character={character}
                        statDefinitions={statDefinitions}
                        maxStat={maxStat}
                        wikiEntities={wikiEntities}
                    />
                )}
                {tab === "KIT" && <CharKitTab character={character} />}
            </Box>
        </Box>
    );
}
