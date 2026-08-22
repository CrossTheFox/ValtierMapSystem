import { Box, MenuItem, Select, FormControl } from "@mui/material";
import { UI_COLORS } from "../../constants/uiColors";
import { cyberMenuItemSx } from "../../constants/designSystem";
import {
    BURDEN_EFFECT_TYPES,
    BURDEN_EFFECT_LABELS,
    takenBurdenTargetKeys,
} from "../../utils/characterBurdens";

const C = {
    border: UI_COLORS.border,
    danger: UI_COLORS.danger || "#ff3355",
    cyan: UI_COLORS.anomaly,
    text: UI_COLORS.textPrimary,
    muted: UI_COLORS.textSecondary,
    panel: UI_COLORS.backgroundSecondary,
};

const TYPE_OPTIONS = [
    {
        type: BURDEN_EFFECT_TYPES.BOND_NULLIFY,
        hint: "Desactiva un Bond Power",
    },
    {
        type: BURDEN_EFFECT_TYPES.ACTION_PENANCE,
        hint: "−1 / −2 dados en una Action",
    },
    {
        type: BURDEN_EFFECT_TYPES.CUTTED_ABILITY,
        hint: "Desactiva una Ability",
    },
    {
        type: BURDEN_EFFECT_TYPES.TRAIT_TORN,
        hint: "Desactiva un Trait",
    },
];

const fieldLabelSx = {
    fontFamily: "'Fira Code', monospace",
    fontSize: "0.48rem",
    letterSpacing: "0.1em",
    color: C.muted,
    mb: 0.4,
    textTransform: "uppercase",
};

const selectSx = {
    color: C.text,
    fontSize: "0.72rem",
    fontFamily: "'Fira Sans', sans-serif",
    bgcolor: "rgba(0,0,0,0.5)",
    borderRadius: "3px",
    "& .MuiSelect-select": {
        py: "8px",
        px: "10px",
    },
    "& .MuiOutlinedInput-notchedOutline": {
        borderColor: "rgba(255,51,85,0.35)",
    },
    "&:hover .MuiOutlinedInput-notchedOutline": {
        borderColor: "rgba(255,51,85,0.65)",
    },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
        borderColor: C.cyan,
        borderWidth: "1px",
    },
    "& .MuiSvgIcon-root": { color: C.muted },
    "&.Mui-disabled": {
        color: C.muted,
        WebkitTextFillColor: C.muted,
        bgcolor: "rgba(0,0,0,0.28)",
    },
};

const burdenMenuPaperSx = {
    bgcolor: C.panel,
    border: `1px solid rgba(255,51,85,0.45)`,
    borderRadius: "4px",
    color: C.text,
    backgroundImage: "none",
    boxShadow: "0 8px 28px rgba(0,0,0,0.55), 0 0 16px rgba(255,51,85,0.12)",
    mt: 0.5,
    "& .MuiList-root": {
        py: 0.5,
    },
    "& .MuiMenuItem-root": {
        color: C.text,
        minHeight: 0,
        py: 0.85,
        px: 1.25,
    },
};

const typeMenuItemSx = {
    ...cyberMenuItemSx,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 0.15,
    "&.Mui-selected": {
        bgcolor: `${C.danger}22`,
        color: `${C.text} !important`,
    },
    "&.Mui-selected:hover": {
        bgcolor: `${C.danger}33`,
    },
    "&:hover": {
        bgcolor: `${C.danger}14`,
    },
};

/**
 * Structured burden effect picker (type + target + optional amount).
 */
