/** Timeline in seconds (unified die). Fail/Crit get a long REVEAL. */
export const TIMING = {
    normal: { scramble: 1.55, tension: 0.4, reveal: 0.7 },
    fail: { scramble: 1.55, tension: 0.55, reveal: 2.55 },
    crit: { scramble: 1.55, tension: 0.55, reveal: 2.65 },
};

export const MAX_SWARM = 10;
export const MAX_BATCH = 6;
export const SWARM_DURATION = 2.55;
export const MULTI_BATCH_GAP = 0.45;
export const COALESCE_MS = 1200;
export const HOLD_HOT_MS = 1400;
export const HOLD_NORMAL_MS = 900;
/** Soft dismiss after hold so the stage does not pop away. */
export const FADE_OUT_MS = 500;
/** Shorter fade when the user hits Skip / Esc. */
export const FADE_SKIP_MS = 180;
/** Safety: reveal dice chat cards even if overlay never finishes. */
export const REVEAL_TIMEOUT_MS = 10000;

export function modeFromResult(result, sides = 20) {
    const s = Math.max(2, Math.floor(Number(sides) || 20));
    const r = Math.min(s, Math.max(1, Math.floor(Number(result) || 1)));
    if (r === 1) return "fail";
    if (r === s) return "crit";
    return "normal";
}

export function durationForMode(mode) {
    const tm = TIMING[mode] || TIMING.normal;
    return tm.scramble + tm.tension + tm.reveal;
}

export function holdMsForEvent(event) {
    if (!event) return HOLD_NORMAL_MS;
    if (event.kind === "multi") {
        const hot = (event.rollers || []).some((r) => {
            const sides = r.sides || 20;
            return r.result === 1 || r.result === sides;
        });
        return hot ? HOLD_HOT_MS : HOLD_NORMAL_MS;
    }
    if (event.kind === "swarm") return HOLD_NORMAL_MS;
    const sides = event.sides || 20;
    const result = event.result;
    if (result === 1 || result === sides) return HOLD_HOT_MS;
    return HOLD_NORMAL_MS;
}
