import { useRef, useState } from "react";
import { Box, IconButton, TextField } from "@mui/material";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import LockIcon from "@mui/icons-material/Lock";
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

/** Slim count field — editable, no +/- chrome (saves width in 2-col stack). */
function QtyField({ value, onChange, ariaLabel }) {
    return (
        <TextField
            size="small"
            value={value}
            onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, "");
                if (raw === "") {
                    onChange("");
                    return;
                }
                onChange(clampInt(raw, MIN_COUNT, MAX_COUNT, MIN_COUNT));
            }}
            onBlur={() => {
                onChange(clampInt(value === "" ? MIN_COUNT : value, MIN_COUNT, MAX_COUNT, MIN_COUNT));
            }}
            onKeyDown={(e) => e.stopPropagation()}
            inputProps={{
                "aria-label": ariaLabel,
                inputMode: "numeric",
                style: {
                    width: 18,
                    textAlign: "center",
                    padding: "2px 0",
                    fontFamily: "'Fira Code', monospace",
                    fontSize: "0.68rem",
                    color: UI_COLORS.textPrimary,
                },
            }}
            sx={{
                width: 26,
                flexShrink: 0,
                "& .MuiOutlinedInput-root": {
                    height: 28,
                    bgcolor: "rgba(0,0,0,0.35)",
                },
                "& .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.border },
                "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.accent },
                "& .Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.accent },
            }}
        />
    );
}

/**
 * Dice tray: Nd4…Nd100 + custom NdX.
 * @param {"bar"|"stack"} [layout="bar"] — `stack` = 2-col grid growing downward.
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
    const [customUnlocked, setCustomUnlocked] = useState(false);
    // Ref lock — setState(busy) re-rendered every chip as Mui-disabled and flashed the tray.
    const busyRef = useRef(false);

    const isStack = layout === "stack";

    const setCount = (sides, next) => {
        setCounts((prev) => ({
            ...prev,
            [sides]: typeof next === "function"
                ? clampInt(next(prev[sides] ?? 1), MIN_COUNT, MAX_COUNT, 1)
                : clampInt(next, MIN_COUNT, MAX_COUNT, 1),
        }));
    };

    const handleCustomCount = (next) => {
        if (typeof next === "function") {
            setCustomCount((v) => clampInt(next(v), MIN_COUNT, MAX_COUNT, 1));
        } else if (next === "") {
            setCustomCount("");
        } else {
            setCustomCount(clampInt(next, MIN_COUNT, MAX_COUNT, 1));
        }
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

    const dieBtnSx = {
        minWidth: 36,
        height: 28,
        px: 0.55,
        borderRadius: 0.75,
        border: `1px solid ${UI_COLORS.accent}55`,
        color: UI_COLORS.accent,
        fontFamily: "'Orbitron', sans-serif",
        fontSize: "0.58rem",
        letterSpacing: "0.04em",
        flexShrink: 0,
        "&:hover": {
            bgcolor: `${UI_COLORS.accent}18`,
            borderColor: UI_COLORS.accent,
        },
    };

    const chipSx = {
        display: "flex",
        alignItems: "center",
        gap: 0.3,
        px: 0.4,
        py: 0.2,
        borderRadius: 1,
        border: `1px solid ${UI_COLORS.border}`,
        bgcolor: "rgba(0,0,0,0.25)",
        minWidth: 0,
    };

    const standardChips = STANDARD_DICE.map((sides) => {
        const count = counts[sides] ?? 1;
        return (
            <Box key={sides} sx={chipSx}>
                <QtyField
                    value={count}
                    onChange={(v) => {
                        if (v === "") setCounts((prev) => ({ ...prev, [sides]: "" }));
                        else setCount(sides, v);
                    }}
                    ariaLabel={`Cantidad d${sides}`}
                />
                <CyberText
                    sx={{
                        fontFamily: "monospace",
                        fontSize: "0.55rem",
                        color: UI_COLORS.textSecondary,
                        lineHeight: 1,
                        userSelect: "none",
                    }}
                >
                    +
                </CyberText>
                <CyberTooltip title={`Tirar ${count || 1}d${sides}`} placement="top">
                    <IconButton
                        size="small"
                        onClick={() => handleRoll(count, sides)}
                        aria-label={`Tirar ${count || 1}d${sides}`}
                        sx={dieBtnSx}
                    >
                        d{sides}
                    </IconButton>
                </CyberTooltip>
            </Box>
        );
    });

    const customChip = !customUnlocked ? (
        <Box
            sx={{
                ...chipSx,
                border: `1px solid ${UI_COLORS.anomaly}55`,
                justifyContent: "center",
            }}
        >
            <CyberTooltip title="Liberar dado custom (NdX)" placement="top">
                <IconButton
                    size="small"
                    onClick={() => setCustomUnlocked(true)}
                    aria-label="Liberar dado custom"
                    sx={{
                        ...dieBtnSx,
                        minWidth: isStack ? "100%" : 72,
                        border: `1px solid ${UI_COLORS.anomaly}66`,
                        color: UI_COLORS.anomaly,
                        gap: 0.5,
                        "&:hover": {
                            bgcolor: `${UI_COLORS.anomaly}18`,
                            borderColor: UI_COLORS.anomaly,
                        },
                    }}
                >
                    <LockIcon sx={{ fontSize: "0.85rem" }} />
                    CUSTOM
                </IconButton>
            </CyberTooltip>
        </Box>
    ) : (
        <Box
            sx={{
                ...chipSx,
                border: `1px solid ${UI_COLORS.anomaly}55`,
                gap: 0.35,
                ...(isStack ? { gridColumn: "1 / -1" } : {}),
            }}
        >
            <CyberTooltip title="Bloquear custom" placement="top">
                <IconButton
                    size="small"
                    onClick={() => setCustomUnlocked(false)}
                    aria-label="Bloquear dado custom"
                    sx={{
                        width: 24,
                        height: 24,
                        p: 0,
                        color: UI_COLORS.anomaly,
                        flexShrink: 0,
                    }}
                >
                    <LockOpenIcon sx={{ fontSize: "0.85rem" }} />
                </IconButton>
            </CyberTooltip>
            <QtyField
                value={customCount}
                onChange={handleCustomCount}
                ariaLabel="Cantidad custom"
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
                        width: 32,
                        textAlign: "center",
                        padding: "2px 4px",
                        fontFamily: "'Fira Code', monospace",
                        fontSize: "0.7rem",
                        color: UI_COLORS.textPrimary,
                    },
                }}
                sx={{
                    width: 40,
                    flexShrink: 0,
                    "& .MuiOutlinedInput-root": {
                        height: 28,
                        bgcolor: "rgba(0,0,0,0.35)",
                    },
                    "& .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.border },
                    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.anomaly },
                    "& .Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.anomaly },
                }}
            />
            <CyberTooltip title={`Tirar ${customCount || 1}d${customSides || "?"}`} placement="top">
                <IconButton
                    size="small"
                    disabled={!customSides}
                    onClick={() => handleRoll(customCount, customSides)}
                    aria-label="Tirar dado custom"
                    sx={{
                        ...dieBtnSx,
                        minWidth: 40,
                        border: `1px solid ${UI_COLORS.anomaly}66`,
                        color: UI_COLORS.anomaly,
                        fontSize: "0.52rem",
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
    );

    if (isStack) {
        return (
            <Box
                data-no-token-drop
                sx={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    alignItems: "stretch",
                    gap: 0.45,
                    width: "100%",
                }}
            >
                {standardChips}
                {customChip}
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
            {standardChips}
            {customChip}
        </Box>
    );
}
