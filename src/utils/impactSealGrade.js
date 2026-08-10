/**
 * Seal Grade (F1) — map cascade validation → OK / WARN / FAIL per impact.
 * Used by Circuit map seals and Lab cascade result chips.
 */

export const SEAL_GRADE = Object.freeze({
    OK: "ok",
    WARN: "warn",
    FAIL: "fail",
});

const SEAL_LABEL = Object.freeze({
    [SEAL_GRADE.OK]: "OK",
    [SEAL_GRADE.WARN]: "WARN",
    [SEAL_GRADE.FAIL]: "FAIL",
});

const SEAL_COLOR = Object.freeze({
    [SEAL_GRADE.OK]: "#3dd68c",
    [SEAL_GRADE.WARN]: "#f5c542",
    [SEAL_GRADE.FAIL]: "#ff3355",
});

/** @param {string} grade */
export function sealGradeLabel(grade) {
    return SEAL_LABEL[grade] ?? "—";
}

/** @param {string} grade */
export function sealGradeColor(grade) {
    return SEAL_COLOR[grade] ?? "#aaaaaa";
}

/**
 * Material relation/state changes (dm_note is advisory).
 * @param {object} impact
 */
function materialChanges(impact) {
    return (impact?.resolvedChanges ?? []).filter((c) => c.kind !== "dm_note");
}

/**
 * Grade a single cascade impact (personaje or collective).
 * @param {object} impact — validated impact from validateCascadeResponse
 * @returns {'ok'|'warn'|'fail'}
 */
export function gradeImpactSeal(impact) {
    if (!impact) return SEAL_GRADE.FAIL;

    const changes = materialChanges(impact);
    const hasInvalid = changes.some((c) => !c.valid);
    const allInvalid = changes.length > 0 && changes.every((c) => !c.valid);
    const hasRepairs = changes.some((c) => c.repaired)
        || Boolean(impact.archetypeRepaired)
        || Boolean(impact.personalityShiftRepaired);
    const conf = impact.confidence ?? "media";
    const entityOk = Boolean(impact.entityResolved);
    const impactOk = impact.valid !== false;

    if (!entityOk || !impactOk || allInvalid) {
        return SEAL_GRADE.FAIL;
    }
    if (hasInvalid || hasRepairs || conf === "baja") {
        return SEAL_GRADE.WARN;
    }
    if (conf === "media") {
        return SEAL_GRADE.WARN;
    }
    return SEAL_GRADE.OK;
}

/**
 * Coverage %: impacts with seal ≠ fail over total impacts (personajes + colectivas).
 * @param {object[]} impacts
 * @param {object[]} [collectiveImpacts]
 */
export function computeSealCoverage(impacts = [], collectiveImpacts = []) {
    const all = [...impacts, ...collectiveImpacts];
    if (!all.length) return 0;
    const okish = all.filter((imp) => gradeImpactSeal(imp) !== SEAL_GRADE.FAIL).length;
    return Math.round((okish / all.length) * 100);
}

/**
 * Dominant confidence among non-fail impacts; otherwise baja.
 * @param {object[]} impacts
 */
function dominantConfidence(impacts = []) {
    const counts = { alta: 0, media: 0, baja: 0 };
    for (const imp of impacts) {
        if (gradeImpactSeal(imp) === SEAL_GRADE.FAIL) continue;
        const c = imp.confidence ?? "media";
        if (c in counts) counts[c] += 1;
    }
    if (counts.alta >= counts.media && counts.alta >= counts.baja && counts.alta > 0) return "alta";
    if (counts.media >= counts.baja && counts.media > 0) return "media";
    if (counts.baja > 0 || counts.alta + counts.media === 0) return "baja";
    return "media";
}

/**
 * Overall campaign seal from a validated cascade result.
 * @param {object} validated — validateCascadeResponse output
 * @returns {{
 *   grade: 'ok'|'warn'|'fail',
 *   pct: number,
 *   conf: 'alta'|'media'|'baja',
 *   label: string,
 *   gradesByEntityId: Record<string, 'ok'|'warn'|'fail'>,
 *   gradesByTitle: Record<string, 'ok'|'warn'|'fail'>,
 * }}
 */
export function buildSealGradeFromCascadeResult(validated) {
    const impacts = validated?.impacts ?? [];
    const collectiveImpacts = validated?.collectiveImpacts ?? [];
    const all = [...impacts, ...collectiveImpacts];

    /** @type {Record<string, 'ok'|'warn'|'fail'>} */
    const gradesByEntityId = {};
    /** @type {Record<string, 'ok'|'warn'|'fail'>} */
    const gradesByTitle = {};

    for (const imp of all) {
        const grade = gradeImpactSeal(imp);
        const titleKey = (imp.entityTitle ?? "").toLowerCase().trim();
        if (titleKey) gradesByTitle[titleKey] = grade;
        const id = imp.entityResolved?.id;
        if (id) gradesByEntityId[id] = grade;
    }

    const pct = computeSealCoverage(impacts, collectiveImpacts);
    const failCount = all.filter((imp) => gradeImpactSeal(imp) === SEAL_GRADE.FAIL).length;
    const warnCount = all.filter((imp) => gradeImpactSeal(imp) === SEAL_GRADE.WARN).length;
    const conf = dominantConfidence(all);

    let grade = SEAL_GRADE.OK;
    if (!all.length || pct < 55 || failCount > all.length * 0.35) {
        grade = SEAL_GRADE.FAIL;
    } else if (pct < 85 || warnCount > 0 || failCount > 0 || conf !== "alta") {
        grade = SEAL_GRADE.WARN;
    }

    const label = grade === SEAL_GRADE.OK
        ? "GRADE OK"
        : grade === SEAL_GRADE.WARN
            ? "GRADE WARN"
            : "GRADE FAIL";

    return {
        grade,
        pct,
        conf,
        label,
        gradesByEntityId,
        gradesByTitle,
    };
}
