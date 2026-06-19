import { db } from "../firebaseConfig";
import {
    collection,
    doc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
} from "firebase/firestore";

export const WIKI_RELATION_STRENGTH_MIN = -10;
export const WIKI_RELATION_STRENGTH_MAX = 10;

/** Clamp narrative affinity to -10..+10 (0 = neutral). */
export function clampRelationStrength(value) {
    const n = Number(value);
    if (Number.isNaN(n)) return 0;
    return Math.max(WIKI_RELATION_STRENGTH_MIN, Math.min(WIKI_RELATION_STRENGTH_MAX, Math.round(n)));
}

const wikiRelationsRef = (campaignId) =>
    collection(db, "campaigns", campaignId, "entityRelations");

const wikiRelationDocRef = (campaignId, relationId) =>
    doc(db, "campaigns", campaignId, "entityRelations", relationId);

function serializeRelation(snap) {
    const data = snap.data();
    const clean = {};
    for (const key in data) {
        const v = data[key];
        if (v?.seconds !== undefined && v?.nanoseconds !== undefined) {
            clean[key] = v.toDate().toISOString();
        } else {
            clean[key] = v;
        }
    }
    return { id: snap.id, ...clean };
}

/**
 * List all relations involving an entity (either as from or to).
 */
export async function listRelationsForEntity(campaignId, entityId) {
    const ref = wikiRelationsRef(campaignId);
    const [fromSnap, toSnap] = await Promise.all([
        getDocs(query(ref, where("fromEntityId", "==", entityId), orderBy("createdAt"))),
        getDocs(query(ref, where("toEntityId", "==", entityId), orderBy("createdAt"))),
    ]);
    const seen = new Set();
    const results = [];
    for (const snap of [...fromSnap.docs, ...toSnap.docs]) {
        if (!seen.has(snap.id)) {
            seen.add(snap.id);
            results.push(serializeRelation(snap));
        }
    }
    return results;
}

/**
 * List all relations for a campaign.
 */
export async function listAllRelations(campaignId) {
    const ref = wikiRelationsRef(campaignId);
    const snap = await getDocs(query(ref, orderBy("createdAt")));
    return snap.docs.map(serializeRelation);
}

/**
 * Create a relation between two wiki entities.
 */
export async function createWikiRelation(campaignId, data, uid) {
    const payload = {
        campaignId,
        fromEntityId: data.fromEntityId,
        toEntityId: data.toEntityId,
        relationType: data.relationType,
        label: data.label || "",
        strength: clampRelationStrength(data.strength ?? 0),
        createdAt: serverTimestamp(),
        createdBy: uid || null,
    };
    const ref = await addDoc(wikiRelationsRef(campaignId), payload);
    return { id: ref.id, ...payload };
}

/**
 * Update an existing relation (partial).
 */
export async function updateWikiRelation(campaignId, relationId, data) {
    const payload = { ...data };
    if (payload.strength !== undefined) {
        payload.strength = clampRelationStrength(payload.strength);
    }
    await updateDoc(wikiRelationDocRef(campaignId, relationId), payload);
    return { id: relationId, ...payload };
}

/**
 * Delete a relation.
 */
export async function deleteWikiRelation(campaignId, relationId) {
    await deleteDoc(wikiRelationDocRef(campaignId, relationId));
}
