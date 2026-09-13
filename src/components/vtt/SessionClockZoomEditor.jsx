import { Box, IconButton } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import GroupsIcon from "@mui/icons-material/Groups";
import PersonIcon from "@mui/icons-material/Person";
import { CyberText, CyberTitle } from "../customs/CustomTexts";
import ClockDial from "./ClockDial";
import { HUD_SURFACE, TYPO } from "../../constants/designSystem";
import { UI_COLORS } from "../../constants/uiColors";
import { useAssetUrl } from "../../hooks/useAssetUrl";
import {
    CLOCK_RESOLVE_MODES,
    CLOCK_SCOPES,
    CLOCK_SIZES,
    sizeTheme,
} from "../../utils/clockInstance";
import { formatFilledLabel, jumpToHalfSteps } from "../../utils/clockResolver";

const PJ_WINDOW = 5;

function Chip({ on, color = UI_COLORS.accent, onClick, children, sx = {} }) {
    return (
        <Box
            component="button"
            type="button"
            onClick={onClick}
            sx={{
                minHeight: 24,
                px: 0.7,
                border: `1px solid ${on ? color : UI_COLORS.border}`,
                borderRadius: "3px",
                bgcolor: on ? `${color}22` : "rgba(0,0,0,0.35)",
                color: on ? color : UI_COLORS.textSecondary,
                fontFamily: TYPO.mono,
                fontSize: "8px",
                letterSpacing: "0.08em",
                cursor: "pointer",
                textTransform: "uppercase",
                ...sx,
            }}
        >
            {children}
        </Box>
    );
}

function circularSlice(list, start, count) {
    const n = list.length;
    if (!n) return [];
    const out = [];
    for (let i = 0; i < Math.min(count, n); i += 1) {
        out.push(list[(start + i) % n]);
    }
    return out;
}

function quotaLabel(q) {
    if (q === -1) return "∞";
    if (q == null || q <= 0) return "—";
    return String(q);
}

function PjCard({ pj, assignedScope, granted, quota, viewing, onToggleGrant, onQuota, onToggleEye }) {
    const url = useAssetUrl(pj.img);
    const color = pj.color || UI_COLORS.anomaly;
    return (
        <Box
            data-pj={pj.id}
            onClick={() => onToggleGrant(pj.id)}
            sx={{
                position: "relative",
                width: 78,
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: "3px",
                px: 0.75,
                pt: 1,
                pb: 0.75,
                minHeight: 96,
                border: granted ? `1px solid ${color}` : `1px dashed ${UI_COLORS.border}`,
                borderRadius: "6px",
                bgcolor: granted ? `${color}14` : "rgba(0,0,0,0.35)",
                cursor: "pointer",
                color: UI_COLORS.textPrimary,
            }}
        >
            {assignedScope && (
                <Box
                    component="button"
                    type="button"
                    aria-label={viewing ? "Ocultar clock" : "Mostrar clock"}
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleEye(pj.id);
                    }}
                    sx={{
                        position: "absolute",
                        top: 4,
                        right: 4,
                        width: 18,
                        height: 18,
                        p: 0,
                        border: 0,
                        borderRadius: "2px",
                        bgcolor: "transparent",
                        color: viewing ? UI_COLORS.anomaly : UI_COLORS.textSecondary,
                        cursor: "pointer",
                        display: "grid",
                        placeItems: "center",
                    }}
                >
                    {viewing
                        ? <VisibilityIcon sx={{ fontSize: 12 }} />
                        : <VisibilityOffIcon sx={{ fontSize: 12 }} />}
                </Box>
            )}
            <Box sx={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                overflow: "hidden",
                border: `1px solid ${UI_COLORS.border}`,
                bgcolor: "#050508",
            }}>
                {url
                    ? <Box component="img" src={url} alt="" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <PersonIcon sx={{ fontSize: 16, color: UI_COLORS.textSecondary, m: "8px" }} />}
            </Box>
            <CyberTitle sx={{ fontSize: "8px", letterSpacing: "0.06em", color: UI_COLORS.textPrimary, maxWidth: 70, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {pj.name}
            </CyberTitle>
            <CyberText sx={{ fontSize: "7px", color: UI_COLORS.textSecondary, fontFamily: TYPO.mono }}>
                {pj.playerName || "—"}
            </CyberText>
            <Box
                sx={{ display: "flex", alignItems: "center", gap: 0.25 }}
                onClick={(e) => e.stopPropagation()}
            >
                <Chip on={false} onClick={() => onQuota(pj.id, "dec")} sx={{ minWidth: 18, px: 0, minHeight: 18 }}>−</Chip>
                <CyberText sx={{ fontSize: "8px", color: granted ? UI_COLORS.anomaly : UI_COLORS.textSecondary, minWidth: 14, textAlign: "center", fontFamily: TYPO.mono }}>
                    {quotaLabel(quota)}
                </CyberText>
                <Chip on={false} onClick={() => onQuota(pj.id, "inc")} sx={{ minWidth: 18, px: 0, minHeight: 18 }}>+</Chip>
                <Chip on={quota === -1} color={UI_COLORS.anomaly} onClick={() => onQuota(pj.id, "inf")} sx={{ minWidth: 18, px: 0, minHeight: 18 }}>∞</Chip>
            </Box>
        </Box>
    );
}

