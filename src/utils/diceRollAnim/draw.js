import {
    TIMING,
    MAX_SWARM,
    SWARM_DURATION,
    modeFromResult,
    durationForMode,
} from "./timing";
import {
    cellIndexRect,
    layoutSlots,
    matchViewer,
} from "./layout";

export const PINK = "#ff66ff";
export const CYAN = "#00f2ea";
export const GOLD = "#ffcc33";
export const FAIL = "#ff3355";

export const easeOut = (t) => 1 - (1 - t) ** 3;
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = (t) => Math.max(0, Math.min(1, t));

export function mix(a, b, t) {
    const parse = (h) => {
        const n = parseInt(h.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    const A = parse(a);
    const B = parse(b);
    const r = Math.round(lerp(A[0], B[0], t));
    const g = Math.round(lerp(A[1], B[1], t));
    const bl = Math.round(lerp(A[2], B[2], t));
    return `rgb(${r},${g},${bl})`;
}

export function softDim(ctx, w, h, a = 0.28) {
    ctx.fillStyle = `rgba(7,7,14,${a})`;
    ctx.fillRect(0, 0, w, h);
}

export function cellFocus(ctx, cell, accent, pulse = 0) {
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.35 + pulse * 0.25;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 8]);
    ctx.strokeRect(cell.x + 10, cell.y + 10, cell.w - 20, cell.h - 20);
    ctx.setLineDash([]);
    const m = 14;
    const arm = 16;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 2;
    [
        [cell.x + m, cell.y + m, arm, arm],
        [cell.x + cell.w - m, cell.y + m, -arm, arm],
        [cell.x + m, cell.y + cell.h - m, arm, -arm],
        [cell.x + cell.w - m, cell.y + cell.h - m, -arm, -arm],
    ].forEach(([x, y, dx, dy]) => {
        ctx.beginPath();
        ctx.moveTo(x + dx, y);
        ctx.lineTo(x, y);
        ctx.lineTo(x, y + dy);
        ctx.stroke();
    });
    ctx.restore();
}

export function drawHex(ctx, x, y, r, stroke, fill, rot = 0, lw = 2.5) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.shadowColor = stroke;
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.restore();
}

