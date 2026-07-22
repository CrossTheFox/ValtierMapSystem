import { useMemo, useState } from "react";
import {
    Box, IconButton, Popover, TextField, InputAdornment, CircularProgress, Badge,
} from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import BoltIcon from "@mui/icons-material/Bolt";
import SearchIcon from "@mui/icons-material/Search";
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
import CasinoIcon from "@mui/icons-material/Casino";
import { CyberText, CyberTitle } from "../customs/CustomTexts";
import CyberTooltip from "../customs/CyberTooltip";
import { UI_COLORS } from "../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import { VTT_HUD } from "../../constants/vttHudTokens";
import { useStatSystem } from "../../hooks/useStatSystem";
import { useCharacterSessionPools } from "../../hooks/useCharacterSessionPools";
import { useAssetUrl } from "../../hooks/useAssetUrl";
import { setActiveCharacterId, persistActiveCharacter } from "../../store/playerSlice";
import { showSnackbar } from "../../store/uiSlice";
import { canControlToken, isDmRole } from "../../utils/tokenControl";
import {
    listCampaignCharacters,
    resolveHpMax,
    resolveVit,
} from "../../utils/characterCombat";
import { normalizeTokenCrop, tokenCropCss } from "../../utils/tokenImageFit";
import { rollStatInChat } from "../../../firebase/services/chatService";
import AbilityHotbar from "./AbilityHotbar";

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

function TrackRow({ label, children, valueLabel }) {
    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minHeight: 22 }}>
            <CyberText
                sx={{
                    fontFamily: "monospace",
                    fontSize: "0.5rem",
                    letterSpacing: "0.1em",
                    color: UI_COLORS.textSecondary,
                    width: 42,
                    flexShrink: 0,
                }}
            >
                {label}
            </CyberText>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.3, flex: 1, minWidth: 0 }}>
                {children}
            </Box>
            {valueLabel != null && (
                <CyberText sx={{ fontFamily: "monospace", fontSize: "0.55rem", color: UI_COLORS.textSecondary }}>
                    {valueLabel}
                </CyberText>
            )}
        </Box>
    );
}

function CharAvatarButton({ char, active, onClick, size = 44 }) {
    const initials = (char.name || "?").slice(0, 2).toUpperCase();
    const crop = normalizeTokenCrop(char.tokenCrop);
    const imagePath = char.tokenImageUrl || char.imageUrl || "";
    const url = useAssetUrl(imagePath || null);
    const hasImg = Boolean(url);
    const cropCss = tokenCropCss(crop);

    return (
        <CyberTooltip title={onClick ? `${char.name || "—"} · cambiar` : (char.name || "—")} placement="top">
            <Box
                component={onClick ? "button" : "div"}
                type={onClick ? "button" : undefined}
                onClick={onClick}
                sx={{
                    width: size,
                    height: size,
                    borderRadius: "50%",
                    border: `2px solid ${active ? UI_COLORS.anomaly : UI_COLORS.border}`,
                    bgcolor: active ? `${UI_COLORS.anomaly}22` : "rgba(0,0,0,0.35)",
                    color: active ? UI_COLORS.anomaly : UI_COLORS.textSecondary,
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: size > 36 ? "0.65rem" : "0.5rem",
                    letterSpacing: "0.04em",
                    cursor: onClick ? "pointer" : "default",
                    p: 0,
                    boxShadow: active ? `0 0 10px ${UI_COLORS.anomaly}44` : "none",
                    overflow: "hidden",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "border-color 0.15s, box-shadow 0.15s, transform 0.12s",
                    "&:hover": onClick ? {
                        borderColor: UI_COLORS.accent,
                        transform: "scale(1.04)",
                        boxShadow: `0 0 12px ${UI_COLORS.accent}44`,
                    } : {},
                }}
            >
                {hasImg ? (
                    <Box
                        component="img"
                        src={url}
                        alt={char.name || ""}
                        decoding="sync"
                        loading="eager"
                        sx={{
                            width: "100%",
                            height: "100%",
                            ...cropCss,
                        }}
                    />
                ) : (
                    initials
                )}
            </Box>
        </CyberTooltip>
    );
}

