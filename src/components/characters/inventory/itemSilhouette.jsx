import { Box } from "@mui/material";
import { liveMask, maskCells } from "../../../utils/briefcaseGrid";
import { itemOutlineColor, itemTypeMeta } from "../../../utils/campaignItems";
import { itemTypeSvg } from "./itemIcons";

/** Mini tetris silhouette — stash, inspector, chat cards. */
export default function ItemSilhouette({ item, cells, cellSize = 14, type, itemId }) {
    const mask = item ? liveMask(item) : null;
    const list = cells || (mask ? maskCells(mask) : []);
    if (!list.length) return null;
    const w = Math.max(...list.map((c) => c.x)) + 1;
    const h = Math.max(...list.map((c) => c.y)) + 1;
    const set = new Set(list.map((c) => `${c.x},${c.y}`));
    const fill = itemTypeMeta(type || item?.type).color;
    const outline = itemOutlineColor(itemId || item?.id);

    return (
        <Box
            sx={{
                position: "relative",
                width: w * cellSize,
                height: h * cellSize,
                flexShrink: 0,
            }}
        >
            {list.map((c) => (
                <Box
                    key={`${c.x},${c.y}`}
                    sx={{
                        position: "absolute",
                        left: c.x * cellSize,
                        top: c.y * cellSize,
                        width: cellSize,
                        height: cellSize,
                        display: "grid",
                        placeItems: "center",
                        boxSizing: "border-box",
                        bgcolor: `color-mix(in srgb, ${fill} 42%, #121018)`,
                        boxShadow: [
                            set.has(`${c.x},${c.y - 1}`) ? null : `inset 0 2px 0 ${outline}`,
                            set.has(`${c.x},${c.y + 1}`) ? null : `inset 0 -2px 0 ${outline}`,
                            set.has(`${c.x - 1},${c.y}`) ? null : `inset 2px 0 0 ${outline}`,
                            set.has(`${c.x + 1},${c.y}`) ? null : `inset -2px 0 0 ${outline}`,
                        ].filter(Boolean).join(", "),
                        "& svg": { width: Math.max(9, cellSize - 4), height: Math.max(9, cellSize - 4), display: "block" },
                    }}
                    dangerouslySetInnerHTML={{ __html: itemTypeSvg(type || item?.type) }}
                />
            ))}
        </Box>
    );
}
