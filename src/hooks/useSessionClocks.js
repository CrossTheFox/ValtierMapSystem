import { useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    updateSessionClockState,
    updateSessionClocksOpen,
    addClockEvent,
} from "../../firebase/services/gameService";
import {
    setSessionClocks,
    setClockHistory,
} from "../store/gameSlice";
import { showSnackbar } from "../store/uiSlice";
import {
    emptySessionClock,
    normalizeClockInstance,
    normalizeClockList,
    prependClockHistory,
} from "../utils/clockInstance";
import { formatFilledLabel, jumpToHalfSteps } from "../utils/clockResolver";

const FIRESTORE_DEBOUNCE_MS = 350;

const EMPTY_LIST = Object.freeze([]);

/**
 * Optimistic session-clock writes with debounced Firestore merge.
 */
export function useSessionClocks() {
    const dispatch = useDispatch();
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const clocks = useSelector((s) => s.game.clocks) ?? EMPTY_LIST;
    const clockHistory = useSelector((s) => s.game.clockHistory) ?? EMPTY_LIST;
    const sessionOpen = useSelector((s) => s.game.sessionClocks?.open !== false);

    const pendingRef = useRef({});
    const timerRef = useRef(null);

    const flush = useCallback(async () => {
        const patch = pendingRef.current;
        pendingRef.current = {};
        if (!campaignId || Object.keys(patch).length === 0) return;
        try {
            await updateSessionClockState(campaignId, patch);
        } catch (err) {
            console.error("[useSessionClocks] persist", err);
            dispatch(showSnackbar({ message: "No se pudieron guardar los clocks", severity: "error" }));
        }
    }, [campaignId, dispatch]);

    const schedule = useCallback((patch) => {
        pendingRef.current = { ...pendingRef.current, ...patch };
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            timerRef.current = null;
            flush();
        }, FIRESTORE_DEBOUNCE_MS);
    }, [flush]);

    const writeClocks = useCallback((next, { immediate = false } = {}) => {
        const list = normalizeClockList(next);
        dispatch(setSessionClocks(list));
        if (!campaignId) return;
        if (immediate) {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            const extra = pendingRef.current;
            pendingRef.current = {};
            updateSessionClockState(campaignId, { ...extra, clocks: list }).catch((err) => {
                console.error(err);
                dispatch(showSnackbar({ message: "No se pudieron guardar los clocks", severity: "error" }));
            });
            return;
        }
        schedule({ clocks: list });
    }, [campaignId, dispatch, schedule]);

    const upsertClock = useCallback((clock, opts) => {
        const nextInst = normalizeClockInstance(clock);
        if (!nextInst) return null;
        const exists = clocks.some((c) => c.id === nextInst.id);
        const list = exists
            ? clocks.map((c) => (c.id === nextInst.id ? nextInst : c))
            : [...clocks, nextInst];
        writeClocks(list, opts);
        return nextInst;
    }, [clocks, writeClocks]);

    const patchClock = useCallback((id, patch, opts) => {
        const current = clocks.find((c) => c.id === id);
        if (!current) return null;
        return upsertClock({ ...current, ...patch, id }, opts);
    }, [clocks, upsertClock]);

    const addClock = useCallback((partial = {}) => {
        const created = emptySessionClock(partial);
        writeClocks([...clocks, created], { immediate: true });
        return created;
    }, [clocks, writeClocks]);

    const setFilledHalfSteps = useCallback((id, target, opts) => {
        const current = clocks.find((c) => c.id === id);
        if (!current) return null;
        const nextFill = jumpToHalfSteps(target, current.sizeTicks);
        if (nextFill === current.filledHalfSteps) return current;
        return upsertClock({ ...current, filledHalfSteps: nextFill }, opts);
    }, [clocks, upsertClock]);

    const archiveOrComplete = useCallback((id, { result, method, detail }) => {
        const current = clocks.find((c) => c.id === id);
        if (!current) return;
        const entry = {
            id: `h_${Date.now()}`,
            name: current.name,
            result,
            progress: formatFilledLabel(current.filledHalfSteps, current.sizeTicks),
            method: method || "",
            when: "Ahora",
            detail: detail || "",
            timestamp: Date.now(),
            clockInstanceId: current.id,
        };
        const nextClocks = clocks.filter((c) => c.id !== id);
        const nextHistory = prependClockHistory(clockHistory, entry);
        dispatch(setSessionClocks(nextClocks));
        dispatch(setClockHistory(nextHistory));
        if (!campaignId) return;
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        pendingRef.current = {};
        updateSessionClockState(campaignId, {
            clocks: nextClocks,
            clockHistory: nextHistory,
        }).catch((err) => {
            console.error(err);
            dispatch(showSnackbar({ message: "No se pudo actualizar el historial", severity: "error" }));
        });
    }, [clocks, clockHistory, campaignId, dispatch]);

    const setOpen = useCallback(async (open) => {
        if (!campaignId) return;
        try {
            await updateSessionClocksOpen(campaignId, open);
        } catch (err) {
            console.error(err);
            dispatch(showSnackbar({ message: "No se pudo actualizar la isla de clocks", severity: "error" }));
        }
    }, [campaignId, dispatch]);

    const logEvent = useCallback(async (event) => {
        if (!campaignId) return;
        try {
            await addClockEvent(campaignId, event);
        } catch (err) {
            console.warn("[useSessionClocks] clockEvent", err);
        }
    }, [campaignId]);

    return {
        clocks,
        clockHistory,
        sessionOpen,
        campaignId,
        writeClocks,
        upsertClock,
        patchClock,
        addClock,
        setFilledHalfSteps,
        archiveOrComplete,
        setOpen,
        logEvent,
        flush,
    };
}
