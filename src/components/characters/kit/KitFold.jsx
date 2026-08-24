import { useState } from "react";
import { Box } from "@mui/material";
import { UI_COLORS } from "../../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../../constants/cyberScrollStyle";
import CallChatBtn from "./CallChatBtn";

/** Shared fold chrome (Job / Special / LB) — collapsible cyber panel with a tag + call button. */
export default function KitFold({ tag, tagColor = UI_COLORS.anomaly, title, onCall, defaultOpen = true, children }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <Box
            sx={{
                border: `1px solid ${UI_COLORS.border}`,
                borderRadius: "6px",
                bgcolor: "rgba(0,0,0,0.25)",
                overflow: "hidden",
                minWidth: 0,
                height: "100%",
                display: "flex",
                flexDirection: "column",
            }}
        >
            <Box
                onClick={() => setOpen((v) => !v)}
                sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 1,
                    px: "10px",
                    py: "8px",
                    cursor: "pointer",
                    userSelect: "none",
                }}
            >
                <Box sx={{
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "0.52rem",
                    letterSpacing: "0.1em",
                    color: tagColor,
                    flexShrink: 0,
                    mt: "3px",
                }}>
                    {tag}
                </Box>
                <Box sx={{
                    flex: 1,
                    minWidth: 0,
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "0.82rem",
                    letterSpacing: "0.06em",
                    color: "#ffffff",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    pt: "1px",
                }}>
                    {title}
                </Box>
                {typeof onCall === "function" ? (
                    <Box sx={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                        <CallChatBtn onClick={onCall} />
                    </Box>
                ) : null}
                <Box sx={{
                    color: "rgba(255,255,255,0.75)",
                    fontFamily: "'Fira Code', monospace",
                    fontSize: "0.7rem",
                    transform: open ? "rotate(90deg)" : "none",
                    transition: "transform 0.15s",
                    mt: "2px",
                    flexShrink: 0,
                }}>
                    ▸
                </Box>
            </Box>
            {open ? (
                <Box sx={{
                    px: "12px",
                    pb: "12px",
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    borderTop: `1px solid ${UI_COLORS.border}`,
                    pt: "10px",
                    ...CYBER_SCROLL_STYLE,
                }}>
                    {children}
                </Box>
            ) : null}
        </Box>
    );
}
