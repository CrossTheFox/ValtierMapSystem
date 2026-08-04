import { useMemo } from "react";
import { Box } from "@mui/material";

import { UI_COLORS } from "../../constants/uiColors";
import { CHARACTER_SHEET_TOKENS } from "../../constants/characterSheetTokens";

const CX = 200;
const CY = 200;
const R = 160;

function polar(angle, radius) {
    const a = ((angle - 90) * Math.PI) / 180;
    return { x: CX + radius * Math.cos(a), y: CY + radius * Math.sin(a) };
}

export default function StatRadarChart({ statDefinitions = [], stats = {}, maxStat = 4 }) {
    const data = useMemo(
        () =>
            statDefinitions.map((s) => ({
                key: s.key,
                label: (s.label || s.key).toUpperCase(),
                val: Math.min(Math.max(stats[s.key] ?? 0, 0), maxStat),
            })),
        [statDefinitions, stats, maxStat]
    );

    if (!data.length) return null;

    const n = data.length;
    const step = 360 / n;

    const rings = [];
    for (let r = 1; r <= maxStat; r++) {
        const pts = data.map((_, i) => {
            const p = polar(i * step, (r / maxStat) * R);
            return `${p.x},${p.y}`;
        }).join(" ");
        rings.push(
            <polygon
                key={`ring-${r}`}
                points={pts}
                fill="none"
                stroke={r === maxStat ? "#3a3a52" : UI_COLORS.border}
                strokeWidth={r === maxStat ? 1.5 : 1}
            />
        );
    }

    const axes = data.map((_, i) => {
        const pInner = polar(i * step, R);
        return (
            <line
                key={`axis-${i}`}
                x1={CX}
                y1={CY}
                x2={pInner.x}
                y2={pInner.y}
                stroke={UI_COLORS.border}
                strokeWidth={1}
                opacity={0.6}
            />
        );
    });

    const labels = data.map((s, i) => {
        const p = polar(i * step, R + 22);
        return (
            <text
                key={`lbl-${s.key}`}
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={UI_COLORS.textSecondary}
                fontFamily="Fira Code, monospace"
                fontSize={10}
            >
                {s.label}
            </text>
        );
    });

    const polyPts = data
        .map((s, i) => {
            const p = polar(i * step, (s.val / maxStat) * R);
            return `${p.x},${p.y}`;
        })
        .join(" ");

    const dots = data.map((s, i) => {
        const p = polar(i * step, (s.val / maxStat) * R);
        return <circle key={`dot-${s.key}`} cx={p.x} cy={p.y} r={4} fill={UI_COLORS.accent} stroke="#fff" strokeWidth={1} />;
    });

    return (
        <Box sx={{ flexShrink: 0, width: CHARACTER_SHEET_TOKENS.radarSize, position: "relative" }}>
            <Box component="svg" viewBox="0 0 400 400" sx={{ width: "100%", height: "auto", display: "block" }}>
                <defs>
                    <linearGradient id="radarGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={UI_COLORS.accent} stopOpacity={0.55} />
                        <stop offset="100%" stopColor={UI_COLORS.anomaly} stopOpacity={0.35} />
                    </linearGradient>
                </defs>
                <g>{rings}</g>
                <g>{axes}</g>
                <polygon points={polyPts} fill="url(#radarGrad)" stroke={UI_COLORS.accent} strokeWidth={1.5} opacity={0.85} />
                <g>{labels}</g>
                <g>{dots}</g>
            </Box>
        </Box>
    );
}
