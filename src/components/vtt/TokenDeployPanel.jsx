import { useEffect, useMemo, useRef, useState } from "react";
import {
    Box, Paper, IconButton, Select, MenuItem, Chip, Tooltip, ToggleButton, ToggleButtonGroup,
} from "@mui/material";
import PersonPinCircleIcon from "@mui/icons-material/PersonPinCircle";
import CloseIcon from "@mui/icons-material/Close";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import { useSelector } from "react-redux";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import { CyberTitle, CyberText } from "../customs/CustomTexts";
import CharAvatar from "../characters/CharAvatar";
import { UI_COLORS } from "../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import { cyberMenuItemSx, cyberMenuPaperSx } from "../../constants/designSystem";
import { VTT_RIGHT_DOCK } from "../../constants/vttHudTokens";
import { useViewport } from "../../context/ViewportContext";
import {
    placeTokenOnBoard,
    removeTokenFromMap,
    updateTokenSizeOverride,
} from "../../../firebase/services/gameService";
import {
    TOKEN_SIZE_OPTIONS,
    resolveCellSize,
    snapTokenToGrid,
    resolveTokenSizeKey,
} from "../../utils/gridMath";
import { clientToWorld } from "../../utils/clientToWorld";
import { canControlToken, findNearestLocation, isDmRole } from "../../utils/tokenControl";
import { buildCampaignCharacterMap } from "../../utils/characterCombat";

const FILTERS = [
    { id: "all", label: "Todos" },
    { id: "pj", label: "PJ" },
    { id: "npc", label: "NPC" },
    { id: "on", label: "En mapa" },
    { id: "off", label: "Fuera" },
];

function isNpcChar(char) {
    return Boolean(char?.isNpc || char?.isEnemy);
}

const FONT_BODY = "'Fira Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";

/**
 * Roster rows are plain DOM styled from this single static `sx`. Per-row MUI
 * (`Stack` + `CyberText` × 2 + nested `Box`) meant ~8 emotion serializations
 * per character and ~180ms of jank each time the tray opened.
 */
