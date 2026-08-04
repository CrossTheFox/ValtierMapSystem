import { db } from "../firebaseConfig";
import {
    collection,
    doc,
    getDocs,
    query,
    where,
    setDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    serverTimestamp,
} from "firebase/firestore";
import { DEFAULT_RULE_SYSTEM, normalizeRulesSystem } from "../../src/constants/ruleSystems.js";
import { TAG_CATEGORIES, TAG_CATEGORY_LIST } from "../../src/constants/abilityKinds.js";

const tagsCol = () => collection(db, "tags");

function slugifyKey(labelOrKey) {
    return String(labelOrKey || "tag")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 48) || "tag";
}

/**
 * @param {Record<string, unknown>} raw
 * @param {string} [id]
 */
export function normalizeTagDoc(raw, id = null) {
    if (!raw && !id) return null;
    const key = slugifyKey(raw?.key || id || raw?.label || "tag");
    const category = TAG_CATEGORY_LIST.includes(raw?.category)
        ? raw.category
        : TAG_CATEGORIES.OTHER;
    const aliases = Array.isArray(raw?.aliases)
        ? raw.aliases.map((a) => String(a || "").trim()).filter(Boolean)
        : [];
    return {
        id: id || key,
        key,
        label: String(raw?.label || key).trim() || key,
        rulesSystem: normalizeRulesSystem(raw?.rulesSystem),
        campaignId: raw?.campaignId == null || raw?.campaignId === ""
            ? null
            : String(raw.campaignId),
        category,
        summary: String(raw?.summary || "").trim(),
        description: String(raw?.description || raw?.summary || "").trim(),
        aliases,
        effects: Array.isArray(raw?.effects) ? raw.effects : [],
    };
}

/**
 * Merge core (campaignId null) + campaign custom for a rules system.
 * Custom with same key overrides core in the returned list (custom wins).
 *
 * @param {string} campaignId
 * @param {string} [rulesSystem]
 * @returns {Promise<ReturnType<typeof normalizeTagDoc>[]>}
 */
export async function listTagsForCampaign(campaignId, rulesSystem = DEFAULT_RULE_SYSTEM) {
    const system = normalizeRulesSystem(rulesSystem);
    // Single-field query — filter campaignId client-side (avoids composite index).
    const snap = await getDocs(query(tagsCol(), where("rulesSystem", "==", system)));
    const byKey = new Map();
    for (const d of snap.docs) {
        const tag = normalizeTagDoc(d.data(), d.id);
        const isCore = tag.campaignId == null;
        const isCustom = campaignId && tag.campaignId === campaignId;
        if (!isCore && !isCustom) continue;
        const prev = byKey.get(tag.key);
        if (!prev || isCustom) byKey.set(tag.key, tag);
    }
    return [...byKey.values()].sort((a, b) =>
        String(a.label).localeCompare(String(b.label)),
    );
}

/**
 * Live merge of core + campaign tags.
 * @param {string} campaignId
 * @param {(tags: ReturnType<typeof normalizeTagDoc>[]) => void} onChange
 * @param {string} [rulesSystem]
 * @returns {() => void} unsubscribe
 */
export function subscribeTagsForCampaign(campaignId, onChange, rulesSystem = DEFAULT_RULE_SYSTEM) {
    const system = normalizeRulesSystem(rulesSystem);

    return onSnapshot(
        query(tagsCol(), where("rulesSystem", "==", system)),
        (snap) => {
            const byKey = new Map();
            for (const d of snap.docs) {
                const tag = normalizeTagDoc(d.data(), d.id);
                const isCore = tag.campaignId == null;
                const isCustom = campaignId && tag.campaignId === campaignId;
                if (!isCore && !isCustom) continue;
                const prev = byKey.get(tag.key);
                if (!prev || isCustom) byKey.set(tag.key, tag);
            }
            const list = [...byKey.values()].sort((a, b) =>
                String(a.label).localeCompare(String(b.label)),
            );
            onChange(list);
        },
        (err) => {
            console.warn("[subscribeTagsForCampaign]", err);
            onChange([]);
        },
    );
}

/**
 * Create or update a tag. Core tags use doc id = key and campaignId null.
 * Custom tags use doc id = `${campaignId}__${key}` to avoid colliding with core.
 *
 * @param {object} opts
 * @param {string} opts.key
 * @param {string} opts.label
 * @param {string} [opts.rulesSystem]
 * @param {string|null} [opts.campaignId]
 * @param {string} [opts.category]
 * @param {string} [opts.summary]
 * @param {string} [opts.description]
 * @param {string[]} [opts.aliases]
 * @param {unknown[]} [opts.effects]
 */
export async function upsertTagDoc({
    key: rawKey,
    label,
    rulesSystem = DEFAULT_RULE_SYSTEM,
    campaignId = null,
    category = TAG_CATEGORIES.OTHER,
    summary = "",
    description = "",
    aliases = [],
    effects = [],
}) {
    const key = slugifyKey(rawKey || label);
    const isCustom = Boolean(campaignId);
    const docId = isCustom ? `${campaignId}__${key}` : key;
    const ref = doc(db, "tags", docId);
    const payload = {
        key,
        label: String(label || key).trim() || key,
        rulesSystem: normalizeRulesSystem(rulesSystem),
        campaignId: isCustom ? campaignId : null,
        category: TAG_CATEGORY_LIST.includes(category) ? category : TAG_CATEGORIES.OTHER,
        summary: String(summary || "").trim(),
        description: String(description || summary || "").trim(),
        aliases: Array.isArray(aliases)
            ? aliases.map((a) => String(a || "").trim()).filter(Boolean)
            : [],
        effects: Array.isArray(effects) ? effects : [],
        updatedAt: serverTimestamp(),
    };

    // setDoc merge so create/update both work; stamp createdAt only on first write via merge fields
    await setDoc(ref, { ...payload, createdAt: serverTimestamp() }, { merge: true });
    return docId;
}

/**
 * Partial update by document id.
 * @param {string} tagDocId
 * @param {Record<string, unknown>} partial
 */
export async function updateTagFields(tagDocId, partial) {
    if (!tagDocId || !partial) return;
    const payload = { ...partial, updatedAt: serverTimestamp() };
    if (partial.key) payload.key = slugifyKey(partial.key);
    if (partial.category && !TAG_CATEGORY_LIST.includes(partial.category)) {
        payload.category = TAG_CATEGORIES.OTHER;
    }
    if (partial.rulesSystem) {
        payload.rulesSystem = normalizeRulesSystem(partial.rulesSystem);
    }
    await updateDoc(doc(db, "tags", tagDocId), payload);
}

/**
 * Delete a tag doc. Prefer custom campaign tags; core deletion allowed for DM tooling.
 * @param {string} tagDocId
 */
export async function deleteTagDoc(tagDocId) {
    if (!tagDocId) return;
    await deleteDoc(doc(db, "tags", tagDocId));
}
