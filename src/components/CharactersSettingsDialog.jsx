import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { fetchPlayerCharacters } from "../store/characterSlice";
import { setActiveCharacterId, persistActiveCharacter } from "../store/playerSlice";

import { 
    Dialog, 
    DialogContent, 
    Grid, 
    Box, 
    Stack, 
    Divider, 
    CircularProgress, 
    IconButton, 
    Collapse,
    Tooltip,
    Paper,
    Rating,
} from "@mui/material";

import { loadFirebaseAsset } from "../../firebase/services/assetLoader";

import { CyberTitle, CyberText } from "./customs/CustomTexts";
import { UI_COLORS } from "../constants/uiColors";
import { emptyBond } from "../constants/statSystem";
import { useStatSystem } from "../hooks/useStatSystem";
import { useCharacterSessionPools } from "../hooks/useCharacterSessionPools";
import { CyberCheckbox } from "./customs/CyberCheckbox";
import { DialogFontSizeContext } from "../contexts/DialogFontSizeContext";
import CharSkillsTab from "./tabs/subtabs/CharSkillsTab";
import CharTreeTab from "./tabs/subtabs/CharTreeTab";

import CloseIcon        from "@mui/icons-material/Close";
import ExpandMoreIcon   from "@mui/icons-material/ExpandMore";
import RemoveIcon       from "@mui/icons-material/Remove";
import AspectRatioIcon  from "@mui/icons-material/AspectRatio";
import TextIncreaseIcon from "@mui/icons-material/TextIncrease";
import TextDecreaseIcon from "@mui/icons-material/TextDecrease";
import OpenInNewIcon    from "@mui/icons-material/OpenInNew";

import DraggableResizablePaper from "./DraggableResizablePaper";
import usePopout               from "../hooks/usePopout";

const MAX_FONT_STEP      = 3;
const DISABLED_BTN_COLOR = "rgba(255,255,255,0.32)";

/** Body copy on dark dialog — MUI Typography defaults are too dark */
const TXT = { color: "rgba(255,255,255,0.92)" };
const TXT_MUTED = { color: "rgba(255,255,255,0.55)" };

const CYBER_SCROLL_STYLE = {
    overflowY: "auto",
    overflowX: "hidden",
    '&::-webkit-scrollbar': { width: '6px' },
    '&::-webkit-scrollbar-track': { background: '#0d0d14' },
    '&::-webkit-scrollbar-thumb': {
        backgroundColor: 'transparent',
        backgroundImage: `linear-gradient(180deg, ${UI_COLORS.accent} 0%, rgba(0, 242, 234, 0.2) 50%, ${UI_COLORS.accent} 100%)`,
        border: `1px solid ${UI_COLORS.accent}`,
        borderRadius: '2px'
    }
};

const CharBioTab = ({ character }) => (
    <CyberText sx={TXT}>{character.bio || "No data available."}</CyberText>
);

const PoolSlotEmpty = () => (
    <Box
        sx={{
            width: 16,
            height: 7,
            bgcolor: "rgba(42, 42, 61, 0.35)",
            border: "1px solid #2a2a3d",
            mx: 0.2,
            borderRadius: "1px",
        }}
    />
);

const PoolSlotFilled = ({ danger }) => (
    <Box
        sx={{
            width: 16,
            height: 7,
            bgcolor: danger ? "#ff0055" : UI_COLORS.accent,
            border: `1px solid ${danger ? "#ff0055" : UI_COLORS.accent}`,
            boxShadow: `0 0 6px ${danger ? "rgba(255,0,85,0.55)" : (UI_COLORS.accentGlow || "rgba(0,242,234,0.45)")}`,
            mx: 0.2,
            borderRadius: "1px",
        }}
    />
);

