import { useState, useEffect, useRef } from "react";
import { Badge, Box, IconButton, Tooltip } from "@mui/material";
import PersonPinCircleIcon from "@mui/icons-material/PersonPinCircle";
import ChatIcon from "@mui/icons-material/Chat";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import { restoreDialog, openDialog, showSnackbar, openWikiOverlay } from "../../store/uiSlice";
import { DIALOG_IDS } from "../../constants/dialogIds";
import { resetWorldState } from "../../store/worldSlice";
import { fetchPlayerCharacters } from "../../store/characterSlice";
import { logoutPlayer } from "../../../firebase/playersAuth";
import { UI_COLORS } from "../../constants/uiColors";
import { ROLES } from "../../constants/roles";
import { VTT_HUD } from "../../constants/vttHudTokens";
import { useAssetUrl } from "../../hooks/useAssetUrl";

const menuItemSx = {
    display: "block",
    width: "100%",
    textAlign: "left",
    background: "none",
    border: "none",
    borderLeft: "2px solid transparent",
    color: "#fff",
    fontFamily: "'Fira Code', monospace",
    fontSize: "0.7rem",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    px: 1.25,
    py: 1.25,
    cursor: "pointer",
    transition: "background-color 0.15s, border-color 0.15s, color 0.15s, padding-left 0.15s",
    "&:hover": {
        bgcolor: "rgba(255,102,255,0.1)",
        borderLeftColor: UI_COLORS.accent,
        color: UI_COLORS.accent,
        pl: 2,
    },
};

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
    profile,
    tokenPanelOpen = false,
    onToggleTokenPanel,
    showTokenToggle = false,
    showChatToggle = false,
    chatPanelOpen = false,
    chatUnread = 0,
    onToggleChatPanel,
}) {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);

    const { list: characters } = useSelector((s) => s.characters);
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const locations = useSelector((s) => s.world.locations);
    const isDM = profile?.role === ROLES.DM || profile?.role === "gm";

    const activeCharacter = (() => {
        const fromSheet =
            characters.find((c) => c.id === profile?.activeCharacterId) ||
            characters[0] ||
            null;
        if (!fromSheet) return null;
        for (const loc of Object.values(locations || {})) {
            const live = loc.characters?.find((c) => c.id === fromSheet.id);
            if (live) return { ...fromSheet, ...live };
        }
        return fromSheet;
    })();

    const avatarPath = activeCharacter?.tokenImageUrl || activeCharacter?.imageUrl || null;
    const avatarUrl = useAssetUrl(avatarPath);

    /* Fetch player characters */
    useEffect(() => {
        if (profile?.uid) {
            dispatch(
                fetchPlayerCharacters({
                    uid: profile.uid,
                    characterIds: profile.characterIds || [],
                })
            );
        }
    }, [profile?.uid, profile?.characterIds, dispatch]);

    /* Close menu on outside click */
    useEffect(() => {
        const handler = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const handleLogout = async () => {
        setMenuOpen(false);
        try {
            await logoutPlayer();
            dispatch(resetWorldState());
        } catch (err) {
            console.error("Logout error:", err);
        }
    };

    const handleArchive = () => {
        setMenuOpen(false);
        if (!campaignId) {
            dispatch(
                showSnackbar({
                    message: "Selecciona una campaña antes de abrir el archivo narrativo.",
                    severity: "warning",
                })
            );
            return;
        }
        dispatch(restoreDialog(DIALOG_IDS.WIKI));
        dispatch(openWikiOverlay({ mode: "list" }));
    };

    const handleOpenSettings = () => {
        setMenuOpen(false);
        dispatch(restoreDialog(DIALOG_IDS.SETTINGS));
        dispatch(openDialog("settings"));
    };

    const avatarInitial = (profile?.nickname || "?")[0].toUpperCase();

    return (
        <Box
            ref={menuRef}
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

            {/* Profile avatar pill */}
            <Box
                component="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Profile menu"
                aria-expanded={menuOpen}
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    px: 1.5,
                    pl: 0.75,
                    height: VTT_HUD.profilePillHeight,
                    borderRadius: "20px",
                    border: `1px solid ${menuOpen ? UI_COLORS.accent : "rgba(255,102,255,0.22)"}`,
                    bgcolor: "rgba(10,10,15,0.9)",
                    backdropFilter: "blur(8px)",
                    cursor: "pointer",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                    boxShadow: menuOpen ? `0 0 16px rgba(255,102,255,0.25)` : "none",
                    "&:hover": {
                        borderColor: UI_COLORS.accent,
                    },
                }}
            >
                {/* Avatar circle */}
                <Box
                    sx={{
                        width: VTT_HUD.profileAvatarSize,
                        height: VTT_HUD.profileAvatarSize,
                        borderRadius: "50%",
                        border: `1px solid rgba(255,102,255,0.5)`,
                        bgcolor: "#050508",
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                    }}
                >
                    {avatarUrl ? (
                        <Box
                            component="img"
                            src={avatarUrl}
                            alt={activeCharacter?.name || "character"}
                            decoding="sync"
                            loading="eager"
                            sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                    ) : (
                        <Box
                            sx={{
                                fontFamily: "'Fira Code', monospace",
                                fontSize: "0.8rem",
                                fontWeight: 700,
                                color: UI_COLORS.accent,
                            }}
                        >
                            {avatarInitial}
                        </Box>
                    )}
                </Box>

                {/* Name info */}
                <Box sx={{ display: { xs: "none", sm: "flex" }, flexDirection: "column", gap: 0 }}>
                    {activeCharacter && (
                        <Box
                            sx={{
                                fontFamily: "'Fira Code', monospace",
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                color: "#fff",
                                letterSpacing: "0.06em",
                                lineHeight: 1.2,
                                textTransform: "uppercase",
                            }}
                        >
                            {activeCharacter.name}
                        </Box>
                    )}
                    <Box
                        sx={{
                            fontFamily: "'Fira Code', monospace",
                            fontSize: "0.6rem",
                            color: `${UI_COLORS.accent}bb`,
                            letterSpacing: "0.06em",
                            lineHeight: 1.2,
                            textTransform: "uppercase",
                        }}
                    >
                        {profile?.nickname}
                    </Box>
                </Box>
            </Box>

            {/* Dropdown menu */}
            {menuOpen && (
                <Box
                    sx={{
                        position: "absolute",
                        top: "calc(100% + 8px)",
                        right: 0,
                        minWidth: 220,
                        bgcolor: "rgba(5,5,8,0.97)",
                        border: `1px solid ${UI_COLORS.accent}`,
                        backdropFilter: "blur(12px)",
                        clipPath:
                            "polygon(0 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%)",
                        py: 1.5,
                        boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                        animation: "fadeDown 0.18s ease-out",
                        "@keyframes fadeDown": {
                            from: { opacity: 0, transform: "translateY(-8px)" },
                            to: { opacity: 1, transform: "translateY(0)" },
                        },
                    }}
                >
                    <Box
                        sx={{
                            fontFamily: "'Fira Code', monospace",
                            fontSize: "0.55rem",
                            color: `${UI_COLORS.accent}88`,
                            letterSpacing: "0.18em",
                            textTransform: "uppercase",
                            px: 1.5,
                            mb: 1,
                        }}
                    >
                        SYSTEM_SESSIONS
                    </Box>

                    <Box
                        component="button"
                        onClick={() => {
                            setMenuOpen(false);
                            dispatch(openDialog("sheet"));
                        }}
                        sx={menuItemSx}
                    >
                        ⚔ MIS_PERSONAJES
                    </Box>

                    {isDM && (
                        <Box
                            component="button"
                            onClick={handleOpenSettings}
                            sx={menuItemSx}
                        >
                            ⚙ CONFIGURACIÓN
                        </Box>
                    )}

                    {isDM && (
                        <Box
                            component="button"
                            onClick={handleArchive}
                            sx={menuItemSx}
                        >
                            ◈ NARRATIVE_ARCHIVE
                        </Box>
                    )}

                    <Box
                        component="button"
                        onClick={handleLogout}
                        sx={{
                            ...menuItemSx,
                            color: "#ff4d4d",
                            mt: 0.5,
                            "&:hover": {
                                bgcolor: "rgba(255,77,77,0.1)",
                                borderLeftColor: "#ff4d4d",
                                color: "#ff4d4d",
                                pl: 2,
                            },
                        }}
                    >
                        TERMINATE_CONNECTION
                    </Box>
                </Box>
            )}
        </Box>
    );
}
