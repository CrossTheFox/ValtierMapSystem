/**
 * Fixed Eval-01 review package for the Neural Lab.
 * Opens without calling a model. Resolves against the Lore fichas already on the board.
 */

export const EVAL01_ID = "eval-01";

/** Slugs from `scripts/data/evalWikiSeed.mjs` that the package needs. */
export const EVAL01_SLUGS = Object.freeze({
    serene: "serene",
    aldric: "aldric",
    elara: "elara",
    muerte: "muerte-serene",
    cronica: "cronica-corte-serene",
    ideologia: "derecho-divino",
});

const NEEDED = [
    ["serene", "Serene"],
    ["aldric", "Aldric"],
    ["elara", "Princesa Elara Alder"],
    ["muerte", "Muerte de la Reina Serene"],
    ["cronica", "Retratos de la Corte de Serene"],
    ["ideologia", "Derecho Divino de los Reyes"],
];

function fold(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function bySlug(entities, slug) {
    const want = fold(slug);
    return (entities || []).find((row) => fold(row?.slug) === want) || null;
}

/** Seed slug, known alias, then the ficha title. The live Elara row is `princesa-elara-alder`. */
function findNeeded(entities, slug, label) {
    const aliases = slug === "elara" ? ["princesa-elara-alder"] : [];
    return bySlug(entities, slug)
        || aliases.map((alias) => bySlug(entities, alias)).find(Boolean)
        || (entities || []).find((row) => fold(row?.title) === fold(label))
        || null;
}

function edge(from, to, relationType, extra = {}) {
    return {
        kind: "relation_add",
        valid: true,
        relationType,
        fromEntity: from,
        toEntity: to,
        fromEntityTitle: from.title,
        toEntityTitle: to.title,
        resolvedEndpoints: { fromEntityId: from.id, toEntityId: to.id },
        ...extra,
    };
}

/**
 * @param {{ entities?: object[], relations?: object[] }} graph
 * @returns {{ ok: true, result: object }|{ ok: false, missing: string[] }}
 */
export function buildEval01Package({ entities = [] } = {}) {
    const found = {};
    const missing = [];
    for (const [key, label] of NEEDED) {
        const row = findNeeded(entities, EVAL01_SLUGS[key], label);
        if (!row?.id) missing.push(label);
        else found[key] = row;
    }
    if (missing.length) return { ok: false, missing };

    const { serene, aldric, elara, muerte, cronica, ideologia } = found;
    return {
        ok: true,
        result: {
            fixtureId: EVAL01_ID,
            eventTitle: "Propuesta fija Eval-01",
            eventSummary: "Paquete de prueba de Aldermar. No viene de una llamada al modelo. La enemistad de Serene llega en +4: cámbiala a −8 antes de aceptar.",
            impacts: [
                {
                    entityTitle: serene.title,
                    entityId: serene.id,
                    entityResolved: serene,
                    valid: true,
                    confidence: "alta",
                    wave: 1,
                    resolvedChanges: [
                        edge(serene, aldric, "enemigo_de", {
                            strengthDelta: 4,
                            reason: "PF-A. Llega en +4. La fuerza se edita a −8 y se acepta. Reemplaza «esposa de».",
                        }),
                    ],
                },
                {
                    entityTitle: elara.title,
                    entityId: elara.id,
                    entityResolved: elara,
                    valid: true,
                    confidence: "alta",
                    wave: 1,
                    resolvedChanges: [
                        edge(elara, aldric, "enemigo_de", {
                            strengthDelta: -8,
                            reason: "PF-B. Se rechaza. Elara sigue como descendiente de Aldric.",
                        }),
                        edge(elara, muerte, "participo_en", {
                            strengthDelta: 0,
                            reason: "PF-C. Hecho. No mueve la barra de afinidad.",
                        }),
                    ],
                },
                {
                    entityTitle: "Reina Fantasma",
                    entityResolved: null,
                    valid: false,
                    confidence: "baja",
                    validationErrors: ["Entidad \"Reina Fantasma\" no encontrada en el contexto."],
                    emotionalReaction: "PF-D. Esta ficha no existe y no debe nacer al aplicar.",
                    resolvedChanges: [],
                },
                {
                    entityTitle: cronica.title,
                    entityId: cronica.id,
                    entityResolved: cronica,
                    valid: true,
                    confidence: "baja",
                    wave: 1,
                    resolvedChanges: [
                        edge(cronica, ideologia, "aliado_de", {
                            valid: false,
                            validationError: "\"aliado_de\" no es válido entre crónica e ideología.",
                            reason: "PF-E. Par que la matriz niega.",
                        }),
                    ],
                },
            ],
            collectiveImpacts: [],
            errors: [],
            missingImpacts: [],
        },
    };
}
