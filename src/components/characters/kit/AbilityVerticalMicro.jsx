import { useState } from "react";
import { Box } from "@mui/material";
import { UI_COLORS } from "../../../constants/uiColors";
import { MACRO_SLOT_TYPES } from "../../../constants/macroBar";
import { isAbilityCut } from "../../../utils/characterBurdens";
import { isKitNodeUnlocked } from "../../../utils/kitProgression";
import { toggleHasAttackPatch } from "../../../utils/abilityAplus";
import { KitSvgCross, KitSvgPulse } from "../../../constants/kitSvg";
import MacroPinButton from "../MacroPinButton";
import PlayButton from "./PlayButton";
import DeleteAbilityButton from "./DeleteAbilityButton";
import KitCardBodyB2 from "./KitCardBodyB2";
import { CostChip, RangeChip, AoeChip, UnlockBadge } from "./KitHeaderChips";
import KitTagBtn from "./KitTagBtn";
import { abilityTone, CARD_BASE_SX, CARD_HD_GRID_SX, CHEVRON_SX, HD_DIV_SX, toneAccent, toneBorder } from "./kitCardChrome";

export default function AbilityVerticalMicro({
    ability,
    inactive = false,
    kitEdit,
    character,
    kitCtx,
    formulaCtx,
    campaignId,
    profile,
    availableTags,
    onToggleLoadout,
    onPatch,
    onUnlockNode,
    onDelete,
    onSave,
}) {
    const [open, setOpen] = useState(false);
    const tone = abilityTone(ability);
    const accent = toneAccent(tone);
    const locked = !isKitNodeUnlocked(character, ability, kitCtx);
    const cut = isAbilityCut(character?.burdens, ability.key || ability.id);

    return (
        <Box
            sx={{
                ...CARD_BASE_SX,
                border: `1px ${inactive ? "dashed" : "solid"} ${toneBorder(tone, inactive)}`,
                opacity: inactive ? 0.48 : (cut || locked ? 0.72 : 1),
                filter: inactive ? "grayscale(0.35)" : "none",
            }}
        >
            <Box
                onClick={() => {
                    if (!kitEdit) setOpen((v) => !v);
                }}
                sx={{
                    ...CARD_HD_GRID_SX,
                    cursor: "pointer",
                    userSelect: "none",
                    boxShadow: `inset 4px 0 0 ${accent}`,
                }}
            >
                <Box
                    sx={{
                        gridColumn: "1 / span 3",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        minWidth: 0,
                        pr: "6px",
                        overflow: "hidden",
                        minHeight: 28,
                    }}
                    title={kitEdit ? undefined : "Cost · Range · AoE"}
                    onClick={(e) => {
                        if (kitEdit) e.stopPropagation();
                        else setOpen((v) => !v);
                    }}
                >
                    <CostChip
                        value={ability.actionCost}
                        kitEdit={kitEdit}
                        onChange={(next) => onPatch?.({
                            actionCost: next === "" ? null : (Number.isNaN(Number(next)) ? next : Number(next)),
                        })}
                    />
                    <RangeChip value={ability.range} kitEdit={kitEdit} onChange={(next) => onPatch?.({ range: next || null })} />
                    <AoeChip value={ability.aoe} kitEdit={kitEdit} onChange={(next) => onPatch?.({ aoe: next || null })} />
                </Box>
                <Box
                    sx={{
                        gridColumn: "4 / span 6",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        minWidth: 0,
                    }}
                    onClick={(e) => {
                        if (!kitEdit) {
                            e.stopPropagation();
                            setOpen((v) => !v);
                        }
                    }}
                >
                    <Box
                        title={ability.hasAttack ? "Attack" : "Standard"}
                        onClick={(e) => {
                            if (!kitEdit) return;
                            e.stopPropagation();
                            onPatch?.(toggleHasAttackPatch(!ability.hasAttack));
                        }}
                        sx={{
                            width: 20,
                            height: 20,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: ability.hasAttack ? "#ff8a3d" : UI_COLORS.anomaly,
                            flexShrink: 0,
                            cursor: kitEdit ? "pointer" : "inherit",
                            opacity: ability.hasAttack ? 1 : 0.85,
                        }}
                    >
                        {ability.hasAttack ? <KitSvgCross size={18} /> : <KitSvgPulse size={18} />}
                    </Box>
                    <Box
                        sx={{
                            fontFamily: "Orbitron, sans-serif",
                            fontSize: "0.86rem",
                            letterSpacing: "0.05em",
                            color: "#ffffff",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            minWidth: 0,
                            textDecoration: cut ? "line-through" : "none",
                        }}
                    >
                        {ability.label}
                    </Box>
                    {cut && (
                        <Box sx={{
                            fontFamily: "Orbitron, sans-serif",
                            fontSize: "0.38rem",
                            letterSpacing: "0.1em",
                            color: "#ff3355",
                            border: "1px solid rgba(255,51,85,0.55)",
                            px: "4px",
                            borderRadius: "2px",
                        }}>
                            CUT
                        </Box>
                    )}
                </Box>
                <Box
                    sx={{
                        gridColumn: "10 / span 1",
                        display: "flex",
                        justifyContent: "flex-end",
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <KitTagBtn
                        tagKeys={ability.tagKeys || []}
                        availableTags={availableTags}
                        kitEdit={kitEdit}
                        onChange={(next) => {
                            onPatch?.({ tagKeys: next });
                            onSave?.({
                                label: ability.label,
                                blurb: ability.blurb,
                                abilityKind: ability.abilityKind,
                                tagKeys: next,
                            });
                        }}
                    />
                </Box>
                <Box
                    sx={{
                        gridColumn: "11 / span 2",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: "4px",
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <Box sx={HD_DIV_SX} aria-hidden />
                    {kitEdit && (
                        <Box
                            component="button"
                            type="button"
                            title={inactive ? "Mover a loadout" : "Enviar a bench"}
                            onClick={onToggleLoadout}
                            sx={{
                                height: 22,
                                px: "5px",
                                borderRadius: "3px",
                                border: `1px solid ${inactive ? UI_COLORS.anomaly : "rgba(255,255,255,0.2)"}`,
                                bgcolor: "transparent",
                                color: inactive ? UI_COLORS.anomaly : UI_COLORS.textSecondary,
                                fontFamily: "Orbitron, sans-serif",
                                fontSize: "0.36rem",
                                letterSpacing: "0.08em",
                                cursor: "pointer",
                            }}
                        >
                            {inactive ? "IN" : "OUT"}
                        </Box>
                    )}
                    <UnlockBadge node={ability} character={character} ctx={kitCtx} onUnlock={onUnlockNode} />
                    <MacroPinButton
                        character={character}
                        size="tiny"
                        entry={{
                            type: MACRO_SLOT_TYPES.ABILITY,
                            id: ability.key || ability.id,
                            label: ability.label || "ABILITY",
                            blurb: ability.blurb || "",
                        }}
                    />
                    {!inactive && (
                        <PlayButton
                            kind="ability"
                            node={ability}
                            character={character}
                            kitCtx={kitCtx}
                            formulaCtx={formulaCtx}
                            campaignId={campaignId}
                            profile={profile}
                            compact
                        />
                    )}
                    {kitEdit && typeof onDelete === "function" && (
                        <DeleteAbilityButton label={ability.label} onConfirm={onDelete} />
                    )}
                    <Box
                        component="span"
                        sx={{
                            ...CHEVRON_SX,
                            transform: open ? "rotate(90deg)" : "none",
                            color: open ? accent : CHEVRON_SX.color,
                        }}
                        onClick={() => setOpen((v) => !v)}
                    >
                        ▸
                    </Box>
                </Box>
            </Box>
            {open && (
                <Box sx={{ px: "10px", pb: "10px" }} onClick={(e) => e.stopPropagation()}>
                    <KitCardBodyB2
                        node={ability}
                        character={character}
                        ctx={kitCtx}
                        kitEdit={kitEdit}
                        formulaCtx={formulaCtx}
                        onPatch={onPatch}
                        onUnlockNode={onUnlockNode}
                    />
                </Box>
            )}
        </Box>
    );
}
