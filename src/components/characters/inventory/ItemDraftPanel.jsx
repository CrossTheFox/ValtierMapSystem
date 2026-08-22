import { Box, MenuItem, Select, TextField } from "@mui/material";
import { UI_COLORS } from "../../../constants/uiColors";
import { cyberMenuItemSx, cyberMenuPaperSx } from "../../../constants/designSystem";
import {
    ITEM_RARITY,
    ITEM_RARITY_META,
    ITEM_TYPES,
    ITEM_TYPE_META,
} from "../../../utils/campaignItems";
import ItemEffectFields from "./ItemEffectFields";
import ItemEquipFields from "./ItemEquipFields";

const fieldSx = {
    "& .MuiOutlinedInput-root": {
        color: UI_COLORS.textPrimary,
        fontFamily: '"Fira Sans", sans-serif',
        fontSize: "0.78rem",
        bgcolor: "rgba(8,8,14,0.55)",
        "& fieldset": { borderColor: UI_COLORS.border },
        "&:hover fieldset": { borderColor: `${UI_COLORS.loot}66` },
        "&.Mui-focused fieldset": { borderColor: UI_COLORS.loot },
    },
    "& .MuiInputBase-input": { color: UI_COLORS.textPrimary },
    "& .MuiInputLabel-root": { color: UI_COLORS.textSecondary },
};

const selectSx = {
    color: UI_COLORS.textPrimary,
    fontSize: "0.75rem",
    bgcolor: "rgba(8,8,14,0.55)",
    "& .MuiSelect-select": { py: "8px", px: "10px", color: UI_COLORS.textPrimary },
    "& .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.border },
    "& .MuiSvgIcon-root": { color: UI_COLORS.textSecondary },
};

export default function ItemDraftPanel({
    draft,
    onChange,
    uploadingImage = false,
    showEquip = true,
    abilityOptions = [],
    traitOptions = [],
}) {
    const patch = (partial) => onChange?.(partial);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.2 }}>
            <TextField
                size="small"
                label="Nombre"
                value={draft.name || ""}
                onChange={(e) => patch({ name: e.target.value })}
                sx={fieldSx}
            />
            <Select
                size="small"
                value={draft.type || ITEM_TYPES.JUNK}
                onChange={(e) => patch({ type: e.target.value })}
                sx={selectSx}
                MenuProps={{ PaperProps: { sx: cyberMenuPaperSx } }}
            >
                {Object.values(ITEM_TYPES).map((t) => (
                    <MenuItem key={t} value={t} sx={cyberMenuItemSx}>
                        {ITEM_TYPE_META[t].label}
                    </MenuItem>
                ))}
            </Select>
            <Select
                size="small"
                value={draft.rarity || ITEM_RARITY.COMMON}
                onChange={(e) => patch({ rarity: e.target.value })}
                sx={selectSx}
                MenuProps={{ PaperProps: { sx: cyberMenuPaperSx } }}
            >
                {Object.values(ITEM_RARITY).map((r) => (
                    <MenuItem key={r} value={r} sx={cyberMenuItemSx}>
                        {ITEM_RARITY_META[r].label}
                    </MenuItem>
                ))}
            </Select>
            <TextField
                size="small"
                label="Qué hace"
                multiline
                minRows={2}
                value={draft.description || ""}
                onChange={(e) => patch({ description: e.target.value })}
                sx={fieldSx}
            />
            <TextField
                size="small"
                label="Cantidad (opcional)"
                value={draft.qty ?? ""}
                onChange={(e) => {
                    const n = Number(e.target.value);
                    patch({ qty: Number.isFinite(n) && n > 0 ? Math.floor(n) : null });
                }}
                sx={fieldSx}
            />
            <ItemEffectFields
                effect={draft.effect}
                onChange={(effect) => patch({ effect })}
                abilityOptions={abilityOptions}
                traitOptions={traitOptions}
            />
            {showEquip ? (
                <ItemEquipFields
                    equipable={Boolean(draft.equipable)}
                    equipSlots={draft.equipSlots}
                    imageFile={draft._imageFile}
                    imageUrl={draft.imageUrl}
                    uploading={uploadingImage}
                    onChange={patch}
                />
            ) : null}
        </Box>
    );
}
