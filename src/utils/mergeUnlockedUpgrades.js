import { isKitNodeUnlocked, kitTalentNodeId } from "./kitProgression.js";

/**
 * Apply an unlocked talent/mastery's `UpgradeOp[]` (`mods[]`) onto a working clone of
 * an ability/trait/LB — VIEW render only (EDIT shows the raw unmerged node instead,
 * author view). Mirrors the mockup's `mergeAbility`/`applyUpgradeOp`
 * (`docs/mockups/kit-job-header/index.html:5993-6042`).
 */

function cloneNode(node) {
    return JSON.parse(JSON.stringify(node));
}

function patchAttackField(atk, key, patchVal) {
    if (!patchVal) return;
    if (typeof patchVal === "object" && atk[key]) atk[key] = { ...atk[key], ...patchVal };
    else atk[key] = patchVal;
}

function applyUpgradeOp(ab, op, track) {
    if (!op || typeof op !== "object") return;
    switch (op.op) {
        case "append_effect": {
            ab.effects = Array.isArray(ab.effects) ? ab.effects : [];
            const fx = { ...op.effect, id: op.effect?.id || `fx${ab.effects.length}` };
            ab.effects.push(fx);
            if (track) track.effectSources[fx.id] = track.badge;
            return;
        }
        case "replace_effect": {
            const i = (ab.effects || []).findIndex((e) => e.id === op.effectId);
            if (i >= 0) ab.effects[i] = { ...ab.effects[i], ...op.effect };
            return;
        }
        case "empower_effect": {
            const e = (ab.effects || []).find((x) => x.id === op.effectId);
            if (e) Object.assign(e, op.patch);
            return;
        }
        case "patch_attack": {
            if (!ab.attack) ab.attack = {};
            Object.keys(op.patch || {}).forEach((k) => {
                patchAttackField(ab.attack, k, op.patch[k]);
                if (track?.badge) track.attackPatches[k] = track.badge;
            });
            return;
        }
        case "add_tags": {
            ab.tags = [...(ab.tags || []), ...(op.tags || [])];
            return;
        }
        case "set_fields": {
            Object.assign(ab, op.patch || {});
            return;
        }
        case "prose_only":
        default:
            return;
    }
}

/**
 * Ordered [T1, T2, M] slots whose owning node is unlocked per G11.
 * `ctx.isLb` hard-blocks T1/T2 (talents) for limit breaks — G2 says LB upgrades
 * are **mastery-only**; `KitCardBodyB2`'s `UpgradesRow` already hides T1/T2 for
 * LB in the UI, this closes the same gap at the merge/roll level so a doc that
 * accidentally carries `talents[]` on an LB can never leak talent mods into Play.
 */
function unlockedUpgradeSlots(node, character, ctx) {
    const out = [];
    const parentKey = node?.key || node?.id;
    if (!ctx?.isLb) {
        (node?.talents || []).slice(0, 2).forEach((t, i) => {
            if (!t) return;
            const badge = i === 0 ? "T1" : "T2";
            const nodeId = t.id || t.key || kitTalentNodeId(parentKey, i === 0 ? "t0" : "t1");
            if (isKitNodeUnlocked(character, { id: nodeId, unlockCostAP: t.unlockCostAP }, ctx)) {
                out.push({ badge, up: t });
            }
        });
    }
    if (node?.mastery) {
        const nodeId = node.mastery.id || node.mastery.key || kitTalentNodeId(parentKey, "m");
        if (isKitNodeUnlocked(character, { id: nodeId, unlockCostAP: node.mastery.unlockCostAP }, ctx)) {
            out.push({ badge: "M", up: node.mastery });
        }
    }
    return out;
}

/**
 * @param {object|null} node — an A+ ability/trait/LB (as flattened by `useCharacterJobData`).
 * @param {Record<string, unknown>|null|undefined} character
 * @param {{ ownedBaseNodeIds?: string[], isLb?: boolean }} [ctx] — `isLb: true` blocks T1/T2 merge (G2).
 * @returns {object|null} cloned node with unlocked mods applied + `_mergeMeta.{effectSources,attackPatches}`
 *   provenance map (id/field → `"T1"`/`"T2"`/`"M"` badge) for the body's provenance chips.
 */
export function mergeUnlockedUpgrades(node, character, ctx = {}) {
    if (!node) return node;
    const ab = cloneNode(node);
    const meta = { effectSources: {}, attackPatches: {} };
    unlockedUpgradeSlots(node, character, ctx).forEach(({ badge, up }) => {
        (up.mods || []).forEach((op) => {
            applyUpgradeOp(ab, op, { badge, effectSources: meta.effectSources, attackPatches: meta.attackPatches });
        });
    });
    ab._mergeMeta = meta;
    return ab;
}
