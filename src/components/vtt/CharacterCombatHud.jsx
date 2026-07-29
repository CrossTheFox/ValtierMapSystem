import { useMemo, useState } from "react";
import {
    Box, IconButton, Popover, TextField, InputAdornment,
} from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import BoltIcon from "@mui/icons-material/Bolt";
import SearchIcon from "@mui/icons-material/Search";
import BadgeIcon from "@mui/icons-material/Badge";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import PushPinIcon from "@mui/icons-material/PushPin";
import { CyberText, CyberTitle } from "../customs/CustomTexts";
import CyberTooltip from "../customs/CyberTooltip";
import { UI_COLORS } from "../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import { VTT_HUD } from "../../constants/vttHudTokens";
import { useStatSystem } from "../../hooks/useStatSystem";
import { useCharacterSessionPools } from "../../hooks/useCharacterSessionPools";
import { usePinnedCharacters } from "../../hooks/usePinnedCharacters";
import { useAssetUrl } from "../../hooks/useAssetUrl";
import { setActiveCharacterId, persistActiveCharacter } from "../../store/playerSlice";
import { openCharacterSheet } from "../../store/uiSlice";
import { canControlToken, isDmRole } from "../../utils/tokenControl";
import {
    listCampaignCharacters,
    resolveHpMax,
    resolveVit,
} from "../../utils/characterCombat";
import { normalizeTokenCrop, tokenCropCss } from "../../utils/tokenImageFit";
import { getSessionPools } from "../../utils/characterSessionPools";
import AbilityHotbar from "./AbilityHotbar";

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

