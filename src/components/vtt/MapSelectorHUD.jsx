import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    Box, IconButton, Tooltip, Popover, Stack, TextField, Button, Menu, MenuItem, Chip, Divider,
} from "@mui/material";
import GridOnIcon from "@mui/icons-material/GridOn";
import GridOffIcon from "@mui/icons-material/GridOff";
import PublicIcon from "@mui/icons-material/Public";
import TuneIcon from "@mui/icons-material/Tune";
import MapIcon from "@mui/icons-material/Map";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import CheckIcon from "@mui/icons-material/Check";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import HubIcon from "@mui/icons-material/Hub";
import SportsKabaddiIcon from "@mui/icons-material/SportsKabaddi";
import { switchMap, setGridConfig, persistMapGridConfig } from "../../store/worldSlice";
import { openDialog, openWikiOverlay, restoreDialog, showSnackbar } from "../../store/uiSlice";
import { setActiveMapForPlayers, updateInitiative, normalizeInitiative } from "../../../firebase/services/gameService";
import { CyberText, CyberTitle } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { VTT_HUD } from "../../constants/vttHudTokens";
import { cyberMenuItemSx, cyberMenuPaperSx } from "../../constants/designSystem";
import { DIALOG_IDS } from "../../constants/dialogIds";
import { DEFAULT_GRID_COLUMNS, resolveCellSize } from "../../utils/gridMath";
import { isDmRole } from "../../utils/tokenControl";
import { isEmptyTableMap } from "../../constants/emptyTableMap";

const navIconSx = (active) => ({
    width: 32,
    height: 32,
    borderRadius: 1,
    border: `1px solid ${active ? `${UI_COLORS.anomaly}77` : UI_COLORS.border}`,
    bgcolor: active ? `${UI_COLORS.anomaly}16` : "rgba(0,0,0,0.22)",
    color: active ? UI_COLORS.anomaly : UI_COLORS.textSecondary,
    transition: "color 0.18s, border-color 0.18s, background-color 0.18s, box-shadow 0.18s",
    "&:hover": {
        color: UI_COLORS.accent,
        borderColor: UI_COLORS.accent,
        bgcolor: `${UI_COLORS.accent}14`,
        boxShadow: `0 0 10px ${UI_COLORS.accentGlow}`,
    },
});

