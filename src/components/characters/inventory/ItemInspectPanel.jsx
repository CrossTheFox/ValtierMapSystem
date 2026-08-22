import { Box, Button } from "@mui/material";
import { CyberText, CyberTitle } from "../../customs/CustomTexts";
import { UI_COLORS } from "../../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../../constants/cyberScrollStyle";
import {
    ITEM_EQUIP_NODE_META,
    isEquipped,
    itemRarityMeta,
    itemTypeMeta,
} from "../../../utils/campaignItems";
import { formatItemEffectChip } from "../../../utils/characterItemEffects";
import { isPlaced, liveMask, maskCells } from "../../../utils/briefcaseGrid";
import ItemEquipFields from "./ItemEquipFields";
import ItemSilhouette from "./itemSilhouette";

const GOLD = UI_COLORS.loot;

const btnSx = (color) => ({
    fontFamily: "'Orbitron', sans-serif",
    fontSize: "10px",
    letterSpacing: "0.1em",
    color,
    border: `1px solid ${color}88`,
    minHeight: 28,
    "&:hover": { bgcolor: `${color}18` },
    "&.Mui-disabled": { color: `${color}55`, borderColor: `${color}33` },
});

export default function ItemInspectPanel({
    item,
    emptyHint,
    canCall = false,
    canDelete = false,
    calling = false,
    onCall,
    onDelete,
    onBack,
    hideActions = false,
    canUnequip = false,
    onUnequip,
    canEditEquip = false,
    onPatchEquip,
    children,
}) {
    if (!item) {
        return (
            <Box sx={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
                <CyberTitle sx={{ fontSize: "11px", letterSpacing: "0.14em", color: UI_COLORS.anomaly, mb: 1 }}>
                    FICHA
                </CyberTitle>
                <CyberText sx={{ fontSize: "12px", color: UI_COLORS.textSecondary, lineHeight: 1.5 }}>
                    {emptyHint || "Selecciona un objeto en el maletín para ver qué es y qué hace."}
                </CyberText>
                {children}
            </Box>
        );
    }

    const type = itemTypeMeta(item.type);
    const rarity = itemRarityMeta(item.rarity);
    const chip = formatItemEffectChip(item.effect);
    const cells = maskCells(liveMask(item));
    const placed = isPlaced(item);
    const equipped = isEquipped(item);
    const slotLabel = equipped ? (ITEM_EQUIP_NODE_META[item.equippedSlot]?.label || item.equippedSlot) : null;

    return (
        <Box sx={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1, gap: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                <CyberTitle sx={{ fontSize: "11px", letterSpacing: "0.14em", color: GOLD }}>
                    OBJETO
                </CyberTitle>
                {!hideActions && onBack ? (
                    <Button onClick={onBack} sx={{ ...btnSx(UI_COLORS.anomaly), minHeight: 22, px: 0.8 }}>
                        LISTA
                    </Button>
                ) : null}
            </Box>
            <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                <ItemSilhouette item={item} cellSize={16} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <CyberText sx={{ fontSize: "13px", fontWeight: 700, color: UI_COLORS.textPrimary, lineHeight: 1.3 }}>
                        {item.name || "SIN NOMBRE"}
                    </CyberText>
                    <CyberText sx={{ fontSize: "11px", color: type.color, mt: 0.2 }}>
                        {type.label}
                        <Box component="span" sx={{ color: rarity.color }}> · {rarity.label}</Box>
                        {item.qty != null ? ` · ×${item.qty}` : ""}
                    </CyberText>
                    <CyberText sx={{ fontSize: "10px", color: UI_COLORS.textSecondary, fontFamily: "'Fira Code', monospace" }}>
                        {cells.length} CELDA{cells.length === 1 ? "" : "S"}
                        {equipped ? ` · EQUIPADO ${slotLabel}` : placed ? ` · ${item.gx},${item.gy}` : " · STASH"}
                    </CyberText>
                </Box>
            </Box>

            <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", ...CYBER_SCROLL_STYLE }}>
                <CyberTitle sx={{ fontSize: "10px", letterSpacing: "0.12em", color: UI_COLORS.textSecondary, mb: 0.4 }}>
                    QUÉ ES
                </CyberTitle>
                <CyberText sx={{ fontSize: "12px", color: UI_COLORS.textPrimary, lineHeight: 1.5, mb: 1.2 }}>
                    {item.description?.trim() || "Sin descripción."}
                </CyberText>
                <CyberTitle sx={{ fontSize: "10px", letterSpacing: "0.12em", color: UI_COLORS.textSecondary, mb: 0.4 }}>
                    QUÉ HACE
                </CyberTitle>
                {chip ? (
                    <Box
                        sx={{
                            display: "inline-block",
                            border: `1px solid ${UI_COLORS.boon}66`,
                            color: UI_COLORS.boon,
                            fontFamily: "'Fira Code', monospace",
                            fontSize: "11px",
                            px: 0.8,
                            py: 0.35,
                            mb: 1,
                        }}
                    >
                        {chip}
                    </Box>
                ) : (
                    <CyberText sx={{ fontSize: "12px", color: UI_COLORS.textSecondary, lineHeight: 1.5 }}>
                        No altera stats ni otorga traits. Objeto de inventario.
                    </CyberText>
                )}
            </Box>

            {canEditEquip ? (
                <ItemEquipFields
                    equipable={Boolean(item.equipable)}
                    equipSlots={item.equipSlots}
                    imageUrl={item.imageUrl}
                    onChange={onPatchEquip}
                />
            ) : null}

            {!hideActions ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6 }}>
                {canUnequip ? (
                    <Button onClick={() => onUnequip?.(item)} sx={btnSx(UI_COLORS.anomaly)}>
                        QUITAR DEL NODO
                    </Button>
                ) : null}
                {canCall ? (
                    <Button disabled={calling} onClick={() => onCall?.(item)} sx={btnSx(GOLD)}>
                        {calling ? "ENVIANDO…" : "CALLEAR EN CHAT"}
                    </Button>
                ) : null}
                {canDelete ? (
                    <Button onClick={() => onDelete?.(item)} sx={btnSx(UI_COLORS.danger)}>
                        BORRAR
                    </Button>
                ) : null}
            </Box>
            ) : null}
            {children}
        </Box>
    );
}
