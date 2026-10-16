#!/usr/bin/env node
/**
 * Veinte generaciones del capítulo 4: 5 cascadas × 3 tamaños de lore
 * y 5 ondas en el tamaño medio. No escribe Firestore. No aplica impactos.
 *
 * Réplica el tubo de WikiAiLabPanel (Scout si hay ≥5 impactos, un reintento
 * Reflexion) sobre el seed local de Aldermar.
 *
 *   node scripts/runMemoriaGeneraciones.mjs --dry
 *   node scripts/runMemoriaGeneraciones.mjs
 *   node scripts/runMemoriaGeneraciones.mjs --only=cascade-bajo
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "docs", "memoria", "capitulos", "04-validacion", "corridas");

const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
        const [k, ...rest] = a.replace(/^--/, "").split("=");
        return [k, rest.length ? rest.join("=") : true];
    })
);

const DRY = Boolean(args.dry);
const ONLY = args.only ? String(args.only) : null;
const FORCE = Boolean(args.force);
const IMPACT_MODEL = String(args["impact-model"] || args.impactModel || "gemini-2.5-flash");
const HTTP_RETRIES = Number(args["http-retries"] ?? 7);
const USE_SCHEMA = !args["no-schema"];

function loadDotEnv() {
    const dotenvPath = join(__dirname, "..", ".env");
    if (!existsSync(dotenvPath)) return;
    for (const line of readFileSync(dotenvPath, "utf8").split("\n")) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (!m) continue;
        if (process.env[m[1]] == null) {
            process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
        }
    }
}

loadDotEnv();

const {
    buildSituationContext,
    buildCascadeContext,
    buildScoutContext,
} = await import("../src/utils/buildSituationContext.js");
const { getAiRelationTypeList } = await import("../src/constants/wikiRelationTypes.js");
const {
    AI_MODES,
    CASCADE_RESPONSE_SCHEMA,
    CASCADE_SCOUT_RESPONSE_SCHEMA,
    CASCADE_SCOUT_MODEL_ID,
    CASCADE_SCOUT_THRESHOLD,
    NARRATIVE_IMPACT_RESPONSE_SCHEMA,
    buildCascadeSystemPrompt,
    buildCascadeScoutSystemPrompt,
    buildNarrativeImpactSystemPrompt,
    buildCascadeUserPrompt,
    buildCascadeScoutUserPrompt,
    buildNarrativeImpactUserPrompt,
    cascadeOptsForDepth,
} = await import("../src/constants/wiki/narrativeAiSchemas.js");
const { validateAiResponse, buildReflexionPrompt } = await import("../src/utils/validateAiResponse.js");
const {
    resolveGenerationParams,
    getExplicitlyMentionedEntityIds,
    defaultAiRulesFromPresets,
} = await import("../src/constants/wiki/narrativeAiConfig.js");
const { EVAL_CASO_01_INSTRUCTION } = await import("./data/evalWikiSeed.mjs");
const SCOUT_MODEL = String(args["scout-model"] || CASCADE_SCOUT_MODEL_ID);

const INSTRUCTION = EVAL_CASO_01_INSTRUCTION;
const DEPTH_OPTS = cascadeOptsForDepth(3);
const ALTO_OPTS = {
    ...DEPTH_OPTS,
    maxEntities: 48,
    maxRelations: 80,
    maxChars: 20000,
};
const IMPACT_OPTS = { maxDepth: 2, maxEntities: 25, maxRelations: 40, maxChars: 10000 };

const BAJO_SLUGS = new Set([
    "elara", "aldric", "serene", "muerte-serene", "palacio-aldric", "casa-real-alder",
]);

const ALTO_ENTITIES = [
    {
        slug: "roderick",
        entityType: "personaje",
        title: "Capitán Roderick Hale",
        summary: "Capitán de la Guardia Real; juró lealtad a Elara en público.",
        body: "Roderick creció en el patio del palacio y conoce cada turno de guardia de la noche en que murió Serene. No vio el cuerpo. Vio a Aldric salir de la alcoba con las manos limpias y la mirada rota, y desde entonces obedece a la heredera antes que al rey cuando ambas órdenes chocan. Entrena a Elara al amanecer, le cuenta rumores de la guardia y calla lo que no puede probar. Teme que el consejo use a la guardia como instrumento si la sucesión se rompe.",
        visibility: "dm_only",
        tags: ["guardia", "corte"],
        meta: { role: "soldado", status: "vivo" },
    },
    {
        slug: "isolde",
        entityType: "personaje",
        title: "Hermana Isolde Venn",
        summary: "Consejera del trono; desconfía de Aldric desde la muerte de Serene.",
        body: "Isolde administra justicia menor y archiva las quejas que el Gran Canciller prefiere no leer. Cree que la versión oficial de la fiebre es un documento político, no un hecho médico. No acusa al rey en voz alta: acumula testimonios de sirvientes, horarios de la guardia y el silencio de Marcus. Si Elara pregunta, Isolde habla. Si Aldric pregunta, Isolde sonríe y entrega un informe incompleto. Su lealtad es al reino escrito, no al hombre que lo gobierna.",
        visibility: "dm_only",
        tags: ["consejo", "corte"],
        meta: { role: "burocrata", status: "vivo" },
    },
    {
        slug: "harwick",
        entityType: "personaje",
        title: "Barón Cedric Harwick",
        summary: "Señor de Northmark; rival abierto de Aldric.",
        body: "Harwick paga tributo tarde y manda cartas corteses que suenan a amenaza. Northmark recuerda una frontera que Aldric cerró el año de la coronación. El barón no estuvo en el palacio la noche de Serene, pero financia a quien susurre que el rey enviudó demasiado pronto y demasiado conveniente. Quiere un asiento en el consejo y una hija, o un hijo, junto a la heredera. Trata a Elara como pieza de tratado, no como persona.",
        visibility: "dm_only",
        tags: ["northmark", "noble"],
        meta: { role: "noble", status: "vivo" },
    },
    {
        slug: "caldus",
        entityType: "personaje",
        title: "Maestre Caldus",
        summary: "Tutor de Elara; guarda los libros de la reina.",
        body: "Caldus enseñó a Elara protocolo, historia de la casa y el nombre de cada feudo. Serene le confió una caja de cartas que él no ha abierto desde el funeral. Sospecha que esas cartas nombran el miedo de la reina, no una enfermedad. Quiere a Elara como a una hija de aula: la protege de la corte y le exige que pregunte antes de acusar. Si el secreto sale, Caldus pedirá que se lea en la biblioteca, con testigos, y no en un pasillo.",
        visibility: "dm_only",
        tags: ["corte", "archivo"],
        meta: { role: "erudito", status: "vivo" },
    },
    {
        slug: "brenna",
        entityType: "personaje",
        title: "Dama Brenna Sol",
        summary: "Dama de compañía de Serene; hoy acompaña a Elara.",
        body: "Brenna peinaba a la reina y dormía en la antecámara. La noche de la muerte la despertó un grito corto y después el silencio de Aldric ordenando que nadie entrara. No vio un arma. Vio a Serene ya cubierta y al rey de rodillas. Durante doce años repitió la fiebre porque Marcus se lo pidió con una pensión. Quiere a Elara y le debe a Serene la verdad. Si la heredera insiste, Brenna habla, aunque le cueste el techo del palacio.",
        visibility: "dm_only",
        tags: ["corte", "testigo"],
        meta: { role: "noble", status: "vivo" },
    },
    {
        slug: "pell",
        entityType: "personaje",
        title: "Sargento Pell",
        summary: "Sargento de la guardia de noche; obedece a Roderick.",
        body: "Pell estaba en la puerta oeste la noche de Serene y anotó tres entradas: el rey, el canciller y nadie más. El libro de guardia de esa fecha desapareció al día siguiente. Pell no acusa. Recuerda. Si Roderick se lo pide, reconstruye el turno de memoria. Desconfía de Isolde porque los consejeros reescriben partes, y respeta a Elara porque saluda a la guardia por el nombre.",
        visibility: "dm_only",
        tags: ["guardia"],
        meta: { role: "soldado", status: "vivo" },
    },
    {
        slug: "gremio-mercaderes",
        entityType: "organizacion",
        title: "Gremio de Mercaderes de Solhaven",
        summary: "Gremio del puerto; financia la corte y cobra favores.",
        body: "El gremio adelantó grano el invierno después de la muerte de Serene y desde entonces tiene voz en los aranceles. No le importa quién mató a la reina. Le importa que el puerto no se cierre si Northmark y la corona se declaran la guerra. Sus factores escuchan a Harwick y venden el rumor más caro al consejo.",
        visibility: "players",
        tags: ["gremio", "solhaven"],
        meta: { orgKind: "gremio" },
    },
    {
        slug: "casa-harwick",
        entityType: "organizacion",
        title: "Casa Harwick",
        summary: "Casa noble de Northmark, vasalla incómoda de Aldermar.",
        body: "La casa gobierna los pasos del norte. Juró a la corona el día de la coronación de Aldric y cumple el juramento en la letra. Sus estandartes no entraron al funeral de Serene. Esperan un matrimonio o una afrenta.",
        visibility: "players",
        tags: ["casa", "northmark"],
        meta: { orgKind: "casa" },
    },
    {
        slug: "tregua-frontera",
        entityType: "evento_historico",
        title: "Tregua de la Frontera Norte",
        summary: "Acuerdo frágil entre Aldric y Northmark, posterior a la coronación.",
        body: "Se firmó en Solhaven dos años después de la coronación. Fija tributos, rehenes de cortesía y la promesa de no armar el puerto contra el norte. Harwick la llama sumisión. Aldric la llama paz. Elara no la firmó: era una niña. Si la verdad sobre Serene humilla al rey, Harwick puede romper la tregua sin romper el papel.",
        visibility: "players",
        tags: ["evento", "frontera"],
        meta: { date: "Año 2 Aldermar", eventKind: "diplomatico", certainty: "canon" },
    },
    {
        slug: "cronica-frontera",
        entityType: "cronica",
        title: "Crónica de la Frontera",
        summary: "Relato del norte y de las casas que no bajaron a la capital.",
        body: "El cronista del gremio describe Northmark como un granero con espadas. Nombra a Harwick, omite el funeral de Serene en una frase y dedica tres páginas a los aranceles. Quien lee la crónica aprende que el reino es un contrato, no una familia.",
        visibility: "players",
        tags: ["cronica", "norte"],
        meta: { category: "frontera" },
    },
];

const ALTO_RELATIONS = [
    { from: "roderick", to: "elara", relationType: "aliado_de", strength: 8, label: "guarda a" },
    { from: "roderick", to: "aldric", relationType: "relacionado_con", strength: 3, label: "obedece con reserva" },
    { from: "roderick", to: "guardia-real", relationType: "miembro_confirmado_de", strength: 9 },
    { from: "isolde", to: "aldric", relationType: "enemigo_de", strength: -6, label: "desconfía" },
    { from: "isolde", to: "elara", relationType: "aliado_de", strength: 5, label: "informaría a" },
    { from: "isolde", to: "consejo-real", relationType: "miembro_confirmado_de", strength: 8 },
    { from: "isolde", to: "marcus", relationType: "enemigo_de", strength: -4 },
    { from: "harwick", to: "aldric", relationType: "enemigo_de", strength: -7 },
    { from: "harwick", to: "elara", relationType: "relacionado_con", strength: -2, label: "quiere casar a su casa con" },
    { from: "harwick", to: "northmark", relationType: "controla", strength: 8 },
    { from: "harwick", to: "casa-harwick", relationType: "miembro_confirmado_de", strength: 10 },
    { from: "caldus", to: "elara", relationType: "aliado_de", strength: 8, label: "tutor de" },
    { from: "caldus", to: "serene", relationType: "aliado_de", strength: 6, label: "confidente de" },
    { from: "brenna", to: "elara", relationType: "aliado_de", strength: 7 },
    { from: "brenna", to: "serene", relationType: "aliado_de", strength: 9, label: "dama de" },
    { from: "brenna", to: "aldric", relationType: "enemigo_de", strength: -3, label: "le teme" },
    { from: "pell", to: "roderick", relationType: "aliado_de", strength: 7 },
    { from: "pell", to: "palacio-aldric", relationType: "vive_en", strength: 0 },
    { from: "gremio-mercaderes", to: "solhaven", relationType: "sede_en", strength: 0 },
    { from: "aldric", to: "gremio-mercaderes", relationType: "relacionado_con", strength: 2, label: "deudor político" },
    { from: "harwick", to: "gremio-mercaderes", relationType: "aliado_de", strength: 4 },
    { from: "casa-harwick", to: "northmark", relationType: "sede_en", strength: 0 },
    { from: "tregua-frontera", to: "solhaven", relationType: "ocurrio_en", strength: 0 },
    { from: "aldric", to: "tregua-frontera", relationType: "participo_en", strength: 0 },
    { from: "harwick", to: "tregua-frontera", relationType: "participo_en", strength: 0 },
    { from: "cronica-frontera", to: "northmark", relationType: "documenta", strength: 0 },
    { from: "cronica-frontera", to: "harwick", relationType: "documenta", strength: 0 },
];

function materialize(rawEntities, rawRelations) {
    const entities = rawEntities.map((e) => ({ ...e, id: e.slug }));
    const slugToId = new Map(entities.map((e) => [e.slug, e.id]));
    const relations = rawRelations
        .map((r, i) => ({
            id: `rel-${i}`,
            fromEntityId: slugToId.get(r.from ?? r.fromSlug) ?? r.from,
            toEntityId: slugToId.get(r.to ?? r.toSlug) ?? r.to,
            relationType: r.relationType,
            label: r.label ?? "",
            strength: r.strength ?? 0,
        }))
        .filter((r) => r.fromEntityId && r.toEntityId);
    return { entities, relations };
}

const seedMod = await import("./data/evalWikiSeed.mjs");
const medio = materialize(seedMod.ENTITIES, seedMod.RELATIONS);
const bajo = materialize(
    seedMod.ENTITIES.filter((e) => BAJO_SLUGS.has(e.slug)),
    seedMod.RELATIONS.filter((r) => BAJO_SLUGS.has(r.from) && BAJO_SLUGS.has(r.to))
);
const alto = materialize(
    [...seedMod.ENTITIES, ...ALTO_ENTITIES],
    [...seedMod.RELATIONS, ...ALTO_RELATIONS]
);

const GRAPHS = { bajo, medio, alto };
const AI_RULES = defaultAiRulesFromPresets();
const TYPE_LIST = getAiRelationTypeList();

function findAnchor(entities) {
    return entities.find((e) => e.slug === "elara");
}

function buildLevelContext(level) {
    const { entities, relations } = GRAPHS[level];
    const anchor = findAnchor(entities);
    const opts = level === "alto" ? ALTO_OPTS : DEPTH_OPTS;
    const ctx = buildCascadeContext(entities, relations, {
        anchorEntityId: anchor.id,
        eventText: INSTRUCTION,
        role: "dm",
        aiRules: AI_RULES,
        ...opts,
    }, entities);
    return { entities, relations, anchor, ctx, opts };
}

function buildImpactContext() {
    const { entities, relations } = medio;
    const anchor = findAnchor(entities);
    const ctx = buildSituationContext(entities, relations, {
        anchorEntityId: anchor.id,
        role: "dm",
        ...IMPACT_OPTS,
    });
    return { entities, relations, anchor, ctx };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const GEMINI_RETRYABLE = new Set([429, 500, 502, 503, 504]);

async function callGemini({ mode, systemPrompt, userPrompt, modelId, maxOutputTokens }) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error("Falta GEMINI_API_KEY o VITE_GEMINI_API_KEY en .env");
    const schema = mode === AI_MODES.CASCADE_SCOUT
        ? CASCADE_SCOUT_RESPONSE_SCHEMA
        : mode === AI_MODES.CASCADE
            ? CASCADE_RESPONSE_SCHEMA
            : NARRATIVE_IMPACT_RESPONSE_SCHEMA;
    const gen = resolveGenerationParams({}, mode);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
    const body = {
        contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n---\n\n${userPrompt}` }] }],
        generationConfig: {
            ...(USE_SCHEMA ? { responseMimeType: "application/json", responseSchema: schema } : {}),
            temperature: gen.temperature,
            topP: gen.topP,
            maxOutputTokens: maxOutputTokens ?? gen.maxOutputTokens,
            ...(USE_SCHEMA ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
    };
    let lastError = null;
    const httpRetries = [];
    for (let attempt = 0; attempt <= HTTP_RETRIES; attempt++) {
        const resp = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(120000),
        });
        if (resp.ok) {
            const data = await resp.json();
            const candidate = data.candidates?.[0];
            const raw = candidate?.content?.parts?.[0]?.text ?? "";
            if (!raw) throw new Error("Gemini devolvió respuesta vacía.");
            return {
                raw,
                usage: data.usageMetadata ?? null,
                finishReason: candidate?.finishReason ?? null,
                modelId,
                httpRetries,
            };
        }
        const errText = await resp.text();
        lastError = `Gemini ${resp.status}: ${errText.slice(0, 900)}`;
        httpRetries.push(resp.status);
        if (resp.status === 429 && /free_tier/i.test(errText)) break;
        if (GEMINI_RETRYABLE.has(resp.status) && attempt < HTTP_RETRIES) {
            const wait = 3000 * (2 ** attempt);
            console.warn(`  HTTP ${resp.status}, reintento ${attempt + 1} en ${wait}ms`);
            await sleep(wait);
            continue;
        }
        break;
    }
    const err = new Error(lastError ?? "Gemini falló");
    err.httpRetries = httpRetries;
    throw err;
}

function isHallucination(msg) {
    return /no encontrada|no existe en el contexto|Entidad inventada/i.test(String(msg ?? ""));
}

function tallyCascade(validation) {
    const hallucinations = [];
    const ruleRejects = [];
    let validChanges = 0;
    let invalidChanges = 0;
    const confidences = [];
    for (const imp of validation.impacts ?? []) {
        if (imp.confidence) confidences.push(imp.confidence);
        for (const e of imp.validationErrors ?? []) {
            if (isHallucination(e)) hallucinations.push(`${imp.entityTitle}: ${e}`);
            else ruleRejects.push(`${imp.entityTitle}: ${e}`);
        }
        for (const ch of imp.resolvedChanges ?? []) {
            if (ch.valid) validChanges += 1;
            else {
                invalidChanges += 1;
                const msg = ch.validationError || "";
                if (isHallucination(msg)) hallucinations.push(msg);
                else if (msg) ruleRejects.push(msg);
            }
        }
    }
    return { hallucinations, ruleRejects, validChanges, invalidChanges, confidences };
}

function tallyImpact(validation) {
    const hallucinations = [];
    const ruleRejects = [];
    let validChanges = 0;
    const confidences = [];
    for (const rel of validation.proposedRelations ?? []) {
        if (rel.confidence) confidences.push(rel.confidence);
        if (rel.valid) validChanges += 1;
        else if (isHallucination(rel.validationError)) hallucinations.push(rel.validationError);
        else if (rel.validationError) ruleRejects.push(rel.validationError);
    }
    return { hallucinations, ruleRejects, validChanges, invalidChanges: (validation.proposedRelations ?? []).length - validChanges, confidences };
}

function predominant(values) {
    const counts = new Map();
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
    let best = "—";
    let n = 0;
    for (const [k, c] of counts) {
        if (c > n) { best = k; n = c; }
    }
    return best;
}

function jsonParsed(raw) {
    try {
        JSON.parse(raw);
        return true;
    } catch {
        return false;
    }
}

async function runCascade(level, index) {
    const id = `cascade-${level}-${index}`;
    const { entities, relations, ctx } = buildLevelContext(level);
    const expected = ctx.meta.impactTargetCount ?? 0;
    let contextText = ctx.text;
    let scout = { used: false, ok: null, model: null, error: null };
    const calls = [];

    if (expected >= CASCADE_SCOUT_THRESHOLD) {
        scout.used = true;
        scout.model = SCOUT_MODEL;
        try {
            const scoutCtx = buildScoutContext(ctx.meta, findAnchor(entities).id, entities, relations);
            const scoutCall = await callGemini({
                mode: AI_MODES.CASCADE_SCOUT,
                systemPrompt: buildCascadeScoutSystemPrompt(),
                userPrompt: buildCascadeScoutUserPrompt(scoutCtx, INSTRUCTION),
                modelId: SCOUT_MODEL,
            });
            calls.push({ step: "scout", ...scoutCall, raw: undefined, rawLen: scoutCall.raw.length });
            let parsed = null;
            try { parsed = JSON.parse(scoutCall.raw); } catch { /* igual que el Lab */ }
            if (parsed?.impacts?.length) {
                const seedLines = [
                    "# Reacciones previstas — Pasa 1 Scout (referencia para elaborar):",
                    ...parsed.impacts.map(
                        (si) => `- ONDA ${si.wave}: ${si.entityTitle} · ${si.emotionalKeyword} · ${si.topChangeType} — ${si.topChangeDesc}`
                    ),
                    "",
                ];
                contextText = `${seedLines.join("\n")}---\n\n${ctx.text}`;
            }
            scout.ok = true;
            scout.impacts = parsed?.impacts?.length ?? 0;
        } catch (err) {
            scout.ok = false;
            scout.error = err.message;
        }
    }

    const impactCall = await callGemini({
        mode: AI_MODES.CASCADE,
        systemPrompt: `${buildCascadeSystemPrompt(TYPE_LIST)}\n\n${ctx.guardrailsText ?? ""}`.trim(),
        userPrompt: buildCascadeUserPrompt(contextText, INSTRUCTION, ctx.resolvedMentions ?? []),
        modelId: "gemini-2.5-flash",
    });
    calls.push({ step: "impact", modelId: impactCall.modelId, finishReason: impactCall.finishReason, usage: impactCall.usage, httpRetries: impactCall.httpRetries });

    const contextEntities = entities.filter((e) => ctx.meta.entityIds.includes(e.id));
    const expectedWaves = Object.fromEntries(
        (ctx.meta.impactTargetsDetailed ?? []).map((t) => [t.title, t.wave])
    );
    const explicitMentionIds = [...getExplicitlyMentionedEntityIds(INSTRUCTION, entities)];
    const validated = validateAiResponse(AI_MODES.CASCADE, impactCall.raw, contextEntities, entities, {
        requiredImpactTitles: ctx.meta.impactTargets ?? [],
        expectedWaves,
        aiRules: AI_RULES,
        explicitMentionIds,
        relations,
    });

    let reflexion = { used: false, ok: null, completedMissing: null, error: null };
    const isTruncated = validated.errors?.some((e) => e.includes("truncada") || e.includes("truncado"));
    const missingCount = validated.missingImpacts?.length ?? 0;
    const invalidTitles = validated.invalidChangeTitles ?? [];
    if (missingCount > 0 || isTruncated || invalidTitles.length > 0) {
        const titlesToRetry = [...new Set([
            ...(validated.missingImpacts ?? []),
            ...invalidTitles,
            ...(isTruncated && !validated.missingImpacts?.length && !invalidTitles.length
                ? (ctx.meta.impactTargets ?? [])
                : []),
        ].filter(Boolean))];
        if (titlesToRetry.length > 0) {
            reflexion.used = true;
            reflexion.titles = titlesToRetry;
            const invalidHints = [];
            for (const imp of [...(validated.impacts ?? []), ...(validated.collectiveImpacts ?? [])]) {
                if (!titlesToRetry.some((t) => t.toLowerCase() === imp.entityTitle?.toLowerCase())) continue;
                const errs = (imp.resolvedChanges ?? []).filter((c) => !c.valid).map((c) => c.validationError).filter(Boolean);
                if (errs.length) invalidHints.push({ entityTitle: imp.entityTitle, errors: errs });
            }
            try {
                const reflexionCtx = buildReflexionPrompt(titlesToRetry, ctx.text, INSTRUCTION, { invalidChangeHints: invalidHints });
                const retryCall = await callGemini({
                    mode: AI_MODES.CASCADE,
                    systemPrompt: `${buildCascadeSystemPrompt(TYPE_LIST)}\n\n${ctx.guardrailsText ?? ""}`.trim(),
                    userPrompt: buildCascadeUserPrompt(reflexionCtx, null, ctx.resolvedMentions ?? []),
                    modelId: "gemini-2.5-flash",
                });
                calls.push({ step: "reflexion", modelId: retryCall.modelId, finishReason: retryCall.finishReason, usage: retryCall.usage, httpRetries: retryCall.httpRetries });
                const retryValidated = validateAiResponse(AI_MODES.CASCADE, retryCall.raw, contextEntities, entities, {
                    requiredImpactTitles: titlesToRetry,
                    aiRules: AI_RULES,
                    explicitMentionIds,
                    relations,
                });
                const upsertByTitle = (base, incoming) => {
                    const out = [...(base ?? [])];
                    for (const item of incoming ?? []) {
                        const key = item.entityTitle?.toLowerCase().trim();
                        if (!key) continue;
                        const idx = out.findIndex((x) => x.entityTitle?.toLowerCase().trim() === key);
                        if (idx >= 0) out[idx] = item;
                        else out.push(item);
                    }
                    return out;
                };
                if (retryValidated.impacts?.length > 0) validated.impacts = upsertByTitle(validated.impacts, retryValidated.impacts);
                if (retryValidated.collectiveImpacts?.length > 0) {
                    validated.collectiveImpacts = upsertByTitle(validated.collectiveImpacts, retryValidated.collectiveImpacts);
                }
                const reportedSet = new Set(validated.impacts.map((i) => i.entityTitle?.toLowerCase().trim()).filter(Boolean));
                const beforeMissing = validated.missingImpacts?.length ?? 0;
                validated.missingImpacts = (ctx.meta.impactTargets ?? []).filter((t) => !reportedSet.has(t.toLowerCase().trim()));
                validated.errors = (validated.errors ?? []).filter((e) => !e.startsWith("Faltan reacciones") && !e.startsWith("Faltan impacts"));
                if (validated.missingImpacts.length === 0) {
                    validated.ok = validated.impacts.every((im) => im.valid);
                }
                reflexion.ok = true;
                reflexion.completedMissing = beforeMissing > 0 && validated.missingImpacts.length === 0;
                reflexion.raw = retryCall.raw;
            } catch (err) {
                reflexion.ok = false;
                reflexion.error = err.message;
            }
        }
    }

    const tally = tallyCascade(validated);
    return {
        id,
        mode: "cascade",
        level,
        index,
        instruction: INSTRUCTION,
        anchor: "Elara",
        fichasEnGrafo: entities.length,
        fichasEnviadas: ctx.meta.entityCount,
        relacionesEnviadas: ctx.meta.relationCount,
        charsContexto: ctx.text.length,
        charsAlImpacto: contextText.length,
        truncado: Boolean(ctx.meta.truncated),
        impactosEsperados: expected,
        impactosEsperadosTitulos: ctx.meta.impactTargets ?? [],
        scout,
        parseo: jsonParsed(impactCall.raw),
        finishReason: impactCall.finishReason,
        propuestasValidas: tally.validChanges,
        impactos: (validated.impacts ?? []).length,
        impactosValidos: (validated.impacts ?? []).filter((i) => i.valid).length,
        alucinaciones: tally.hallucinations,
        rechazosRegla: tally.ruleRejects,
        missingImpacts: validated.missingImpacts ?? [],
        reflexion,
        confianza: predominant(tally.confidences),
        ok: Boolean(validated.ok),
        errors: validated.errors ?? [],
        eventTitle: validated.eventTitle ?? "",
        blockedSuggestions: (validated.blockedSuggestions ?? []).length,
        calls,
        raw: impactCall.raw,
        modelImpact: impactCall.modelId,
    };
}

