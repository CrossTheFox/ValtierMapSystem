import { useRef, useState } from "react";
import { Box, IconButton, TextField } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import { useDispatch, useSelector } from "react-redux";
import { CyberText } from "../customs/CustomTexts";
import CyberTooltip from "../customs/CyberTooltip";
import { UI_COLORS } from "../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import { VTT_HUD } from "../../constants/vttHudTokens";
import { showSnackbar } from "../../store/uiSlice";
import { rollDiceInChat } from "../../../firebase/services/chatService";

const STANDARD_DICE = [4, 6, 8, 10, 12, 20, 100];
const MIN_COUNT = 1;
const MAX_COUNT = 20;
const MIN_CUSTOM_SIDES = 2;
const MAX_CUSTOM_SIDES = 1000;

function clampInt(value, min, max, fallback) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

function QtyControl({ value, onChange, ariaLabel }) {
    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.15 }}>
            <IconButton
                size="small"
                aria-label={`Menos ${ariaLabel}`}
                onClick={() => onChange(clampInt(value - 1, MIN_COUNT, MAX_COUNT, MIN_COUNT))}
                disabled={value <= MIN_COUNT}
                sx={{
                    width: 20,
                    height: 20,
                    color: UI_COLORS.textSecondary,
                    p: 0,
                    "&:hover": { color: UI_COLORS.accent },
                }}
            >
                <RemoveIcon sx={{ fontSize: "0.85rem" }} />
            </IconButton>
            <CyberText
                sx={{
                    fontFamily: "'Fira Code', monospace",
                    fontSize: "0.7rem",
                    color: UI_COLORS.textPrimary,
                    minWidth: 14,
                    textAlign: "center",
                    lineHeight: 1,
                }}
            >
                {value}
            </CyberText>
            <IconButton
                size="small"
                aria-label={`Más ${ariaLabel}`}
                onClick={() => onChange(clampInt(value + 1, MIN_COUNT, MAX_COUNT, MIN_COUNT))}
                disabled={value >= MAX_COUNT}
                sx={{
                    width: 20,
                    height: 20,
                    color: UI_COLORS.textSecondary,
                    p: 0,
                    "&:hover": { color: UI_COLORS.accent },
                }}
            >
                <AddIcon sx={{ fontSize: "0.85rem" }} />
            </IconButton>
        </Box>
    );
}

/**
 * Dice tray: Nd4…Nd100 + custom NdX.
 * @param {"bar"|"stack"} [layout="bar"] — `stack` wraps downward (Roll20 side panel).
 */
