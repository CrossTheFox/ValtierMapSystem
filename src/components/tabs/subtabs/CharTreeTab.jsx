import React, { useState } from "react";
import { Box, Stack } from "@mui/material";
import { CyberTitle } from "../../customs/CustomTexts";
import { UI_COLORS } from "../../../constants/uiColors";
import SkillMatrixClassic from "./skillMatrix/SkillMatrixClassic";
import SkillMatrixConstellation from "./skillMatrix/SkillMatrixConstellation";
import SkillMatrixTriLane from "./skillMatrix/SkillMatrixTriLane";

const MODES = [
    { id: "A", label: "A · CLÁSICO" },
    { id: "B", label: "B · ÓRBITA" },
    { id: "C", label: "C · 3 RAÍLES" },
];

export default function CharTreeTab({ character }) {
    const [mode, setMode] = useState("A");

    return (
        <Box>
            <Stack direction="row" spacing={0} sx={{ mb: 2, flexWrap: "wrap", gap: 0.5 }}>
                {MODES.map((m) => (
                    <Box
                        key={m.id}
                        onClick={() => setMode(m.id)}
                        sx={{
                            px: 1.75,
                            py: 0.75,
                            cursor: "pointer",
                            border: `1px solid ${mode === m.id ? UI_COLORS.accent : UI_COLORS.border}`,
                            bgcolor: mode === m.id ? `${UI_COLORS.accent}14` : "rgba(0,0,0,0.2)",
                            borderRadius: 0.5,
                            transition: "0.2s",
                            "&:hover": { borderColor: UI_COLORS.accent, bgcolor: `${UI_COLORS.accent}0c` },
                        }}
                    >
                        <CyberTitle sx={{ fontSize: "0.68rem", color: mode === m.id ? UI_COLORS.accent : "rgba(255,255,255,0.55)" }}>
                            {m.label}
                        </CyberTitle>
                    </Box>
                ))}
            </Stack>

            {mode === "A" && <SkillMatrixClassic character={character} />}
            {mode === "B" && <SkillMatrixConstellation character={character} fillAvailable />}
            {mode === "C" && <SkillMatrixTriLane character={character} />}
        </Box>
    );
}