function CharacterAvatarPicker({ roster, selectedId, onSelect, selected }) {
    const [anchor, setAnchor] = useState(null);
    const [query, setQuery] = useState("");

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return roster;
        return roster.filter((c) => (c.name || c.id || "").toLowerCase().includes(q));
    }, [roster, query]);

    const canPick = roster.length > 1;
    const open = Boolean(anchor);

    return (
        <>
            <CharAvatarButton
                char={selected}
                active
                size={46}
                onClick={canPick ? (e) => setAnchor(e.currentTarget) : undefined}
            />
            <Popover
                open={open}
                anchorEl={anchor}
                onClose={() => {
                    setAnchor(null);
                    setQuery("");
                }}
                anchorOrigin={{ vertical: "top", horizontal: "left" }}
                transformOrigin={{ vertical: "bottom", horizontal: "left" }}
                slotProps={{
                    paper: {
                        sx: {
                            mb: 1,
                            p: 1,
                            width: 220,
                            bgcolor: UI_COLORS.backgroundSecondary,
                            border: `1px solid ${UI_COLORS.border}`,
                            boxShadow: `0 0 18px ${UI_COLORS.accentGlow}`,
                            color: UI_COLORS.textPrimary,
                        },
                    },
                }}
            >
                <CyberText sx={{ fontSize: "0.5rem", letterSpacing: 1, color: UI_COLORS.textSecondary, mb: 0.75, px: 0.25 }}>
                    PERSONAJES
                </CyberText>
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        gap: 0.65,
                        maxHeight: 200,
                        overflowY: "auto",
                        mb: 1,
                        pr: 0.25,
                        ...CYBER_SCROLL_STYLE,
                    }}
                >
                    {filtered.map((c) => (
                        <CharAvatarButton
                            key={c.id}
                            char={c}
                            active={c.id === selectedId}
                            size={42}
                            onClick={() => {
                                onSelect(c.id);
                                setAnchor(null);
                                setQuery("");
                            }}
                        />
                    ))}
                    {filtered.length === 0 && (
                        <CyberText sx={{ gridColumn: "1 / -1", fontSize: "0.62rem", color: UI_COLORS.textSecondary, py: 1 }}>
                            Sin coincidencias
                        </CyberText>
                    )}
                </Box>
                <TextField
                    size="small"
                    fullWidth
                    placeholder="Buscar…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon sx={{ fontSize: "0.95rem", color: UI_COLORS.textSecondary }} />
                            </InputAdornment>
                        ),
                    }}
                    sx={{
                        "& .MuiInputBase-input": {
                            color: UI_COLORS.textPrimary,
                            fontFamily: "'Fira Code', monospace",
                            fontSize: "0.68rem",
                            py: 0.65,
                        },
                        "& .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.border },
                        "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.accent },
                        "& .Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.anomaly },
                    }}
                />
            </Popover>
        </>
    );
}

function EffortBar({ current, max, onSet }) {
    const color = "#f97316";
    return (
        <Box
            sx={{
                flex: 1,
                display: "flex",
                gap: 0.4,
                height: 10,
                minWidth: 0,
            }}
        >
            {Array.from({ length: max }, (_, i) => {
                const filled = i < current;
                return (
                    <CyberTooltip key={i} title={`Effort ${i + 1}${filled ? " (gastado)" : ""}`} placement="top">
                        <Box
                            component="button"
                            type="button"
                            onClick={() => onSet(i < current ? i : i + 1)}
                            sx={{
                                flex: 1,
                                height: "100%",
                                p: 0,
                                borderRadius: 0.5,
                                border: `1px solid ${filled ? color : "rgba(255,255,255,0.14)"}`,
                                bgcolor: filled ? color : "rgba(255,255,255,0.05)",
                                boxShadow: filled ? `0 0 8px ${color}55` : "none",
                                cursor: "pointer",
                                transition: "background-color 0.12s, transform 0.12s",
                                "&:hover": { transform: "scaleY(1.12)" },
                            }}
                        />
                    </CyberTooltip>
                );
            })}
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
        <CyberTooltip title={tip} placement="top">
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
    "&:hover": {
        borderColor: UI_COLORS.accent,
        bgcolor: `${UI_COLORS.accent}14`,
    },
});

