import { useRef, useState } from "react";
import { Box } from "@mui/material";
import {
    TRAIT_MODES,
    TRAIT_MODE_COLORS,
    normalizeTraitMode,
} from "../../../constants/abilityKinds";
import { MACRO_SLOT_TYPES } from "../../../constants/macroBar";
import { isTraitTorn } from "../../../utils/characterBurdens";
import { isKitNodeUnlocked } from "../../../utils/kitProgression";
import {
    KitSvgModeActive,
    KitSvgModeInterrupt,
    KitSvgModePassive,
    KitSvgModeTrigger,
} from "../../../constants/kitSvg";
import MacroPinButton from "../MacroPinButton";
import PlayButton from "./PlayButton";
import DeleteAbilityButton from "./DeleteAbilityButton";
import KitCardBodyB2 from "./KitCardBodyB2";
import { CostChip, RangeChip, AoeChip, TraitModeChip } from "./KitHeaderChips";
import KitTagBtn from "./KitTagBtn";
import { CARD_BASE_SX, CHEVRON_SX } from "./kitCardChrome";

const MODE_ICON = {
    [TRAIT_MODES.PASSIVE]: KitSvgModePassive,
    [TRAIT_MODES.ACTIVE]: KitSvgModeActive,
    [TRAIT_MODES.TRIGGER]: KitSvgModeTrigger,
    [TRAIT_MODES.INTERRUPT]: KitSvgModeInterrupt,
};

const PLAYABLE = new Set([TRAIT_MODES.ACTIVE, TRAIT_MODES.INTERRUPT]);

function TraitVpack({ trait, kitEdit, onPatch }) {
    if (!kitEdit) {
        const hasCost = trait.actionCost != null && trait.actionCost !== "";
        const hasRange = trait.range && trait.range !== "self";
        const hasAoe = Boolean(trait.aoe);
        if (!hasCost && !hasRange && !hasAoe) return null;
        return (
            <Box sx={{ display: "inline-flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                <CostChip value={trait.actionCost} kitEdit={false} />
                <RangeChip value={trait.range} kitEdit={false} />
                <AoeChip value={trait.aoe} kitEdit={false} />
            </Box>
        );
    }

    return (
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
            <CostChip
                value={trait.actionCost}
                kitEdit
                allowEmpty
                onChange={(next) => onPatch?.({
                    actionCost: next === "" ? null : (Number.isNaN(Number(next)) ? next : Number(next)),
                })}
            />
            <RangeChip
                value={trait.range}
                kitEdit
                onChange={(next) => onPatch?.({ range: next || null })}
            />
            <AoeChip
                value={trait.aoe}
                kitEdit
                onChange={(next) => onPatch?.({ aoe: next || null })}
            />
        </Box>
    );
}

export default function TraitCategoryRail({
    trait,
    character,
    kitEdit,
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
    const modeOpenRef = useRef(null);
    const mode = normalizeTraitMode(trait.traitMode);
    const accent = TRAIT_MODE_COLORS[mode];
    const Icon = MODE_ICON[mode] || KitSvgModePassive;
    const canPlay = PLAYABLE.has(mode);
    const locked = !isKitNodeUnlocked(character, trait, kitCtx);
    const torn = isTraitTorn(character?.burdens, trait.key || trait.id);

    const onRailClick = (e) => {
        if (!kitEdit) return;
        e.stopPropagation();
        modeOpenRef.current?.();
    };

    return (
        <Box
            sx={{
                ...CARD_BASE_SX,
                border: `1px solid ${accent}4d`,
                opacity: torn || locked ? 0.72 : 1,
            }}
        >
            <Box
                onClick={() => setOpen((v) => !v)}
                sx={{
                    display: "grid",
                    gridTemplateColumns: "36px minmax(0, 1fr) auto",
                    minHeight: 38,
                    cursor: "pointer",
                    userSelect: "none",
                    alignItems: "stretch",
                }}
            >
                <Box
                    onClick={onRailClick}
                    title={kitEdit ? "Click para elegir traitMode" : mode}
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRight: "1px solid rgba(255,255,255,0.1)",
                        background: `${accent}1f`,
                        color: accent,
                        cursor: kitEdit ? "pointer" : "default",
                        "&:hover": kitEdit ? { filter: "brightness(1.25)" } : undefined,
                    }}
                >
                    <Icon size={22} />
                </Box>
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: "6px",
                        px: "8px",
                        py: "4px",
                        minWidth: 0,
                    }}
                >
                    <Box
                        sx={{
                            fontFamily: "Orbitron, sans-serif",
                            fontSize: "0.72rem",
                            letterSpacing: "0.06em",
                            color: "#ffffff",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            flex: "1 1 auto",
                            minWidth: 0,
                            textDecoration: torn ? "line-through" : "none",
                        }}
                    >
                        {trait.label}
                    </Box>
                    <Box onClick={kitEdit ? (e) => e.stopPropagation() : undefined}>
                        <TraitModeChip
                            value={trait.traitMode}
                            kitEdit={kitEdit}
                            openRef={modeOpenRef}
                            onChange={(next) => onPatch?.({ traitMode: next })}
                        />
                    </Box>
                    <Box onClick={kitEdit ? (e) => e.stopPropagation() : undefined}>
                        <TraitVpack trait={trait} kitEdit={kitEdit} onPatch={onPatch} />
                    </Box>
                    <Box onClick={(e) => e.stopPropagation()}>
                        <KitTagBtn
                            tagKeys={trait.tagKeys || []}
                            availableTags={availableTags}
                            kitEdit={kitEdit}
                            onChange={(next) => {
                                onPatch?.({ tagKeys: next });
                                onSave?.({
                                    label: trait.label,
                                    blurb: trait.blurb,
                                    tagKeys: next,
                                });
                            }}
                        />
                    </Box>
                </Box>
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        px: "6px",
                        borderLeft: "1px solid rgba(255,255,255,0.08)",
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <MacroPinButton
                        character={character}
                        size="tiny"
                        entry={{
                            type: MACRO_SLOT_TYPES.TRAIT,
                            id: trait.key || trait.id,
                            label: trait.label || "TRAIT",
                            blurb: trait.blurb || "",
                        }}
                    />
                    {canPlay && (
                        <PlayButton
                            kind="trait"
                            node={trait}
                            character={character}
                            kitCtx={kitCtx}
                            formulaCtx={formulaCtx}
                            campaignId={campaignId}
                            profile={profile}
                            compact
                        />
                    )}
                    {kitEdit && typeof onDelete === "function" && (
                        <DeleteAbilityButton label={trait.label} onConfirm={onDelete} />
                    )}
                    <Box
                        component="span"
                        sx={{ ...CHEVRON_SX, transform: open ? "rotate(90deg)" : "none" }}
                        onClick={() => setOpen((v) => !v)}
                    >
                        ▸
                    </Box>
                </Box>
            </Box>
            {open && (
                <Box sx={{ px: "10px", pb: "10px", borderTop: "1px solid rgba(255,255,255,0.06)" }} onClick={(e) => e.stopPropagation()}>
                    <KitCardBodyB2
                        node={trait}
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
