import { useState } from "react";
import {
    Badge, Box, IconButton, ListItemIcon, ListItemText, Menu, MenuItem,
} from "@mui/material";
import PersonPinCircleIcon from "@mui/icons-material/PersonPinCircle";
import ChatIcon from "@mui/icons-material/Chat";
import GroupsIcon from "@mui/icons-material/Groups";
import LogoutIcon from "@mui/icons-material/Logout";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import { useDispatch } from "react-redux";

import { resetWorldState } from "../../store/worldSlice";
import { logoutPlayer } from "../../../firebase/playersAuth";
import { UI_COLORS } from "../../constants/uiColors";
import { VTT_HUD } from "../../constants/vttHudTokens";
import { cyberMenuItemSx, cyberMenuPaperSx } from "../../constants/designSystem";
import CyberTooltip from "../customs/CyberTooltip";

const DISCONNECT_RED = "#ff4d4d";
/** Match combat HUD glass buttons — square, not circular. */
const HUD_BTN_RADIUS = "3px";

const hudIconBtnSx = (active, accent = UI_COLORS.anomaly) => ({
    width: VTT_HUD.hudBtnSize,
    height: VTT_HUD.hudBtnSize,
    borderRadius: HUD_BTN_RADIUS,
    color: active ? UI_COLORS.accent : accent,
    border: `1px solid ${active ? UI_COLORS.accent : `${accent}55`}`,
    bgcolor: "rgba(10,10,15,0.9)",
    backdropFilter: "blur(8px)",
    boxShadow: active ? `0 0 12px ${UI_COLORS.accent}44` : "none",
    "&:hover": {
        borderColor: UI_COLORS.accent,
        bgcolor: `${UI_COLORS.accent}14`,
    },
});

