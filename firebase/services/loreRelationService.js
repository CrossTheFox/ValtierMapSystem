import { db } from "../firebaseConfig";
import {
    collection,
    doc,
    addDoc,
    deleteDoc,
    getDocs,
    updateDoc,
    onSnapshot,
    serverTimestamp,
} from "firebase/firestore";

const relacionesCol = (loreId) => collection(db, "lores", loreId, "relaciones");

function serialize(snap) {
    const data = snap.data() || {};
    const clean = {};
    for (const key in data) {
        const value = data[key];
        clean[key] = value?.seconds !== undefined && value?.nanoseconds !== undefined
            ? value.toDate().toISOString()
            : value;
    }
    return { id: snap.id, ...clean };
}

/**
 * Live list of a Lore's lab edges.
 * @param {string} loreId
 * @param {(rows: object[]) => void} onData
 * @param {(err: Error) => void} [onError]
 */
/** One-shot list. Used when an index edit has to drop the matching edge. */
export async function listLoreRelaciones(loreId) {
    const snap = await getDocs(relacionesCol(loreId));
    return snap.docs.map(serialize);
}

export function subscribeLoreRelaciones(loreId, onData, onError) {
    return onSnapshot(
        relacionesCol(loreId),
        (snap) => onData(snap.docs.map(serialize)),
        (err) => onError?.(err),
    );
}

/**
 * Writes one edge. If `replaceId` is set, that row is removed first
 * so a pair keeps a single relation.
 * @param {string} loreId
 * @param {{ replaceId?: string|null, from_ficha_id: string, to_ficha_id: string, relation_type: string, label?: string, strength?: number, source_relacion_id?: string|null }} row
 * @returns {Promise<string>} new relation id
 */
export async function replaceLoreRelation(loreId, row) {
    if (row.replaceId) {
        await deleteDoc(doc(db, "lores", loreId, "relaciones", row.replaceId));
    }
    const ref = await addDoc(relacionesCol(loreId), {
        lore_id: loreId,
        from_ficha_id: row.from_ficha_id,
        to_ficha_id: row.to_ficha_id,
        relation_type: row.relation_type,
        label: row.label ?? "",
        strength: Number.isFinite(Number(row.strength)) ? Number(row.strength) : 0,
        source_relacion_id: row.source_relacion_id ?? null,
        ...(row.neural_lab ? { neural_lab: row.neural_lab } : {}),
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
    });
    return ref.id;
}

/**
 * Weight and provenance of an existing edge, in place.
 * @param {string} loreId
 * @param {string} relationId
 * @param {{ strength?: number, neural_lab?: object|null }} patch
 */
export async function patchLoreRelation(loreId, relationId, patch) {
    const next = { updated_at: serverTimestamp() };
    if (patch.strength !== undefined) {
        next.strength = Math.max(-10, Math.min(10, Math.round(Number(patch.strength) || 0)));
    }
    if (patch.neural_lab !== undefined) next.neural_lab = patch.neural_lab;
    await updateDoc(doc(db, "lores", loreId, "relaciones", relationId), next);
}

/**
 * Changes only the weight. The row stays, so the lab trace does not blink.
 * @param {string} loreId
 * @param {string} relationId
 * @param {number} strength
 */
export async function updateLoreRelationStrength(loreId, relationId, strength) {
    const next = Math.max(-10, Math.min(10, Math.round(Number(strength) || 0)));
    await updateDoc(doc(db, "lores", loreId, "relaciones", relationId), {
        strength: next,
        updated_at: serverTimestamp(),
    });
}

export async function deleteLoreRelation(loreId, relationId) {
    await deleteDoc(doc(db, "lores", loreId, "relaciones", relationId));
}
