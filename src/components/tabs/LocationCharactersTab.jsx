import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { Box, Dialog, DialogActions, DialogContent, Divider, IconButton, Typography } from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import PersonIcon from "@mui/icons-material/Person";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import AddLinkIcon from "@mui/icons-material/AddLink";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import CloseIcon from "@mui/icons-material/Close";
import { useDispatch, useSelector } from "react-redux";

import { CyberText, CyberTitle } from "../customs/CustomTexts";
import CyberTooltip from "../customs/CyberTooltip";
import { CyberAutocomplete } from "../customs/CyberAutocomplete";
import { CyberTextField } from "../customs/CyberTextField";
import { linkWikiPersonajeToVtt } from "../../../firebase/services/wikiVttLinkService";
import { UI_COLORS } from "../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import { RENDER_LAYERS } from "../../constants/renderLayers";
import { WIKI_ENTITY_TYPES } from "../../constants/wikiEntityTypes";
import { useStatSystem } from "../../hooks/useStatSystem";
import { useCampaignWikiEntities } from "../../hooks/useCampaignWikiEntities";
import { useAssetUrl } from "../../hooks/useAssetUrl";
import { openWikiOverlay, showSnackbar } from "../../store/uiSlice";
import { fetchWikiEntities } from "../../store/wikiSlice";
import CharacterNarrativeChips from "../wiki/CharacterNarrativeChips";
import { VttToWikiLinkBadge, VttToWikiLinkDot } from "../wiki/VttWikiLinkBadge";
import { buildWikiVttLinkIndex } from "../../utils/wikiVttLinkLookup";
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

