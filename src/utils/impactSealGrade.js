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

const SEAL_HEADLINE = Object.freeze({
    [SEAL_GRADE.OK]: "Todo cuadra: se puede aceptar tal cual.",
    [SEAL_GRADE.WARN]: "Se puede aceptar, pero revisa los puntos marcados.",
    [SEAL_GRADE.FAIL]: "El validador rechazó esta reacción; sus cambios no se pueden aplicar.",
});

const REPAIR_TEXT = [
    [/^fromEntityTitle←/, "faltaba el origen; se usó la ficha que reacciona"],
    [/^field←narrativeState/, "faltaba el campo; se asumió estado narrativo"],
    [/^field←collectiveMood/, "faltaba el campo; se asumió ánimo colectivo"],
    [/^newValue←personalityShift/, "faltaba el valor; se tomó del cambio de estado"],
    [/^newValue←enum/, "el estado venía escrito distinto; se normalizó"],
    [/^relationType←grafo/, "faltaba el tipo de vínculo; se tomó del grafo"],
    [/^relationType←canon/, "el tipo de vínculo venía escrito distinto; se normalizó"],
];

function repairText(note) {
    const hit = REPAIR_TEXT.find(([re]) => re.test(String(note || "")));
    return hit ? hit[1] : String(note || "");
}

function cleanError(text) {
    return String(text || "").replace(/^(collectiveImpact \d+ )?[Cc]ambio \d+:\s*/, "").trim();
}

/**
 * Why a cascade impact got its seal. Mirrors `gradeImpactSeal` and the
 * confidence rules of `validateCascadeResponse`.
 * @param {object} impact
 * @returns {{ grade: string, label: string, color: string, headline: string, reasons: { tone: string, text: string }[] }}
 */
export function explainImpactSeal(impact) {
    const grade = gradeImpactSeal(impact);
    const reasons = [];
    const out = () => ({
        grade,
        label: sealGradeLabel(grade),
        color: sealGradeColor(grade),
        headline: SEAL_HEADLINE[grade],
        reasons,
    });
    if (!impact) {
        reasons.push({ tone: SEAL_GRADE.FAIL, text: "No llegó ninguna reacción." });
        return out();
    }
    const changes = materialChanges(impact);
    const invalid = changes.filter((c) => !c.valid);
    const repaired = changes.filter((c) => c.repaired);
    const conf = impact.confidence ?? "media";

    if (!impact.entityResolved) {
        reasons.push({
            tone: SEAL_GRADE.FAIL,
            text: `La IA nombró «${impact.entityTitle || "?"}», que no está entre las fichas enviadas.`,
        });
    } else {
        for (const err of impact.validationErrors || []) {
            reasons.push({ tone: SEAL_GRADE.FAIL, text: cleanError(err) });
        }
    }
    if (changes.length && invalid.length === changes.length) {
        reasons.push({
            tone: SEAL_GRADE.FAIL,
            text: changes.length === 1
                ? "El único cambio propuesto no pasó la validación."
                : `Ninguno de los ${changes.length} cambios pasó la validación.`,
        });
    } else if (invalid.length) {
        reasons.push({
            tone: SEAL_GRADE.WARN,
            text: `${invalid.length} de ${changes.length} cambios no pasaron la validación y quedan bloqueados.`,
        });
    }
    for (const c of invalid.slice(0, 3)) {
        reasons.push({ tone: invalid.length === changes.length ? SEAL_GRADE.FAIL : SEAL_GRADE.WARN, text: cleanError(c.validationError) });
    }
    if (repaired.length) {
        const notes = [...new Set(repaired.flatMap((c) => c.repairNotes || []).map(repairText))];
        reasons.push({
            tone: SEAL_GRADE.WARN,
            text: `El validador completó ${repaired.length === 1 ? "1 cambio" : `${repaired.length} cambios`}: ${notes.join("; ")}.`,
        });
    }
    if (impact.archetypeRepaired) {
        reasons.push({ tone: SEAL_GRADE.WARN, text: "El arquetipo que devolvió la IA no existe; se ignoró." });
    }
    if (impact.personalityShiftRepaired) {
        reasons.push({ tone: SEAL_GRADE.WARN, text: "El cambio de estado propuesto no es un estado válido; se descartó." });
    }
    if (impact.entityResolved) {
        const selfDeclared = !invalid.length && !impact.archetypeRepaired && !impact.personalityShiftRepaired;
        if (conf === "alta") {
            reasons.push({ tone: SEAL_GRADE.OK, text: "Confianza alta: la IA la declaró y el validador no la bajó." });
        } else if (conf === "media") {
            reasons.push({
                tone: SEAL_GRADE.WARN,
                text: selfDeclared
                    ? "Confianza media: la propia IA no está segura de esta reacción."
                    : "Confianza media: el validador la bajó por los problemas de arriba.",
            });
        } else {
            reasons.push({ tone: SEAL_GRADE.WARN, text: "Confianza baja: la reacción es especulativa." });
        }
    }
    if (grade === SEAL_GRADE.OK) {
        reasons.unshift({
            tone: SEAL_GRADE.OK,
            text: changes.length
                ? `Ficha encontrada y ${changes.length === 1 ? "su cambio es válido" : `sus ${changes.length} cambios son válidos`}.`
                : "Ficha encontrada; solo propone texto narrativo.",
        });
    }
    return out();
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
        failCount,
        warnCount,
        total: all.length,
        missing: validated?.missingImpacts?.length ?? 0,
        gradesByEntityId,
        gradesByTitle,
    };
}

