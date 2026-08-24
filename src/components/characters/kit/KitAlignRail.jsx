import { Box } from "@mui/material";
import { UI_COLORS } from "../../../constants/uiColors";

const MUTED = UI_COLORS.textSecondary;
const CYAN = UI_COLORS.anomaly;
const PINK = UI_COLORS.accent;
const LB = "#ffcc33";
const DANGER = "#ff3355";

/**
 * Sticky 34px column header — mockup `.align-rail`.
 * Variants: default (traits), loadout (pips + EDIT), lb ready/locked.
 */
export default function KitAlignRail({
    label,
    count = null,
    max = null,
    variant = "default",
    over = false,
    children,
    end = null,
}) {
    const isLbReady = variant === "lb-ready";
    const isLbLocked = variant === "lb-locked";
    const isOver = Boolean(over);

    return (
        <Box
            sx={{
                height: 34,
                display: "flex",
                alignItems: "center",
                gap: "8px",
                px: "10px",
                borderRadius: "5px",
                border: `1px solid ${
                    isOver
                        ? "rgba(255,51,85,0.7)"
                        : isLbReady
                            ? "rgba(255,204,51,0.5)"
                            : isLbLocked
                                ? "rgba(255,51,85,0.55)"
                                : UI_COLORS.border
                }`,
                background: isOver
                    ? "rgba(255,51,85,0.12)"
                    : isLbReady
                        ? "rgba(255,204,51,0.1)"
                        : isLbLocked
                            ? "rgba(255,51,85,0.12)"
                            : "rgba(0,0,0,0.4)",
                boxShadow: isOver ? "0 0 12px rgba(255,51,85,0.2)" : "none",
                flexShrink: 0,
                position: "sticky",
                top: 0,
                zIndex: 3,
                backdropFilter: "blur(10px)",
            }}
        >
            <Box
                sx={{
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "0.42rem",
                    letterSpacing: "0.12em",
                    color: isLbReady ? "#e8c04a" : isLbLocked ? DANGER : MUTED,
                    whiteSpace: "nowrap",
                }}
            >
                {label}
                {count != null && (
                    <>
                        {" "}
                        <Box
                            component="strong"
                            sx={{
                                color: isOver ? DANGER : isLbReady ? LB : isLbLocked ? DANGER : CYAN,
                                fontWeight: 500,
                            }}
                        >
                            {max != null ? `${count}/${max}` : count}
                        </Box>
                    </>
                )}
            </Box>
            {isOver && (
                <Box sx={{
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "0.36rem",
                    letterSpacing: "0.12em",
                    color: DANGER,
                    flexShrink: 0,
                }}>
                    OVER
                </Box>
            )}
            {children}
            {end && (
                <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                    {end}
                </Box>
            )}
        </Box>
    );
}

export function RailAddSlot({ onClick, title = "Agregar" }) {
    return (
        <Box
            component="button"
            type="button"
            title={title}
            onClick={onClick}
            sx={{
                width: 22,
                height: 22,
                borderRadius: "3px",
                border: `1px dashed ${PINK}88`,
                bgcolor: "transparent",
                color: PINK,
                fontFamily: "Orbitron, sans-serif",
                fontSize: "0.72rem",
                lineHeight: 1,
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
                p: 0,
                "&:hover": { bgcolor: `${PINK}18`, borderStyle: "solid" },
            }}
        >
            +
        </Box>
    );
}

export function RailEditToggle({ on, onClick }) {
    return (
        <Box
            component="button"
            type="button"
            onClick={onClick}
            sx={{
                display: "inline-flex",
                alignItems: "center",
                px: "8px",
                py: "3px",
                border: `1px solid ${on ? CYAN : "rgba(255,102,255,0.35)"}`,
                background: on ? "rgba(0,242,234,0.12)" : "rgba(0,0,0,0.35)",
                color: on ? CYAN : "rgba(255,255,255,0.7)",
                fontFamily: "Orbitron, sans-serif",
                fontSize: "0.4rem",
                letterSpacing: "0.1em",
                cursor: "pointer",
                borderRadius: "3px",
                flexShrink: 0,
            }}
        >
            {on ? "EDIT ON" : "EDIT"}
        </Box>
    );
}

export function LoadoutPips({ count, max = 6 }) {
    const n = Math.max(max, count);
    return (
        <Box sx={{ display: "flex", gap: "3px", flexWrap: "nowrap" }}>
            {Array.from({ length: n }).map((_, i) => {
                const filled = i < count;
                const over = i >= max && filled;
                return (
                    <Box
                        key={i}
                        sx={{
                            width: 16,
                            height: 16,
                            borderRadius: "3px",
                            border: `1px solid ${over ? DANGER : filled ? CYAN : UI_COLORS.border}`,
                            bgcolor: over
                                ? "rgba(255,51,85,0.15)"
                                : filled
                                    ? "rgba(0,242,234,0.12)"
                                    : "rgba(0,0,0,0.35)",
                        }}
                    />
                );
            })}
        </Box>
    );
}
