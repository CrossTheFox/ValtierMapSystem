import { useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem } from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import LocalLibraryIcon from "@mui/icons-material/LocalLibrary";
import { logoutPlayer } from "../../../firebase/playersAuth";
import { resetWorldState } from "../../store/worldSlice";
import { UI_COLORS } from "../../constants/uiColors";
import { VTT_HUD } from "../../constants/vttHudTokens";
import { cyberMenuItemSx, cyberMenuPaperSx } from "../../constants/designSystem";
import CyberTooltip from "../customs/CyberTooltip";

const DISCONNECT_RED = "#ff4d4d";
const itemTextSx = {
    color: UI_COLORS.textPrimary,
    fontFamily: "'Fira Code', monospace",
    fontSize: "0.72rem",
};

/**
 * The map's exit icon. Opens the library, or signs out.
 * On the library itself only sign-out is offered.
 */
export default function ArchiveExitMenu({ showLibrary = true }) {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [anchor, setAnchor] = useState(null);
    const open = Boolean(anchor);

    const close = () => setAnchor(null);

    const goLibrary = () => {
        close();
        dispatch(resetWorldState());
        navigate("/biblioteca");
    };

    const signOut = async () => {
        close();
        try {
            await logoutPlayer();
            dispatch(resetWorldState());
        } catch (err) {
            console.error("Logout error:", err);
        }
    };

    return (
        <>
            <CyberTooltip title="Salir" placement="bottom">
                <IconButton
                    size="small"
                    onClick={(e) => setAnchor(e.currentTarget)}
                    aria-label="Salir"
                    aria-haspopup="menu"
                    aria-expanded={open ? "true" : undefined}
                    sx={{
                        width: VTT_HUD.hudBtnSize,
                        height: VTT_HUD.hudBtnSize,
                        borderRadius: "3px",
                        color: DISCONNECT_RED,
                        border: `1px solid ${open ? DISCONNECT_RED : `${DISCONNECT_RED}88`}`,
                        bgcolor: open ? "rgba(255,77,77,0.14)" : "rgba(10,10,15,0.9)",
                        backdropFilter: "blur(8px)",
                        boxShadow: open ? `0 0 12px ${DISCONNECT_RED}44` : "none",
                        "&:hover": {
                            borderColor: DISCONNECT_RED,
                            bgcolor: "rgba(255,77,77,0.14)",
                            boxShadow: `0 0 12px ${DISCONNECT_RED}44`,
                        },
                    }}
                >
                    <LogoutIcon sx={{ fontSize: "1.1rem" }} />
                </IconButton>
            </CyberTooltip>
            <Menu
                anchorEl={anchor}
                open={open}
                onClose={close}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                slotProps={{
                    paper: { sx: { ...cyberMenuPaperSx, mt: 0.75, minWidth: 200 } },
                }}
            >
                {showLibrary && (
                    <MenuItem onClick={goLibrary} sx={cyberMenuItemSx}>
                        <ListItemIcon sx={{ color: UI_COLORS.anomaly, minWidth: 32 }}>
                            <LocalLibraryIcon sx={{ fontSize: "1.05rem" }} />
                        </ListItemIcon>
                        <ListItemText primary="Ir a la biblioteca" primaryTypographyProps={{ sx: itemTextSx }} />
                    </MenuItem>
                )}
                <MenuItem onClick={signOut} sx={cyberMenuItemSx}>
                    <ListItemIcon sx={{ color: DISCONNECT_RED, minWidth: 32 }}>
                        <LogoutIcon sx={{ fontSize: "1.05rem" }} />
                    </ListItemIcon>
                    <ListItemText primary="Desconectarse" primaryTypographyProps={{ sx: itemTextSx }} />
                </MenuItem>
            </Menu>
        </>
    );
}
