import { Box, Popover } from "@mui/material";
import { UI_COLORS } from "../../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../../constants/cyberScrollStyle";
import { hudPopoverPaperSx } from "../../../constants/designSystem";
import KitMarkdown from "../KitMarkdown";

/**
 * Glass inspect panel for job flavor / class resource rules.
 * Click-to-pin (hover tooltips stay for the peek).
 */
export default function KitLorePopover({
    open,
    anchorEl,
    onClose,
    title,
    meta,
    body,
    asideTitle,
    asideBody,
    accent = UI_COLORS.anomaly,
    anchorOrigin = { vertical: "bottom", horizontal: "left" },
    transformOrigin = { vertical: "top", horizontal: "left" },
}) {
    const hasBody = Boolean(String(body || "").trim());
    const hasAside = Boolean(String(asideBody || "").trim());

    return (
        <Popover
            open={Boolean(open && anchorEl)}
            anchorEl={anchorEl}
            onClose={onClose}
            anchorOrigin={anchorOrigin}
            transformOrigin={transformOrigin}
            slotProps={{
                paper: {
                    sx: {
                        ...hudPopoverPaperSx,
                        width: 360,
                        maxWidth: "min(360px, 92vw)",
                        maxHeight: "min(440px, 72vh)",
                        overflowX: "hidden",
                        overflowY: "auto",
                        boxSizing: "border-box",
                        p: "12px 14px 14px",
                        boxShadow: `0 0 22px ${accent}33`,
                        ...CYBER_SCROLL_STYLE,
                    },
                },
            }}
        >
            <Box sx={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: 0 }}>
            {title ? (
                <Box
                    sx={{
                        fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.72rem",
                        letterSpacing: "0.1em",
                        color: "#ffffff",
                        textTransform: "uppercase",
                        lineHeight: 1.25,
                    }}
                >
                    {title}
                </Box>
            ) : null}
            {meta ? (
                <Box
                    sx={{
                        mt: 0.35,
                        mb: hasBody || hasAside ? 1 : 0,
                        fontFamily: "'Fira Code', monospace",
                        fontSize: "0.5rem",
                        letterSpacing: "0.12em",
                        color: accent,
                        textTransform: "uppercase",
                    }}
                >
                    {meta}
                </Box>
            ) : null}
            {hasBody ? (
                <KitMarkdown
                    compact
                    content={body}
                    emptyLabel=""
                    sx={{
                        fontSize: "0.82rem",
                        fontStyle: "normal",
                        minWidth: 0,
                        overflowWrap: "anywhere",
                        color: "rgba(255,255,255,0.88)",
                    }}
                />
            ) : null}
            {hasAside ? (
                <Box
                    sx={{
                        mt: hasBody ? 1.25 : 0,
                        p: "8px 10px",
                        borderRadius: "4px",
                        border: `1px solid ${accent}55`,
                        bgcolor: `${accent}12`,
                        minWidth: 0,
                    }}
                >
                    {asideTitle ? (
                        <Box
                            sx={{
                                fontFamily: "Orbitron, sans-serif",
                                fontSize: "0.52rem",
                                letterSpacing: "0.12em",
                                color: accent,
                                mb: 0.6,
                            }}
                        >
                            {String(asideTitle).toUpperCase()}
                        </Box>
                    ) : null}
                    <KitMarkdown
                        compact
                        content={asideBody}
                        emptyLabel=""
                        sx={{ fontSize: "0.78rem", minWidth: 0, overflowWrap: "anywhere" }}
                    />
                </Box>
            ) : null}
            {!hasBody && !hasAside ? (
                <Box
                    sx={{
                        fontFamily: "'Fira Sans', sans-serif",
                        fontSize: "0.78rem",
                        color: UI_COLORS.textSecondary,
                        fontStyle: "italic",
                    }}
                >
                    Sin descripción en este job.
                </Box>
            ) : null}
            </Box>
        </Popover>
    );
}
