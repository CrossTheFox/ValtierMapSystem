import { db } from "../firebaseConfig";
import {
    collection,
    doc,
    addDoc,
    updateDoc,
    getDocs,
    query,
    orderBy,
    limit,
    serverTimestamp,
    deleteDoc,
} from "firebase/firestore";

const sessionsCol = (campaignId) => collection(db, "campaigns", campaignId, "sessions");

export async function listSessionLogs(campaignId, max = 20) {
    const q = query(sessionsCol(campaignId), orderBy("sessionDate", "desc"), limit(max));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createSessionLog(campaignId, data) {
    const ref = await addDoc(sessionsCol(campaignId), {
        title: data.title ?? "Sesión sin título",
        recap: data.recap ?? "",
        sessionDate: data.sessionDate ?? new Date().toISOString().slice(0, 10),
        participants: data.participants ?? [],
        highlights: data.highlights ?? [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return ref.id;
}

export async function updateSessionLog(campaignId, sessionId, data) {
    await updateDoc(doc(db, "campaigns", campaignId, "sessions", sessionId), {
        ...data,
        updatedAt: serverTimestamp(),
    });
}

export async function deleteSessionLog(campaignId, sessionId) {
    await deleteDoc(doc(db, "campaigns", campaignId, "sessions", sessionId));
}
