import { useEffect, useMemo, useState } from "react";
import { Box, IconButton, Paper } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useSelector } from "react-redux";
import { CyberText } from "../customs/CustomTexts";
import CyberTooltip from "../customs/CyberTooltip";
import { UI_COLORS } from "../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import { VTT_HUD } from "../../constants/vttHudTokens";
import { getAbilitiesByIds } from "../../../firebase/services/characterService";
import { callAbilityInChat } from "../../../firebase/services/chatService";
import { filterCallableAbilities } from "../../utils/callableAbilities";
import { canControlToken, isDmRole } from "../../utils/tokenControl";
import { listCampaignCharacters } from "../../utils/characterCombat";

/**
 * Horizontal ability bar for the currently selected combat character.
 * Only `type === "ability"` (no traits / upgrades / masteries / LB).
 * Docked bottom-center via CharacterCombatHud.
 */
export default function AbilityHotbar({ open, onClose }) {
    const [abilities, setAbilities] = useState([]);
    const [loading, setLoading] = useState(false);

    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const profile = useSelector((s) => s.player.profile);
    const locations = useSelector((s) => s.world.locations);
    const charactersById = useSelector((s) => s.world.charactersById ?? {});
    const sheetCharacters = useSelector((s) => s.characters.list);
    const isDM = isDmRole(profile?.role);

    const roster = useMemo(() => {
        const byId = new Map(
            listCampaignCharacters(charactersById, locations).map((c) => [c.id, c]),
        );
        (sheetCharacters || []).forEach((c) => {
            if (c?.id && !byId.has(c.id)) byId.set(c.id, c);
        });
        const all = [...byId.values()];
        return isDM ? all : all.filter((c) => canControlToken(c, profile));
    }, [charactersById, locations, sheetCharacters, isDM, profile]);

    const selected = useMemo(() => {
        const id = profile?.activeCharacterId;
        if (id) {
            const hit = roster.find((c) => c.id === id);
            if (hit) return hit;
        }
        return roster[0] || null;
    }, [profile?.activeCharacterId, roster]);

    useEffect(() => {
        if (!open || !selected?.unlockedAbilities?.length) {
            setAbilities([]);
            return undefined;
        }
        let cancelled = false;
        setLoading(true);
        getAbilitiesByIds(selected.unlockedAbilities)
            .then((list) => {
                if (!cancelled) setAbilities(filterCallableAbilities(list));
            })
            .catch(console.error)
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [open, selected?.id, selected?.unlockedAbilities]);

    const handleCall = async (ability) => {
        if (!campaignId || !selected) return;
        await callAbilityInChat(campaignId, profile, {
            ...ability,
            characterId: selected.id,
            characterName: selected.name,
        });
    };

    if (!open) return null;

    return (
        <Paper
            elevation={0}
            data-no-token-drop
            sx={{
                position: "relative",
                zIndex: 1210,
                pointerEvents: "auto",
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                px: 1.25,
                py: 0.85,
                maxWidth: "min(640px, calc(100vw - 120px))",
                borderRadius: `${VTT_HUD.borderRadius}px`,
                border: `1px solid ${VTT_HUD.glassBorder}`,
                bgcolor: VTT_HUD.glassBg,
                backdropFilter: "blur(14px)",
                boxShadow: "0 0 20px rgba(255,102,255,0.08)",
            }}
        >
            <Box sx={{ minWidth: 0, pr: 0.5, borderRight: `1px solid ${UI_COLORS.border}` }}>
                <CyberText
                    sx={{
                        fontFamily: "monospace",
                        fontSize: "0.48rem",
                        letterSpacing: "0.12em",
                        color: UI_COLORS.anomaly,
                        lineHeight: 1,
                    }}
                >
                    HABILIDADES
                </CyberText>
                <CyberText
                    sx={{
                        fontFamily: "'Orbitron', sans-serif",
                        fontSize: "0.58rem",
                        color: "#fff",
                        letterSpacing: "0.04em",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: 100,
                    }}
                >
                    {selected?.name || "—"}
                </CyberText>
            </Box>

            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    overflowX: "auto",
                    maxWidth: "min(520px, 55vw)",
                    py: 0.25,
                    px: 0.25,
                    ...CYBER_SCROLL_STYLE,
                }}
            >
                {loading && (
                    <CyberText sx={{ fontSize: "0.65rem", color: UI_COLORS.textSecondary, px: 1 }}>
                        Cargando…
                    </CyberText>
                )}
                {!loading && abilities.length === 0 && (
                    <CyberText sx={{ fontSize: "0.65rem", color: UI_COLORS.textSecondary, px: 1 }}>
                        Sin habilidades desbloqueadas
                    </CyberText>
                )}
                {abilities.map((ab) => (
                    <CyberTooltip
                        key={ab.id}
                        title={ab.content?.slice(0, 160) || ab.label || ab.id}
                        placement="top"
                    >
                        <IconButton
                            size="small"
                            onClick={() => handleCall(ab)}
                            sx={{
                                minWidth: 44,
                                height: 40,
                                px: 0.75,
                                borderRadius: 1,
                                border: `1px solid ${UI_COLORS.accent}55`,
                                color: UI_COLORS.accent,
                                fontFamily: "'Orbitron', sans-serif",
                                fontSize: "0.52rem",
                                letterSpacing: "0.04em",
                                flexShrink: 0,
                                "&:hover": {
                                    bgcolor: `${UI_COLORS.accent}18`,
                                    borderColor: UI_COLORS.accent,
                                    boxShadow: `0 0 10px ${UI_COLORS.accent}33`,
                                },
                            }}
                        >
                            {(ab.label || ab.key || "?").slice(0, 8).toUpperCase()}
                        </IconButton>
                    </CyberTooltip>
                ))}
            </Box>

            <IconButton
                size="small"
                onClick={onClose}
                aria-label="Cerrar barra de habilidades"
                sx={{
                    color: UI_COLORS.accent,
                    border: `1px solid ${UI_COLORS.border}`,
                    width: 28,
                    height: 28,
                    flexShrink: 0,
                    "&:hover": { bgcolor: `${UI_COLORS.accent}18` },
                }}
            >
                <CloseIcon sx={{ fontSize: "0.95rem" }} />
            </IconButton>
        </Paper>
    );
}