const SessionPoolCell = ({ track, pools, setTrack }) => {
    const max = Math.max(track.maxDefault ?? (track.key === "strain" ? 5 : 3), 1);
    const pool = pools[track.key] || { current: 0 };
    const current = Math.min(Math.max(pool.current ?? 0, 0), max);
    const stateKey = track.stateKey;
    const flagged = stateKey ? !!pool[stateKey] : false;
    const atCap = current >= max;
    return (
        <Paper
            elevation={0}
            sx={{
                p: 1.5,
                height: "100%",
                bgcolor: "rgba(255,255,255,0.02)",
                border: "1px solid #2a2a3d",
                borderRadius: 1,
            }}
        >
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.75 }}>
                <CyberTitle sx={{ fontSize: "0.75rem", color: UI_COLORS.accent }}>
                    {track.label?.toUpperCase()}
                </CyberTitle>
                <CyberText sx={{ fontFamily: "monospace", fontSize: "0.75rem", ...TXT }}>
                    {current} / {max}
                </CyberText>
            </Box>
            <Rating
                max={max}
                value={current}
                onChange={(_, v) => setTrack(track.key, { current: v ?? 0 })}
                icon={<PoolSlotFilled danger={atCap} />}
                emptyIcon={<PoolSlotEmpty />}
                sx={{ "& .MuiRating-iconFilled": { opacity: 1 } }}
            />
            {track.stateKey && track.stateLabel && (
                <Box sx={{ mt: 1 }}>
                    <CyberCheckbox
                        name={`session-${track.key}-${track.stateKey}`}
                        label={track.stateLabel.toUpperCase()}
                        checked={flagged}
                        onChange={(e) => setTrack(track.key, { [track.stateKey]: e.target.checked })}
                    />
                </Box>
            )}
        </Paper>
    );
};

/** Effort + strain on one row (left column) */
const SessionResourcePoolsRow = ({ resourceTracks, pools, setTrack }) => (
    <Box sx={{ mb: 2 }}>
        <Grid container spacing={1.5}>
            {resourceTracks.map((track) => (
                <Grid size={{ xs: 12, sm: 6 }} key={track.key}>
                    <SessionPoolCell track={track} pools={pools} setTrack={setTrack} />
                </Grid>
            ))}
        </Grid>
    </Box>
);

/** Description, ideals, notes — under header, collapsible */
const BondExpandableDetails = ({ bond, open, onToggle }) => {
    const b = bond && typeof bond === "object" ? bond : emptyBond();
    const hasExpandable = !!(b.description || b.ideals?.length || b.notes);
    return (
        <Box sx={{ mt: 1.5, mb: 2 }}>
            <Box
                role="button"
                aria-expanded={open}
                tabIndex={0}
                onClick={onToggle}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onToggle();
                    }
                }}
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    cursor: "pointer",
                    userSelect: "none",
                    py: 0.5,
                    "&:hover": { opacity: 0.92 },
                }}
            >
                <ExpandMoreIcon
                    sx={{
                        color: UI_COLORS.accent,
                        transform: open ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s ease",
                    }}
                />
                <CyberText sx={{ color: UI_COLORS.accent, letterSpacing: 2, fontSize: "0.8rem" }}>
                    {hasExpandable ? "BOND — DESCRIPTION & IDEALS" : "BOND — NO EXTRA DETAILS"}
                </CyberText>
            </Box>
            <Collapse in={open}>
                <Paper
                    elevation={0}
                    sx={{
                        mt: 1,
                        p: 2,
                        bgcolor: "rgba(255,255,255,0.03)",
                        border: "1px solid #2a2a3d",
                        borderLeft: `3px solid ${UI_COLORS.accent}`,
                        borderRadius: 1,
                    }}
                >
                    {hasExpandable ? (
                        <Stack spacing={2}>
                            {b.description ? (
                                <Box>
                                    <CyberText sx={{ ...TXT_MUTED, fontSize: "0.65rem", letterSpacing: 1, display: "block", mb: 0.5 }}>
                                        DESCRIPTION
                                    </CyberText>
                                    <CyberText sx={{ ...TXT, lineHeight: 1.55 }}>{b.description}</CyberText>
                                </Box>
                            ) : null}
                            {b.ideals?.length > 0 ? (
                                <Box>
                                    <CyberText sx={{ ...TXT_MUTED, fontSize: "0.65rem", letterSpacing: 1, display: "block", mb: 0.5 }}>
                                        IDEALS
                                    </CyberText>
                                    <Stack component="ul" sx={{ m: 0, pl: 2 }} spacing={0.5}>
                                        {b.ideals.map((line, i) => (
                                            <CyberText key={i} component="li" sx={{ ...TXT, lineHeight: 1.45 }}>
                                                {line}
                                            </CyberText>
                                        ))}
                                    </Stack>
                                </Box>
                            ) : null}
                            {b.notes ? (
                                <Box>
                                    <CyberText sx={{ ...TXT_MUTED, fontSize: "0.65rem", letterSpacing: 1, display: "block", mb: 0.5 }}>
                                        NOTES
                                    </CyberText>
                                    <CyberText sx={{ ...TXT, lineHeight: 1.55 }}>{b.notes}</CyberText>
                                </Box>
                            ) : null}
                        </Stack>
                    ) : (
                        <CyberText sx={{ ...TXT_MUTED, fontSize: "0.85rem" }}>
                            No description, ideals, or notes on this character.
                        </CyberText>
                    )}
                </Paper>
            </Collapse>
        </Box>
    );
};

