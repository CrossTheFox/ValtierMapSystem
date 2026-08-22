import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Popover } from "@mui/material";
import { UI_COLORS } from "../../../constants/uiColors";
import { hudPopoverPaperSx } from "../../../constants/designSystem";
import { CyberText, CyberTitle } from "../../customs/CustomTexts";
import {
    canPlace,
    isPlaced,
    liveMask,
    maskCells,
    occupancyMap,
    rotateItem,
    tryRotatePlaced,
    worldCells,
} from "../../../utils/briefcaseGrid";
import {
    isEquipped,
    itemOutlineColor,
    itemRarityMeta,
    itemTypeMeta,
} from "../../../utils/campaignItems";
import { formatItemEffectChip } from "../../../utils/characterItemEffects";
import { itemTypeSvg } from "./itemIcons";

const CELL = 42;
const GOLD_SAFE = UI_COLORS.loot;

function pointerCell(gridEl, cols, rows, clientX, clientY) {
    const rect = gridEl.getBoundingClientRect();
    const x = Math.floor(((clientX - rect.left) / rect.width) * cols);
    const y = Math.floor(((clientY - rect.top) / rect.height) * rows);
    return {
        x,
        y,
        inside: x >= 0 && y >= 0 && x < cols && y < rows,
    };
}

function edgeInset(outline, n, s, w, e) {
    const parts = [];
    if (!n) parts.push(`inset 0 2px 0 ${outline}`);
    if (!s) parts.push(`inset 0 -2px 0 ${outline}`);
    if (!w) parts.push(`inset 2px 0 0 ${outline}`);
    if (!e) parts.push(`inset -2px 0 0 ${outline}`);
    return parts.join(", ");
}

