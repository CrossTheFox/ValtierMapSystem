import { db } from "../firebaseConfig";
import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
} from "firebase/firestore";
import { linkedLocationIdsOf, locationLinkPatch } from "../../src/constants/wiki/archiveIdentity.js";

const wikiEntitiesRef = (campaignId) =>
    collection(db, "campaigns", campaignId, "wikiEntities");

const wikiEntityDocRef = (campaignId, entityId) =>
    doc(db, "campaigns", campaignId, "wikiEntities", entityId);

function serializeEntity(snap) {
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
 * List all wiki entities for a campaign, optionally filtered by role/visibility.
 * @param {string} campaignId
 * @param {{ role?: "dm" | "player" }} [opts]
 */
export async function listWikiEntities(campaignId, opts = {}) {
    const ref = wikiEntitiesRef(campaignId);
    const q = opts.role === "player"
        ? query(ref, where("visibility", "==", "players"), orderBy("title"))
        : query(ref, orderBy("title"));
    const snap = await getDocs(q);
    return snap.docs.map(serializeEntity);
}

/**
 * Get a single wiki entity by ID.
 */
export async function getWikiEntity(campaignId, entityId) {
    const snap = await getDoc(wikiEntityDocRef(campaignId, entityId));
    if (!snap.exists()) return null;
    return serializeEntity(snap);
}

/**
 * Create a new wiki entity.
 * @param {string} campaignId
 * @param {object} data — entityType, title, summary, body, tags, visibility, slug,
 *   linkedVttLocationId, linkedVttLocationIds, linkedVttCharacterId, imageUrl, customFields
 * @param {string} uid — createdBy
 */
export async function createWikiEntity(campaignId, data, uid) {
    const payload = {
        campaignId,
        entityType: data.entityType,
        title: data.title || "",
        summary: data.summary || "",
        body: data.body || "",
        tags: data.tags || [],
        visibility: data.visibility || "dm_only",
        slug: data.slug || "",
        ...locationLinkPatch(linkedLocationIdsOf(data)),
        linkedVttCharacterId: data.linkedVttCharacterId || null,
        imageUrl: data.imageUrl || null,
        customFields: data.customFields || {},
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: uid || null,
        updatedBy: uid || null,
    };
    const ref = await addDoc(wikiEntitiesRef(campaignId), payload);
    return { id: ref.id, ...payload };
}

/**
 * Update an existing wiki entity (partial).
 */
export async function updateWikiEntity(campaignId, entityId, data, uid) {
    const payload = {
        ...data,
        updatedAt: serverTimestamp(),
        updatedBy: uid || null,
    };
    await updateDoc(wikiEntityDocRef(campaignId, entityId), payload);
    return { id: entityId, ...payload };
}

/**
 * Delete a wiki entity.
 */
export async function deleteWikiEntity(campaignId, entityId) {
    await deleteDoc(wikiEntityDocRef(campaignId, entityId));
}

/**
 * Find wiki entities linked to a VTT location or character ID.
 * @param {string} campaignId
 * @param {{ locationId?: string, characterId?: string }} vttLink
 */
export async function findWikiEntitiesByVttLink(campaignId, { locationId, characterId } = {}) {
    const ref = wikiEntitiesRef(campaignId);
    if (locationId) {
        const [byLegacy, byArray] = await Promise.all([
            getDocs(query(ref, where("linkedVttLocationId", "==", locationId))),
            getDocs(query(ref, where("linkedVttLocationIds", "array-contains", locationId))),
        ]);
        const byId = new Map();
        for (const snap of [...byLegacy.docs, ...byArray.docs]) {
            byId.set(snap.id, serializeEntity(snap));
        }
        return [...byId.values()];
    }
    if (characterId) {
        const snap = await getDocs(query(ref, where("linkedVttCharacterId", "==", characterId)));
        return snap.docs.map(serializeEntity);
    }
    return [];
}

/**
 * Find a wiki entity by slug within a campaign.
 */
export async function findWikiEntityBySlug(campaignId, slug) {
    const ref = wikiEntitiesRef(campaignId);
    const q = query(ref, where("slug", "==", slug));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return serializeEntity(snap.docs[0]);
}
