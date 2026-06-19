import { useState, useEffect, useCallback, memo } from "react";
import { Box, Divider, Typography } from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import PersonIcon from "@mui/icons-material/Person";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useDispatch } from "react-redux";

import { CyberText, CyberTitle } from "../customs/CustomTexts";
import { loadFirebaseAsset, getCachedUrl } from "../../../firebase/services/assetLoader";
import { UI_COLORS } from "../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import { useStatSystem } from "../../hooks/useStatSystem";
import { useCampaignWikiEntities } from "../../hooks/useCampaignWikiEntities";
import { openWikiOverlay } from "../../store/uiSlice";
import CharacterNarrativeChips from "../wiki/CharacterNarrativeChips";
import {
    CharacterStatusBadge,
    CharacterTypeBadge,
} from "../characters/characterBadges";

const CUSTOM_SCROLLBAR = {
    ...CYBER_SCROLL_STYLE,
    scrollbarWidth: "thin",
};

const StatDots = ({ label, value }) => {
    const dots = [0, 1, 2, 3];
    const isMax = value >= 5;
    const isUnknown = value < 0;
    const activeColor = isUnknown ? UI_COLORS.anomaly : isMax ? "#ff0055" : UI_COLORS.accent;

    return (
        <Box sx={{ mb: 1.2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.3 }}>
                <CyberTitle sx={{ fontSize: "0.6rem", color: isUnknown ? activeColor : "#aaa", textTransform: "uppercase" }}>
                    {label}
                </CyberTitle>
                <CyberTitle sx={{ fontSize: "0.75rem", color: activeColor, fontFamily: "monospace" }}>
                    {isUnknown ? "???" : value}
                </CyberTitle>
            </Box>
            <Box sx={{ display: "flex", gap: 0.5 }}>
                {dots.map((dot) => (
                    <Box
                        key={dot}
                        sx={{
                            height: 5,
                            flex: 1,
                            bgcolor: !isUnknown && value > dot ? activeColor : "rgba(42, 42, 61, 0.2)",
                            border: `1px solid ${!isUnknown && value > dot ? activeColor : "#2a2a3d"}`,
                            borderRadius: "1px",
                        }}
                    />
                ))}
            </Box>
        </Box>
    );
};

const CharacterPortrait = memo(function CharacterPortrait({ char, sx = {} }) {
    const [url, setUrl] = useState(() => getCachedUrl(char.imageUrl) || null);
    const isLocked = char.isLocked;

    useEffect(() => {
        if (!url && char.imageUrl) {
            loadFirebaseAsset(char.imageUrl).then(setUrl);
        }
    }, [char.imageUrl, url]);

    return (
        <Box
            sx={{
                position: "relative",
                overflow: "hidden",
                bgcolor: "#1a1a2a",
                ...sx,
            }}
        >
            {url ? (
                <Box
                    component="img"
                    src={url}
                    alt={char.name}
                    draggable={false}
                    sx={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        objectPosition: "top center",
                        display: "block",
                        filter: isLocked ? "grayscale(1) opacity(0.4)" : "none",
                    }}
                />
            ) : (
                <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <PersonIcon sx={{ fontSize: 40, color: "#3a3a4d" }} />
                </Box>
            )}
        </Box>
    );
});

