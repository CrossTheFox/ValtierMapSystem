import { Badge, Box, IconButton, Tooltip } from "@mui/material";
import PersonPinCircleIcon from "@mui/icons-material/PersonPinCircle";
import ChatIcon from "@mui/icons-material/Chat";
import BadgeIcon from "@mui/icons-material/Badge";
import LogoutIcon from "@mui/icons-material/Logout";
import { useDispatch } from "react-redux";

import { openCharacterSheet } from "../../store/uiSlice";
import { resetWorldState } from "../../store/worldSlice";
import { logoutPlayer } from "../../../firebase/playersAuth";
import { UI_COLORS } from "../../constants/uiColors";
import { VTT_HUD } from "../../constants/vttHudTokens";

const DISCONNECT_RED = "#ff4d4d";

const hudIconBtnSx = (active, accent = UI_COLORS.anomaly) => ({
    width: VTT_HUD.hudBtnSize,
    height: VTT_HUD.hudBtnSize,
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
    tokenPanelOpen = false,
    onToggleTokenPanel,
    showTokenToggle = false,
    showChatToggle = false,
    chatPanelOpen = false,
    chatUnread = 0,
    onToggleChatPanel,
}) {
    const dispatch = useDispatch();

    const handleLogout = async () => {
        try {
            await logoutPlayer();
            dispatch(resetWorldState());
        } catch (err) {
            console.error("Logout error:", err);
        }
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
                <Tooltip title={chatPanelOpen ? "Cerrar chat" : "Chat"} placement="bottom">
                    <Badge
                        badgeContent={chatPanelOpen ? 0 : chatUnread}
                        color="error"
                        overlap="circular"
                        sx={{
                            "& .MuiBadge-badge": {
                                fontSize: "0.55rem",
                                minWidth: 16,
                                height: 16,
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
                </Tooltip>
            )}

            {showTokenToggle && (
                <Tooltip title={tokenPanelOpen ? "Cerrar tokens" : "Tokens del mapa"} placement="bottom">
                    <IconButton
                        size="small"
                        onClick={() => onToggleTokenPanel?.()}
                        aria-label="Tokens del mapa"
                        aria-pressed={tokenPanelOpen}
                        sx={hudIconBtnSx(tokenPanelOpen, UI_COLORS.anomaly)}
                    >
                        <PersonPinCircleIcon sx={{ fontSize: "1.15rem" }} />
                    </IconButton>
                </Tooltip>
            )}

            <Tooltip title="Abrir dossier" placement="bottom">
                <IconButton
                    size="small"
                    onClick={() => dispatch(openCharacterSheet({ tab: "IDENTIDAD" }))}
                    aria-label="Abrir dossier"
                    sx={hudIconBtnSx(false, UI_COLORS.anomaly)}
                >
                    <BadgeIcon sx={{ fontSize: "1.1rem" }} />
                </IconButton>
            </Tooltip>

            <Tooltip title="Desconectarse" placement="bottom">
                <IconButton
                    size="small"
                    onClick={handleLogout}
                    aria-label="Desconectarse"
                    sx={{
                        width: VTT_HUD.hudBtnSize,
                        height: VTT_HUD.hudBtnSize,
                        color: DISCONNECT_RED,
                        border: `1px solid ${DISCONNECT_RED}88`,
                        bgcolor: "rgba(10,10,15,0.9)",
                        backdropFilter: "blur(8px)",
                        "&:hover": {
                            borderColor: DISCONNECT_RED,
                            bgcolor: "rgba(255,77,77,0.14)",
                            boxShadow: `0 0 12px ${DISCONNECT_RED}44`,
                        },
                    }}
                >
                    <LogoutIcon sx={{ fontSize: "1.1rem" }} />
                </IconButton>
            </Tooltip>
        </Box>
    );
}
