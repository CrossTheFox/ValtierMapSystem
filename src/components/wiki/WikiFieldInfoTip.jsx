import { Box, Tooltip } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { UI_COLORS } from "../../constants/uiColors";

const tooltipSlotProps = {
    tooltip: {
        sx: {
            maxWidth: 320,
            fontSize: "0.72rem",
            fontFamily: "'Fira Sans', sans-serif",
            lineHeight: 1.45,
            bgcolor: UI_COLORS.backgroundPrimary,
            color: UI_COLORS.textPrimary,
            border: `1px solid ${UI_COLORS.border}`,
            boxShadow: `0 4px 20px rgba(0,0,0,0.45)`,
        },
    },
};

/** Hover info icon for wiki editor / detail field labels. */
export default function WikiFieldInfoTip({ title }) {
    if (!title) return null;
    return (
        <Tooltip title={title} slotProps={tooltipSlotProps} arrow enterDelay={200}>
            <Box
                component="span"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    cursor: "help",
                    flexShrink: 0,
                    lineHeight: 0,
                }}
            >
                <InfoOutlinedIcon sx={{ fontSize: "0.85rem", color: UI_COLORS.anomaly }} />
            </Box>
        </Tooltip>
    );
}

export { tooltipSlotProps };
