import { useMemo, useState } from "react";
import { Box, TextField } from "@mui/material";
import { CyberText, CyberTitle } from "../../customs/CustomTexts";
import { UI_COLORS } from "../../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../../constants/cyberScrollStyle";
import { isPlaced } from "../../../utils/briefcaseGrid";
import { ITEM_EQUIP_NODE_META, isEquipped, itemTypeMeta } from "../../../utils/campaignItems";
import ItemSilhouette from "./itemSilhouette";

const GOLD = UI_COLORS.loot;

const fieldSx = {
    "& .MuiOutlinedInput-root": {
        color: UI_COLORS.textPrimary,
        fontFamily: '"Fira Sans", sans-serif',
        fontSize: "0.75rem",
        bgcolor: "rgba(8,8,14,0.55)",
        "& fieldset": { borderColor: UI_COLORS.border },
        "&:hover fieldset": { borderColor: `${GOLD}66` },
        "&.Mui-focused fieldset": { borderColor: GOLD },
    },
    "& .MuiInputBase-input": { color: UI_COLORS.textPrimary },
    "& .MuiInputLabel-root": { color: UI_COLORS.textSecondary },
};

export default function ItemCatalogList({
    items = [],
    selectedId = null,
    onSelect,
    onPickup,
    canDrag = false,
    emptyHint = "Sin objetos.",
}) {
    const [q, setQ] = useState("");

    const filtered = useMemo(() => {
        const needle = q.trim().toLowerCase();
        const list = items || [];
        if (!needle) return list;
        return list.filter((it) => {
            const type = itemTypeMeta(it.type);
            return (
                String(it.name || "").toLowerCase().includes(needle)
                || type.label.toLowerCase().includes(needle)
                || String(it.type || "").toLowerCase().includes(needle)
                || String(it.description || "").toLowerCase().includes(needle)
            );
        });
    }, [items, q]);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
            <CyberTitle sx={{ fontSize: "11px", letterSpacing: "0.14em", color: UI_COLORS.anomaly, mb: 0.8 }}>
                OBJETOS · {filtered.length}/{items.length}
            </CyberTitle>
            <TextField
                size="small"
                label="Buscar"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                sx={{ ...fieldSx, mb: 1 }}
            />
            <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", ...CYBER_SCROLL_STYLE }}>
                {filtered.length === 0 ? (
                    <CyberText sx={{ fontSize: "12px", color: UI_COLORS.textSecondary }}>
                        {items.length === 0 ? emptyHint : "Nada coincide con la búsqueda."}
                    </CyberText>
                ) : filtered.map((it) => {
                    const m = itemTypeMeta(it.type);
                    const placed = isPlaced(it);
                    const equipped = isEquipped(it);
                    const active = selectedId === it.id;
                    return (
                        <Box
                            key={it.id}
                            onClick={() => onSelect?.(it.id)}
                            onPointerDown={(e) => {
                                if (e.button !== 0 || (placed && !equipped) || !canDrag) return;
                                onPickup?.(it);
                            }}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 0.8,
                                border: `1px solid ${active ? GOLD : UI_COLORS.border}`,
                                p: 0.7,
                                mb: 0.7,
                                cursor: (!placed || equipped) && canDrag ? "grab" : "pointer",
                                bgcolor: active ? `${GOLD}14` : "transparent",
                                "&:hover": { borderColor: GOLD },
                            }}
                        >
                            <ItemSilhouette item={it} cellSize={11} />
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                                <CyberText sx={{ fontSize: "12px", color: UI_COLORS.textPrimary }}>
                                    {it.name || "Objeto"}
                                </CyberText>
                                <CyberText sx={{ fontSize: "10px", color: m.color }}>
                                    {m.label}
                                    {equipped
                                        ? ` · ${ITEM_EQUIP_NODE_META[it.equippedSlot]?.label || "EQUIPADO"}`
                                        : placed ? "" : " · STASH"}
                                </CyberText>
                            </Box>
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
}
