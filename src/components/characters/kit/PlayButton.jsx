import { useState } from "react";
import { useDispatch } from "react-redux";
import { IconButton } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CyberTooltip from "../../customs/CyberTooltip";
import AttackBoonDialog from "../../vtt/AttackBoonDialog";
import { mergeUnlockedUpgrades } from "../../../utils/mergeUnlockedUpgrades";
import { resolveAbilityForPlay } from "../../../utils/abilityResolve";
import { useLocalDiceReveal } from "../../../hooks/useLocalDiceReveal";
import { launchToChat } from "../../../../firebase/services/launchToChat";
import { UI_COLORS } from "../../../constants/uiColors";
import { showSnackbar } from "../../../store/uiSlice";

/**
 * Unified Play button (Slice 6) — wired to `launchToChat`. One instance per
 * ability/trait/limit-break header. Owns the boon/curse gate for attacks: if
 * the merged node has an attack that isn't `autoHit`, opens `AttackBoonDialog`
 * before resolving; otherwise fires straight through.
 */
export default function PlayButton({
    kind, // "ability" | "trait" | "limit_break"
    node,
    character,
    isLb = false,
    kitCtx = {},
    formulaCtx = {},
    campaignId,
    profile,
    compact = false,
}) {
    const dispatch = useDispatch();
    const revealDice = useLocalDiceReveal();
    const [busy, setBusy] = useState(false);
    const [pendingBoon, setPendingBoon] = useState(false);

    if (!node) return null;

    const needsBoonDialog = () => {
        if (kind === "trait") return false;
        const merged = mergeUnlockedUpgrades(node, character, { ...kitCtx, isLb });
        return Boolean(merged?.hasAttack && merged?.attack && !merged.attack.autoHit);
    };

    const fire = async (attackMods = null) => {
        if (!campaignId || !character || busy) return;
        setBusy(true);
        try {
            if (kind === "trait") {
                await launchToChat({ kind: "trait", node, character, campaignId, profile });
                return;
            }
            const resolved = resolveAbilityForPlay(node, character, {
                ctx: kitCtx, formulaCtx, isLb, attackMods,
            });
            if (resolved.hasAttack && resolved.atk && !resolved.atk.autoHit) {
                await revealDice(resolved.atk, {
                    rollerName: character?.name || profile?.nickname || "???",
                    senderId: profile?.uid ?? null,
                });
            }
            await launchToChat({
                kind, node, character, campaignId, profile, kitCtx, formulaCtx, resolved,
            });
        } catch (err) {
            console.error("[PlayButton]", err);
            dispatch(showSnackbar({ message: "No se pudo lanzar la carta", severity: "error" }));
        } finally {
            setBusy(false);
        }
    };

    const handleClick = () => {
        if (needsBoonDialog()) {
            setPendingBoon(true);
            return;
        }
        fire();
    };

    return (
        <>
            <CyberTooltip title="Play" placement="top">
                <span>
                    <IconButton
                        size="small"
                        disabled={busy || !campaignId}
                        onClick={handleClick}
                        aria-label="Play"
                        sx={{
                            width: compact ? 22 : 26,
                            height: compact ? 22 : 26,
                            color: UI_COLORS.anomaly,
                            border: `1px solid ${UI_COLORS.anomaly}55`,
                            bgcolor: "rgba(0,0,0,0.25)",
                            "&:hover": { bgcolor: `${UI_COLORS.anomaly}18`, borderColor: UI_COLORS.anomaly },
                            "&.Mui-disabled": { color: "rgba(255,255,255,0.3)", borderColor: "rgba(255,255,255,0.12)" },
                        }}
                    >
                        <PlayArrowIcon sx={{ fontSize: compact ? "0.78rem" : "0.9rem" }} />
                    </IconButton>
                </span>
            </CyberTooltip>
            <AttackBoonDialog
                open={pendingBoon}
                abilityLabel={node.label || node.title || "Ataque"}
                onClose={() => setPendingBoon(false)}
                onConfirm={({ boons, curses }) => {
                    setPendingBoon(false);
                    fire({ boons, curses });
                }}
            />
        </>
    );
}
