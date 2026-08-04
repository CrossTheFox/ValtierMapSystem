import { Box, Paper, Rating } from "@mui/material";

import { CyberTitle, CyberText } from "../customs/CustomTexts";
import { CyberCheckbox } from "../customs/CyberCheckbox";
import { UI_COLORS } from "../../constants/uiColors";

const TXT = { color: "rgba(255,255,255,0.92)" };

const PoolSlotEmpty = () => (
    <Box
        sx={{
            width: 18,
            height: 8,
            bgcolor: "rgba(42, 42, 61, 0.35)",
            border: "1px solid #2a2a3d",
            mx: 0.15,
            borderRadius: "2px",
        }}
    />
);

function PoolSlotFilled({ danger }) {
    const color = danger ? "#ff0055" : "#f97316";
    return (
        <Box
            sx={{
                width: 18,
                height: 8,
                bgcolor: color,
                border: `1px solid ${color}`,
                boxShadow: `0 0 5px ${danger ? "rgba(255,0,85,0.55)" : "rgba(249,115,22,0.5)"}`,
                mx: 0.15,
                borderRadius: "2px",
            }}
        />
    );
}

export function SessionPoolBlock({ track, pools, setTrack, compact = false }) {
    if (track?.key === "strain") return null;

    const max = Math.max(track.maxDefault ?? 3, 1);
    const pool = pools[track.key] || { current: 0 };
    const current = Math.min(Math.max(pool.current ?? 0, 0), max);
    const stateKey = track.stateKey;
    const flagged = stateKey ? !!pool[stateKey] : false;
    const atCap = current >= max;

    if (compact) {
        return (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                <CyberText sx={{ fontFamily: "monospace", fontSize: "0.58rem", color: UI_COLORS.textSecondary, letterSpacing: "0.14em" }}>
                    {track.label?.toUpperCase()}
                </CyberText>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Rating
                        max={max}
                        value={current}
                        onChange={(_, v) => setTrack(track.key, { current: v ?? 0 })}
                        icon={<PoolSlotFilled danger={atCap} />}
                        emptyIcon={<PoolSlotEmpty />}
                        sx={{ "& .MuiRating-iconFilled": { opacity: 1 }, gap: 0.25 }}
                    />
                    <CyberText sx={{ fontFamily: "monospace", fontSize: "0.68rem", color: UI_COLORS.textSecondary, ml: 0.5 }}>
                        {current}/{max}
                    </CyberText>
                </Box>
                {track.stateKey && track.stateLabel && (
                    <CyberCheckbox
                        name={`session-${track.key}-${track.stateKey}`}
                        label={track.stateLabel.toUpperCase()}
                        checked={flagged}
                        onChange={(e) => setTrack(track.key, { [track.stateKey]: e.target.checked })}
                    />
                )}
            </Box>
        );
    }

    return (
        <Paper
            elevation={0}
            sx={{
                p: 1.5,
                height: "100%",
                bgcolor: "rgba(255,255,255,0.02)",
                border: "1px solid #2a2a3d",
                borderRadius: 1,
            }}
        >
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.75 }}>
                <CyberTitle sx={{ fontSize: "0.75rem", color: UI_COLORS.accent }}>
                    {track.label?.toUpperCase()}
                </CyberTitle>
                <CyberText sx={{ fontFamily: "monospace", fontSize: "0.75rem", ...TXT }}>
                    {current} / {max}
                </CyberText>
            </Box>
            <Rating
                max={max}
                value={current}
                onChange={(_, v) => setTrack(track.key, { current: v ?? 0 })}
                icon={<PoolSlotFilled danger={atCap} />}
                emptyIcon={<PoolSlotEmpty />}
                sx={{ "& .MuiRating-iconFilled": { opacity: 1 } }}
            />
            {track.stateKey && track.stateLabel && (
                <Box sx={{ mt: 1 }}>
                    <CyberCheckbox
                        name={`session-${track.key}-${track.stateKey}`}
                        label={track.stateLabel.toUpperCase()}
                        checked={flagged}
                        onChange={(e) => setTrack(track.key, { [track.stateKey]: e.target.checked })}
                    />
                </Box>
            )}
        </Paper>
    );
}