/** Right column: special ability, second wind, bond powers */
const BondRightColumn = ({ bond, bondPowers }) => {
    const b = bond && typeof bond === "object" ? bond : emptyBond();
    const list = Array.isArray(bondPowers) ? bondPowers : [];
    return (
        <Stack spacing={2.5} sx={{ height: "100%" }}>
            <Box>
                <CyberText sx={{ ...TXT_MUTED, fontSize: "0.65rem", letterSpacing: 1, mb: 0.75, display: "block" }}>
                    SPECIAL ABILITY
                </CyberText>
                {b.specialAbility ? (
                    <CyberText sx={{ ...TXT, lineHeight: 1.55 }}>{b.specialAbility}</CyberText>
                ) : (
                    <CyberText sx={{ ...TXT_MUTED, fontStyle: "italic" }}>—</CyberText>
                )}
            </Box>
            <Box>
                <CyberText sx={{ ...TXT_MUTED, fontSize: "0.65rem", letterSpacing: 1, mb: 0.75, display: "block" }}>
                    SECOND WIND
                </CyberText>
                {b.secondWind ? (
                    <CyberText sx={{ ...TXT, lineHeight: 1.55 }}>{b.secondWind}</CyberText>
                ) : (
                    <CyberText sx={{ ...TXT_MUTED, fontStyle: "italic" }}>—</CyberText>
                )}
            </Box>
            <Divider sx={{ borderColor: "#2a2a3d" }} />
            <Box>
                <CyberText sx={{ color: UI_COLORS.accent, letterSpacing: 2, fontSize: "0.75rem", mb: 1.5, display: "block" }}>
                    {"// BOND POWERS"}
                </CyberText>
                {list.length === 0 ? (
                    <CyberText sx={{ ...TXT_MUTED, fontSize: "0.85rem" }}>No bond powers.</CyberText>
                ) : (
                    <Stack spacing={1.5}>
                        {list.map((p, idx) => (
                            <Paper
                                key={p.id || p.key || idx}
                                elevation={0}
                                sx={{
                                    p: 1.5,
                                    bgcolor: "rgba(255,255,255,0.02)",
                                    border: "1px solid #2a2a3d",
                                    borderRadius: 1,
                                }}
                            >
                                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, mb: 0.75, flexWrap: "wrap" }}>
                                    <CyberTitle sx={{ fontSize: "0.8rem", color: "#ff66ff" }}>
                                        {(p.name || p.label || `POWER_${idx + 1}`).toUpperCase()}
                                    </CyberTitle>
                                    {p.frequency ? (
                                        <CyberText sx={{ fontSize: "0.7rem", color: UI_COLORS.accent }}>{p.frequency}</CyberText>
                                    ) : null}
                                </Box>
                                {p.description || p.content ? (
                                    <CyberText sx={{ ...TXT, lineHeight: 1.5, fontSize: "0.82rem" }}>
                                        {p.description || p.content}
                                    </CyberText>
                                ) : null}
                                {p.tier ? (
                                    <CyberText sx={{ mt: 0.75, fontSize: "0.7rem", ...TXT_MUTED }}>Tier: {p.tier}</CyberText>
                                ) : null}
                            </Paper>
                        ))}
                    </Stack>
                )}
            </Box>
        </Stack>
    );
};

