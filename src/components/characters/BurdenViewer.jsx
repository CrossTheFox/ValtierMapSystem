import { Box } from "@mui/material";
import { UI_COLORS } from "../../constants/uiColors";
import {
    formatBurdenEffectSummary,
    listActiveBurdens,
    normalizeBurdens,
} from "../../utils/characterBurdens";
import BurdenClock from "./BurdenClock";
import BurdenMark from "./BurdenMark";

const C = {
    border: UI_COLORS.border,
    danger: UI_COLORS.danger || "#ff3355",
    cyan: UI_COLORS.anomaly,
    text: UI_COLORS.textPrimary,
    muted: UI_COLORS.textSecondary,
};

/**
 * Read-only list of burdens + create CTA. Shown in dossier left column.
 */
export default function BurdenViewer({
    burdens,
    editMode = false,
    effectLabelFor,
    onSelectIndex,
    onCreate,
}) {
    const slots = normalizeBurdens(burdens);
    const active = listActiveBurdens(burdens);
    const freeIndex = slots.findIndex((b) => !b);
    const canCreate = editMode && freeIndex >= 0;

    return (
        <Box sx={{
            width: "100%",
            maxWidth: 280,
            display: "flex",
            flexDirection: "column",
            gap: 1,
        }}>
            <Box sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                mb: 0.25,
            }}>
                <BurdenMark filled={active.length > 0} size={22} showClock={false} />
                <Box sx={{
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "0.58rem",
                    letterSpacing: "0.12em",
                    color: C.danger,
                    flex: 1,
                }}>
                    BURDENS · {active.length}/3
                </Box>
            </Box>

            {active.length === 0 && (
                <Box sx={{
                    py: 2,
                    px: 1,
                    textAlign: "center",
                    border: `1px dashed ${C.border}`,
                    borderRadius: "6px",
                    bgcolor: "rgba(0,0,0,0.28)",
                }}>
                    <Box sx={{
                        fontFamily: "'Fira Sans', sans-serif",
                        fontSize: "0.78rem",
                        color: C.muted,
                        mb: canCreate ? 1.25 : 0,
                    }}>
                        Sin burdens activos
                    </Box>
                    {canCreate && (
                        <Box
                            component="button"
                            type="button"
                            onClick={() => onCreate?.(freeIndex)}
                            sx={{
                                fontFamily: "Orbitron, sans-serif",
                                fontSize: "0.55rem",
                                letterSpacing: "0.1em",
                                color: C.danger,
                                border: `1px solid ${C.danger}88`,
                                bgcolor: `${C.danger}14`,
                                borderRadius: "3px",
                                px: 1.25,
                                py: 0.6,
                                cursor: "pointer",
                                "&:hover": { bgcolor: `${C.danger}28` },
                            }}
                        >
                            + CREAR BURDEN
                        </Box>
                    )}
                </Box>
            )}

            {slots.map((b, i) => {
                if (!b) return null;
                const title = (b.title || "").trim() || `BURDEN 0${i + 1}`;
                const effectLine = formatBurdenEffectSummary(
                    b.effect,
                    { targetLabel: effectLabelFor?.(b.effect) || "" },
                );
                return (
                    <Box
                        key={b.id || i}
                        component="button"
                        type="button"
                        onClick={() => onSelectIndex?.(i)}
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "stretch",
                            gap: 0.75,
                            width: "100%",
                            textAlign: "left",
                            p: "10px 10px",
                            borderRadius: "6px",
                            border: `1px solid rgba(255,51,85,0.4)`,
                            bgcolor: "rgba(0,0,0,0.35)",
                            cursor: "pointer",
                            color: C.text,
                            "&:hover": {
                                borderColor: C.danger,
                                bgcolor: `${C.danger}12`,
                            },
                        }}
                    >
                        <Box sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.75,
                        }}>
                            <Box sx={{
                                fontFamily: "Orbitron, sans-serif",
                                fontSize: "0.62rem",
                                letterSpacing: "0.08em",
                                color: "#ffffff",
                                flex: 1,
                                minWidth: 0,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}>
                                {title.toUpperCase()}
                            </Box>
                            <Box sx={{
                                fontFamily: "'Fira Code', monospace",
                                fontSize: "0.5rem",
                                color: C.danger,
                                flexShrink: 0,
                            }}>
                                {b.clockFilled}/{b.clockSize}
                            </Box>
                        </Box>
                        <BurdenClock
                            size={b.clockSize}
                            filled={b.clockFilled}
                            editable={false}
                        />
                        {effectLine ? (
                            <Box sx={{
                                display: "inline-flex",
                                alignSelf: "flex-start",
                                px: 0.75,
                                py: 0.35,
                                borderRadius: "2px",
                                border: `1px solid rgba(255,51,85,0.45)`,
                                bgcolor: `${C.danger}14`,
                                fontFamily: "'Fira Code', monospace",
                                fontSize: "0.5rem",
                                letterSpacing: "0.04em",
                                color: C.danger,
                            }}>
                                {effectLine}
                            </Box>
                        ) : (
                            <Box sx={{
                                fontFamily: "'Fira Sans', sans-serif",
                                fontSize: "0.7rem",
                                color: C.muted,
                            }}>
                                Sin efecto mecánico
                            </Box>
                        )}
                        {(b.text || b.consequence) ? (
                            <Box sx={{
                                fontFamily: "'Fira Sans', sans-serif",
                                fontSize: "0.72rem",
                                color: "rgba(255,255,255,0.72)",
                                lineHeight: 1.35,
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                            }}>
                                {(b.consequence || b.text || "").trim()}
                            </Box>
                        ) : null}
                    </Box>
                );
            })}

            {active.length > 0 && canCreate && (
                <Box
                    component="button"
                    type="button"
                    onClick={() => onCreate?.(freeIndex)}
                    sx={{
                        fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.52rem",
                        letterSpacing: "0.1em",
                        color: C.cyan,
                        border: `1px dashed ${C.border}`,
                        bgcolor: "transparent",
                        borderRadius: "4px",
                        py: 0.75,
                        cursor: "pointer",
                        "&:hover": { borderColor: C.cyan, color: C.cyan },
                    }}
                >
                    + AÑADIR BURDEN
                </Box>
            )}
        </Box>
    );
}
