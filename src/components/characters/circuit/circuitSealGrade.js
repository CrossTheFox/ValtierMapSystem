/**
 * F1 · Seal Grade — post-validation finish animation on Circuit nodes.
 * Stamps OK / WARN / FAIL seals wave-aware, then shows a verdict banner.
 */

import { sealGradeColor, sealGradeLabel } from "../../../utils/impactSealGrade.js";

const SEAL_STAGGER_MS = 70;
const BANNER_DELAY_MS = 180;

function wait(ms, signal) {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(new DOMException("Aborted", "AbortError"));
            return;
        }
        const t = window.setTimeout(resolve, ms);
        const onAbort = () => {
            window.clearTimeout(t);
            reject(new DOMException("Aborted", "AbortError"));
        };
        signal?.addEventListener("abort", onAbort, { once: true });
    });
}

/**
 * Clear seal / packet leftover classes from circuit nodes.
 * @param {HTMLElement|null} shellEl
 */
export function clearCircuitSeals(shellEl) {
    if (!shellEl) return;
    shellEl.querySelectorAll(".ckt-node").forEach((n) => {
        n.classList.remove(
            "seal-ok", "seal-warn", "seal-fail", "show-seal",
            "ckt-pkt-hit", "ckt-pkt-lit",
        );
        delete n.dataset.cktSeal;
        delete n.dataset.cktDim;
        delete n.dataset.cktLit;
        delete n.dataset.cktHit;
        n.classList.remove("dim");
        const mark = n.querySelector("[data-ckt-seal]");
        if (mark) {
            mark.textContent = "";
            mark.style.color = "";
            mark.style.borderColor = "";
        }
    });
    shellEl.querySelector("[data-ckt-verdict]")?.classList.remove("on");
    shellEl.classList.remove("ckt-seal-result");
}

/**
 * Apply one seal to a node element (DOM + dataset for React reapply).
 * @param {HTMLElement} el
 * @param {'ok'|'warn'|'fail'} grade
 */
function stampSeal(el, grade) {
    el.classList.remove("seal-ok", "seal-warn", "seal-fail", "show-seal", "dim");
    el.dataset.cktSeal = grade;
    el.classList.add(`seal-${grade}`, "show-seal");
    const mark = el.querySelector("[data-ckt-seal]");
    if (mark) {
        const col = sealGradeColor(grade);
        mark.textContent = sealGradeLabel(grade);
        mark.style.color = col;
        mark.style.borderColor = col;
    }
}

/**
 * Resolve node DOM by entity id (or layout node id).
 * @param {HTMLElement} worldEl
 * @param {string} entityOrNodeId
 */
function findNodeEl(worldEl, entityOrNodeId) {
    if (!worldEl || !entityOrNodeId) return null;
    return worldEl.querySelector(`[data-ckt-eid="${CSS.escape(entityOrNodeId)}"]`)
        || worldEl.querySelector(`[data-ckt-nid="${CSS.escape(entityOrNodeId)}"]`)
        || worldEl.querySelector(`[data-id="${CSS.escape(entityOrNodeId)}"]`);
}

/**
 * Run Seal Grade finish animation.
 * @param {{
 *   shellEl: HTMLElement,
 *   worldEl: HTMLElement,
 *   gradesByEntityId: Record<string, 'ok'|'warn'|'fail'>,
 *   overall: { grade: string, pct: number, conf: string, label: string },
 *   signal?: AbortSignal,
 * }} opts
 */
export async function runCircuitSealGrade({
    shellEl,
    worldEl,
    gradesByEntityId = {},
    overall,
    signal,
}) {
    if (!shellEl || !worldEl) return;
    clearCircuitSeals(shellEl);
    shellEl.classList.add("ckt-seal-result");

    // Dim nodes without a seal first
    const stampedIds = Object.keys(gradesByEntityId);
    worldEl.querySelectorAll(".ckt-node").forEach((n) => {
        const eid = n.dataset.cktEid || n.dataset.id;
        if (!eid || !gradesByEntityId[eid]) {
            if (n.dataset.role !== "hub") {
                n.classList.add("dim");
                n.dataset.cktDim = "1";
            }
        }
    });

    const entries = Object.entries(gradesByEntityId);
    for (let i = 0; i < entries.length; i++) {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        const [entityId, grade] = entries[i];
        const el = findNodeEl(worldEl, entityId);
        if (el) {
            el.classList.remove("dim");
            delete el.dataset.cktDim;
            // retrigger enter
            el.classList.remove("show-seal");
            void el.offsetWidth;
            stampSeal(el, grade);
        }
        await wait(SEAL_STAGGER_MS, signal);
    }

    await wait(BANNER_DELAY_MS, signal);

    const banner = shellEl.querySelector("[data-ckt-verdict]");
    const title = shellEl.querySelector("[data-ckt-verdict-title]");
    const meta = shellEl.querySelector("[data-ckt-verdict-meta]");
    if (banner && overall) {
        const col = sealGradeColor(overall.grade);
        if (title) {
            title.textContent = overall.label || sealGradeLabel(overall.grade);
            title.style.color = col;
        }
        if (meta) {
            meta.textContent = `cobertura ${overall.pct ?? 0}% · confidence ${overall.conf ?? "—"}`
                + (stampedIds.length ? ` · ${stampedIds.length} sellos` : "");
        }
        banner.style.borderColor = col;
        banner.classList.remove("on");
        void banner.offsetWidth;
        banner.classList.add("on");
    }
}
