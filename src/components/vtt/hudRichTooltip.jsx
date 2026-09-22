import { Box } from "@mui/material";
import { UI_COLORS } from "../../constants/uiColors";
import KitMarkdown from "../characters/KitMarkdown";

/** Shared paper overrides for Action / Macro rich tooltips (overrides CyberTooltip mono uppercase). */
export const hudRichTooltipSlotProps = {
    tooltip: {
        sx: {
            textTransform: "none",
            letterSpacing: "normal",
            maxWidth: 260,
            bgcolor: "#0a0a14",
            border: `1px solid ${UI_COLORS.border}`,
            p: "8px 10px",
            boxShadow: `0 0 14px ${UI_COLORS.accentGlow}`,
            fontFamily: "inherit",
        },
    },
};

/**
 * Rich HUD tip body — title (Orbitron) + optional body (Fira Sans) + optional meta line.
 * Used by Action tiles and Macro slots so both share one look.
 */
export function HudRichTooltipTitle({ title, body, meta, metaColor, maxWidth = 240 }) {
    const hasBody = Boolean(body);
    const hasMeta = Boolean(meta);

    return (
        <Box sx={{ textAlign: "left", maxWidth }}>
            {title ? (
                <Box
                    sx={{
                        fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.62rem",
                        letterSpacing: "0.08em",
                        color: "#ffffff",
                        textTransform: "uppercase",
                        mb: hasBody ? 0.4 : 0,
                    }}
                >
                    {title}
                </Box>
            ) : null}
            {hasBody ? (
                <KitMarkdown
                    compact
                    content={body}
                    emptyLabel=""
                    sx={{
                        fontSize: "0.72rem",
                        letterSpacing: 0,
                        textTransform: "none",
                    }}
                />
            ) : null}
            {hasMeta ? (
                <Box
                    sx={{
                        mt: hasBody || title ? 0.4 : 0,
                        fontFamily: "'Fira Code', monospace",
                        fontSize: "0.5rem",
                        color: metaColor || UI_COLORS.anomaly,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                    }}
                >
                    {meta}
                </Box>
            ) : null}
        </Box>
    );
}
