import { useState } from "react";
import { Box, Popover } from "@mui/material";
import { CyberText, CyberTitle } from "../customs/CustomTexts";
import { hudPopoverPaperSx, TYPO } from "../../constants/designSystem";
import { UI_COLORS } from "../../constants/uiColors";
import { CLOCK_RESOLVE_MODES } from "../../utils/clockInstance";

function Chip({ on, color = UI_COLORS.accent, onClick, children }) {
    return (
        <Box
            component="button"
            type="button"
            onClick={onClick}
            sx={{
                height: 26,
                px: 0.9,
                border: `1px solid ${on ? color : UI_COLORS.border}`,
                borderRadius: "3px",
                bgcolor: on ? `${color}22` : "rgba(0,0,0,0.35)",
                color: on ? color : UI_COLORS.textSecondary,
                fontFamily: TYPO.mono,
                fontSize: "8px",
                letterSpacing: "0.08em",
                cursor: "pointer",
                textTransform: "uppercase",
            }}
        >
            {children}
        </Box>
    );
}

function ResolveBody({ clock, actionDefs, onConfirm }) {
    const isActions = clock.resolveMode === CLOCK_RESOLVE_MODES.ACTIONS;
    const maxDice = Math.max(1, Math.min(6, Number(clock.diceCount) || 2));
    const [diceCount, setDiceCount] = useState(maxDice);
    const [actionId, setActionId] = useState(clock.actionIds?.[0] || null);
    const [preview, setPreview] = useState(null);
    const allowedActions = actionDefs.filter((a) => (clock.actionIds || []).includes(a.key || a.id));

    return (
        <>
            <CyberTitle sx={{ fontSize: "9px", letterSpacing: "0.12em", color: UI_COLORS.anomaly, mb: 1 }}>
                RESOLVER · {clock.name}
            </CyberTitle>

            {isActions ? (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1 }}>
                    {allowedActions.length === 0 && (
                        <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.textSecondary }}>
                            Sin Actions vinculadas
                        </CyberText>
                    )}
                    {allowedActions.map((a) => {
                        const id = a.key || a.id;
                        return (
                            <Chip
                                key={id}
                                on={actionId === id}
                                color="#ffb020"
                                onClick={() => setActionId(id)}
                            >
                                {a.label || a.name || id}
                            </Chip>
                        );
                    })}
                </Box>
            ) : (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1 }}>
                    {Array.from({ length: maxDice }, (_, i) => {
                        const n = i + 1;
                        return (
                            <Chip key={n} on={diceCount === n} color={UI_COLORS.anomaly} onClick={() => setDiceCount(n)}>
                                {n}
                            </Chip>
                        );
                    })}
                </Box>
            )}

            {preview && (
                <Box sx={{ display: "flex", gap: 0.5, mb: 1, flexWrap: "wrap" }}>
                    {preview.dice.map((d, i) => (
                        <Box
                            key={`${d}-${i}`}
                            sx={{
                                width: 22,
                                height: 22,
                                display: "grid",
                                placeItems: "center",
                                border: `1px solid ${d === 6 ? UI_COLORS.danger : d >= 4 ? UI_COLORS.anomaly : UI_COLORS.border}`,
                                color: d === 6 ? UI_COLORS.danger : UI_COLORS.textPrimary,
                                fontFamily: "Orbitron, sans-serif",
                                fontSize: "11px",
                            }}
                        >
                            {d}
                        </Box>
                    ))}
                </Box>
            )}
            {preview?.breakdown && (
                <CyberText sx={{ fontSize: "0.62rem", color: UI_COLORS.textSecondary, mb: 1, fontFamily: TYPO.mono }}>
                    {preview.breakdown}
                </CyberText>
            )}

            <Box
                component="button"
                type="button"
                onClick={() => {
                    const payload = isActions
                        ? { kind: "actions", actionId, diceCount }
                        : { kind: "generic", diceCount };
                    onConfirm?.(payload, setPreview);
                }}
                sx={{
                    width: "100%",
                    height: 28,
                    border: `1px solid ${UI_COLORS.anomaly}`,
                    borderRadius: "3px",
                    bgcolor: `${UI_COLORS.anomaly}14`,
                    color: UI_COLORS.anomaly,
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "8px",
                    letterSpacing: "0.12em",
                    cursor: "pointer",
                }}
            >
                TIRAR
            </Box>
        </>
    );
}

/**
 * Nd6 / Actions resolve popover — island center click.
 */
export default function SessionClockResolvePopover({
    open,
    anchorEl,
    onClose,
    clock,
    actionDefs = [],
    onConfirm,
}) {
    return (
        <Popover
            open={open}
            anchorEl={anchorEl}
            onClose={onClose}
            anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            transformOrigin={{ vertical: "top", horizontal: "center" }}
            PaperProps={{ sx: { ...hudPopoverPaperSx, p: 1.25, minWidth: 220 } }}
        >
            {clock ? (
                <ResolveBody
                    key={clock.id}
                    clock={clock}
                    actionDefs={actionDefs}
                    onConfirm={onConfirm}
                />
            ) : null}
        </Popover>
    );
}
