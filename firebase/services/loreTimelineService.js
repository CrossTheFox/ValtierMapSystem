import { db } from "../firebaseConfig";
import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    serverTimestamp,
} from "firebase/firestore";

/**
 * Eras and arcos of a Lore's line (`docs/Modelo/linea-de-tiempo.md`). They are not fichas:
 * `lores/{loreId}/eras` and `lores/{loreId}/arcos`. One line per Lore for now (no `timelines` rows).
 */
const col = (loreId, kind) => collection(db, "lores", loreId, kind);

function subscribe(loreId, kind, onData, onError) {
    return onSnapshot(
        col(loreId, kind),
        (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => onError?.(err),
    );
}

export function subscribeLoreEras(loreId, onData, onError) {
    return subscribe(loreId, "eras", onData, onError);
}

export function subscribeLoreArcos(loreId, onData, onError) {
    return subscribe(loreId, "arcos", onData, onError);
}

/**
 * @param {{ title: string, summary?: string, start_year: number, end_year?: number|null }} data
 */
export async function createLoreEra(loreId, data) {
    const ref = await addDoc(col(loreId, "eras"), {
        lore_id: loreId,
        title: data.title,
        summary: data.summary ?? "",
        body: data.body ?? "",
        start_year: data.start_year ?? null,
        end_year: data.end_year ?? null,
        layout_x: data.layout_x ?? null,
        layout_y: data.layout_y ?? null,
        source_era_id: null,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
    });
    return ref.id;
}

/**
 * @param {{ title: string, summary?: string, color?: string|null, start?: string|null, end?: string|null, era_ids?: string[] }} data
 */
export async function createLoreArco(loreId, data) {
    const ref = await addDoc(col(loreId, "arcos"), {
        lore_id: loreId,
        title: data.title,
        summary: data.summary ?? "",
        body: data.body ?? "",
        color: data.color || null,
        start: data.start || null,
        end: data.end || null,
        era_ids: data.era_ids ?? [],
        layout_x: data.layout_x ?? null,
        layout_y: data.layout_y ?? null,
        source_arco_id: null,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
    });
    return ref.id;
}

export async function updateLoreTimelineItem(loreId, kind, id, patch) {
    await updateDoc(doc(db, "lores", loreId, kind, id), { ...patch, updated_at: serverTimestamp() });
}

export async function deleteLoreTimelineItem(loreId, kind, id) {
    await deleteDoc(doc(db, "lores", loreId, kind, id));
}