function BriefcaseGrid({
    cols,
    rows,
    items = [],
    cellSize = CELL,
    canDrag = true,
    canDraw = false,
    drawing = false,
    paintCells = [],
    onPaintApply,
    onCommitPlace,
    onUnplace,
    seedHeld = null,
    onHeldChange,
    onDropEquip,
    selectedId = null,
    onSelect,
    frame = null,
}) {
    const gridRef = useRef(null);
    const [localHeld, setLocalHeld] = useState(null);
    const [ghost, setGhost] = useState(null);
    const [hover, setHover] = useState({ id: null, anchor: null });
    const pickPtr = useRef({ x: 0, y: 0 });
    const pendingPick = useRef(null);
    const paintStroke = useRef(null);
    const itemsRef = useRef(items);
    itemsRef.current = items;
    const drawingRef = useRef(drawing);
    drawingRef.current = drawing;
    const onSelectRef = useRef(onSelect);
    onSelectRef.current = onSelect;
    const onDropEquipRef = useRef(onDropEquip);
    onDropEquipRef.current = onDropEquip;
    const cursorRef = useRef(null);

    useEffect(() => {
        if (seedHeld) setLocalHeld(seedHeld);
    }, [seedHeld]);

    const held = localHeld;
    const visible = useMemo(
        () => (items || []).filter((it) => isPlaced(it) && !isEquipped(it) && it.id !== held?.id),
        [items, held],
    );

    const occKeys = useMemo(() => occupancyMap(items), [items]);

    const onPiecePointer = useCallback((item, cellX, cellY, ev) => {
        if (drawingRef.current) return;
        onSelectRef.current?.(item.id);
        pendingPick.current = {
            item,
            cellX,
            cellY,
            cx: ev.clientX,
            cy: ev.clientY,
        };
    }, []);

    const pickup = useCallback((item, cellX, cellY, clientX, clientY) => {
        if (!canDrag || drawing) return;
        pickPtr.current = { x: clientX, y: clientY };
        const next = {
            ...item,
            _grab: { dx: cellX - item.gx, dy: cellY - item.gy },
            placed: false,
        };
        setLocalHeld(next);
        onHeldChange?.(next);
        setHover({ id: null, anchor: null });
    }, [canDrag, drawing, onHeldChange]);

    const rotateHeld = useCallback((dir = 1) => {
        setLocalHeld((cur) => (cur ? rotateItem(cur, dir) : cur));
    }, []);

    const ghostRef = useRef(ghost);
    ghostRef.current = ghost;
    const heldRef = useRef(held);
    heldRef.current = held;

    useEffect(() => {
        if (!held) return undefined;
        let raf = 0;
        let last = null;
        const applyGhost = () => {
            raf = 0;
            const e = last;
            if (!e || !gridRef.current || !heldRef.current) return;
            const { x, y, inside } = pointerCell(gridRef.current, cols, rows, e.clientX, e.clientY);
            if (!inside) {
                setGhost((g) => (g?.cells?.length ? { valid: false, ox: null, oy: null, cells: [] } : g));
                return;
            }
            const grab = heldRef.current._grab || { dx: 0, dy: 0 };
            const ox = x - grab.dx;
            const oy = y - grab.dy;
            const occ = occupancyMap(itemsRef.current, heldRef.current.id);
            const valid = canPlace(heldRef.current, ox, oy, cols, rows, occ);
            const cells = worldCells(heldRef.current, ox, oy);
            setGhost((prev) => {
                if (prev && prev.valid === valid && prev.ox === ox && prev.oy === oy) return prev;
                return { valid, ox, oy, cells };
            });
        };
        const onMove = (e) => {
            last = e;
            if (cursorRef.current) {
                cursorRef.current.style.transform = `translate(${e.clientX + 10}px, ${e.clientY + 10}px)`;
            }
            if (!raf) raf = requestAnimationFrame(applyGhost);
        };
        const onUp = (e) => {
            if (e.button !== 0 || !heldRef.current) return;
            const cur = heldRef.current;
            const nodeEl = document.elementFromPoint(e.clientX, e.clientY)?.closest?.("[data-equip-node]");
            const nodeId = nodeEl?.getAttribute?.("data-equip-node");
            if (nodeId && onDropEquipRef.current?.(cur, nodeId)) {
                setLocalHeld(null);
                setGhost(null);
                onHeldChange?.(null);
                return;
            }
            const g = ghostRef.current;
            const dist = Math.hypot(e.clientX - pickPtr.current.x, e.clientY - pickPtr.current.y);
            const over = g && Number.isInteger(g.ox);
            if (over && g.valid) {
                onCommitPlace?.(cur.id, { gx: g.ox, gy: g.oy, rot: cur.rot || 0 });
            } else if (!over && dist >= 12) {
                onUnplace?.(cur.id);
            }
            setLocalHeld(null);
            setGhost(null);
            onHeldChange?.(null);
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        return () => {
            if (raf) cancelAnimationFrame(raf);
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
        };
    }, [held, cols, rows, onCommitPlace, onUnplace, onHeldChange]);

    useEffect(() => {
        if (!drawing || !canDraw) return undefined;
        const onMove = (e) => {
            if (!paintStroke.current || !gridRef.current) return;
            const { x, y, inside } = pointerCell(gridRef.current, cols, rows, e.clientX, e.clientY);
            if (!inside) return;
            if (occKeys.has(`${x},${y}`)) return;
            const key = `${x},${y}`;
            if (paintStroke.current.last === key) return;
            paintStroke.current.last = key;
            onPaintApply?.({ x, y, add: paintStroke.current.add });
        };
        const onUp = () => { paintStroke.current = null; };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        return () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
        };
    }, [drawing, canDraw, cols, rows, occKeys, onPaintApply]);

    useEffect(() => {
        const onMove = (e) => {
            const p = pendingPick.current;
            if (!p) return;
            const dist = Math.hypot(e.clientX - p.cx, e.clientY - p.cy);
            if (dist < 8) return;
            pendingPick.current = null;
            pickup(p.item, p.cellX, p.cellY, p.cx, p.cy);
        };
        const onUp = () => { pendingPick.current = null; };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        return () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
        };
    }, [pickup]);

    const onKey = (e) => {
        if (e.key === "r" || e.key === "R") {
            if (held) {
                rotateHeld(e.shiftKey ? -1 : 1);
                return;
            }
            const id = hover.id || selectedId;
            const hovered = items.find((it) => it.id === id && isPlaced(it));
            if (hovered && canDrag) {
                const next = tryRotatePlaced(hovered, e.shiftKey ? -1 : 1, cols, rows, items);
                if (next !== hovered) onCommitPlace?.(hovered.id, { gx: next.gx, gy: next.gy, rot: next.rot });
            }
        }
        if (e.key === "Escape" && held) {
            setLocalHeld(null);
            setGhost(null);
            onHeldChange?.(null);
        }
    };

    const onGridPointerDown = (e) => {
        if (e.target?.closest?.("[data-item-cell]")) return;
        if (drawing && canDraw && e.button === 0) {
            e.preventDefault();
            e.stopPropagation();
            if (!gridRef.current) return;
            const { x, y, inside } = pointerCell(gridRef.current, cols, rows, e.clientX, e.clientY);
            if (!inside || occKeys.has(`${x},${y}`)) return;
            const paintSet = new Set((paintCells || []).map((c) => `${c.x},${c.y}`));
            const add = !paintSet.has(`${x},${y}`);
            paintStroke.current = { add, last: `${x},${y}` };
            onPaintApply?.({ x, y, add });
            return;
        }
        if (!drawing && e.button === 0) onSelect?.(null);
    };

    const hoverItem = items.find((it) => it.id === hover.id);
    const frameBox = frame && frame.cols > 0 && frame.rows > 0 ? frame : null;
    const w = cols * cellSize;
    const h = rows * cellSize;

    return (
        <Box
            tabIndex={0}
            onKeyDown={onKey}
            onContextMenu={(e) => {
                if (!held && !hover.id) return;
                e.preventDefault();
                if (held) rotateHeld(1);
            }}
            sx={{ outline: "none", flexShrink: 0 }}
        >
            {held ? (
                <Box
                    ref={cursorRef}
                    sx={{
                        position: "fixed",
                        left: 0,
                        top: 0,
                        zIndex: 2400,
                        pointerEvents: "none",
                        px: 0.8,
                        py: 0.4,
                        bgcolor: "rgba(8,8,14,0.92)",
                        border: `1px solid ${UI_COLORS.loot}`,
                        fontFamily: "'Orbitron', sans-serif",
                        fontSize: "9px",
                        letterSpacing: "0.1em",
                        color: UI_COLORS.loot,
                    }}
                >
                    {held.name || "OBJETO"}
                </Box>
            ) : null}
            <Box
                sx={{
                    position: "relative",
                    width: w,
                    height: h,
                    boxSizing: "content-box",
                }}
            >
                <Box
                    ref={gridRef}
                    data-briefcase-grid=""
                    onPointerDown={onGridPointerDown}
                    sx={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        width: w,
                        height: h,
                        boxSizing: "border-box",
                        bgcolor: "#0b0b11",
                        backgroundImage: `
                            linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)
                        `,
                        backgroundSize: `${cellSize}px ${cellSize}px`,
                        backgroundPosition: "0 0",
                        boxShadow: `inset 0 0 0 1px ${UI_COLORS.border}`,
                        cursor: drawing && canDraw ? "crosshair" : "default",
                    }}
                />
                {frameBox ? (
                    <>
                        <Box
                            sx={{
                                position: "absolute",
                                left: frameBox.cols * cellSize,
                                top: 0,
                                width: Math.max(0, (cols - frameBox.cols) * cellSize),
                                height: h,
                                bgcolor: "rgba(0,0,0,0.28)",
                                pointerEvents: "none",
                            }}
                        />
                        <Box
                            sx={{
                                position: "absolute",
                                left: 0,
                                top: frameBox.rows * cellSize,
                                width: frameBox.cols * cellSize,
                                height: Math.max(0, (rows - frameBox.rows) * cellSize),
                                bgcolor: "rgba(0,0,0,0.28)",
                                pointerEvents: "none",
                            }}
                        />
                        <Box
                            sx={{
                                position: "absolute",
                                left: 0,
                                top: 0,
                                width: frameBox.cols * cellSize,
                                height: frameBox.rows * cellSize,
                                pointerEvents: "none",
                                boxShadow: `inset 0 0 0 2px ${UI_COLORS.loot}, 0 0 18px ${UI_COLORS.loot}22`,
                            }}
                        >
                            <CyberTitle
                                sx={{
                                    position: "absolute",
                                    left: 6,
                                    top: -16,
                                    fontSize: "9px",
                                    letterSpacing: "0.14em",
                                    color: GOLD_SAFE,
                                    bgcolor: "#07070c",
                                    px: 0.5,
                                }}
                            >
                                {frameBox.label || `MALETÍN ${frameBox.cols}×${frameBox.rows}`}
                            </CyberTitle>
                        </Box>
                    </>
                ) : null}
                <PaintLayer cells={paintCells} cellSize={cellSize} />
                <GhostLayer ghost={ghost} cellSize={cellSize} />
                <Box sx={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                    {visible.map((it) => (
                        <Piece
                            key={it.id}
                            item={it}
                            cellSize={cellSize}
                            selected={selectedId === it.id}
                            onPointerCell={onPiecePointer}
                            onHover={setHover}
                        />
                    ))}
                </Box>
            </Box>
            <Popover
                open={Boolean(hoverItem && hover.anchor && !held)}
                anchorEl={hover.anchor}
                onClose={() => setHover({ id: null, anchor: null })}
                anchorOrigin={{ vertical: "top", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "left" }}
                disableRestoreFocus
                sx={{ pointerEvents: "none" }}
                slotProps={{ paper: { sx: { ...hudPopoverPaperSx, p: 1.2, minWidth: 180, pointerEvents: "none" } } }}
            >
                {hoverItem ? <ItemHoverCard item={hoverItem} /> : null}
            </Popover>
        </Box>
    );
}

