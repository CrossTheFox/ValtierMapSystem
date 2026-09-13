import { Box } from "@mui/material";
import { UI_COLORS } from "../../constants/uiColors";
import ClockDial from "../vtt/ClockDial";
import { CLOCK_SIZES, normalizeClockSize, sizeTheme } from "../../utils/clockInstance";

/**
 * Burden clock — ClockDial wrapper (half-steps). `filled` is ticks (may be 2.5).
 *
 * @param {{
 *   size?: number,
 *   filled?: number,
 *   onChangeFilled?: (ticks: number) => void,
 *   onChangeSize?: (n: 4|6|8|12) => void,
 *   editable?: boolean,
 * }} props
 */
export default function BurdenClock({
    size = 4,
    filled = 0,
    onChangeFilled,
    onChangeSize,
    editable = true,
}) {
    const n = normalizeClockSize(size);
    const filledHalfSteps = Math.round((Number(filled) || 0) * 2);
    const theme = sizeTheme(n);
    const canEdit = Boolean(editable && onChangeFilled);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
            {editable && typeof onChangeSize === "function" && (
                <Box sx={{ display: "flex", gap: 0.75 }}>
                    {CLOCK_SIZES.map((s) => (
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
                                border: `1px solid ${s === n ? UI_COLORS.danger : UI_COLORS.border}`,
                                bgcolor: s === n ? "rgba(255,51,85,0.22)" : "rgba(0,0,0,0.35)",
                                color: "#ffffff",
                                "&:hover": { borderColor: UI_COLORS.danger },
                            }}
                        >
                            {s}
                        </Box>
                    ))}
                </Box>
            )}
            <Box sx={{ width: 120, height: 120 }}>
                <ClockDial
                    variant={canEdit ? "zoom" : "island"}
                    sizeTicks={n}
                    filledHalfSteps={filledHalfSteps}
                    allowWedges={canEdit}
                    allowResolve={false}
                    theme={theme}
                    showCenterLabel
                    onJumpToHalfSteps={canEdit ? (h) => onChangeFilled(h / 2) : undefined}
                    ariaLabel={`Clock ${filled}/${n}`}
                />
            </Box>
        </Box>
    );
}