const CharacterPortrait = memo(function CharacterPortrait({ char, sx = {}, blurAmount = null }) {
    const url = useAssetUrl(char.tokenImageUrl || char.imageUrl || null);
    const isLocked = char.isLocked;
    const blur = blurAmount ?? (isLocked ? "12px" : "0");

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
                    decoding="sync"
                    loading="eager"
                    sx={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        objectPosition: "top center",
                        display: "block",
                        filter: isLocked || blur !== "0"
                            ? `blur(${blur}) grayscale(${isLocked ? 0.7 : 0}) brightness(${isLocked ? 0.55 : 1})`
                            : "none",
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

function RosterThumbnail({ char, isSelected, onSelect, wikiEntity }) {
    const isLocked = char.isLocked;
    const tooltipTitle = isLocked
        ? (char.unlockGoal || "Identidad encriptada")
        : wikiEntity
            ? `${char.name || "Sin nombre"} · Ficha: ${wikiEntity.title}`
            : (char.name || "Sin nombre");

    return (
        <CyberTooltip title={tooltipTitle} placement="bottom">
            <Box
                onClick={() => onSelect(char)}
                sx={{
                    flexShrink: 0,
                    width: 52,
                    height: 68,
                    border: isSelected ? `2px solid ${UI_COLORS.accent}` : `1px solid ${UI_COLORS.border}`,
                    bgcolor: UI_COLORS.backgroundSecondary,
                    position: "relative",
                    overflow: "hidden",
                    cursor: "pointer",
                    boxShadow: isSelected ? `0 0 10px ${UI_COLORS.accentGlow}66` : "none",
                    transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
                    "&:hover": { transform: "translateY(-2px)", borderColor: UI_COLORS.accent },
                }}
            >
                <CharacterPortrait char={char} blurAmount={isLocked ? "6px" : "0"} sx={{ width: "100%", height: "100%" }} />

                {isLocked && (
                    <Box sx={{
                        position: "absolute",
                        top: 3,
                        right: 3,
                        zIndex: 2,
                        bgcolor: "rgba(0,0,0,0.75)",
                        border: `1px solid ${UI_COLORS.accent}66`,
                        borderRadius: "2px",
                        p: 0.25,
                        display: "flex",
                        lineHeight: 0,
                    }}>
                        <LockIcon sx={{ color: UI_COLORS.accent, fontSize: "0.7rem" }} />
                    </Box>
                )}
                {wikiEntity && <VttToWikiLinkDot title={wikiEntity.title} />}
            </Box>
        </CyberTooltip>
    );
}

function CharacterWikiLinkDialog({ open, onClose, narrativePersonajes, wikiLinkSaving, onConfirm }) {
    const [picked, setPicked] = useState(null);

    useEffect(() => {
        if (open) setPicked(null);
    }, [open]);

    const handleConfirm = () => {
        if (!picked?.id) return;
        onConfirm(picked.id);
        onClose();
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            slotProps={{
                root: { sx: { zIndex: RENDER_LAYERS.DIALOG + 20 } },
                paper: {
                    sx: {
                        bgcolor: UI_COLORS.backgroundSecondary,
                        border: `1px solid ${UI_COLORS.border}`,
                        backgroundImage: "none",
                        borderRadius: 1,
                        overflow: "visible",
                    },
                },
            }}
        >
            <Box sx={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                px: 2,
                pt: 1.75,
                pb: 0.5,
            }}>
                <Box>
                    <CyberTitle sx={{ fontSize: "0.85rem", color: UI_COLORS.accent, letterSpacing: "0.12em" }}>
                        ANEXAR A ENTIDAD ARCHIVO
                    </CyberTitle>
                    <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.textSecondary, mt: 0.5 }}>
                        Vincula este personaje VTT con una ficha del Narrative Archive.
                    </CyberText>
                </Box>
                <IconButton onClick={onClose} size="small" sx={{ color: UI_COLORS.textSecondary, mt: -0.5 }}>
                    <CloseIcon fontSize="small" />
                </IconButton>
            </Box>

            <DialogContent sx={{ pt: 1.5, pb: 1, overflow: "visible" }}>
                <CyberAutocomplete
                    fullWidth
                    disablePortal
                    disabled={wikiLinkSaving}
                    options={narrativePersonajes}
                    getOptionLabel={(option) => option.title || option.slug || ""}
                    value={picked}
                    onChange={(_e, val) => setPicked(val)}
                    renderInput={(params) => (
                        <CyberTextField
                            {...params}
                            label="BUSCAR ENTIDAD PERSONAJE"
                            placeholder="Escribe para buscar…"
                        />
                    )}
                    slotProps={{
                        popper: {
                            sx: { zIndex: RENDER_LAYERS.DIALOG + 30 },
                        },
                        paper: {
                            sx: {
                                backgroundColor: UI_COLORS.backgroundSecondary,
                                color: UI_COLORS.textPrimary,
                                border: `1px solid ${UI_COLORS.border}`,
                                borderRadius: 0,
                            },
                        },
                    }}
                />
            </DialogContent>

            <DialogActions sx={{ px: 2, pb: 2, pt: 0, gap: 1 }}>
                <Box
                    component="button"
                    type="button"
                    onClick={onClose}
                    disabled={wikiLinkSaving}
                    sx={{
                        px: 1.5,
                        py: 0.75,
                        border: `1px solid ${UI_COLORS.border}`,
                        bgcolor: "transparent",
                        color: UI_COLORS.textSecondary,
                        fontFamily: "'Fira Code', monospace",
                        fontSize: "0.62rem",
                        letterSpacing: "0.08em",
                        cursor: "pointer",
                        borderRadius: 0.5,
                        "&:hover": { borderColor: UI_COLORS.textSecondary },
                    }}
                >
                    CANCELAR
                </Box>
                <Box
                    component="button"
                    type="button"
                    onClick={handleConfirm}
                    disabled={!picked?.id || wikiLinkSaving}
                    sx={{
                        px: 1.5,
                        py: 0.75,
                        border: `1px solid ${UI_COLORS.anomaly}`,
                        bgcolor: `${UI_COLORS.anomaly}14`,
                        color: UI_COLORS.anomaly,
                        fontFamily: "'Fira Code', monospace",
                        fontSize: "0.62rem",
                        letterSpacing: "0.08em",
                        cursor: picked?.id && !wikiLinkSaving ? "pointer" : "not-allowed",
                        borderRadius: 0.5,
                        opacity: picked?.id && !wikiLinkSaving ? 1 : 0.5,
                        "&:hover": picked?.id && !wikiLinkSaving ? { bgcolor: `${UI_COLORS.anomaly}22` } : {},
                    }}
                >
                    {wikiLinkSaving ? "VINCULANDO…" : "VINCULAR"}
                </Box>
            </DialogActions>
        </Dialog>
    );
}