async function runImpact(index) {
    const id = `impact-medio-${index}`;
    const { entities, relations, ctx } = buildImpactContext();
    const call = await callGemini({
        mode: AI_MODES.NARRATIVE_IMPACT,
        systemPrompt: buildNarrativeImpactSystemPrompt(TYPE_LIST),
        userPrompt: buildNarrativeImpactUserPrompt(ctx.text, INSTRUCTION),
        modelId: IMPACT_MODEL,
    });
    const contextEntities = entities.filter((e) => ctx.meta.entityIds.includes(e.id));
    const explicitMentionIds = [...getExplicitlyMentionedEntityIds(INSTRUCTION, entities)];
    const validated = validateAiResponse(AI_MODES.NARRATIVE_IMPACT, call.raw, contextEntities, entities, {
        aiRules: AI_RULES,
        explicitMentionIds,
        relations,
    });
    const tally = tallyImpact(validated);
    return {
        id,
        mode: "narrative_impact",
        level: "medio",
        index,
        instruction: INSTRUCTION,
        anchor: "Elara",
        fichasEnGrafo: entities.length,
        fichasEnviadas: ctx.meta.entityCount,
        relacionesEnviadas: ctx.meta.relationCount,
        charsContexto: ctx.text.length,
        charsAlImpacto: ctx.text.length,
        truncado: Boolean(ctx.meta.truncated),
        impactosEsperados: null,
        scout: { used: false, ok: null },
        parseo: jsonParsed(call.raw),
        finishReason: call.finishReason,
        propuestasValidas: tally.validChanges,
        propuestas: (validated.proposedRelations ?? []).length,
        alucinaciones: tally.hallucinations,
        rechazosRegla: tally.ruleRejects,
        missingImpacts: [],
        reflexion: { used: false, ok: null, note: "El modo ondas no reintenta en el Lab." },
        confianza: predominant(tally.confidences),
        ok: Boolean(validated.ok),
        errors: validated.errors ?? [],
        summary: validated.summary ?? "",
        blockedSuggestions: (validated.blockedSuggestions ?? []).length,
        calls: [{ step: "impact", modelId: call.modelId, finishReason: call.finishReason, usage: call.usage, httpRetries: call.httpRetries }],
        raw: call.raw,
        modelImpact: call.modelId,
    };
}

