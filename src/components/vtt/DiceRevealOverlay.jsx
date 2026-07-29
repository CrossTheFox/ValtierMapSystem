import { useEffect, useLayoutEffect, useRef } from "react";
import { Box, Button } from "@mui/material";
import { UI_COLORS, Z_INDEX } from "../../constants/designSystem";
import {
    FADE_OUT_MS,
    FADE_SKIP_MS,
    holdMsForEvent,
    tickDiceReveal,
} from "../../utils/diceRollAnim";

/**
 * Full-screen canvas dice reveal.
 * Shell stays mounted (opacity 0 when idle) so mount/unmount does not flash the
 * HUD / Pixi backdrop-filter glass. First animation frame is painted in
 * useLayoutEffect before the browser commits, so the veil never appears empty.
 */
export default function DiceRevealOverlay({ event, onDone, onSkip }) {
    const canvasRef = useRef(null);
    const rootRef = useRef(null);
    const stateRef = useRef({});
    const rafRef = useRef(0);
    const timerRef = useRef(0);
    const runIdRef = useRef(0);
    const onDoneRef = useRef(onDone);
    const onSkipRef = useRef(onSkip);
    const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });

    useEffect(() => {
        onDoneRef.current = onDone;
    }, [onDone]);
    useEffect(() => {
        onSkipRef.current = onSkip;
    }, [onSkip]);

    useEffect(() => {
        if (!event) return undefined;
        const onKey = (e) => {
            if (e.code === "Escape") {
                e.preventDefault();
                rootRef.current?.dispatchEvent(new CustomEvent("dice-reveal-skip"));
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [event]);

    useLayoutEffect(() => {
        const root = rootRef.current;
        const canvas = canvasRef.current;
        if (!root || !canvas) return undefined;

        const stopRaf = () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = 0;
            }
        };
        const clearTimer = () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = 0;
            }
        };

        if (!event) {
            stopRaf();
            clearTimer();
            root.style.transition = "none";
            root.style.opacity = "0";
            root.style.pointerEvents = "none";
            return undefined;
        }

        const runId = ++runIdRef.current;
        let finished = false;

        const isActive = () => runIdRef.current === runId && !finished;

        const finish = (kind) => {
            if (finished || runIdRef.current !== runId) return;
            finished = true;
            stopRaf();
            clearTimer();
            root.style.transition = "none";
            root.style.opacity = "0";
            root.style.pointerEvents = "none";
            if (kind === "skip") onSkipRef.current?.();
            else onDoneRef.current?.();
        };

        const fadeThen = (ms, kind) => {
            if (!isActive()) return;
            stopRaf();
            root.style.transition = `opacity ${ms}ms linear`;
            root.style.opacity = "0";
            clearTimer();
            timerRef.current = window.setTimeout(() => finish(kind), ms + 16);
        };

        const ensureSize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const w = window.innerWidth;
            const h = window.innerHeight;
            const prev = sizeRef.current;
            if (
                prev.w !== w || prev.h !== h || prev.dpr !== dpr ||
                canvas.width !== Math.floor(w * dpr) ||
                canvas.height !== Math.floor(h * dpr)
            ) {
                canvas.width = Math.floor(w * dpr);
                canvas.height = Math.floor(h * dpr);
                canvas.style.width = `${w}px`;
                canvas.style.height = `${h}px`;
                sizeRef.current = { w, h, dpr };
            }
            const ctx = canvas.getContext("2d");
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            return { ctx, w, h };
        };

        // Arm stage: paint frame 0 before the browser paints so the HUD never
        // sees an empty dark Box (that was the click flicker).
        root.style.transition = "none";
        root.style.opacity = "0";
        root.style.pointerEvents = "none";
        stateRef.current = {};
        try {
            const { ctx, w, h } = ensureSize();
            ctx.clearRect(0, 0, w, h);
            tickDiceReveal(ctx, w, h, 0, stateRef.current, event);
        } catch (err) {
            console.error("[DiceRevealOverlay] first frame failed", err);
            finish("done");
            return () => {
                stopRaf();
                clearTimer();
            };
        }
        root.style.opacity = "1";
        root.style.pointerEvents = "auto";

        const t0 = performance.now();
        const frame = (now) => {
            if (!isActive()) return;
            try {
                const { ctx, w, h } = ensureSize();
                ctx.clearRect(0, 0, w, h);
                const done = tickDiceReveal(
                    ctx,
                    w,
                    h,
                    (now - t0) / 1000,
                    stateRef.current,
                    event,
                );
                if (!done) {
                    rafRef.current = requestAnimationFrame(frame);
                    return;
                }
                clearTimer();
                timerRef.current = window.setTimeout(() => {
                    if (!isActive()) return;
                    try {
                        const { ctx, w, h } = ensureSize();
                        ctx.clearRect(0, 0, w, h);
                        tickDiceReveal(ctx, w, h, 30, stateRef.current, event);
                    } catch { /* ignore */ }
                    fadeThen(FADE_OUT_MS, "done");
                }, holdMsForEvent(event));
            } catch (err) {
                console.error("[DiceRevealOverlay] tick failed", err);
                finish("done");
            }
        };
        rafRef.current = requestAnimationFrame(frame);

        const onSkipEvt = () => {
            if (!isActive()) return;
            fadeThen(FADE_SKIP_MS, "skip");
        };
        root.addEventListener("dice-reveal-skip", onSkipEvt);

        return () => {
            stopRaf();
            clearTimer();
            root.removeEventListener("dice-reveal-skip", onSkipEvt);
            root.style.transition = "none";
            root.style.opacity = "0";
            root.style.pointerEvents = "none";
        };
    }, [event]);

    return (
        <Box
            ref={rootRef}
            aria-hidden={!event}
            sx={{
                position: "fixed",
                inset: 0,
                zIndex: Z_INDEX.diceReveal,
                // Idle: invisible + non-interactive. Canvas paints the dim veil
                // (softDim) — no separate bgcolor, so an empty mount cannot flash.
                pointerEvents: "none",
                opacity: 0,
            }}
        >
            <canvas
                ref={canvasRef}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    display: "block",
                }}
            />
            {event ? (
                <Button
                    type="button"
                    onClick={() => {
                        rootRef.current?.dispatchEvent(new CustomEvent("dice-reveal-skip"));
                    }}
                    sx={{
                        position: "absolute",
                        right: 14,
                        bottom: 14,
                        zIndex: 1,
                        fontFamily: "'Orbitron', sans-serif",
                        fontSize: "0.55rem",
                        letterSpacing: "0.12em",
                        color: UI_COLORS.textPrimary,
                        border: `1px solid ${UI_COLORS.border}`,
                        bgcolor: "rgba(0,0,0,0.35)",
                        px: 1.5,
                        py: 0.75,
                        minWidth: 0,
                        "&:hover": {
                            borderColor: UI_COLORS.accent,
                            color: UI_COLORS.textPrimary,
                            bgcolor: "rgba(7,7,14,0.9)",
                        },
                    }}
                >
                    SKIP
                </Button>
            ) : null}
        </Box>
    );
}
