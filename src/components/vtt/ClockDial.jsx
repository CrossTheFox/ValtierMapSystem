import { Box } from "@mui/material";
import { UI_COLORS } from "../../constants/uiColors";
import { formatFilledLabel } from "../../utils/clockResolver";
import { sizeTheme as defaultSizeTheme } from "../../utils/clockInstance";

const CX = 64;
const CY = 64;
const R = 54;
const INNER = 28;

function polar(angle, radius) {
    return [CX + Math.cos(angle) * radius, CY + Math.sin(angle) * radius];
}

function wedgePath(i, n) {
    const a0 = (-Math.PI / 2) + (i * 2 * Math.PI) / n;
    const a1 = (-Math.PI / 2) + ((i + 1) * 2 * Math.PI) / n;
    const [x0, y0] = polar(a0, R);
    const [x1, y1] = polar(a1, R);
    const [xi0, yi0] = polar(a0, INNER);
    const [xi1, yi1] = polar(a1, INNER);
    return `M ${xi0} ${yi0} L ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1} L ${xi1} ${yi1} A ${INNER} ${INNER} 0 0 0 ${xi0} ${yi0} Z`;
}

function halfWedgePath(i, n) {
    const a0 = (-Math.PI / 2) + (i * 2 * Math.PI) / n;
    const am = (-Math.PI / 2) + ((i + 0.5) * 2 * Math.PI) / n;
    const [x0, y0] = polar(a0, R);
    const [xm, ym] = polar(am, R);
    const [xi0, yi0] = polar(a0, INNER);
    const [xim, yim] = polar(am, INNER);
    return `M ${xi0} ${yi0} L ${x0} ${y0} A ${R} ${R} 0 0 1 ${xm} ${ym} L ${xim} ${yim} A ${INNER} ${INNER} 0 0 0 ${xi0} ${yi0} Z`;
}

function halfSegmentPath(i, n, halfIdx) {
    const a0 = (-Math.PI / 2) + (i * 2 * Math.PI) / n;
    const a1 = (-Math.PI / 2) + ((i + 1) * 2 * Math.PI) / n;
    const am = (-Math.PI / 2) + ((i + 0.5) * 2 * Math.PI) / n;
    const start = halfIdx === 0 ? a0 : am;
    const end = halfIdx === 0 ? am : a1;
    const [xs, ys] = polar(start, R);
    const [xe, ye] = polar(end, R);
    const [xis, yis] = polar(start, INNER);
    const [xie, yie] = polar(end, INNER);
    return `M ${xis} ${yis} L ${xs} ${ys} A ${R} ${R} 0 0 1 ${xe} ${ye} L ${xie} ${yie} A ${INNER} ${INNER} 0 0 0 ${xis} ${yis} Z`;
}

function dividerLine(i, n, halfIdx) {
    const angle = (-Math.PI / 2) + ((i + halfIdx * 0.5) * 2 * Math.PI) / n;
    const [x1, y1] = polar(angle, INNER);
    const [x2, y2] = polar(angle, R);
    return { x1, y1, x2, y2 };
}

function wedgeFillState(i, filledTicks) {
    const full = Math.floor(filledTicks);
    const half = filledTicks % 1 >= 0.5;
    if (i < full) return "full";
    if (i === full && half) return "half";
    return "empty";
}

/**
 * SVG clock dial — island (resolve center, wedges display-only) or zoom (jump-to-target).
 *
 * @param {{
 *   sizeTicks?: number,
 *   filledHalfSteps?: number,
 *   variant?: "island"|"zoom",
 *   allowResolve?: boolean,
 *   allowWedges?: boolean,
 *   onResolve?: () => void,
 *   onJumpToHalfSteps?: (n: number) => void,
 *   secret?: boolean,
 *   theme?: { hex: string, fill: string, stroke: string, off: string },
 *   ariaLabel?: string,
 *   showCenterLabel?: boolean,
 * }} props
 */