const CharStatsTab = ({ character, characterId, statDefinitions, resourceTracks, systemName }) => {
    const { pools, setTrack } = useCharacterSessionPools(characterId, resourceTracks);

    return (
        <Grid container spacing={3} alignItems="flex-start">
            <Grid size={{ xs: 12, md: 6 }}>
                <SessionResourcePoolsRow resourceTracks={resourceTracks} pools={pools} setTrack={setTrack} />
                <CyberText
                    sx={{
                        color: UI_COLORS.accent,
                        letterSpacing: 2,
                        mt: 5,
                        mb: 1.25,
                        display: "block",
                        opacity: 0.85,
                        fontSize: "0.75rem",
                    }}
                >
                    {"// ACTIONS / STATS"}
                </CyberText>
                <Grid container spacing={1.5}>
                    {statDefinitions.map((stat) => (
                        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={stat.key}>
                            <Box
                                sx={{
                                    p: 1.5,
                                    bgcolor: "rgba(255,255,255,0.02)",
                                    border: "1px solid #2a2a3d",
                                    borderRadius: 1,
                                }}
                            >
                                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.75, alignItems: "baseline" }}>
                                    <CyberText sx={{ color: UI_COLORS.accent, fontWeight: "bold", fontSize: "0.72rem" }}>
                                        {stat.label.toUpperCase()}
                                    </CyberText>
                                    <CyberTitle sx={{ fontSize: "1.1rem", color: "#fff" }}>
                                        {character.stats?.[stat.key] ?? 0}
                                    </CyberTitle>
                                </Box>
                                <Box sx={{ height: 3, bgcolor: "#1a1a2a", width: "100%" }}>
                                    <Box
                                        sx={{
                                            height: "100%",
                                            width: `${Math.min((character.stats?.[stat.key] ?? 0), 5) * 20}%`,
                                            bgcolor: UI_COLORS.accent,
                                            boxShadow: `0 0 8px ${UI_COLORS.accent}`,
                                        }}
                                    />
                                </Box>
                                {stat.description ? (
                                    <CyberText sx={{ fontSize: "0.65rem", mt: 0.75, ...TXT_MUTED, lineHeight: 1.4 }}>
                                        {stat.description}
                                    </CyberText>
                                ) : null}
                            </Box>
                        </Grid>
                    ))}
                </Grid>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
                <Paper
                    elevation={0}
                    sx={{
                        p: 2,
                        bgcolor: "rgba(255,255,255,0.02)",
                        border: "1px solid #2a2a3d",
                        borderRadius: 1,
                        position: { md: "sticky" },
                        top: { md: 8 },
                    }}
                >
                    <BondRightColumn bond={character.bond} bondPowers={character.bondPowers} />
                </Paper>
            </Grid>
        </Grid>
    );
};

const CharAvatar = ({ path, isSelected, onClick, name, size = 40 }) => {
    const [imgUrl, setImgUrl] = useState(null);

    useEffect(() => {
        if (path) loadFirebaseAsset(path).then(setImgUrl);
    }, [path]);

    return (
        <Tooltip title={name?.toUpperCase()} arrow placement="bottom">
            <Box
                onClick={onClick}
                component="img"
                src={imgUrl || "/default-avatar.png"}
                sx={{
                    width: size,
                    height: size,
                    borderRadius: '50%',
                    cursor: 'pointer',
                    objectFit: 'cover',
                    flexShrink: 0,
                    backgroundColor: '#0d0d14',
                    border: isSelected
                        ? `2px solid ${UI_COLORS.accent}`
                        : '2px solid rgba(255,255,255,0.18)',
                    boxShadow: isSelected
                        ? `0 0 12px ${UI_COLORS.accent}88, 0 0 0 3px ${UI_COLORS.accent}22`
                        : 'none',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                        borderColor: UI_COLORS.accent,
                        boxShadow: `0 0 10px ${UI_COLORS.accent}55`,
                        transform: 'scale(1.08)',
                    },
                }}
            />
        </Tooltip>
    );
};