export default function MapSelectorHUD({ children = null }) {
    const dispatch = useDispatch();
    const maps = useSelector((s) => s.world.maps);
    const map = useSelector((s) => s.world.map);
    const activeMapId = useSelector((s) => s.world.activeMapId);
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const campaignName = useSelector((s) => s.world.selectedCampaignName);
    const role = useSelector((s) => s.player.profile?.role);
    const gridConfig = useSelector((s) => s.world.gridConfig);
    const gameActiveMapId = useSelector((s) => s.game.activeMapId);
    const { openDialogs, wikiOverlay } = useSelector((s) => s.ui);
    const initiative = useSelector((s) => s.game.initiative);

    const [gridAnchor, setGridAnchor] = useState(null);
    const [mapMenuAnchor, setMapMenuAnchor] = useState(null);
    const [colsDraft, setColsDraft] = useState(String(gridConfig?.columns ?? DEFAULT_GRID_COLUMNS));

    const isDM = isDmRole(role);
    const emptyTable = isEmptyTableMap(map) || !maps?.length;
    const displayMapId = isDM ? activeMapId : (gameActiveMapId ?? activeMapId);
    const currentMap = maps?.find((m) => m.id === displayMapId) || map;
    const viewingPublished = Boolean(displayMapId && gameActiveMapId && displayMapId === gameActiveMapId);
    const resolvedCell = resolveCellSize(map, gridConfig);
    const mapId = emptyTable ? null : (activeMapId ?? map?.id);
    const mapLocked = !isDM && !!gameActiveMapId;
    const campaignLabel = (campaignName || "VALT6-01").toUpperCase();

    const handleSwitch = async (nextMapId) => {
        if (!campaignId || !nextMapId) return;
        setMapMenuAnchor(null);
        await dispatch(switchMap({ mapId: nextMapId, campaignId }));
    };

    const handleSetActiveForPlayers = async () => {
        if (!campaignId || !activeMapId) return;
        await setActiveMapForPlayers(campaignId, activeMapId);
    };

    const toggleGrid = () => {
        dispatch(setGridConfig({ visible: !gridConfig?.visible }));
    };

    const openGridSettings = (e) => {
        setColsDraft(String(gridConfig?.columns ?? DEFAULT_GRID_COLUMNS));
        setGridAnchor(e.currentTarget);
    };

    const applyColumns = () => {
        const n = Math.max(1, Math.min(200, parseInt(colsDraft, 10) || DEFAULT_GRID_COLUMNS));
        if (mapId) {
            dispatch(persistMapGridConfig({
                mapId,
                partial: { columns: n, cellSize: null, rows: null },
            }));
        } else {
            dispatch(setGridConfig({ columns: n, cellSize: null, rows: null }));
        }
        setColsDraft(String(n));
        setGridAnchor(null);
    };

    const resetColumns = () => {
        if (mapId) {
            dispatch(persistMapGridConfig({
                mapId,
                partial: { columns: DEFAULT_GRID_COLUMNS, cellSize: null, rows: null },
            }));
        } else {
            dispatch(setGridConfig({ columns: DEFAULT_GRID_COLUMNS, cellSize: null, rows: null }));
        }
        setColsDraft(String(DEFAULT_GRID_COLUMNS));
        setGridAnchor(null);
    };

    return (
        <Box
            sx={{
                position: "fixed",
                top: VTT_HUD.inset,
                left: VTT_HUD.inset,
                zIndex: 1250,
                pointerEvents: "auto",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 0.65,
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.85,
                    px: 1.25,
                    py: 1,
                    minWidth: 260,
                    borderRadius: `${VTT_HUD.borderRadius}px`,
                    border: `1px solid ${VTT_HUD.glassBorder}`,
                    bgcolor: VTT_HUD.glassBg,
                    backdropFilter: "blur(14px)",
                    boxShadow: "0 0 22px rgba(255,102,255,0.08)",
                }}
            >
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                <Box
                    sx={{
                        fontFamily: "'Orbitron', sans-serif",
                        fontSize: VTT_HUD.titleFontSize,
                        letterSpacing: VTT_HUD.titleLetterSpacing,
                        color: UI_COLORS.accent,
                        lineHeight: 1.1,
                    }}
                >
                    {campaignLabel}
                </Box>
                <Box sx={{ display: "flex", gap: 0.4 }}>
                    <Tooltip title="Personajes" placement="bottom">
                        <IconButton
                            size="small"
                            onClick={() => dispatch(openDialog("characters"))}
                            sx={navIconSx(openDialogs.characters)}
                        >
                            <PeopleAltIcon sx={{ fontSize: "1.05rem" }} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Lore" placement="bottom">
                        <IconButton
                            size="small"
                            onClick={() => dispatch(openDialog("loreBrowser"))}
                            sx={navIconSx(openDialogs.loreBrowser)}
                        >
                            <AutoStoriesIcon sx={{ fontSize: "1.05rem" }} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Narrative Archive" placement="bottom">
                        <IconButton
                            size="small"
                            onClick={() => {
                                dispatch(restoreDialog(DIALOG_IDS.WIKI));
                                dispatch(openWikiOverlay({ mode: "list" }));
                            }}
                            sx={navIconSx(wikiOverlay.open)}
                        >
                            <HubIcon sx={{ fontSize: "1.05rem" }} />
                        </IconButton>
                    </Tooltip>
                    {isDM && (
                        <Tooltip title={initiative?.open ? "Cerrar iniciativa" : "Abrir iniciativa"} placement="bottom">
                            <IconButton
                                size="small"
                                onClick={async () => {
                                    if (!campaignId) return;
                                    const cur = normalizeInitiative(initiative);
                                    try {
                                        await updateInitiative(campaignId, {
                                            ...cur,
                                            open: !cur.open,
                                        });
                                    } catch (err) {
                                        console.error(err);
                                        dispatch(showSnackbar({
                                            message: "No se pudo actualizar iniciativa",
                                            severity: "error",
                                        }));
                                    }
                                }}
                                sx={navIconSx(!!initiative?.open)}
                            >
                                <SportsKabaddiIcon sx={{ fontSize: "1.05rem" }} />
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>
            </Box>

            <Divider sx={{ borderColor: `${UI_COLORS.border}99` }} />

            <Box sx={{ display: "flex", alignItems: "center", gap: 0.65 }}>
                <Tooltip title={mapLocked ? "Mapa fijado por el DM" : "Cambiar mapa"}>
                    <Box
                        component="button"
                        type="button"
                        onClick={(e) => !mapLocked && maps?.length && setMapMenuAnchor(e.currentTarget)}
                        disabled={mapLocked || !maps?.length}
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.65,
                            flex: 1,
                            minWidth: 0,
                            px: 1,
                            py: 0.55,
                            borderRadius: 1,
                            border: `1px solid ${viewingPublished ? `${UI_COLORS.anomaly}88` : UI_COLORS.border}`,
                            bgcolor: viewingPublished ? `${UI_COLORS.anomaly}14` : "rgba(0,0,0,0.28)",
                            color: UI_COLORS.textPrimary,
                            cursor: mapLocked || !maps?.length ? "default" : "pointer",
                            fontFamily: "'Fira Code', monospace",
                            fontSize: "0.68rem",
                            letterSpacing: 0.3,
                            opacity: mapLocked ? 0.85 : 1,
                            transition: "border-color 0.2s, background-color 0.2s",
                            "&:hover": mapLocked || !maps?.length ? {} : {
                                borderColor: UI_COLORS.accent,
                                bgcolor: `${UI_COLORS.accent}12`,
                            },
                        }}
                    >
                        <MapIcon sx={{ fontSize: "1rem", color: viewingPublished ? UI_COLORS.anomaly : UI_COLORS.accent, flexShrink: 0 }} />
                        <Box
                            component="span"
                            sx={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                minWidth: 0,
                                flex: 1,
                                textAlign: "left",
                            }}
                        >
                            {emptyTable ? "Sin mapa" : (currentMap?.name ?? "Mapa")}
                        </Box>
                        {viewingPublished && (
                            <Chip
                                label="LIVE"
                                size="small"
                                sx={{
                                    height: 16,
                                    fontSize: "0.48rem",
                                    fontFamily: "'Orbitron', sans-serif",
                                    letterSpacing: 0.6,
                                    bgcolor: `${UI_COLORS.anomaly}22`,
                                    color: UI_COLORS.anomaly,
                                    border: `1px solid ${UI_COLORS.anomaly}66`,
                                    "& .MuiChip-label": { px: 0.5 },
                                }}
                            />
                        )}
                        {!mapLocked && maps?.length > 0 && (
                            <KeyboardArrowDownIcon sx={{ fontSize: "1rem", color: UI_COLORS.textSecondary, flexShrink: 0 }} />
                        )}
                    </Box>
                </Tooltip>

                <Tooltip title={gridConfig?.visible ? "Ocultar grilla" : "Mostrar grilla"}>
                    <IconButton size="small" onClick={toggleGrid} sx={navIconSx(!!gridConfig?.visible)}>
                        {gridConfig?.visible
                            ? <GridOnIcon sx={{ fontSize: "1.05rem" }} />
                            : <GridOffIcon sx={{ fontSize: "1.05rem" }} />}
                    </IconButton>
                </Tooltip>

                {isDM && (
                    <Tooltip title="Configurar grilla">
                        <IconButton size="small" onClick={openGridSettings} sx={navIconSx(false)}>
                            <TuneIcon sx={{ fontSize: "1.05rem" }} />
                        </IconButton>
                    </Tooltip>
                )}

                {isDM && (
                    <Tooltip title={viewingPublished ? "Mapa ya publicado" : "Publicar mapa a jugadores"}>
                        <IconButton
                            size="small"
                            onClick={handleSetActiveForPlayers}
                            sx={navIconSx(viewingPublished)}
                        >
                            <PublicIcon sx={{ fontSize: "1.05rem" }} />
                        </IconButton>
                    </Tooltip>
                )}
            </Box>

            <Menu
                anchorEl={mapMenuAnchor}
                open={Boolean(mapMenuAnchor)}
                onClose={() => setMapMenuAnchor(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                transformOrigin={{ vertical: "top", horizontal: "left" }}
                slotProps={{
                    paper: {
                        sx: {
                            ...cyberMenuPaperSx,
                            mt: 0.75,
                            minWidth: 240,
                            maxWidth: 320,
                            maxHeight: 360,
                        },
                    },
                }}
            >
                <Box sx={{ px: 1.25, py: 0.75, borderBottom: `1px solid ${UI_COLORS.border}` }}>
                    <CyberText sx={{ fontSize: "0.55rem", color: UI_COLORS.textSecondary, letterSpacing: 1 }}>
                        MAPAS DE CAMPAÑA
                    </CyberText>
                </Box>
                {(maps || []).map((m) => {
                    const isViewing = m.id === displayMapId;
                    const isPublished = m.id === gameActiveMapId;
                    return (
                        <MenuItem
                            key={m.id}
                            selected={isViewing}
                            onClick={() => handleSwitch(m.id)}
                            sx={{
                                ...cyberMenuItemSx,
                                fontSize: "0.72rem",
                                gap: 1,
                                py: 0.85,
                            }}
                        >
                            {isViewing ? (
                                <CheckIcon sx={{ fontSize: "0.9rem", color: UI_COLORS.accent }} />
                            ) : (
                                <Box sx={{ width: 14 }} />
                            )}
                            <Box
                                sx={{
                                    flex: 1,
                                    minWidth: 0,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    color: UI_COLORS.textPrimary,
                                }}
                            >
                                {m.name ?? m.id}
                            </Box>
                            {isPublished && (
                                <Chip
                                    label="PUBLICADO"
                                    size="small"
                                    sx={{
                                        height: 18,
                                        fontSize: "0.48rem",
                                        fontFamily: "'Orbitron', sans-serif",
                                        letterSpacing: 0.5,
                                        bgcolor: `${UI_COLORS.anomaly}18`,
                                        color: UI_COLORS.anomaly,
                                        border: `1px solid ${UI_COLORS.anomaly}66`,
                                        "& .MuiChip-label": { px: 0.55 },
                                    }}
                                />
                            )}
                        </MenuItem>
                    );
                })}
            </Menu>

            <Popover
                open={Boolean(gridAnchor)}
                anchorEl={gridAnchor}
                onClose={() => setGridAnchor(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                transformOrigin={{ vertical: "top", horizontal: "left" }}
                slotProps={{
                    paper: {
                        sx: {
                            mt: 1,
                            p: 1.5,
                            bgcolor: UI_COLORS.backgroundSecondary,
                            border: `1px solid ${UI_COLORS.border}`,
                            minWidth: 220,
                        },
                    },
                }}
            >
                <CyberTitle sx={{ fontSize: "0.65rem", color: UI_COLORS.anomaly, letterSpacing: 2, mb: 1 }}>
                    GRILLA DEL MAPA
                </CyberTitle>
                <Stack spacing={1.25}>
                    <TextField
                        size="small"
                        label="Columnas"
                        type="number"
                        value={colsDraft}
                        onChange={(e) => setColsDraft(e.target.value)}
                        inputProps={{ min: 1, max: 200 }}
                        sx={{
                            "& .MuiInputBase-input": { color: UI_COLORS.textPrimary, fontSize: "0.8rem" },
                            "& .MuiInputLabel-root": { color: UI_COLORS.textSecondary },
                            "& .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.border },
                        }}
                    />
                    <CyberText sx={{ fontSize: "0.62rem", color: UI_COLORS.textSecondary }}>
                        Celda ≈ {resolvedCell}px · se guarda en este mapa para todos
                    </CyberText>
                    <Stack direction="row" spacing={1}>
                        <Button
                            size="small"
                            onClick={applyColumns}
                            sx={{
                                color: UI_COLORS.accent,
                                border: `1px solid ${UI_COLORS.accent}66`,
                                fontFamily: "Orbitron, sans-serif",
                                fontSize: "0.6rem",
                                letterSpacing: 1,
                            }}
                        >
                            Aplicar
                        </Button>
                        <Button
                            size="small"
                            onClick={resetColumns}
                            sx={{
                                color: UI_COLORS.textSecondary,
                                border: `1px solid ${UI_COLORS.border}`,
                                fontFamily: "Orbitron, sans-serif",
                                fontSize: "0.6rem",
                                letterSpacing: 1,
                            }}
                        >
                            Reset
                        </Button>
                    </Stack>
                </Stack>
            </Popover>
            </Box>

            {children}
        </Box>
    );
}
