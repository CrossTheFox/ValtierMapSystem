import { useEffect, useMemo, useRef, useState } from "react";
import { Box, IconButton, CircularProgress, Badge } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import CasinoIcon from "@mui/icons-material/Casino";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import WidgetsIcon from "@mui/icons-material/Widgets";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import StraightenIcon from "@mui/icons-material/Straighten";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import DirectionsRunIcon from "@mui/icons-material/DirectionsRun";
import VisibilityIcon from "@mui/icons-material/Visibility";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import FavoriteIcon from "@mui/icons-material/Favorite";
import CampaignIcon from "@mui/icons-material/Campaign";
import BuildIcon from "@mui/icons-material/Build";
import GpsFixedIcon from "@mui/icons-material/GpsFixed";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import ShieldIcon from "@mui/icons-material/Shield";
import { CyberText } from "../customs/CustomTexts";
import CyberTooltip from "../customs/CyberTooltip";
import { UI_COLORS } from "../../constants/uiColors";
import { VTT_HUD } from "../../constants/vttHudTokens";
import { useStatSystem } from "../../hooks/useStatSystem";
import { setRulerMode, showSnackbar } from "../../store/uiSlice";
import { canControlToken, isDmRole } from "../../utils/tokenControl";
import { listCampaignCharacters } from "../../utils/characterCombat";
import { rollStatInChat } from "../../../firebase/services/chatService";
import { removeMapRuler } from "../../../firebase/services/gameService";
import DiceRollerBar from "./DiceRollerBar";

/** Max concurrent open sub-panels; opening another closes the oldest (FIFO). */
const MAX_OPEN_PANELS = 4;

const TOOL_IDS = {
    RULER: "ruler",
    DICE: "dice",
    STATS: "stats",
};

