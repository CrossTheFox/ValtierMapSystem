import { useEffect, useMemo, useState } from "react";
import { Box, IconButton } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import CasinoIcon from "@mui/icons-material/Casino";
import WidgetsIcon from "@mui/icons-material/Widgets";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import StraightenIcon from "@mui/icons-material/Straighten";
import CategoryIcon from "@mui/icons-material/Category";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { CyberText } from "../customs/CustomTexts";
import CyberTooltip from "../customs/CyberTooltip";
import { UI_COLORS } from "../../constants/uiColors";
import { VTT_HUD } from "../../constants/vttHudTokens";
import { setRulerMode, setDrawMode, setDrawShape, setDrawCircleMode, setDrawColor, showSnackbar } from "../../store/uiSlice";
import { canControlToken, isDmRole } from "../../utils/tokenControl";
import { listCampaignCharacters } from "../../utils/characterCombat";
import { removeMapRuler, removeMapDrawing, updateMapDrawing } from "../../../firebase/services/gameService";
import {
    CIRCLE_MODES,
    DRAW_COLOR_PRESETS,
    DRAW_SHAPES,
    shapeLabel,
    normalizeDrawingPaths,
} from "../../utils/mapDrawings";
import DiceRollerBar from "./DiceRollerBar";

/** Max concurrent open sub-panels; opening another closes the oldest (FIFO). */
const MAX_OPEN_PANELS = 4;

const TOOL_IDS = {
    RULER: "ruler",
    SHAPES: "shapes",
    DICE: "dice",
};

const glassBtnSx = (active) => ({
    width: 36,
    height: 36,
    borderRadius: 1,
    border: `1px solid ${active ? UI_COLORS.anomaly : VTT_HUD.glassBorder}`,
    bgcolor: VTT_HUD.glassBg,
    backdropFilter: "blur(14px)",
    color: active ? UI_COLORS.anomaly : UI_COLORS.accent,
    boxShadow: active
        ? `0 0 12px ${UI_COLORS.anomaly}44`
        : "0 0 12px rgba(255,102,255,0.06)",
    flexShrink: 0,
    transition: "border-color 0.15s, box-shadow 0.15s, color 0.15s",
    "&:hover": {
        borderColor: UI_COLORS.accent,
        bgcolor: `${UI_COLORS.accent}14`,
    },
});

const panelShellSx = {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: 0.45,
    p: 0.65,
    maxWidth: "min(340px, calc(100vw - 72px))",
    borderRadius: `${VTT_HUD.borderRadius}px`,
    border: `1px solid ${VTT_HUD.glassBorder}`,
    bgcolor: VTT_HUD.glassBg,
    backdropFilter: "blur(14px)",
    // Own compositor layer — avoids glass flash when the dice veil opacity flips.
    transform: "translateZ(0)",
    boxShadow: "0 0 18px rgba(255,102,255,0.08)",
    animation: "leftToolsPanelIn 0.18s ease",
    "@keyframes leftToolsPanelIn": {
        from: { opacity: 0, transform: "translateY(-6px) translateZ(0)" },
        to: { opacity: 1, transform: "translateY(0) translateZ(0)" },
    },
    "@media (prefers-reduced-motion: reduce)": {
        animation: "none",
    },
};

/**
 * Roll20-style tool row: button on the left, panel starts flush to its right
 * and grows downward. Tall panels push subsequent rows down.
 */
function ToolRow({ open, button, panel }) {
    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 0.65,
                minHeight: 36,
            }}
        >
            {button}
            {open ? panel : null}
        </Box>
    );
}

/**
 * Roll20-style left tools tray under the campaign/map surface.
 * Master toggle reveals sub-buttons; each opens a panel to its right, growing down.
 * Up to {@link MAX_OPEN_PANELS} panels; a newer open closes the oldest.
 */
