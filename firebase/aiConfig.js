/**
 * aiConfig.js
 *
 * Firebase AI Logic initialization. Provides factory functions for Gemini models
 * via the Gemini Developer API backend.
 *
 * IMPORTANT: Run `npx -y firebase-tools@latest init ailogic` once per project
 * to provision the service; otherwise calls will fail with PERMISSION_DENIED.
 */

import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";
import { app } from "./firebaseConfig";

let _ai = null;

function getAIInstance() {
    if (!_ai) {
        _ai = getAI(app, { backend: new GoogleAIBackend() });
    }
    return _ai;
}

/**
 * Returns a GenerativeModel configured for JSON structured output.
 *
 * @param {string} modelName         — e.g. "gemini-2.5-flash"
 * @param {object} responseSchema    — JSON schema object (SITUATION_RESPONSE_SCHEMA, etc.)
 * @param {object} [extraConfig]     — extra generationConfig fields (temperature, thinkingBudget, etc.)
 */
export function getStructuredGeminiModel(modelName, responseSchema, extraConfig = {}) {
    const ai = getAIInstance();
    return getGenerativeModel(ai, {
        model: modelName,
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema,
            temperature: 0.8,
            maxOutputTokens: 4096,
            // Gemini 2.5 reserva tokens para "thinking"; desactivar en JSON estructurado.
            thinkingConfig: { thinkingBudget: 0 },
            ...extraConfig,
        },
    });
}

/**
 * Simple text model (no schema enforcement) — useful for debugging prompts.
 */
export function getTextGeminiModel(modelName = "gemini-2.5-flash-lite") {
    const ai = getAIInstance();
    return getGenerativeModel(ai, {
        model: modelName,
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
        },
    });
}
