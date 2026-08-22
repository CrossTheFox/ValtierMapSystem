import { Box, MenuItem, Select } from "@mui/material";
import { UI_COLORS } from "../../../constants/uiColors";
import { COMBAT_STAT_KEYS } from "../../../constants/combatStats";
import { cyberMenuItemSx, cyberMenuPaperSx } from "../../../constants/designSystem";
import {
    ITEM_EFFECT_LABELS,
    ITEM_EFFECT_TYPES,
    normalizeItemEffect,
} from "../../../utils/campaignItems";

const ACTION_KEYS = ["sneak", "traverse", "sense", "study", "charm", "command", "tinker", "excel", "smash", "endure"];

const selectSx = {
    color: UI_COLORS.textPrimary,
    fontSize: "0.72rem",
    fontFamily: "'Fira Sans', sans-serif",
    bgcolor: "rgba(0,0,0,0.5)",
    borderRadius: "3px",
    "& .MuiSelect-select": { py: "8px", px: "10px" },
    "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(245,197,66,0.35)" },
    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(245,197,66,0.7)" },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.loot, borderWidth: "1px" },
    "& .MuiSvgIcon-root": { color: UI_COLORS.textSecondary },
};

const labelSx = {
    fontFamily: "'Fira Code', monospace",
    fontSize: "0.48rem",
    letterSpacing: "0.1em",
    color: UI_COLORS.textSecondary,
    mb: 0.4,
    textTransform: "uppercase",
};

const TYPE_OPTIONS = [
    { type: ITEM_EFFECT_TYPES.STAT_MOD, hint: "± combat stat mientras se lleva" },
    { type: ITEM_EFFECT_TYPES.ACTION_BOON, hint: "+1 / +2 dados en una Action" },
    { type: ITEM_EFFECT_TYPES.GRANT_TRAIT, hint: "Otorga un Trait del kit" },
    { type: ITEM_EFFECT_TYPES.GRANT_ABILITY, hint: "Otorga una Ability del kit" },
];

export default function ItemEffectFields({
    effect,
    onChange,
    editMode = true,
    abilityOptions = [],
    traitOptions = [],
}) {
    const cur = normalizeItemEffect(effect);

    const setType = (type) => {
        if (!type) {
            onChange?.(null);
            return;
        }
        onChange?.(normalizeItemEffect({ type, targetId: "", amount: 1 }));
    };

    const setTarget = (targetId) => {
        onChange?.(normalizeItemEffect({ ...(cur || {}), targetId }));
    };

    const setAmount = (amount) => {
        onChange?.(normalizeItemEffect({ ...(cur || {}), amount }));
    };

    let targets = [];
    if (cur?.type === ITEM_EFFECT_TYPES.STAT_MOD) {
        targets = COMBAT_STAT_KEYS.map((k) => ({ id: k, label: k.toUpperCase() }));
    } else if (cur?.type === ITEM_EFFECT_TYPES.ACTION_BOON) {
        targets = ACTION_KEYS.map((k) => ({ id: k, label: k.toUpperCase() }));
    } else if (cur?.type === ITEM_EFFECT_TYPES.GRANT_TRAIT) {
        targets = traitOptions;
    } else if (cur?.type === ITEM_EFFECT_TYPES.GRANT_ABILITY) {
        targets = abilityOptions;
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Box>
                <Box sx={labelSx}>Comportamiento</Box>
                <Select
                    size="small"
                    fullWidth
                    displayEmpty
                    disabled={!editMode}
                    value={cur?.type || ""}
                    onChange={(e) => setType(e.target.value)}
                    sx={selectSx}
                    MenuProps={{ PaperProps: { sx: cyberMenuPaperSx } }}
                >
                    <MenuItem value="" sx={cyberMenuItemSx}>Ninguno</MenuItem>
                    {TYPE_OPTIONS.map((o) => (
                        <MenuItem key={o.type} value={o.type} sx={cyberMenuItemSx}>
                            {ITEM_EFFECT_LABELS[o.type]} — {o.hint}
                        </MenuItem>
                    ))}
                </Select>
            </Box>
            {cur ? (
                <Box>
                    <Box sx={labelSx}>Objetivo</Box>
                    <Select
                        size="small"
                        fullWidth
                        displayEmpty
                        disabled={!editMode}
                        value={cur.targetId || ""}
                        onChange={(e) => setTarget(e.target.value)}
                        sx={selectSx}
                        MenuProps={{ PaperProps: { sx: cyberMenuPaperSx } }}
                    >
                        <MenuItem value="" sx={cyberMenuItemSx}>Elegir…</MenuItem>
                        {targets.map((t) => (
                            <MenuItem key={t.id} value={t.id} sx={cyberMenuItemSx}>
                                {t.label}
                            </MenuItem>
                        ))}
                    </Select>
                </Box>
            ) : null}
            {cur?.type === ITEM_EFFECT_TYPES.STAT_MOD || cur?.type === ITEM_EFFECT_TYPES.ACTION_BOON ? (
                <Box>
                    <Box sx={labelSx}>Cantidad</Box>
                    <Select
                        size="small"
                        fullWidth
                        disabled={!editMode}
                        value={String(cur.amount ?? 1)}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        sx={selectSx}
                        MenuProps={{ PaperProps: { sx: cyberMenuPaperSx } }}
                    >
                        {(cur.type === ITEM_EFFECT_TYPES.STAT_MOD
                            ? [-2, -1, 1, 2]
                            : [1, 2]
                        ).map((n) => (
                            <MenuItem key={n} value={String(n)} sx={cyberMenuItemSx}>
                                {n > 0 ? `+${n}` : n}
                            </MenuItem>
                        ))}
                    </Select>
                </Box>
            ) : null}
        </Box>
    );
}
