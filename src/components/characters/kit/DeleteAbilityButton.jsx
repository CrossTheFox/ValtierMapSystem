import { useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { UI_COLORS } from "../../../constants/uiColors";
import CyberTooltip from "../../customs/CyberTooltip";

/**
 * G9 Delete — irreversible: `abilities/{key}` + unlink from the class. Gated behind
 * a confirm dialog since it can't be undone (unlike Disable, which just benches it).
 */
export default function DeleteAbilityButton({ label, onConfirm, disabled = false }) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <CyberTooltip title="Eliminar (irreversible)" placement="top">
                <span>
                    <IconButton
                        size="small"
                        disabled={disabled}
                        onClick={(e) => {
                            e.stopPropagation();
                            setOpen(true);
                        }}
                        aria-label="Eliminar"
                        sx={{
                            width: 26,
                            height: 26,
                            color: UI_COLORS.danger,
                            border: `1px solid ${UI_COLORS.danger}55`,
                            bgcolor: "rgba(0,0,0,0.35)",
                            "&:hover": { borderColor: UI_COLORS.danger, bgcolor: `${UI_COLORS.danger}18` },
                            "&.Mui-disabled": { opacity: 0.35 },
                        }}
                    >
                        <DeleteOutlineIcon sx={{ fontSize: "0.95rem" }} />
                    </IconButton>
                </span>
            </CyberTooltip>

            <Dialog
                open={open}
                onClose={(e) => { e?.stopPropagation?.(); setOpen(false); }}
                maxWidth="xs"
                fullWidth
                sx={{ zIndex: 1900 }}
            >
                <DialogTitle sx={{ bgcolor: UI_COLORS.backgroundSecondary, color: UI_COLORS.danger, fontFamily: "Orbitron, sans-serif", fontSize: "0.9rem" }}>
                    ELIMINAR PERMANENTEMENTE
                </DialogTitle>
                <DialogContent sx={{ bgcolor: UI_COLORS.backgroundSecondary }}>
                    <Box sx={{ color: UI_COLORS.textPrimary, fontSize: "0.85rem", lineHeight: 1.5 }}>
                        Vas a eliminar <strong>{label || "esta habilidad"}</strong> y desvincularla de la clase. Esta acción
                        no se puede deshacer.
                    </Box>
                </DialogContent>
                <DialogActions sx={{ bgcolor: UI_COLORS.backgroundSecondary }}>
                    <Button onClick={() => setOpen(false)} sx={{ color: UI_COLORS.textSecondary }}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={() => {
                            setOpen(false);
                            onConfirm?.();
                        }}
                        sx={{ color: UI_COLORS.danger }}
                    >
                        Eliminar
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