export default function DiceRollerBar({ character, layout = "bar" }) {
    const dispatch = useDispatch();
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const profile = useSelector((s) => s.player.profile);
    const [counts, setCounts] = useState(() =>
        Object.fromEntries(STANDARD_DICE.map((d) => [d, 1])),
    );
    const [customCount, setCustomCount] = useState(1);
    const [customSides, setCustomSides] = useState(20);
    // Ref lock — setState(busy) re-rendered every chip as Mui-disabled and flashed the tray.
    const busyRef = useRef(false);

    const isStack = layout === "stack";

    const setCount = (sides, next) => {
        setCounts((prev) => ({ ...prev, [sides]: clampInt(next, MIN_COUNT, MAX_COUNT, 1) }));
    };

    const handleRoll = async (count, sides) => {
        if (!campaignId || busyRef.current) return;
        const n = clampInt(count, MIN_COUNT, MAX_COUNT, 1);
        const s = clampInt(sides, MIN_CUSTOM_SIDES, MAX_CUSTOM_SIDES, 20);
        const formula = `${n}d${s}`;
        busyRef.current = true;
        try {
            await rollDiceInChat(campaignId, profile, character, formula);
            // Result is shown via DiceRevealOverlay + chat (avoid snackbar overlap).
        } catch (err) {
            console.error(err);
            dispatch(showSnackbar({ message: "No se pudo publicar la tirada", severity: "error" }));
        } finally {
            busyRef.current = false;
        }
    };

    const dieChips = (
        <>
            {STANDARD_DICE.map((sides) => {
                const count = counts[sides] ?? 1;
                return (
                    <Box
                        key={sides}
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.35,
                            px: 0.45,
                            py: 0.2,
                            borderRadius: 1,
                            border: `1px solid ${UI_COLORS.border}`,
                            bgcolor: "rgba(0,0,0,0.25)",
                            flexShrink: 0,
                        }}
                    >
                        <QtyControl
                            value={count}
                            onChange={(v) => setCount(sides, v)}
                            ariaLabel={`d${sides}`}
                        />
                        <CyberTooltip title={`Tirar ${count}d${sides}`} placement="top">
                            <IconButton
                                size="small"
                                onClick={() => handleRoll(count, sides)}
                                aria-label={`Tirar ${count}d${sides}`}
                                sx={{
                                    minWidth: 36,
                                    height: 28,
                                    px: 0.6,
                                    borderRadius: 0.75,
                                    border: `1px solid ${UI_COLORS.accent}55`,
                                    color: UI_COLORS.accent,
                                    fontFamily: "'Orbitron', sans-serif",
                                    fontSize: "0.58rem",
                                    letterSpacing: "0.04em",
                                    "&:hover": {
                                        bgcolor: `${UI_COLORS.accent}18`,
                                        borderColor: UI_COLORS.accent,
                                    },
                                }}
                            >
                                d{sides}
                            </IconButton>
                        </CyberTooltip>
                    </Box>
                );
            })}

            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.4,
                    px: 0.5,
                    py: 0.2,
                    borderRadius: 1,
                    border: `1px solid ${UI_COLORS.anomaly}55`,
                    bgcolor: "rgba(0,0,0,0.25)",
                    flexShrink: 0,
                    ...(isStack ? { width: "100%" } : {}),
                }}
            >
                <CyberText
                    sx={{
                        fontFamily: "monospace",
                        fontSize: "0.48rem",
                        letterSpacing: "0.1em",
                        color: UI_COLORS.anomaly,
                    }}
                >
                    CUSTOM
                </CyberText>
                <QtyControl
                    value={customCount}
                    onChange={setCustomCount}
                    ariaLabel="custom count"
                />
                <CyberText sx={{ fontFamily: "monospace", fontSize: "0.65rem", color: UI_COLORS.textSecondary }}>
                    d
                </CyberText>
                <TextField
                    size="small"
                    value={customSides}
                    onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "");
                        if (raw === "") {
                            setCustomSides("");
                            return;
                        }
                        setCustomSides(clampInt(raw, MIN_CUSTOM_SIDES, MAX_CUSTOM_SIDES, 20));
                    }}
                    onBlur={() => {
                        setCustomSides((v) => clampInt(v, MIN_CUSTOM_SIDES, MAX_CUSTOM_SIDES, 20));
                    }}
                    onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") {
                            handleRoll(customCount, customSides || 20);
                        }
                    }}
                    inputProps={{
                        "aria-label": "Caras del dado custom",
                        inputMode: "numeric",
                        style: {
                            width: 36,
                            textAlign: "center",
                            padding: "2px 4px",
                            fontFamily: "'Fira Code', monospace",
                            fontSize: "0.7rem",
                            color: UI_COLORS.textPrimary,
                        },
                    }}
                    sx={{
                        width: 44,
                        "& .MuiOutlinedInput-root": {
                            height: 28,
                            bgcolor: "rgba(0,0,0,0.35)",
                        },
                        "& .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.border },
                        "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.anomaly },
                        "& .Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.anomaly },
                    }}
                />
                <CyberTooltip title={`Tirar ${customCount}d${customSides || "?"}`} placement="top">
                    <IconButton
                        size="small"
                        disabled={!customSides}
                        onClick={() => handleRoll(customCount, customSides)}
                        aria-label="Tirar dado custom"
                        sx={{
                            minWidth: 40,
                            height: 28,
                            px: 0.6,
                            borderRadius: 0.75,
                            border: `1px solid ${UI_COLORS.anomaly}66`,
                            color: UI_COLORS.anomaly,
                            fontFamily: "'Orbitron', sans-serif",
                            fontSize: "0.52rem",
                            letterSpacing: "0.04em",
                            ml: isStack ? "auto" : 0,
                            "&:hover": {
                                bgcolor: `${UI_COLORS.anomaly}18`,
                                borderColor: UI_COLORS.anomaly,
                            },
                        }}
                    >
                        TIRAR
                    </IconButton>
                </CyberTooltip>
            </Box>
        </>
    );

    if (isStack) {
        return (
            <Box
                data-no-token-drop
                sx={{
                    display: "flex",
                    flexDirection: "row",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 0.45,
                    width: "100%",
                }}
            >
                {dieChips}
            </Box>
        );
    }

    return (
        <Box
            data-no-token-drop
            sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.55,
                px: 0.85,
                py: 0.45,
                maxWidth: "min(720px, calc(100vw - 72px))",
                borderRadius: `${VTT_HUD.borderRadius}px`,
                border: `1px solid ${VTT_HUD.glassBorder}`,
                bgcolor: VTT_HUD.glassBg,
                backdropFilter: "blur(14px)",
                boxShadow: "0 0 16px rgba(255,102,255,0.08)",
                overflowX: "auto",
                ...CYBER_SCROLL_STYLE,
            }}
        >
            <CyberText
                sx={{
                    fontFamily: "monospace",
                    fontSize: "0.48rem",
                    letterSpacing: "0.12em",
                    color: UI_COLORS.anomaly,
                    flexShrink: 0,
                    pr: 0.4,
                    borderRight: `1px solid ${UI_COLORS.border}`,
                }}
            >
                DADOS
            </CyberText>
            {dieChips}
        </Box>
    );
}
