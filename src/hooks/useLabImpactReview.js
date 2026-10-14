import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { REVIEW, buildLabReview, canFlip, decidable, effectiveItem, reviewCounts, statusOf } from "../utils/labImpactReview";
import { acceptReviewItem, undoReviewItem } from "../utils/labReviewApply";

const FRESH_MS = 4000;
const EMPTY = { groups: [], items: [] };

/**
 * Accept / reject state of one Neural Lab cascade. Each accept writes at once,
 * one at a time, so two quick clicks on the same pair never race.
 * @param {{
 *   result: (object & { labRunId?: string, labSnapshot?: { relations: object[], entities: object[] } })|null,
 *   loreId: string,
 *   entities: object[],
 *   relations: object[],
 *   canWrite: boolean,
 *   onMirror?: (entityId: string, blockId: string, block: object|null) => Promise<string|null>,
 * }} args
 */
export function useLabImpactReview({ result, loreId, entities, relations, canWrite, onMirror }) {
    const entitiesRef = useRef(entities);
    const relationsRef = useRef(relations);
    const mirrorRef = useRef(onMirror);
    useEffect(() => { entitiesRef.current = entities; }, [entities]);
    useEffect(() => { relationsRef.current = relations; }, [relations]);
    useEffect(() => { mirrorRef.current = onMirror; }, [onMirror]);

    const runId = result?.labRunId || null;
    // `labSnapshot` is the graph when the result landed; later writes must not shift the deltas.
    const review = useMemo(
        () => (result ? buildLabReview(result, result.labSnapshot || {}) : EMPTY),
        [result],
    );
    const [store, setStore] = useState({ runId: null, map: {} });
    const decisions = useMemo(() => (store.runId === runId ? store.map : {}), [store, runId]);
    const chain = useRef(Promise.resolve());
    const blockCache = useRef(new Map());
    const relCache = useRef(null);

    useEffect(() => {
        blockCache.current = new Map();
        relCache.current = null;
    }, [runId]);

    const setDecision = useCallback((key, next) => {
        setStore((prev) => {
            const map = prev.runId === runId ? { ...prev.map } : {};
            if (next == null) delete map[key];
            else map[key] = { ...(map[key] || {}), ...next };
            return { runId, map };
        });
    }, [runId]);

    const latestBlocks = (entityId) => {
        const cached = blockCache.current.get(entityId);
        if (cached && Date.now() - cached.at < FRESH_MS) return cached.blocks;
        return entitiesRef.current.find((e) => e.id === entityId)?.aiImpactBlocks || [];
    };
    const latestRelations = () => {
        const cached = relCache.current;
        if (cached && Date.now() - cached.at < FRESH_MS) return cached.rows;
        return relationsRef.current || [];
    };
    const remember = (entityId, out) => {
        blockCache.current.set(entityId, { blocks: out.blocks, at: Date.now() });
        relCache.current = { rows: out.relations, at: Date.now() };
    };

    const enqueue = (job) => {
        const next = chain.current.then(job, job);
        chain.current = next.catch(() => {});
        return next;
    };

    const eventTitle = result?.eventTitle?.trim() || result?.eventSummary?.trim()?.slice(0, 120) || "Evento de mesa";
    const eventSummary = result?.eventSummary || "";

    const decide = useCallback((key, action, value) => {
        const item = review.items.find((row) => row.key === key);
        const group = item ? review.groups.find((row) => row.key === item.groupKey) : null;
        if (!item || !group) return Promise.resolve();
        const current = decisions[key] || {};
        if (action === "strength") {
            if (statusOf(decisions, key) !== REVIEW.PENDING || item.isStructural) return Promise.resolve();
            const n = Math.round(Number(value));
            if (!Number.isFinite(n)) return Promise.resolve();
            setDecision(key, { after: Math.max(-10, Math.min(10, n)) });
            return Promise.resolve();
        }
        if (current.busy) return Promise.resolve();
        if (action === "reject") {
            if (statusOf(decisions, key) === REVIEW.ACCEPTED) return Promise.resolve();
            setDecision(key, { status: REVIEW.REJECTED, error: null });
            return Promise.resolve();
        }
        if (action === "reset") {
            if (statusOf(decisions, key) === REVIEW.REJECTED) setDecision(key, null);
            return Promise.resolve();
        }
        if (action === "flip") {
            if (canFlip(item) && statusOf(decisions, key) === REVIEW.PENDING) setDecision(key, { flipped: !current.flipped });
            return Promise.resolve();
        }
        if (!canWrite || !loreId) {
            setDecision(key, { error: "Solo el DM con el Lore enlazado puede aplicar cambios." });
            return Promise.resolve();
        }
        if (action === "accept") {
            if (!item.valid || statusOf(decisions, key) !== REVIEW.PENDING) return Promise.resolve();
            setDecision(key, { busy: true, error: null });
            return enqueue(async () => {
                try {
                    const out = await acceptReviewItem({
                        loreId,
                        runId,
                        group,
                        item: effectiveItem(item, decisions),
                        relations: latestRelations(),
                        blocks: latestBlocks(group.entityId),
                        entities: entitiesRef.current,
                        eventTitle,
                        eventSummary,
                    });
                    remember(group.entityId, out);
                    let mirroredTo = null;
                    try {
                        mirroredTo = await mirrorRef.current?.(group.entityId, out.undo.blockId, out.block, effectiveItem(item, decisions)) || null;
                    } catch (err) {
                        console.warn("[NeuralLab] no se espejó en el Codex de la mesa", err);
                    }
                    setDecision(key, { status: REVIEW.ACCEPTED, busy: false, undo: out.undo, mirroredTo, at: Date.now() });
                } catch (err) {
                    console.warn("[NeuralLab] no se aplicó el cambio", err);
                    setDecision(key, { busy: false, error: err?.message || "No se pudo aplicar." });
                }
            });
        }
        if (action === "undo") {
            if (statusOf(decisions, key) !== REVIEW.ACCEPTED || !current.undo) return Promise.resolve();
            setDecision(key, { busy: true, error: null });
            return enqueue(async () => {
                try {
                    const out = await undoReviewItem({
                        loreId,
                        runId,
                        group,
                        item,
                        undo: current.undo,
                        relations: latestRelations(),
                        blocks: latestBlocks(group.entityId),
                    });
                    remember(group.entityId, out);
                    try {
                        await mirrorRef.current?.(group.entityId, current.undo.blockId, out.block);
                    } catch (err) {
                        console.warn("[NeuralLab] no se espejó en el Codex de la mesa", err);
                    }
                    setDecision(key, { status: REVIEW.PENDING, busy: false, undo: null, mirroredTo: null });
                } catch (err) {
                    console.warn("[NeuralLab] no se deshizo el cambio", err);
                    setDecision(key, { busy: false, error: err?.message || "No se pudo deshacer." });
                }
            });
        }
        return Promise.resolve();
    }, [review, decisions, canWrite, loreId, runId, eventTitle, eventSummary, setDecision]);

    const decideMany = useCallback((items, action) => {
        const keys = decidable(items)
            .filter((item) => statusOf(decisions, item.key) === REVIEW.PENDING && !decisions[item.key]?.busy)
            .map((item) => item.key);
        return Promise.all(keys.map((key) => decide(key, action)));
    }, [decisions, decide]);

    const groupItems = useCallback(
        (groupKey) => review.items.filter((item) => item.groupKey === groupKey),
        [review],
    );

    return {
        runId,
        review,
        decisions,
        counts: reviewCounts(review.items, decisions),
        busy: Object.values(decisions).some((row) => row.busy),
        decide,
        acceptGroup: (groupKey) => decideMany(groupItems(groupKey), "accept"),
        rejectGroup: (groupKey) => decideMany(groupItems(groupKey), "reject"),
        acceptAll: () => decideMany(review.items, "accept"),
        rejectAll: () => decideMany(review.items, "reject"),
    };
}
