import { db } from "../firebaseConfig";
import {
    collection,
    doc,
    addDoc,
    deleteDoc,
    getDoc,
    getDocs,
    onSnapshot,
    query,
    updateDoc,
    where,
    serverTimestamp,
} from "firebase/firestore";

const loresCol = () => collection(db, "lores");

function serializeLore(snap) {
    const data = snap.data();
    const clean = {};
    for (const key in data) {
        const v = data[key];
        clean[key] = v?.seconds !== undefined && v?.nanoseconds !== undefined ? v.toDate().toISOString() : v;
    }
    return { id: snap.id, ...clean };
}

/**
 * Lores owned by `ownerId`, principal and copies. Rules only allow the owner's own rows.
 * @param {string} ownerId
 */
export async function listOwnedLores(ownerId) {
    const snap = await getDocs(query(loresCol(), where("owner_id", "==", ownerId)));
    return snap.docs.map(serializeLore);
}

/**
 * Principal Lore: no campaign, no `source_lore_id`.
 * @param {string} ownerId
 * @param {{ name: string, slug: string, summary?: string, description?: string, presentYear?: number|null, coverImageUrl?: string|null }} data
 * @returns {Promise<string>} new lore id
 */
export async function createPrincipalLore(ownerId, data) {
    const ref = await addDoc(loresCol(), {
        owner_id: ownerId,
        name: data.name,
        slug: data.slug,
        cover_image_url: data.coverImageUrl ?? null,
        summary: data.summary ?? "",
        description: data.description ?? "",
        visibility: "private",
        default_calendar: "dz",
        present_year: Number.isFinite(data.presentYear) ? data.presentYear : null,
        source_lore_id: null,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
    });
    return ref.id;
}

/**
 * A missing Lore and someone else's Lore both reject with permission-denied (rules read `resource.data`).
 * @param {string} loreId
 */
export async function getLore(loreId) {
    const snap = await getDoc(doc(db, "lores", loreId));
    return snap.exists() ? serializeLore(snap) : null;
}

/** Live Lore row (name, summary, present date). Owner-only, same as `getLore`. */
export function subscribeLore(loreId, onData, onError) {
    return onSnapshot(
        doc(db, "lores", loreId),
        (snap) => onData(snap.exists() ? serializeLore(snap) : null),
        (err) => onError?.(err),
    );
}

/** Partial update. Caller keeps `owner_id` and `visibility` unchanged (rules require it). */
export async function updateLore(loreId, patch) {
    await updateDoc(doc(db, "lores", loreId), { ...patch, updated_at: serverTimestamp() });
}

export async function deleteLore(loreId) {
    await deleteDoc(doc(db, "lores", loreId));
}
