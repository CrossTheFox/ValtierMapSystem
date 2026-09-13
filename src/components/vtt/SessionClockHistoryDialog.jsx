import { useMemo, useState } from "react";
import { Box, Dialog, DialogContent, IconButton, TextField } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { CyberText, CyberTitle } from "../customs/CustomTexts";
import { HUD_SURFACE, TYPO } from "../../constants/designSystem";
import { UI_COLORS } from "../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";

export default function SessionClockHistoryDialog({ open, onClose, history = [] }) {
    const [query, setQuery] = useState("");
    const [expanded, setExpanded] = useState(null);

    const list = useMemo(() => {
        const q = query.toLowerCase().trim();
        if (!q) return history;
        return history.filter((h) =>
            `${h.name} ${h.result} ${h.method} ${h.detail || ""}`.toLowerCase().includes(q),
        );
    }, [history, query]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: {
                    ...HUD_SURFACE,
                    width: "min(420px, 92vw)",
                    maxHeight: "min(560px, 82vh)",
                    color: UI_COLORS.textPrimary,
                },
            }}
        >
            <Box sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1.5,
                py: 1,
                borderBottom: `1px solid ${UI_COLORS.border}`,
            }}>
                <CyberTitle sx={{ fontSize: "0.62rem", letterSpacing: "0.14em", color: UI_COLORS.accent, flex: 1 }}>
                    HISTORIAL · CLOCKS
                </CyberTitle>
                <IconButton size="small" onClick={onClose} sx={{ color: UI_COLORS.textSecondary }} aria-label="Cerrar">
                    <CloseIcon fontSize="small" />
                </IconButton>
            </Box>
            <DialogContent sx={{ p: 1.5, ...CYBER_SCROLL_STYLE }}>
                <TextField
                    size="small"
                    fullWidth
                    placeholder="Buscar…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    InputProps={{
                        sx: {
                            color: UI_COLORS.textPrimary,
                            fontFamily: TYPO.mono,
                            fontSize: "0.72rem",
                            bgcolor: "rgba(0,0,0,0.35)",
                        },
                    }}
                    sx={{ mb: 1.25, "& .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.border } }}
                />
                {list.length === 0 && (
                    <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "0.7rem" }}>
                        Sin coincidencias.
                    </CyberText>
                )}
                {list.map((h) => (
                    <Box
                        key={h.id}
                        sx={{
                            border: `1px solid ${UI_COLORS.border}`,
                            borderRadius: "4px",
                            p: 1,
                            mb: 0.75,
                            bgcolor: "rgba(0,0,0,0.3)",
                        }}
                    >
                        <CyberTitle sx={{ fontSize: "9px", letterSpacing: "0.08em", color: UI_COLORS.textPrimary }}>
                            {h.name}
                        </CyberTitle>
                        <CyberText sx={{ fontSize: "8px", color: UI_COLORS.textSecondary, mt: 0.4, fontFamily: TYPO.mono }}>
                            {h.result} · {h.progress} · {h.method} · {h.when}
                        </CyberText>
                        <Box
                            component="button"
                            type="button"
                            onClick={() => setExpanded((id) => (id === h.id ? null : h.id))}
                            sx={{
                                mt: 0.5,
                                border: 0,
                                background: "none",
                                color: UI_COLORS.anomaly,
                                fontFamily: TYPO.mono,
                                fontSize: "7px",
                                cursor: "pointer",
                                p: 0,
                            }}
                        >
                            {expanded === h.id ? "Ocultar" : "Ver detalle"}
                        </Box>
                        {expanded === h.id && (
                            <CyberText sx={{ fontSize: "11px", color: "rgba(255,255,255,0.78)", mt: 0.75 }}>
                                {h.detail || "—"}
                            </CyberText>
                        )}
                    </Box>
                ))}
            </DialogContent>
        </Dialog>
    );
}
