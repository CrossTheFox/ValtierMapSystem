import { useState } from "react";
import { Box, Popover } from "@mui/material";
import { UI_COLORS } from "../../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../../constants/cyberScrollStyle";
import { cyberMenuPaperSx } from "../../../constants/designSystem";
import { KitSvgTag } from "../../../constants/kitSvg";
import TagSearchSelect from "../../admin/TagSearchSelect";

/**
 * Compact tag-btn (mockup `.tag-btn`) — popover lists current tags;
 * in kitEdit the picker is TagSearchSelect.
 */
export default function KitTagBtn({ tagKeys = [], availableTags = [], kitEdit = false, onChange }) {
    const [anchor, setAnchor] = useState(null);
    const keys = Array.isArray(tagKeys) ? tagKeys : [];
    const open = Boolean(anchor);

    return (
        <>
            <Box
                component="button"
                type="button"
                title={keys.length ? keys.join(", ") : "Tags"}
                onClick={(e) => {
                    e.stopPropagation();
                    setAnchor(e.currentTarget);
                }}
                sx={{
                    position: "relative",
                    width: 24,
                    height: 24,
                    display: "inline-grid",
                    placeItems: "center",
                    border: keys.length
                        ? "1px solid rgba(167,139,250,0.55)"
                        : "1px dashed rgba(0,242,234,0.55)",
                    borderRadius: "3px",
                    background: keys.length
                        ? "linear-gradient(160deg, rgba(167,139,250,0.18), rgba(0,0,0,0.5))"
                        : "rgba(0,242,234,0.08)",
                    color: keys.length ? "#c4b5fd" : UI_COLORS.anomaly,
                    cursor: "pointer",
                    p: 0,
                    flexShrink: 0,
                    boxShadow: "0 0 0 1px rgba(0,0,0,0.45)",
                    opacity: keys.length ? 1 : 0.75,
                    "&:hover": {
                        borderColor: "rgba(0,242,234,0.55)",
                        color: "#ffffff",
                        boxShadow: "0 0 10px rgba(0,242,234,0.25)",
                    },
                }}
            >
                <KitSvgTag size={12} />
                {keys.length > 0 && (
                    <Box
                        component="span"
                        sx={{
                            position: "absolute",
                            top: -5,
                            right: -5,
                            minWidth: 12,
                            height: 12,
                            px: "3px",
                            borderRadius: "6px",
                            bgcolor: "#a78bfa",
                            color: "#0a0a12",
                            fontFamily: "'Fira Code', monospace",
                            fontSize: "0.48rem",
                            fontWeight: 700,
                            lineHeight: "12px",
                            textAlign: "center",
                        }}
                    >
                        {keys.length}
                    </Box>
                )}
            </Box>
            <Popover
                open={open}
                anchorEl={anchor}
                onClose={() => setAnchor(null)}
                onClick={(e) => e.stopPropagation()}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                slotProps={{
                    paper: {
                        sx: {
                            ...cyberMenuPaperSx,
                            p: "8px 10px",
                            minWidth: 180,
                            maxWidth: 280,
                            maxHeight: 260,
                            overflow: "auto",
                            ...CYBER_SCROLL_STYLE,
                        },
                    },
                }}
            >
                {kitEdit && typeof onChange === "function" ? (
                    <TagSearchSelect
                        available={availableTags || []}
                        value={keys}
                        onChange={onChange}
                    />
                ) : keys.length === 0 ? (
                    <Box sx={{ fontFamily: "'Fira Code', monospace", fontSize: "0.62rem", color: UI_COLORS.textSecondary }}>
                        Sin tags
                    </Box>
                ) : (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {keys.map((k) => (
                            <Box
                                key={k}
                                sx={{
                                    fontFamily: "'Fira Code', monospace",
                                    fontSize: "0.52rem",
                                    color: "#ffffff",
                                    border: `1px solid ${UI_COLORS.anomaly}66`,
                                    bgcolor: `${UI_COLORS.anomaly}14`,
                                    px: "5px",
                                    py: "1px",
                                    borderRadius: "3px",
                                }}
                            >
                                {k}
                            </Box>
                        ))}
                    </Box>
                )}
            </Popover>
        </>
    );
}
