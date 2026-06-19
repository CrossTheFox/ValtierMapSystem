/**
 * narrativeAiService.js
 *
 * Unified interface for AI narrative generation.
 * Supports two providers: "gemini" (Firebase AI Logic) and "openrouter" (REST).
 * Both modes: "situation" and "narrative_impact".
 *
 * Usage:
 *   const result = await generateNarrativeAi({
 *     mode: "narrative_impact",
 *     contextText: ctx.text,
 *     instruction: "haz que Engel muera",
 *     provider: "gemini",
 *     modelId: "gemini-2.5-flash",
 *   });
 *   // result.parsed → validated by caller via validateAiResponse
 */

import { getStructuredGeminiModel } from "../aiConfig";
import {
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
} from "../../src/constants/wiki/narrativeAiSchemas";
import { getAiRelationTypeList } from "../../src/constants/wikiRelationTypes";
import { resolveGenerationParams } from "../../src/constants/wiki/narrativeAiConfig";
import { resolveGeminiApiKey } from "../../src/utils/aiApiKeys";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSchema(mode) {
    if (mode === AI_MODES.SITUATION)        return SITUATION_RESPONSE_SCHEMA;
    if (mode === AI_MODES.CASCADE)          return CASCADE_RESPONSE_SCHEMA;
    return NARRATIVE_IMPACT_RESPONSE_SCHEMA;
}

function getSystemPrompt(mode, guardrailsText) {
    const typeList = getAiRelationTypeList();
    let prompt;
    if (mode === AI_MODES.SITUATION)        prompt = buildSituationSystemPrompt();
    else if (mode === AI_MODES.CASCADE)     prompt = buildCascadeSystemPrompt(typeList);
    else                                    prompt = buildNarrativeImpactSystemPrompt(typeList);

    if (guardrailsText?.trim()) {
        prompt = `${prompt}\n\n${guardrailsText.trim()}`;
    }
    return prompt;
}

function getUserPrompt(mode, contextText, { intent, instruction, resolvedMentions }) {
    if (mode === AI_MODES.SITUATION) {
        return buildSituationUserPrompt(contextText, intent);
    }
    if (mode === AI_MODES.CASCADE) {
        return buildCascadeUserPrompt(contextText, instruction ?? "", resolvedMentions ?? []);
    }
    return buildNarrativeImpactUserPrompt(contextText, instruction ?? "");
}

// ── Gemini providers ──────────────────────────────────────────────────────────

const GEMINI_RETRYABLE = new Set([429, 500, 502, 503, 504]);
const GEMINI_MAX_RETRIES = 3;
const GEMINI_BASE_DELAY_MS = 2000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const CASCADE_OUTPUT_TOKENS = 8192;
const DEFAULT_OUTPUT_TOKENS = 4096;

function outputTokenLimit(mode) {
    return mode === AI_MODES.CASCADE ? CASCADE_OUTPUT_TOKENS : DEFAULT_OUTPUT_TOKENS;
}

function getGenConfig(mode, generationParams) {
    return resolveGenerationParams(generationParams ?? {}, mode);
}

