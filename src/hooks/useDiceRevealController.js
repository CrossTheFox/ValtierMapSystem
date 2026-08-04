import { useCallback, useEffect, useRef, useState } from "react";
import {
    COALESCE_MS,
    REVEAL_TIMEOUT_MS,
    classifyDiceMessage,
    unifiedToRoller,
} from "../utils/diceRollAnim";
import { CHAT_MESSAGE_TYPES } from "../../firebase/services/chatService";

const SOLO_FLUSH_MS = 180;
const MULTI_EXTEND_MS = 450;
const MAX_PLAY_MS = 12000;
const EMPTY_SET = new Set();

function messageIdsFromEvent(event) {
    if (!event?.messageId) return [];
    return String(event.messageId)
        .split("|")
        .map((id) => id.trim())
        .filter(Boolean);
}

/**
 * Chat dice → FIFO theatrical reveal queue (coalesce singles → multi + POV).
 * Exposes revealedDiceIds so the chat panel can gate cards until local reveal ends.
 */
export default function useDiceRevealController(messages, localUid) {
    const [event, setEvent] = useState(null);
    const [revealedDiceIds, setRevealedDiceIds] = useState(EMPTY_SET);

    const seenIdsRef = useRef(new Set());
    const seededRef = useRef(false);
    const queueRef = useRef([]);
    const coalesceRef = useRef([]);
    const coalesceStartedAtRef = useRef(0);
    const coalesceTimerRef = useRef(null);
    const playingRef = useRef(false);
    const playingEventRef = useRef(null);
    const revealTimeoutsRef = useRef(new Map());
    const revealedRef = useRef(new Set());
    const playWatchdogRef = useRef(null);

    const markRevealed = useCallback((ids) => {
        const list = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
        if (!list.length) return;
        let changed = false;
        for (const id of list) {
            if (revealedRef.current.has(id)) continue;
            revealedRef.current.add(id);
            changed = true;
            const t = revealTimeoutsRef.current.get(id);
            if (t) {
                clearTimeout(t);
                revealTimeoutsRef.current.delete(id);
            }
        }
        if (changed) setRevealedDiceIds(new Set(revealedRef.current));
    }, []);

    const scheduleRevealTimeout = useCallback(
        (messageId) => {
            if (!messageId || revealedRef.current.has(messageId)) return;
            if (revealTimeoutsRef.current.has(messageId)) return;
            const timer = setTimeout(() => {
                revealTimeoutsRef.current.delete(messageId);
                markRevealed(messageId);
            }, REVEAL_TIMEOUT_MS);
            revealTimeoutsRef.current.set(messageId, timer);
        },
        [markRevealed],
    );

    const flushCoalesce = useCallback(() => {
        if (coalesceTimerRef.current) {
            clearTimeout(coalesceTimerRef.current);
            coalesceTimerRef.current = null;
        }
        const batch = coalesceRef.current;
        coalesceRef.current = [];
        coalesceStartedAtRef.current = 0;
        if (!batch.length) return;

        let next;
        if (batch.length === 1) {
            next = {
                ...batch[0],
                highlight: Boolean(localUid && batch[0].senderId === localUid),
            };
        } else {
            const rollers = batch.map(unifiedToRoller);
            const povKey =
                localUid && rollers.some((r) => r.senderId === localUid)
                    ? localUid
                    : "__DM__";
            next = {
                kind: "multi",
                messageId: batch.map((b) => b.messageId).join("|"),
                rollers,
                povKey,
                createdAtMs: batch[0].createdAtMs,
            };
        }
        queueRef.current.push(next);
    }, [localUid]);

    const clearPlayWatchdog = useCallback(() => {
        if (playWatchdogRef.current) {
            clearTimeout(playWatchdogRef.current);
            playWatchdogRef.current = null;
        }
    }, []);

    const pump = useCallback(() => {
        if (playingRef.current) return;
        if (!queueRef.current.length) {
            setEvent(null);
            return;
        }
        const next = queueRef.current.shift();
        playingRef.current = true;
        playingEventRef.current = next;
        setEvent(next);
    }, []);

    const scheduleCoalesceFlush = useCallback(() => {
        if (coalesceTimerRef.current) {
            clearTimeout(coalesceTimerRef.current);
            coalesceTimerRef.current = null;
        }
        const n = coalesceRef.current.length;
        if (!n) return;

        const elapsed = Date.now() - (coalesceStartedAtRef.current || Date.now());
        const remainingCap = Math.max(0, COALESCE_MS - elapsed);
        const prefer = n === 1 ? SOLO_FLUSH_MS : MULTI_EXTEND_MS;
        const delay = Math.min(prefer, remainingCap);

        coalesceTimerRef.current = setTimeout(() => {
            coalesceTimerRef.current = null;
            flushCoalesce();
            pump();
        }, delay);
    }, [flushCoalesce, pump]);

    const enqueue = useCallback(
        (payload) => {
            if (!payload) return;
            if (payload.messageId) scheduleRevealTimeout(payload.messageId);

            if (payload.kind === "swarm") {
                flushCoalesce();
                queueRef.current.push({
                    ...payload,
                    highlight: Boolean(localUid && payload.senderId === localUid),
                });
                pump();
                return;
            }

            if (!coalesceRef.current.length) {
                coalesceStartedAtRef.current = Date.now();
            }
            coalesceRef.current.push(payload);
            scheduleCoalesceFlush();
        },
        [flushCoalesce, localUid, pump, scheduleCoalesceFlush, scheduleRevealTimeout],
    );

    useEffect(() => {
        if (!messages?.length) return;

        if (!seededRef.current) {
            const historyDice = [];
            messages.forEach((m) => {
                if (m?.id) seenIdsRef.current.add(m.id);
                if (m?.type === CHAT_MESSAGE_TYPES.DICE && m.id) historyDice.push(m.id);
            });
            if (historyDice.length) markRevealed(historyDice);
            seededRef.current = true;
            return;
        }

        for (const msg of messages) {
            if (!msg?.id || seenIdsRef.current.has(msg.id)) continue;
            seenIdsRef.current.add(msg.id);
            const payload = classifyDiceMessage(msg);
            if (payload) enqueue(payload);
        }
    }, [messages, enqueue, markRevealed]);

    useEffect(() => {
        if (!(messages && messages.length === 0)) return;
        seededRef.current = false;
        seenIdsRef.current = new Set();
        queueRef.current = [];
        coalesceRef.current = [];
        coalesceStartedAtRef.current = 0;
        if (coalesceTimerRef.current) {
            clearTimeout(coalesceTimerRef.current);
            coalesceTimerRef.current = null;
        }
        for (const t of revealTimeoutsRef.current.values()) clearTimeout(t);
        revealTimeoutsRef.current.clear();
        clearPlayWatchdog();
        revealedRef.current = new Set();
        setRevealedDiceIds(EMPTY_SET);
        playingRef.current = false;
        playingEventRef.current = null;
        setEvent(null);
    }, [messages, clearPlayWatchdog]);

    useEffect(
        () => () => {
            if (coalesceTimerRef.current) clearTimeout(coalesceTimerRef.current);
            clearPlayWatchdog();
            for (const t of revealTimeoutsRef.current.values()) clearTimeout(t);
            revealTimeoutsRef.current.clear();
        },
        [clearPlayWatchdog],
    );

    const finishPlaying = useCallback(() => {
        clearPlayWatchdog();
        const current = playingEventRef.current;
        if (!playingRef.current && !current) return;
        markRevealed(messageIdsFromEvent(current));
        playingRef.current = false;
        playingEventRef.current = null;
        setEvent(null);
        // Drain next on the following frame so the overlay can unmount cleanly.
        requestAnimationFrame(() => {
            if (coalesceRef.current.length && !coalesceTimerRef.current) {
                flushCoalesce();
            }
            pump();
        });
    }, [clearPlayWatchdog, flushCoalesce, markRevealed, pump]);

    // Watchdog: never leave a reveal latched forever (also unblocks UI veil).
    useEffect(() => {
        clearPlayWatchdog();
        if (!event) return undefined;
        playWatchdogRef.current = window.setTimeout(() => {
            playWatchdogRef.current = null;
            console.warn("[diceReveal] watchdog — forcing finish");
            finishPlaying();
        }, MAX_PLAY_MS);
        return () => clearPlayWatchdog();
    }, [event, finishPlaying, clearPlayWatchdog]);

    return {
        event,
        skip: finishPlaying,
        onEventDone: finishPlaying,
        revealedDiceIds,
    };
}