function RosterSlot({ char, isSelected, onSelect }) {
    const [showHint, setShowHint] = useState(false);
    const isLocked = char.isLocked;

    const handleClick = () => {
        if (isLocked) {
            setShowHint((v) => !v);
            return;
        }
        onSelect(char);
    };

    const shortName = isLocked ? "???" : (char.name?.split(" ")[0] || char.name);

    return (
        <Box
            onClick={handleClick}
            title={isLocked ? char.unlockGoal : char.name}
            sx={{
                aspectRatio: "3 / 4",
                border: isSelected ? `2px solid ${UI_COLORS.accent}` : `1px solid ${UI_COLORS.border}`,
                bgcolor: UI_COLORS.backgroundSecondary,
                position: "relative",
                overflow: "hidden",
                cursor: isLocked ? "help" : "pointer",
                boxShadow: isSelected ? `0 0 12px ${UI_COLORS.accentGlow}66` : "none",
                transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
                "&:hover": !isLocked ? { transform: "translateY(-2px)", borderColor: UI_COLORS.accent } : {},
            }}
        >
            <CharacterPortrait char={char} sx={{ width: "100%", height: "100%" }} />

            {isLocked && (
                <Box sx={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 2,
                    backdropFilter: showHint ? "blur(16px)" : "blur(8px)",
                    bgcolor: showHint ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0.45)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    px: 0.5,
                    textAlign: "center",
                }}>
                    <LockIcon sx={{ color: UI_COLORS.accent, fontSize: "1.25rem" }} />
                    {showHint && (
                        <CyberText sx={{ color: UI_COLORS.accent, fontSize: "7px", mt: 0.5, lineHeight: 1.3 }}>
                            {char.unlockGoal || "Identidad encriptada"}
                        </CyberText>
                    )}
                </Box>
            )}

            <Box sx={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                py: 0.4,
                px: 0.5,
                bgcolor: "rgba(0,0,0,0.85)",
                textAlign: "center",
            }}>
                <CyberTitle sx={{
                    fontSize: "7px",
                    letterSpacing: "0.06em",
                    color: isLocked ? "#666" : UI_COLORS.accent,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                }}>
                    {shortName}
                </CyberTitle>
            </Box>
        </Box>
    );
}

function RosterTacticalPanel({ char, statDefinitions, wikiEntities, onWiki }) {
    const isLocked = char?.isLocked;

    if (!char) {
        return (
            <Box sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                bgcolor: "#0f0f1a",
                p: 2,
            }}>
                <CyberText sx={{ fontSize: "0.8rem", color: UI_COLORS.textSecondary, textAlign: "center" }}>
                    Selecciona un personaje del roster
                </CyberText>
            </Box>
        );
    }

    return (
        <Box sx={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            bgcolor: "#0f0f1a",
            overflow: "hidden",
        }}>
            <Box sx={{ px: 1.75, py: 1.5, borderBottom: `1px solid ${UI_COLORS.border}`, flexShrink: 0 }}>
                <CyberText sx={{ fontFamily: "'Fira Code', monospace", fontSize: "9px", color: UI_COLORS.anomaly, mb: 1 }}>
                    // FICHA TÁCTICA
                </CyberText>
                {!isLocked && (
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                        <CharacterTypeBadge type={char.type} />
                        <CharacterStatusBadge status={char.status || "alive"} />
                    </Box>
                )}
            </Box>

            <Box className="inner-scroll" sx={{ flex: 1, overflow: "auto", px: 1.75, py: 1.5, ...CUSTOM_SCROLLBAR }}>
                {isLocked ? (
                    <CyberText sx={{ fontFamily: "'Fira Code', monospace", fontSize: "10px", color: UI_COLORS.accent, lineHeight: 1.5 }}>
                        {char.unlockGoal || "Identidad encriptada"}
                    </CyberText>
                ) : (
                    <>
                        <Box sx={{ mb: 1.5 }}>
                            <CharacterNarrativeChips character={char} wikiEntities={wikiEntities} />
                        </Box>

                        {char.stats && Object.keys(char.stats).length > 0 && (
                            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 1.5, rowGap: 0.5, mb: 1.5 }}>
                                {Object.entries(char.stats).map(([key, val]) => {
                                    const statInfo = statDefinitions.find((s) => s.key === key);
                                    return <StatDots key={key} label={statInfo?.label || key} value={val} />;
                                })}
                            </Box>
                        )}

                        {char.bio && (
                            <>
                                <Divider sx={{ bgcolor: "rgba(255,102,255,0.1)", mb: 1.25 }} />
                                <CyberText sx={{ fontFamily: "'Fira Code', monospace", fontSize: "9px", color: UI_COLORS.anomaly, mb: 0.75 }}>
                                    // BIO
                                </CyberText>
                                <CyberText sx={{ fontSize: "0.78rem", lineHeight: 1.55, color: "#ccc" }}>
                                    {char.bio}
                                </CyberText>
                            </>
                        )}
                    </>
                )}
            </Box>

            {!isLocked && (
                <Box
                    component="button"
                    onClick={onWiki}
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 0.75,
                        mx: 1.75,
                        mb: 1.75,
                        p: 1.1,
                        borderRadius: 0.5,
                        border: `1px solid ${UI_COLORS.accent}`,
                        bgcolor: `${UI_COLORS.accent}10`,
                        color: UI_COLORS.accent,
                        fontFamily: "'Fira Code', monospace",
                        fontSize: "10px",
                        cursor: "pointer",
                        flexShrink: 0,
                        transition: "background-color 0.2s",
                        "&:hover": { bgcolor: `${UI_COLORS.accent}20` },
                    }}
                >
                    <OpenInNewIcon sx={{ fontSize: "0.9rem" }} />
                    VER EN WIKI
                </Box>
            )}
        </Box>
    );
}