function CharAvatarButton({ char, active, onClick, size = 44, pinned = false }) {
    const initials = (char.name || "?").slice(0, 2).toUpperCase();
    const crop = normalizeTokenCrop(char.tokenCrop);
    const imagePath = char.tokenImageUrl || char.imageUrl || "";
    const url = useAssetUrl(imagePath || null);
    const hasImg = Boolean(url);
    const cropCss = tokenCropCss(crop);

    return (
        <CyberTooltip title={onClick ? `${char.name || "—"} · activar` : (char.name || "—")} placement="top">
            <Box
                component={onClick ? "button" : "div"}
                type={onClick ? "button" : undefined}
                onClick={onClick}
                sx={{
                    position: "relative",
                    width: size,
                    height: size,
                    borderRadius: "50%",
                    border: `2px solid ${active ? UI_COLORS.anomaly : pinned ? UI_COLORS.accent : UI_COLORS.border}`,
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

function MiniHpBar({ pct }) {
    const color = pct <= 25 ? "#ff3355" : pct <= 50 ? "#f97316" : UI_COLORS.anomaly;
    return (
        <Box
            sx={{
                mt: 0.35,
                width: "100%",
                height: 3,
                borderRadius: 1,
                bgcolor: "rgba(255,255,255,0.08)",
                overflow: "hidden",
            }}
        >
            <Box sx={{ height: "100%", width: `${pct}%`, bgcolor: color }} />
        </Box>
    );
}

function CharacterAvatarPicker({ roster, selectedId, onSelect, selected, pinnedIds, onTogglePin }) {
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
                            width: 240,
                            bgcolor: UI_COLORS.backgroundSecondary,
                            border: `1px solid ${UI_COLORS.border}`,
                            boxShadow: `0 0 18px ${UI_COLORS.accentGlow}`,
                            color: UI_COLORS.textPrimary,
                        },
                    },
                }}
            >
                <CyberText sx={{ fontSize: "0.5rem", letterSpacing: 1, color: UI_COLORS.textSecondary, mb: 0.75, px: 0.25 }}>
                    ACTIVAR / PIN
                </CyberText>
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 0.5,
                        maxHeight: 220,
                        overflowY: "auto",
                        mb: 1,
                        pr: 0.25,
                        ...CYBER_SCROLL_STYLE,
                    }}
                >
                    {filtered.map((c) => {
                        const isPinned = pinnedIds.includes(c.id);
                        const isActive = c.id === selectedId;
                        return (
                            <Box
                                key={c.id}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 0.75,
                                    px: 0.5,
                                    py: 0.35,
                                    borderRadius: 1,
                                    border: `1px solid ${isActive ? UI_COLORS.anomaly : "transparent"}`,
                                    bgcolor: isActive ? `${UI_COLORS.anomaly}12` : "transparent",
                                }}
                            >
                                <CharAvatarButton
                                    char={c}
                                    active={isActive}
                                    pinned={isPinned}
                                    size={36}
                                    onClick={() => {
                                        onSelect(c.id);
                                        setAnchor(null);
                                        setQuery("");
                                    }}
                                />
                                <CyberText
                                    sx={{
                                        flex: 1,
                                        minWidth: 0,
                                        fontSize: "0.62rem",
                                        color: UI_COLORS.textPrimary,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        cursor: "pointer",
                                    }}
                                    onClick={() => {
                                        onSelect(c.id);
                                        setAnchor(null);
                                        setQuery("");
                                    }}
                                >
                                    {c.name || "—"}
                                </CyberText>
                                <CyberTooltip title={isPinned ? "Quitar pin" : "Pin en HUD"}>
                                    <IconButton
                                        size="small"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onTogglePin(c.id);
                                        }}
                                        sx={{
                                            color: isPinned ? UI_COLORS.accent : UI_COLORS.textSecondary,
                                            p: 0.35,
                                        }}
                                    >
                                        <PushPinIcon sx={{ fontSize: "0.85rem" }} />
                                    </IconButton>
                                </CyberTooltip>
                            </Box>
                        );
                    })}
                    {filtered.length === 0 && (
                        <CyberText sx={{ fontSize: "0.62rem", color: UI_COLORS.textSecondary, py: 1 }}>
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

/** Bottom dock: session life sheet + pins + dossier/mesh deep-links + macros. */
export default function CharacterCombatHud({ abilityBarOpen = false, onToggleAbilityBar }) {
    const dispatch = useDispatch();
    const profile = useSelector((s) => s.player.profile);
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const locations = useSelector((s) => s.world.locations);
    const charactersById = useSelector((s) => s.world.charactersById ?? {});
    const sheetCharacters = useSelector((s) => s.characters.list);
    const remotePools = useSelector((s) => s.game.sessionPools ?? {});
    const { resourceTracks } = useStatSystem(campaignId);

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

    const { pinnedIds, togglePin, pinCharacter } = usePinnedCharacters(profile?.uid, campaignId);

    const pinnedChars = useMemo(() => {
        return pinnedIds
            .map((id) => roster.find((c) => c.id === id))
            .filter(Boolean)
            .filter((c) => c.id !== selectedId);
    }, [pinnedIds, roster, selectedId]);

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

    const { pools, setTrack } = useCharacterSessionPools(selected?.id, combatTracks, { campaignId });

    const resolvePinHp = (char) => {
        const max = resolveHpMax(char);
        const tracks = [{ key: "hp", label: "HP", maxDefault: max, defaultFull: true }];
        const remote = remotePools?.[char.id]?.hp;
        const local = getSessionPools(char.id, tracks).hp;
        const current = remote?.current ?? local?.current ?? max;
        const cur = Math.min(Math.max(Number(current) || 0, 0), max);
        return { cur, max, pct: max > 0 ? (cur / max) * 100 : 0 };
    };

    const handleSelect = (charId) => {
        if (!profile?.uid || !charId) return;
        dispatch(setActiveCharacterId(charId));
        dispatch(persistActiveCharacter({ uid: profile.uid, characterId: charId }));
        pinCharacter(charId);
    };

    if (!profile || !selected) return null;

    const effortMax = 3;
    const effortCur = Math.min(Math.max(pools.effort?.current ?? 0, 0), effortMax);
    const hpCur = Math.min(Math.max(pools.hp?.current ?? hpMax, 0), hpMax);
    const hpPct = hpMax > 0 ? (hpCur / hpMax) * 100 : 0;
    const canToggleAbilities = typeof onToggleAbilityBar === "function";

    return (
        <Box
            data-no-token-drop
            sx={{
                position: "fixed",
                bottom: VTT_HUD.inset,
                left: VTT_HUD.inset,
                zIndex: 1200,
                pointerEvents: "auto",
                display: "flex",
                alignItems: "flex-end",
                gap: 0.75,
                maxWidth: "calc(100vw - 32px)",
            }}
        >
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, minWidth: 0 }}>
                {pinnedChars.length > 0 && (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "flex-end",
                            gap: 0.65,
                            px: 0.5,
                            maxWidth: 320,
                            overflowX: "auto",
                            ...CYBER_SCROLL_STYLE,
                        }}
                    >
                        {pinnedChars.map((c) => {
                            const hp = resolvePinHp(c);
                            return (
                                <Box
                                    key={c.id}
                                    sx={{
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        width: 40,
                                        flexShrink: 0,
                                    }}
                                >
                                    <CharAvatarButton
                                        char={c}
                                        pinned
                                        size={34}
                                        onClick={() => handleSelect(c.id)}
                                    />
                                    <MiniHpBar pct={hp.pct} />
                                </Box>
                            );
                        })}
                    </Box>
                )}

                <Box
                    sx={{
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
                        flexShrink: 0,
                    }}
                >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <CharacterAvatarPicker
                            roster={roster}
                            selectedId={selectedId}
                            selected={selected}
                            onSelect={handleSelect}
                            pinnedIds={pinnedIds}
                            onTogglePin={togglePin}
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
            </Box>

            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.65,
                    minWidth: 0,
                    pb: 0.15,
                }}
            >
                <CyberTooltip title="Abrir dossier (identidad)" placement="top">
                    <IconButton
                        size="small"
                        onClick={() => dispatch(openCharacterSheet({ tab: "IDENTIDAD" }))}
                        aria-label="Abrir dossier"
                        sx={glassBtnSx(false)}
                    >
                        <BadgeIcon sx={{ fontSize: "1.1rem" }} />
                    </IconButton>
                </CyberTooltip>
                <CyberTooltip title="Abrir Neural Mesh" placement="top">
                    <IconButton
                        size="small"
                        onClick={() => dispatch(openCharacterSheet({ tab: "KIT", kitView: "tree" }))}
                        aria-label="Abrir Neural Mesh"
                        sx={glassBtnSx(false)}
                    >
                        <AccountTreeIcon sx={{ fontSize: "1.1rem" }} />
                    </IconButton>
                </CyberTooltip>
                {canToggleAbilities && (
                    <>
                        <CyberTooltip
                            title={abilityBarOpen ? "Cerrar macros" : "Macros / habilidades"}
                            placement="top"
                        >
                            <IconButton
                                size="small"
                                onClick={onToggleAbilityBar}
                                aria-pressed={abilityBarOpen}
                                aria-label="Barra de macros y habilidades"
                                sx={glassBtnSx(abilityBarOpen)}
                            >
                                <BoltIcon sx={{ fontSize: "1.15rem" }} />
                            </IconButton>
                        </CyberTooltip>
                        {abilityBarOpen && (
                            <AbilityHotbar
                                open={abilityBarOpen}
                                onClose={() => {
                                    if (abilityBarOpen) onToggleAbilityBar?.();
                                }}
                            />
                        )}
                    </>
                )}
            </Box>
        </Box>
    );
}
