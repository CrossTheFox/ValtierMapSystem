import { Box, IconButton, Tooltip } from "@mui/material";
import CasinoIcon from "@mui/icons-material/Casino";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import ShieldIcon from "@mui/icons-material/Shield";
import DirectionsRunIcon from "@mui/icons-material/DirectionsRun";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import SecurityIcon from "@mui/icons-material/Security";
import SpeedIcon from "@mui/icons-material/Speed";
import GavelIcon from "@mui/icons-material/Gavel";

import { UI_COLORS } from "../../constants/uiColors";
import { ABILITY_COMMAND_SNIPPETS, ABILITY_DICE_SNIPPETS } from "../../constants/combatStats";

const ICONS = {
    atk: GavelIcon,
    "dmg-fray": CasinoIcon,
    dmg: LocalFireDepartmentIcon,
    fray: FitnessCenterIcon,
    defense: ShieldIcon,
    armor: SecurityIcon,
    speed: SpeedIcon,
    dash: DirectionsRunIcon,
    vit: FavoriteIcon,
    vigor: FavoriteIcon,
};

const chipSx = {
    height: 28,
    minWidth: 28,
    px: 0.75,
    borderRadius: "4px",
    border: `1px solid ${UI_COLORS.border}`,
    bgcolor: "transparent",
    color: "#ffffff",
    fontFamily: "'Fira Code', monospace",
    fontSize: "0.62rem",
    letterSpacing: "0.04em",
    cursor: "pointer",
    lineHeight: 1,
    "&:hover": {
        borderColor: UI_COLORS.accent,
        bgcolor: `${UI_COLORS.accent}22`,
    },
    "&:disabled": { opacity: 0.35, cursor: "default" },
};

/**
 * Insert Roll20-like combat macros / dice into an ability content textarea.
 *
 * @param {{
 *   onInsert: (snippet: string) => void,
 *   disabled?: boolean,
 * }} props
 */
export default function AbilityCommandToolbar({ onInsert, disabled = false }) {
    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 0.5,
                mb: 0.75,
                p: 0.5,
                borderRadius: "6px",
                border: `1px solid ${UI_COLORS.border}`,
                bgcolor: "rgba(0,0,0,0.25)",
            }}
        >
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.35, alignItems: "center" }}>
                <Box
                    sx={{
                        fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.42rem",
                        letterSpacing: "0.1em",
                        color: "rgba(255,255,255,0.55)",
                        mr: 0.35,
                    }}
                >
                    DADO
                </Box>
                {ABILITY_DICE_SNIPPETS.map((snip) => (
                    <Tooltip key={snip.id} title={snip.title}>
                        <Box
                            component="button"
                            type="button"
                            disabled={disabled}
                            onClick={() => onInsert?.(snip.insert)}
                            sx={chipSx}
                        >
                            {snip.label}
                        </Box>
                    </Tooltip>
                ))}
            </Box>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.35, alignItems: "center" }}>
                <Box
                    sx={{
                        fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.42rem",
                        letterSpacing: "0.1em",
                        color: "rgba(255,255,255,0.55)",
                        mr: 0.35,
                    }}
                >
                    CMD
                </Box>
                {ABILITY_COMMAND_SNIPPETS.map((snip) => {
                    const Icon = ICONS[snip.id] || CasinoIcon;
                    return (
                        <Tooltip key={snip.id} title={`${snip.title} → ${snip.insert}`}>
                            <span>
                                <IconButton
                                    size="small"
                                    disabled={disabled}
                                    aria-label={snip.label}
                                    onClick={() => onInsert?.(snip.insert)}
                                    sx={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: "4px",
                                        color: "#ffffff",
                                        border: `1px solid ${UI_COLORS.border}`,
                                        bgcolor: "transparent",
                                        "&:hover": {
                                            borderColor: UI_COLORS.accent,
                                            bgcolor: `${UI_COLORS.accent}22`,
                                            color: "#ffffff",
                                        },
                                        "&.Mui-disabled": { opacity: 0.35 },
                                    }}
                                >
                                    <Icon sx={{ fontSize: "0.95rem" }} />
                                </IconButton>
                            </span>
                        </Tooltip>
                    );
                })}
            </Box>
        </Box>
    );
}
