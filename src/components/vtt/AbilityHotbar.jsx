import { useEffect, useState } from "react";
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

/**
 * Horizontal ability bar for the currently selected combat character.
 * Only `type === "ability"` (no traits / upgrades / masteries / LB).
 * Expands to the right of the abilities toggle in CharacterCombatHud.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} [props.onClose]
 * @param {object|null} props.character — active combat character from parent HUD
 */
export default function AbilityHotbar({ open, onClose, character }) {
    const [abilities, setAbilities] = useState([]);
    const [loading, setLoading] = useState(false);

    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const profile = useSelector((s) => s.player.profile);

    useEffect(() => {
        if (!open || !character?.unlockedAbilities?.length) {
            setAbilities([]);
            return undefined;
        }
        let cancelled = false;
        setLoading(true);
        getAbilitiesByIds(character.unlockedAbilities)
            .then((list) => {
                if (!cancelled) setAbilities(filterCallableAbilities(list));
            })
            .catch(console.error)
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [open, character?.id, character?.unlockedAbilities]);

    const handleCall = async (ability) => {
        if (!campaignId || !character) return;
        await callAbilityInChat(campaignId, profile, {
            ...ability,
            characterId: character.id,
            characterName: character.name,
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
                gap: 0.65,
                px: 1,
                py: 0.55,
                maxWidth: "min(640px, calc(100vw - 340px))",
                borderRadius: `${VTT_HUD.borderRadius}px`,
                border: `1px solid ${VTT_HUD.glassBorder}`,
                bgcolor: VTT_HUD.glassBg,
                backdropFilter: "blur(14px)",
                boxShadow: "0 0 20px rgba(255,102,255,0.08)",
            }}
        >
            <CyberText
                sx={{
                    fontFamily: "monospace",
                    fontSize: "0.48rem",
                    letterSpacing: "0.12em",
                    color: UI_COLORS.anomaly,
                    flexShrink: 0,
                    pr: 0.4,
                    borderRight: `1px solid ${UI_COLORS.border}`,
                }}
            >
                HABILIDADES
            </CyberText>

            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    overflowX: "auto",
                    maxWidth: "min(520px, 50vw)",
                    py: 0.15,
                    px: 0.15,
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
                                height: 36,
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

            {typeof onClose === "function" && (
                <IconButton
                    size="small"
                    onClick={onClose}
                    aria-label="Cerrar barra de habilidades"
                    sx={{
                        color: UI_COLORS.accent,
                        border: `1px solid ${UI_COLORS.border}`,
                        width: 26,
                        height: 26,
                        flexShrink: 0,
                        "&:hover": { bgcolor: `${UI_COLORS.accent}18` },
                    }}
                >
                    <CloseIcon sx={{ fontSize: "0.9rem" }} />
                </IconButton>
            )}
        </Paper>
    );
}
