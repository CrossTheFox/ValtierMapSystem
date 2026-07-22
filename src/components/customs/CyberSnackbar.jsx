import { createPortal } from "react-dom";
import { Snackbar, Box, Typography, IconButton, Button } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useDispatch, useSelector } from "react-redux";
import { hideSnackbar } from "../../store/uiSlice";
import { UI_COLORS } from "../../constants/uiColors";
import { RENDER_LAYERS } from "../../constants/renderLayers";

export default function CyberSnackbar() {
    const dispatch = useDispatch();
    const { open, message, severity, action } = useSelector((state) => state.ui.snackbar);

    const handleClose = (event, reason) => {
        if (reason === "clickaway") return;
        dispatch(hideSnackbar());
    };

    const getSeverityColor = () => {
        switch (severity) {
            case "error": return "#ff003c";
            case "success": return "#00ff9f";
            case "warning": return "#fcee0a";
            default: return UI_COLORS.accent || "#00f2ea";
        }
    };

    const mainColor = getSeverityColor();

    if (typeof document === "undefined") return null;

    return createPortal(
        <Snackbar
            disablePortal
            open={open}
            autoHideDuration={5000}
            onClose={handleClose}
            anchorOrigin={{ vertical: "top", horizontal: "right" }}
            slotProps={{
                root: {
                    sx: {
                        position: "fixed",
                        zIndex: RENDER_LAYERS.SNACKBAR,
                        pointerEvents: "none",
                    },
                },
            }}
            sx={{
                position: "fixed",
                top: { xs: 16, sm: 24 },
                right: { xs: 16, sm: 24 },
                left: "auto",
                bottom: "auto",
                zIndex: RENDER_LAYERS.SNACKBAR,
                pointerEvents: "none",
            }}
        >
            <Box sx={{
                backgroundColor: "#050505",
                borderLeft: `4px solid ${mainColor}`,
                borderRight: `1px solid ${mainColor}33`,
                borderTop: `1px solid ${mainColor}33`,
                borderBottom: `1px solid ${mainColor}33`,
                p: 2,
                minWidth: "300px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                boxShadow: `0 0 15px ${mainColor}22`,
                position: "relative",
                clipPath: "polygon(0 0, 95% 0, 100% 25%, 100% 100%, 5% 100%, 0 75%)",
                pointerEvents: "auto",
            }}>
                <Box>
                    <Typography variant="caption" sx={{ color: mainColor, display: "block", fontWeight: "bold", letterSpacing: 1 }}>
                        {`STATUS: ${severity?.toUpperCase()}`}
                    </Typography>
                    <Typography sx={{ color: "#fff", fontFamily: "Michroma, sans-serif", fontSize: "0.85rem" }}>
                        {message}
                    </Typography>
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", ml: 2 }}>
                    {action && (
                        <Button
                            size="small"
                            onClick={action.onClick}
                            sx={{ color: mainColor, mr: 1, fontFamily: "Michroma" }}
                        >
                            {action.label}
                        </Button>
                    )}
                    <IconButton size="small" onClick={handleClose} sx={{ color: "rgba(255,255,255,0.5)", "&:hover": { color: mainColor } }}>
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Box>
            </Box>
        </Snackbar>,
        document.body
    );
}