const STAT_ICONS = {
    sneak: VisibilityOffIcon,
    traverse: DirectionsRunIcon,
    sense: VisibilityIcon,
    study: MenuBookIcon,
    charm: FavoriteIcon,
    command: CampaignIcon,
    tinker: BuildIcon,
    excel: GpsFixedIcon,
    smash: FitnessCenterIcon,
    endure: ShieldIcon,
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

function StatIconButton({ statDef, value, busy, onRoll }) {
    const Icon = STAT_ICONS[statDef.key] || CasinoIcon;
    const n = Math.max(0, Math.floor(Number(value) || 0));
    const tip = [
        `${statDef.label || statDef.key}: ${n}`,
        statDef.description,
        n <= 0 ? "Click: 2d6 → mínimo" : `Click: ${n}d6 → máximo`,
    ].filter(Boolean).join(" · ");

    return (
        <CyberTooltip title={tip} placement="right">
            <Badge
                badgeContent={n}
                color="default"
                overlap="circular"
                sx={{
                    "& .MuiBadge-badge": {
                        fontFamily: "'Fira Code', monospace",
                        fontSize: "0.55rem",
                        minWidth: 16,
                        height: 16,
                        bgcolor: n <= 0 ? UI_COLORS.accentStrong : UI_COLORS.anomaly,
                        color: "#0a0a12",
                        border: `1px solid ${UI_COLORS.backgroundSecondary}`,
                    },
                }}
            >
                <IconButton
                    size="small"
                    disabled={busy}
                    onClick={onRoll}
                    sx={{
                        width: 34,
                        height: 34,
                        borderRadius: 1,
                        border: `1px solid ${UI_COLORS.border}`,
                        bgcolor: VTT_HUD.glassBg,
                        color: busy ? UI_COLORS.anomaly : UI_COLORS.textSecondary,
                        backdropFilter: "blur(10px)",
                        "&:hover": {
                            color: UI_COLORS.accent,
                            borderColor: UI_COLORS.accent,
                            bgcolor: `${UI_COLORS.accent}16`,
                        },
                        "&.Mui-disabled": { opacity: 0.55 },
                    }}
                >
                    {busy ? <CircularProgress size={14} sx={{ color: UI_COLORS.anomaly }} /> : <Icon sx={{ fontSize: "1.05rem" }} />}
                </IconButton>
            </Badge>
        </CyberTooltip>
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
    const rulerActive = useSelector((s) => !!s.ui.rulerTool?.active);
    const { stats: statDefs } = useStatSystem(campaignId);

    const [toolsRailOpen, setToolsRailOpen] = useState(false);
    /** Open panel ids in open-order (oldest → newest). */
    const [openOrder, setOpenOrder] = useState([]);
    // Ref lock — setState(rollingKey) swapped every stat icon to CircularProgress and flashed the tray.
    const rollingRef = useRef(null);

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

    const isPanelOpen = (id) => openOrder.includes(id);

    const togglePanel = (id) => {
        setOpenOrder((prev) => {
            const closing = prev.includes(id);
            let next;
            if (closing) next = prev.filter((x) => x !== id);
            else {
                next = [...prev, id];
                if (next.length > MAX_OPEN_PANELS) {
                    next = next.slice(next.length - MAX_OPEN_PANELS);
                }
            }
            return next;
        });
    };

    // Panel open/close drives ruler placement mode.
    useEffect(() => {
        const rulerOpen = openOrder.includes(TOOL_IDS.RULER);
        dispatch(setRulerMode(rulerOpen));
    }, [openOrder, dispatch]);

    // External exit (e.g. MeasuringHUD ✕) closes the ruler panel so mode stays off.
    useEffect(() => {
        if (rulerActive) return;
        setOpenOrder((prev) => (
            prev.includes(TOOL_IDS.RULER)
                ? prev.filter((id) => id !== TOOL_IDS.RULER)
                : prev
        ));
    }, [rulerActive]);

    const toggleToolsRail = () => {
        setToolsRailOpen((prev) => {
            if (prev) {
                setOpenOrder([]);
                dispatch(setRulerMode(false));
            }
            return !prev;
        });
    };

    const handleStatRoll = async (statDef) => {
        if (!campaignId || !selected || !statDef?.key || rollingRef.current) return;
        const value = selected.stats?.[statDef.key] ?? 0;
        rollingRef.current = statDef.key;
        try {
            await rollStatInChat(campaignId, profile, selected, statDef, value);
            // Result is shown via DiceRevealOverlay + chat (avoid snackbar overlap).
        } catch (err) {
            console.error(err);
            dispatch(showSnackbar({ message: "No se pudo publicar la tirada", severity: "error" }));
        } finally {
            rollingRef.current = null;
        }
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

    if (!profile) return null;

    const hasStats = selected && (statDefs || []).length > 0;
    const rulerOpen = isPanelOpen(TOOL_IDS.RULER);
    const diceOpen = isPanelOpen(TOOL_IDS.DICE);
    const statsOpen = isPanelOpen(TOOL_IDS.STATS);

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
                title={toolsRailOpen ? "Replegar herramientas" : "Herramientas (dados / stats)"}
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
                                    Click 1 → nodo A · Click 2 → nodo B (visible para toda la mesa)
                                </CyberText>
                                <CyberText sx={{ fontSize: "0.55rem", color: UI_COLORS.textSecondary }}>
                                    Muestra casillas totales, diagonales y distancia.
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
                                <Box sx={panelShellSx}>
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

                    {hasStats && (
                        <ToolRow
                            open={statsOpen}
                            button={(
                                <CyberTooltip
                                    title={statsOpen ? "Cerrar stats" : "Stats del personaje"}
                                    placement="right"
                                >
                                    <IconButton
                                        size="small"
                                        onClick={() => togglePanel(TOOL_IDS.STATS)}
                                        aria-pressed={statsOpen}
                                        aria-label="Panel de stats"
                                        sx={glassBtnSx(statsOpen)}
                                    >
                                        <QueryStatsIcon sx={{ fontSize: "1.15rem" }} />
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
                                        STATS
                                    </CyberText>
                                    <Box
                                        sx={{
                                            display: "flex",
                                            flexDirection: "row",
                                            flexWrap: "wrap",
                                            alignItems: "center",
                                            gap: 0.4,
                                        }}
                                    >
                                        {(statDefs || []).map((def) => (
                                            <StatIconButton
                                                key={def.key}
                                                statDef={def}
                                                value={selected.stats?.[def.key] ?? 0}
                                                busy={false}
                                                onRoll={() => handleStatRoll(def)}
                                            />
                                        ))}
                                    </Box>
                                </Box>
                            )}
                        />
                    )}
                </Box>
            </Box>
        </Box>
    );
}