export default function ClockDial({
    sizeTicks = 4,
    filledHalfSteps = 0,
    variant = "island",
    allowResolve = false,
    allowWedges = false,
    onResolve,
    onJumpToHalfSteps,
    secret = false,
    theme: themeProp,
    ariaLabel,
    showCenterLabel = variant === "island",
}) {
    const n = sizeTicks === 6 || sizeTicks === 8 || sizeTicks === 12 ? sizeTicks : 4;
    const theme = themeProp || defaultSizeTheme(n);
    const filled = Math.max(0, Math.min(n * 2, Math.round(Number(filledHalfSteps) || 0)));
    const filledTicks = filled / 2;
    const segmented = variant === "zoom";
    const wedgesInteractive = allowWedges && typeof onJumpToHalfSteps === "function";
    const canRoll = allowResolve && typeof onResolve === "function";
    const label = formatFilledLabel(filled, n);
    const ring = secret ? UI_COLORS.accent : theme.stroke;
    const motion = "fill 0.18s ease, stroke 0.18s ease, filter 0.18s ease";

    const handleWedge = (target) => {
        if (!wedgesInteractive) return;
        if (target === filled) return;
        onJumpToHalfSteps(target);
    };

    return (
        <Box
            component="svg"
            viewBox="0 0 128 128"
            aria-label={ariaLabel || label}
            sx={{
                display: "block",
                width: "100%",
                height: "100%",
                "@media (prefers-reduced-motion: reduce)": {
                    "& path, & circle": { transition: "none !important" },
                },
            }}
        >
            {segmented ? (
                <>
                    {Array.from({ length: n }, (_, i) => (
                        <g key={`div-${i}`}>
                            <line
                                x1={dividerLine(i, n, 0).x1}
                                y1={dividerLine(i, n, 0).y1}
                                x2={dividerLine(i, n, 0).x2}
                                y2={dividerLine(i, n, 0).y2}
                                stroke="rgba(255,255,255,0.5)"
                                strokeWidth="1.5"
                                pointerEvents="none"
                            />
                            <line
                                x1={dividerLine(i, n, 1).x1}
                                y1={dividerLine(i, n, 1).y1}
                                x2={dividerLine(i, n, 1).x2}
                                y2={dividerLine(i, n, 1).y2}
                                stroke="rgba(255,255,255,0.22)"
                                strokeWidth="1"
                                strokeDasharray="3 2"
                                pointerEvents="none"
                            />
                        </g>
                    ))}
                    {Array.from({ length: n }, (_, i) => (
                        [0, 1].map((h) => {
                            const threshold = i * 2 + h + 1;
                            const on = filled >= threshold;
                            const isHalf = h === 0;
                            const fill = on
                                ? (isHalf ? theme.fill.replace(/0\.\d+\)/, "0.42)") : theme.fill)
                                : (isHalf ? "rgba(0,0,0,0.52)" : "rgba(0,0,0,0.38)");
                            const stroke = on
                                ? (isHalf ? theme.off : theme.stroke)
                                : (isHalf ? "rgba(255,255,255,0.12)" : theme.off);
                            return (
                                <path
                                    key={`${i}-${h}`}
                                    d={halfSegmentPath(i, n, h)}
                                    fill={fill}
                                    stroke={stroke}
                                    strokeWidth={isHalf ? 1 : 1.2}
                                    style={{
                                        cursor: wedgesInteractive ? "pointer" : "default",
                                        pointerEvents: wedgesInteractive ? "all" : "none",
                                        transition: motion,
                                    }}
                                    onClick={wedgesInteractive ? () => handleWedge(threshold) : undefined}
                                />
                            );
                        })
                    ))}
                </>
            ) : (
                Array.from({ length: n }, (_, i) => {
                    const state = wedgeFillState(i, filledTicks);
                    const pe = { pointerEvents: "none" };
                    if (state === "half") {
                        return (
                            <g key={i}>
                                <path
                                    d={wedgePath(i, n)}
                                    fill="rgba(0,0,0,0.45)"
                                    stroke={theme.off}
                                    strokeWidth="1.2"
                                    style={{ ...pe, transition: motion }}
                                />
                                <path
                                    d={halfWedgePath(i, n)}
                                    fill={theme.fill}
                                    stroke={theme.stroke}
                                    strokeWidth="1.2"
                                    style={{ ...pe, transition: motion }}
                                />
                            </g>
                        );
                    }
                    return (
                        <path
                            key={i}
                            d={wedgePath(i, n)}
                            fill={state === "full" ? theme.fill : "rgba(0,0,0,0.45)"}
                            stroke={state === "full" ? theme.stroke : theme.off}
                            strokeWidth="1.2"
                            style={{ ...pe, transition: motion }}
                        />
                    );
                })
            )}

            <circle
                cx={CX}
                cy={CY}
                r="24"
                fill="#0a0a14"
                stroke={ring}
                strokeWidth="1.8"
                strokeDasharray={secret ? "3 3" : undefined}
                style={{
                    cursor: canRoll ? "pointer" : "default",
                    transition: motion,
                }}
                onClick={canRoll ? (e) => {
                    e.stopPropagation();
                    onResolve(e);
                } : undefined}
            />
            {showCenterLabel && (
                <text
                    x={CX}
                    y={CY + 5}
                    textAnchor="middle"
                    fill={UI_COLORS.textPrimary}
                    style={{
                        fontFamily: "Orbitron, sans-serif",
                        fontSize: "11px",
                        fontVariantNumeric: "tabular-nums",
                        pointerEvents: "none",
                    }}
                >
                    {label}
                </text>
            )}
        </Box>
    );
}
