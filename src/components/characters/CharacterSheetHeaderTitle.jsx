import { Box } from "@mui/material";

import { CyberTitle, CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { getVttDialogTitleSx } from "../VttDialogHeader";
import { useCharacterClassLabels } from "../../hooks/useCharacterClassLabels";

/** Name, level, and class badges for the dialog header center column. */
export default function CharacterSheetHeaderTitle({ character, isMinimized = false }) {
    const classIds = character?.assignedClassIds || [];
    const activeClassId = character?.activeClassId;
    const level = character?.level ?? character?.stats?.level;
    const { labelFor } = useCharacterClassLabels(character);

    if (isMinimized) {
        return (
            <CyberTitle sx={getVttDialogTitleSx({ isMinimized: true })}>
                {`CHAR — ${character?.name?.toUpperCase() || "???"} (MIN)`}
            </CyberTitle>
        );
    }

    return (
        <Box sx={{ minWidth: 0, maxWidth: "100%", textAlign: "center" }}>
            <Box
                sx={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "center",
                    gap: 0.75,
                    flexWrap: "wrap",
                }}
            >
                <CyberTitle
                    sx={{
                        ...getVttDialogTitleSx(),
                        fontSize: "clamp(0.72rem, 1vw, 0.95rem)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: "100%",
                    }}
                >
                    {character?.name?.toUpperCase() || "MIS_PERSONAJES"}
                </CyberTitle>
                {character && level != null && level !== "" && level !== "—" && (
                    <CyberText
                        sx={{
                            fontFamily: "monospace",
                            fontSize: "0.58rem",
                            color: UI_COLORS.anomaly,
                            letterSpacing: "0.1em",
                            flexShrink: 0,
                        }}
                    >
                        {`NV ${level}`}
                    </CyberText>
                )}
            </Box>

            {character && classIds.length > 0 && (
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "center",
                        gap: 0.5,
                        mt: 0.35,
                        flexWrap: "wrap",
                    }}
                >
                    {classIds.map((id) => (
                        <Box
                            key={id}
                            sx={{
                                fontFamily: "monospace",
                                fontSize: "0.5rem",
                                px: 0.7,
                                py: 0.15,
                                borderRadius: 0.5,
                                letterSpacing: "0.05em",
                                border: `1px solid ${id === activeClassId ? "rgba(255,102,255,0.45)" : "rgba(0,242,234,0.28)"}`,
                                bgcolor: id === activeClassId ? "rgba(255,102,255,0.1)" : "rgba(0,242,234,0.06)",
                                color: id === activeClassId ? UI_COLORS.accent : UI_COLORS.anomaly,
                                whiteSpace: "nowrap",
                                maxWidth: 160,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                            }}
                        >
                            {labelFor(id)}
                        </Box>
                    ))}
                </Box>
            )}
        </Box>
    );
}