function CharacterWikiControl({ isDM, isLocked, wikiEntity, onOpenWiki, onOpenLinkDialog, onUnlink }) {
    const showOpenWiki = !!wikiEntity?.id && (!isLocked || isDM);
    const showLinkAction = isDM && !wikiEntity?.id;
    const showUnlinkAction = isDM && !!wikiEntity?.id;

    if (!showOpenWiki && !showLinkAction && !showUnlinkAction) return null;

    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            {showOpenWiki && (
                <CyberTooltip title="Ir a la wiki del personaje">
                    <Box
                        component="button"
                        type="button"
                        onClick={onOpenWiki}
                        sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 0.75,
                            px: 1.25,
                            py: 0.6,
                            border: `1px solid ${UI_COLORS.anomaly}`,
                            bgcolor: `${UI_COLORS.anomaly}14`,
                            color: UI_COLORS.anomaly,
                            fontFamily: "'Fira Code', monospace",
                            fontSize: "0.62rem",
                            letterSpacing: "0.08em",
                            cursor: "pointer",
                            borderRadius: 0.5,
                            whiteSpace: "nowrap",
                            "&:hover": { bgcolor: `${UI_COLORS.anomaly}22` },
                        }}
                    >
                        <AutoStoriesIcon sx={{ fontSize: "0.9rem" }} />
                        IR A LA WIKI
                    </Box>
                </CyberTooltip>
            )}

            {showLinkAction && (
                <CyberTooltip title="Anexar a entidad del archivo">
                    <IconButton
                        size="small"
                        onClick={onOpenLinkDialog}
                        sx={{
                            color: UI_COLORS.accent,
                            border: `1px solid ${UI_COLORS.accent}44`,
                            borderRadius: 0.5,
                            p: 0.6,
                            "&:hover": { bgcolor: `${UI_COLORS.accent}18` },
                        }}
                    >
                        <AddLinkIcon sx={{ fontSize: "1rem" }} />
                    </IconButton>
                </CyberTooltip>
            )}

            {showUnlinkAction && (
                <CyberTooltip title="Desanexar ficha del archivo">
                    <IconButton
                        size="small"
                        onClick={onUnlink}
                        sx={{
                            color: UI_COLORS.textSecondary,
                            border: `1px solid ${UI_COLORS.border}`,
                            borderRadius: 0.5,
                            p: 0.6,
                            "&:hover": { bgcolor: `${UI_COLORS.accentStrong}14`, color: UI_COLORS.accentStrong },
                        }}
                    >
                        <LinkOffIcon sx={{ fontSize: "1rem" }} />
                    </IconButton>
                </CyberTooltip>
            )}
        </Box>
    );
}

function RosterTacticalPanel({ char, statDefinitions, wikiEntities }) {
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
            <Box sx={{
                px: 1.75,
                py: 1.5,
                borderBottom: `1px solid ${UI_COLORS.border}`,
                flexShrink: 0,
            }}>
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
                    <CyberText sx={{ fontFamily: "'Fira Code', monospace", fontSize: "10px", color: UI_COLORS.textSecondary, lineHeight: 1.5 }}>
                        Datos clasificados. Consulta el panel de imagen para el protocolo de desbloqueo.
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
        </Box>
    );
}

