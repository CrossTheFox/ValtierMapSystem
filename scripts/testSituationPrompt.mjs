#!/usr/bin/env node
/**
 * testSituationPrompt.mjs
 *
 * CLI para probar el contexto de subgrafo y las llamadas a la IA antes de integrar en UI.
 *
 * Flags:
 *   --anchor=<slug>           Slug o título parcial de la entidad ancla
 *   --campaignId=<id>         Campaign Firestore ID (default: Valtia-01 hardcoded)
 *   --mode=situation|impact   Modo de generación (default: situation)
 *   --intent=<intent>         Intención para modo situation (conflicto, misterio, etc.)
 *   --instruction=<text>      Instrucción libre para modo impact (ej: "haz que Engel muera")
 *   --provider=gemini|openrouter
 *   --model=<modelId>         Override de modelo (default según proveedor)
 *   --dry                     Solo imprime contexto, sin llamar a la IA
 *   --local                   Usa seed local en lugar de Firestore
 *   --generate                Llama a la IA (equivalente a omitir --dry)
 *   --maxDepth=<n>            Profundidad BFS (default: 2)
 *   --maxEntities=<n>         Máx entidades (default: 25)
 *
 * Ejemplos:
 *   node scripts/testSituationPrompt.mjs --anchor=galathia --dry
 *   node scripts/testSituationPrompt.mjs --anchor=engel --mode=impact --instruction="haz que muera" --generate
 *   node scripts/testSituationPrompt.mjs --anchor=mirage --provider=openrouter --model=deepseek/deepseek-chat-v3-0324 --generate
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore }         from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";
import { join, dirname }        from "path";
import { fileURLToPath }        from "url";
import { createRequire }        from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require   = createRequire(import.meta.url);

// ── Parse args ────────────────────────────────────────────────────────────────

const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
        const [k, ...rest] = a.replace(/^--/, "").split("=");
        return [k, rest.length > 0 ? rest.join("=") : true];
    })
);

const CAMPAIGN_ID  = args.campaignId ?? "RfY23gcG7No5HcGddo1j";
const ANCHOR_SLUG  = args.anchor;
const MODE         = args.mode ?? "situation";
const INTENT       = args.intent ?? null;
const INSTRUCTION  = args.instruction ?? null;
const PROVIDER     = args.provider ?? "gemini";
const MODEL_ID     = args.model ?? (PROVIDER === "openrouter"
    ? "google/gemini-2.5-flash"
    : "gemini-2.5-flash");
const DRY_RUN      = Boolean(args.dry) && !Boolean(args.generate);
const USE_LOCAL    = Boolean(args.local);
const MAX_DEPTH    = parseInt(args.maxDepth ?? "2", 10);
const MAX_ENTITIES = parseInt(args.maxEntities ?? "25", 10);
// Propagation depth for cascade mode (Evento narrativo); overrides MAX_DEPTH/MAX_ENTITIES
const DEPTH        = args.depth ? parseInt(args.depth, 10) : null;

// ── Load shared modules from src (ES modules, no transpile needed) ────────────

// Build context (pure JS, no browser deps)
const { buildSituationContext, buildCascadeContext } = await import("../src/utils/buildSituationContext.js");
const { getAiRelationTypeList, KNOWN_WIKI_RELATION_TYPE_VALUES }
                                    = await import("../src/constants/wikiRelationTypes.js");
const {
    AI_MODES,
    SITUATION_RESPONSE_SCHEMA,
    NARRATIVE_IMPACT_RESPONSE_SCHEMA,
    CASCADE_RESPONSE_SCHEMA,
    buildSituationSystemPrompt,
    buildNarrativeImpactSystemPrompt,
    buildCascadeSystemPrompt,
    buildSituationUserPrompt,
    buildNarrativeImpactUserPrompt,
    buildCascadeUserPrompt,
    cascadeOptsForDepth,
}                                   = await import("../src/constants/wiki/narrativeAiSchemas.js");
const { validateAiResponse }        = await import("../src/utils/validateAiResponse.js");

// ── Firebase Admin init ───────────────────────────────────────────────────────

function initAdmin() {
    const keyPaths = [
        join(__dirname, "..", "valtier-map-system-firebase-admins.json"),
        join(__dirname, "..", "serviceAccount.json"),
    ];
    const keyPath = keyPaths.find(existsSync);
    if (!keyPath) {
        throw new Error(
            "No se encontró el service account JSON.\n" +
            "Coloca valtier-map-system-firebase-admins.json en la raíz del proyecto.\n" +
            "O usa --local para trabajar con el seed local sin Firestore."
        );
    }
    const credential = cert(JSON.parse(readFileSync(keyPath, "utf8")));
    initializeApp({ credential });
    return getFirestore();
}

// ── Load data ─────────────────────────────────────────────────────────────────

async function loadFromFirestore() {
    const db = initAdmin();
    const [entSnap, relSnap] = await Promise.all([
        db.collection("campaigns").doc(CAMPAIGN_ID).collection("wikiEntities").get(),
        db.collection("campaigns").doc(CAMPAIGN_ID).collection("entityRelations").get(),
    ]);
    const entities  = entSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const relations = relSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { entities, relations };
}

async function loadFromLocal() {
    const { ENTITIES, RELATIONS } = await import("./data/valtiaWikiSeed.mjs");
    // Seed uses slugs as IDs; simulate Firestore IDs
    const entities  = ENTITIES.map((e, i) => ({ ...e, id: e.slug ?? `local-${i}` }));
    const relations = RELATIONS.map((r, i) => ({
        id: `rel-${i}`,
        fromEntityId: r.from ?? r.fromSlug,
        toEntityId:   r.to ?? r.toSlug,
        relationType: r.relationType,
        label:        r.label ?? "",
        strength:     r.strength ?? 0,
    }));
    // Seed relations use slugs; resolve to IDs
    const slugToId = new Map(entities.map((e) => [e.slug, e.id]));
    const resolvedRels = relations
        .map((r) => ({
            ...r,
            fromEntityId: slugToId.get(r.fromEntityId) ?? r.fromEntityId,
            toEntityId:   slugToId.get(r.toEntityId)   ?? r.toEntityId,
        }))
        .filter((r) => r.fromEntityId && r.toEntityId);
    return { entities, relations: resolvedRels };
}

// ── Find anchor ───────────────────────────────────────────────────────────────

function findAnchor(entities, slug) {
    if (!slug) return null;
    const key = slug.toLowerCase().trim();
    return entities.find((e) =>
        (e.slug ?? "").toLowerCase() === key ||
        (e.title ?? "").toLowerCase().includes(key)
    ) ?? null;
}

// ── Env + HTTP helpers ────────────────────────────────────────────────────────

function loadDotEnv() {
    const dotenvPath = join(__dirname, "..", ".env");
    if (!existsSync(dotenvPath)) return;
    const env = readFileSync(dotenvPath, "utf8");
    for (const line of env.split("\n")) {
        const m = line.match(/^([A-Z_]+)=(.*)$/);
        if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const GEMINI_RETRYABLE = new Set([429, 500, 502, 503, 504]);
const GEMINI_MAX_RETRIES = 4;
const GEMINI_BASE_DELAY_MS = 2000;

// ── Gemini CLI call (using Gemini REST API directly, no Firebase SDK in Node) ──

function getResponseSchemaForMode(mode) {
    if (mode === "cascade" || mode === AI_MODES.CASCADE) return CASCADE_RESPONSE_SCHEMA;
    if (mode === "impact" || mode === AI_MODES.NARRATIVE_IMPACT) return NARRATIVE_IMPACT_RESPONSE_SCHEMA;
    return SITUATION_RESPONSE_SCHEMA;
}

function resolveActiveMode(mode) {
    if (mode === "impact") return AI_MODES.NARRATIVE_IMPACT;
    if (mode === "cascade") return AI_MODES.CASCADE;
    return AI_MODES.SITUATION;
}

async function callGeminiRestOnce(systemPrompt, userPrompt, modelId, mode, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
    const body = {
        contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n---\n\n${userPrompt}` }] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: getResponseSchemaForMode(mode),
            temperature: 0.8,
            maxOutputTokens: 4096,
            thinkingConfig: { thinkingBudget: 0 },
        },
    };

    const resp = await fetch(url, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
    });

    const errText = resp.ok ? null : await resp.text();
    return { ok: resp.ok, status: resp.status, errText, resp };
}

async function callGeminiRest(systemPrompt, userPrompt, modelId, mode) {
    loadDotEnv();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error(
            "GEMINI_API_KEY no encontrada en .env.\n" +
            "Obtén una en https://aistudio.google.com/apikey y agrégala a .env:\n" +
            "GEMINI_API_KEY=AIza..."
        );
    }

    const modelsToTry = modelId === "gemini-2.5-flash"
        ? ["gemini-2.5-flash", "gemini-2.5-flash-lite"]
        : [modelId];

    let lastError = null;

    for (const currentModel of modelsToTry) {
        if (currentModel !== modelId) {
            console.warn(`  ⚠️ Cambiando a modelo alternativo: ${currentModel}`);
        }

        for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt++) {
            const { ok, status, errText, resp } = await callGeminiRestOnce(
                systemPrompt, userPrompt, currentModel, mode, apiKey
            );

            if (ok) {
                const data         = await resp.json();
                const candidate    = data.candidates?.[0];
                const raw          = candidate?.content?.parts?.[0]?.text ?? "";
                const usage        = data.usageMetadata ?? null;
                const finishReason = candidate?.finishReason ?? null;
                return { raw, usage, finishReason, modelUsed: currentModel };
            }

            lastError = `Gemini REST error ${status}: ${errText}`;

            if (GEMINI_RETRYABLE.has(status) && attempt < GEMINI_MAX_RETRIES) {
                const delaySec = (GEMINI_BASE_DELAY_MS * (2 ** attempt)) / 1000;
                console.warn(`  ⚠️ Gemini ${status} (demanda alta), reintento ${attempt + 1}/${GEMINI_MAX_RETRIES} en ${delaySec}s…`);
                await sleep(GEMINI_BASE_DELAY_MS * (2 ** attempt));
                continue;
            }

            break;
        }
    }

    throw new Error(
        `${lastError}\n\nSugerencia: espera 1–2 minutos y reintenta, o usa:\n` +
        `  --provider=openrouter --model=google/gemini-2.5-flash`
    );
}

async function callOpenRouterRest(systemPrompt, userPrompt, modelId) {
    loadDotEnv();

    const apiKey = process.env.VITE_OPENROUTER_API_KEY;
    if (!apiKey) {
        throw new Error(
            "VITE_OPENROUTER_API_KEY no encontrada en .env.\n" +
            "Obtén una en https://openrouter.ai y agrégala a .env."
        );
    }

    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method:  "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type":  "application/json",
            "HTTP-Referer":  "http://localhost:5173",
            "X-Title":       "pixi-map CLI",
        },
        body: JSON.stringify({
            model:       modelId,
            messages:    [
                { role: "system", content: systemPrompt },
                { role: "user",   content: userPrompt },
            ],
            max_tokens:  2048,
            temperature: 0.8,
        }),
    });

    if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`OpenRouter error ${resp.status}: ${err}`);
    }

    const data  = await resp.json();
    const raw   = data.choices?.[0]?.message?.content ?? "";
    const usage = data.usage ?? null;

    if (!raw) {
        throw new Error(`OpenRouter devolvió respuesta vacía. finish_reason: ${data.choices?.[0]?.finish_reason ?? "?"}`);
    }

    return { raw, usage };
}

// ── Pretty print ──────────────────────────────────────────────────────────────

function hr(char = "─", len = 60) { return char.repeat(len); }

function printMeta(meta) {
    console.log(`\n${hr()}`);
    console.log("METADATOS DEL SUBGRAFO");
    console.log(hr());
    console.log(`Ancla:         ${meta.anchorTitle ?? "(sin ancla)"}`);
    console.log(`Fichas:        ${meta.entityCount}${meta.mentionExpanded ? ` (+${meta.mentionExpanded} por @[mención])` : ""}`);
    console.log(`Relaciones:    ${meta.relationCount}`);
    console.log(`Truncado:      ${meta.truncated ? "SÍ ⚠️" : "no"}`);
    console.log(`Tipos usados:  ${meta.relationTypesUsed.join(", ") || "(ninguno)"}`);
    if (meta.impactTargets?.length) {
        console.log(`Impact targets: ${meta.impactTargets.join(", ")}`);
    }
    if (meta.collectiveTargets?.length) {
        const names = meta.collectiveTargets.map((t) => (typeof t === "string" ? t : t.title ?? t.id ?? "?"));
        console.log(`Colectivos:     ${names.join(", ")}`);
    }
    if (meta.impactTargetCount != null) {
        console.log(`Impact requeridos: ${meta.impactTargetCount}`);
    }
}

function printValidation(validation, mode) {
    console.log(`\n${hr()}`);
    console.log("VALIDACIÓN");
    console.log(hr());
    console.log(`Estado: ${validation.ok ? "✅ OK" : "⚠️ Con problemas"}`);

    if (validation.errors.length) {
        console.log("Errores globales:");
        validation.errors.forEach((e) => console.log(`  ✗ ${e}`));
    }

    if (mode === AI_MODES.SITUATION) {
        (validation.situations ?? []).forEach((s, i) => {
            console.log(`\nSituación ${i + 1}: "${s.title}" [${s.confidence}]`);
            if (s._errors?.length) {
                s._errors.forEach((e) => console.log(`  ✗ ${e}`));
            } else {
                console.log(`  ✓ hook: ${s.hook?.slice(0, 80)}…`);
                console.log(`  ✓ stakes: ${s.stakes?.slice(0, 80)}…`);
                console.log(`  ✓ entidades: ${s.involvedEntities?.map((e) => e.title).join(", ")}`);
                if (s.dramaticQuestions?.length) {
                    console.log(`  ✓ preguntas: ${s.dramaticQuestions.join(" | ")}`);
                }
            }
        });
    } else if (mode === AI_MODES.CASCADE) {
        console.log(`\nEvento: ${validation.eventTitle}`);
        console.log(`Resumen: ${validation.eventSummary}`);
        if (validation.missingImpacts?.length) {
            console.log(`\nImpacts faltantes: ${validation.missingImpacts.join(", ")}`);
        }
        if (validation.waveMismatches?.length) {
            console.log(`\nOndas incorrectas:`);
            validation.waveMismatches.forEach((wm) => {
                console.log(`  ${wm.title}: esperada ${wm.expected}, recibida ${wm.got}`);
            });
        }
        console.log(`\nImpacts: ${validation.impacts?.length ?? 0}`);
        (validation.impacts ?? []).forEach((imp) => {
            const icon = imp.valid ? "✅" : "❌";
            console.log(`  ${icon} [onda ${imp.wave}] ${imp.entityTitle} [${imp.confidence}]`);
            if (imp.validationErrors?.length) {
                imp.validationErrors.forEach((e) => console.log(`     ✗ ${e}`));
            }
            const validCh = (imp.resolvedChanges ?? []).filter((c) => c.valid).length;
            const totalCh = imp.resolvedChanges?.length ?? 0;
            if (totalCh > 0) console.log(`     cambios: ${validCh}/${totalCh} válidos`);
        });
        if (validation.blockedSuggestions?.length) {
            console.log(`\nBloqueadas: ${validation.blockedSuggestions.length}`);
            validation.blockedSuggestions.forEach((b) => console.log(`  🚫 ${b.description}`));
        }
        if (validation.dmNotes) console.log(`\nNotas DM: ${validation.dmNotes}`);
    } else {
        console.log(`\nResumen: ${validation.summary}`);
        console.log(`\nRelaciones propuestas: ${validation.proposedRelations?.length ?? 0}`);
        (validation.proposedRelations ?? []).forEach((r) => {
            const icon = r.valid ? "✅" : "❌";
            console.log(`  ${icon} [${r.action}] ${r.fromEntityTitle} → [${r.relationType}] → ${r.toEntityTitle} [${r.confidence}]`);
            console.log(`     Razón: ${r.reason}`);
            if (!r.valid) console.log(`     Error: ${r.validationError}`);
        });

        if (validation.blockedSuggestions?.length) {
            console.log(`\nBloqueadas (requieren acción manual): ${validation.blockedSuggestions.length}`);
            validation.blockedSuggestions.forEach((b) => {
                console.log(`  🚫 ${b.description}: ${b.reason}`);
            });
        }

        if (validation.dmNotes) {
            console.log(`\nNotas DM: ${validation.dmNotes}`);
        }
    }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log(`\n${"═".repeat(60)}`);
    console.log("🗺  Valtia-01 — Test Situation Prompt");
    console.log("═".repeat(60));
    console.log(`Modo:       ${MODE}`);
    console.log(`Proveedor:  ${PROVIDER} / ${MODEL_ID}`);
    console.log(`Fuente:     ${USE_LOCAL ? "local (seed)" : `Firestore (${CAMPAIGN_ID})`}`);
    console.log(`Ancla:      ${ANCHOR_SLUG ?? "(ninguna)"}`);
    if (MODE === "impact" || MODE === "cascade") console.log(`Instrucción: ${INSTRUCTION ?? "(vacía)"}`);
    if (DEPTH) console.log(`Profundidad: ${DEPTH} ondas (--depth)`);
    if (DRY_RUN) console.log("Modo:       --dry (sin llamada a IA)\n");

    if ((MODE === "cascade") && !INSTRUCTION && !DRY_RUN) {
        console.error("❌ Modo cascade requiere --instruction=<texto del evento>.");
        process.exitCode = 1;
        return;
    }

    // 1. Load data
    console.log("\nCargando datos…");
    const { entities, relations } = USE_LOCAL
        ? await loadFromLocal()
        : await loadFromFirestore();
    console.log(`  ${entities.length} entidades, ${relations.length} relaciones cargadas.`);

    // 2. Find anchor
    const anchor = findAnchor(entities, ANCHOR_SLUG);
    if (ANCHOR_SLUG && !anchor) {
        console.warn(`⚠️  No se encontró entidad con slug/título "${ANCHOR_SLUG}". Se usará contexto general.`);
    } else if (anchor) {
        console.log(`  Ancla resuelta: "${anchor.title}" [${anchor.entityType}]`);
    }

    // 3. Build context
    const activeMode = resolveActiveMode(MODE);
    const relationTypeList = getAiRelationTypeList();

    let ctx;
    if (activeMode === AI_MODES.CASCADE) {
        const depthOpts = DEPTH ? cascadeOptsForDepth(DEPTH) : {};
        ctx = buildCascadeContext(entities, relations, {
            anchorEntityId: anchor?.id,
            eventText: INSTRUCTION ?? "",
            role: "dm",
            ...depthOpts,
        }, entities);
    } else {
        ctx = buildSituationContext(entities, relations, {
            anchorEntityId: anchor?.id,
            intent:    INTENT,
            role:      "dm",
            maxDepth:  MAX_DEPTH,
            maxEntities: MAX_ENTITIES,
        });
    }

    printMeta(ctx.meta);

    // Print context preview
    const previewLen = 800;
    console.log(`\n${hr()}`);
    console.log("CONTEXTO (primeros 800 chars)");
    console.log(hr());
    console.log(ctx.text.slice(0, previewLen));
    if (ctx.text.length > previewLen) console.log(`… (+${ctx.text.length - previewLen} chars)`);
    console.log(`\nTotal: ${ctx.text.length} chars`);

    if (DRY_RUN) {
        console.log(`\n${hr()}`);
        console.log("--dry: no se llamó a la IA.");
        return;
    }

    // 4. Build prompts
    const systemPrompt = activeMode === AI_MODES.CASCADE
        ? buildCascadeSystemPrompt(relationTypeList)
        : activeMode === AI_MODES.NARRATIVE_IMPACT
            ? buildNarrativeImpactSystemPrompt(relationTypeList)
            : buildSituationSystemPrompt();

    const userPrompt = activeMode === AI_MODES.CASCADE
        ? buildCascadeUserPrompt(ctx.text, INSTRUCTION ?? "", ctx.resolvedMentions ?? [])
        : activeMode === AI_MODES.NARRATIVE_IMPACT
            ? buildNarrativeImpactUserPrompt(ctx.text, INSTRUCTION ?? "")
            : buildSituationUserPrompt(ctx.text, INTENT);

    // 5. Call AI
    console.log(`\n${hr()}`);
    console.log(`Llamando a ${PROVIDER} (${MODEL_ID})…`);
    const startMs = Date.now();

    let raw, usage, finishReason, modelUsed;
    try {
        if (PROVIDER === "openrouter") {
            ({ raw, usage } = await callOpenRouterRest(systemPrompt, userPrompt, MODEL_ID));
        } else {
            ({ raw, usage, finishReason, modelUsed } = await callGeminiRest(systemPrompt, userPrompt, MODEL_ID, MODE));
        }
    } catch (err) {
        console.error(`\n❌ Error al llamar a la IA:\n${err.message}`);
        process.exitCode = 1;
        return;
    }

    console.log(`  Respuesta en ${Date.now() - startMs}ms`);
    if (modelUsed && modelUsed !== MODEL_ID) console.log(`  Modelo usado: ${modelUsed}`);
    if (finishReason) console.log(`  finishReason: ${finishReason}`);
    if (usage) {
        console.log(`  Tokens — input: ${usage.promptTokenCount ?? usage.prompt_tokens ?? "?"}, output: ${usage.candidatesTokenCount ?? usage.completion_tokens ?? "?"}`);
    }

    // 6. Print raw
    console.log(`\n${hr()}`);
    console.log("RESPUESTA RAW");
    console.log(hr());
    console.log(raw.slice(0, 1200));
    if (raw.length > 1200) console.log(`… (+${raw.length - 1200} chars)`);

    // 7. Validate
    const contextEntities = entities.filter((e) => ctx.meta.entityIds.includes(e.id));
    const expectedWaves = Object.fromEntries(
        (ctx.meta.impactTargetsDetailed ?? []).map((t) => [t.title, t.wave])
    );
    const validation = validateAiResponse(activeMode, raw, contextEntities, entities, activeMode === AI_MODES.CASCADE
        ? { requiredImpactTitles: ctx.meta.impactTargets ?? [], expectedWaves }
        : null);

    printValidation(validation, activeMode);

    console.log(`\n${"═".repeat(60)}`);
    if (validation.ok) {
        console.log("✅  Criterio de salida: PASADO (sin entidades inventadas)");
    } else {
        console.log("⚠️  Criterio de salida: FALLIDO — revisar errores arriba");
    }
    console.log("═".repeat(60) + "\n");
}

main().catch((err) => {
    console.error("\n❌  Error fatal:", err.message);
    process.exitCode = 1;
});
