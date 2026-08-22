import { useEffect, useMemo, useState } from "react";
import { Box, Popover } from "@mui/material";
import { CyberText, CyberTitle } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { TYPO, hudPopoverPaperSx } from "../../constants/designSystem";
import { describeActionDicePool } from "../../utils/actionDiceRoll";

/** Single exclusive mod: 0 | +1 | +2 | −1 | −2 */
const MOD_OPTS = [
    { key: "b1", delta: 1, label: "+1" },
    { key: "b2", delta: 2, label: "+2" },
    { key: "c1", delta: -1, label: "−1" },
    { key: "c2", delta: -2, label: "−2" },
];

/**
 * Minimal glass popover for ICON action rolls.
 * One exclusive Boon/Curse pick · one-line pool · primary TIRAR (click-outside closes).
 */
export default function StatRollPopover({
    anchorEl,
    open,
    onClose,
    statDef,
    statValue = 0,
    busy = false,
    onConfirm,
}) {
    /** 0 = none, positive = boons, negative = curses */
    const [delta, setDelta] = useState(0);

    useEffect(() => {
        if (!open) return;
        setDelta(0);
    }, [open, statDef?.key]);

    const boons = delta > 0 ? delta : 0;
    const curses = delta < 0 ? -delta : 0;

    const preview = useMemo(
        () => describeActionDicePool(statValue, { boons, curses }),
        [statValue, boons, curses],
    );

    const label = statDef?.label || statDef?.key || "Stat";
    const base = Math.max(0, Math.floor(Number(statValue) || 0));

    const toggleDelta = (next) => {
        setDelta((prev) => (prev === next ? 0 : next));
    };

    const handleRoll = () => {
        if (busy) return;
        onConfirm?.({ boons, curses });
    };

    const onKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleRoll();
        }
        if (e.key === "Escape") {
            e.preventDefault();
            if (!busy) onClose?.();
        }
    };

    return (
        <Popover
            open={Boolean(open && anchorEl)}
            anchorEl={anchorEl}
            onClose={busy ? undefined : onClose}
            anchorOrigin={{ vertical: "top", horizontal: "center" }}
            transformOrigin={{ vertical: "bottom", horizontal: "center" }}
            slotProps={{
                paper: {
                    sx: {
                        ...hudPopoverPaperSx,
                        width: 200,
                        p: "10px 12px",
                        mt: -0.5,
                        boxShadow: "0 0 14px rgba(0,0,0,0.45)",
                    },
                    onKeyDown,
                },
            }}
        >
            {/* Title + live pool */}
            <Box
                sx={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 1,
                    mb: 1,
                }}
            >
                <CyberTitle
                    sx={{
                        fontSize: "0.68rem",
                        letterSpacing: "0.1em",
                        color: UI_COLORS.textPrimary,
                        lineHeight: 1.15,
                    }}
                >
                    {String(label).toUpperCase()}
                </CyberTitle>
                <CyberText
                    sx={{
                        fontFamily: TYPO.mono,
                        fontSize: "0.58rem",
                        color: preview.isLowest ? UI_COLORS.danger : UI_COLORS.anomaly,
                        letterSpacing: "0.02em",
                        flexShrink: 0,
                        whiteSpace: "nowrap",
                    }}
                >
                    {base}
                    {delta !== 0 ? (delta > 0 ? `+${delta}` : String(delta)) : ""}
                    {" · "}
                    {preview.isLowest ? "2d6↓" : `${preview.net}d6↑`}
                </CyberText>
            </Box>

            {/* Boon / Curse — one row, tap again to clear */}
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr auto 1fr 1fr",
                    alignItems: "center",
                    gap: "4px",
                    mb: 1,
                }}
                role="group"
                aria-label="Boon o Curse"
            >
                {MOD_OPTS.slice(0, 2).map((opt) => (
                    <ModChip
                        key={opt.key}
                        label={opt.label}
                        active={delta === opt.delta}
                        accent={UI_COLORS.boon}
                        onClick={() => toggleDelta(opt.delta)}
                    />
                ))}
                <CyberText
                    sx={{
                        fontFamily: TYPO.mono,
                        fontSize: "0.45rem",
                        color: UI_COLORS.textSecondary,
                        textAlign: "center",
                        px: 0.15,
                        userSelect: "none",
                    }}
                >
                    /
                </CyberText>
                {MOD_OPTS.slice(2).map((opt) => (
                    <ModChip
                        key={opt.key}
                        label={opt.label}
                        active={delta === opt.delta}
                        accent={UI_COLORS.danger}
                        onClick={() => toggleDelta(opt.delta)}
                    />
                ))}
            </Box>

            <Box
                component="button"
                type="button"
                onClick={handleRoll}
                disabled={busy}
                autoFocus
                sx={{
                    width: "100%",
                    py: 0.65,
                    borderRadius: "3px",
                    border: `1px solid ${UI_COLORS.accent}`,
                    bgcolor: `${UI_COLORS.accent}18`,
                    color: UI_COLORS.textPrimary,
                    fontFamily: TYPO.title,
                    fontSize: "0.55rem",
                    letterSpacing: "0.14em",
                    cursor: busy ? "default" : "pointer",
                    opacity: busy ? 0.55 : 1,
                    transition: "background-color 0.15s, border-color 0.15s",
                    "&:hover": busy ? {} : { bgcolor: `${UI_COLORS.accent}28` },
                    "&:focus-visible": {
                        outline: `1px solid ${UI_COLORS.anomaly}`,
                        outlineOffset: 2,
                    },
                }}
            >
                {busy ? "…" : "TIRAR"}
            </Box>
        </Popover>
    );
}

function ModChip({ label, active, accent, onClick }) {
    return (
        <Box
            component="button"
            type="button"
            onClick={onClick}
            aria-pressed={active}
            sx={{
                py: 0.45,
                px: 0,
                minWidth: 0,
                borderRadius: "3px",
                border: `1px solid ${active ? accent : UI_COLORS.border}`,
                bgcolor: active ? `${accent}20` : "transparent",
                color: active ? UI_COLORS.textPrimary : UI_COLORS.textSecondary,
                fontFamily: TYPO.mono,
                fontSize: "0.68rem",
                lineHeight: 1.2,
                cursor: "pointer",
                transition: "border-color 0.12s, background-color 0.12s, color 0.12s",
                "&:hover": {
                    borderColor: accent,
                    color: UI_COLORS.textPrimary,
                },
            }}
        >
            {label}
        </Box>
    );
}