const ROSTER_SCROLL_SX = {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    px: 0.75,
    py: 0.5,
    ...CYBER_SCROLL_STYLE,
    "& .tk-rows": { display: "flex", flexDirection: "column", gap: "4px" },
    "& .tk-row": {
        display: "flex",
        alignItems: "center",
        gap: "5px",
        px: 0.6,
        py: 0.35,
        border: `1px solid ${UI_COLORS.border}`,
        borderRadius: "4px",
        bgcolor: "transparent",
        userSelect: "none",
        cursor: "default",
    },
    "& .tk-row.draggable": { cursor: "grab" },
    "& .tk-row.draggable:active": { cursor: "grabbing" },
    "& .tk-row.deployed": {
        border: `1px solid ${UI_COLORS.anomaly}55`,
        bgcolor: `${UI_COLORS.anomaly}0d`,
    },
    "& .tk-row.locked": { opacity: 0.55 },
    "& .tk-portrait": { position: "relative", pointerEvents: "none" },
    "& .tk-dot": {
        position: "absolute",
        right: -2,
        bottom: -2,
        width: 7,
        height: 7,
        borderRadius: "50%",
        bgcolor: "rgba(255,255,255,0.2)",
        border: `1px solid ${UI_COLORS.backgroundSecondary}`,
    },
    "& .tk-row.deployed .tk-dot": { bgcolor: UI_COLORS.anomaly },
    "& .tk-meta": { flex: 1, minWidth: 0, pointerEvents: "none" },
    "& .tk-name": {
        fontFamily: FONT_BODY,
        fontSize: "0.68rem",
        lineHeight: 1.2,
        color: UI_COLORS.textPrimary,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    "& .tk-sub": {
        fontFamily: FONT_BODY,
        fontSize: "0.5rem",
        lineHeight: 1.2,
        color: UI_COLORS.textSecondary,
    },
};

/**
 * Token tray: DM sees campaign roster; players see only controllable chars.
 * Drag undeployed rows onto the map to place (grid-snapped + locationId sync).
 *
 * Roster = Redux world (same as Combat HUD) + live Firestore query by campaignId.
 * The list opens even without an active map (deploy stays disabled until there is one).
 */
export default function TokenDeployPanel({ open, onClose }) {
    const [filter, setFilter] = useState("all");
    const [campaignChars, setCampaignChars] = useState([]);
    const [dragGhost, setDragGhost] = useState(null);
    const dragRef = useRef(null);
    const ghostElRef = useRef(null);
    const mapRef = useRef(null);
    const gridConfigRef = useRef(null);
    const viewportRef = useRef(null);
    const locationsRef = useRef(null);

    const viewport = useViewport();
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const mapId = useSelector((s) => s.world.activeMapId ?? s.world.map?.id);
    const map = useSelector((s) => s.world.map);
    const gridConfig = useSelector((s) => s.world.gridConfig);
    const locations = useSelector((s) => s.world.locations);
    const charactersById = useSelector((s) => s.world.charactersById ?? {});
    const sheetCharacters = useSelector((s) => s.characters.list);
    const tokenPositions = useSelector((s) => s.game.tokenPositions ?? {});
    const profile = useSelector((s) => s.player.profile);
    const isDM = isDmRole(profile?.role);

    mapRef.current = map;
    gridConfigRef.current = gridConfig;
    viewportRef.current = viewport;
    locationsRef.current = locations;

    useEffect(() => {
        if (!campaignId) {
            setCampaignChars([]);
            return undefined;
        }
        const q = query(collection(db, "characters"), where("campaignId", "==", campaignId));
        return onSnapshot(q, (snap) => {
            setCampaignChars(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }, (err) => {
            console.warn("[TokenDeployPanel/characters]", err?.code || err?.message || err);
        });
    }, [campaignId]);

    const characters = useMemo(() => {
        const byId = buildCampaignCharacterMap(
            charactersById,
            locations,
            sheetCharacters,
            campaignId,
        );
        (campaignChars || []).forEach((c) => {
            if (!c?.id) return;
            const prev = byId.get(c.id);
            byId.set(c.id, prev ? { ...prev, ...c } : c);
        });
        return [...byId.values()]
            .filter((c) => isDM || canControlToken(c, profile))
            .sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));
    }, [charactersById, locations, sheetCharacters, campaignId, campaignChars, isDM, profile]);

    const mapTokens = mapId ? (tokenPositions[mapId] ?? {}) : {};
    const canDeploy = Boolean(campaignId && mapId);

    const filtered = useMemo(() => {
        return characters.filter((char) => {
            const deployed = Boolean(mapTokens[char.id]);
            const npc = isNpcChar(char);
            if (filter === "pj") return !npc;
            if (filter === "npc") return npc;
            if (filter === "on") return deployed;
            if (filter === "off") return !deployed;
            return true;
        });
    }, [characters, filter, mapTokens]);

    useEffect(() => {
        if (!dragGhost) return undefined;

        const onMove = (e) => {
            const el = ghostElRef.current;
            if (!el) return;
            el.style.left = `${e.clientX}px`;
            el.style.top = `${e.clientY}px`;
        };

        const onUp = async (e) => {
            const payload = dragRef.current;
            dragRef.current = null;
            setDragGhost(null);

            if (!payload || !campaignId || !mapId) return;

            if (ghostElRef.current) ghostElRef.current.style.display = "none";
            const under = document.elementFromPoint(e.clientX, e.clientY);
            if (under?.closest?.("[data-no-token-drop]")) return;

            const vp = viewportRef.current;
            if (!vp) return;

            const world = clientToWorld(vp, e.clientX, e.clientY);
            if (!world) return;

            const gc = gridConfigRef.current;
            const cell = resolveCellSize(mapRef.current, gc);
            const sizeKey = resolveTokenSizeKey({ tokenSize: payload.tokenSize });
            const snapped = gc?.snap === false
                ? world
                : snapTokenToGrid(world.x, world.y, cell, sizeKey);

            const nearest = findNearestLocation(locationsRef.current, snapped.x, snapped.y);

            try {
                await placeTokenOnBoard(
                    campaignId,
                    mapId,
                    payload.charId,
                    {
                        x: snapped.x,
                        y: snapped.y,
                        sizeOverride: null,
                    },
                    nearest?.id ?? null,
                );
            } catch (err) {
                console.error("No se pudo desplegar el token:", err);
            }
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        return () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
        };
    }, [dragGhost, campaignId, mapId]);

    if (!open || !campaignId) return null;

    const handleRemove = async (charId) => {
        if (!mapId) return;
        await removeTokenFromMap(campaignId, mapId, charId);
    };

    const handleSizeChange = async (char, sizeKey) => {
        if (!mapId) return;
        const pos = mapTokens[char.id];
        if (!pos) return;
        const gc = gridConfigRef.current;
        const cell = resolveCellSize(mapRef.current, gc);
        const snapped = gc?.snap === false
            ? { x: pos.x, y: pos.y }
            : snapTokenToGrid(pos.x, pos.y, cell, sizeKey);
        await updateTokenSizeOverride(campaignId, mapId, char.id, sizeKey, {
            ...pos,
            x: snapped.x,
            y: snapped.y,
        });
    };

    const startDrag = (char, e) => {
        if (!canDeploy) return;
        if (mapTokens[char.id]) return;
        if (!canControlToken(char, profile)) return;
        if (e.button != null && e.button !== 0) return;
        e.preventDefault();
        e.currentTarget?.setPointerCapture?.(e.pointerId);
        const payload = { charId: char.id, name: char.name, tokenSize: char.tokenSize || "normal" };
        dragRef.current = payload;
        setDragGhost({
            ...payload,
            imagePath: char.tokenImageUrl || char.imageUrl,
            x: e.clientX,
            y: e.clientY,
        });
    };

    return (
        <>
            <Paper
                elevation={0}
                data-no-token-drop
                sx={{
                    width: "100%",
                    maxHeight: VTT_RIGHT_DOCK.tokenPanelMaxHeight,
                    flexShrink: 0,
                    bgcolor: `${UI_COLORS.backgroundSecondary}f2`,
                    border: `1px solid ${UI_COLORS.border}`,
                    borderRadius: 1,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    pointerEvents: "auto",
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.75,
                        px: 1.25,
                        py: 0.5,
                        borderBottom: `1px solid ${UI_COLORS.border}`,
                    }}
                >
                    <PersonPinCircleIcon sx={{ fontSize: "0.95rem", color: UI_COLORS.accent }} />
                    <CyberTitle sx={{ fontSize: "0.62rem", color: UI_COLORS.accent, letterSpacing: 2, flex: 1 }}>
                        TOKENS
                    </CyberTitle>
                    <Chip
                        label={`${Object.keys(mapTokens).length}/${characters.length}`}
                        size="small"
                        sx={{ height: 18, fontSize: "0.55rem", color: UI_COLORS.textPrimary }}
                    />
                    <IconButton size="small" onClick={onClose} sx={{ color: UI_COLORS.textSecondary, p: 0.25 }}>
                        <CloseIcon sx={{ fontSize: "1rem" }} />
                    </IconButton>
                </Box>

                <Box sx={{ px: 1, py: 0.5, borderBottom: `1px solid ${UI_COLORS.border}` }}>
                    <ToggleButtonGroup
                        exclusive
                        size="small"
                        value={filter}
                        onChange={(_, v) => { if (v) setFilter(v); }}
                        sx={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 0.35,
                            "& .MuiToggleButton-root": {
                                flex: "1 1 auto",
                                py: 0.15,
                                px: 0.5,
                                fontSize: "0.55rem",
                                letterSpacing: 0.5,
                                textTransform: "uppercase",
                                color: UI_COLORS.textSecondary,
                                border: `1px solid ${UI_COLORS.border} !important`,
                                borderRadius: "4px !important",
                                "&.Mui-selected": {
                                    color: UI_COLORS.anomaly,
                                    bgcolor: `${UI_COLORS.anomaly}18`,
                                    borderColor: `${UI_COLORS.anomaly}66 !important`,
                                },
                            },
                        }}
                    >
                        {FILTERS.map((f) => (
                            <ToggleButton key={f.id} value={f.id}>{f.label}</ToggleButton>
                        ))}
                    </ToggleButtonGroup>
                    <CyberText sx={{ fontSize: "0.55rem", color: UI_COLORS.textSecondary, mt: 0.4 }}>
                        {canDeploy
                            ? "Arrastra al mapa · sincroniza posición y locación"
                            : "Lista de personajes de la campaña (despliegue requiere mapa)"}
                    </CyberText>
                </Box>

                <Box sx={ROSTER_SCROLL_SX}>
                    {!filtered.length && (
                        <CyberText sx={{ fontSize: "0.7rem", color: UI_COLORS.textSecondary, p: 1 }}>
                            {characters.length === 0
                                ? (isDM
                                    ? "No hay personajes en esta campaña."
                                    : "No tienes personajes asignados en esta campaña.")
                                : (isDM
                                    ? "Sin resultados para este filtro."
                                    : "No tienes personajes asignados para este mapa.")}
                        </CyberText>
                    )}
                    <div className="tk-rows">
                        {filtered.map((char) => {
                            const deployed = Boolean(mapTokens[char.id]);
                            const sizeKey = resolveTokenSizeKey(char, mapTokens[char.id]?.sizeOverride);
                            const npc = isNpcChar(char);
                            const controllable = canControlToken(char, profile);
                            const rowClass = [
                                "tk-row",
                                deployed ? "deployed" : "",
                                controllable ? "" : "locked",
                                deployed || !controllable || !canDeploy ? "" : "draggable",
                            ].filter(Boolean).join(" ");
                            return (
                                <div
                                    key={char.id}
                                    className={rowClass}
                                    onPointerDown={(e) => startDrag(char, e)}
                                >
                                    <div className="tk-portrait">
                                        <CharAvatar
                                            imagePath={char.tokenImageUrl || char.imageUrl}
                                            name={char.name}
                                            size={28}
                                            status={char.status}
                                            crop={char.tokenCrop}
                                        />
                                        <span className="tk-dot" />
                                    </div>
                                    <div className="tk-meta">
                                        <div className="tk-name">{char.name || char.id}</div>
                                        <div className="tk-sub">
                                            {npc ? "NPC" : "PJ"} · {sizeKey}
                                            {!canDeploy ? " · sin mapa" : ""}
                                        </div>
                                    </div>
                                    {deployed && controllable && canDeploy && (
                                        <Select
                                            size="small"
                                            value={sizeKey}
                                            onPointerDown={(e) => e.stopPropagation()}
                                            onChange={(e) => handleSizeChange(char, e.target.value)}
                                            MenuProps={{
                                                PaperProps: { sx: cyberMenuPaperSx },
                                            }}
                                            sx={{
                                                minWidth: 68,
                                                height: 26,
                                                fontSize: "0.58rem",
                                                color: UI_COLORS.textPrimary,
                                                "& .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.border },
                                                "& .MuiSelect-icon": { color: UI_COLORS.textSecondary },
                                            }}
                                        >
                                            {TOKEN_SIZE_OPTIONS.map((opt) => (
                                                <MenuItem
                                                    key={opt.id}
                                                    value={opt.id}
                                                    sx={{ ...cyberMenuItemSx, fontSize: "0.7rem" }}
                                                >
                                                    {opt.label}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    )}
                                    {deployed && controllable && canDeploy && (
                                        <Tooltip title="Quitar del mapa">
                                            <IconButton
                                                size="small"
                                                onPointerDown={(e) => e.stopPropagation()}
                                                onClick={() => handleRemove(char.id)}
                                                sx={{ color: UI_COLORS.accentStrong || "#ff4d6d", p: 0.35 }}
                                            >
                                                <RemoveCircleOutlineIcon sx={{ fontSize: "1rem" }} />
                                            </IconButton>
                                        </Tooltip>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </Box>
            </Paper>

            {dragGhost && (
                <Box
                    ref={ghostElRef}
                    sx={{
                        position: "fixed",
                        left: dragGhost.x,
                        top: dragGhost.y,
                        transform: "translate(-50%, -50%)",
                        zIndex: 4000,
                        pointerEvents: "none",
                        opacity: 0.92,
                        filter: `drop-shadow(0 0 8px ${UI_COLORS.anomaly}88)`,
                    }}
                >
                    <CharAvatar
                        imagePath={dragGhost.imagePath}
                        name={dragGhost.name}
                        size={40}
                    />
                </Box>
            )}
        </>
    );
}
