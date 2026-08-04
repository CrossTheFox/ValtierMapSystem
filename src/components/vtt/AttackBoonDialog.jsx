import { useState } from "react";
import { Box, Dialog, DialogContent, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { CyberText, CyberTitle } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";

const COUNT_OPTS = [1, 2];

/**
 * Simple cyber dialog: pick +Boon (1–2) or −Curse (1–2) or none, then confirm.
 */
export default function AttackBoonDialog({
    open,
    onClose,
    onConfirm,
    abilityLabel = "Ataque",
}) {
    const [polarity, setPolarity] = useState("none"); // none | boon | curse
    const [count, setCount] = useState(1);

    const handleConfirm = () => {
        const boons = polarity === "boon" ? count : 0;
        const curses = polarity === "curse" ? count : 0;
        onConfirm?.({ boons, curses });
    };

    const chipSx = (active, accent) => ({
        border: `1px solid ${active ? accent : UI_COLORS.border}`,
        bgcolor: active ? `${accent}22` : "transparent",
        color: active ? "#ffffff" : UI_COLORS.textSecondary,
        fontFamily: "'Orbitron', sans-serif",
        fontSize: "0.62rem",
        letterSpacing: "0.08em",
        px: 1.25,
        py: 0.7,
        borderRadius: 0.5,
        cursor: "pointer",
        minWidth: 72,
    });

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="xs"
            fullWidth
            PaperProps={{
                sx: {
                    bgcolor: UI_COLORS.backgroundSecondary,
                    border: `1px solid ${UI_COLORS.border}`,
                    borderRadius: 1.5,
                    backgroundImage: "none",
                },
            }}
            slotProps={{
                backdrop: { sx: { bgcolor: "rgba(0,0,0,0.72)" } },
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    px: 1.5,
                    py: 1,
                    borderBottom: `1px solid ${UI_COLORS.border}`,
                }}
            >
                <CyberTitle sx={{ fontSize: "0.72rem", color: UI_COLORS.accent, letterSpacing: "0.1em" }}>
                    ATK · BOON / CURSE
                </CyberTitle>
                <IconButton size="small" onClick={onClose} sx={{ color: UI_COLORS.textSecondary }}>
                    <CloseIcon fontSize="small" />
                </IconButton>
            </Box>
            <DialogContent sx={{ pt: 2 }}>
                <CyberText sx={{ fontSize: "0.78rem", color: UI_COLORS.textPrimary, mb: 1.5 }}>
                    {abilityLabel}
                </CyberText>
                <CyberText sx={{ fontSize: "0.62rem", color: UI_COLORS.textSecondary, mb: 1, letterSpacing: "0.06em" }}>
                    MODIFICADOR (máx. 2)
                </CyberText>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 1.5 }}>
                    <Box
                        component="button"
                        type="button"
                        onClick={() => setPolarity("none")}
                        sx={chipSx(polarity === "none", UI_COLORS.anomaly)}
                    >
                        NINGUNO
                    </Box>
                    <Box
                        component="button"
                        type="button"
                        onClick={() => setPolarity("boon")}
                        sx={chipSx(polarity === "boon", "#33cc66")}
                    >
                        + BOON
                    </Box>
                    <Box
                        component="button"
                        type="button"
                        onClick={() => setPolarity("curse")}
                        sx={chipSx(polarity === "curse", UI_COLORS.accentStrong || "#ff3355")}
                    >
                        − CURSE
                    </Box>
                </Box>
                {polarity !== "none" && (
                    <Box sx={{ display: "flex", gap: 0.75, mb: 2 }}>
                        {COUNT_OPTS.map((n) => (
                            <Box
                                key={n}
                                component="button"
                                type="button"
                                onClick={() => setCount(n)}
                                sx={chipSx(
                                    count === n,
                                    polarity === "boon" ? "#33cc66" : (UI_COLORS.accentStrong || "#ff3355"),
                                )}
                            >
                                {n}
                            </Box>
                        ))}
                    </Box>
                )}
                <CyberText sx={{ fontSize: "0.58rem", color: UI_COLORS.textSecondary, mb: 2, lineHeight: 1.4 }}>
                    Boon: tira Nd6 y suma el mayor al d20. Curse: resta el mayor de Nd6.
                </CyberText>
                <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                    <Box
                        component="button"
                        type="button"
                        onClick={onClose}
                        sx={{
                            ...chipSx(false, UI_COLORS.border),
                            borderColor: UI_COLORS.border,
                        }}
                    >
                        CANCELAR
                    </Box>
                    <Box
                        component="button"
                        type="button"
                        onClick={handleConfirm}
                        sx={{
                            ...chipSx(true, UI_COLORS.accent),
                            bgcolor: `${UI_COLORS.accent}28`,
                        }}
                    >
                        LANZAR
                    </Box>
                </Box>
            </DialogContent>
        </Dialog>
    );
}
