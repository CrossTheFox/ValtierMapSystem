/**
 * Resolución de API key Gemini para Lab IA (solo VITE_GEMINI_API_KEY del build).
 */

/** @returns {string} */
export function resolveGeminiApiKey() {
    return import.meta.env.VITE_GEMINI_API_KEY || "";
}

export function hasGeminiApiKeyConfigured() {
    return Boolean(resolveGeminiApiKey());
}
