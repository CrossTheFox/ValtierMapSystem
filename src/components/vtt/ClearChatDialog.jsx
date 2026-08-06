import { useEffect, useState } from "react";
import { Box, Checkbox, Dialog, DialogContent, FormControlLabel, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { CyberText, CyberTitle } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { RENDER_LAYERS } from "../../constants/renderLayers";

/**
 * DM confirm dialog: wipe campaign chat, optionally download a JSON backup first.
 */
export default function ClearChatDialog({
    open,
    onClose,
    onConfirm,
    clearing = false,
    messageCount = 0,
}) {
    const [withBackup, setWithBackup] = useState(true);

    useEffect(() => {
        if (open) setWithBackup(true);
    }, [open]);

    const btnBase = {
        fontFamily: "Orbitron, sans-serif",
        fontSize: "0.55rem",
        letterSpacing: "0.1em",
        px: 1.5,
        py: 0.9,
        borderRadius: "6px",
        cursor: clearing ? "wait" : "pointer",
        border: "1px solid",
        "&:disabled": { opacity: 0.55, cursor: "not-allowed" },
    };

    return (
        <Dialog
            open={open}
            onClose={clearing ? undefined : onClose}
            maxWidth="xs"
            fullWidth
            sx={{ zIndex: RENDER_LAYERS.DIALOG + 40 }}
            PaperProps={{
                sx: {
                    bgcolor: UI_COLORS.backgroundSecondary,
                    border: `1px solid ${UI_COLORS.accentStrong}`,
                    borderRadius: 1.5,
                    backgroundImage: "none",
                    boxShadow: `0 0 28px ${UI_COLORS.accentStrong}33`,
                },
            }}
            slotProps={{
                backdrop: { sx: { bgcolor: "rgba(0,0,0,0.78)" } },
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
                <CyberTitle sx={{ fontSize: "0.72rem", color: UI_COLORS.accentStrong, letterSpacing: "0.1em" }}>
                    LIMPIAR CHAT
                </CyberTitle>
                <IconButton
                    size="small"
                    onClick={onClose}
                    disabled={clearing}
                    sx={{ color: UI_COLORS.textSecondary }}
                    aria-label="Cerrar"
                >
                    <CloseIcon fontSize="small" />
                </IconButton>
            </Box>

            <DialogContent sx={{ pt: 2, pb: 2 }}>
                <CyberText sx={{ fontSize: "0.82rem", color: UI_COLORS.textPrimary, mb: 1.25, lineHeight: 1.45 }}>
                    Esto borra <strong style={{ color: UI_COLORS.accentStrong }}>todos</strong> los mensajes
                    del chat de esta campaña en la base de datos
                    {messageCount > 0 ? ` (${messageCount} visibles ahora)` : ""}. No se puede deshacer.
                </CyberText>

                <FormControlLabel
                    control={(
                        <Checkbox
                            size="small"
                            checked={withBackup}
                            disabled={clearing}
                            onChange={(e) => setWithBackup(e.target.checked)}
                            sx={{
                                color: UI_COLORS.anomaly,
                                "&.Mui-checked": { color: UI_COLORS.anomaly },
                            }}
                        />
                    )}
                    label={(
                        <CyberText sx={{ fontSize: "0.75rem", color: UI_COLORS.textPrimary }}>
                            Descargar respaldo JSON antes de limpiar
                        </CyberText>
                    )}
                    sx={{ mb: 1.75, ml: 0, alignItems: "center" }}
                />

                <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", justifyContent: "flex-end" }}>
                    <Box
                        component="button"
                        type="button"
                        disabled={clearing}
                        onClick={onClose}
                        sx={{
                            ...btnBase,
                            borderColor: UI_COLORS.border,
                            bgcolor: "transparent",
                            color: UI_COLORS.textPrimary,
                            "&:hover": { borderColor: UI_COLORS.anomaly },
                        }}
                    >
                        CANCELAR
                    </Box>
                    <Box
                        component="button"
                        type="button"
                        disabled={clearing}
                        onClick={() => onConfirm?.({ withBackup })}
                        sx={{
                            ...btnBase,
                            borderColor: UI_COLORS.accentStrong,
                            bgcolor: `${UI_COLORS.accentStrong}22`,
                            color: "#ffffff",
                            "&:hover": { bgcolor: `${UI_COLORS.accentStrong}38` },
                        }}
                    >
                        {clearing ? "LIMPIANDO…" : withBackup ? "RESPALDAR Y LIMPIAR" : "LIMPIAR SIN RESPALDO"}
                    </Box>
                </Box>
            </DialogContent>
        </Dialog>
    );
}
