import { useState } from "react";
import { Box } from "@mui/material";
import { UI_COLORS } from "../../../constants/uiColors";
import { MACRO_SLOT_TYPES } from "../../../constants/macroBar";
import { KitSvgCross, KitSvgLbStar, KitSvgPulse } from "../../../constants/kitSvg";
import MacroPinButton from "../MacroPinButton";
import PlayButton from "./PlayButton";
import DeleteAbilityButton from "./DeleteAbilityButton";
import KitCardBodyB2 from "./KitCardBodyB2";
import { toggleHasAttackPatch } from "../../../utils/abilityAplus";
import { CostChip, RangeChip, AoeChip, ResolveChip, AtkToggleMark } from "./KitHeaderChips";
import KitTagBtn from "./KitTagBtn";
import { CARD_BASE_SX, CHEVRON_SX, KIT_DANGER, KIT_LB } from "./kitCardChrome";

export default function LbStackCompact({
    limitBreak,
    unlocked,
    kitEdit,
    character,
    kitCtx,
    formulaCtx,
    campaignId,
    profile,
    availableTags,
    onPatch,
    onUnlockNode,
    onDelete,
    onSave,
}) {
    const [open, setOpen] = useState(false);
    const locked = !unlocked || !limitBreak;
    const title = limitBreak?.label || "LIMIT BREAK";
    const hasAttack = Boolean(limitBreak?.hasAttack);

    return (
        <Box
            sx={{
                ...CARD_BASE_SX,
                border: `1px solid ${locked ? "rgba(255,51,85,0.55)" : "rgba(255,204,51,0.45)"}`,
                background: locked
                    ? "linear-gradient(160deg, rgba(255,51,85,0.1), rgba(0,0,0,0.35))"
                    : "linear-gradient(160deg, rgba(255,204,51,0.1), rgba(0,0,0,0.35))",
            }}
        >
            <Box
                onClick={() => { if (limitBreak) setOpen((v) => !v); }}
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    p: "10px 8px 10px 0",
                    cursor: limitBreak ? "pointer" : "default",
                    userSelect: "none",
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", gap: "8px", px: "10px", minWidth: 0 }}>
                    <Box sx={{ width: 18, height: 18, color: locked ? KIT_DANGER : KIT_LB, display: "grid", placeItems: "center", flexShrink: 0 }}>
                        {locked ? (
                            <Box sx={{ fontFamily: "Orbitron, sans-serif", fontSize: "0.85rem", fontWeight: 700, lineHeight: 1 }}>✕</Box>
                        ) : (
                            <KitSvgLbStar size={16} />
                        )}
                    </Box>
                    {limitBreak && (
                        <Box sx={{
                            width: 20, height: 20, display: "grid", placeItems: "center",
                            color: hasAttack ? "#ff8a3d" : UI_COLORS.anomaly, flexShrink: 0,
                        }}>
                            {hasAttack ? <KitSvgCross size={18} /> : <KitSvgPulse size={18} />}
                        </Box>
                    )}
                    <Box
                        sx={{
                            flex: 1,
                            minWidth: 0,
                            fontFamily: "Orbitron, sans-serif",
                            fontSize: "0.82rem",
                            letterSpacing: "0.05em",
                            color: "#ffffff",
                            lineHeight: 1.2,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            opacity: locked ? 0.55 : 1,
                        }}
                    >
                        {title}
                    </Box>
                    <Box
                        sx={{
                            fontFamily: "Orbitron, sans-serif",
                            fontSize: "0.42rem",
                            letterSpacing: "0.1em",
                            px: "5px",
                            py: "2px",
                            borderRadius: "2px",
                            border: `1px solid ${locked ? "rgba(255,51,85,0.7)" : "rgba(255,204,51,0.65)"}`,
                            color: locked ? KIT_DANGER : KIT_LB,
                            bgcolor: locked ? "rgba(255,51,85,0.12)" : "rgba(255,204,51,0.1)",
                            flexShrink: 0,
                        }}
                    >
                        {locked ? "LOCKED" : "READY"}
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                        {limitBreak && (
                            <MacroPinButton
                                character={character}
                                size="tiny"
                                entry={{
                                    type: MACRO_SLOT_TYPES.ULTIMATE,
                                    id: limitBreak.key || limitBreak.id,
                                    label: limitBreak.label || "LIMIT BREAK",
                                    blurb: limitBreak.blurb || "",
                                }}
                            />
                        )}
                        {!locked && (
                            <PlayButton
                                kind="limit_break"
                                isLb
                                node={limitBreak}
                                character={character}
                                kitCtx={kitCtx}
                                formulaCtx={formulaCtx}
                                campaignId={campaignId}
                                profile={profile}
                                compact
                            />
                        )}
                        {kitEdit && limitBreak && typeof onDelete === "function" && (
                            <DeleteAbilityButton label={limitBreak.label} onConfirm={onDelete} />
                        )}
                        {limitBreak && (
                            <Box
                                component="span"
                                sx={{ ...CHEVRON_SX, transform: open ? "rotate(90deg)" : "none" }}
                                onClick={() => setOpen((v) => !v)}
                            >
                                ▸
                            </Box>
                        )}
                    </Box>
                </Box>
                <Box sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "5px",
                    px: "10px",
                    opacity: locked ? 0.55 : 1,
                }} onClick={kitEdit ? (e) => e.stopPropagation() : undefined}>
                    {locked ? (
                        <Box sx={{ fontSize: "0.7rem", color: UI_COLORS.textSecondary }}>
                            Aún no desbloqueado
                        </Box>
                    ) : (
                        <>
                            <CostChip
                                value={limitBreak.actionCost}
                                kitEdit={kitEdit}
                                onChange={(next) => onPatch?.({
                                    actionCost: next === "" ? null : (Number.isNaN(Number(next)) ? next : Number(next)),
                                })}
                            />
                            <RangeChip value={limitBreak.range} kitEdit={kitEdit} onChange={(next) => onPatch?.({ range: next || null })} />
                            <AoeChip value={limitBreak.aoe} kitEdit={kitEdit} onChange={(next) => onPatch?.({ aoe: next || null })} />
                            <ResolveChip
                                value={limitBreak.resolveCost}
                                kitEdit={kitEdit}
                                onChange={(next) => onPatch?.({ resolveCost: Number(next) || 1 })}
                            />
                            {kitEdit && (
                                <AtkToggleMark
                                    hasAttack={hasAttack}
                                    kitEdit={kitEdit}
                                    onToggle={() => onPatch?.(toggleHasAttackPatch(!hasAttack))}
                                />
                            )}
                            <KitTagBtn
                                tagKeys={limitBreak.tagKeys || []}
                                availableTags={availableTags}
                                kitEdit={kitEdit}
                                onChange={(next) => {
                                    onPatch?.({ tagKeys: next });
                                    onSave?.({
                                        label: limitBreak.label,
                                        blurb: limitBreak.blurb,
                                        tagKeys: next,
                                    });
                                }}
                            />
                        </>
                    )}
                </Box>
            </Box>
            {open && limitBreak && (
                <Box sx={{ px: "10px", pb: "10px" }} onClick={(e) => e.stopPropagation()}>
                    <KitCardBodyB2
                        node={limitBreak}
                        character={character}
                        ctx={kitCtx}
                        kitEdit={kitEdit && unlocked}
                        formulaCtx={formulaCtx}
                        isLb
                        onPatch={onPatch}
                        onUnlockNode={onUnlockNode}
                    />
                </Box>
            )}
        </Box>
    );
}
