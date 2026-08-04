import { Box } from "@mui/material";
import SkillMatrixNeuralMesh from "./skillMatrix/SkillMatrixNeuralMesh";

/** Neural Mesh skill tree — Pixi graph + Scan Construct dossier. */
export default function CharTreeTab({ character, compactChrome = true }) {
    return (
        <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <SkillMatrixNeuralMesh character={character} compactChrome={compactChrome} />
        </Box>
    );
}
