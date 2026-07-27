import { Box } from "@mui/material";

import { CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { normalizeSheetTab } from "./CharacterSheetTabs";
import DossierIdView from "./DossierIdView";
import DossierKitView from "./DossierKitView";
import CharTreeTab from "../tabs/subtabs/CharTreeTab";

/**
 * Dossier Holodeck body — routes to ID / KIT / MESH views.
 * Tabs live in the parent chrome; this component is pure content.
 */
export default function CharacterSheetBody({
    character,
    activeTab,
    onTabChange,
    kitView = "tree",
    onKitViewChange,
    statDefinitions = [],
    maxStat = 6,
    wikiEntities = [],
    avatarSize,
}) {
    const tab = normalizeSheetTab(activeTab);

    if (!character) {
        return (
            <Box sx={{ p: 4 }}>
                <CyberText sx={{ color: UI_COLORS.textPrimary }}>
                    No hay personaje activo. Elígelo en el HUD inferior.
                </CyberText>
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
                overflow: "hidden",
                position: "relative",
                bgcolor: "rgba(8,8,14,0.55)",
            }}
        >
            {tab === "IDENTIDAD" && (
                <DossierIdView
                    character={character}
                    statDefinitions={statDefinitions}
                    maxStat={maxStat}
                />
            )}

            {tab === "KIT" && (
                <DossierKitView character={character} />
            )}

            {tab === "MESH" && (
                <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    <CharTreeTab character={character} compactChrome />
                </Box>
            )}
        </Box>
    );
}
