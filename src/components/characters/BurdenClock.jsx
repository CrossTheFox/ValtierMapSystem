import { Box } from "@mui/material";
import { UI_COLORS } from "../../constants/uiColors";

const DANGER = "#ff3355";
const SIZES = [4, 6, 8];

/**
 * Circular clock with clickable wedges (4 / 6 / 8 ticks).
 * @param {{ size: 4|6|8, filled: number, onChangeFilled?: (n: number) => void, onChangeSize?: (n: 4|6|8) => void, editable?: boolean }} props
 */
export default function BurdenClock({
    size = 4,
    filled = 0,
    onChangeFilled,
    onChangeSize,
    editable = true,
}) {
    const n = size === 6 || size === 8 ? size : 4;
    const fill = Math.max(0, Math.min(n, Number(filled) || 0));
    const R = 54;
    const cx = 64;
    const cy = 64;
    const inner = 18;

    const wedgePath = (i) => {
        const a0 = (-Math.PI / 2) + (i * 2 * Math.PI) / n;
        const a1 = (-Math.PI / 2) + ((i + 1) * 2 * Math.PI) / n;
        const x0 = cx + Math.cos(a0) * R;
        const y0 = cy + Math.sin(a0) * R;
        const x1 = cx + Math.cos(a1) * R;
        const y1 = cy + Math.sin(a1) * R;
        const xi0 = cx + Math.cos(a0) * inner;
        const yi0 = cy + Math.sin(a0) * inner;
        const xi1 = cx + Math.cos(a1) * inner;
        const yi1 = cy + Math.sin(a1) * inner;
        const large = 0;
        return [
            `M ${xi0} ${yi0}`,
            `L ${x0} ${y0}`,
            `A ${R} ${R} 0 ${large} 1 ${x1} ${y1}`,
            `L ${xi1} ${yi1}`,
            `A ${inner} ${inner} 0 ${large} 0 ${xi0} ${yi0}`,
            "Z",
        ].join(" ");
    };

    return (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
            {editable && typeof onChangeSize === "function" && (
                <Box sx={{ display: "flex", gap: 0.75 }}>
                    {SIZES.map((s) => (
                        <Box
                            key={s}
                            component="button"
                            type="button"
                            onClick={() => onChangeSize(s)}
                            sx={{
                                fontFamily: "Orbitron, sans-serif",
                                fontSize: "0.55rem",
                                letterSpacing: "0.08em",
                                px: 1,
                                py: 0.35,
                                borderRadius: "4px",
                                cursor: "pointer",
                                border: `1px solid ${s === n ? DANGER : UI_COLORS.border}`,
                                bgcolor: s === n ? "rgba(255,51,85,0.22)" : "rgba(0,0,0,0.35)",
                                color: "#ffffff",
                                "&:hover": { borderColor: DANGER },
                            }}
                        >
                            {s}
                        </Box>
                    ))}
                </Box>
            )}
            <Box
                component="svg"
                viewBox="0 0 128 128"
                sx={{ width: 120, height: 120, display: "block" }}
                aria-label={`Clock ${fill}/${n}`}
            >
                {Array.from({ length: n }, (_, i) => {
                    const on = i < fill;
                    return (
                        <path
                            key={i}
                            d={wedgePath(i)}
                            fill={on ? DANGER : "rgba(0,0,0,0.45)"}
                            stroke={on ? "#ff8899" : "rgba(255,51,85,0.45)"}
                            strokeWidth="1.2"
                            style={{ cursor: editable ? "pointer" : "default" }}
                            onClick={editable && onChangeFilled ? () => {
                                // Toggle: click filled last → unfill to i; else fill to i+1
                                const next = i < fill && i === fill - 1 ? i : i + 1;
                                onChangeFilled(next);
                            } : undefined}
                        />
                    );
                })}
                <circle cx={cx} cy={cy} r={inner - 2} fill="#0a0a14" stroke={DANGER} strokeWidth="1.5" />
                <text
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#ffffff"
                    style={{ fontFamily: "Orbitron, sans-serif", fontSize: "11px", letterSpacing: "0.06em" }}
                >
                    {fill}/{n}
                </text>
            </Box>
        </Box>
    );
}
