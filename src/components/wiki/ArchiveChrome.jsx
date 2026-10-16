import { Box } from "@mui/material";
import { UI_COLORS } from "../../constants/uiColors";
import { TYPO } from "../../constants/designSystem";

export function ArchiveBrand({ sub = null }) {
    return (
        <Box
            component="span"
            sx={{
                fontFamily: TYPO.title,
                fontSize: "11px",
                letterSpacing: ".22em",
                color: UI_COLORS.accent,
                whiteSpace: "nowrap",
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
            }}
        >
            ARCHIVE
            {sub && (
                <Box
                    component="span"
                    sx={{
                        color: UI_COLORS.textSecondary,
                        ml: "6px",
                        letterSpacing: ".1em",
                        fontSize: "9px",
                        fontFamily: TYPO.body,
                    }}
                >
                    · {sub}
                </Box>
            )}
        </Box>
    );
}
