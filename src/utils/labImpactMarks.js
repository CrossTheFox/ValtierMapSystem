/**
 * Chrome shared by the Neural Lab map and the cascade queue.
 * One label per affected ficha, one delta per changed edge.
 */

import { enrichRelationStrengthChange, formatStrengthChangeLabel } from "./resolveRelationStrengthChange.js";
import { gradeImpactSeal, sealGradeColor, sealGradeLabel } from "./impactSealGrade.js";

const FIELD_LABEL = {
    narrativeState: "estado",
    narrative_state: "estado",
    collectiveMood: "ánimo",
    collective_mood: "ánimo",
    condicion: "condición",
};

function impactId(impact) {
    return impact?.entityId || impact?.entityResolved?.id || "";
}

export function deltaText(enriched) {
    if (enriched.kind === "relation_remove") return "−";
    const delta = Number(enriched.strengthDeltaResolved);
    if (Number.isFinite(delta) && delta > 0) return `+${delta}`;
    if (Number.isFinite(delta) && delta < 0) return String(delta);
    if (enriched.proposedStrength != null) return `→${enriched.proposedStrength}`;
    return "·";
}

export function deltaColor(enriched) {
    if (enriched.kind === "relation_remove") return "#ff3355";
    const delta = Number(enriched.strengthDeltaResolved);
    if (Number.isFinite(delta) && delta > 0) return "#3dd68c";
    if (Number.isFinite(delta) && delta < 0) return "#ff3355";
    return "#f5c542";
}

/**
 * @param {object|null|undefined} result validated cascade payload
 * @param {object[]} [relations]
 * @returns {{ marks: Record<string, { grade: string, color: string, label: string }>, edgeDeltas: Record<string, { text: string, color: string }> }}
 */
export function labImpactChrome(result, relations = []) {
    const marks = {};
    const edgeDeltas = {};
    if (!result) return { marks, edgeDeltas };

    const all = [...(result.impacts || []), ...(result.collectiveImpacts || [])];
    for (const impact of all) {
        const id = impactId(impact);
        const grade = gradeImpactSeal(impact);
        const color = sealGradeColor(grade);
        const bits = [];
        for (const change of impact.resolvedChanges || []) {
            if (change?.valid === false) continue;
            if (change?.kind === "entity_state_update") {
                const field = FIELD_LABEL[change.field] || change.field || "dato";
                const value = change.newValue ?? "";
                bits.push(`${field} ${value}`.trim());
                continue;
            }
            if (
                change?.kind !== "relation_add"
                && change?.kind !== "relation_update"
                && change?.kind !== "relation_remove"
            ) continue;
            const enriched = enrichRelationStrengthChange(change, relations);
            const phrase = formatStrengthChangeLabel(enriched);
            if (phrase) bits.push(phrase);
            const from = enriched.resolvedEndpoints?.fromEntityId;
            const to = enriched.resolvedEndpoints?.toEntityId;
            if (!from || !to) continue;
            edgeDeltas[`${from}|${to}`] = {
                text: deltaText(enriched),
                color: deltaColor(enriched),
            };
        }
        if (!id) continue;
        const head = sealGradeLabel(grade);
        const detail = bits.slice(0, 2).join(" · ");
        marks[id] = {
            grade,
            color,
            label: detail ? `${head} · ${detail}` : head,
        };
    }
    return { marks, edgeDeltas };
}
