import { useCallback, useLayoutEffect, useRef, useState } from "react";

/**
 * React-idiomatic re-implementation of the mockup's imperative `fitSeamChips`
 * (manual `ResizeObserver` + binary-search DOM measurement) — same visual
 * outcome (chips that fit render normally, the rest collapse into a `+N`
 * overflow chip, no clipping) via one hidden measuring row instead of a DOM
 * binary search (Slice 7, `PHASE-03-GUIDE.md` §7.2).
 *
 * Usage: render the *same* items twice — once normally inside `containerRef`
 * (only `visibleItems`, plus a `+overflowCount` chip when `overflowCount > 0`),
 * and once inside an absolutely-positioned, `visibility:hidden` row holding
 * *all* `items` so their natural widths can be measured via `registerMeasure`.
 *
 * @param {Array<{ key: string }>} items
 * @param {{ gap?: number, overflowWidth?: number }} [opts]
 */
export function useFitChips(items, { gap = 4, overflowWidth = 34 } = {}) {
    const containerRef = useRef(null);
    const measureRefs = useRef(new Map());
    const [visibleCount, setVisibleCount] = useState(items.length);

    const registerMeasure = useCallback((key) => (el) => {
        if (el) measureRefs.current.set(key, el);
        else measureRefs.current.delete(key);
    }, []);

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return undefined;

        const recompute = () => {
            const width = container.clientWidth;
            if (!items.length) {
                setVisibleCount(0);
                return;
            }
            if (!width) {
                setVisibleCount(items.length);
                return;
            }
            let used = 0;
            let count = 0;
            for (let i = 0; i < items.length; i++) {
                const el = measureRefs.current.get(items[i].key);
                const w = el ? el.getBoundingClientRect().width : 0;
                const isLast = i === items.length - 1;
                const budget = isLast ? width : width - overflowWidth;
                const candidate = used + (count > 0 ? gap : 0) + w;
                if (candidate > budget) break;
                used = candidate;
                count++;
            }
            setVisibleCount(count);
        };

        recompute();
        const ro = new ResizeObserver(recompute);
        ro.observe(container);
        return () => ro.disconnect();
    }, [items, gap, overflowWidth]);

    return {
        containerRef,
        registerMeasure,
        visibleItems: items.slice(0, visibleCount),
        overflowCount: Math.max(0, items.length - visibleCount),
    };
}
