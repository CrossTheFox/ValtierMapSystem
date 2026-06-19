import { Box } from "@mui/material";

import CharacterSheetMetaStrip from "./CharacterSheetMetaStrip";
import CharacterSheetTabs from "./CharacterSheetTabs";
import CharStatsTab from "./CharStatsTab";
import CharBioTab from "./CharBioTab";
import CharBondTab from "./CharBondTab";
import CharSkillsTab from "../tabs/subtabs/CharSkillsTab";
import CharTreeTab from "../tabs/subtabs/CharTreeTab";
import { CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";

const TXT = { color: "rgba(255,255,255,0.92)" };

export default function CharacterSheetBody({
    character,
    activeTab,
    onTabChange,
    statDefinitions = [],
    wikiEntities = [],
}) {
    const matrixFill = activeTab === "SKILL_MATRIX";

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
            {/* Fixed chrome ~10–12% */}
            <CharacterSheetMetaStrip character={character} wikiEntities={wikiEntities} />
            <CharacterSheetTabs value={activeTab} onChange={onTabChange} />

            {/* Scrollable content ~88–90% */}
            <Box
                sx={{
                    flex: 1,
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                    overflow: matrixFill ? "hidden" : "auto",
                    ...(!matrixFill ? CYBER_SCROLL_STYLE : {}),
                }}
            >
                {activeTab === "STATS" && (
                    <CharStatsTab character={character} statDefinitions={statDefinitions} />
                )}
                {activeTab === "BIO" && (
                    <CharBioTab character={character} wikiEntities={wikiEntities} />
                )}
                {activeTab === "SKILLS" && (
                    <CharSkillsTab character={character} playerMode />
                )}
                {activeTab === "SKILL_MATRIX" && (
                    <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                        <CharTreeTab character={character} playerMode fillAvailable />
                    </Box>
                )}
                {activeTab === "BOND" && <CharBondTab character={character} />}
            </Box>
        </Box>
    );
}