export function glowText(ctx, text, x, y, size, color) {
    ctx.save();
    ctx.font = `700 ${size}px Orbitron, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.fillStyle = color;
    ctx.fillText(String(text), x, y);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff";
    ctx.globalAlpha = 0.92;
    ctx.fillText(String(text), x, y);
    ctx.restore();
}

export function roundRectPath(ctx, x, y, w, h, rad) {
    const r = Math.min(rad, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

export function drawDieChip(ctx, x, y, r, label, value, accent, pulse = 0) {
    const rr = r * (1 + pulse * 0.05);
    ctx.save();
    ctx.translate(x, y);
    roundRectPath(ctx, -rr, -rr * 0.82, rr * 2, rr * 1.64, 7);
    ctx.fillStyle = "rgba(10,10,18,0.94)";
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.font = `600 ${Math.max(8, rr * 0.26)}px Orbitron, sans-serif`;
    ctx.fillStyle = CYAN;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 0, -rr * 0.4);
    ctx.font = `700 ${Math.max(14, rr * 0.68)}px Orbitron, sans-serif`;
    ctx.fillStyle = "#fff";
    ctx.shadowColor = accent;
    ctx.shadowBlur = 10;
    ctx.fillText(String(value), 0, rr * 0.2);
    ctx.restore();
}

/** Scramble that avoids spoiling final 1 / max until reveal. */
export function makeSuspenseScrambler(finalValue, mode, sides = 20) {
    let last = -1;
    let hold = 0;
    const s = Math.max(2, Math.floor(Number(sides) || 20));
    const pool = [];
    for (let i = 1; i <= s; i++) {
        if (mode === "fail" && i === 1) continue;
        if (mode === "crit" && i === s) continue;
        pool.push(i);
    }
    if (!pool.length) pool.push(Math.max(2, Math.min(s - 1, 2)));

    return (phase, t) => {
        if (phase === "reveal") return finalValue;
        const rate = phase === "scramble" ? 52 : 14;
        hold -= 1;
        if (hold <= 0) {
            let n;
            if (phase === "tension") {
                if (mode === "fail") {
                    const tease = [];
                    for (let i = 2; i <= Math.min(s, 12); i++) tease.push(i);
                    n = tease[Math.floor(Math.random() * tease.length)] || pool[0];
                } else if (mode === "crit") {
                    const lo = Math.max(2, s - 9);
                    const tease = [];
                    for (let i = lo; i < s; i++) tease.push(i);
                    n = tease[Math.floor(Math.random() * tease.length)] || pool[0];
                } else {
                    const spread = Math.max(1, Math.floor((1 - t) * Math.min(8, s / 2)));
                    n = Math.min(s, Math.max(1, finalValue + Math.round((Math.random() - 0.5) * 2 * spread)));
                }
            } else {
                do {
                    n = pool[Math.floor(Math.random() * pool.length)];
                } while (n === last && pool.length > 1);
            }
            last = n;
            hold = Math.max(1, Math.floor(60 / rate));
        }
        return last < 1 ? pool[0] : last;
    };
}

/**
 * Unified Decrypt → (lock | corrupt | halo) inside a slot.
 * @returns {boolean} done
 */
export function drawUnifiedDie(ctx, w, h, t, state, opts = {}) {
    const sides = Math.max(2, Math.floor(Number(opts.sides || opts.roller?.sides) || 20));
    const roller = opts.roller || { name: "", result: 8, sides };
    const result = Math.min(sides, Math.max(1, Math.floor(Number(roller.result) || 1)));
    const mode = opts.forceMode || modeFromResult(result, sides);
    const tm = opts.timing || TIMING[mode] || TIMING.normal;
    const tScrambleEnd = tm.scramble;
    const tTensionEnd = tm.scramble + tm.tension;
    const dur = tm.scramble + tm.tension + tm.reveal;

    if (!state.scramble) state.scramble = makeSuspenseScrambler(result, mode, sides);
    if (!state.glyphHold) state.glyphHold = 0;
    if (state.glyphIdx == null) state.glyphIdx = 0;

    const cell = opts.slot || layoutSlots(w, h, 1)[0];
    if (!opts.skipDim) softDim(ctx, w, h, 0.28);

    let phase = "scramble";
    if (t >= tTensionEnd) phase = "reveal";
    else if (t >= tScrambleEnd) phase = "tension";

    const revealT = clamp01((t - tTensionEnd) / Math.max(0.001, tm.reveal));
    const tensionT = clamp01((t - tScrambleEnd) / Math.max(0.001, tm.tension));
    const scrambleT = clamp01(t / Math.max(0.001, tm.scramble));

    let accent = CYAN;
    if (phase === "reveal") {
        if (mode === "fail") accent = mix(CYAN, FAIL, easeOut(Math.min(1, revealT * 1.4)));
        else if (mode === "crit") accent = mix(CYAN, GOLD, easeOut(Math.min(1, revealT * 1.2)));
        else accent = GOLD;
    } else if (phase === "tension") {
        accent = mix(CYAN, PINK, tensionT * 0.5);
    }
    if (opts.highlight) accent = mix(accent, CYAN, 0.55);

    cellFocus(ctx, cell, accent, 0.5 + 0.5 * Math.sin(t * 7));
    if (opts.highlight) {
        ctx.save();
        ctx.strokeStyle = CYAN;
        ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 8);
        ctx.lineWidth = 2.5;
        ctx.strokeRect(cell.x + 6, cell.y + 6, cell.w - 12, cell.h - 12);
        ctx.restore();
    }

    const cx = cell.cx;
    const cy = cell.cy + cell.h * (cell.full ? -0.02 : 0.02);
    const R = Math.min(
        cell.full ? 40 : 30,
        Math.min(cell.w, cell.h) * (cell.full ? 0.16 : 0.26),
    );

    const pw = R * 2.7;
    const ph = R * 3.0;
    roundRectPath(ctx, cx - pw / 2, cy - ph / 2, pw, ph, 10);
    ctx.fillStyle = "rgba(8,10,16,0.9)";
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (roller.name) {
        const label = String(roller.name).toUpperCase();
        const mine = Boolean(opts.highlight);
        const fontPx = cell.full ? 13 : mine ? 12 : 11;
        ctx.font = `700 ${fontPx}px Orbitron, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const metrics = ctx.measureText(label);
        const tw = Math.min(cell.w - 12, Math.max(pw * 0.95, metrics.width + (mine ? 28 : 22)));
        const th = fontPx + (mine ? 14 : 12);
        const ny = cy - ph / 2 - th * 0.55 - 4;
        const badgeAccent = mine ? CYAN : accent;
        roundRectPath(ctx, cx - tw / 2, ny - th / 2, tw, th, 6);
        ctx.fillStyle = mine ? "rgba(0,20,24,0.96)" : "rgba(4,6,12,0.94)";
        ctx.fill();
        ctx.strokeStyle = badgeAccent;
        ctx.lineWidth = mine ? 2.5 : 2;
        ctx.shadowColor = badgeAccent;
        ctx.shadowBlur = mine ? 22 : 16;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.shadowColor = badgeAccent;
        ctx.shadowBlur = 14;
        ctx.fillStyle = badgeAccent;
        ctx.fillText(label, cx, ny);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#ffffff";
        ctx.globalAlpha = 0.98;
        ctx.fillText(label, cx, ny);
        ctx.globalAlpha = 1;
        if (mine) {
            ctx.font = "600 7px Orbitron, sans-serif";
            ctx.fillStyle = CYAN;
            ctx.fillText("YOU", cx, ny + th * 0.55 + 6);
        }
        ctx.textBaseline = "alphabetic";
    }

    const failStorm = mode === "fail" && phase === "reveal" && revealT < 0.58;
    const failSettle = mode === "fail" && phase === "reveal" && revealT >= 0.58 && revealT < 0.78;
    const failLock = mode === "fail" && phase === "reveal" && revealT >= 0.78;
    const critBuild = mode === "crit" && phase === "reveal" && revealT < 0.35;
    const critSurge = mode === "crit" && phase === "reveal" && revealT >= 0.35 && revealT < 0.65;
    const critHold = mode === "crit" && phase === "reveal" && revealT >= 0.65;

    ctx.font = "600 9px Fira Code, monospace";
    ctx.fillStyle = accent;
    ctx.textAlign = "center";
    ctx.globalAlpha = 0.9;
    let status = "DECRYPTING…";
    if (phase === "tension") status = "COMMITTING…";
    else if (phase === "reveal") {
        if (mode === "fail") {
            status = failLock ? "FATAL // LOCKED" : failSettle ? "CORRUPT // SETTLE…" : "CORRUPT // GLITCH";
        } else if (mode === "crit") {
            status = critHold ? "PERFECT // HALO" : critSurge ? "OVERCLOCK // SURGE" : "ASCENDING…";
        } else status = "DECRYPT_OK";
    }
    ctx.fillText(status, cx, cy - R - 20);
    ctx.globalAlpha = 1;

    const shown = state.scramble(phase, scrambleT);
    let rot = 0;
    let hexStroke = phase === "reveal" && mode === "normal" ? GOLD : mix(PINK, accent, phase === "scramble" ? 0 : 0.5);
    let hexFill = "rgba(12,10,18,0.95)";
    const numberSize = R * 0.95;

    if (phase === "scramble" || phase === "tension") {
        rot = Math.sin(t * (phase === "tension" ? 8 : 14)) * (phase === "tension" ? 0.06 : 0.12);
        ctx.font = "600 10px Fira Code, monospace";
        ctx.textAlign = "center";
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + t * 2.2;
            const rr = R + 18;
            ctx.globalAlpha = 0.12 + (i % 3) * 0.06;
            ctx.fillStyle = i % 2 ? PINK : CYAN;
            ctx.fillText(
                String(1 + Math.floor(Math.random() * sides)),
                cx + Math.cos(a) * rr * 0.5,
                cy + Math.sin(a) * rr * 0.35,
            );
        }
        ctx.globalAlpha = 1;

        const j = phase === "tension" ? 1.5 : 3.5;
        const jx = (Math.random() - 0.5) * j;
        const jy = (Math.random() - 0.5) * j;
        ctx.globalAlpha = 0.4;
        glowText(ctx, shown, cx + jx - 2, cy + jy, numberSize, CYAN);
        glowText(ctx, shown, cx + jx + 2, cy + jy, numberSize, PINK);
        ctx.globalAlpha = 1;

        const prog = phase === "scramble" ? scrambleT : 1;
        const ticks = 12;
        for (let i = 0; i < ticks; i++) {
            const on = i / ticks < prog || phase === "tension";
            const a0 = -Math.PI / 2 + (i / ticks) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(cx, cy, R + 10, a0, a0 + (Math.PI * 2) / ticks - 0.08);
            ctx.strokeStyle = on ? accent : "rgba(255,255,255,0.1)";
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        drawHex(ctx, cx, cy, R, hexStroke, hexFill, rot, 3);
        glowText(ctx, shown, cx, cy, numberSize, "#fff");
    } else if (phase === "reveal" && mode === "fail") {
        const stormT = clamp01(revealT / 0.58);
        const settleT = clamp01((revealT - 0.58) / 0.2);
        const lockT = clamp01((revealT - 0.78) / 0.22);

        const shardAmt = failLock ? 0.25 : failStorm ? easeOut(stormT) : 1 - settleT * 0.4;
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2 + t * 0.8;
            const dist = shardAmt * (14 + (i % 4) * 12) + Math.sin(t * 10 + i) * 3;
            ctx.save();
            ctx.translate(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist);
            ctx.rotate(a + t * 3);
            ctx.globalAlpha = 0.35 + shardAmt * 0.5;
            ctx.fillStyle = FAIL;
            ctx.fillRect(-5, -2, 11, 4);
            ctx.restore();
        }
        ctx.globalAlpha = 1;

        rot = Math.sin(t * (failStorm ? 28 : 16)) * (failLock ? 0.02 : 0.1);
        hexStroke = FAIL;
        hexFill = `rgba(${Math.floor(18 + Math.min(1, revealT) * 50)},6,10,0.95)`;

        const stormGlyphs = ["Ж", "Ø", "¤", "▓", "╬", "░", "╳", "‡", "⌀", "¿", "#", "%"];
        const settleGlyphs = ["Ж", "Ø", "¤", "▓", "╳", "¿"];
        let numberStr;
        if (failLock) {
            numberStr = "1";
        } else if (failStorm) {
            state.glyphHold -= 1;
            if (state.glyphHold <= 0) {
                state.glyphIdx = Math.floor(Math.random() * stormGlyphs.length);
                state.glyphHold = 1 + Math.floor((1 - stormT) * 3);
            }
            numberStr = stormGlyphs[state.glyphIdx];
        } else {
            state.glyphHold -= 1;
            if (state.glyphHold <= 0) {
                state.glyphIdx = Math.floor(Math.random() * settleGlyphs.length);
                state.glyphHold = 3 + Math.floor(settleT * 5);
            }
            numberStr = settleGlyphs[state.glyphIdx];
        }

        const shake = failLock ? 0 : failStorm ? 5 + stormT * 4 : 2.5;
        const jx = (Math.random() - 0.5) * shake;
        const jy = (Math.random() - 0.5) * shake * 0.7;

        drawHex(
            ctx,
            cx + jx * 0.3,
            cy + jy * 0.3,
            R * (1 + Math.sin(t * 32) * (failStorm ? 0.05 : 0.02)),
            hexStroke,
            hexFill,
            rot,
            3,
        );

        if (!failLock) {
            const tear = failStorm ? 0.55 : 0.3;
            ctx.globalAlpha = tear;
            glowText(ctx, numberStr, cx + jx - 3, cy + jy, R * 1.0, CYAN);
            glowText(ctx, numberStr, cx + jx + 3, cy + jy, R * 1.0, PINK);
            ctx.globalAlpha = 1;

            for (let i = 0; i < (failStorm ? 6 : 3); i++) {
                const y = cy - R + ((t * 180 + i * 17) % (R * 2));
                ctx.strokeStyle = "rgba(255,51,85,0.55)";
                ctx.globalAlpha = failStorm ? 0.55 : 0.3;
                ctx.beginPath();
                ctx.moveTo(cx - R * 0.75, y);
                ctx.lineTo(cx + R * 0.75, y + (Math.random() - 0.5) * 5);
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
            ctx.globalAlpha = 1;

            if (failStorm) {
                ctx.font = "600 11px Fira Code, monospace";
                for (let i = 0; i < 10; i++) {
                    const a = (i / 10) * Math.PI * 2 + t * 3;
                    ctx.globalAlpha = 0.2 + (i % 3) * 0.1;
                    ctx.fillStyle = FAIL;
                    ctx.fillText(
                        stormGlyphs[(state.glyphIdx + i) % stormGlyphs.length],
                        cx + Math.cos(a) * (R + 20),
                        cy + Math.sin(a) * (R + 14),
                    );
                }
                ctx.globalAlpha = 1;
            }
        }

        glowText(ctx, numberStr, cx + jx, cy + jy, R * (failLock ? 1.12 : 1.0), FAIL);

        if (failLock) {
            const flash = easeOut(clamp01(lockT / 0.35));
            ctx.beginPath();
            ctx.arc(cx, cy, R * (1.15 + flash * 0.5), 0, Math.PI * 2);
            ctx.strokeStyle = FAIL;
            ctx.globalAlpha = (1 - flash) * 0.85;
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.globalAlpha = easeOut(lockT);
            ctx.font = "700 10px Orbitron, sans-serif";
            ctx.fillStyle = FAIL;
            ctx.textAlign = "center";
            ctx.fillText("CRITICAL FAIL", cx, cy + R + 22);
            ctx.globalAlpha = 1;
        } else if (failSettle) {
            ctx.font = "600 9px Orbitron, sans-serif";
            ctx.fillStyle = FAIL;
            ctx.textAlign = "center";
            ctx.globalAlpha = 0.7;
            ctx.fillText("UNSTABLE…", cx, cy + R + 20);
            ctx.globalAlpha = 1;
        }
    } else if (phase === "reveal" && mode === "crit") {
        const buildT = clamp01(revealT / 0.35);
        const surgeT = clamp01((revealT - 0.35) / 0.3);
        const power = critBuild ? easeOut(buildT) * 0.45 : critSurge ? 0.45 + easeOut(surgeT) * 0.55 : 1;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t * 2.2);
        ctx.strokeStyle = GOLD;
        ctx.globalAlpha = 0.3 + power * 0.55;
        ctx.setLineDash([5, 7]);
        ctx.lineWidth = 1.8 + power * 0.6;
        ctx.beginPath();
        ctx.ellipse(0, 0, lerp(R + 4, 56, power), lerp(R * 0.35, 24, power), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.rotate(-t * 3.6);
        ctx.strokeStyle = CYAN;
        ctx.beginPath();
        ctx.ellipse(0, 0, lerp(R + 2, 44, power), lerp(R + 2, 44, power), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = GOLD;
        ctx.globalAlpha = power;
        ctx.beginPath();
        ctx.arc(Math.cos(t * 3.2) * 56 * power, Math.sin(t * 3.2) * 24 * power, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = CYAN;
        ctx.beginPath();
        ctx.arc(Math.cos(-t * 2.4) * 44 * power, Math.sin(-t * 2.4) * 44 * power, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;

        const pulseN = critHold ? 7 : critSurge ? 5 : 3;
        for (let i = 0; i < pulseN; i++) {
            const phaseP = (t * (critHold ? 1.4 : 2.2) + i * 0.18) % 1;
            const rad = R + 10 + phaseP * (30 + power * 28);
            ctx.beginPath();
            ctx.arc(cx, cy, rad, 0, Math.PI * 2);
            ctx.strokeStyle = i % 2 ? GOLD : CYAN;
            ctx.globalAlpha = (1 - phaseP) * (0.25 + power * 0.35);
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        if (critSurge || critHold) {
            const rayP = critHold ? 0.7 + 0.3 * Math.sin(t * 6) : easeOut(surgeT);
            for (let i = 0; i < 10; i++) {
                const a = (i / 10) * Math.PI * 2 + t * 0.4;
                ctx.beginPath();
                ctx.moveTo(cx + Math.cos(a) * (R + 6), cy + Math.sin(a) * (R + 6));
                ctx.lineTo(
                    cx + Math.cos(a) * (R + 18 + rayP * 36),
                    cy + Math.sin(a) * (R + 18 + rayP * 36),
                );
                ctx.strokeStyle = i % 2 ? GOLD : "#fff";
                ctx.globalAlpha = 0.25 * rayP;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }

        const showMax = !critBuild;
        const lift = critBuild
            ? easeOut(buildT) * 4
            : critSurge
              ? 4 + Math.sin(surgeT * Math.PI) * 10
              : 4 + Math.sin(t * 5) * 3;

        hexStroke = GOLD;
        hexFill = "rgba(18,14,6,0.95)";
        drawHex(ctx, cx, cy - lift, R * (1 + power * 0.06), hexStroke, hexFill, 0, 3);

        if (showMax) {
            const sz = R * (0.95 + power * 0.18 + (critHold ? 0.04 * Math.sin(t * 8) : 0));
            glowText(ctx, String(sides), cx, cy - lift, sz, GOLD);
        } else {
            glowText(ctx, String(shown), cx, cy - lift, R * 0.9, mix(CYAN, GOLD, buildT));
        }

        if (critSurge || critHold) {
            ctx.font = "700 10px Orbitron, sans-serif";
            ctx.fillStyle = GOLD;
            ctx.textAlign = "center";
            ctx.globalAlpha = critHold ? 1 : easeOut(surgeT);
            ctx.fillText(`NATURAL ${sides}`, cx, cy + R + 22);
            if (critHold) {
                ctx.font = "600 8px Fira Code, monospace";
                ctx.fillStyle = CYAN;
                ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 6);
                ctx.fillText("HALO_LOCK", cx, cy + R + 36);
            }
            ctx.globalAlpha = 1;
        }
    } else if (phase === "reveal") {
        const flash = easeOut(clamp01(revealT / 0.3));
        ctx.beginPath();
        ctx.arc(cx, cy, R * (1.1 + flash * 0.45), 0, Math.PI * 2);
        ctx.strokeStyle = GOLD;
        ctx.globalAlpha = (1 - flash) * 0.75;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
        drawHex(ctx, cx, cy, R, GOLD, hexFill, 0, 3);
        glowText(ctx, String(result), cx, cy, R * 1.05, GOLD);
        ctx.font = "700 10px Orbitron, sans-serif";
        ctx.fillStyle = GOLD;
        ctx.textAlign = "center";
        ctx.globalAlpha = easeOut(revealT);
        ctx.fillText(`D${sides} · LOCKED`, cx, cy + R + 22);
        ctx.globalAlpha = 1;
    }

    return t >= dur;
}

export function animUnifiedDie(ctx, w, h, t, state, event) {
    // Always full lab TIMING — theatrical dice must match cell8-lab 1:1.
    // Accessibility escape hatch is Skip/Esc on the overlay, not shortened FX.
    const sides = event?.sides || 20;
    const result = event?.result ?? 8;
    const mode = modeFromResult(result, sides);
    return drawUnifiedDie(ctx, w, h, t, state, {
        slot: layoutSlots(w, h, 1)[0],
        roller: {
            name: event?.rollerName || "",
            result,
            sides,
        },
        sides,
        forceMode: mode,
        highlight: Boolean(event?.highlight),
        timing: TIMING[mode] || TIMING.normal,
    });
}

/**
 * Pick the theatrical hero die + compact rail chips for everyone else.
 * - Local roller: always their die as hero.
 * - DM: most recent roll as focus.
 * - Spectator (not in batch): first chronological roll as focus.
 */
export function pickHeroAndRail(rollers, povKey) {
    const list = (rollers || []).slice();
    if (!list.length) return { hero: null, others: [], heroIsMine: false, povTag: "POV" };

    if (povKey && povKey !== "__DM__") {
        const vi = list.findIndex((r) => matchViewer(r, povKey));
        if (vi >= 0) {
            const hero = list[vi];
            return {
                hero,
                others: list.filter((_, i) => i !== vi),
                heroIsMine: true,
                povTag: "POV YOU · CENTER",
            };
        }
        return {
            hero: list[0],
            others: list.slice(1),
            heroIsMine: false,
            povTag: "POV TABLE",
        };
    }

    // DM: focus most recent; rail chronological L→R (older first).
    const hero = list[list.length - 1];
    return {
        hero,
        others: list.slice(0, -1),
        heroIsMine: false,
        povTag: "POV DM",
    };
}

function accentForResult(result, sides) {
    const mode = modeFromResult(result, sides);
    if (mode === "fail") return FAIL;
    if (mode === "crit") return GOLD;
    return CYAN;
}

/** Compact name + dN + face chips under the hero stage. */
export function drawRollerRail(ctx, w, h, chips, t) {
    if (!chips?.length) return;
    const cell = cellIndexRect(w, h, 8);
    const railY = Math.min(h - 52, cell.y + cell.h - 28);
    const chipH = 34;
    const padX = 10;
    const gap = 8;
    const maxW = Math.min(w - 32, cell.w + 80);
    const n = chips.length;
    const chipW = Math.min(148, Math.max(88, (maxW - gap * (n - 1)) / n));
    const totalW = n * chipW + (n - 1) * gap;
    let x0 = cell.cx - totalW / 2;
    // Keep rail on-screen if many chips.
    x0 = Math.max(16, Math.min(x0, w - 16 - totalW));

    const appear = easeOut(clamp01(t / 0.35));

    ctx.save();
    ctx.globalAlpha = 0.55 + 0.45 * appear;
    ctx.font = "600 9px Orbitron, sans-serif";
    ctx.fillStyle = "rgba(0,242,234,0.75)";
    ctx.textAlign = "center";
    ctx.fillText("MESA", cell.cx, railY - chipH * 0.55 - 6);

    chips.forEach((r, i) => {
        const sides = r.sides || 20;
        const accent = accentForResult(r.result, sides);
        const x = x0 + i * (chipW + gap);
        const y = railY - chipH / 2;
        const slide = easeOut(clamp01((t - i * 0.05) / 0.3));
        const drawY = y + (1 - slide) * 12;

        roundRectPath(ctx, x, drawY, chipW, chipH, 6);
        ctx.fillStyle = "rgba(8,10,16,0.9)";
        ctx.fill();
        ctx.strokeStyle = `${accent}`;
        ctx.globalAlpha = 0.35 + 0.55 * slide;
        ctx.lineWidth = 1.4;
        ctx.shadowColor = accent;
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.globalAlpha = slide;
        ctx.font = "600 9px Orbitron, sans-serif";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        const label = String(r.name || "???").slice(0, 10).toUpperCase();
        ctx.fillText(label, x + padX, drawY + chipH * 0.38);

        ctx.font = "600 8px Fira Code, monospace";
        ctx.fillStyle = CYAN;
        ctx.fillText(`d${sides}`, x + padX, drawY + chipH * 0.72);

        ctx.font = "700 16px Orbitron, sans-serif";
        ctx.fillStyle = accent;
        ctx.textAlign = "right";
        ctx.fillText(String(r.result), x + chipW - padX, drawY + chipH * 0.55);
    });
    ctx.restore();
}

/**
 * Multi-player coalesce: one theatrical hero die + compact rail for others.
 * Replaces the old N-unified batch strip (MAX_BATCH / NEXT BATCH).
 */
export function animMultiDice(ctx, w, h, t, state, event) {
    if (!state.prepared) {
        const pov = event?.povKey || "__DM__";
        const picked = pickHeroAndRail(event?.rollers || [], pov);
        state.prepared = true;
        state.pov = pov;
        state.hero = picked.hero;
        state.others = picked.others;
        state.heroIsMine = picked.heroIsMine;
        state.povTag = picked.povTag;
        state.heroDie = {};
    }

    const hero = state.hero;
    if (!hero) return true;

    const sides = hero.sides || 20;
    const mode = modeFromResult(hero.result, sides);
    const timing = TIMING[mode] || TIMING.normal;
    const dur = durationForMode(mode);

    softDim(ctx, w, h, 0.28);
    drawUnifiedDie(ctx, w, h, t, state.heroDie, {
        skipDim: true,
        slot: layoutSlots(w, h, 1)[0],
        roller: hero,
        sides,
        forceMode: mode,
        highlight: Boolean(state.heroIsMine),
        timing,
    });

    // Rail fades in as the hero settles into tension/reveal.
    const railT = Math.max(0, t - timing.scramble * 0.55);
    drawRollerRail(ctx, w, h, state.others, railT);

    ctx.font = "600 10px Orbitron, sans-serif";
    ctx.fillStyle = CYAN;
    ctx.textAlign = "left";
    const n = 1 + (state.others?.length || 0);
    ctx.fillText(`HERO + RAIL · ${n} ROLLS · ${state.povTag}`, 16, h - 18);

    return t >= dur;
}

export function animSwarmCascade(ctx, w, h, t, state, event) {
    const cell = cellIndexRect(w, h, 8);
    if (!state.dice) {
        state.dice = (event?.dice || []).slice(0, MAX_SWARM);
        state.displayTotal = event?.total;
        state.rollerName = event?.rollerName || "";
    }
    const dice = state.dice;
    const dur = SWARM_DURATION;
    const u = clamp01(t / dur);
    softDim(ctx, w, h, 0.28);
    cellFocus(ctx, cell, PINK, 0.5 + 0.5 * Math.sin(t * 6));

    if (state.rollerName) {
        ctx.font = "700 12px Orbitron, sans-serif";
        ctx.fillStyle = CYAN;
        ctx.textAlign = "center";
        ctx.fillText(String(state.rollerName).toUpperCase(), cell.cx, cell.y + 22);
    }

    const n = dice.length;
    const maxR = Math.min(28, ((cell.w - 36) / Math.max(n, 1)) * 0.42);
    const gap = Math.min(maxR * 2.35, (cell.w - 40) / Math.max(n, 1));
    const ox = cell.cx - ((n - 1) * gap) / 2;
    const baseY = cell.cy + 6;
    const trayW = Math.min(cell.w - 28, gap * n + 36);
    const trayH = maxR * 2.8 + 28;
    roundRectPath(ctx, cell.cx - trayW / 2, baseY - trayH * 0.55, trayW, trayH, 10);
    ctx.fillStyle = "rgba(8,10,16,0.86)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,102,255,0.45)";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.font = "600 9px Orbitron, sans-serif";
    ctx.fillStyle = CYAN;
    ctx.textAlign = "center";
    ctx.fillText(`SWARM · ${dice.length}/${MAX_SWARM}`, cell.cx, baseY - trayH * 0.55 + 14);

    dice.forEach((d, i) => {
        const local = easeOut(clamp01((u - i * 0.08) / 0.42));
        const x = ox + i * gap;
        const y = lerp(cell.y - 10, baseY, local);
        const wobble = (1 - local) * Math.sin(t * 22 + i * 1.7) * 0.35;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(wobble);
        const shown = local > 0.82 ? d.value : 1 + Math.floor(Math.random() * (d.sides || 6));
        drawDieChip(ctx, 0, 0, maxR, d.label, local > 0.55 ? shown : "·", i % 2 ? PINK : CYAN, local);
        ctx.restore();
    });

    if (u > 0.72) {
        const sum = dice.reduce((a, d) => a + d.value, 0);
        const display = state.displayTotal != null ? state.displayTotal : sum;
        const s = easeOut(clamp01((u - 0.72) / 0.2));
        ctx.globalAlpha = s;
        glowText(ctx, String(display), cell.cx, baseY + trayH * 0.38, 22, GOLD);
        ctx.font = "600 9px Fira Code, monospace";
        ctx.fillStyle = GOLD;
        ctx.textAlign = "center";
        ctx.fillText("TOTAL", cell.cx, baseY + trayH * 0.38 + 16);
        ctx.globalAlpha = 1;
    }
    return u >= 1;
}

/** Dispatch by event.kind. Returns true when animation finished. */
export function tickDiceReveal(ctx, w, h, t, state, event) {
    if (!event) return true;
    if (event.kind === "multi") return animMultiDice(ctx, w, h, t, state, event);
    if (event.kind === "swarm") return animSwarmCascade(ctx, w, h, t, state, event);
    return animUnifiedDie(ctx, w, h, t, state, event);
}