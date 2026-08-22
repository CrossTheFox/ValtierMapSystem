import { useMemo } from "react";
import { Box } from "@mui/material";
import { CyberText } from "../customs/CustomTexts";
import CyberTooltip from "../customs/CyberTooltip";
import { UI_COLORS } from "../../constants/uiColors";
import { usePersistedCharacterVitals } from "../../hooks/usePersistedCharacterVitals";
import { resolveCharacterHpMax, resolveCharacterVit, resolveHpBrokenAfterChange } from "../../utils/characterVitals";

/**
 * Compact HP bar for character sheet header — reads/writes character.hpCur.
 */
export default function SheetHpHud({ character }) {
    const hpMax = resolveCharacterHpMax(character);
    const vit = resolveCharacterVit(character);
    const effortMax = 3;
    const { vitals, persistVitals } = usePersistedCharacterVitals(character, { effortMax });

    const hpCur = useMemo(() => {
        if (!vitals) return hpMax;
        return Math.min(Math.max(vitals.hpCur, 0), hpMax);
    }, [vitals, hpMax]);

    if (!character?.id || hpMax <= 0) return null;

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
                        const nextHp = Math.round(ratio * hpMax);
                        persistVitals({
                            hpCur: nextHp,
                            hpBroken: resolveHpBrokenAfterChange(vitals?.hpBroken ?? false, hpCur, nextHp),
                        });
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
