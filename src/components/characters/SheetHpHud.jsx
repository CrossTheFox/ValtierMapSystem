import { useMemo } from "react";
import { Box } from "@mui/material";
import { CyberText } from "../customs/CustomTexts";
import CyberTooltip from "../customs/CyberTooltip";
import { UI_COLORS } from "../../constants/uiColors";
import { useCharacterSessionPools } from "../../hooks/useCharacterSessionPools";
import { resolveHpMax, resolveVit } from "../../utils/characterCombat";

/**
 * Compact HP bar for character sheet header (session pool).
 */
export default function SheetHpHud({ character }) {
    const vit = resolveVit(character);
    const hpMax = resolveHpMax(character);
    const tracks = useMemo(
        () => [{ key: "hp", label: "HP", maxDefault: hpMax, defaultFull: true }],
        [hpMax]
    );
    const { pools, setTrack } = useCharacterSessionPools(character?.id, tracks);

    if (!character?.id || hpMax <= 0) return null;

    const hpCur = Math.min(Math.max(pools.hp?.current ?? hpMax, 0), hpMax);
    const hpPct = (hpCur / hpMax) * 100;
    const barColor = hpPct <= 25 ? "#ff3355" : hpPct <= 50 ? "#f97316" : UI_COLORS.anomaly;

    return (
        <CyberTooltip title={`HP ${hpCur}/${hpMax} · VIT ${vit}`} placement="bottom">
            <Box
                className="dialog-no-drag"
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.6,
                    minWidth: 88,
                    maxWidth: 120,
                }}
            >
                <CyberText
                    sx={{
                        fontFamily: "monospace",
                        fontSize: "0.48rem",
                        letterSpacing: "0.08em",
                        color: UI_COLORS.textSecondary,
                        flexShrink: 0,
                    }}
                >
                    HP
                </CyberText>
                <Box
                    sx={{
                        flex: 1,
                        height: 8,
                        borderRadius: 0.5,
                        bgcolor: "rgba(255,255,255,0.06)",
                        overflow: "hidden",
                        cursor: "pointer",
                        border: `1px solid ${UI_COLORS.border}`,
                    }}
                    onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
                        setTrack("hp", { current: Math.round(ratio * hpMax) });
                    }}
                >
                    <Box
                        sx={{
                            height: "100%",
                            width: `${hpPct}%`,
                            bgcolor: barColor,
                            boxShadow: `0 0 6px ${barColor}55`,
                            transition: "width 0.15s, background-color 0.15s",
                        }}
                    />
                </Box>
                <CyberText
                    sx={{
                        fontFamily: "monospace",
                        fontSize: "0.55rem",
                        color: barColor,
                        flexShrink: 0,
                        minWidth: 28,
                        textAlign: "right",
                    }}
                >
                    {hpCur}/{hpMax}
                </CyberText>
            </Box>
        </CyberTooltip>
    );
}