export default function CharacterCombatHud({ abilityBarOpen = false, onToggleAbilityBar }) {
    const dispatch = useDispatch();
    const profile = useSelector((s) => s.player.profile);
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const locations = useSelector((s) => s.world.locations);
    const charactersById = useSelector((s) => s.world.charactersById ?? {});
    const sheetCharacters = useSelector((s) => s.characters.list);
    const { resourceTracks, stats: statDefs } = useStatSystem(campaignId);
    const [rollingKey, setRollingKey] = useState(null);
    const [statsOpen, setStatsOpen] = useState(false);

    const isDM = isDmRole(profile?.role);

    const roster = useMemo(() => {
        const byId = new Map(
            listCampaignCharacters(charactersById, locations).map((c) => [c.id, c]),
        );
        (sheetCharacters || []).forEach((c) => {
            if (c?.id && !byId.has(c.id)) byId.set(c.id, c);
        });
        const all = [...byId.values()];

        // DM: full campaign roster. Players: only tokens they control.
        const visible = isDM ? all : all.filter((c) => canControlToken(c, profile));
        return visible.sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));
    }, [charactersById, locations, sheetCharacters, isDM, profile]);

    const selectedId = profile?.activeCharacterId && roster.some((c) => c.id === profile.activeCharacterId)
        ? profile.activeCharacterId
        : roster[0]?.id || null;

    const selected = roster.find((c) => c.id === selectedId) || null;

    const vit = resolveVit(selected);
    const hpMax = resolveHpMax(selected);

    const combatTracks = useMemo(() => {
        const effort = (resourceTracks || []).find((t) => t.key === "effort")
            || { key: "effort", label: "Effort", maxDefault: 3 };
        return [
            { ...effort, maxDefault: 3 },
            { key: "hp", label: "HP", maxDefault: hpMax, defaultFull: true },
        ];
    }, [resourceTracks, hpMax]);

    const { pools, setTrack } = useCharacterSessionPools(selected?.id, combatTracks);

    const handleSelect = (charId) => {
        if (!profile?.uid || !charId) return;
        dispatch(setActiveCharacterId(charId));
        dispatch(persistActiveCharacter({ uid: profile.uid, characterId: charId }));
    };

    const handleStatRoll = async (statDef) => {
        if (!campaignId || !selected || !statDef?.key || rollingKey) return;
        const value = selected.stats?.[statDef.key] ?? 0;
        setRollingKey(statDef.key);
        try {
            const result = await rollStatInChat(campaignId, profile, selected, statDef, value);
            dispatch(showSnackbar({
                message: `${statDef.label}: ${result.total}  [${result.rolls.join(", ")}]`,
                severity: "info",
            }));
        } catch (err) {
            console.error(err);
            dispatch(showSnackbar({ message: "No se pudo publicar la tirada", severity: "error" }));
        } finally {
            setRollingKey(null);
        }
    };

    const statRows = useMemo(() => {
        const defs = statDefs || [];
        if (!defs.length) return [];
        const cols = Math.max(1, Math.ceil(defs.length / 3));
        const rows = [];
        for (let i = 0; i < defs.length; i += cols) {
            rows.push(defs.slice(i, i + cols));
        }
        return rows;
    }, [statDefs]);

    if (!profile || !selected) return null;

    const effortMax = 3;
    const effortCur = Math.min(Math.max(pools.effort?.current ?? 0, 0), effortMax);
    const hpCur = Math.min(Math.max(pools.hp?.current ?? hpMax, 0), hpMax);
    const hpPct = hpMax > 0 ? (hpCur / hpMax) * 100 : 0;

    return (
        <>
            <Box
                data-no-token-drop
                sx={{
                    position: "fixed",
                    bottom: VTT_HUD.inset,
                    left: VTT_HUD.inset,
                    zIndex: 1200,
                    pointerEvents: "auto",
                    minWidth: 260,
                    maxWidth: 320,
                    p: "10px 12px",
                    borderRadius: `${VTT_HUD.borderRadius}px`,
                    border: `1px solid ${VTT_HUD.glassBorder}`,
                    bgcolor: VTT_HUD.glassBg,
                    backdropFilter: "blur(14px)",
                    boxShadow: "0 0 20px rgba(255,102,255,0.06)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.75,
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <CharacterAvatarPicker
                        roster={roster}
                        selectedId={selectedId}
                        selected={selected}
                        onSelect={handleSelect}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <CyberTitle
                            sx={{
                                fontSize: "0.72rem",
                                letterSpacing: "0.08em",
                                color: "#fff",
                                lineHeight: 1.2,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {selected.name || "—"}
                        </CyberTitle>
                        <CyberText sx={{ fontFamily: "monospace", fontSize: "0.5rem", color: UI_COLORS.textSecondary }}>
                            VIT {vit} · HP max {hpMax}
                        </CyberText>
                    </Box>
                </Box>

                <TrackRow label="HP" valueLabel={`${hpCur}/${hpMax}`}>
                    <Box
                        sx={{
                            flex: 1,
                            height: 10,
                            borderRadius: 0.5,
                            bgcolor: "rgba(255,255,255,0.06)",
                            overflow: "hidden",
                            cursor: "pointer",
                            border: `1px solid ${UI_COLORS.border}`,
                        }}
                        onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
                            setTrack("hp", { current: Math.round(ratio * hpMax) });
                        }}
                    >
                        <Box
                            sx={{
                                height: "100%",
                                width: `${hpPct}%`,
                                bgcolor: hpPct <= 25 ? "#ff3355" : hpPct <= 50 ? "#f97316" : UI_COLORS.anomaly,
                                boxShadow: `0 0 8px ${UI_COLORS.anomaly}33`,
                                transition: "width 0.15s, background-color 0.15s",
                            }}
                        />
                    </Box>
                </TrackRow>

                <TrackRow label="EFFORT" valueLabel={`${effortCur}/${effortMax}`}>
                    <EffortBar
                        current={effortCur}
                        max={effortMax}
                        onSet={(v) => setTrack("effort", { current: v })}
                    />
                </TrackRow>
            </Box>

            <Box
                data-no-token-drop
                sx={{
                    position: "fixed",
                    bottom: VTT_HUD.inset,
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 1200,
                    pointerEvents: "auto",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 0.55,
                    maxWidth: "min(720px, calc(100vw - 48px))",
                }}
            >
                {statsOpen && statRows.length > 0 && (
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 0.4,
                            p: 0.55,
                            borderRadius: `${VTT_HUD.borderRadius}px`,
                            border: `1px solid ${VTT_HUD.glassBorder}`,
                            bgcolor: VTT_HUD.glassBg,
                            backdropFilter: "blur(14px)",
                            boxShadow: "0 0 18px rgba(255,102,255,0.08)",
                        }}
                    >
                        {statRows.map((row, rowIdx) => (
                            <Box
                                key={rowIdx}
                                sx={{
                                    display: "flex",
                                    flexDirection: "row",
                                    gap: 0.4,
                                    justifyContent: "center",
                                }}
                            >
                                {row.map((def) => (
                                    <StatIconButton
                                        key={def.key}
                                        statDef={def}
                                        value={selected.stats?.[def.key] ?? 0}
                                        busy={rollingKey === def.key}
                                        onRoll={() => handleStatRoll(def)}
                                    />
                                ))}
                            </Box>
                        ))}
                    </Box>
                )}

                {statRows.length > 0 && (
                    <CyberTooltip
                        title={statsOpen ? "Cerrar stats" : "Stats / tiradas"}
                        placement="top"
                    >
                        <IconButton
                            size="small"
                            onClick={() => setStatsOpen((v) => !v)}
                            aria-pressed={statsOpen}
                            aria-label="Panel de stats"
                            sx={glassBtnSx(statsOpen)}
                        >
                            <CasinoIcon sx={{ fontSize: "1.15rem" }} />
                        </IconButton>
                    </CyberTooltip>
                )}

                <Box sx={{ display: "flex", alignItems: "center", gap: 0.65 }}>
                    <AbilityHotbar
                        open={abilityBarOpen}
                        onClose={() => {
                            if (abilityBarOpen) onToggleAbilityBar?.();
                        }}
                    />
                    {typeof onToggleAbilityBar === "function" && (
                        <CyberTooltip
                            title={abilityBarOpen ? "Cerrar habilidades" : "Habilidades del personaje"}
                            placement="top"
                        >
                            <IconButton
                                size="small"
                                onClick={onToggleAbilityBar}
                                aria-pressed={abilityBarOpen}
                                aria-label="Barra de habilidades"
                                sx={glassBtnSx(abilityBarOpen)}
                            >
                                <BoltIcon sx={{ fontSize: "1.15rem" }} />
                            </IconButton>
                        </CyberTooltip>
                    )}
                </Box>
            </Box>
        </>
    );
}