function printDry() {
    for (const level of ["bajo", "medio", "alto"]) {
        const { entities, ctx, opts } = buildLevelContext(level);
        console.log([
            level,
            `grafo=${entities.length}`,
            `fichas=${ctx.meta.entityCount}`,
            `rels=${ctx.meta.relationCount}`,
            `chars=${ctx.text.length}`,
            `trunc=${ctx.meta.truncated}`,
            `impactos=${ctx.meta.impactTargetCount}`,
            `targets=${(ctx.meta.impactTargets ?? []).join(" | ")}`,
            `caps=${opts.maxEntities}/${opts.maxChars}`,
        ].join("  "));
    }
    const impact = buildImpactContext();
    console.log([
        "ondas-medio",
        `grafo=${impact.entities.length}`,
        `fichas=${impact.ctx.meta.entityCount}`,
        `rels=${impact.ctx.meta.relationCount}`,
        `chars=${impact.ctx.text.length}`,
        `trunc=${impact.ctx.meta.truncated}`,
    ].join("  "));
}

function jobs() {
    const list = [];
    for (const level of ["bajo", "medio", "alto"]) {
        for (let i = 1; i <= 5; i++) list.push({ kind: "cascade", level, index: i, id: `cascade-${level}-${i}` });
    }
    for (let i = 1; i <= 5; i++) list.push({ kind: "impact", level: "medio", index: i, id: `impact-medio-${i}` });
    return ONLY ? list.filter((j) => j.id.startsWith(ONLY) || j.level === ONLY || j.kind === ONLY) : list;
}

