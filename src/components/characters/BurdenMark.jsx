import { Box } from "@mui/material";
import { UI_COLORS } from "../../constants/uiColors";

/** @deprecated Prefer UI_COLORS.danger */
export const BURDEN_RED = UI_COLORS.danger || "#ff3355";

/**
 * Hanging weight / load glyph — reads as Burden (not ICON Break).
 * Angular, square-friendly, matches cyber HUD micro-controls.
 */
function BurdenWeightGlyph({ size, filled }) {
    const stroke = filled ? "#ffffff" : BURDEN_RED;
    const fill = filled ? BURDEN_RED : "none";
    const fillSoft = filled ? "rgba(255,51,85,0.55)" : "none";
    return (
        <Box
            component="svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            aria-hidden
            sx={{ display: "block", overflow: "visible" }}
        >
            {/* Suspension ring */}
            <rect
                x="10"
                y="2.5"
                width="4"
                height="3.5"
                rx="0.4"
                fill={fill}
                stroke={stroke}
                strokeWidth={1.4}
            />
            {/* Bail / link */}
            <path
                d="M12 6 L12 8.5"
                fill="none"
                stroke={stroke}
                strokeWidth={1.6}
                strokeLinecap="square"
            />
            {/* Weight body — trapezoid block */}
            <path
                d="M6.5 9.2 H17.5 L16.2 20.5 H7.8 Z"
                fill={fillSoft}
                stroke={stroke}
                strokeWidth={1.55}
                strokeLinejoin="miter"
            />
            {/* Center groove (mass cue) */}
            <path
                d="M12 10.2 L12 18.8"
                fill="none"
                stroke={stroke}
                strokeWidth={1.25}
                strokeLinecap="square"
                opacity={filled ? 0.9 : 0.75}
            />
            {/* Side notches */}
            <path
                d="M8.2 12.4 H10.1 M13.9 12.4 H15.8 M8.6 15.6 H10.3 M13.7 15.6 H15.4"
                fill="none"
                stroke={stroke}
                strokeWidth={1.15}
                strokeLinecap="square"
                opacity={0.85}
            />
        </Box>
    );
}

/**
 * Burden mark — hanging weight / load (peril).
 * Shared by dossier rail and combat HUD.
 */
export default function BurdenMark({
    filled = false,
    active = false,
    size = 28,
    clockFilled = null,
    clockSize = null,
    component = "div",
    showClock = true,
    sx = {},
    ...rest
}) {
    const glyph = Math.max(12, Math.round(size * 0.78));
    const showBadge = showClock
        && filled
        && clockSize != null
        && Number.isFinite(Number(clockFilled));
    const isBtn = component === "button";

    return (
        <Box
            component={component}
            type={isBtn ? "button" : undefined}
            aria-hidden={rest["aria-label"] ? undefined : true}
            sx={{
                width: size,
                height: size,
                borderRadius: "2px",
                p: 0,
                m: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: isBtn ? "pointer" : "default",
                position: "relative",
                flexShrink: 0,
                overflow: "visible",
                border: `1px solid ${BURDEN_RED}`,
                bgcolor: filled ? "rgba(255,51,85,0.18)" : "transparent",
                boxShadow: active
                    ? `0 0 10px rgba(255,51,85,0.55)`
                    : filled
                        ? `0 0 6px rgba(255,51,85,0.35)`
                        : "none",
                transition: "box-shadow 0.15s, background-color 0.15s",
                "&:hover": isBtn ? {
                    bgcolor: "rgba(255,51,85,0.22)",
                    boxShadow: `0 0 8px rgba(255,51,85,0.45)`,
                } : undefined,
                ...sx,
            }}
            {...rest}
        >
            <BurdenWeightGlyph size={glyph} filled={filled} />
            {showBadge && (
                <Box
                    component="span"
                    sx={{
                        position: "absolute",
                        bottom: -6,
                        left: "50%",
                        transform: "translateX(-50%)",
                        fontFamily: "Fira Code, monospace",
                        fontSize: size <= 20 ? "0.38rem" : "0.45rem",
                        color: "#ffffff",
                        bgcolor: "#0a0a14",
                        px: "3px",
                        borderRadius: "2px",
                        border: `1px solid ${BURDEN_RED}88`,
                        lineHeight: 1.2,
                        whiteSpace: "nowrap",
                        pointerEvents: "none",
                    }}
                >
                    {Number(clockFilled)}/{Number(clockSize)}
                </Box>
            )}
        </Box>
    );
}
