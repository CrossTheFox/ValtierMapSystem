import { db } from "../firebaseConfig";
import { collection, documentId, doc, getDoc, getDocs, query, where } from "firebase/firestore";

/**
 * @param {string[]} classIds
 * @returns {Promise<Array<{ id: string } & Record<string, unknown>>>}
 */
export async function getClaseDocsByIds(classIds) {
    if (!Array.isArray(classIds) || !classIds.length) return [];

    const chunks = [];
    for (let i = 0; i < classIds.length; i += 10) {
        chunks.push(classIds.slice(i, i + 10));
    }

    const snapshots = await Promise.all(
        chunks.map((chunk) =>
            getDocs(query(collection(db, "clases"), where(documentId(), "in", chunk)))
        )
    );

    return snapshots.flatMap((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() })));
}

/**
 * Ability keys linked to a class (subcollection doc id === global `abilities` doc id).
 * @param {string} classId
 * @returns {Promise<string[]>}
 */
export async function getAbilityKeysForClase(classId) {
    if (!classId) return [];
    const snap = await getDocs(collection(db, "clases", classId, "abilities"));
    return snap.docs.map((d) => d.id);
}

/** @param {string} classId */
export async function getClaseDoc(classId) {
    if (!classId) return null;
    const ref = doc(db, "clases", classId);
    const snap = await getDoc(ref);
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