const AVATAR_LIMIT = 5;

/**
 * Character selector that lives inside the dialog header.
 * Shows up to AVATAR_LIMIT avatars; a "+N" pill expands the rest.
 * The selected character's name appears after a divider.
 */
const CharacterHeaderSelector = ({ characters, selectedId, onSelect }) => {
    const [expanded, setExpanded] = useState(false);

    if (!characters || characters.length === 0) return null;

    const visible = characters.slice(0, AVATAR_LIMIT);
    const overflow = characters.slice(AVATAR_LIMIT);
    const hasMore = overflow.length > 0;
    const selectedChar = characters.find(c => c.id === selectedId);

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, overflow: 'hidden' }}>
            {/* Always-visible avatars */}
            {visible.map(char => (
                <CharAvatar
                    key={char.id}
                    path={char.imageUrl}
                    isSelected={char.id === selectedId}
                    size={char.id === selectedId ? 38 : 30}
                    name={char.name}
                    onClick={() => onSelect(char.id)}
                />
            ))}

            {/* Overflow avatars — slide in horizontally */}
            <Collapse in={expanded} orientation="horizontal" unmountOnExit>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 1 }}>
                    {overflow.map(char => (
                        <CharAvatar
                            key={char.id}
                            path={char.imageUrl}
                            isSelected={char.id === selectedId}
                            size={char.id === selectedId ? 38 : 30}
                            name={char.name}
                            onClick={() => onSelect(char.id)}
                        />
                    ))}
                </Box>
            </Collapse>

            {/* +N / − expand toggle */}
            {hasMore && (
                <Tooltip title={expanded ? "Hide" : `Show ${overflow.length} more`} placement="bottom">
                    <Box
                        onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
                        sx={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            border: `1px solid ${UI_COLORS.accent}55`,
                            bgcolor: expanded ? `${UI_COLORS.accent}22` : 'transparent',
                            transition: 'all 0.2s',
                            '&:hover': { bgcolor: `${UI_COLORS.accent}22`, borderColor: UI_COLORS.accent },
                        }}
                    >
                        <CyberText sx={{ fontSize: '0.55rem', color: UI_COLORS.accent, lineHeight: 1 }}>
                            {expanded ? '−' : `+${overflow.length}`}
                        </CyberText>
                    </Box>
                </Tooltip>
            )}

            {/* Divider + active character name */}
            {selectedChar && (
                <>
                    <Box sx={{ width: '1px', height: 22, bgcolor: '#2a2a3d', flexShrink: 0, mx: 0.5 }} />
                    <CyberTitle
                        sx={{
                            fontSize: '0.8rem',
                            color: UI_COLORS.accent,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            minWidth: 0,
                            maxWidth: 200,
                        }}
                    >
                        {selectedChar.name?.toUpperCase()}
                    </CyberTitle>
                </>
            )}
        </Box>
    );
};