const PaintLayer = memo(function PaintLayer({ cells, cellSize }) {
    if (!cells?.length) return null;
    return (
        <Box sx={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            {cells.map((c) => (
                <Box
                    key={`${c.x},${c.y}`}
                    sx={{
                        position: "absolute",
                        left: c.x * cellSize,
                        top: c.y * cellSize,
                        width: cellSize,
                        height: cellSize,
                        bgcolor: `${UI_COLORS.loot}40`,
                        boxShadow: `inset 0 0 0 1px ${UI_COLORS.loot}`,
                    }}
                />
            ))}
        </Box>
    );
});

const GhostLayer = memo(function GhostLayer({ ghost, cellSize }) {
    if (!ghost?.cells?.length) return null;
    const color = ghost.valid ? UI_COLORS.anomaly : UI_COLORS.danger;
    return (
        <Box sx={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            {ghost.cells.map((c) => (
                <Box
                    key={`${c.x},${c.y}`}
                    sx={{
                        position: "absolute",
                        left: c.x * cellSize,
                        top: c.y * cellSize,
                        width: cellSize,
                        height: cellSize,
                        bgcolor: ghost.valid ? "rgba(0,242,234,0.16)" : "rgba(255,51,85,0.2)",
                        boxShadow: `inset 0 0 0 1px ${color}`,
                    }}
                />
            ))}
        </Box>
    );
});

const Piece = memo(function Piece({ item, cellSize, selected, onPointerCell, onHover }) {
    const mask = liveMask(item);
    const cells = maskCells(mask);
    const set = new Set(cells.map((c) => `${c.x},${c.y}`));
    const fill = itemTypeMeta(item.type).color;
    const outline = selected ? UI_COLORS.loot : itemOutlineColor(item.id);
    const icon = itemTypeSvg(item.type);
    const glyph = Math.max(12, Math.round(cellSize * 0.48));

    return (
        <Box
            sx={{
                position: "absolute",
                left: item.gx * cellSize,
                top: item.gy * cellSize,
                width: (mask[0]?.length || 1) * cellSize,
                height: mask.length * cellSize,
                pointerEvents: "none",
            }}
        >
            {cells.map((c, i) => {
                const n = set.has(`${c.x},${c.y - 1}`);
                const s = set.has(`${c.x},${c.y + 1}`);
                const w = set.has(`${c.x - 1},${c.y}`);
                const e = set.has(`${c.x + 1},${c.y}`);
                return (
                    <Box
                        key={`${c.x},${c.y}`}
                        onPointerDown={(ev) => {
                            if (ev.button !== 0) return;
                            ev.preventDefault();
                            ev.stopPropagation();
                            onPointerCell?.(item, item.gx + c.x, item.gy + c.y, ev);
                        }}
                        data-item-cell=""
                        onMouseEnter={(ev) => onHover?.({ id: item.id, anchor: ev.currentTarget })}
                        onMouseLeave={() => onHover?.({ id: null, anchor: null })}
                        sx={{
                            position: "absolute",
                            left: c.x * cellSize,
                            top: c.y * cellSize,
                            width: cellSize,
                            height: cellSize,
                            boxSizing: "border-box",
                            pointerEvents: "auto",
                            cursor: "grab",
                            display: "grid",
                            placeItems: "center",
                            bgcolor: `color-mix(in srgb, ${fill} 38%, #121018)`,
                            boxShadow: edgeInset(outline, n, s, w, e),
                            "& svg": { width: glyph, height: glyph, display: "block", pointerEvents: "none" },
                        }}
                    >
                        <Box
                            component="span"
                            sx={{ display: "grid", placeItems: "center", pointerEvents: "none", lineHeight: 0 }}
                            dangerouslySetInnerHTML={{ __html: icon }}
                        />
                        {item.qty != null && i === cells.length - 1 ? (
                            <Box
                                component="span"
                                sx={{
                                    position: "absolute",
                                    right: 3,
                                    bottom: 2,
                                    fontFamily: "'Fira Code', monospace",
                                    fontSize: "10px",
                                    color: "#fff",
                                    pointerEvents: "none",
                                }}
                            >
                                {item.qty}
                            </Box>
                        ) : null}
                    </Box>
                );
            })}
        </Box>
    );
});

function ItemHoverCard({ item }) {
    const type = itemTypeMeta(item.type);
    const rarity = itemRarityMeta(item.rarity);
    const chip = formatItemEffectChip(item.effect);
    return (
        <Box>
            <CyberTitle sx={{ fontSize: "11px", letterSpacing: "0.12em", color: UI_COLORS.loot, mb: 0.4 }}>
                {item.name || "SIN NOMBRE"}
            </CyberTitle>
            <CyberText sx={{ fontSize: "11px", color: UI_COLORS.textPrimary }}>
                <Box component="span" sx={{ color: type.color }}>{type.label}</Box>
                {" · "}
                <Box component="span" sx={{ color: rarity.color }}>{rarity.label}</Box>
                {item.qty != null ? ` · ×${item.qty}` : ""}
            </CyberText>
            {item.description ? (
                <CyberText sx={{ fontSize: "11px", color: UI_COLORS.textSecondary, mt: 0.6, lineHeight: 1.4 }}>
                    {item.description}
                </CyberText>
            ) : null}
            {chip ? (
                <Box
                    sx={{
                        mt: 0.7,
                        display: "inline-block",
                        border: `1px solid ${UI_COLORS.boon}66`,
                        color: UI_COLORS.boon,
                        fontFamily: "'Fira Code', monospace",
                        fontSize: "10px",
                        px: 0.7,
                        py: 0.2,
                    }}
                >
                    {chip}
                </Box>
            ) : null}
        </Box>
    );
}

export default memo(BriefcaseGrid);
