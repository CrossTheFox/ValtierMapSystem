/**
 * 12-column overlay grid for the main VTT screen (`/map`).
 * Spans are exact fractions of (viewport − 2×inset). Gap is 0.5vw between islands.
 * Inset matches `VTT_HUD.inset` (kept here so this module stays import-cycle free).
 */
export const VTT_GRID_INSET = 16;

export const VTT_GRID = {
    cols: 12,
    gapVw: 0.5,
    combatSpan: 3,
    macrosSpan: 4,
    /** Half-column allowed — chat is permanently 2.5 / 12 on every viewport. */
    chatSpan: 2.5,
};

export function vttContentWidth(viewportWidth, inset = VTT_GRID_INSET) {
    return Math.max(0, Number(viewportWidth) - inset * 2);
}

export function vttColPx(viewportWidth, inset = VTT_GRID_INSET) {
    return vttContentWidth(viewportWidth, inset) / VTT_GRID.cols;
}

export function vttSpanPx(span, viewportWidth, inset = VTT_GRID_INSET) {
    return vttColPx(viewportWidth, inset) * span;
}

export function vttGapPx(viewportWidth) {
    return (VTT_GRID.gapVw / 100) * Number(viewportWidth);
}

/** CSS width for a column span — scales on every viewport. */
export function vttSpanWidthCss(span) {
    return `calc((100vw - ${VTT_GRID_INSET * 2}px) * ${span} / ${VTT_GRID.cols})`;
}

export function vttGapCss() {
    return `${VTT_GRID.gapVw}vw`;
}

/**
 * Axis-aligned HUD islands used to assert they do not overlap.
 * Combat = 3 cols (left). Macros = 4 cols centered. Chat = 2.5 cols (right).
 */
export function vttHudRects(viewportWidth, inset = VTT_GRID_INSET) {
    const vw = Number(viewportWidth);
    const combatW = vttSpanPx(VTT_GRID.combatSpan, vw, inset);
    const macrosW = vttSpanPx(VTT_GRID.macrosSpan, vw, inset);
    const chatW = vttSpanPx(VTT_GRID.chatSpan, vw, inset);
    const gap = vttGapPx(vw);
    return {
        gap,
        combat: { left: inset, width: combatW, right: inset + combatW },
        macros: {
            left: (vw - macrosW) / 2,
            width: macrosW,
            right: (vw - macrosW) / 2 + macrosW,
        },
        chat: { left: vw - inset - chatW, width: chatW, right: vw - inset },
    };
}

export function vttHudIslandsClear(viewportWidth, inset = VTT_GRID_INSET) {
    const { gap, combat, macros, chat } = vttHudRects(viewportWidth, inset);
    const combatToMacros = macros.left - combat.right;
    const macrosToChat = chat.left - macros.right;
    return {
        combatToMacros,
        macrosToChat,
        ok: combatToMacros >= gap && macrosToChat >= gap,
    };
}