async function callGeminiDirect({ mode, contextText, modelId, intent, instruction, resolvedMentions, guardrailsText, generationParams, apiKey: apiKeyOverride }) {
    const apiKey = apiKeyOverride || resolveGeminiApiKey();
    if (!apiKey) {
        throw new Error(
            "No hay API key de Gemini. "
            + "Pégala en Lab IA → «Tu API key» o añade VITE_GEMINI_API_KEY al .env y reinicia el dev server."
        );
    }

    const systemPrompt = getSystemPrompt(mode, guardrailsText);
    const userPrompt   = getUserPrompt(mode, contextText, { intent, instruction, resolvedMentions });
    const schema       = getSchema(mode);
    const modelsToTry  = modelId === "gemini-2.5-flash"
        ? ["gemini-2.5-flash", "gemini-2.5-flash-lite"]
        : [modelId];

    const gen = getGenConfig(mode, generationParams);

    let lastError = null;

    for (const currentModel of modelsToTry) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;
        const body = {
            contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n---\n\n${userPrompt}` }] }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: schema,
                temperature: gen.temperature,
                topP: gen.topP,
                maxOutputTokens: gen.maxOutputTokens,
                thinkingConfig: { thinkingBudget: 0 },
            },
        };

        for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt++) {
            const resp = await fetch(url, {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify(body),
            });

            if (resp.ok) {
                const data         = await resp.json();
                const candidate    = data.candidates?.[0];
                const raw          = candidate?.content?.parts?.[0]?.text ?? "";
                const usage        = data.usageMetadata ?? null;
                if (!raw) {
                    throw new Error("Gemini API devolvió respuesta vacía.");
                }
                return { raw, usage, modelId: currentModel };
            }

            const errText = await resp.text();
            lastError = `Gemini API error ${resp.status}: ${errText}`;

            if (GEMINI_RETRYABLE.has(resp.status) && attempt < GEMINI_MAX_RETRIES) {
                await sleep(GEMINI_BASE_DELAY_MS * (2 ** attempt));
                continue;
            }
            break;
        }
    }

    throw new Error(lastError ?? "Error desconocido al llamar a Gemini API.");
}

async function callGemini({ mode, contextText, modelId, intent, instruction, resolvedMentions, guardrailsText, generationParams }) {
    const schema = getSchema(mode);
    const gen    = getGenConfig(mode, generationParams);
    const model  = getStructuredGeminiModel(modelId, schema, {
        maxOutputTokens: gen.maxOutputTokens,
        temperature:     gen.temperature,
        topP:            gen.topP,
    });

    const systemPrompt = getSystemPrompt(mode, guardrailsText);
    const userPrompt   = getUserPrompt(mode, contextText, { intent, instruction, resolvedMentions });

    // Gemini supports system instructions via a separate field in newer SDK.
    // For firebase/ai SDK, prepend system prompt to the user content.
    const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;

    const result   = await model.generateContent(fullPrompt);
    const raw      = result.response.text();
    const usage    = result.response.usageMetadata ?? null;

    return { raw, usage };
}

// ── OpenRouter provider ───────────────────────────────────────────────────────

async function callOpenRouter({ mode, contextText, modelId, intent, instruction, resolvedMentions, guardrailsText, generationParams, apiKey: apiKeyOverride }) {
    const apiKey = apiKeyOverride || resolveOpenRouterApiKey();
    if (!apiKey) {
        throw new Error(
            "No hay API key de OpenRouter. "
            + "Pégala en Lab IA → «Tu API key» o añade VITE_OPENROUTER_API_KEY al .env."
        );
    }

    const systemPrompt = getSystemPrompt(mode, guardrailsText);
    const userPrompt   = getUserPrompt(mode, contextText, { intent, instruction, resolvedMentions });
    const schema       = getSchema(mode);
    const gen          = getGenConfig(mode, generationParams);

    // Use json_schema response_format if supported; models that don't support it
    // will ignore it and the validator handles malformed output.
    const body = {
        model: modelId,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user",   content: userPrompt },
        ],
        response_format: {
            type: "json_schema",
            json_schema: {
                name: mode === AI_MODES.SITUATION
                    ? "situation_response"
                    : mode === AI_MODES.CASCADE
                        ? "cascade_response"
                        : "narrative_impact_response",
                strict: false,
                schema,
            },
        },
        max_tokens: gen.maxOutputTokens,
        temperature: gen.temperature,
        top_p: gen.topP,
    };

    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type":  "application/json",
            "HTTP-Referer":  window.location.origin,
            "X-Title":       "pixi-map / Valtia-01",
        },
        body: JSON.stringify(body),
    });

    if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`OpenRouter error ${resp.status}: ${err}`);
    }

    const data  = await resp.json();
    const raw   = data.choices?.[0]?.message?.content ?? "";
    const usage = data.usage ?? null;

    if (!raw) {
        const reason = data.choices?.[0]?.finish_reason;
        throw new Error(`OpenRouter devolvió respuesta vacía. finish_reason: ${reason ?? "desconocido"}`);
    }

    return { raw, usage };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate an AI narrative response.
 *
 * @param {{
 *   mode: "situation" | "narrative_impact" | "cascade",
 *   contextText: string,
 *   intent?: string,              — situación only
 *   instruction?: string,         — narrative_impact + cascade
 *   resolvedMentions?: object[],  — cascade: pre-resolved entity mentions
 *   guardrailsText?: string,      — reglas DJ (fallecidos, etc.)
 *   generationParams?: object,    — temperature, topP, maxOutputTokens
 *   provider: "gemini" | "gemini_direct" | "openrouter",
 *   modelId: string,
 *   apiKeys?: { gemini?: string, openrouter?: string },
 * }} params
 * @returns {Promise<{ raw: string, usage: object|null, provider: string, modelId: string }>}
 */
export async function generateNarrativeAi({
    mode,
    contextText,
    intent,
    instruction,
    resolvedMentions,
    guardrailsText,
    generationParams,
    provider,
    modelId,
    apiKeys,
}) {
    if (!contextText?.trim()) {
        throw new Error("contextText está vacío. Verifica que la entidad ancla tiene relaciones.");
    }

    let raw;
    let usage;
    let usedModelId = modelId;

    const callOpts = {
        mode, contextText, modelId, intent, instruction, resolvedMentions, guardrailsText, generationParams,
        apiKey: provider === "gemini_direct"
            ? (apiKeys?.gemini || resolveGeminiApiKey())
            : provider === "openrouter"
                ? (apiKeys?.openrouter || resolveOpenRouterApiKey())
                : undefined,
    };
    if (provider === "gemini") {
        ({ raw, usage } = await callGemini(callOpts));
    } else if (provider === "gemini_direct") {
        const direct = await callGeminiDirect(callOpts);
        raw = direct.raw;
        usage = direct.usage;
        usedModelId = direct.modelId ?? modelId;
    } else if (provider === "openrouter") {
        ({ raw, usage } = await callOpenRouter(callOpts));
    } else {
        throw new Error(`Proveedor desconocido: "${provider}". Usa "gemini", "gemini_direct" u "openrouter".`);
    }

    return { raw, usage, provider, modelId: usedModelId };
}
