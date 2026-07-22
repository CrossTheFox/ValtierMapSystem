import { useMemo } from "react";
import { Box } from "@mui/material";
import { CyberText } from "../customs/CustomTexts";
import { useCharacterSessionPools } from "../../hooks/useCharacterSessionPools";
import { UI_COLORS } from "../../constants/uiColors";
import CyberTooltip from "../customs/CyberTooltip";

function EffortSegment({ filled, onClick, title }) {
    const color = "#f97316";
    return (
        <CyberTooltip title={title} placement="bottom">
            <Box
                component="button"
                type="button"
                onClick={onClick}
                sx={{
                    width: 10,
                    height: 14,
                    borderRadius: "2px",
                    border: `1px solid ${filled ? color : "rgba(255,255,255,0.15)"}`,
                    bgcolor: filled ? color : "rgba(42,42,61,0.5)",
                    boxShadow: filled ? `0 0 6px ${color}66` : "none",
                    cursor: "pointer",
                    p: 0,
                    transition: "transform 0.12s",
                    "&:hover": { transform: "scaleY(1.08)" },
                }}
            />
        </CyberTooltip>
    );
}

function StatePill({ label, active, onClick }) {
    return (
        <CyberTooltip title={active ? `${label} activo` : `Marcar ${label}`} placement="bottom">
            <Box
                component="button"
                type="button"
                onClick={onClick}
                sx={{
                    fontFamily: "monospace",
                    fontSize: "0.5rem",
                    letterSpacing: "0.08em",
                    px: 0.6,
                    py: 0.2,
                    borderRadius: "3px",
                    border: `1px solid ${active ? "#ff0055" : UI_COLORS.border}`,
                    bgcolor: active ? "rgba(255,0,85,0.2)" : "transparent",
                    color: active ? "#ff6699" : UI_COLORS.textSecondary,
                    cursor: "pointer",
                    lineHeight: 1.2,
                    minWidth: 28,
                }}
            >
                {label}
            </Box>
        </CyberTooltip>
    );
}

export default function SessionPoolHud({ characterId, resourceTracks = [] }) {
    const tracks = useMemo(
        () => (resourceTracks || []).filter((t) => t?.key && t.key !== "strain"),
        [resourceTracks]
    );
    const { pools, setTrack } = useCharacterSessionPools(characterId, tracks);

    if (!characterId || !tracks.length) return null;

    return (
        <Box
            className="dialog-no-drag"
            sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                flexShrink: 0,
                px: 0.5,
            }}
        >
            {tracks.map((track) => {
                const max = Math.max(track.maxDefault ?? 3, 1);
                const pool = pools[track.key] || { current: 0 };
                const current = Math.min(Math.max(pool.current ?? 0, 0), max);
                const stateKey = track.stateKey;
                const flagged = stateKey ? !!pool[stateKey] : false;
                const stateShort = track.stateLabel?.slice(0, 3).toUpperCase() || "???";

                const setCurrent = (v) => setTrack(track.key, { current: v });

                return (
                    <Box key={track.key} sx={{ display: "flex", flexDirection: "column", gap: 0.25, alignItems: "center" }}>
                        <CyberText
                            sx={{
                                fontFamily: "monospace",
                                fontSize: "0.48rem",
                                color: UI_COLORS.textSecondary,
                                letterSpacing: "0.1em",
                                lineHeight: 1,
                            }}
                        >
                            {track.label?.toUpperCase()}
                        </CyberText>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.35 }}>
                            {Array.from({ length: max }, (_, i) => (
                                <EffortSegment
                                    key={i}
                                    filled={i < current}
                                    title={`${track.label || track.key} ${i + 1}${i < current ? " (gastado)" : ""}`}
                                    onClick={() => setCurrent(i < current ? i : i + 1)}
                                />
                            ))}
                            <CyberText sx={{ fontFamily: "monospace", fontSize: "0.55rem", color: UI_COLORS.textSecondary, ml: 0.25 }}>
                                {current}/{max}
                            </CyberText>
                        </Box>
                        {stateKey && track.stateLabel && (
                            <StatePill
                                label={stateShort}
                                active={flagged}
                                onClick={() => setTrack(track.key, { [stateKey]: !flagged })}
                            />
                        )}
                    </Box>
                );
            })}
        </Box>
    );
}
