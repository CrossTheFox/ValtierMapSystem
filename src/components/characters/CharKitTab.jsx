import { useState } from "react";
import { Box, IconButton } from "@mui/material";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import ListAltIcon from "@mui/icons-material/ListAlt";
import CharSkillsTab from "../tabs/subtabs/CharSkillsTab";
import CharTreeTab from "../tabs/subtabs/CharTreeTab";
import { CyberText } from "../customs/CustomTexts";
import CyberTooltip from "../customs/CyberTooltip";
import { UI_COLORS } from "../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";

/**
 * Dossier KIT: ability list + CP2077 perk tree (per-job) toggle.
 */
export default function CharKitTab({ character }) {
    const [view, setView] = useState("list"); // "list" | "tree"

    return (
        <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <Box
                sx={{
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    px: 1.5,
                    py: 0.75,
                    borderBottom: `1px solid ${UI_COLORS.border}`,
                    bgcolor: UI_COLORS.backgroundSecondary,
                }}
            >
                <CyberTooltip title="Lista de habilidades">
                    <IconButton
                        size="small"
                        onClick={() => setView("list")}
                        sx={{
                            color: view === "list" ? UI_COLORS.anomaly : UI_COLORS.textSecondary,
                            border: `1px solid ${view === "list" ? UI_COLORS.anomaly : UI_COLORS.border}`,
                            borderRadius: 1,
                        }}
                    >
                        <ListAltIcon sx={{ fontSize: "1rem" }} />
                    </IconButton>
                </CyberTooltip>
                <CyberTooltip title="Árbol de habilidades (por job)">
                    <IconButton
                        size="small"
                        onClick={() => setView("tree")}
                        sx={{
                            color: view === "tree" ? UI_COLORS.anomaly : UI_COLORS.textSecondary,
                            border: `1px solid ${view === "tree" ? UI_COLORS.anomaly : UI_COLORS.border}`,
                            borderRadius: 1,
                        }}
                    >
                        <AccountTreeIcon sx={{ fontSize: "1rem" }} />
                    </IconButton>
                </CyberTooltip>
                <CyberText sx={{ fontSize: "0.58rem", letterSpacing: "0.12em", color: UI_COLORS.textSecondary }}>
                    {view === "list" ? "HABILIDADES" : "ÁRBOL · PERK"}
                </CyberText>
            </Box>

            {view === "list" ? (
                <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", ...CYBER_SCROLL_STYLE }}>
                    <CharSkillsTab character={character} playerMode />
                </Box>
            ) : (
                <Box
                    sx={{
                        flex: 1,
                        minHeight: 0,
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                        bgcolor: UI_COLORS.backgroundPrimary || "#0d0d14",
                    }}
                >
                    <CharTreeTab character={character} />
                </Box>
            )}
        </Box>
    );
}