/**
 * Zoom editor — sole edit UI. Auto-save via onPatch. No GUARDAR/CERRAR.
 */
export default function SessionClockZoomEditor({
    clock,
    isNew = false,
    roster = [],
    pjOffset = 0,
    onPjOffset,
    actionDefs = [],
    onPatch,
    onJumpFill,
    onCycleSize,
    onDelete,
}) {
    if (!clock) return null;
    const theme = sizeTheme(clock.sizeTicks);
    const assigned = clock.visibility.clockScope === CLOCK_SCOPES.ASSIGNED;
    const viewers = clock.visibility.viewerCharacterIds || [];
    const quotas = clock.resolveGrant?.quotas || {};
    const needNav = roster.length > PJ_WINDOW;
    const visiblePjs = needNav ? circularSlice(roster, pjOffset, PJ_WINDOW) : roster;
    const hubLabel = formatFilledLabel(clock.filledHalfSteps, clock.sizeTicks);

    const applyQuota = (id, op) => {
        const cur = quotas[id];
        const granted = cur === -1 || (cur != null && cur > 0);
        const next = { ...quotas };
        if (!granted) {
            if (op === "dec") return;
            next[id] = op === "inf" ? -1 : 1;
        } else if (op === "inf") next[id] = -1;
        else if (op === "inc") next[id] = cur === -1 ? 1 : cur + 1;
        else if (op === "dec") {
            if (cur === -1) next[id] = 3;
            else if (cur <= 1) next[id] = 0;
            else next[id] = cur - 1;
        }
        onPatch({ resolveGrant: { quotas: next } });
    };

    return (
        <Box
            sx={{
                ...HUD_SURFACE,
                position: "relative",
                mt: 1.25,
                p: 1.5,
                "--clock-color": theme.hex,
            }}
        >
            <Box sx={{
                position: "absolute",
                top: -7,
                left: 72,
                width: 12,
                height: 12,
                bgcolor: HUD_SURFACE.bgcolor,
                borderLeft: HUD_SURFACE.border,
                borderTop: HUD_SURFACE.border,
                transform: "rotate(45deg)",
                pointerEvents: "none",
            }} />

            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1.25 }}>
                <CyberTitle sx={{ fontSize: "8px", letterSpacing: "0.16em", color: UI_COLORS.accent, flexShrink: 0 }}>
                    {isNew ? "ZOOM · NUEVO" : "ZOOM · CLOCK"}
                </CyberTitle>
                <Box
                    component="input"
                    value={clock.name}
                    onChange={(e) => onPatch({ name: e.target.value })}
                    placeholder="NOMBRE"
                    sx={{
                        flex: 1,
                        minWidth: 0,
                        px: 0.5,
                        py: 0.5,
                        bgcolor: "transparent",
                        border: 0,
                        borderBottom: `1px solid ${theme.hex}aa`,
                        color: UI_COLORS.textPrimary,
                        fontFamily: "Orbitron, sans-serif",
                        fontSize: "13px",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        textAlign: "center",
                        outline: "none",
                    }}
                />
                <IconButton
                    size="small"
                    aria-label="Eliminar clock"
                    onClick={onDelete}
                    sx={{
                        width: 28,
                        height: 28,
                        border: `1px solid ${UI_COLORS.danger}73`,
                        borderRadius: "4px",
                        color: UI_COLORS.danger,
                        bgcolor: `${UI_COLORS.danger}1a`,
                        "&:hover": { bgcolor: `${UI_COLORS.danger}38` },
                    }}
                >
                    <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                </IconButton>
            </Box>

            <Box sx={{
                display: "grid",
                gridTemplateColumns: "132px minmax(200px, 1fr) 148px",
                gap: 1.25,
                alignItems: "center",
            }}>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1, alignSelf: "center" }}>
                    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.5 }}>
                        {CLOCK_SIZES.map((s) => {
                            const t = sizeTheme(s);
                            return (
                                <Chip
                                    key={s}
                                    on={clock.sizeTicks === s}
                                    color={t.hex}
                                    onClick={() => onPatch({
                                        sizeTicks: s,
                                        filledHalfSteps: jumpToHalfSteps(clock.filledHalfSteps, s),
                                    })}
                                    sx={{ height: 32, fontSize: "11px" }}
                                >
                                    {s}
                                </Chip>
                            );
                        })}
                    </Box>
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                        <Chip
                            on={clock.resolveMode === CLOCK_RESOLVE_MODES.GENERIC}
                            color={UI_COLORS.anomaly}
                            onClick={() => onPatch({ resolveMode: CLOCK_RESOLVE_MODES.GENERIC })}
                            sx={{ flex: 1 }}
                        >
                            G
                        </Chip>
                        <Chip
                            on={clock.resolveMode === CLOCK_RESOLVE_MODES.ACTIONS}
                            color="#ffb020"
                            onClick={() => onPatch({ resolveMode: CLOCK_RESOLVE_MODES.ACTIONS })}
                            sx={{ flex: 1 }}
                        >
                            A
                        </Chip>
                    </Box>
                </Box>

                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                    <Box sx={{ position: "relative", width: 132, height: 132 }}>
                        <ClockDial
                            variant="zoom"
                            sizeTicks={clock.sizeTicks}
                            filledHalfSteps={clock.filledHalfSteps}
                            allowWedges
                            allowResolve={false}
                            secret={clock.visibility.clockScope === CLOCK_SCOPES.DM_ONLY}
                            theme={theme}
                            onJumpToHalfSteps={onJumpFill}
                            showCenterLabel={false}
                        />
                        <Box sx={{
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            zIndex: 3,
                        }}>
                            <Box
                                component="button"
                                type="button"
                                title={`${theme.label} · ${hubLabel} · click = ciclar tamaño`}
                                onClick={onCycleSize}
                                sx={{
                                    width: 52,
                                    height: 52,
                                    borderRadius: "50%",
                                    border: `1.8px solid ${theme.hex}`,
                                    bgcolor: `${theme.hex}24`,
                                    color: theme.hex,
                                    fontFamily: "Orbitron, sans-serif",
                                    fontSize: "11px",
                                    fontVariantNumeric: "tabular-nums",
                                    cursor: "pointer",
                                    boxShadow: `0 0 16px ${theme.hex}52`,
                                }}
                            >
                                {hubLabel}
                            </Box>
                        </Box>
                    </Box>
                </Box>

                <Box sx={{ display: "flex", flexDirection: "column", gap: 1, alignSelf: "center" }}>
                    <Chip
                        on={clock.visibility.clockScope === CLOCK_SCOPES.DM_ONLY}
                        onClick={() => onPatch({
                            visibility: {
                                ...clock.visibility,
                                clockScope: CLOCK_SCOPES.DM_ONLY,
                                rollScope: "dm_only",
                                viewerCharacterIds: [],
                            },
                        })}
                        sx={{ display: "flex", alignItems: "center", gap: 0.5, justifyContent: "flex-start" }}
                    >
                        <VisibilityOffIcon sx={{ fontSize: 12 }} /> SOLO DM
                    </Chip>
                    <Chip
                        on={clock.visibility.clockScope === CLOCK_SCOPES.PUBLIC}
                        color={UI_COLORS.anomaly}
                        onClick={() => onPatch({
                            visibility: {
                                ...clock.visibility,
                                clockScope: CLOCK_SCOPES.PUBLIC,
                                rollScope: "public",
                            },
                        })}
                        sx={{ display: "flex", alignItems: "center", gap: 0.5, justifyContent: "flex-start" }}
                    >
                        <GroupsIcon sx={{ fontSize: 12 }} /> MESA
                    </Chip>
                    <Chip
                        on={assigned}
                        color={UI_COLORS.boon}
                        onClick={() => onPatch({
                            visibility: {
                                ...clock.visibility,
                                clockScope: CLOCK_SCOPES.ASSIGNED,
                                rollScope: "personal",
                            },
                        })}
                        sx={{ display: "flex", alignItems: "center", gap: 0.5, justifyContent: "flex-start" }}
                    >
                        <PersonIcon sx={{ fontSize: 12 }} /> PERSONAJES
                    </Chip>
                </Box>
            </Box>

            {clock.resolveMode === CLOCK_RESOLVE_MODES.GENERIC && (
                <Box sx={{ display: "flex", gap: 0.5, mt: 1, flexWrap: "wrap" }}>
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                        <Chip
                            key={n}
                            on={clock.diceCount === n}
                            color={UI_COLORS.anomaly}
                            onClick={() => onPatch({ diceCount: n })}
                        >
                            {n}d6
                        </Chip>
                    ))}
                </Box>
            )}
            {clock.resolveMode === CLOCK_RESOLVE_MODES.ACTIONS && (
                <Box sx={{ display: "flex", gap: 0.5, mt: 1, flexWrap: "wrap" }}>
                    {actionDefs.map((a) => {
                        const id = a.key || a.id;
                        const on = (clock.actionIds || []).includes(id);
                        return (
                            <Chip
                                key={id}
                                on={on}
                                color="#ffb020"
                                onClick={() => {
                                    const cur = clock.actionIds || [];
                                    const next = on ? cur.filter((x) => x !== id) : [...cur, id];
                                    onPatch({ actionIds: next });
                                }}
                            >
                                {a.label || a.name || id}
                            </Chip>
                        );
                    })}
                </Box>
            )}

            <Box sx={{ display: "flex", alignItems: "stretch", gap: 0.75, mt: 1.25 }}>
                {needNav && (
                    <IconButton size="small" onClick={() => onPjOffset(-1)} sx={{ color: UI_COLORS.accent, alignSelf: "stretch", border: `1px solid ${UI_COLORS.border}`, borderRadius: "4px" }}>
                        <ChevronLeftIcon fontSize="small" />
                    </IconButton>
                )}
                <Box sx={{ flex: 1, display: "flex", justifyContent: "center", gap: 0.75, overflow: "hidden" }}>
                    {visiblePjs.map((pj) => {
                        const q = quotas[pj.id];
                        const granted = q === -1 || (q != null && q > 0);
                        return (
                            <PjCard
                                key={pj.id}
                                pj={pj}
                                assignedScope={assigned}
                                granted={granted}
                                quota={q}
                                viewing={viewers.includes(pj.id)}
                                onToggleGrant={(id) => {
                                    const next = { ...quotas };
                                    if (granted) next[id] = 0;
                                    else next[id] = 1;
                                    onPatch({ resolveGrant: { quotas: next } });
                                }}
                                onQuota={applyQuota}
                                onToggleEye={(id) => {
                                    const has = viewers.includes(id);
                                    const viewerCharacterIds = has
                                        ? viewers.filter((x) => x !== id)
                                        : [...viewers, id];
                                    onPatch({
                                        visibility: {
                                            ...clock.visibility,
                                            clockScope: CLOCK_SCOPES.ASSIGNED,
                                            viewerCharacterIds,
                                            rollScope: clock.visibility.rollScope === "dm_only"
                                                ? "personal"
                                                : clock.visibility.rollScope,
                                        },
                                    });
                                }}
                            />
                        );
                    })}
                </Box>
                {needNav && (
                    <IconButton size="small" onClick={() => onPjOffset(1)} sx={{ color: UI_COLORS.accent, alignSelf: "stretch", border: `1px solid ${UI_COLORS.border}`, borderRadius: "4px" }}>
                        <ChevronRightIcon fontSize="small" />
                    </IconButton>
                )}
            </Box>
        </Box>
    );
}
