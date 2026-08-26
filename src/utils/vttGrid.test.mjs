import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    VTT_GRID,
    vttColPx,
    vttSpanPx,
    vttGapPx,
    vttHudRects,
    vttHudIslandsClear,
} from "./vttGrid.js";

const INSET = 16;

describe("VTT 12-col grid", () => {
    it("combat / macros / chat are exact 3 / 4 / 2.5 columns at 1920", () => {
        const col = vttColPx(1920, INSET);
        assert.equal(VTT_GRID.combatSpan, 3);
        assert.equal(VTT_GRID.macrosSpan, 4);
        assert.equal(VTT_GRID.chatSpan, 2.5);
        assert.equal(vttSpanPx(3, 1920, INSET), col * 3);
        assert.equal(vttSpanPx(4, 1920, INSET), col * 4);
        assert.equal(vttSpanPx(2.5, 1920, INSET), col * 2.5);
        assert.equal((1920 - INSET * 2) * 3 / 12, 472);
        assert.equal((1920 - INSET * 2) * 2.5 / 12, 393.3333333333333);
        const rects = vttHudRects(1920, INSET);
        assert.equal(rects.combat.width, 472);
        assert.equal(rects.chat.width, col * 2.5);
        assert.equal(rects.macros.width, (1920 - 32) * 4 / 12);
    });

    it("keeps chat at 2.5 columns on every viewport", () => {
        for (const vw of [1280, 1920, 2560, 3840]) {
            assert.equal(vttHudRects(vw, INSET).chat.width, vttSpanPx(2.5, vw, INSET));
        }
    });

    it("scales spans the same on a non-1920 viewport", () => {
        assert.equal(vttSpanPx(3, 1280, INSET), (1280 - 32) / 12 * 3);
        assert.equal(vttSpanPx(4, 1536, INSET), (1536 - 32) / 12 * 4);
        assert.equal(vttSpanPx(2.5, 2560, INSET), (2560 - 32) / 12 * 2.5);
    });

    it("uses a 0.5vw screen-level gap", () => {
        assert.equal(VTT_GRID.gapVw, 0.5);
        assert.equal(vttGapPx(1920), 9.6);
        assert.equal(vttGapPx(1280), 6.4);
    });

    it("keeps combat, centered macros, and chat from overlapping at common widths", () => {
        for (const vw of [1280, 1536, 1920, 2560, 3840]) {
            const clear = vttHudIslandsClear(vw, INSET);
            const rects = vttHudRects(vw, INSET);
            assert.equal(rects.macros.left, (vw - rects.macros.width) / 2);
            assert.ok(clear.ok, `overlap at ${vw}: combat→macros ${clear.combatToMacros}, macros→chat ${clear.macrosToChat}`);
            assert.ok(clear.combatToMacros >= rects.gap);
            assert.ok(clear.macrosToChat >= rects.gap);
        }
    });
});
