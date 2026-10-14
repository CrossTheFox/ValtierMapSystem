import { Box } from "@mui/material";
import { CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import {
    WIKI_RELATION_STRENGTH_MAX,
    WIKI_RELATION_STRENGTH_MIN,
} from "../../constants/wikiRelationTypes";

/**
 * Read-only −10…+10 sync bar. Same track as the dossier affinity meter.
 * @param {{ strength?: number, caption?: string }} props
 */
export default function SyncMeterReadout({ strength = 0, caption = "" }) {
    const raw = Number(strength);
    const s = Number.isFinite(raw)
        ? Math.max(WIKI_RELATION_STRENGTH_MIN, Math.min(WIKI_RELATION_STRENGTH_MAX, Math.round(raw)))
        : 0;
    const pct = (Math.abs(s) / WIKI_RELATION_STRENGTH_MAX) * 50;
    const left = s >= 0 ? 50 : 50 - pct;
    const fillBg = s > 0
        ? "linear-gradient(90deg, transparent, rgba(0,242,234,0.9))"
        : "linear-gradient(90deg, rgba(255,51,85,0.9), transparent)";
    const knob = s > 0 ? UI_COLORS.anomaly : s < 0 ? UI_COLORS.danger : UI_COLORS.textSecondary;
    const signed = s > 0 ? `+${s}` : String(s);

    return (
        <Box sx={{ mt: 0.6, maxWidth: 220 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.25 }}>
                <CyberText sx={{ fontSize: "0.55rem", letterSpacing: "0.12em", color: UI_COLORS.textSecondary }}>
                    SYNC
                </CyberText>
                <CyberText sx={{ fontSize: "0.62rem", fontFamily: "'Orbitron', sans-serif", color: knob }}>
                    {signed}{caption ? ` · ${caption}` : ""}
                </CyberText>
            </Box>
            <Box
                sx={{
                    position: "relative",
                    height: 8,
                    borderRadius: "2px",
                    border: `1px solid ${UI_COLORS.border}`,
                    background: "linear-gradient(90deg, rgba(255,51,85,0.28), rgba(255,255,255,0.06) 50%, rgba(0,242,234,0.28))",
                }}
            >
                {s !== 0 && (
                    <Box
                        sx={{
                            position: "absolute",
                            top: 0,
                            bottom: 0,
                            left: `${left}%`,
                            width: `${pct}%`,
                            background: fillBg,
                        }}
                    />
                )}
                <Box
                    sx={{
                        position: "absolute",
                        top: -2,
                        left: `${50 + (s / WIKI_RELATION_STRENGTH_MAX) * 50}%`,
                        width: 2,
                        height: 12,
                        bgcolor: knob,
                        transform: "translateX(-1px)",
                    }}
                />
            </Box>
        </Box>
    );
}
