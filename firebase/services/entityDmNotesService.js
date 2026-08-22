/**
 * DM-only secret notes for a wiki entity (AI prep / private GM guidance).
 * Stored OUTSIDE wikiEntities so players who can read the public ficha never
 * receive these fields (Firestore has no field-level security).
 *
 * Path: campaigns/{campaignId}/entityDmNotes/{entityId}
 */

import { db } from "../firebaseConfig";
import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp,
} from "firebase/firestore";

const notesDocRef = (campaignId, entityId) =>
    doc(db, "campaigns", campaignId, "entityDmNotes", entityId);

function serializeNotes(snap) {
    if (!snap.exists()) {
        return { entityId: snap.id, notes: "", updatedAt: null, updatedBy: null };
    }
    const data = snap.data() || {};
    const updatedAt = data.updatedAt?.toDate?.()
        ? data.updatedAt.toDate().toISOString()
        : data.updatedAt ?? null;
    return {
        entityId: snap.id,
        notes: typeof data.notes === "string" ? data.notes : "",
        updatedAt,
        updatedBy: data.updatedBy ?? null,
    };
}

/**
 * @param {string} campaignId
 * @param {string} entityId
 * @returns {Promise<{ entityId: string, notes: string, updatedAt: string|null, updatedBy: string|null }>}
 */
export async function getEntityDmNotes(campaignId, entityId) {
    if (!campaignId || !entityId) {
        return { entityId: entityId || "", notes: "", updatedAt: null, updatedBy: null };
    }
    const snap = await getDoc(notesDocRef(campaignId, entityId));
    return serializeNotes(snap);
}

/**
 * Upsert DM notes for an entity. Call only from DM clients (rules enforce).
 * @param {string} campaignId
 * @param {string} entityId
 * @param {string} notes
 * @param {string} uid
 */
export async function setEntityDmNotes(campaignId, entityId, notes, uid) {
    if (!campaignId || !entityId) return null;
    const payload = {
        notes: typeof notes === "string" ? notes : "",
        updatedAt: serverTimestamp(),
        updatedBy: uid || null,
    };
    await setDoc(notesDocRef(campaignId, entityId), payload, { merge: true });
    return { entityId, notes: payload.notes, updatedBy: uid || null };
}