const OVERALL_HEADLINE = {
    [SEAL_GRADE.OK]: "La propagación completa pasó el validador.",
    [SEAL_GRADE.WARN]: "Usable, con reacciones que conviene revisar antes de aceptar.",
    [SEAL_GRADE.FAIL]: "La propagación no es confiable: regenera o acota el evento.",
};

/**
 * Why the whole cascade got its grade, with the same thresholds as
 * `buildSealGradeFromCascadeResult`.
 * @param {object} validated
 */
export function explainOverallSeal(validated) {
    const seal = buildSealGradeFromCascadeResult(validated);
    const reasons = [];
    const okCount = seal.total - seal.failCount - seal.warnCount;
    if (!seal.total) {
        reasons.push({ tone: SEAL_GRADE.FAIL, text: "La IA no devolvió ninguna reacción." });
    } else {
        reasons.push({
            tone: seal.pct >= 85 ? SEAL_GRADE.OK : seal.pct >= 55 ? SEAL_GRADE.WARN : SEAL_GRADE.FAIL,
            text: `Cobertura ${seal.pct} %: ${seal.total - seal.failCount} de ${seal.total} reacciones son aplicables (OK requiere 85 %, menos de 55 % es FAIL).`,
        });
        reasons.push({
            tone: seal.failCount > 0 ? SEAL_GRADE.FAIL : seal.warnCount > 0 ? SEAL_GRADE.WARN : SEAL_GRADE.OK,
            text: `${okCount} OK · ${seal.warnCount} WARN · ${seal.failCount} FAIL por ficha.`,
        });
        reasons.push({
            tone: seal.conf === "alta" ? SEAL_GRADE.OK : SEAL_GRADE.WARN,
            text: seal.conf === "alta"
                ? "Confianza dominante alta."
                : `Confianza dominante ${seal.conf}: el sello general no puede ser OK.`,
        });
    }
    if (seal.missing > 0) {
        reasons.push({ tone: SEAL_GRADE.WARN, text: `Faltan ${seal.missing} reacciones que el grafo exigía.` });
    }
    return {
        ...seal,
        color: sealGradeColor(seal.grade),
        headline: OVERALL_HEADLINE[seal.grade],
        reasons,
    };
}