export default function LocationCharactersTab({ characters = [], campaignId = null, isDM = false }) {
    const { stats: statDefinitions } = useStatSystem(campaignId);
    const campaignWikiEntities = useCampaignWikiEntities(campaignId);
    const wikiLinkIndex = useMemo(
        () => buildWikiVttLinkIndex(campaignWikiEntities),
        [campaignWikiEntities]
    );
    const [selected, setSelected] = useState(null);
    const [wikiLinkSaving, setWikiLinkSaving] = useState(false);
    const [wikiLinkDialogOpen, setWikiLinkDialogOpen] = useState(false);
    const dispatch = useDispatch();
    const uid = useSelector((s) => s.player.profile?.uid);

    const unlockedCount = characters.filter((c) => !c.isLocked).length;

    const narrativePersonajes = useMemo(
        () => campaignWikiEntities.filter((e) => e.entityType === WIKI_ENTITY_TYPES.PERSONAJE),
        [campaignWikiEntities]
    );

    useEffect(() => {
        setSelected((prev) => {
            if (prev && characters.some((c) => c.id === prev.id)) return prev;
            return characters.find((c) => !c.isLocked) || characters[0] || null;
        });
    }, [characters]);

    const selectedWikiEntity = useMemo(
        () => campaignWikiEntities.find((e) => e.linkedVttCharacterId === selected?.id) || null,
        [campaignWikiEntities, selected?.id]
    );

    const handleOpenCharacterWiki = useCallback(() => {
        if (!selected?.id || !selectedWikiEntity?.id) return;
        dispatch(openWikiOverlay({
            mode: "detail",
            entityId: selectedWikiEntity.id,
            vttContext: { linkedVttCharacterId: selected.id },
        }));
    }, [dispatch, selected?.id, selectedWikiEntity?.id]);

    const handleLinkCharacterWiki = useCallback(async (wikiEntityId) => {
        if (!campaignId || !selected?.id || !uid) return;
        setWikiLinkSaving(true);
        try {
            await linkWikiPersonajeToVtt(campaignId, wikiEntityId, selected.id, uid);
            dispatch(fetchWikiEntities({ campaignId }));
            dispatch(showSnackbar({
                message: wikiEntityId ? "Ficha wiki vinculada al personaje." : "Vínculo wiki eliminado.",
                severity: "success",
            }));
        } catch {
            dispatch(showSnackbar({
                message: "Error al vincular ficha wiki.",
                severity: "error",
            }));
        } finally {
            setWikiLinkSaving(false);
        }
    }, [campaignId, selected?.id, uid, dispatch]);

    const handleUnlinkCharacterWiki = useCallback(async () => {
        if (!campaignId || !selected?.id || !uid || !selectedWikiEntity?.id) return;
        if (!window.confirm(`¿Desanexar la ficha «${selectedWikiEntity.title}» de este token?`)) return;
        await handleLinkCharacterWiki(null);
    }, [campaignId, selected?.id, uid, selectedWikiEntity, handleLinkCharacterWiki]);

    const showWikiControls = selected && (isDM || (!selected.isLocked && !!selectedWikiEntity?.id));

    const navigateRoster = useCallback((dir) => {
        if (!characters.length) return;
        const idx = characters.findIndex((c) => c.id === selected?.id);
        const next = characters[(idx + dir + characters.length) % characters.length];
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

    return (
        <Box sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(12, 1fr)" },
            gridTemplateRows: { xs: "auto 1fr auto", md: "auto 1fr" },
            height: "100%",
            minHeight: 0,
            overflow: "hidden",
        }}>
            {/* Roster — miniatures bar */}
            <Box sx={{
                gridColumn: "1 / -1",
                borderBottom: `1px solid ${UI_COLORS.border}`,
                bgcolor: "#0a0a12",
                px: 1.5,
                py: 1,
                flexShrink: 0,
            }}>
                <Box sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 0.75,
                }}>
                    <CyberText sx={{ fontFamily: "'Fira Code', monospace", fontSize: "8px", color: UI_COLORS.textSecondary, letterSpacing: "0.12em" }}>
                        ROSTER · {unlockedCount}/{characters.length} DESBLOQUEADOS
                    </CyberText>
                    <CyberText sx={{ fontFamily: "'Fira Code', monospace", fontSize: "8px", color: UI_COLORS.anomaly, letterSpacing: "0.1em" }}>
                        ← → NAVEGAR
                    </CyberText>
                </Box>

                <Box sx={{
                    display: "flex",
                    gap: 0.75,
                    overflowX: "auto",
                    pb: 0.25,
                    ...CUSTOM_SCROLLBAR,
                }}>
                    {characters.map((char) => (
                        <RosterThumbnail
                            key={char.id}
                            char={char}
                            isSelected={selected?.id === char.id}
                            onSelect={setSelected}
                            wikiEntity={wikiLinkIndex.byCharacterId.get(char.id) || null}
                        />
                    ))}
                </Box>
            </Box>

            {/* Stage — hero portrait (8/12 columns) */}
            <Box sx={{
                gridColumn: { xs: "1 / -1", md: "span 8" },
                position: "relative",
                overflow: "hidden",
                minHeight: { xs: 240, md: 0 },
                background: `
                    radial-gradient(ellipse 60% 70% at 50% 45%, rgba(255, 102, 255, 0.1), transparent),
                    linear-gradient(135deg, #0a0a14 0%, #12121a 100%)
                `,
                borderRight: { md: `1px solid ${UI_COLORS.border}` },
                borderBottom: { xs: `1px solid ${UI_COLORS.border}`, md: "none" },
                display: "flex",
                alignItems: "center",
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
                <Box sx={{
                    position: "absolute",
                    top: 14,
                    right: 14,
                    zIndex: 3,
                    display: "flex",
                    justifyContent: "flex-end",
                    maxWidth: "calc(100% - 28px)",
                }}>
                    {showWikiControls && (
                        <CharacterWikiControl
                            isDM={isDM}
                            isLocked={selected.isLocked}
                            wikiEntity={selectedWikiEntity}
                            onOpenWiki={handleOpenCharacterWiki}
                            onOpenLinkDialog={() => setWikiLinkDialogOpen(true)}
                            onUnlink={handleUnlinkCharacterWiki}
                        />
                    )}
                </Box>

                {selected && (
                    <Box sx={{
                        position: "relative",
                        width: "min(72%, 420px)",
                        height: "min(88%, 480px)",
                        maxHeight: "100%",
                    }}>
                        <CharacterPortrait
                            key={selected.id}
                            char={selected}
                            sx={{
                                width: "100%",
                                height: "100%",
                                border: `2px solid ${UI_COLORS.accent}`,
                                boxShadow: `0 0 40px ${UI_COLORS.accentGlow}44, inset 0 -60px 80px rgba(0,0,0,0.6)`,
                            }}
                        />

                        {selected.isLocked ? (
                            <Box sx={{
                                position: "absolute",
                                inset: 0,
                                zIndex: 2,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                textAlign: "center",
                                px: 3,
                                py: 2,
                                background: "rgba(0, 0, 0, 0.55)",
                                backdropFilter: "blur(2px)",
                            }}>
                                <LockIcon sx={{ color: UI_COLORS.accent, fontSize: "2rem", mb: 1.5 }} />
                                <CyberTitle sx={{
                                    fontSize: "clamp(0.85rem, 1.8vw, 1.1rem)",
                                    letterSpacing: "0.18em",
                                    color: UI_COLORS.accent,
                                    mb: 1.5,
                                }}>
                                    IDENTIDAD ENCRIPTADA
                                </CyberTitle>
                                <CyberText sx={{
                                    fontFamily: "'Fira Code', monospace",
                                    fontSize: "clamp(0.72rem, 1.4vw, 0.88rem)",
                                    color: UI_COLORS.textPrimary,
                                    lineHeight: 1.6,
                                    maxWidth: 320,
                                }}>
                                    {selected.unlockGoal || "Aún no se ha revelado cómo desbloquear a este personaje."}
                                </CyberText>
                            </Box>
                        ) : (
                            <Box sx={{
                                position: "absolute",
                                bottom: 0,
                                left: 0,
                                right: 0,
                                px: 2,
                                py: 1.5,
                                background: "linear-gradient(transparent, rgba(8, 8, 16, 0.95))",
                            }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                                    <CyberTitle sx={{
                                        fontSize: "clamp(1rem, 2vw, 1.5rem)",
                                        letterSpacing: "0.14em",
                                        color: UI_COLORS.accent,
                                        lineHeight: 1.1,
                                    }}>
                                        {selected.name?.toUpperCase()}
                                    </CyberTitle>
                                    {selectedWikiEntity && (
                                        <VttToWikiLinkBadge wikiEntity={selectedWikiEntity} compact />
                                    )}
                                </Box>
                                <CyberText sx={{ fontSize: "11px", color: UI_COLORS.textSecondary, mt: 0.5 }}>
                                    {selected.callname || "—"}
                                </CyberText>
                            </Box>
                        )}
                    </Box>
                )}
            </Box>

            {/* Tactical panel (4/12 columns) */}
            <Box sx={{
                gridColumn: { xs: "1 / -1", md: "span 4" },
                minHeight: { xs: 200, md: 0 },
                overflow: "hidden",
            }}>
                <RosterTacticalPanel
                    char={selected}
                    statDefinitions={statDefinitions}
                    wikiEntities={campaignWikiEntities}
                />
            </Box>

            <CharacterWikiLinkDialog
                open={wikiLinkDialogOpen}
                onClose={() => setWikiLinkDialogOpen(false)}
                narrativePersonajes={narrativePersonajes}
                wikiLinkSaving={wikiLinkSaving}
                onConfirm={handleLinkCharacterWiki}
            />
        </Box>
    );
}
