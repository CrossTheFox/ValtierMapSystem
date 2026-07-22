import { Box } from "@mui/material";
import SkillTreeCp2077 from "./skillMatrix/SkillTreeCp2077";

/** Perk tree (CP2077 layout) — React/HTML/SVG, no Pixi/Canvas. */
export default function CharTreeTab({ character }) {
    return (
        <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <SkillTreeCp2077 character={character} />
        </Box>
    );
}