export default function LocationCharactersTab({ characters = [], campaignId = null }) {
    const { stats: statDefinitions } = useStatSystem(campaignId);
    const campaignWikiEntities = useCampaignWikiEntities(campaignId);
    const [selected, setSelected] = useState(null);
    const dispatch = useDispatch();

    const unlockedCount = characters.filter((c) => !c.isLocked).length;

    useEffect(() => {
        setSelected((prev) => {
            if (prev && characters.some((c) => c.id === prev.id)) return prev;
            return characters.find((c) => !c.isLocked) || characters[0] || null;
        });
    }, [characters]);

    const handleOpenCharacterWiki = useCallback((char) => {
        dispatch(openWikiOverlay({
            mode: "list",
            vttContext: {
                linkedVttCharacterId: char.id,
                prefillType: "personaje",
            },
        }));
    }, [dispatch]);

    const navigateRoster = useCallback((dir) => {
        const unlocked = characters.filter((c) => !c.isLocked);
        if (!unlocked.length) return;
        const idx = unlocked.findIndex((c) => c.id === selected?.id);
        const next = unlocked[(idx + dir + unlocked.length) % unlocked.length];
        setSelected(next);
    }, [characters, selected?.id]);

    useEffect(() => {
        const onKey = (e) => {
            if (e.target.closest("input, textarea, [contenteditable='true']")) return;
            if (e.key === "ArrowRight") navigateRoster(1);
            if (e.key === "ArrowLeft") navigateRoster(-1);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [navigateRoster]);

    if (!characters.length) {
        return (
            <Box sx={{ p: 4, textAlign: "center" }}>
                <Typography sx={{ color: UI_COLORS.textSecondary, fontFamily: "'Fira Code', monospace", fontSize: "0.8rem" }}>
                    No hay personajes registrados en esta locación.
                </Typography>
            </Box>
        );
    }

    const gridCols = Math.min(8, Math.max(4, characters.length));

    return (
        <Box sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 300px" },
            gridTemplateRows: { xs: "1fr auto auto", md: "1fr auto" },
            height: "100%",
            minHeight: 0,
            overflow: "hidden",
        }}>
            {/* Stage — hero portrait */}
            <Box sx={{
                position: "relative",
                overflow: "hidden",
                minHeight: { xs: 220, md: 0 },
                background: `
                    radial-gradient(ellipse 70% 80% at 30% 50%, rgba(255, 102, 255, 0.08), transparent),
                    linear-gradient(135deg, #0a0a14 0%, #12121a 100%)
                `,
                borderRight: { md: `1px solid ${UI_COLORS.border}` },
                borderBottom: { xs: `1px solid ${UI_COLORS.border}`, md: "none" },
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                "&::before": {
                    content: '""',
                    position: "absolute",
                    inset: 0,
                    background: `repeating-linear-gradient(
                        0deg,
                        transparent,
                        transparent 2px,
                        rgba(255, 102, 255, 0.02) 2px,
                        rgba(255, 102, 255, 0.02) 4px
                    )`,
                    pointerEvents: "none",
                },
            }}>
                <CyberTitle sx={{
                    position: "absolute",
                    top: 14,
                    left: 14,
                    fontSize: "10px",
                    letterSpacing: "0.2em",
                    color: UI_COLORS.anomaly,
                    opacity: 0.7,
                }}>
                    SELECT · FIGHTER
                </CyberTitle>

                {selected && (
                    <Box sx={{
                        position: "relative",
                        width: "min(55%, 320px)",
                        height: "92%",
                        mb: 1,
                    }}>
                        <CharacterPortrait
                            char={selected}
                            sx={{
                                width: "100%",
                                height: "100%",
                                border: `2px solid ${UI_COLORS.accent}`,
                                boxShadow: `0 0 40px ${UI_COLORS.accentGlow}44, inset 0 -60px 80px rgba(0,0,0,0.6)`,
                            }}
                        />
                        <Box sx={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            px: 2,
                            py: 1.5,
                            background: "linear-gradient(transparent, rgba(8, 8, 16, 0.95))",
                        }}>
                            <CyberTitle sx={{
                                fontSize: "clamp(1rem, 2vw, 1.5rem)",
                                letterSpacing: "0.14em",
                                color: UI_COLORS.accent,
                                lineHeight: 1.1,
                            }}>
                                {selected.isLocked ? "????????" : selected.name?.toUpperCase()}
                            </CyberTitle>
                            <CyberText sx={{ fontSize: "11px", color: UI_COLORS.textSecondary, mt: 0.5 }}>
                                {selected.isLocked ? "—" : (selected.callname || "—")}
                            </CyberText>
                        </Box>
                    </Box>
                )}
            </Box>

            {/* Tactical panel */}
            <Box sx={{
                gridRow: { xs: 2, md: "1 / 3" },
                minHeight: { xs: 200, md: 0 },
                overflow: "hidden",
                borderBottom: { xs: `1px solid ${UI_COLORS.border}`, md: "none" },
            }}>
                <RosterTacticalPanel
                    char={selected}
                    statDefinitions={statDefinitions}
                    wikiEntities={campaignWikiEntities}
                    onWiki={() => selected && handleOpenCharacterWiki(selected)}
                />
            </Box>

            {/* Roster grid */}
            <Box sx={{
                gridColumn: { md: 1 },
                borderTop: `1px solid ${UI_COLORS.border}`,
                bgcolor: "#0a0a12",
                px: 1.5,
                py: 1.25,
                flexShrink: 0,
            }}>
                <Box sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 1,
                }}>
                    <CyberText sx={{ fontFamily: "'Fira Code', monospace", fontSize: "8px", color: UI_COLORS.textSecondary, letterSpacing: "0.12em" }}>
                        ROSTER · {unlockedCount}/{characters.length} DESBLOQUEADOS
                    </CyberText>
                    <CyberText sx={{ fontFamily: "'Fira Code', monospace", fontSize: "8px", color: UI_COLORS.anomaly, letterSpacing: "0.1em" }}>
                        ← → NAVEGAR
                    </CyberText>
                </Box>

                <Box sx={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                    gap: 0.75,
                    maxHeight: characters.length > gridCols ? 160 : "none",
                    overflowY: characters.length > gridCols ? "auto" : "visible",
                    ...CUSTOM_SCROLLBAR,
                }}>
                    {characters.map((char) => (
                        <RosterSlot
                            key={char.id}
                            char={char}
                            isSelected={selected?.id === char.id}
                            onSelect={setSelected}
                        />
                    ))}
                </Box>
            </Box>
        </Box>
    );
}
