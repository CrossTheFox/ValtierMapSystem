/**
 * Rough token estimate (~4 chars per token for Latin text).
 * Used for Lab IA context budgeting before API calls.
 */
export function estimateTokenCount(text = "") {
    if (!text) return 0;
    const normalized = String(text).trim();
    if (!normalized) return 0;
    return Math.ceil(normalized.length / 4);
}

export function formatTokenEstimate(count) {
    if (count >= 1000) return `~${(count / 1000).toFixed(1)}k`;
    return `~${count}`;
}
