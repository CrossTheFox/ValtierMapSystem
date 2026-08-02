import { MAX_BATCH } from "./timing";

/** Cell 1–9 of a 3×3 screen grid (row-major). */
export function cellIndexRect(w, h, index1to9) {
    const col = (index1to9 - 1) % 3;
    const row = Math.floor((index1to9 - 1) / 3);
    const cw = w / 3;
    const ch = h / 3;
    return {
        x: col * cw,
        y: row * ch,
        w: cw,
        h: ch,
        cx: col * cw + cw / 2,
        cy: row * ch + ch / 2,
    };
}

export function halfSlot(cell, side) {
    if (side === "full") return { ...cell, full: true };
    const hw = cell.w / 2;
    if (side === "left") {
        return { x: cell.x, y: cell.y, w: hw, h: cell.h, cx: cell.x + hw / 2, cy: cell.cy, full: false };
    }
    return {
        x: cell.x + hw,
        y: cell.y,
        w: hw,
        h: cell.h,
        cx: cell.x + hw + hw / 2,
        cy: cell.cy,
        full: false,
    };
}

export function sameName(a, b) {
    return String(a || "").trim().toUpperCase() === String(b || "").trim().toUpperCase();
}

/**
 * Geometric slots L→R across cells 7–8–9.
 * n=1 → full cell 8 (true center).
 */
export function layoutSlots(w, h, n) {
    const count = Math.min(MAX_BATCH, Math.max(1, n));
    const c7 = cellIndexRect(w, h, 7);
    const c8 = cellIndexRect(w, h, 8);
    const c9 = cellIndexRect(w, h, 9);
    if (count === 1) return [halfSlot(c8, "full")];
    const pad = 10;
    const x0 = c7.x + pad;
    const totalW = c9.x + c9.w - c7.x - pad * 2;
    const slotW = totalW / count;
    return Array.from({ length: count }, (_, i) => ({
        x: x0 + i * slotW,
        y: c7.y,
        w: slotW,
        h: c7.h,
        cx: x0 + i * slotW + slotW / 2,
        cy: c7.cy,
        full: false,
    }));
}

export function centerSlotIndex(n) {
    return Math.floor((n - 1) / 2);
}

/** Shift strip so slots[centerIndex].cx lands on cell-8 center. */
export function alignSlotsToScreenCenter(w, h, slots, centerIndex) {
    if (!slots.length || centerIndex < 0 || centerIndex >= slots.length) return slots;
    if (slots.length === 1) return slots;
    const c8 = cellIndexRect(w, h, 8);
    const dx = c8.cx - slots[centerIndex].cx;
    if (Math.abs(dx) < 0.5) return slots;
    return slots.map((s) => ({
        ...s,
        x: s.x + dx,
        cx: s.cx + dx,
    }));
}

function matchViewer(roller, viewerKey) {
    if (!viewerKey || viewerKey === "__DM__") return false;
    if (roller.senderId && roller.senderId === viewerKey) return true;
    return sameName(roller.name, viewerKey);
}

/** Place viewer at center; others keep relative order around them. */
export function arrangeBatchCentered(batch, viewerKey) {
    const n = batch.length;
    if (!viewerKey || viewerKey === "__DM__" || n <= 1) return batch.slice();
    const vi = batch.findIndex((r) => matchViewer(r, viewerKey));
    if (vi < 0) return batch.slice();
    const me = batch[vi];
    const others = batch.filter((_, i) => i !== vi);
    const center = centerSlotIndex(n);
    const out = new Array(n);
    out[center] = me;
    let oi = 0;
    for (let i = 0; i < n; i++) {
        if (i === center) continue;
        out[i] = others[oi++];
    }
    return out;
}

export function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out.length ? out : [[]];
}

function slotRect(x, y, w, h, full = false) {
    return { x, y, w, h, cx: x + w / 2, cy: y + h / 2, full };
}

/**
 * Grid tray inside cell 8 (NdM lab · C GRID) — header + die slots + footer TOTAL.
 * Pure geometry; call once per reveal and cache on anim state.
 * @returns {{ tray, header, footer, slots: Array<{ slot, delay }> }}
 */
export function layoutGridStage(cell, n) {
    const count = Math.max(1, Math.floor(Number(n) || 1));
    const inset = 14;
    const tray = {
        x: cell.x + inset,
        y: cell.y + inset,
        w: cell.w - inset * 2,
        h: cell.h - inset * 2,
    };
    tray.cx = tray.x + tray.w / 2;
    tray.cy = tray.y + tray.h / 2;

    const headerH = 30;
    const footerH = count === 1 ? 48 : 56;
    const pad = count <= 2 ? 10 : 8;
    const body = {
        x: tray.x + pad,
        y: tray.y + headerH,
        w: tray.w - pad * 2,
        h: tray.h - headerH - footerH,
    };

    let cols;
    let rows;
    if (count === 1) {
        cols = 1;
        rows = 1;
    } else if (count === 2) {
        cols = 2;
        rows = 1;
    } else if (count === 3) {
        cols = 3;
        rows = 1;
    } else if (count === 4) {
        cols = 2;
        rows = 2;
    } else if (count <= 6) {
        cols = 3;
        rows = 2;
    } else {
        cols = 3;
        rows = Math.ceil(count / 3);
    }

    const gapX = count === 1 ? 0 : 8;
    const gapY = count === 1 ? 0 : 8;
    const slotW = (body.w - gapX * (cols - 1)) / cols;
    const slotH = (body.h - gapY * (rows - 1)) / rows;

    const slots = [];
    for (let i = 0; i < count; i++) {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const countInRow = Math.min(cols, count - r * cols);
        const rowW = countInRow * slotW + (countInRow - 1) * gapX;
        const x0 = body.x + (body.w - rowW) / 2;
        const x = x0 + c * (slotW + gapX);
        const y = body.y + r * (slotH + gapY);
        const innerPad = Math.min(6, slotW * 0.04);
        slots.push({
            slot: slotRect(
                x + innerPad,
                y + innerPad,
                slotW - innerPad * 2,
                slotH - innerPad * 2,
                count === 1,
            ),
            delay: 0,
        });
    }

    return {
        tray,
        header: { y: tray.y + 8 },
        footer: { cy: tray.y + tray.h - footerH / 2 },
        slots,
    };
}

/**
 * DM / unknown: chronological chunks of 6.
 * Player POV (viewerKey = senderId): their die in FIRST batch, centered.
 */
export function planBatches(rollerList, viewerKey) {
    const list = (rollerList || []).map((r) => {
        const sides = Math.max(2, Math.floor(Number(r.sides) || 20));
        return {
            name: r.name,
            senderId: r.senderId ?? null,
            sides,
            result: Math.min(sides, Math.max(1, Math.floor(Number(r.result) || 1))),
        };
    });
    if (!viewerKey || viewerKey === "__DM__") {
        return chunk(list, MAX_BATCH);
    }
    const vi = list.findIndex((r) => matchViewer(r, viewerKey));
    if (vi < 0) return chunk(list, MAX_BATCH);

    const me = list[vi];
    const others = list.filter((_, i) => i !== vi);
    const firstOthers = others.slice(0, MAX_BATCH - 1);
    const rest = others.slice(MAX_BATCH - 1);
    const first = arrangeBatchCentered([me, ...firstOthers], viewerKey);
    return [first, ...chunk(rest, MAX_BATCH)];
}

export { matchViewer };
