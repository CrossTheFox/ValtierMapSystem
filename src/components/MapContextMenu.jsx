import { useEffect, useMemo, useRef, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Box } from "@mui/material";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import {
    closeContextMenu,
    openLocation,
    showSnackbar,
} from "../store/uiSlice";
import { setActiveCharacterId, persistActiveCharacter } from "../store/playerSlice";
import { snapWorldToGridPoint } from "../utils/gridMath";
import {
    publishMapPing,
    updateTokenVisibility,
} from "../../firebase/services/gameService";
import { updateCharacterFields } from "../../firebase/services/characterService";
import { UI_COLORS } from "../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../constants/cyberScrollStyle";
import { HUD_SURFACE } from "../constants/designSystem";
import { VTT_HUD } from "../constants/vttHudTokens";
import { CyberText, CyberTitle } from "./customs/CustomTexts";
import {
    filterCharacterConditions,
    normalizeCharacterConditions,
} from "../constants/characterConditions";
import { ConditionsPanel } from "./characters/ConditionDrawer";
import { canControlToken, isDmRole } from "../utils/tokenControl";
import { useHudActivatedCharacters } from "../hooks/useHudActivatedCharacters";
import { ShowCharacterToTableContextRow } from "./vtt/ShowCharacterToTableAction";

const PANEL_W = 300;
const COND_LIST_MAX_H = 280;