export default function CharactersSettingsDialog({ open, onClose, popupMode = false }) {
    const dispatch = useDispatch();
    
    const { profile } = useSelector((state) => state.player);
    const { list: characters, status: charactersStatus } = useSelector((state) => state.characters);
    const loading = charactersStatus === "loading"; 

    const [selectedCharId, setSelectedCharId] = useState(null);
    const [selectedCharacter, setSelectedCharacter] = useState(null);
    const [activeSubTab, setActiveSubTab] = useState("STATS");
    const [bondDetailsOpen, setBondDetailsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [fontStep, setFontStep] = useState(0);

    const { isPopped, popout } = usePopout("characters");

    const handleToggleMinimize = (e) => {
        e.stopPropagation();
        setIsMinimized((v) => !v);
    };

    const handleFontIncrease = (e) => {
        e.stopPropagation();
        setFontStep((s) => Math.min(s + 1, MAX_FONT_STEP));
    };

    const handleFontDecrease = (e) => {
        e.stopPropagation();
        setFontStep((s) => Math.max(s - 1, 0));
    };

    const handlePopout = (e) => {
        e.stopPropagation();
        popout(); // no payload needed — dialog fetches its own data
        onClose();
    };

    // Al abrir: personajes con ownerPlayerId == jugador; characterIds solo como respaldo legacy
    useEffect(() => {
        if (open && profile?.uid) {
            dispatch(
                fetchPlayerCharacters({
                    uid: profile.uid,
                    characterIds: profile.characterIds || [],
                })
            );
        }
    }, [open, profile?.uid, profile?.characterIds, dispatch]);

    // Autoseleccionar: priorizar activeCharacterId del perfil, si no el primero de la lista
    useEffect(() => {
        if (characters.length > 0 && !selectedCharId) {
            const initial = profile?.activeCharacterId
                ? characters.find(c => c.id === profile.activeCharacterId)
                : null;
            const first = initial || characters[0];
            setSelectedCharId(first.id);
            setSelectedCharacter(first);
        }
    }, [characters, selectedCharId]);

    const handleSelectCharacter = (charId) => {
        setSelectedCharId(charId);
        // Optimistic update + Firebase persistence
        dispatch(setActiveCharacterId(charId));
        if (profile?.uid) {
            dispatch(persistActiveCharacter({ uid: profile.uid, characterId: charId }));
        }
    };

    // 6. Actualizar el personaje seleccionado al cambiar el ID
    useEffect(() => {
        const char = characters.find(c => c.id === selectedCharId);
        setSelectedCharacter(char);
    }, [selectedCharId, characters]);

    useEffect(() => {
        setBondDetailsOpen(false);
    }, [selectedCharId]);

    const campaignForRules = selectedCharacter?.campaignId || profile?.currentCampaignId;
    const { stats: statDefinitions, systemName, resourceTracks } = useStatSystem(
        open ? campaignForRules : null
    );

    /* ── Shared character content (used in both normal + popup modes) ── */
    const characterContent = selectedCharacter ? (
        <Box
            sx={{
                p: 4,
                pt: 2,
                position: "relative",
                ...CYBER_SCROLL_STYLE,
            }}
        >
            <Box sx={{ mb: 4, ml: 1 }}>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 2, flexWrap: "wrap", width: "100%", pr: 2 }}>
                    <CyberTitle variant="h3" sx={{ textShadow: `0 0 10px ${UI_COLORS.accent}66`, fontSize: "2.5rem", flex: "0 1 auto", m: 0, lineHeight: 1.1, color: "#fff" }}>
                        {selectedCharacter.name?.toUpperCase()}
                    </CyberTitle>
                    <Box sx={{ flex: "1 1 48px", minWidth: 48, borderBottom: `1px dashed ${UI_COLORS.accent}55`, height: 0, alignSelf: "center", opacity: 0.85 }} />
                    <Stack sx={{ flex: "0 1 auto", minWidth: 0, alignItems: "flex-end", textAlign: "right" }}>
                        <CyberTitle variant="h3" sx={{ fontSize: "1.35rem", color: "#ff66ff", m: 0, lineHeight: 1.15, textShadow: "0 0 12px rgba(255,102,255,0.35)" }}>
                            {(selectedCharacter.bond?.name || "—").toUpperCase()}
                        </CyberTitle>
                        {selectedCharacter.bond?.archetype ? (
                            <CyberText sx={{ color: "#ff0055", fontSize: "0.75rem", mt: 0.5, letterSpacing: 1 }}>
                                {selectedCharacter.bond.archetype}
                            </CyberText>
                        ) : null}
                    </Stack>
                </Box>
                <BondExpandableDetails bond={selectedCharacter.bond} open={bondDetailsOpen} onToggle={() => setBondDetailsOpen((v) => !v)} />
            </Box>
            <Stack direction="row" spacing={4} sx={{ mb: 4, borderBottom: '1px solid #2a2a3d' }}>
                {["STATS", "BIO", "SKILLS", "SKILL MATRIX"].map(tab => (
                    <Box key={tab} onClick={() => setActiveSubTab(tab)}
                        sx={{ pb: 1, cursor: 'pointer', borderBottom: activeSubTab === tab ? `2px solid ${UI_COLORS.accent}` : '2px solid transparent', color: activeSubTab === tab ? UI_COLORS.accent : '#888', transition: '0.3s' }}>
                        <CyberTitle sx={{ fontSize: '0.9rem' }}>{tab}</CyberTitle>
                    </Box>
                ))}
            </Stack>
            <Box sx={{ minHeight: "400px" }}>
                {activeSubTab === "STATS" && <CharStatsTab character={selectedCharacter} characterId={selectedCharacter.id} statDefinitions={statDefinitions} resourceTracks={resourceTracks} systemName={systemName} />}
                {activeSubTab === "BIO"   && <CharBioTab character={selectedCharacter} />}
                {activeSubTab === "SKILLS"       && <CharSkillsTab character={selectedCharacter} />}
                {activeSubTab === "SKILL MATRIX" && <CharTreeTab character={selectedCharacter} />}
            </Box>
        </Box>
    ) : (
        <Box sx={{ p: 4 }}><CyberText sx={TXT}>No characters found.</CyberText></Box>
    );

    /* ── Right-side header controls ── */
    const headerControls = (
        <Box className="dialog-no-drag" sx={{ display: "flex", alignItems: "center", gap: 0.25, flexShrink: 0 }}>
            {!isMinimized && !popupMode && (
                <>
                    <Tooltip title="Decrease font size"><span>
                        <IconButton onClick={handleFontDecrease} size="small" disabled={fontStep === 0}
                            sx={{ color: UI_COLORS.accent, '&.Mui-disabled': { color: DISABLED_BTN_COLOR } }}>
                            <TextDecreaseIcon sx={{ fontSize: '1.1rem' }} />
                        </IconButton>
                    </span></Tooltip>
                    <Tooltip title="Increase font size"><span>
                        <IconButton onClick={handleFontIncrease} size="small" disabled={fontStep === MAX_FONT_STEP}
                            sx={{ color: UI_COLORS.accent, '&.Mui-disabled': { color: DISABLED_BTN_COLOR } }}>
                            <TextIncreaseIcon sx={{ fontSize: '1.1rem' }} />
                        </IconButton>
                    </span></Tooltip>
                    <Tooltip title={isPopped ? "Already open in popup" : "Detach to new window"}><span>
                        <IconButton onClick={handlePopout} size="small" disabled={isPopped}
                            sx={{ color: UI_COLORS.accent, '&.Mui-disabled': { color: DISABLED_BTN_COLOR } }}>
                            <OpenInNewIcon sx={{ fontSize: '1.1rem' }} />
                        </IconButton>
                    </span></Tooltip>
                </>
            )}
            {!popupMode && (
                <Tooltip title={isMinimized ? "Restaurar" : "Minimizar"}>
                    <IconButton onClick={handleToggleMinimize} size="small" sx={{ mx: 0.25 }}>
                        {isMinimized
                            ? <AspectRatioIcon sx={{ color: UI_COLORS.accent, fontSize: '1.2rem' }} />
                            : <RemoveIcon      sx={{ color: "#fff",           fontSize: '1.2rem' }} />}
                    </IconButton>
                </Tooltip>
            )}
            {(!isMinimized || popupMode) && (
                <IconButton onClick={popupMode ? () => window.close() : onClose} size="small">
                    <CloseIcon sx={{ color: "#ff66ff" }} />
                </IconButton>
            )}
        </Box>
    );

    /* ── POPUP MODE ── */
    if (popupMode) {
        return (
            <DialogFontSizeContext.Provider value={fontStep}>
                <Box sx={{ display: "flex", flexDirection: "column", width: "100vw", height: "100vh", bgcolor: "#0d0d14", color: "#fff" }}>
                    <Box sx={{ px: 2.5, py: 1, display: "flex", justifyContent: "space-between", alignItems: "center", bgcolor: "#1a1a2a", borderBottom: "1px solid #2a2a3d", flexShrink: 0, gap: 1 }}>
                        <CharacterHeaderSelector characters={characters} selectedId={selectedCharId} onSelect={handleSelectCharacter} />
                        {headerControls}
                    </Box>
                    <Box sx={{ flexGrow: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                        {loading
                            ? <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>
                            : (
                                <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", ...CYBER_SCROLL_STYLE }}>
                                    {characterContent}
                                </Box>
                            )
                        }
                    </Box>
                </Box>
            </DialogFontSizeContext.Provider>
        );
    }

    /* ── NORMAL / MINIMIZED MODE ── */
    return (
        <Dialog 
            open={open}
            onClose={!isMinimized ? onClose : undefined}
            fullWidth
            maxWidth={false}
            hideBackdrop={isMinimized}
            disableEnforceFocus={isMinimized}
            style={isMinimized ? { pointerEvents: 'none' } : {}}
            sx={{
                "& .MuiDialog-container": {
                    alignItems: { xs: "flex-end", sm: "center" },
                },
            }}
            PaperComponent={DraggableResizablePaper}
            PaperProps={{ 
                dragKey: isMinimized ? 'min' : 'max',
                sx: isMinimized ? {
                    pointerEvents: "auto",
                    bgcolor: "#0d0d14",
                    color: "#fff",
                    border: `1px solid ${UI_COLORS.accent}`,
                    transition: "border 0.3s, box-shadow 0.3s",
                    borderRadius: 2,
                    boxShadow: `0 0 20px ${UI_COLORS.accent}44`,
                    position: 'fixed',
                    bottom: { xs: 82, sm: 24 },
                    right: { xs: 8, sm: 215 },
                    m: 0,
                    width: { xs: "calc(100vw - 16px)", sm: "300px" },
                    maxHeight: "60px",
                    overflow: 'hidden',
                } : {
                    pointerEvents: "auto",
                    bgcolor: "#0d0d14",
                    color: "#fff",
                    border: `1px solid ${UI_COLORS.accent}44`,
                    transition: "border 0.3s, box-shadow 0.3s",
                    borderRadius: { xs: "12px 12px 0 0", sm: 3 },
                    boxShadow: "0 0 40px rgba(255,0,255,0.2)",
                    display: 'flex',
                    flexDirection: 'column',
                    m: 0,
                    height: { xs: "90vh", sm: "85vh" },
                    width: { xs: "100%", sm: "90%" },
                },
            }}
        >
            {/* ── Drag handle / Header ── */}
            <Box
                className="dialog-drag-handle"
                sx={{
                    px: 2.5,
                    py: isMinimized ? 1.5 : 1,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    backgroundColor: "#1a1a2a",
                    borderBottom: isMinimized ? "none" : `1px solid #2a2a3d`,
                    cursor: isMinimized ? 'pointer' : 'move',
                    userSelect: "none",
                    flexShrink: 0,
                    gap: 1,
                }}
                onClick={isMinimized ? handleToggleMinimize : undefined}
            >
                {isMinimized ? (
                    <CyberTitle sx={{ fontSize: "0.9rem", color: UI_COLORS.accent }}>
                        {`CHARACTERS${selectedCharacter ? ` — ${selectedCharacter.name?.toUpperCase()}` : ''} (MIN)`}
                    </CyberTitle>
                ) : (
                    <CharacterHeaderSelector
                        characters={characters}
                        selectedId={selectedCharId}
                        onSelect={handleSelectCharacter}
                    />
                )}
                {headerControls}
            </Box>

            <DialogFontSizeContext.Provider value={fontStep}>
                <DialogContent className="dialog-no-drag" sx={{ display: isMinimized ? 'none' : 'flex', flexDirection: 'column', p: 0, flexGrow: 1, overflow: 'hidden' }}>
                    {loading
                        ? <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>
                        : characterContent
                    }
                </DialogContent>
            </DialogFontSizeContext.Provider>
        </Dialog>
    );
}