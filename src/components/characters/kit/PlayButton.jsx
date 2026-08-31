import { useState } from "react";
import { useDispatch } from "react-redux";
import { IconButton } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CyberTooltip from "../../customs/CyberTooltip";
import AttackBoonDialog from "../../vtt/AttackBoonDialog";
import { mergeUnlockedUpgrades } from "../../../utils/mergeUnlockedUpgrades";
import { getPlayLaunchDialogProps, needsPlayLaunchDialog } from "../../../utils/abilityAplus";
import { resolveAbilityForPlay } from "../../../utils/abilityResolve";
import { useLocalDiceReveal } from "../../../hooks/useLocalDiceReveal";
import { launchToChat } from "../../../../firebase/services/launchToChat";
import { UI_COLORS } from "../../../constants/uiColors";
import { showSnackbar } from "../../../store/uiSlice";

/**
 * Unified Play button (Slice 6) — wired to `launchToChat`. Opens PlayLaunchDialog
 * when the node needs action spend and/or boon/curse before resolving.
 */
export default function PlayButton({
    kind,
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
    const [pendingLaunch, setPendingLaunch] = useState(false);

    if (!node) return null;

    const mergedForDialog = mergeUnlockedUpgrades(node, character, { ...kitCtx, isLb });
    const launchProps = getPlayLaunchDialogProps(mergedForDialog);

    const needsDialog = () => needsPlayLaunchDialog(mergedForDialog, { kind });

    const fire = async ({ attackMods = null, actionsSpent = null } = {}) => {
        if (!campaignId || !character || busy) return;
        setBusy(true);
        try {
            if (kind === "trait") {
                await launchToChat({ kind: "trait", node, character, campaignId, profile });
                return;
            }
            const resolved = resolveAbilityForPlay(node, character, {
                ctx: kitCtx, formulaCtx, isLb, attackMods, actionsSpent,
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
        if (needsDialog()) {
            setPendingLaunch(true);
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
                open={pendingLaunch}
                abilityLabel={node.label || node.title || "Ataque"}
                showActions={launchProps.showActions}
                showBoons={launchProps.showBoons}
                actionMin={launchProps.actionMin}
                actionMax={launchProps.actionMax}
                defaultActionsSpent={launchProps.defaultActionsSpent}
                onClose={() => setPendingLaunch(false)}
                onConfirm={({ actionsSpent, boons, curses }) => {
                    setPendingLaunch(false);
                    fire({ attackMods: { boons, curses }, actionsSpent });
                }}
            />
        </>
    );
}