export default function MapContextMenu() {
    const dispatch = useDispatch();
    const contextMenu = useSelector((s) => s.ui.contextMenu);
    const map = useSelector((s) => s.world.map);
    const mapId = useSelector((s) => s.world.activeMapId ?? s.world.map?.id);
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const gridConfig = useSelector((s) => s.world.gridConfig);
    const profile = useSelector((s) => s.player.profile);
    const tokenPositions = useSelector((s) => s.game.tokenPositions ?? {});
    const charactersById = useSelector((s) => s.world.charactersById ?? {});
    const menuRef = useRef(null);
    const [condQuery, setCondQuery] = useState("");
    const { addActivated } = useHudActivatedCharacters(profile?.uid, campaignId);

    useEffect(() => {
        if (!contextMenu.open) {
            setCondQuery("");
            return;
        }

        const handler = (e) => {
            if (e.button === 2) return;
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                dispatch(closeContextMenu());
            }
        };

        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [contextMenu.open, dispatch]);

    const filteredConditions = useMemo(
        () => filterCharacterConditions(condQuery),
        [condQuery],
    );

    if (!contextMenu.open) return null;

    const isToken = contextMenu.type === "token" && contextMenu.tokenId;
    const tokenId = contextMenu.tokenId;
    const pos = isToken && mapId ? tokenPositions[mapId]?.[tokenId] : null;
    const char = isToken ? charactersById[tokenId] : null;
    const canEdit = isToken && canControlToken(char || { id: tokenId }, profile);
    const isDM = isDmRole(profile?.role);
    const conditions = normalizeCharacterConditions(char?.conditions);
    const isHidden = pos?.visible === false;
    const charName = (char?.name || contextMenu.tokenName || tokenId || "TOKEN").toUpperCase();
    const activePrincipalId = profile?.activeCharacterId || null;
    const isPrincipal = Boolean(tokenId && activePrincipalId === tokenId);

    const pointLabel = isToken
        ? charName
        : contextMenu.location?.name
            ? contextMenu.location.name.toUpperCase()
            : `(${Math.round(contextMenu.worldX)}, ${Math.round(contextMenu.worldY)})`;

    const handleViewLocation = () => {
        dispatch(openLocation(contextMenu.location));
        dispatch(closeContextMenu());
    };

    const handlePing = () => {
        if (!campaignId || !mapId) {
            dispatch(showSnackbar({ message: "Sin campaña/mapa activo", severity: "warning" }));
            dispatch(closeContextMenu());
            return;
        }
        const point = snapWorldToGridPoint(
            contextMenu.worldX,
            contextMenu.worldY,
            map,
            gridConfig,
        );
        dispatch(closeContextMenu());
        publishMapPing(campaignId, {
            mapId,
            x: point.x,
            y: point.y,
            col: point.col,
            row: point.row,
            createdBy: profile?.uid ?? null,
            createdByName: profile?.nickname ?? null,
        }).catch((err) => {
            console.error(err);
            dispatch(showSnackbar({ message: "No se pudo publicar el ping", severity: "error" }));
        });
    };

    const handleToggleCondition = (key) => {
        if (!tokenId || !char) return;
        const next = conditions.includes(key)
            ? conditions.filter((k) => k !== key)
            : [...conditions, key];
        updateCharacterFields(tokenId, { conditions: next }).catch((err) => {
            console.error(err);
            dispatch(showSnackbar({ message: "No se pudo actualizar condición", severity: "error" }));
        });
    };

    const handleToggleVisibility = () => {
        if (!campaignId || !mapId || !tokenId || !pos || !isDM) return;
        updateTokenVisibility(campaignId, mapId, tokenId, isHidden, pos).catch((err) => {
            console.error(err);
            dispatch(showSnackbar({ message: "No se pudo cambiar visibilidad", severity: "error" }));
        });
    };

    const handleAddToHud = () => {
        if (!isDM || !tokenId || !char || !profile?.uid) return;
        dispatch(setActiveCharacterId(tokenId));
        dispatch(persistActiveCharacter({ uid: profile.uid, characterId: tokenId }));
        addActivated(tokenId);
        dispatch(closeContextMenu());
        dispatch(showSnackbar({
            message: `${char.name || "Personaje"} agregado al HUD`,
            severity: "success",
        }));
    };

    const menuH = isToken ? 460 : contextMenu.type === "location" ? 140 : 100;
    const x = Math.min(contextMenu.screenX, window.innerWidth - PANEL_W - 8);
    const y = Math.min(contextMenu.screenY, window.innerHeight - menuH - 8);

    const hudBtnSx = {
        display: "flex",
        alignItems: "center",
        gap: 1,
        width: "100%",
        px: 1.25,
        py: 0.85,
        border: "none",
        borderTop: `1px solid ${VTT_HUD.glassBorder}`,
        bgcolor: "transparent",
        color: UI_COLORS.textPrimary,
        fontFamily: "'Fira Code', monospace",
        fontSize: "0.68rem",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        cursor: "pointer",
        textAlign: "left",
        transition: "background-color 0.12s, color 0.12s",
        "&:hover": {
            bgcolor: `${UI_COLORS.accent}14`,
            color: UI_COLORS.accent,
        },
    };

    return (
        <>
            <div style={{ position: "fixed", inset: 0, zIndex: 1999, pointerEvents: "none" }} />
            <Box
                ref={menuRef}
                data-map-context-menu
                sx={{
                    position: "fixed",
                    left: x,
                    top: y,
                    zIndex: 2000,
                    pointerEvents: "auto",
                    width: PANEL_W,
                    maxHeight: "min(520px, calc(100vh - 24px))",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))",
                    ...HUD_SURFACE,
                    backdropFilter: "blur(14px)",
                    WebkitBackdropFilter: "blur(14px)",
                    boxShadow: "0 12px 32px rgba(0,0,0,0.45), 0 0 18px rgba(255,102,255,0.12)",
                    animation: "mapCtxIn 0.12s cubic-bezier(0.2, 0, 0.2, 1)",
                    "@keyframes mapCtxIn": {
                        from: { opacity: 0, transform: "scale(0.96) translateY(-4px)" },
                        to: { opacity: 1, transform: "scale(1) translateY(0)" },
                    },
                    "@media (prefers-reduced-motion: reduce)": {
                        animation: "none",
                    },
                }}
            >
                <Box
                    sx={{
                        px: 1.5,
                        py: 1,
                        borderBottom: `1px solid ${VTT_HUD.glassBorder}`,
                        flexShrink: 0,
                    }}
                >
                    <CyberTitle
                        sx={{
                            fontSize: "0.48rem",
                            letterSpacing: "0.18em",
                            color: UI_COLORS.anomaly,
                            lineHeight: 1.2,
                            mb: 0.35,
                        }}
                    >
                        {isToken ? "TOKEN" : contextMenu.type === "location" ? "LOCATION" : "MAP POINT"}
                    </CyberTitle>
                    <CyberText
                        sx={{
                            fontSize: "0.72rem",
                            color: UI_COLORS.textPrimary,
                            letterSpacing: "0.06em",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {pointLabel}
                    </CyberText>
                </Box>

                {contextMenu.type === "location" && (
                    <Box component="button" type="button" onClick={handleViewLocation} sx={hudBtnSx}>
                        VIEW LOCATION
                    </Box>
                )}

                {!isToken && (
                    <Box component="button" type="button" onClick={handlePing} sx={hudBtnSx}>
                        HACER PING
                    </Box>
                )}

                {isToken && isDM && char && (
                    <Box
                        component="button"
                        type="button"
                        onClick={handleAddToHud}
                        sx={{
                            ...hudBtnSx,
                            color: isPrincipal ? UI_COLORS.anomaly : UI_COLORS.textPrimary,
                            borderBottom: `1px solid ${VTT_HUD.glassBorder}`,
                        }}
                    >
                        <PersonAddIcon sx={{ fontSize: "1rem", color: UI_COLORS.anomaly }} />
                        {isPrincipal ? "PRINCIPAL EN HUD" : "ELEGIR COMO PRINCIPAL"}
                    </Box>
                )}

                {isToken && char && (
                    <ShowCharacterToTableContextRow
                        character={char}
                        hudBtnSx={hudBtnSx}
                        onDone={() => dispatch(closeContextMenu())}
                    />
                )}

                {isToken && canEdit && char && (
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            flex: "1 1 auto",
                            minHeight: 0,
                            borderTop: `1px solid ${VTT_HUD.glassBorder}`,
                        }}
                    >
                        <Box
                            component="input"
                            type="search"
                            value={condQuery}
                            onChange={(e) => setCondQuery(e.target.value)}
                            placeholder="BUSCAR STATUS…"
                            aria-label="Buscar condiciones"
                            onMouseDown={(e) => e.stopPropagation()}
                            sx={{
                                display: "block",
                                width: "calc(100% - 20px)",
                                mx: "10px",
                                mt: 1,
                                mb: 0.5,
                                px: 1,
                                py: 0.6,
                                bgcolor: "rgba(0,0,0,0.45)",
                                border: `1px solid ${VTT_HUD.glassBorder}`,
                                borderRadius: 0.5,
                                color: UI_COLORS.textPrimary,
                                fontFamily: "'Fira Code', monospace",
                                fontSize: "0.62rem",
                                letterSpacing: "0.08em",
                                outline: "none",
                                flexShrink: 0,
                                "&::placeholder": {
                                    color: UI_COLORS.textSecondary,
                                    opacity: 0.85,
                                },
                                "&:focus": {
                                    borderColor: UI_COLORS.anomaly,
                                    boxShadow: `0 0 8px ${UI_COLORS.anomaly}33`,
                                },
                            }}
                        />
                        <Box
                            sx={{
                                flex: "1 1 auto",
                                minHeight: 0,
                                minWidth: 0,
                                maxHeight: COND_LIST_MAX_H,
                                overflowY: "auto",
                                overflowX: "hidden",
                                ...CYBER_SCROLL_STYLE,
                            }}
                        >
                            {filteredConditions.length === 0 ? (
                                <CyberText
                                    sx={{
                                        px: 1.5,
                                        py: 1,
                                        fontSize: "0.58rem",
                                        color: UI_COLORS.textSecondary,
                                        letterSpacing: "0.08em",
                                    }}
                                >
                                    SIN RESULTADOS
                                </CyberText>
                            ) : (
                                <ConditionsPanel
                                    activeKeys={conditions}
                                    onToggle={handleToggleCondition}
                                    filterQuery={condQuery}
                                    embedded
                                    showHeader
                                    onClose={null}
                                    sx={{ p: "6px 10px 10px" }}
                                />
                            )}
                        </Box>
                    </Box>
                )}

                {isToken && isDM && (
                    <Box
                        component="button"
                        type="button"
                        onClick={handleToggleVisibility}
                        sx={hudBtnSx}
                    >
                        {isHidden
                            ? <VisibilityIcon sx={{ fontSize: "1rem", color: UI_COLORS.anomaly }} />
                            : <VisibilityOffIcon sx={{ fontSize: "1rem", color: UI_COLORS.textSecondary }} />}
                        {isHidden ? "MOSTRAR A JUGADORES" : "OCULTAR A JUGADORES"}
                    </Box>
                )}
            </Box>
        </>
    );
}
