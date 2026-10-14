import { Badge, Box, IconButton } from "@mui/material";
import PersonPinCircleIcon from "@mui/icons-material/PersonPinCircle";
import ChatIcon from "@mui/icons-material/Chat";
import GroupsIcon from "@mui/icons-material/Groups";
import ArchiveExitMenu from "../wiki/ArchiveExitMenu";

import { UI_COLORS } from "../../constants/uiColors";
import { VTT_HUD } from "../../constants/vttHudTokens";
import CyberTooltip from "../customs/CyberTooltip";

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

            <ArchiveExitMenu />
        </Box>
    );
}
