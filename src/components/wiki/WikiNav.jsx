import { Box } from "@mui/material";
import { WIKI_AREAS } from "../../constants/wiki";
import { CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";

/**
 * Compact vertical area selector rendered inside World Archive.
 * All areas are live: Chronicle stays in-drawer, others open the overlay filtered by area.
 *
 * @param {{ activeArea: import("../../constants/wiki").WikiAreaId, onAreaChange: Function }} props
 */
export default function WikiNav({ activeArea, onAreaChange }) {
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 2 }}>
            {WIKI_AREAS.map((area) => {
                const isActive = activeArea === area.id;

                return (
                    <Box
                        key={area.id}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isActive}
                        aria-label={`${area.label}: ${area.hint}`}
                        onClick={() => onAreaChange(area.id)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onAreaChange(area.id);
                            }
                        }}
                        sx={{
                            px: 1.5,
                            py: 1,
                            borderRadius: "4px",
                            cursor: "pointer",
                            borderLeft: `2px solid ${isActive ? UI_COLORS.anomaly : "transparent"}`,
                            backgroundColor: isActive
                                ? `${UI_COLORS.anomaly}18`
                                : "rgba(255,255,255,0.03)",
                            transition: "background-color 0.2s, border-color 0.2s",
                            "&:hover": {
                                backgroundColor: isActive
                                    ? `${UI_COLORS.anomaly}22`
                                    : "rgba(255,255,255,0.06)",
                            },
                            "&:focus-visible": {
                                outline: `1px solid ${UI_COLORS.accent}`,
                                outlineOffset: 2,
                            },
                        }}
                    >
                        <CyberText
                            variant="caption"
                            sx={{
                                color: isActive ? UI_COLORS.anomaly : UI_COLORS.accent,
                                fontWeight: "bold",
                                letterSpacing: 1,
                                lineHeight: 1.4,
                                display: "block",
                            }}
                        >
                            {area.label}
                        </CyberText>
                        <CyberText
                            variant="caption"
                            sx={{
                                color: "rgba(255,255,255,0.4)",
                                fontSize: "0.65rem",
                                lineHeight: 1.3,
                                display: "block",
                            }}
                        >
                            {area.hint}
                        </CyberText>
                    </Box>
                );
            })}
        </Box>
    );
}