export default function TopRightHUD({
    profile = null,
    tokenPanelOpen = false,
    onToggleTokenPanel,
    showTokenToggle = false,
    showChatToggle = false,
    chatPanelOpen = false,
    chatUnread = 0,
    onToggleChatPanel,
    showRosterToggle = false,
    rosterPanelOpen = false,
    onToggleRosterPanel,
}) {
    const dispatch = useDispatch();
    const [sessionMenuAnchor, setSessionMenuAnchor] = useState(null);
    const sessionMenuOpen = Boolean(sessionMenuAnchor);

    const closeSessionMenu = () => setSessionMenuAnchor(null);

    const handleLogout = async () => {
        closeSessionMenu();
        try {
            await logoutPlayer();
            dispatch(resetWorldState());
        } catch (err) {
            console.error("Logout error:", err);
        }
    };

    const handleChangeCampaign = () => {
        closeSessionMenu();
        dispatch(resetWorldState());
    };

    return (
        <Box
            data-no-token-drop
            sx={{
                position: "fixed",
                top: VTT_HUD.inset,
                right: VTT_HUD.inset,
                zIndex: VTT_HUD.profileZIndex,
                pointerEvents: "auto",
                display: "flex",
                alignItems: "center",
                gap: 0.75,
            }}
        >
            {showChatToggle && (
                <CyberTooltip title={chatPanelOpen ? "Cerrar chat" : "Chat"} placement="bottom">
                    <Badge
                        badgeContent={chatPanelOpen ? 0 : chatUnread}
                        color="error"
                        overlap="rectangular"
                        sx={{
                            "& .MuiBadge-badge": {
                                fontSize: "0.55rem",
                                minWidth: 16,
                                height: 16,
                                borderRadius: "3px",
                                bgcolor: UI_COLORS.accent,
                                color: "#fff",
                            },
                        }}
                    >
                        <IconButton
                            size="small"
                            onClick={() => onToggleChatPanel?.()}
                            aria-label="Chat"
                            aria-pressed={chatPanelOpen}
                            sx={hudIconBtnSx(chatPanelOpen, UI_COLORS.anomaly)}
                        >
                            <ChatIcon sx={{ fontSize: "1.1rem" }} />
                        </IconButton>
                    </Badge>
                </CyberTooltip>
            )}

            {showTokenToggle && (
                <CyberTooltip title={tokenPanelOpen ? "Cerrar tokens" : "Tokens del mapa"} placement="bottom">
                    <IconButton
                        size="small"
                        onClick={() => onToggleTokenPanel?.()}
                        aria-label="Tokens del mapa"
                        aria-pressed={tokenPanelOpen}
                        sx={hudIconBtnSx(tokenPanelOpen, UI_COLORS.anomaly)}
                    >
                        <PersonPinCircleIcon sx={{ fontSize: "1.15rem" }} />
                    </IconButton>
                </CyberTooltip>
            )}

            {showRosterToggle && (
                <CyberTooltip title={rosterPanelOpen ? "Cerrar lista" : "Lista de personajes"} placement="bottom">
                    <IconButton
                        size="small"
                        onClick={() => onToggleRosterPanel?.()}
                        aria-label="Lista de personajes"
                        aria-pressed={rosterPanelOpen}
                        sx={hudIconBtnSx(rosterPanelOpen, UI_COLORS.anomaly)}
                    >
                        <GroupsIcon sx={{ fontSize: "1.15rem" }} />
                    </IconButton>
                </CyberTooltip>
            )}

            <CyberTooltip title="Sesión" placement="bottom">
                <IconButton
                    size="small"
                    onClick={(e) => setSessionMenuAnchor(e.currentTarget)}
                    aria-label="Sesión"
                    aria-haspopup="menu"
                    aria-expanded={sessionMenuOpen ? "true" : undefined}
                    aria-controls={sessionMenuOpen ? "session-menu" : undefined}
                    sx={{
                        width: VTT_HUD.hudBtnSize,
                        height: VTT_HUD.hudBtnSize,
                        borderRadius: HUD_BTN_RADIUS,
                        color: DISCONNECT_RED,
                        border: `1px solid ${sessionMenuOpen ? DISCONNECT_RED : `${DISCONNECT_RED}88`}`,
                        bgcolor: sessionMenuOpen ? "rgba(255,77,77,0.14)" : "rgba(10,10,15,0.9)",
                        backdropFilter: "blur(8px)",
                        boxShadow: sessionMenuOpen ? `0 0 12px ${DISCONNECT_RED}44` : "none",
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
                id="session-menu"
                anchorEl={sessionMenuAnchor}
                open={sessionMenuOpen}
                onClose={closeSessionMenu}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                slotProps={{
                    paper: {
                        sx: {
                            ...cyberMenuPaperSx,
                            mt: 0.75,
                            minWidth: 200,
                        },
                    },
                }}
            >
                <MenuItem onClick={handleChangeCampaign} sx={cyberMenuItemSx}>
                    <ListItemIcon sx={{ color: UI_COLORS.anomaly, minWidth: 32 }}>
                        <SwapHorizIcon sx={{ fontSize: "1.05rem" }} />
                    </ListItemIcon>
                    <ListItemText
                        primary="Cambiar de campaña"
                        primaryTypographyProps={{
                            sx: {
                                color: UI_COLORS.textPrimary,
                                fontFamily: "'Fira Code', monospace",
                                fontSize: "0.72rem",
                            },
                        }}
                    />
                </MenuItem>
                <MenuItem onClick={handleLogout} sx={cyberMenuItemSx}>
                    <ListItemIcon sx={{ color: DISCONNECT_RED, minWidth: 32 }}>
                        <LogoutIcon sx={{ fontSize: "1.05rem" }} />
                    </ListItemIcon>
                    <ListItemText
                        primary="Desconectarse"
                        primaryTypographyProps={{
                            sx: {
                                color: UI_COLORS.textPrimary,
                                fontFamily: "'Fira Code', monospace",
                                fontSize: "0.72rem",
                            },
                        }}
                    />
                </MenuItem>
            </Menu>
        </Box>
    );
}