function loadAllRows(current) {
    const byId = new Map();
    if (existsSync(OUT_DIR)) {
        for (const name of readdirSync(OUT_DIR)) {
            if (!name.endsWith(".json") || name.endsWith(".raw.json")) continue;
            try {
                const row = JSON.parse(readFileSync(join(OUT_DIR, name), "utf8"));
                if (row?.id) byId.set(row.id, row);
            } catch { /* corrida a medias */ }
        }
    }
    for (const row of current) if (row?.id) byId.set(row.id, row);
    return [...byId.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function writeSummary(rows) {
    rows = loadAllRows(rows);
    const lines = [];
    lines.push("# Generaciones Aldermar — resultados");
    lines.push("");
    lines.push(`Fecha de corrida: ${new Date().toISOString()}`);
    lines.push("");
    lines.push("Instrucción única (Eval-01): " + INSTRUCTION);
    lines.push("");
    lines.push("Ancla: Elara. Temperatura 0.8. Nada se aplicó al Lore. El modelo de cada fila está en la tabla: la cascada usó gemini-2.5-flash, sin caída a flash-lite; las ondas usaron el modelo que quedó en esa corrida. Scout: gemini-2.5-flash-lite solo si los impactos esperados son 5 o más.");
    lines.push("");
    lines.push("| Id | Modo | Nivel | Modelo | Fichas | Chars | Trunc | Parseo | Válidas | Aluc. | Regla | Faltan | Reintento | Confianza |");
    lines.push("|---|---|---|---|---:|---:|---|---|---:|---:|---:|---|---|---|");
    for (const r of rows) {
        const retry = r.reflexion?.used
            ? (r.reflexion.ok ? (r.reflexion.completedMissing ? "sí, completó" : "sí, no completó") : "sí, falló")
            : "no";
        lines.push(`| ${r.id} | ${r.mode} | ${r.level} | ${r.modelImpact ?? "—"} | ${r.fichasEnviadas} | ${r.charsContexto} | ${r.truncado ? "sí" : "no"} | ${r.parseo ? "sí" : "no"} | ${r.propuestasValidas} | ${r.alucinaciones.length} | ${r.rechazosRegla.length} | ${(r.missingImpacts ?? []).join(", ") || "—"} | ${retry} | ${r.confianza} |`);
    }
    lines.push("");
    lines.push("## Detalle por corrida");
    lines.push("");
    for (const r of rows) {
        lines.push(`### ${r.id}`);
        lines.push("");
        lines.push(`- Grafo sembrado: ${r.fichasEnGrafo} fichas. Contexto: ${r.fichasEnviadas} fichas, ${r.relacionesEnviadas} relaciones, ${r.charsContexto} caracteres. Prompt de impacto: ${r.charsAlImpacto} caracteres.`);
        lines.push(`- Scout: ${r.scout?.used ? (r.scout.ok ? `sí (${r.scout.impacts ?? "?"} clasificaciones)` : `falló: ${r.scout.error}`) : "no (impactos esperados bajo el umbral de 5)"}.`);
        lines.push(`- Parseo JSON: ${r.parseo ? "sí" : "no"}. finishReason: ${r.finishReason ?? "—"}. Modelo: ${r.modelImpact ?? "—"}.`);
        lines.push(`- Propuestas válidas (cambios que el validador acepta): ${r.propuestasValidas}.`);
        lines.push(`- Alucinaciones (entidad fuera del contexto): ${r.alucinaciones.length ? r.alucinaciones.map((a) => `\`${a}\``).join("; ") : "ninguna"}.`);
        lines.push(`- Rechazos de regla: ${r.rechazosRegla.length ? r.rechazosRegla.map((a) => `\`${a}\``).join("; ") : "ninguno"}.`);
        lines.push(`- missingImpacts tras el reintento, si lo hubo: ${(r.missingImpacts ?? []).join(", ") || "ninguno"}.`);
        if (r.errors?.length) lines.push(`- Errores globales: ${r.errors.join(" | ")}`);
        lines.push("");
    }
    writeFileSync(join(OUT_DIR, "resumen.md"), lines.join("\n"), "utf8");
}

async function main() {
    if (DRY) {
        printDry();
        return;
    }
    mkdirSync(OUT_DIR, { recursive: true });
    const rows = [];
    for (const job of jobs()) {
        const dest = join(OUT_DIR, `${job.id}.json`);
        if (!FORCE && existsSync(dest)) {
            const prev = JSON.parse(readFileSync(dest, "utf8"));
            if (!prev.errorFatal) {
                console.log(`salta ${job.id} (ya existe)`);
                rows.push(prev);
                continue;
            }
            console.log(`reintenta ${job.id} (la corrida anterior no llegó al modelo)`);
        }
        console.log(`\n=== ${job.id} ===`);
        try {
            const row = job.kind === "cascade"
                ? await runCascade(job.level, job.index)
                : await runImpact(job.index);
            const { raw, ...stored } = row;
            writeFileSync(dest, JSON.stringify(stored, null, 2), "utf8");
            writeFileSync(join(OUT_DIR, `${job.id}.raw.json`), raw ?? "", "utf8");
            if (row.reflexion?.raw) {
                writeFileSync(join(OUT_DIR, `${job.id}.reflexion.raw.json`), row.reflexion.raw, "utf8");
                delete stored.reflexion.raw;
                writeFileSync(dest, JSON.stringify(stored, null, 2), "utf8");
            }
            rows.push(stored);
            console.log(`  fichas=${row.fichasEnviadas} chars=${row.charsContexto} válidas=${row.propuestasValidas} aluc=${row.alucinaciones.length} regla=${row.rechazosRegla.length} faltan=${(row.missingImpacts ?? []).length} retry=${row.reflexion?.used}`);
        } catch (err) {
            const fail = {
                id: job.id,
                mode: job.kind === "cascade" ? "cascade" : "narrative_impact",
                level: job.level,
                fichasEnviadas: "—",
                charsContexto: "—",
                truncado: false,
                parseo: false,
                propuestasValidas: 0,
                alucinaciones: [],
                rechazosRegla: [],
                missingImpacts: [],
                reflexion: { used: false },
                confianza: "—",
                errorFatal: err.message,
                httpRetries: err.httpRetries ?? [],
            };
            writeFileSync(dest, JSON.stringify(fail, null, 2), "utf8");
            rows.push(fail);
            console.error(`  FALLÓ ${job.id}: ${err.message}`);
        }
        writeSummary(rows);
        await sleep(1500);
    }
    writeSummary(rows);
    console.log(`\nListo. ${rows.length} filas en ${OUT_DIR}`);
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