export default function BurdenEffectFields({
    effect,
    burdens,
    slotIndex,
    editMode,
    targetLocked,
    actionKeys = [],
    bondOptions = [],
    abilityOptions = [],
    traitOptions = [],
    onChange,
}) {
    const type = effect?.type || "";
    const targetId = effect?.targetId || "";
    const amount = effect?.amount === 2 ? 2 : 1;
    const taken = takenBurdenTargetKeys(burdens, slotIndex);

    const targetOptions = (() => {
        if (type === BURDEN_EFFECT_TYPES.BOND_NULLIFY) return bondOptions;
        if (type === BURDEN_EFFECT_TYPES.ACTION_PENANCE) {
            return actionKeys.map((k) => ({ id: k, label: String(k).toUpperCase() }));
        }
        if (type === BURDEN_EFFECT_TYPES.CUTTED_ABILITY) return abilityOptions;
        if (type === BURDEN_EFFECT_TYPES.TRAIT_TORN) return traitOptions;
        return [];
    })();

    const isTargetTaken = (optId) => {
        if (!type || !optId) return false;
        if (taken.has(`${type}:${optId}`)) return true;
        if (type === BURDEN_EFFECT_TYPES.ACTION_PENANCE && taken.has(`action:${String(optId).toLowerCase()}`)) {
            return true;
        }
        if (type === BURDEN_EFFECT_TYPES.BOND_NULLIFY && taken.has(`bond:${optId}`)) return true;
        if (
            (type === BURDEN_EFFECT_TYPES.CUTTED_ABILITY || type === BURDEN_EFFECT_TYPES.TRAIT_TORN)
            && taken.has(`kit:${optId}`)
        ) {
            return true;
        }
        return false;
    };

    const emit = (partial) => {
        if (!editMode || typeof onChange !== "function") return;
        const nextType = partial.type !== undefined ? partial.type : type;
        if (!nextType) {
            onChange(null);
            return;
        }
        const nextTarget = partial.targetId !== undefined ? partial.targetId : targetId;
        if (!nextTarget) {
            onChange({ type: nextType, targetId: "", ...(nextType === BURDEN_EFFECT_TYPES.ACTION_PENANCE ? { amount } : {}) });
            return;
        }
        const next = { type: nextType, targetId: nextTarget };
        if (nextType === BURDEN_EFFECT_TYPES.ACTION_PENANCE) {
            next.amount = partial.amount !== undefined ? partial.amount : amount;
        }
        onChange(next);
    };

    const lockTarget = Boolean(targetLocked && targetId);
    const typeMeta = TYPE_OPTIONS.find((o) => o.type === type);

    return (
        <Box sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1,
            p: "10px 10px 12px",
            borderRadius: "4px",
            border: `1px solid rgba(255,51,85,0.38)`,
            bgcolor: "rgba(255,51,85,0.05)",
        }}>
            <Box sx={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 1,
            }}>
                <Box sx={{
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "0.5rem",
                    letterSpacing: "0.14em",
                    color: C.danger,
                }}>
                    COMPORTAMIENTO
                </Box>
                {typeMeta ? (
                    <Box sx={{
                        fontFamily: "'Fira Code', monospace",
                        fontSize: "0.45rem",
                        letterSpacing: "0.04em",
                        color: C.muted,
                        textAlign: "right",
                        maxWidth: "58%",
                    }}>
                        {typeMeta.hint}
                    </Box>
                ) : null}
            </Box>

            <Box>
                <Box sx={fieldLabelSx}>Tipo</Box>
                <FormControl size="small" fullWidth disabled={!editMode || lockTarget}>
                    <Select
                        displayEmpty
                        value={type}
                        onChange={(e) => {
                            const nextType = e.target.value;
                            if (!nextType) {
                                onChange?.(null);
                                return;
                            }
                            emit({ type: nextType, targetId: "" });
                        }}
                        sx={selectSx}
                        MenuProps={{
                            PaperProps: { sx: burdenMenuPaperSx },
                            MenuListProps: { dense: true },
                        }}
                        renderValue={(v) => (
                            <Box sx={{
                                color: v ? C.text : C.muted,
                                fontStyle: v ? "normal" : "italic",
                            }}>
                                {v ? BURDEN_EFFECT_LABELS[v] : "Sin efecto…"}
                            </Box>
                        )}
                    >
                        <MenuItem value="" sx={{
                            ...typeMenuItemSx,
                            borderBottom: `1px solid ${C.border}`,
                            mb: 0.25,
                        }}>
                            <Box sx={{
                                fontFamily: "'Fira Sans', sans-serif",
                                fontSize: "0.78rem",
                                fontStyle: "italic",
                                color: C.muted,
                            }}>
                                Sin efecto
                            </Box>
                            <Box sx={{
                                fontFamily: "'Fira Code', monospace",
                                fontSize: "0.48rem",
                                color: "rgba(255,255,255,0.35)",
                            }}>
                                Solo narrativa / clock
                            </Box>
                        </MenuItem>
                        {TYPE_OPTIONS.map((opt) => (
                            <MenuItem key={opt.type} value={opt.type} sx={typeMenuItemSx}>
                                <Box sx={{
                                    fontFamily: "'Fira Sans', sans-serif",
                                    fontSize: "0.78rem",
                                    fontWeight: 600,
                                    color: C.text,
                                    letterSpacing: "0.02em",
                                }}>
                                    {BURDEN_EFFECT_LABELS[opt.type]}
                                </Box>
                                <Box sx={{
                                    fontFamily: "'Fira Code', monospace",
                                    fontSize: "0.48rem",
                                    letterSpacing: "0.04em",
                                    color: C.muted,
                                }}>
                                    {opt.hint}
                                </Box>
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Box>

            {type ? (
                <Box>
                    <Box sx={fieldLabelSx}>Objetivo</Box>
                    <FormControl size="small" fullWidth disabled={!editMode || lockTarget}>
                        <Select
                            displayEmpty
                            value={targetId}
                            onChange={(e) => emit({ targetId: e.target.value })}
                            sx={selectSx}
                            MenuProps={{
                                PaperProps: { sx: burdenMenuPaperSx },
                                MenuListProps: { dense: true },
                            }}
                            renderValue={(v) => {
                                if (!v) {
                                    return (
                                        <Box sx={{ color: C.muted, fontStyle: "italic" }}>
                                            Elegir objetivo…
                                        </Box>
                                    );
                                }
                                const opt = targetOptions.find((o) => o.id === v);
                                return opt?.label || v;
                            }}
                        >
                            <MenuItem value="" sx={cyberMenuItemSx}>
                                <em style={{ color: UI_COLORS.textSecondary }}>Elegir objetivo…</em>
                            </MenuItem>
                            {targetOptions.map((opt) => {
                                const takenOpt = isTargetTaken(opt.id) && opt.id !== targetId;
                                return (
                                    <MenuItem
                                        key={opt.id}
                                        value={opt.id}
                                        disabled={takenOpt}
                                        sx={{
                                            ...cyberMenuItemSx,
                                            opacity: takenOpt ? 0.4 : 1,
                                            "&.Mui-selected": {
                                                bgcolor: `${C.danger}22`,
                                            },
                                            "&.Mui-selected:hover": {
                                                bgcolor: `${C.danger}33`,
                                            },
                                            "&:hover": {
                                                bgcolor: `${C.danger}14`,
                                            },
                                        }}
                                    >
                                        <Box sx={{ display: "flex", width: "100%", justifyContent: "space-between", gap: 1 }}>
                                            <span>{opt.label}</span>
                                            {takenOpt ? (
                                                <Box component="span" sx={{
                                                    fontFamily: "'Fira Code', monospace",
                                                    fontSize: "0.48rem",
                                                    color: C.danger,
                                                    letterSpacing: "0.06em",
                                                }}>
                                                    OCUPADO
                                                </Box>
                                            ) : null}
                                        </Box>
                                    </MenuItem>
                                );
                            })}
                        </Select>
                    </FormControl>
                </Box>
            ) : null}

            {lockTarget && (
                <Box sx={{
                    fontFamily: "'Fira Code', monospace",
                    fontSize: "0.48rem",
                    letterSpacing: "0.06em",
                    color: C.cyan,
                    px: 0.25,
                }}>
                    Objetivo fijado · solo DM puede cambiarlo
                </Box>
            )}

            {type === BURDEN_EFFECT_TYPES.ACTION_PENANCE && targetId ? (
                <Box>
                    <Box sx={fieldLabelSx}>Penalización de dados</Box>
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                        {[1, 2].map((n) => {
                            const active = amount === n;
                            return (
                                <Box
                                    key={n}
                                    component="button"
                                    type="button"
                                    disabled={!editMode}
                                    onClick={() => emit({ amount: n })}
                                    sx={{
                                        flex: 1,
                                        py: 0.7,
                                        borderRadius: "3px",
                                        border: `1px solid ${active ? C.danger : C.border}`,
                                        bgcolor: active ? `${C.danger}28` : "rgba(0,0,0,0.35)",
                                        color: active ? C.danger : C.muted,
                                        fontFamily: "Orbitron, sans-serif",
                                        fontSize: "0.58rem",
                                        letterSpacing: "0.1em",
                                        cursor: editMode ? "pointer" : "default",
                                        opacity: editMode ? 1 : 0.7,
                                        boxShadow: active ? `0 0 10px ${C.danger}33` : "none",
                                        "&:hover": editMode ? {
                                            borderColor: C.danger,
                                            color: C.danger,
                                        } : {},
                                    }}
                                >
                                    −{n}
                                </Box>
                            );
                        })}
                    </Box>
                </Box>
            ) : null}
        </Box>
    );
}
