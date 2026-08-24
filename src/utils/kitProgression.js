/**
 * G11 kit progression — `unlockedKitNodes[]` resolve / migrate / spend / gate.
 *
 * `unlockedKitNodes[]` REPLACES `unlockedAbilities[]` as the live source of truth for
 * "what the character can use": both base ability/trait/LB nodes *and* their
 * talent/mastery children (T1/T2/M), unifying ownership + talent-unlock into one array
 * (see DECISION-LOG G11). `unlockedAbilities[]`/`allAbilities[]` stay on the doc
 * untouched — never written again, kept as historical data, nothing deleted.
 *
 * Modes:
 * - **Strict** — `character.unlockedKitNodes` is a real array → used as-is.
 * - **Grandfather** (never migrated) — base ability/trait/LB nodes are unlocked if
 *   they belong to the character's job/legacy list today (so nothing already in play
 *   breaks); talent/mastery nodes are NOT grandfathered (never surfaced in the UI
 *   before Slice 4 — nothing is lost by starting them locked).
 *
 * The moment the player unlocks anything, `unlockedKitNodes` is persisted as a real
 * array and the character permanently switches to strict mode.
 *
 * A node with `unlockCostAP` missing or `0` is always treated as unlocked (no gating)
 * — only nodes with a DM-assigned positive cost require the spend flow.
 */

/** Talent/mastery child node id — namespaced under its parent ability/trait/LB key. */
export function kitTalentNodeId(parentKey, slot) {
    return `${parentKey}::${slot}`;
}

/** @returns {boolean} true once `character.unlockedKitNodes` is a real (migrated) array. */
export function isKitProgressionMigrated(character) {
    return Array.isArray(character?.unlockedKitNodes);
}

/**
 * Resolve the effective set of unlocked kit node ids.
 * @param {Record<string, unknown>|null|undefined} character
 * @param {{ ownedBaseNodeIds?: string[] }} [ctx] — base node ids the character owns
 *   today (job-linked abilities/traits/LB, or legacy `allAbilities`/`unlockedAbilities`).
 *   Only consulted in grandfather mode.
 * @returns {Set<string>}
 */
export function resolveUnlockedKitNodes(character, ctx = {}) {
    if (isKitProgressionMigrated(character)) {
        return new Set(character.unlockedKitNodes.map(String));
    }
    const owned = Array.isArray(ctx.ownedBaseNodeIds) ? ctx.ownedBaseNodeIds : [];
    return new Set(owned.map(String).filter(Boolean));
}

/**
 * @param {Record<string, unknown>|null|undefined} character
 * @param {{ id: string, unlockCostAP?: number|null }} node
 * @param {{ ownedBaseNodeIds?: string[] }} [ctx]
 */
export function isKitNodeUnlocked(character, node, ctx = {}) {
    const cost = Number(node?.unlockCostAP) || 0;
    if (cost <= 0) return true;
    if (!node?.id) return false;
    return resolveUnlockedKitNodes(character, ctx).has(String(node.id));
}

/**
 * @param {Record<string, unknown>|null|undefined} character
 * @param {{ id: string, unlockCostAP?: number|null }} node
 * @param {{ ownedBaseNodeIds?: string[] }} [ctx]
 * @returns {{ ok: boolean, reason?: "no_cost"|"already_unlocked"|"insufficient_ap" }}
 */
export function canUnlockNode(character, node, ctx = {}) {
    const cost = Number(node?.unlockCostAP) || 0;
    if (cost <= 0) return { ok: false, reason: "no_cost" };
    if (isKitNodeUnlocked(character, node, ctx)) return { ok: false, reason: "already_unlocked" };
    const ap = Math.floor(Number(character?.ap) || 0);
    if (ap < cost) return { ok: false, reason: "insufficient_ap" };
    return { ok: true };
}

/**
 * Spend AP to unlock a node. Freezes the character into strict mode: the returned
 * `unlockedKitNodes` patch is the *full* resolved array (grandfathered nodes included)
 * plus the newly unlocked node — never a bare append, so nothing already in play
 * disappears the instant strict mode kicks in.
 * @param {Record<string, unknown>|null|undefined} character
 * @param {{ id: string, unlockCostAP?: number|null }} node
 * @param {{ ownedBaseNodeIds?: string[] }} [ctx]
 * @returns {{ ap: number, unlockedKitNodes: string[] }|null} Firestore-ready patch, or
 *   `null` when the unlock isn't allowed (see {@link canUnlockNode}).
 */
export function unlockNode(character, node, ctx = {}) {
    const check = canUnlockNode(character, node, ctx);
    if (!check.ok) return null;
    const cost = Number(node.unlockCostAP) || 0;
    const nextSet = resolveUnlockedKitNodes(character, ctx);
    nextSet.add(String(node.id));
    return {
        ap: Math.floor(Number(character?.ap) || 0) - cost,
        unlockedKitNodes: [...nextSet],
    };
}
