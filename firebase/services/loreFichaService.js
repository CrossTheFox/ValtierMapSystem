import { db } from "../firebaseConfig";
import {
    collection,
    doc,
    addDoc,
    setDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    onSnapshot,
    serverTimestamp,
} from "firebase/firestore";

/** Ficha types stored in `lores/{id}/fichas`. Neutro, era and arco are fichas too. */
export const LORE_FICHA_TYPES = [
    "personaje",
    "locacion",
    "organizacion",
    "especie",
    "reliquia",
    "ideologia",
    "idioma",
    "cronica",
    "glosario",
    "mision",
    "evento_historico",
    "neutro",
    "era",
    "arco",
];

const fichasCol = (loreId) => collection(db, "lores", loreId, "fichas");

/** Anchor columns of an acontecimiento (`anchorToColumns`). Absent on a normal ficha create. */
const ANCHOR_KEYS = [
    "calendar", "precision", "start", "end", "bucket_unit", "bucket_ref", "era_ids", "arco_ids", "parent_id",
    "layout_x", "layout_y", "index_personajes", "index_lugares", "start_year", "end_year", "color",
];

function serializeFicha(snap) {
    const data = snap.data();
    const clean = {};
    for (const key in data) {
        const v = data[key];
        clean[key] = v?.seconds !== undefined && v?.nanoseconds !== undefined ? v.toDate().toISOString() : v;
    }
    return { id: snap.id, ...clean };
}

/**
 * Live list of a Lore's fichas. Rules only let the Lore owner read them.
 * @param {string} loreId
 * @param {(fichas: object[]) => void} onData
 * @param {(err: Error) => void} [onError]
 * @returns {() => void} unsubscribe
 */
export function subscribeLoreFichas(loreId, onData, onError) {
    return onSnapshot(
        fichasCol(loreId),
        (snap) => onData(snap.docs.map(serializeFicha)),
        (err) => onError?.(err),
    );
}

/**
 * @param {string} loreId
 * @param {{ entity_type: string, title: string, summary?: string, body?: string, slug: string, tags?: string[], image_url?: string|null }} data
 * @returns {Promise<string>} new ficha id
 */
export async function createLoreFicha(loreId, data) {
    const ref = await addDoc(fichasCol(loreId), {
        lore_id: loreId,
        entity_type: data.entity_type,
        title: data.title,
        summary: data.summary ?? "",
        body: data.body ?? "",
        image_url: data.image_url ?? null,
        tags: data.tags ?? [],
        slug: data.slug,
        source_ficha_id: null,
        ...(data.mesa_source ? { mesa_source: data.mesa_source } : {}),
        ...(Number.isFinite(Number(data.layout_lab_x)) ? {
            layout_lab_x: Number(data.layout_lab_x),
            layout_lab_y: Number(data.layout_lab_y),
        } : {}),
        ...Object.fromEntries(ANCHOR_KEYS.filter((key) => key in data).map((key) => [key, data[key]])),
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
    });
    return ref.id;
}

/** Writes a ficha at a known id. Used when a legacy era, arco or neutro becomes a ficha without changing id. */
export async function writeLoreFichaAt(loreId, fichaId, data) {
    await setDoc(doc(db, "lores", loreId, "fichas", fichaId), {
        lore_id: loreId,
        entity_type: data.entity_type,
        title: data.title,
        summary: data.summary ?? "",
        body: data.body ?? "",
        image_url: data.image_url ?? null,
        tags: data.tags ?? [],
        slug: data.slug,
        source_ficha_id: null,
        ...Object.fromEntries(ANCHOR_KEYS.filter((key) => key in data).map((key) => [key, data[key]])),
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
    });
}

/**
 * @param {string} loreId
 * @param {string} fichaId
 * @param {Partial<{ entity_type: string, title: string, summary: string, body: string, slug: string, tags: string[], image_url: string|null }>} patch
 */
export async function updateLoreFicha(loreId, fichaId, patch) {
    await updateDoc(doc(db, "lores", loreId, "fichas", fichaId), { ...patch, updated_at: serverTimestamp() });
}

export async function deleteLoreFicha(loreId, fichaId) {
    const snap = await getDocs(collection(db, "lores", loreId, "relaciones"));
    const doomed = snap.docs.filter((row) => {
        const data = row.data() || {};
        return data.from_ficha_id === fichaId || data.to_ficha_id === fichaId;
    });
    await Promise.all(doomed.map((row) => deleteDoc(row.ref)));
    await deleteDoc(doc(db, "lores", loreId, "fichas", fichaId));
}