export default function LeftToolsRail() {
    const dispatch = useDispatch();
    const profile = useSelector((s) => s.player.profile);
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const mapId = useSelector((s) => s.world.activeMapId ?? s.world.map?.id);
    const locations = useSelector((s) => s.world.locations);
    const charactersById = useSelector((s) => s.world.charactersById ?? {});
    const sheetCharacters = useSelector((s) => s.characters.list);
    const rulers = useSelector((s) => s.game.rulers ?? {});
    const drawings = useSelector((s) => s.game.drawings ?? {});
    const rulerActive = useSelector((s) => !!s.ui.rulerTool?.active);
    const drawTool = useSelector((s) => s.ui.drawTool);
    const drawActive = !!drawTool?.active;
    const selectedDrawingIds = useSelector((s) => s.ui.selectedDrawingIds ?? []);

    const [toolsRailOpen, setToolsRailOpen] = useState(false);
    /** Open panel ids in open-order (oldest → newest). */
    const [openOrder, setOpenOrder] = useState([]);

    const isDM = isDmRole(profile?.role);

    const roster = useMemo(() => {
        const byId = new Map(
            listCampaignCharacters(charactersById, locations).map((c) => [c.id, c]),
        );
        (sheetCharacters || []).forEach((c) => {
            if (c?.id && !byId.has(c.id)) byId.set(c.id, c);
        });
        const all = [...byId.values()];
        const visible = isDM ? all : all.filter((c) => canControlToken(c, profile));
        return visible.sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));
    }, [charactersById, locations, sheetCharacters, isDM, profile]);

    const selectedId = profile?.activeCharacterId && roster.some((c) => c.id === profile.activeCharacterId)
        ? profile.activeCharacterId
        : roster[0]?.id || null;
    const selected = roster.find((c) => c.id === selectedId) || null;

    const mapRulers = useMemo(
        () => Object.values(rulers).filter((r) => r && (!mapId || r.mapId === mapId)),
        [rulers, mapId],
    );

    const mapDrawings = useMemo(
        () => Object.values(drawings).filter((d) => d && (!mapId || d.mapId === mapId)),
        [drawings, mapId],
    );

    const isPanelOpen = (id) => openOrder.includes(id);

    const togglePanel = (id) => {
        setOpenOrder((prev) => {
            const closing = prev.includes(id);
            let next;
            if (closing) next = prev.filter((x) => x !== id);
            else {
                // Ruler and shapes are mutually exclusive panels.
                next = prev.filter((x) => {
                    if (id === TOOL_IDS.RULER) return x !== TOOL_IDS.SHAPES;
                    if (id === TOOL_IDS.SHAPES) return x !== TOOL_IDS.RULER;
                    return true;
                });
                next = [...next, id];
                if (next.length > MAX_OPEN_PANELS) {
                    next = next.slice(next.length - MAX_OPEN_PANELS);
                }
            }
            return next;
        });
    };

    // Panel open/close drives ruler / shapes placement mode (mutually exclusive).
    useEffect(() => {
        const rulerOpen = openOrder.includes(TOOL_IDS.RULER);
        const shapesOpen = openOrder.includes(TOOL_IDS.SHAPES);
        if (rulerOpen) {
            dispatch(setRulerMode(true));
            dispatch(setDrawMode(false));
        } else if (shapesOpen) {
            dispatch(setRulerMode(false));
            dispatch(setDrawMode({
                active: true,
                shape: drawTool?.shape || DRAW_SHAPES.CIRCLE,
            }));
        } else {
            dispatch(setRulerMode(false));
            dispatch(setDrawMode(false));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to panel order
    }, [openOrder, dispatch]);

    // External exit (MeasuringHUD ✕) closes the matching panel.
    useEffect(() => {
        if (rulerActive) return;
        setOpenOrder((prev) => (
            prev.includes(TOOL_IDS.RULER)
                ? prev.filter((id) => id !== TOOL_IDS.RULER)
                : prev
        ));
    }, [rulerActive]);

    useEffect(() => {
        if (drawActive) return;
        setOpenOrder((prev) => (
            prev.includes(TOOL_IDS.SHAPES)
                ? prev.filter((id) => id !== TOOL_IDS.SHAPES)
                : prev
        ));
    }, [drawActive]);

    const toggleToolsRail = () => {
        setToolsRailOpen((prev) => {
            if (prev) {
                setOpenOrder([]);
                dispatch(setRulerMode(false));
                dispatch(setDrawMode(false));
            }
            return !prev;
        });
    };

    const handleDeleteRuler = async (rulerId) => {
        if (!campaignId || !rulerId) return;
        try {
            await removeMapRuler(campaignId, rulerId);
        } catch (err) {
            console.error(err);
            dispatch(showSnackbar({ message: "No se pudo borrar la regla", severity: "error" }));
        }
    };

    const handleDeleteDrawing = async (drawingId) => {
        if (!campaignId || !drawingId) return;
        try {
            await removeMapDrawing(campaignId, drawingId);
        } catch (err) {
            console.error(err);
            dispatch(showSnackbar({ message: "No se pudo borrar la figura", severity: "error" }));
        }
    };

    const handlePickColor = async (hex) => {
        dispatch(setDrawColor(hex));
        if (!campaignId || selectedDrawingIds.length === 0) return;
        try {
            await Promise.all(selectedDrawingIds.map(async (id) => {
                const current = drawings?.[id];
                if (!current) return;
                await updateMapDrawing(campaignId, id, { ...current, color: hex });
            }));
        } catch (err) {
            console.error(err);
            dispatch(showSnackbar({ message: "No se pudo cambiar el color", severity: "error" }));
        }
    };

    if (!profile) return null;

    const rulerOpen = isPanelOpen(TOOL_IDS.RULER);
    const shapesOpen = isPanelOpen(TOOL_IDS.SHAPES);
    const diceOpen = isPanelOpen(TOOL_IDS.DICE);
    const activeShape = drawTool?.shape || DRAW_SHAPES.CIRCLE;
    const activeCircleMode = drawTool?.circleMode === CIRCLE_MODES.SQUARE
        ? CIRCLE_MODES.SQUARE
        : CIRCLE_MODES.ROUND;
    const activeColor = drawTool?.color || DRAW_COLOR_PRESETS[0].hex;

    const shapeBtnSx = (active) => ({
        flex: 1,
        minWidth: 0,
        py: 0.45,
        px: 0.5,
        borderRadius: 0.75,
        border: `1px solid ${active ? UI_COLORS.accent : UI_COLORS.border}`,
        bgcolor: active ? `${UI_COLORS.accent}22` : "rgba(0,0,0,0.28)",
        color: "#ffffff",
        fontFamily: "Orbitron, sans-serif",
        fontSize: "0.48rem",
        letterSpacing: "0.08em",
        cursor: "pointer",
        textAlign: "center",
        "&:hover": {
            borderColor: UI_COLORS.accent,
            bgcolor: `${UI_COLORS.accent}18`,
        },
    });

    return (
        <Box
            data-no-token-drop
            sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 0.55,
                maxWidth: "calc(100vw - 32px)",
                pointerEvents: "auto",
            }}
        >
            <CyberTooltip
                title={toolsRailOpen ? "Replegar herramientas" : "Herramientas (regla / figuras / dados)"}
                placement="right"
            >
                <IconButton
                    size="small"
                    onClick={toggleToolsRail}
                    aria-pressed={toolsRailOpen}
                    aria-label="Desplegar herramientas"
                    sx={glassBtnSx(toolsRailOpen)}
                >
                    {toolsRailOpen
                        ? <UnfoldLessIcon sx={{ fontSize: "1.15rem" }} />
                        : <WidgetsIcon sx={{ fontSize: "1.15rem" }} />}
                </IconButton>
            </CyberTooltip>

            <Box
                sx={{
                    display: "grid",
                    gridTemplateRows: toolsRailOpen ? "1fr" : "0fr",
                    transition: "grid-template-rows 0.22s ease",
                    overflow: "hidden",
                }}
            >
                <Box
                    sx={{
                        minHeight: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: 0.55,
                        opacity: toolsRailOpen ? 1 : 0,
                        transform: toolsRailOpen ? "translateY(0)" : "translateY(-8px)",
                        transition: "opacity 0.18s ease, transform 0.18s ease",
                        pointerEvents: toolsRailOpen ? "auto" : "none",
                    }}
                >
                    <ToolRow
                        open={rulerOpen}
                        button={(
                            <CyberTooltip
                                title={rulerOpen ? "Cerrar regla" : "Regla (casillas)"}
                                placement="right"
                            >
                                <IconButton
                                    size="small"
                                    onClick={() => togglePanel(TOOL_IDS.RULER)}
                                    aria-pressed={rulerOpen}
                                    aria-label="Herramienta regla"
                                    sx={glassBtnSx(rulerOpen || rulerActive)}
                                >
                                    <StraightenIcon sx={{ fontSize: "1.15rem" }} />
                                </IconButton>
                            </CyberTooltip>
                        )}
                        panel={(
                            <Box sx={panelShellSx}>
                                <CyberText
                                    sx={{
                                        fontFamily: "monospace",
                                        fontSize: "0.48rem",
                                        letterSpacing: "0.12em",
                                        color: UI_COLORS.anomaly,
                                    }}
                                >
                                    REGLA
                                </CyberText>
                                <CyberText sx={{ fontSize: "0.62rem", color: UI_COLORS.textPrimary }}>
                                    LMB ancla · Ctrl+LMB zigzag · LMB cierra (mesa)
                                </CyberText>
                                <CyberText sx={{ fontSize: "0.55rem", color: UI_COLORS.textSecondary }}>
                                    RMB cancela el trazo en curso. Handle □ selecciona/arrastra.
                                </CyberText>
                                {mapRulers.length === 0 ? (
                                    <CyberText sx={{ fontSize: "0.6rem", color: UI_COLORS.textSecondary }}>
                                        Sin reglas activas en este mapa
                                    </CyberText>
                                ) : (
                                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.4 }}>
                                        {mapRulers.map((r) => (
                                            <Box
                                                key={r.id}
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 0.5,
                                                    px: 0.55,
                                                    py: 0.35,
                                                    borderRadius: 1,
                                                    border: `1px solid ${UI_COLORS.border}`,
                                                    bgcolor: "rgba(0,0,0,0.28)",
                                                }}
                                            >
                                                <CyberText
                                                    sx={{
                                                        flex: 1,
                                                        fontFamily: "monospace",
                                                        fontSize: "0.58rem",
                                                        color: UI_COLORS.textPrimary,
                                                    }}
                                                >
                                                    {r.totalCells ?? 0} cas · {r.diagonal ?? 0} diag
                                                    {Array.isArray(r.points) && r.points.length > 2
                                                        ? ` · ${r.points.length - 1} seg`
                                                        : ""}
                                                    {r.distanceLabel ? ` · ${r.distanceLabel}` : ""}
                                                </CyberText>
                                                <CyberTooltip title="Borrar regla" placement="right">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleDeleteRuler(r.id)}
                                                        aria-label="Borrar regla"
                                                        sx={{
                                                            width: 26,
                                                            height: 26,
                                                            color: UI_COLORS.accent,
                                                            border: `1px solid ${UI_COLORS.border}`,
                                                            "&:hover": { bgcolor: `${UI_COLORS.accent}18` },
                                                        }}
                                                    >
                                                        <DeleteOutlineIcon sx={{ fontSize: "0.95rem" }} />
                                                    </IconButton>
                                                </CyberTooltip>
                                            </Box>
                                        ))}
                                    </Box>
                                )}
                            </Box>
                        )}
                    />

                    <ToolRow
                        open={shapesOpen}
                        button={(
                            <CyberTooltip
                                title={shapesOpen ? "Cerrar figuras" : "Figuras (círculo / cuadrado / freehand)"}
                                placement="right"
                            >
                                <IconButton
                                    size="small"
                                    onClick={() => togglePanel(TOOL_IDS.SHAPES)}
                                    aria-pressed={shapesOpen}
                                    aria-label="Herramienta figuras"
                                    sx={glassBtnSx(shapesOpen || drawActive)}
                                >
                                    <CategoryIcon sx={{ fontSize: "1.15rem" }} />
                                </IconButton>
                            </CyberTooltip>
                        )}
                        panel={(
                            <Box sx={panelShellSx}>
                                <CyberText
                                    sx={{
                                        fontFamily: "monospace",
                                        fontSize: "0.48rem",
                                        letterSpacing: "0.12em",
                                        color: UI_COLORS.accent,
                                    }}
                                >
                                    FIGURAS
                                </CyberText>
                                <Box sx={{ display: "flex", gap: 0.4 }}>
                                    {[
                                        { id: DRAW_SHAPES.CIRCLE, label: "CÍRCULO" },
                                        { id: DRAW_SHAPES.RECT, label: "CUADRADO" },
                                        { id: DRAW_SHAPES.FREEHAND, label: "AIRE" },
                                    ].map((opt) => (
                                        <Box
                                            key={opt.id}
                                            component="button"
                                            type="button"
                                            onClick={() => dispatch(setDrawShape(opt.id))}
                                            sx={shapeBtnSx(activeShape === opt.id)}
                                        >
                                            {opt.label}
                                        </Box>
                                    ))}
                                </Box>
                                {activeShape === DRAW_SHAPES.CIRCLE && (
                                    <Box sx={{ display: "flex", gap: 0.4 }}>
                                        {[
                                            { id: CIRCLE_MODES.ROUND, label: "REDONDO" },
                                            { id: CIRCLE_MODES.SQUARE, label: "□ AOE" },
                                        ].map((opt) => (
                                            <Box
                                                key={opt.id}
                                                component="button"
                                                type="button"
                                                onClick={() => dispatch(setDrawCircleMode(opt.id))}
                                                sx={shapeBtnSx(activeCircleMode === opt.id)}
                                            >
                                                {opt.label}
                                            </Box>
                                        ))}
                                    </Box>
                                )}
                                <Box sx={{ display: "flex", gap: 0.35, flexWrap: "wrap", alignItems: "center" }}>
                                    {DRAW_COLOR_PRESETS.map((c) => (
                                        <Box
                                            key={c.id}
                                            component="button"
                                            type="button"
                                            onClick={() => handlePickColor(c.hex)}
                                            aria-label={`Color ${c.id}`}
                                            title={c.hex}
                                            sx={{
                                                width: 18,
                                                height: 18,
                                                p: 0,
                                                borderRadius: 0.5,
                                                border: activeColor === c.hex
                                                    ? `2px solid ${UI_COLORS.textPrimary}`
                                                    : `1px solid ${UI_COLORS.border}`,
                                                bgcolor: c.hex,
                                                cursor: "pointer",
                                                boxShadow: activeColor === c.hex
                                                    ? `0 0 8px ${c.hex}88`
                                                    : "none",
                                            }}
                                        />
                                    ))}
                                </Box>
                                <CyberText sx={{ fontSize: "0.55rem", color: UI_COLORS.textSecondary }}>
                                    {activeShape === DRAW_SHAPES.FREEHAND
                                        ? "LMB vértices · clic extremo cierra · Ctrl encadena · RMB cancela"
                                        : activeShape === DRAW_SHAPES.CIRCLE
                                            ? "LMB centro → borde (marca casillas) · Ctrl encadena · RMB cancela"
                                            : "Ctrl encadena · RMB cancela draft · □ selecciona/arrastra"}
                                </CyberText>
                                {mapDrawings.length === 0 ? (
                                    <CyberText sx={{ fontSize: "0.6rem", color: UI_COLORS.textSecondary }}>
                                        Sin figuras en este mapa
                                    </CyberText>
                                ) : (
                                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.4 }}>
                                        {mapDrawings.map((d) => (
                                            <Box
                                                key={d.id}
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 0.5,
                                                    px: 0.55,
                                                    py: 0.35,
                                                    borderRadius: 1,
                                                    border: `1px solid ${UI_COLORS.border}`,
                                                    bgcolor: "rgba(0,0,0,0.28)",
                                                }}
                                            >
                                                <CyberText
                                                    sx={{
                                                        flex: 1,
                                                        fontFamily: "monospace",
                                                        fontSize: "0.58rem",
                                                        color: UI_COLORS.textPrimary,
                                                    }}
                                                >
                                                    {shapeLabel(d.shape)}
                                                    {Array.isArray(d.parts) && d.parts.length > 1
                                                        ? ` · ${d.parts.length} partes`
                                                        : ""}
                                                    {normalizeDrawingPaths(d.paths).length > 1
                                                        ? ` · ${normalizeDrawingPaths(d.paths).length} trazos`
                                                        : ""}
                                                </CyberText>
                                                <CyberTooltip title="Borrar figura" placement="right">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleDeleteDrawing(d.id)}
                                                        aria-label="Borrar figura"
                                                        sx={{
                                                            width: 26,
                                                            height: 26,
                                                            color: UI_COLORS.accent,
                                                            border: `1px solid ${UI_COLORS.border}`,
                                                            "&:hover": { bgcolor: `${UI_COLORS.accent}18` },
                                                        }}
                                                    >
                                                        <DeleteOutlineIcon sx={{ fontSize: "0.95rem" }} />
                                                    </IconButton>
                                                </CyberTooltip>
                                            </Box>
                                        ))}
                                    </Box>
                                )}
                            </Box>
                        )}
                    />

                    {selected && (
                        <ToolRow
                            open={diceOpen}
                            button={(
                                <CyberTooltip
                                    title={diceOpen ? "Cerrar dados" : "Lanzar dados"}
                                    placement="right"
                                >
                                    <IconButton
                                        size="small"
                                        onClick={() => togglePanel(TOOL_IDS.DICE)}
                                        aria-pressed={diceOpen}
                                        aria-label="Panel de dados"
                                        sx={glassBtnSx(diceOpen)}
                                    >
                                        <CasinoIcon sx={{ fontSize: "1.15rem" }} />
                                    </IconButton>
                                </CyberTooltip>
                            )}
                            panel={(
                                <Box sx={{ ...panelShellSx, maxWidth: "min(280px, calc(100vw - 72px))" }}>
                                    <CyberText
                                        sx={{
                                            fontFamily: "monospace",
                                            fontSize: "0.48rem",
                                            letterSpacing: "0.12em",
                                            color: UI_COLORS.anomaly,
                                        }}
                                    >
                                        DADOS
                                    </CyberText>
                                    <DiceRollerBar character={selected} layout="stack" />
                                </Box>
                            )}
                        />
                    )}
                </Box>
            </Box>
        </Box>
    );
}
