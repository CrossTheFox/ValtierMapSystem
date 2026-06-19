import { useState, useEffect, useRef } from "react";
import { Box } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import { openDialog, showSnackbar, setIsMinimized, openWikiOverlay, setWikiOverlayMinimized } from "../../store/uiSlice";
import { resetWorldState } from "../../store/worldSlice";
import { fetchPlayerCharacters } from "../../store/characterSlice";
import { logoutPlayer } from "../../../firebase/playersAuth";
import { loadFirebaseAsset } from "../../../firebase/services/assetLoader";
import { UI_COLORS } from "../../constants/uiColors";
import { ROLES } from "../../constants/roles";
import { VTT_HUD } from "../../constants/vttHudTokens";

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

export default function TopRightHUD({ profile }) {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState(null);
    const menuRef = useRef(null);

    const { list: characters } = useSelector((s) => s.characters);
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const isDM = profile?.role === ROLES.DM;

    const activeCharacter =
        characters.find((c) => c.id === profile?.activeCharacterId) ||
        characters[0] ||
        null;

    /* Load avatar */
    useEffect(() => {
        if (activeCharacter?.imageUrl) {
            loadFirebaseAsset(activeCharacter.imageUrl)
                .then(setAvatarUrl)
                .catch(() => setAvatarUrl(null));
        } else {
            setAvatarUrl(null);
        }
    }, [activeCharacter?.imageUrl]);

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
        dispatch(setWikiOverlayMinimized(false));
        dispatch(openWikiOverlay({ mode: "list" }));
    };

    const handleOpenSettings = () => {
        setMenuOpen(false);
        dispatch(setIsMinimized(false));
        dispatch(openDialog("settings"));
    };

    const avatarInitial = (profile?.nickname || "?")[0].toUpperCase();

    return (
        <Box
            ref={menuRef}
            sx={{
                position: "fixed",
                top: VTT_HUD.inset,
                right: VTT_HUD.inset,
                zIndex: 1200,
                pointerEvents: "auto",
                display: "flex",
                alignItems: "center",
                gap: 0.75,
            }}
        >
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
                    height: 40,
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
