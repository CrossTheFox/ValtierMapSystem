import { Box, IconButton } from "@mui/material";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import ListAltIcon from "@mui/icons-material/ListAlt";
import CharSkillsTab from "../tabs/subtabs/CharSkillsTab";
import CharTreeTab from "../tabs/subtabs/CharTreeTab";
import CyberTooltip from "../customs/CyberTooltip";
import { UI_COLORS } from "../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";

/**
 * Dossier KIT: ability list + Neural Mesh. View can be controlled by deep-links.
 */
export default function CharKitTab({ character, view: viewProp, onViewChange }) {
    const view = viewProp === "list" ? "list" : "tree";
    const setView = (next) => onViewChange?.(next);
    const meshMode = view === "tree";

    return (
        <Box sx={{ flex: 1, minHeight: 0, position: "relative", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <Box
                className="dialog-no-drag"
                sx={{
                    position: "absolute",
                    top: 42,
                    right: 10,
                    zIndex: 18,
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    px: 0.55,
                    py: 0.35,
                    borderRadius: 1,
                    bgcolor: "rgba(10, 10, 20, 0.78)",
                    backdropFilter: "blur(12px)",
                    border: `1px solid ${UI_COLORS.border}`,
                    boxShadow: "0 2px 14px rgba(0,0,0,0.4)",
                }}
            >
                <CyberTooltip title="Lista de habilidades">
                    <IconButton
                        size="small"
                        onClick={() => setView("list")}
                        sx={{
                            color: view === "list" ? UI_COLORS.anomaly : UI_COLORS.textSecondary,
                            border: `1px solid ${view === "list" ? UI_COLORS.anomaly : "transparent"}`,
                            borderRadius: 0.75,
                            p: 0.45,
                        }}
                    >
                        <ListAltIcon sx={{ fontSize: "0.95rem" }} />
                    </IconButton>
                </CyberTooltip>
                <CyberTooltip title="Neural Mesh">
                    <IconButton
                        size="small"
                        onClick={() => setView("tree")}
                        sx={{
                            color: view === "tree" ? UI_COLORS.anomaly : UI_COLORS.textSecondary,
                            border: `1px solid ${view === "tree" ? UI_COLORS.anomaly : "transparent"}`,
                            borderRadius: 0.75,
                            p: 0.45,
                        }}
                    >
                        <AccountTreeIcon sx={{ fontSize: "0.95rem" }} />
                    </IconButton>
                </CyberTooltip>
            </Box>

            {view === "list" ? (
                <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", pt: 5, ...CYBER_SCROLL_STYLE }}>
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
                    <CharTreeTab character={character} compactChrome={meshMode} />
                </Box>
            )}
        </Box>
    );
}
